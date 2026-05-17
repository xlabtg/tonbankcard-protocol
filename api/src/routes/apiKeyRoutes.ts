/**
 * API Key Management Routes
 *
 * Endpoints for issuing and revoking Merchant API keys:
 *
 *   POST   /v1/keys              → issue a new key (plaintext returned once)
 *   DELETE /v1/keys/:key_id      → deactivate a key by its public id
 *
 * Authentication
 * --------------
 * Both endpoints are protected by a deployment-time bootstrap token
 * provided via the `API_KEY_ADMIN_TOKEN` environment variable. Callers
 * present the token in the `Authorization: Bearer` header. When the
 * variable is unset, both endpoints respond with 403 — the route is
 * inert in deployments that have not opted in to programmatic key
 * issuance.
 *
 * The bootstrap token is intentionally minimal: it does not introduce a
 * user model, role system or admin dashboard. Production deployments
 * are expected to layer their own identity provider (SSO, dashboard
 * session, etc.) on top.
 *
 * Security notes
 * --------------
 *  - The plaintext key is returned exactly once and never persisted.
 *  - Only the HMAC-SHA256 hash of the key is stored (see
 *    `services/ApiKeyService.ts`).
 *  - Both endpoints share the public per-IP rate limiter so a leaked
 *    bootstrap token cannot be used to bulk-issue keys at high rate.
 *  - The bootstrap token comparison is constant-time to defeat timing
 *    oracles.
 *
 * @see docs/merchant-api-spec.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { apiKeyService } from '../services/ApiKeyService';
import { ValidationError, validateTonAddress } from '../utils/validation';
import { ErrorCode } from '../types/errors';
import { sendErrorResponse } from '../middleware/errorHandler';
import { publicIpRateLimiter } from '../middleware/rateLimiter';
import {
  generateApiKey,
  isValidApiKeyFormat,
  redactApiKey,
  type ApiKeyEnvironment,
} from '../utils/apiKeyGenerator';
import type { ApiKeyPermission } from '../types/invoice';

const DEFAULT_PERMISSIONS: ApiKeyPermission[] = [
  'invoice:create',
  'invoice:read',
  'invoice:status',
];

function getAdminToken(): string | undefined {
  const value = process.env.API_KEY_ADMIN_TOKEN;
  return value && value.length > 0 ? value : undefined;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Bootstrap-token middleware.
 *
 * Rejects the request unless `API_KEY_ADMIN_TOKEN` is configured *and*
 * the supplied bearer token matches it byte-for-byte (constant time).
 */
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const expected = getAdminToken();
    if (!expected) {
      throw new ValidationError(
        ErrorCode.UNAUTHORIZED_MERCHANT,
        'Key management is disabled (API_KEY_ADMIN_TOKEN is not configured)',
      );
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Authorization header is required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ValidationError(
        ErrorCode.INVALID_API_KEY,
        'Authorization header must be in format: Bearer <admin-token>',
      );
    }

    if (!constantTimeStringEqual(parts[1], expected)) {
      throw new ValidationError(ErrorCode.UNAUTHORIZED_MERCHANT, 'Invalid admin token');
    }

    next();
  } catch (error) {
    sendErrorResponse(req, res, error as Error);
  }
}

interface CreateKeyRequest {
  merchant_nft?: unknown;
  environment?: unknown;
  permissions?: unknown;
  expires_at?: unknown;
}

function parseEnvironment(value: unknown): ApiKeyEnvironment {
  if (value === 'live' || value === 'test') return value;
  if (value === undefined || value === null) return 'live';
  throw new ValidationError(
    ErrorCode.INVALID_METADATA,
    'environment must be "live" or "test"',
  );
}

function parsePermissions(value: unknown): ApiKeyPermission[] {
  if (value === undefined || value === null) return DEFAULT_PERMISSIONS;
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'permissions must be a non-empty array of scopes',
    );
  }
  const allowed = new Set<ApiKeyPermission>(DEFAULT_PERMISSIONS);
  const result: ApiKeyPermission[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item as ApiKeyPermission)) {
      throw new ValidationError(
        ErrorCode.INVALID_METADATA,
        `Unknown permission scope: ${String(item)}`,
      );
    }
    result.push(item as ApiKeyPermission);
  }
  return result;
}

