/**
 * Security Headers (helmet) Tests
 *
 * Covers audit finding API-M3 (issue #271): `helmet` was declared as a
 * dependency but never registered as middleware, so responses shipped without
 * the baseline hardening headers.
 *
 * These tests boot the fully wired app via `createApp()` (which applies
 * `helmet()` early in the middleware chain) and assert that a real HTTP
 * response carries the expected security headers — including on routes that
 * are handled deep in the chain (404 handler), proving helmet runs first.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import { AddressInfo } from 'net';
import type { Express } from 'express';

import { createApp } from '../src/index';

function startApp(app: Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function get(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      // Drain the body so the socket can close.
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on('error', reject);
  });
}

describe('Security headers (helmet) — fixes API-M3 (#271)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp(createApp()));
  });

  afterAll(() => {
    server.close();
  });

  it('sets X-Content-Type-Options: nosniff on a normal response', async () => {
    const { status, headers } = await get(`${baseUrl}/v1/health`);
    expect(status).toBe(200);
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets the baseline helmet hardening headers', async () => {
    const { headers } = await get(`${baseUrl}/v1/health`);

    // HSTS — protects against protocol downgrade.
    expect(headers['strict-transport-security']).toBeDefined();
    // Clickjacking protection.
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    // Default Content-Security-Policy emitted by helmet.
    expect(headers['content-security-policy']).toBeDefined();
    // helmet hides the framework fingerprint.
    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('applies helmet headers even on the 404 path (helmet runs early)', async () => {
    const { status, headers } = await get(`${baseUrl}/this-route-does-not-exist`);
    expect(status).toBe(404);
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
