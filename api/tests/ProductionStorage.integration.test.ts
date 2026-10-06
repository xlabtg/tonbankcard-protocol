import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { configureProductionStorage } from '../src/storage/production';
import { InvoiceService } from '../src/services/InvoiceService';
import { ApiKeyService } from '../src/services/ApiKeyService';
const suite = process.env.TEST_DATABASE_URL && process.env.TEST_REDIS_URL ? describe : describe.skip;
suite('real production stores #511/#512', () => {
 test('fresh service instances preserve invoices, idempotency and API-key revocation', async () => {
  const env = {NODE_ENV:'production',DATABASE_URL:process.env.TEST_DATABASE_URL,REDIS_URL:process.env.TEST_REDIS_URL};
  const db = new Pool({connectionString:env.DATABASE_URL});
  await db.query(fs.readFileSync(path.resolve(__dirname,'../migrations/001-production-storage.sql'),'utf8'));
  const plaintext='tbc_test_' + '12'.repeat(32);
  const merchant='EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
  const keys1=new ApiKeyService(), service1=new InvoiceService(keys1);
  const connection1=await configureProductionStorage(service1,keys1,env);
  try {
   const key=await keys1.registerApiKeyAsync(plaintext,merchant);
   const request={merchant_nft:merchant,amount_tbc:'100',currency:'TBC' as const,metadata:{order_id:'restart-'+Date.now()}};
   const invoice=await service1.createInvoice(request,plaintext);
   await connection1!.close();
   const keys2=new ApiKeyService(), service2=new InvoiceService(keys2);
   const connection2=await configureProductionStorage(service2,keys2,env);
   try {
    expect((await keys2.findAndValidateKeyAsync(plaintext)).key_id).toBe(key.key_id);
    expect((await service2.getInvoice(invoice.invoice_id)).invoice_id).toBe(invoice.invoice_id);
    expect((await service2.createInvoice(request,plaintext)).invoice_id).toBe(invoice.invoice_id);
    await keys2.revokeByKeyIdAsync(key.key_id);
    const keys3=new ApiKeyService(), service3=new InvoiceService(keys3);
    const connection3=await configureProductionStorage(service3,keys3,env);
    try {await expect(keys3.findAndValidateKeyAsync(plaintext)).rejects.toThrow();} finally {await connection3!.close();}
    await expect(keys2.findAndValidateKeyAsync(plaintext)).rejects.toThrow();
   } finally {await connection2!.close();}
  } finally {await db.end();}
 },30000);
});