function parseExpiresAt(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'expires_at must be an ISO 8601 timestamp string',
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(
      ErrorCode.INVALID_METADATA,
      'expires_at is not a valid ISO 8601 timestamp',
    );
  }
  return parsed.toISOString();
}

/**
 * POST /v1/keys — issue a new API key.
 *
 * Body:
 *   {
 *     "merchant_nft":  "EQ..."           // required, TON address
 *     "environment":   "live" | "test"   // optional, default "live"
 *     "permissions":   ["invoice:create", ...]   // optional, default all
 *     "expires_at":    "2025-01-01T00:00:00Z"    // optional, default null
 *   }
 *
 * Response 201:
 *   {
 *     "api_key":     "tbc_live_…",   // plaintext — shown once only
 *     "key_id":      "key_…",
 *     "merchant_nft": "EQ…",
 *     "environment": "live",
 *     "permissions": [...],
 *     "created_at":  "…",
 *     "expires_at":  null
 *   }
 */
export function createApiKey(req: Request, res: Response): Response {
  try {
    const body = (req.body ?? {}) as CreateKeyRequest;

    if (typeof body.merchant_nft !== 'string' || body.merchant_nft.length === 0) {
      throw new ValidationError(
        ErrorCode.INVALID_NFT_ADDRESS,
        'merchant_nft is required',
      );
    }
    // Throws ValidationError(INVALID_NFT_ADDRESS) on malformed input.
    validateTonAddress(body.merchant_nft);

    const environment = parseEnvironment(body.environment);
    const permissions = parsePermissions(body.permissions);
    const expiresAt = parseExpiresAt(body.expires_at);

    const plaintext = generateApiKey(environment);
    // Sanity check — generator must always produce a well-formed key.
    if (!isValidApiKeyFormat(plaintext)) {
      throw new Error('Generated API key failed format validation');
    }

    const apiKey = apiKeyService.registerApiKey(
      plaintext,
      body.merchant_nft,
      permissions,
      undefined,
      expiresAt,
    );

    // Audit log — redact the plaintext, never write it verbatim.
    console.info(
      JSON.stringify({
        level: 'info',
        msg: 'api_key.issued',
        key_id: apiKey.key_id,
        merchant_nft: apiKey.merchant_nft,
        environment,
        permissions,
        redacted_key: redactApiKey(plaintext),
      }),
    );

    return res.status(201).json({
      api_key: plaintext,
      key_id: apiKey.key_id,
      merchant_nft: apiKey.merchant_nft,
      environment,
      permissions: apiKey.permissions,
      created_at: apiKey.created_at,
      expires_at: apiKey.expires_at,
    });
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * DELETE /v1/keys/:key_id — revoke an API key.
 *
 * Idempotent: returns 200 on success or when the key is already inactive.
 */
export function revokeApiKey(req: Request, res: Response): Response {
  try {
    const { key_id } = req.params;
    if (!key_id || typeof key_id !== 'string') {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'key_id path parameter is required');
    }

    const revoked = apiKeyService.revokeByKeyId(key_id);
    if (!revoked) {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Unknown key_id');
    }

    console.info(
      JSON.stringify({ level: 'info', msg: 'api_key.revoked', key_id }),
    );

    return res.status(200).json({ key_id, revoked: true });
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * Wire the key management routes into an Express app.
 */
export function setupApiKeyRoutes(app: any): void {
  // Both endpoints share the per-IP limiter so a leaked admin token
  // cannot be used to bulk-issue keys.
  app.post('/v1/keys', publicIpRateLimiter, requireAdminToken, createApiKey);
  app.delete('/v1/keys/:key_id', publicIpRateLimiter, requireAdminToken, revokeApiKey);
}
