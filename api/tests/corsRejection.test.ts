/**
 * CORS Rejection Integration Tests
 *
 * Covers audit finding API-M4 (issue #272): a disallowed CORS origin used to be
 * signalled by passing an `Error` to the cors callback, which propagated to the
 * global error handler and surfaced as a generic 500 `INTERNAL_ERROR`. Clients
 * and operators could not distinguish a CORS policy rejection from a genuine
 * server fault, and the spurious 500s polluted error metrics.
 *
 * These tests boot the fully wired app via `createApp()` and assert that a real
 * HTTP request from a disallowed origin yields a deterministic, non-500
 * response without the `Access-Control-Allow-Origin` header (the browser then
 * enforces the block client-side), while allowed origins still receive the
 * CORS headers and genuine server faults remain distinguishable.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import { AddressInfo } from 'net';
import type { Express } from 'express';

function startApp(app: Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function get(
  url: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
      );
    });
    req.on('error', reject);
  });
}

describe('CORS rejection — fixes API-M4 (#272)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Configure an explicit allowlist *before* importing the module so the
    // `corsOptions` allowlist (evaluated at module load) picks it up.
    jest.resetModules();
    process.env.ALLOWED_ORIGINS = 'https://allowed.example.com';
    const { createApp } = await import('../src/index');
    ({ server, baseUrl } = await startApp(createApp()));
  });

  afterAll(() => {
    server.close();
    delete process.env.ALLOWED_ORIGINS;
    jest.resetModules();
  });

  it('does not return HTTP 500 / INTERNAL_ERROR for a disallowed origin', async () => {
    const { status, headers, body } = await get(`${baseUrl}/v1/health`, {
      Origin: 'https://evil.example.com',
    });

    // The request must not be reported as a generic server fault.
    expect(status).not.toBe(500);
    expect(body).not.toContain('INTERNAL_ERROR');

    // A disallowed origin must not receive permissive CORS headers; the browser
    // then blocks the cross-origin read client-side.
    expect(headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a deterministic non-500 for a disallowed preflight (OPTIONS)', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const url = new URL(`${baseUrl}/v1/invoice/create`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'OPTIONS',
          headers: {
            Origin: 'https://evil.example.com',
            'Access-Control-Request-Method': 'POST',
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode ?? 0));
        },
      );
      req.on('error', reject);
      req.end();
    });

    expect(status).not.toBe(500);
    expect(status).toBeLessThan(500);
  });

  it('still emits CORS headers for an allowed origin', async () => {
    const { status, headers } = await get(`${baseUrl}/v1/health`, {
      Origin: 'https://allowed.example.com',
    });

    expect(status).toBe(200);
    expect(headers['access-control-allow-origin']).toBe('https://allowed.example.com');
  });
});
