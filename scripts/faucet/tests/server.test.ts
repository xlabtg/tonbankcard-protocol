import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createFaucetServer, DryRunDispenser } from '../src/server';
import { FaucetRateLimiter } from '../src/rateLimit';

const VALID_ADDRESS = '0:' + 'a'.repeat(64);

function build(now: () => number = () => Date.now()) {
  const rateLimiter = new FaucetRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxPerWindow: 1,
    now,
  });
  const app = createFaucetServer({
    dispenser: new DryRunDispenser('ton-testnet'),
    rateLimiter,
    network: 'ton-testnet',
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  return { app, rateLimiter };
}

describe('TBC faucet HTTP server', () => {
  let clock = 1_700_000_000_000;
  let server: ReturnType<typeof build>;

  beforeEach(() => {
    clock = 1_700_000_000_000;
    server = build(() => clock);
  });

  it('GET /health responds 200', async () => {
    const res = await request(server.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-tonbankcard-environment']).toBe('sandbox');
  });

  it('GET /faucet/status returns sandbox metadata', async () => {
    const res = await request(server.app).get('/faucet/status');
    expect(res.status).toBe(200);
    expect(res.body.network).toBe('ton-testnet');
    expect(res.body.rateLimit).toEqual({ windowSeconds: 3600, maxPerWindow: 1 });
  });

  it('GET /faucet/status reports the configured rate-limit policy', async () => {
    const rateLimiter = new FaucetRateLimiter({
      windowMs: 15 * 60 * 1000,
      maxPerWindow: 2,
      now: () => clock,
    });
    const app = createFaucetServer({
      dispenser: new DryRunDispenser('ton-testnet'),
      rateLimiter,
      network: 'ton-testnet',
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const res = await request(app).get('/faucet/status');
    expect(res.status).toBe(200);
    expect(res.body.rateLimit).toEqual({ windowSeconds: 900, maxPerWindow: 2 });
  });

  it('GET /faucet/status?address=… reports allowed=true for fresh address', async () => {
    const res = await request(server.app).get('/faucet/status').query({ address: VALID_ADDRESS });
    expect(res.status).toBe(200);
    expect(res.body.allowedNow).toBe(true);
  });

  it('POST /faucet/dispense returns synthetic tx and X-Tonbankcard-Environment header', async () => {
    const res = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.address).toBe(VALID_ADDRESS);
    expect(res.body.network).toBe('ton-testnet');
    expect(res.body.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.headers['x-tonbankcard-environment']).toBe('sandbox');
  });

  it('POST /faucet/dispense enforces 1-per-hour limit', async () => {
    const first = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS });
    expect(first.status).toBe(200);

    clock += 10_000;

    const second = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(second.headers['retry-after']).toBeDefined();
  });

  it('POST /faucet/dispense returns 400 on missing address', async () => {
    const res = await request(server.app).post('/faucet/dispense').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('POST /faucet/dispense returns 400 on malformed address', async () => {
    const res = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: 'definitely-not-a-ton-address' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ADDRESS');
  });

  it('POST /faucet/dispense returns 422 when amount exceeds the cap', async () => {
    const res = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS, amount: '1000000000000' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('AMOUNT_EXCEEDED');
  });

  it('rolls over the rate limit window after one hour', async () => {
    const first = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS });
    expect(first.status).toBe(200);

    clock += 60 * 60 * 1000 + 1;

    const second = await request(server.app)
      .post('/faucet/dispense')
      .send({ address: VALID_ADDRESS });
    expect(second.status).toBe(200);
  });
});
