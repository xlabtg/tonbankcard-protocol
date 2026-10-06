import { Address } from '@ton/core';
import request from 'supertest';
import { FaucetRateLimiter } from '../src/rateLimit';
import { isValidTonAddress } from '../src/validation';
import { createFaucetServer, DryRunDispenser } from '../src/server';
const address = Address.parse('0:' + '12'.repeat(32));
test('checksum is verified', () => expect(isValidTonAddress('EQ' + 'A'.repeat(46))).toBe(false));
test('all encodings share a wallet bucket', () => {
  const limiter = new FaucetRateLimiter();
  expect(limiter.consume(address.toRawString()).allowed).toBe(true);
  for (const bounceable of [true, false]) for (const testOnly of [true, false]) {
    expect(limiter.consume(address.toString({ bounceable, testOnly })).allowed).toBe(false);
  }
});
test('requested amount cannot exceed configured default', async () => {
  const app = createFaucetServer({ dispenser: new DryRunDispenser(), defaultDispenseNanocoins: 5n });
  expect((await request(app).post('/faucet/dispense').send({ address: address.toRawString(), amount: '6' })).status).toBe(422);
});
test('new wallets cannot bypass the IP budget', async () => {
  const app = createFaucetServer({ dispenser: new DryRunDispenser() });
  let status = 200;
  for (let i = 1; i <= 6; i++) status = (await request(app).post('/faucet/dispense').send({address: '0:' + i.toString(16).padStart(64, '0')})).status;
  expect(status).toBe(429);
});
