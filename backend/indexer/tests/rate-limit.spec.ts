// Tests for rate limiting behavior in ApiServer

import { describe, it, expect, afterEach } from '@jest/globals';
import express from 'express';
import http from 'http';
import {
  RateLimiterMemory,
  RateLimiterAbstract,
  RateLimiterRes,
} from 'rate-limiter-flexible';

// Helper to make an HTTP request
function makeRequest(
  server: http.Server,
  path: string,
  clientIp: string,
  useForwardedFor = false
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as { port: number };
    const headers: Record<string, string> = {};
    if (useForwardedFor) {
      headers['X-Forwarded-For'] = clientIp;
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: 'GET',
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode!,
          headers: res.headers,
          body: JSON.parse(data),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Build a minimal express app that uses the same rate-limiting middleware logic
 * as the new ApiServer.setupMiddleware(), but without needing a full server
 * instance (no DB / indexer).
 */
function buildApp(
  rateLimiter: RateLimiterAbstract,
  maxRequests: number,
  windowMs: number,
  trustProxy = false
): express.Application {
  const app = express();
  app.use(express.json());

  function getClientIp(req: express.Request): string {
    if (trustProxy) {
      const cf = req.headers['cf-connecting-ip'];
      if (typeof cf === 'string' && cf.trim()) return cf.trim();

      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        const first = raw.split(',')[0].trim();
        if (first) return first;
      }
    }
    return req.socket?.remoteAddress || 'unknown';
  }

  app.use(async (req, res, next) => {
    const ip = getClientIp(req);
    try {
      const rlRes: RateLimiterRes = await rateLimiter.consume(ip);
      const remaining = Math.max(0, rlRes.remainingPoints);
      const resetEpochMs = Date.now() + rlRes.msBeforeNext;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetEpochMs / 1000));
      res.setHeader('X-RateLimit-Window', Math.ceil(windowMs / 1000));
      next();
    } catch (rateLimiterRes: unknown) {
      const rlRes = rateLimiterRes as RateLimiterRes;
      const secsToReset = Math.ceil((rlRes.msBeforeNext ?? windowMs) / 1000);

      res.setHeader('Retry-After', secsToReset);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + (rlRes.msBeforeNext ?? windowMs)) / 1000)
      );

      res.status(429).json({
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
      });
    }
  });

  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

function startServer(app: express.Application): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('Rate Limiter Middleware (new implementation)', () => {
  let server: http.Server;

  afterEach(
    () =>
      new Promise<void>((resolve) => {
        if (server) server.close(() => resolve());
        else resolve();
      })
  );

  it('allows requests under the limit', async () => {
    const rl = new RateLimiterMemory({ points: 5, duration: 60 });
    server = await startServer(buildApp(rl, 5, 60000));

    for (let i = 0; i < 5; i++) {
      const res = await makeRequest(server, '/test', '1.2.3.4');
      expect(res.statusCode).toBe(200);
    }
  });

  it('blocks requests that exceed the per-IP limit', async () => {
    const rl = new RateLimiterMemory({ points: 3, duration: 60 });
    server = await startServer(buildApp(rl, 3, 60000));

    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(server, '/test', '1.2.3.4');
      expect(res.statusCode).toBe(200);
    }
    const blocked = await makeRequest(server, '/test', '1.2.3.4');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('returns X-RateLimit-Limit header on every response', async () => {
    const rl = new RateLimiterMemory({ points: 5, duration: 60 });
    server = await startServer(buildApp(rl, 5, 60000));

    const res = await makeRequest(server, '/test', '10.0.0.1');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('5');
  });

  it('returns X-RateLimit-Remaining header that decrements', async () => {
    const rl = new RateLimiterMemory({ points: 3, duration: 60 });
    server = await startServer(buildApp(rl, 3, 60000));

    const first = await makeRequest(server, '/test', '20.0.0.1');
    expect(first.statusCode).toBe(200);
    const remainingAfterFirst = Number(first.headers['x-ratelimit-remaining']);
    expect(remainingAfterFirst).toBe(2);

    const second = await makeRequest(server, '/test', '20.0.0.1');
    expect(second.statusCode).toBe(200);
    const remainingAfterSecond = Number(second.headers['x-ratelimit-remaining']);
    expect(remainingAfterSecond).toBe(1);
  });

  it('returns Retry-After header on 429 responses', async () => {
    const rl = new RateLimiterMemory({ points: 1, duration: 60 });
    server = await startServer(buildApp(rl, 1, 60000));

    await makeRequest(server, '/test', '2.2.2.2');
    const blocked = await makeRequest(server, '/test', '2.2.2.2');
    expect(blocked.statusCode).toBe(429);

    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('returns X-RateLimit-Remaining: 0 on 429 responses', async () => {
    const rl = new RateLimiterMemory({ points: 1, duration: 60 });
    server = await startServer(buildApp(rl, 1, 60000));

    await makeRequest(server, '/test', '3.3.3.3');
    const blocked = await makeRequest(server, '/test', '3.3.3.3');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('isolates counters by IP – different forwarded IPs have independent limits (trustProxy=true)', async () => {
    const rl = new RateLimiterMemory({ points: 2, duration: 60 });
    server = await startServer(buildApp(rl, 2, 60000, true));

    // Exhaust quota for forwarded IP A
    await makeRequest(server, '/test', '4.4.4.4', true);
    await makeRequest(server, '/test', '4.4.4.4', true);
    const blockedA = await makeRequest(server, '/test', '4.4.4.4', true);
    expect(blockedA.statusCode).toBe(429);

    // Forwarded IP B should still be allowed (different key in rate limiter)
    const allowedB = await makeRequest(server, '/test', '5.5.5.5', true);
    expect(allowedB.statusCode).toBe(200);
  });

  describe('Proxy IP extraction (trustProxy=true)', () => {
    it('reads real IP from X-Forwarded-For', async () => {
      const rl = new RateLimiterMemory({ points: 1, duration: 60 });
      server = await startServer(buildApp(rl, 1, 60000, true));

      // First request from "real" IP 6.6.6.6 (forwarded header)
      const first = await makeRequest(server, '/test', '6.6.6.6', true);
      expect(first.statusCode).toBe(200);

      // Second request from same "real" IP should be rate-limited
      const second = await makeRequest(server, '/test', '6.6.6.6', true);
      expect(second.statusCode).toBe(429);

      // Request from a different "real" IP should be allowed
      const third = await makeRequest(server, '/test', '7.7.7.7', true);
      expect(third.statusCode).toBe(200);
    });

    it('ignores X-Forwarded-For when trustProxy=false', async () => {
      // When trustProxy is false the rate limiter uses the socket IP (127.0.0.1),
      // so all requests from the same test process share one counter regardless
      // of the X-Forwarded-For header they send.
      const rl = new RateLimiterMemory({ points: 1, duration: 60 });
      server = await startServer(buildApp(rl, 1, 60000, false));

      // The socket IP is 127.0.0.1 for both requests despite different headers.
      await makeRequest(server, '/test', '6.6.6.6', true); // consume 127.0.0.1 quota
      // Second request from a different forwarded IP is still blocked (same socket)
      const second = await makeRequest(server, '/test', '99.99.99.99', true);
      expect(second.statusCode).toBe(429);
    });
  });
});
