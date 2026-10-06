import { PostgresInvoiceStorage } from '../src/storage/PostgresStorage';
import { InMemoryInvoiceStorage } from '../src/storage/InMemoryStorage';
import { Invoice } from '../src/types/invoice';
const invoice = {invoice_id:'inv_race',status:'pending',expires_at:'2020-01-01T00:00:00Z'} as Invoice;
test('stale expiry cannot overwrite settlement #511', async () => {
 const storage = new InMemoryInvoiceStorage();
 await storage.set(invoice);
 const stale = await storage.get(invoice.invoice_id);
 const settlement = {tx_hash:'tx'} as NonNullable<Invoice['settlement']>;
 await storage.transition(invoice.invoice_id,'pending','settled',{settlement});
 expect(stale?.status).toBe('pending');
 expect(await storage.transition(invoice.invoice_id,'pending','expired')).toBeUndefined();
 expect(await storage.get(invoice.invoice_id)).toMatchObject({status:'settled',settlement});
});
test('Postgres uses conditional UPDATE and preserves settlement on expiry', async () => {
 const pool = { query: jest.fn().mockResolvedValue({rows:[]}) };
 const storage = new PostgresInvoiceStorage(pool);
 expect(await storage.transition('inv_race','pending','expired')).toBeUndefined();
 expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/WHERE invoice_id = \$1 AND status = \$2/),['inv_race','pending','expired',null]);
 expect(pool.query.mock.calls[0][0]).toContain('COALESCE($4::jsonb, settlement)');
});

test('mock pool interleaving reads pending, settles, then rejects stale expiry #511', async () => {
 let row: Record<string,unknown> = {...invoice, created_at:new Date('2020-01-01'),expires_at:new Date('2020-01-02'),settlement:null};
 const pool={query:jest.fn(async (sql:string, values?:unknown[]) => {
  if(sql.startsWith('SELECT')) return {rows:[structuredClone(row)]};
  if(row.status !== values![1]) return {rows:[]};
  row={...row,status:values![2],settlement:values![3] ? JSON.parse(values![3] as string):row.settlement};
  return {rows:[structuredClone(row)]};
 })};
 const storage=new PostgresInvoiceStorage(pool);
 const stale=await storage.get(invoice.invoice_id);
 expect(stale!.status).toBe('pending');
 const settlement={tx_hash:'confirmed'} as NonNullable<Invoice['settlement']>;
 await storage.transition(invoice.invoice_id,'pending','settled',{settlement});
 expect(await storage.transition(stale!.invoice_id,'pending','expired')).toBeUndefined();
 expect(await storage.get(invoice.invoice_id)).toMatchObject({status:'settled',settlement});
});
