'use strict';
// По умолчанию подтверждаем дефекты baseline; CHECK501_EXPECT_FIXED=1 проверяет
// желаемое поведение и должен падать до исправлений в отдельных issues.
require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Address, beginCell } = require('../../node_modules/@ton/core');
const fixed = process.env.CHECK501_EXPECT_FIXED === '1';
const { InvoiceService } = require('../../api/src/services/InvoiceService.ts');
const { ApiKeyService } = require('../../api/src/services/ApiKeyService.ts');
const { hashMetadata } = require('../../api/src/utils/helpers.ts');
const { signSettlementEvent } = require('../../api/src/utils/settlementAttestation.ts');
const { TonbankcardSDK } = require('../../sdk/src/sdk.ts');
const { EventParser } = require('../../backend/indexer/src/parsers/event-parser.ts');
const nft = Address.parse('0:' + '11'.repeat(32));
const merchant = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const apiKey = 'tbck_test_check501_1234567890abcdef';
const secret = 'check501-local-attestation-secret';
function service() {
  const keys = new ApiKeyService();
  keys.registerKey(apiKey, merchant);
  return new InvoiceService(keys);
}
const request = () => ({ merchant_nft: merchant, amount_tbc: '1000000000', currency: 'TBC' });

test('H1: скомпилированные Tact события теряются в EventParser', { timeout: 10000 }, () => {
  const hub = require('../../contracts/payment-hub/dist/PaymentHub_PaymentHub.ts');
  const mh = require('../../contracts/payment-hub/dist/deployable/MerchantPaymentHub/MerchantPaymentHub_MerchantPaymentHub.ts');
  const cells = [
    beginCell().store(hub.storeInternalTransferEvent({ $$type: 'InternalTransferEvent', from_nft: nft,
      to_nft: nft, amount_tbc: 1n, payload_hash: 0n, timestamp: 1700000000n })).endCell(),
    beginCell().store(hub.storeAccountStateChangedEvent({ $$type: 'AccountStateChangedEvent', nft_address: nft,
      old_state: 0n, new_state: 1n, timestamp: 1700000000n })).endCell(),
    beginCell().store(mh.storeMerchantPayment({ $$type: 'MerchantPayment', payer_nft: nft,
      merchant_nft: nft, amount_tbc: 1n, payload_hash: 0n, timestamp: 1700000000n })).endCell(),
  ];
  for (const cell of cells) {
    const op = cell.beginParse().loadUint(32).toString(16);
    const result = new EventParser().parseTransaction({ hash: 'local', out_msgs: [
      { destination: '', msg_data: { body: cell.toBoc().toString('base64') } } ] }, nft.toString(), 100, 1700000000);
    console.log(`Tact op=0x${op}, parsed=${result.length}`);
    assert.equal(result.length, fixed ? 1 : 0);
  }
});

test('H2: RPC ошибка shard не останавливает фиксацию cursor', { timeout: 10000 }, async () => {
  const { IndexerService } = require('../../backend/indexer/src/services/indexer-service.ts');
  const { loadConfig } = require('../../backend/indexer/src/types/config.ts');
  const config = loadConfig(); config.contracts.paymentHub = nft.toString();
  const pino = require('../../backend/indexer/node_modules/pino');
  let cursor = 99, count;
  const db = { transaction: fn => fn(), insertBlock: (...args) => { count = args[4]; },
    updateLatestBlock: n => { cursor = n; } };
  const indexer = new IndexerService(config, db, pino({ enabled: false }));
  indexer.getBlockByNumber = async () => ({ root_hash: 'hash', prev_blocks: [], utime: 1700000000 });
  indexer.fetchTonApi = async () => { throw new Error('synthetic RPC failure'); };
  await indexer.processBlock(100);
  console.log(`RPC failed: cursor=${cursor}, transactionCount=${count}`);
  assert.equal(cursor, fixed ? 99 : 100);
});

