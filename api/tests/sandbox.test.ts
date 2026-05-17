/**
 * Sandbox middleware tests.
 *
 * Covers the three relaxations applied when the Merchant API runs in sandbox
 * mode (see api/src/middleware/sandbox.ts):
 *   1. X-Tonbankcard-Environment: sandbox header on every response
 *   2. Anonymous Authorization fallback for protected endpoints
 *   3. /v1/sandbox/info read-only discovery endpoint
 *
 * Production-mode is asserted to be inert (no header, no info endpoint, no
 * authorization fallback).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import {
  buildSandboxInfo,
  ensureSandboxKeyRegistered,
  installSandboxMode,
  isSandboxMode,
  PUBLIC_SANDBOX_API_KEY,
  sandboxAnonymousAuthMiddleware,
  sandboxHeaderMiddleware,
  SANDBOX_HEADER,
  SANDBOX_HEADER_VALUE,
} from '../src/middleware/sandbox';
import { apiKeyService } from '../src/services/ApiKeyService';

function makeMockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

interface CapturedRes {
  status: jest.MockedFunction<(code: number) => CapturedRes>;
  json: jest.MockedFunction<(body: unknown) => CapturedRes>;
  setHeader: jest.MockedFunction<(name: string, value: string) => void>;
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

function makeMockRes(): CapturedRes {
  const res: CapturedRes = {
    statusCode: 200,
    body: null,
    headers: {},
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  } as unknown as CapturedRes;

  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.setHeader.mockImplementation((name: string, value: string) => {
    res.headers[name] = value;
  });
  return res;
}

describe('isSandboxMode()', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns true when TONBANKCARD_SANDBOX=true', () => {
    expect(isSandboxMode({ TONBANKCARD_SANDBOX: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isSandboxMode({ TONBANKCARD_SANDBOX: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isSandboxMode({ TONBANKCARD_SANDBOX: 'YES' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('returns false when TONBANKCARD_SANDBOX=false', () => {
    expect(isSandboxMode({ TONBANKCARD_SANDBOX: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isSandboxMode({ TONBANKCARD_SANDBOX: '0' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('falls back to NODE_ENV=sandbox', () => {
    expect(isSandboxMode({ NODE_ENV: 'sandbox' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isSandboxMode({ NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('returns false when neither env var is set', () => {
    expect(isSandboxMode({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('sandboxHeaderMiddleware', () => {
  it('always sets X-Tonbankcard-Environment: sandbox', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    sandboxHeaderMiddleware(req, res as unknown as Response, next);

    expect(res.headers[SANDBOX_HEADER]).toBe(SANDBOX_HEADER_VALUE);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('sandboxAnonymousAuthMiddleware', () => {
  it('injects the public sandbox key when Authorization is missing', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    sandboxAnonymousAuthMiddleware(req, res as unknown as Response, next);

    expect(req.headers.authorization).toBe(`Bearer ${PUBLIC_SANDBOX_API_KEY}`);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('never overrides an explicit Authorization header', () => {
    const explicit = 'Bearer tbck_user_provided_key';
    const req = makeMockReq({ authorization: explicit });
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    sandboxAnonymousAuthMiddleware(req, res as unknown as Response, next);

    expect(req.headers.authorization).toBe(explicit);
  });
});

describe('ensureSandboxKeyRegistered', () => {
  beforeEach(() => {
    apiKeyService.clearAll();
  });

  it('registers the public sandbox key idempotently', () => {
    ensureSandboxKeyRegistered();
    const first = apiKeyService.findAndValidateKey(PUBLIC_SANDBOX_API_KEY);
    ensureSandboxKeyRegistered();
    const second = apiKeyService.findAndValidateKey(PUBLIC_SANDBOX_API_KEY);
    expect(first.key_hash).toBe(second.key_hash);
    expect(first.permissions).toContain('invoice:create');
  });
});

describe('buildSandboxInfo', () => {
  it('returns a complete sandbox descriptor', () => {
    const info = buildSandboxInfo();
    expect(info.environment).toBe('sandbox');
    expect(info.baseUrl).toMatch(/^https?:\/\//);
    expect(info.faucetUrl).toMatch(/faucet/);
    expect(info.defaultSandboxApiKey).toBe(PUBLIC_SANDBOX_API_KEY);
    expect(info.testNftCards.length).toBeGreaterThan(0);
    expect(typeof info.resetCadence).toBe('string');
    expect(info.notice).toMatch(/sandbox/i);
  });
});

describe('installSandboxMode', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    apiKeyService.clearAll();
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('is a no-op outside sandbox mode', () => {
    delete process.env.TONBANKCARD_SANDBOX;
    process.env.NODE_ENV = 'production';

    const app = { use: jest.fn(), get: jest.fn() } as unknown as import('express').Express;
    const installed = installSandboxMode(app);
    expect(installed).toBe(false);
    expect(app.use).not.toHaveBeenCalled();
    expect(app.get).not.toHaveBeenCalled();
  });

  it('installs header + auth middleware + /v1/sandbox/info in sandbox mode', () => {
    process.env.TONBANKCARD_SANDBOX = 'true';

    const app = { use: jest.fn(), get: jest.fn() } as unknown as import('express').Express;
    const installed = installSandboxMode(app);
    expect(installed).toBe(true);
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.get).toHaveBeenCalledTimes(1);
    expect((app.get as jest.Mock).mock.calls[0][0]).toBe('/v1/sandbox/info');

    expect(() => apiKeyService.findAndValidateKey(PUBLIC_SANDBOX_API_KEY)).not.toThrow();
  });
});
