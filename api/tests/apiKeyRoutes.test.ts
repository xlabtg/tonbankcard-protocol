/**
 * API Key Management Routes Tests
 *
 * Covers `routes/apiKeyRoutes.ts`:
 *  - the bootstrap-token guard accepts a matching admin token and rejects
 *    every other shape (missing, wrong scheme, mismatched value, unset env)
 *  - POST /v1/keys persists a key and returns the plaintext exactly once
 *  - DELETE /v1/keys/:key_id revokes the key so a later authentication fails
 *  - issuing endpoint validates merchant_nft / environment / permissions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../src/services/ApiKeyService';
import {
  createApiKey,
  revokeApiKey,
  requireAdminToken,
} from '../src/routes/apiKeyRoutes';
import { ErrorCode } from '../src/types/errors';
import { isValidApiKeyFormat } from '../src/utils/apiKeyGenerator';

interface MockRes {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
  headersSent: boolean;
  status: (code: number) => MockRes;
  json: (body: any) => MockRes;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
}

function makeMockRes(): MockRes {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
  };
}

function makeMockReq(opts: {
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
}): Request {
  return {
    headers: opts.headers ?? {},
    body: opts.body ?? {},
    params: opts.params ?? {},
    method: 'POST',
    url: '/v1/keys',
    originalUrl: '/v1/keys',
  } as unknown as Request;
}

const ADMIN_TOKEN = 'admin-test-token-1234567890';
const MERCHANT_NFT = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

describe('requireAdminToken middleware', () => {
  const originalEnv = process.env.API_KEY_ADMIN_TOKEN;

  beforeEach(() => {
    process.env.API_KEY_ADMIN_TOKEN = ADMIN_TOKEN;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.API_KEY_ADMIN_TOKEN;
    else process.env.API_KEY_ADMIN_TOKEN = originalEnv;
  });

  it('rejects when API_KEY_ADMIN_TOKEN is unset (endpoints disabled)', () => {
    delete process.env.API_KEY_ADMIN_TOKEN;
    const req = makeMockReq({ headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireAdminToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED_MERCHANT);
  });

  it('rejects when the Authorization header is missing', () => {
    const req = makeMockReq({});
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireAdminToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects when the bearer token does not match', () => {
    const req = makeMockReq({ headers: { authorization: 'Bearer wrong-token' } });
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireAdminToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('passes through on exact bearer match', () => {
    const req = makeMockReq({ headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireAdminToken(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headersSent).toBe(false);
  });
});

describe('POST /v1/keys', () => {
  beforeEach(() => {
    apiKeyService.clearAll();
  });

  it('issues a canonical-format plaintext key exactly once', () => {
    const req = makeMockReq({
      body: { merchant_nft: MERCHANT_NFT, environment: 'live' },
    });
    const res = makeMockRes();

    createApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(201);
    expect(res.body.api_key).toBeDefined();
    expect(isValidApiKeyFormat(res.body.api_key)).toBe(true);
    expect(res.body.key_id).toMatch(/^key_/);
    expect(res.body.merchant_nft).toBe(MERCHANT_NFT);
    expect(res.body.permissions).toEqual([
      'invoice:create',
      'invoice:read',
      'invoice:status',
    ]);
    expect(apiKeyService.size()).toBe(1);
  });

  it('respects an explicit permissions allowlist', () => {
    const req = makeMockReq({
      body: {
        merchant_nft: MERCHANT_NFT,
        permissions: ['invoice:status'],
      },
    });
    const res = makeMockRes();

    createApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(201);
    expect(res.body.permissions).toEqual(['invoice:status']);
  });

  it('rejects an unknown permission', () => {
    const req = makeMockReq({
      body: { merchant_nft: MERCHANT_NFT, permissions: ['invoice:steal'] },
    });
    const res = makeMockRes();

    createApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_METADATA);
  });

  it('rejects a malformed merchant_nft', () => {
    const req = makeMockReq({
      body: { merchant_nft: 'not-an-address' },
    });
    const res = makeMockRes();

    createApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_NFT_ADDRESS);
  });

  it('rejects an unknown environment', () => {
    const req = makeMockReq({
      body: { merchant_nft: MERCHANT_NFT, environment: 'staging' },
    });
    const res = makeMockRes();

    createApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_METADATA);
  });
});

describe('DELETE /v1/keys/:key_id', () => {
  beforeEach(() => {
    apiKeyService.clearAll();
  });

  it('deactivates a registered key', () => {
    const issueReq = makeMockReq({
      body: { merchant_nft: MERCHANT_NFT, environment: 'live' },
    });
    const issueRes = makeMockRes();
    createApiKey(issueReq, issueRes as unknown as Response);
    const { key_id, api_key } = issueRes.body;

    const revokeReq = makeMockReq({ params: { key_id } });
    const revokeRes = makeMockRes();
    revokeApiKey(revokeReq, revokeRes as unknown as Response);

    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.body).toEqual({ key_id, revoked: true });
    expect(() => apiKeyService.findAndValidateKey(api_key)).toThrow();
  });

  it('returns INVALID_API_KEY when the id is unknown', () => {
    const req = makeMockReq({ params: { key_id: 'key_does_not_exist' } });
    const res = makeMockRes();

    revokeApiKey(req, res as unknown as Response);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_API_KEY);
  });
});