test('H3: mobile создаёт перевод native TON на NFT вместо TBC request', { timeout: 10000 }, () => {
  const { PaymentService } = require('../../mobile/src/services/PaymentService.ts');
  const hub = Address.parse('0:' + '22'.repeat(32)).toString();
  const link = new PaymentService({ network: 'testnet', paymentHubAddress: hub }).generatePaymentLink({
    merchantNft: nft.toString(), amountTbc: '1000000000' });
  const url = new URL(link);
  console.log(`destination=${decodeURIComponent(url.pathname)}, amount=${url.searchParams.get('amount')}, bin=${url.searchParams.has('bin')}`);
  assert.equal(url.searchParams.has('bin'), fixed);
  if (!fixed) assert.equal(decodeURIComponent(url.pathname), '/' + nft.toString());
});

test('M1: TS SDK не читает реальный public invoice API', { timeout: 10000 }, async () => {
  const s = service(); const invoice = await s.createInvoice(request(), apiKey);
  const body = await s.getPublicInvoice(invoice.invoice_id);
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify(body), { status: 200 });
  try {
    const sdk = new TonbankcardSDK({ network: 'testnet', apiEndpoint: 'https://local.invalid/v1' });
    if (fixed) assert.equal((await sdk.getInvoice(invoice.invoice_id)).id, invoice.invoice_id);
    else await assert.rejects(sdk.getInvoice(invoice.invoice_id));
    console.log(`public invoice fields: ${Object.keys(body).join(', ')}`);
  } finally { global.fetch = originalFetch; }
});

test('M2: expiry зависит от чтения перед доставкой финального события', { timeout: 10000 }, async () => {
  const RealDate = Date; let clock = RealDate.now();
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  };
  try {
    const s1 = service(), s2 = service();
    const req = { ...request(), expires_at: new Date(clock + 60000).toISOString() };
    const i1 = await s1.createInvoice(req, apiKey), i2 = await s2.createInvoice(req, apiKey);
    const events = [i1, i2].map(i => ({ payer_nft: nft.toString(), merchant_nft: merchant,
      amount_tbc: i.amount_tbc, payload_hash: hashMetadata({ ...i.metadata, invoice_id: i.invoice_id }),
      block_number: 100, tx_hash: 'local', timestamp: Math.floor((clock + 30000) / 1000) }));
    clock += 120000;
    await s1.getInvoice(i1.invoice_id); // Платёж был ДО expiry, доставлен ПОСЛЕ.
    const settle = (s, event) => s.processSettlementEvent(event, { indexerSecret: secret,
      attestation: signSettlementEvent(secret, event), currentBlockNumber: 110 });
    const r1 = await settle(s1, events[0]), r2 = await settle(s2, events[1]);
    console.log(`read before event: ${r1.settled}, no read: ${r2.settled}`);
    assert.equal(r1.settled, fixed); assert.equal(r2.settled, true);
  } finally { global.Date = RealDate; }
});

test('M3: entry point singleton блокирует production даже при URL storage', { timeout: 10000 }, () => {
  const { invoiceService } = require('../../api/src/services/InvoiceService.ts');
  const env = { NODE_ENV: 'production', DATABASE_URL: 'postgres://local/audit', REDIS_URL: 'redis://local' };
  if (fixed) assert.doesNotThrow(() => invoiceService.assertProductionStorageConfigured(env));
  else assert.throws(() => invoiceService.assertProductionStorageConfigured(env), /Persistent invoice/);
});

test('M4: whitelist принимает collection как merchant NFT', { timeout: 10000 }, () => {
  const { validateWhitelistedNFT } = require('../../api/src/utils/validation.ts');
  if (fixed) assert.throws(() => validateWhitelistedNFT(merchant));
  else { assert.equal(validateWhitelistedNFT(merchant), true);
    assert.throws(() => validateWhitelistedNFT(nft.toString()), /whitelisted collection/); }
});

test('H4: развёрнутый IPv4-mapped IPv6 обходит SSRF denylist', { timeout: 10000 }, async () => {
  const { isBlockedAddress, assertSafeWebhookUrl } = require('../../api/src/utils/ssrfGuard.ts');
  assert.equal(isBlockedAddress('::ffff:7f00:1'), true);
  assert.equal(isBlockedAddress('0:0:0:0:0:ffff:7f00:1'), fixed);
  const probe = assertSafeWebhookUrl('https://local.invalid', {
    lookup: async () => ['0:0:0:0:0:ffff:7f00:1'], allowHosts: [] });
  if (fixed) await assert.rejects(probe); else await probe;
});
