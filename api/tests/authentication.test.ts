/**
 * Authentication Tests
 *
 * Verifies that the API key authentication middleware correctly:
 * 1. Rejects arbitrary / unknown API keys (fixes the bypass described in issue #90)
 * 2. Accepts valid, registered API keys
 * 3. Rejects deactivated keys
 * 4. Rejects expired keys
 * 5. Rejects keys missing a required permission
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { apiKeyService, ApiKeyService } from '../src/services/ApiKeyService';
import { authenticateWithPermission } from '../src/routes/invoiceRoutes';
import { ErrorCode } from '../src/types/invoice';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

interface MockRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
  setHeader: (name: string, value: string) => void;
}

function makeMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Key Authentication', () => {
  const VALID_KEY = 'tbck_valid_key_1234567890abcdef';
  const ANOTHER_VALID_KEY = 'tbck_valid_key_abcdef1234567890';
  const UNKNOWN_KEY = 'tbck_attacker_unknown_key_xyz';
  const MERCHANT_NFT = 'EQAbc123456789012345678901234567890123456789012345';

  beforeEach(() => {
    // Reset singleton registry between tests
    apiKeyService.clearAll();
  });

  // -------------------------------------------------------------------------
  // 1. Core security: unknown keys MUST be rejected
  // -------------------------------------------------------------------------

  it('should reject any API key that has not been registered (fixes issue #90 bypass)', async () => {
    // Do NOT register UNKNOWN_KEY – it must be rejected
    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq(`Bearer ${UNKNOWN_KEY}`);
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    const body = res.body as any;
    expect(body.error.code).toBe(ErrorCode.INVALID_API_KEY);
  });

  it('should reject requests with no Authorization header', async () => {
    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq(); // no header
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('should reject malformed Authorization header', async () => {
    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq('Basic sometoken'); // wrong scheme
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  // -------------------------------------------------------------------------
  // 2. Valid registered key is accepted
  // -------------------------------------------------------------------------

  it('should accept a registered, active, non-expired key', async () => {
    apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT);

    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq(`Bearer ${VALID_KEY}`);
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200); // unchanged – no error set
  });

  // -------------------------------------------------------------------------
  // 3. Deactivated key is rejected
  // -------------------------------------------------------------------------

  it('should reject a deactivated API key', async () => {
    const registered = apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT);
    apiKeyService.deactivateKey(registered.key_hash);

    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq(`Bearer ${VALID_KEY}`);
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    const body = res.body as any;
    expect(body.error.code).toBe(ErrorCode.INVALID_API_KEY);
  });

  // -------------------------------------------------------------------------
  // 4. Expired key is rejected
  // -------------------------------------------------------------------------

  it('should reject an expired API key', async () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT, ['invoice:create', 'invoice:read', 'invoice:status'], undefined, pastExpiry);

    const middleware = authenticateWithPermission('invoice:create');
    const req = makeMockReq(`Bearer ${VALID_KEY}`);
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    const body = res.body as any;
    expect(body.error.code).toBe(ErrorCode.INVALID_API_KEY);
  });

  // -------------------------------------------------------------------------
  // 5. Key lacking required permission is rejected
  // -------------------------------------------------------------------------

  it('should reject a key that lacks the required permission', async () => {
    // Register key with only read permission
    apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT, ['invoice:read']);

    const middleware = authenticateWithPermission('invoice:create'); // requires create
    const req = makeMockReq(`Bearer ${VALID_KEY}`);
    const res = makeMockRes();
    const next = jest.fn();

    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    const body = res.body as any;
    expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED_MERCHANT);
  });

  // -------------------------------------------------------------------------
  // 6. ApiKeyService lookup by hash (unit)
  // -------------------------------------------------------------------------

  it('findAndValidateKey throws INVALID_API_KEY for unknown key', () => {
    expect(() => apiKeyService.findAndValidateKey(UNKNOWN_KEY)).toThrow();
    try {
      apiKeyService.findAndValidateKey(UNKNOWN_KEY);
    } catch (e: any) {
      expect(e.code).toBe(ErrorCode.INVALID_API_KEY);
    }
  });

  it('findAndValidateKey returns key record for registered key', () => {
    apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT);
    const record = apiKeyService.findAndValidateKey(VALID_KEY);
    expect(record.merchant_nft).toBe(MERCHANT_NFT);
    expect(record.is_active).toBe(true);
  });

  it('two different keys produce different hashes', () => {
    const rec1 = apiKeyService.registerApiKey(VALID_KEY, MERCHANT_NFT);
    const rec2 = apiKeyService.registerApiKey(ANOTHER_VALID_KEY, MERCHANT_NFT);
    expect(rec1.key_hash).not.toBe(rec2.key_hash);
  });
});
