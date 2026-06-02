/**
 * `trust proxy` configuration tests
 *
 * Covers the fix for audit finding API-H2 (issue #251):
 *  - `parseTrustProxy` maps every accepted `TRUST_PROXY` form to the value
 *    Express expects, and fails closed (`false`) on empty/unknown input.
 *  - `configureTrustProxy` applies the value and warns on blanket `true`.
 *  - Regression: behind a simulated single proxy hop, distinct client IPs
 *    (carried in `X-Forwarded-For`) land in distinct per-IP rate-limit buckets,
 *    whereas with proxy trust disabled they collapse into one shared bucket.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import express from 'express';
import type { Express } from 'express';
import http from 'http';
import { AddressInfo } from 'net';

import {
  parseTrustProxy,
  getTrustProxySetting,
  configureTrustProxy,
} from '../src/config/trustProxy';

const ORIGINAL_ENV = { ...process.env };

async function loadRateLimiter(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  jest.resetModules();
  return import('../src/middleware/rateLimiter');
}

function startApp(app: Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('parseTrustProxy', () => {
  it('fails closed to false for unset / empty input', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
  });

  it('parses the boolean keywords case-insensitively', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('True')).toBe(true);
  });

  it('parses a bare positive integer as a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy(' 3 ')).toBe(3);
  });

  it('passes presets and IP/CIDR lists through unchanged', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8,127.0.0.1')).toBe('10.0.0.0/8,127.0.0.1');
  });
});

describe('getTrustProxySetting', () => {
  it('reads TRUST_PROXY from the supplied environment', () => {
    expect(getTrustProxySetting({ TRUST_PROXY: '1' })).toBe(1);
    expect(getTrustProxySetting({})).toBe(false);
  });
});

describe('configureTrustProxy', () => {
  it('applies the resolved value to the app and returns it', () => {
    const settings: Record<string, unknown> = {};
    const app = { set: (name: string, value: unknown) => (settings[name] = value) };
    const logger = { log: jest.fn(), warn: jest.fn() };

    const result = configureTrustProxy(app, { TRUST_PROXY: '2' }, logger);

    expect(result).toBe(2);
    expect(settings['trust proxy']).toBe(2);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  it('warns when blanket trust (true) is configured', () => {
    const app = { set: jest.fn() };
    const logger = { log: jest.fn(), warn: jest.fn() };

    configureTrustProxy(app, { TRUST_PROXY: 'true' }, logger);

    expect(app.set).toHaveBeenCalledWith('trust proxy', true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.log).not.toHaveBeenCalled();
  });
});

describe('per-IP rate limiting behind a proxy hop', () => {
  let trusted: { server: http.Server; baseUrl: string };
  let untrusted: { server: http.Server; baseUrl: string };

  beforeAll(async () => {
    const { publicIpRateLimiter } = await loadRateLimiter({
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_PUBLIC_PER_MIN: '2',
    });

    // App that trusts exactly one proxy hop: req.ip is taken from the single
    // X-Forwarded-For entry the proxy adds, so distinct clients get distinct
    // buckets.
    const trustedApp = express();
    configureTrustProxy(trustedApp, { TRUST_PROXY: '1' }, { log: () => {}, warn: () => {} });
    trustedApp.get('/public', publicIpRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    trusted = await startApp(trustedApp);

    // App that trusts no proxy: X-Forwarded-For is ignored and every request
    // collapses onto the shared loopback socket address (the bug API-H2 fixes).
    const untrustedApp = express();
    configureTrustProxy(untrustedApp, { TRUST_PROXY: 'false' }, { log: () => {}, warn: () => {} });
    untrustedApp.get('/public', publicIpRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    untrusted = await startApp(untrustedApp);
  });

  afterAll(() => {
    trusted.server.close();
    untrusted.server.close();
  });

  it('gives distinct forwarded client IPs distinct buckets when the proxy is trusted', async () => {
    const clientA = { 'X-Forwarded-For': '203.0.113.1' };
    const clientB = { 'X-Forwarded-For': '203.0.113.2' };

    // Client A exhausts its quota of 2…
    for (let i = 0; i < 2; i++) {
      const ok = await fetch(`${trusted.baseUrl}/public`, { headers: clientA });
      expect(ok.status).toBe(200);
    }
    const blockedA = await fetch(`${trusted.baseUrl}/public`, { headers: clientA });
    expect(blockedA.status).toBe(429);

    // …but client B is untouched: it has its own bucket.
    const okB = await fetch(`${trusted.baseUrl}/public`, { headers: clientB });
    expect(okB.status).toBe(200);
  });

  it('collapses all forwarded IPs into one bucket when proxy trust is disabled', async () => {
    // Two "different" clients per X-Forwarded-For, but trust is off so both are
    // seen as the same loopback IP and share a single bucket.
    const ok1 = await fetch(`${untrusted.baseUrl}/public`, { headers: { 'X-Forwarded-For': '198.51.100.1' } });
    expect(ok1.status).toBe(200);
    const ok2 = await fetch(`${untrusted.baseUrl}/public`, { headers: { 'X-Forwarded-For': '198.51.100.2' } });
    expect(ok2.status).toBe(200);
    const blocked = await fetch(`${untrusted.baseUrl}/public`, { headers: { 'X-Forwarded-For': '198.51.100.3' } });
    expect(blocked.status).toBe(429);
  });
});
