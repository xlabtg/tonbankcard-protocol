/**
 * Rate Limiter Tests
 *
 * Verifies that `middleware/rateLimiter.ts`:
 *  - reads the configured limits from environment variables
 *  - enforces the per-IP limit and emits a standard error envelope at 429
 *  - sets the documented rate-limit headers
 *  - keys the per-API-key limiter on `req.apiKey.key_id`
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import { AddressInfo } from 'net';

import { ErrorCode } from '../src/types/errors';

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

describe('publicIpRateLimiter', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { publicIpRateLimiter } = await loadRateLimiter({
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_PUBLIC_PER_MIN: '3',
    });
    const app = express();
    // express-rate-limit needs a trusted proxy so `req.ip` is stable in tests.
    app.set('trust proxy', true);
    app.get('/public', publicIpRateLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    ({ server, baseUrl } = await startApp(app));
  });

  afterAll(() => {
    server.close();
  });

  it('allows requests up to the configured cap and rejects the next one', async () => {
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseUrl}/public`);
      expect(response.status).toBe(200);
    }
    const blocked = await fetch(`${baseUrl}/public`);
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as {
      error: { code: string; details: { limit: number; window: number } };
    };
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(body.error.details.limit).toBe(3);
    expect(body.error.details.window).toBe(60);
  });

  it('emits Retry-After and RateLimit-* headers on 429', async () => {
    const blocked = await fetch(`${baseUrl}/public`);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).not.toBeNull();
    // express-rate-limit emits both legacy and draft-7 headers.
    const limitHeader =
      blocked.headers.get('ratelimit-limit') ?? blocked.headers.get('x-ratelimit-limit');
    expect(limitHeader).toBeTruthy();
  });
});

describe('createApiKeyRateLimiter', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { createApiKeyRateLimiter } = await loadRateLimiter({
      RATE_LIMIT_WINDOW_MS: '60000',
    });
    const limiter = createApiKeyRateLimiter(2);

    const app = express();
    app.set('trust proxy', true);

    // Synthetic auth middleware that mirrors `authenticateWithPermission`
    // by attaching `req.apiKey` with a key_id taken from a query parameter
    // so each test request can pretend to come from a different merchant.
    app.use('/protected', (req: Request, _res: Response, next: NextFunction) => {
      const keyId = (req.query.key as string) ?? 'key_default';
      (req as Request & { apiKey?: { key_id: string } }).apiKey = { key_id: keyId };
      next();
    });
    app.use('/protected', limiter, (_req, res) => res.status(200).json({ ok: true }));

    ({ server, baseUrl } = await startApp(app));
  });

  afterAll(() => {
    server.close();
  });

  it('keys on the apiKey.key_id rather than the IP', async () => {
    // Exhaust the quota for one key…
    for (let i = 0; i < 2; i++) {
      const ok = await fetch(`${baseUrl}/protected?key=key_a`);
      expect(ok.status).toBe(200);
    }
    const blocked = await fetch(`${baseUrl}/protected?key=key_a`);
    expect(blocked.status).toBe(429);

    // …but a different key still has its full quota.
    const otherOk = await fetch(`${baseUrl}/protected?key=key_b`);
    expect(otherOk.status).toBe(200);
  });
});
