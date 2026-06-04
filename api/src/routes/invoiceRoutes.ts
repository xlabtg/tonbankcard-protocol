/**
 * Invoice API Routes
 *
 * Express route handlers for the Merchant API. Authentication and rate
 * limiting are split across two layers:
 *
 *   1. `authenticateWithPermission(permission)` validates the bearer
 *      `Authorization` header, checks the per-key permission scope, and
 *      attaches the resolved `ApiKey` to `req.apiKey`.
 *
 *   2. A dedicated `express-rate-limit` middleware (from
 *      `middleware/rateLimiter.ts`) enforces the per-key limits, keyed
 *      on `req.apiKey.key_id` so merchants behind a shared egress IP
 *      cannot starve each other. Unauthenticated routes use a per-IP
 *      limiter.
 *
 * The previous in-process token-bucket implementation was removed in
 * favour of the standard library so distributed deployments can swap in
 * a Redis store with a single configuration change.
 *
 * @see docs/merchant-api-spec.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/InvoiceService';
import { apiKeyService } from '../services/ApiKeyService';
import { ValidationError } from '../utils/validation';
import { ApiKey, ApiKeyPermission } from '../types/invoice';
import { ErrorCode } from '../types/errors';
import {
  sendErrorResponse,
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
} from '../middleware/errorHandler';
import { requestIdMiddleware } from '../middleware/requestId';
import {
  publicIpRateLimiter,
  invoiceCreateRateLimiter,
  invoiceStatusRateLimiter,
  invoiceReadRateLimiter,
} from '../middleware/rateLimiter';

/**
 * Extract the bearer credential from the `Authorization` header.
 *
 * Throws `ValidationError(INVALID_API_KEY)` on a missing or malformed header.
 */
function extractApiKey(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new ValidationError(
      ErrorCode.INVALID_API_KEY,
      'Authorization header is required',
    );
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ValidationError(
      ErrorCode.INVALID_API_KEY,
      'Authorization header must be in format: Bearer <API_KEY>',
    );
  }

  return parts[1];
}

/**
 * POST /v1/invoice/create
 */
export async function createInvoice(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const invoice = await invoiceService.createInvoice(req.body, apiKey);
    return res.status(201).json(invoice);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * GET /v1/invoice/:invoice_id
 *
 * Public endpoint — no authentication. Rate-limited per-IP to defeat
 * cheap enumeration attempts.
 *
 * Returns only the payer-facing projection of the invoice (amount,
 * currency, status, expiry, payment URL). Merchant identity
 * (`merchant_nft`), arbitrary `metadata` (which may contain customer PII),
 * and `settlement` details are intentionally NOT exposed here — the
 * authenticated `GET /v1/invoice/:invoice_id/detail` route serves the full
 * invoice to its owning merchant.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/253
 */
export async function getInvoice(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { invoice_id } = req.params;
    const invoice = await invoiceService.getPublicInvoice(invoice_id);
    return res.status(200).json(invoice);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * GET /v1/invoice/:invoice_id/detail
 *
 * Authenticated merchant view — returns the FULL invoice (merchant
 * identity, metadata, settlement). The API key must be authorized for the
 * invoice's merchant, otherwise an UNAUTHORIZED_MERCHANT error is returned.
 */
export async function getInvoiceDetail(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const { invoice_id } = req.params;
    const invoice = await invoiceService.getInvoiceDetail(invoice_id, apiKey);
    return res.status(200).json(invoice);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * GET /v1/invoice/:invoice_id/status
 */
export async function getInvoiceStatus(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const { invoice_id } = req.params;
    const status = await invoiceService.getInvoiceStatus(invoice_id, apiKey);
    return res.status(200).json(status);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

function hasPermission(
  apiKey: ApiKey,
  requiredPermission: ApiKeyPermission,
): boolean {
  return apiKey.permissions.includes(requiredPermission);
}

/**
 * Authentication middleware with permission scoping.
 *
 * Validates the bearer API key, checks the required permission, and
 * stores the resolved `ApiKey` on `req.apiKey` so downstream middleware
 * (rate limiter, audit logging) can read it.
 *
 * Rate limiting is intentionally *not* performed here — it is delegated
 * to dedicated `express-rate-limit` middleware mounted on each route so
 * the per-endpoint limits can vary independently of authentication.
 */
export function authenticateWithPermission(
  requiredPermission: ApiKeyPermission,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const apiKeyValue = extractApiKey(req);

      // Look up API key by hash — throws INVALID_API_KEY if not found,
      // deactivated, or expired.
      const apiKey = apiKeyService.findAndValidateKey(apiKeyValue);

      if (!hasPermission(apiKey, requiredPermission)) {
        throw new ValidationError(
          ErrorCode.UNAUTHORIZED_MERCHANT,
          `API key does not have permission: ${requiredPermission}`,
          { required_permission: requiredPermission },
        );
      }

      apiKeyService.touchKey(apiKey.key_hash);

      // Expose the resolved key to subsequent middleware (rate limiter,
      // route handler). Typed as `any` to avoid extending the global
      // Express namespace solely for this short-lived attachment.
      (req as Request & { apiKey?: ApiKey }).apiKey = apiKey;

      next();
    } catch (error) {
      sendErrorResponse(req, res, error as Error);
    }
  };
}

/**
 * CORS middleware configuration.
 *
 * Never defaults to wildcard '*'. When ALLOWED_ORIGINS is unset (e.g. in
 * production without explicit configuration) all cross-origin requests are
 * rejected. Server-to-server calls that carry no Origin header are always
 * allowed.
 *
 * Set the ALLOWED_ORIGINS environment variable to a comma-separated list of
 * permitted origins.
 *
 * Disallowed origins resolve with `callback(null, false)` rather than passing
 * an `Error`. The `cors` package only emits CORS response headers when the
 * origin is allowed, so a rejected origin simply receives a response without
 * `Access-Control-Allow-Origin` and the browser blocks it client-side. Passing
 * an `Error` instead would propagate to the global error handler and surface a
 * generic 500 `INTERNAL_ERROR`, making CORS policy rejections indistinguishable
 * from genuine server faults (audit API-M4).
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/92
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/272
 */
const _allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (_allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Reject without throwing: omit CORS headers (the browser enforces the
      // block) instead of producing a 500. See audit API-M4 / issue #272.
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

/**
 * Wire the invoice routes into an Express app.
 */
export function setupInvoiceRoutes(app: any): void {
  app.use(requestIdMiddleware);

  // Public endpoint: per-IP rate limit (defeats cheap enumeration).
  app.get('/v1/invoice/:invoice_id', publicIpRateLimiter, getInvoice);

  // Protected endpoints: authenticate first, then enforce per-key limit.
  app.post(
    '/v1/invoice/create',
    authenticateWithPermission('invoice:create'),
    invoiceCreateRateLimiter,
    createInvoice,
  );

  app.get(
    '/v1/invoice/:invoice_id/status',
    authenticateWithPermission('invoice:status'),
    invoiceStatusRateLimiter,
    getInvoiceStatus,
  );

  // Authenticated full invoice detail: returns merchant identity, metadata
  // and settlement to the owning merchant only. Mounted on a distinct
  // `/detail` sub-path so it does not collide with the public route above.
  app.get(
    '/v1/invoice/:invoice_id/detail',
    authenticateWithPermission('invoice:read'),
    invoiceReadRateLimiter,
    getInvoiceDetail,
  );

  // Health check (no rate limit so liveness probes never trip a 429).
  app.get('/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Standardised 404 — must be after real routes.
  app.use(notFoundHandlerMiddleware);

  // Final safety net — must be last and use the four-argument signature.
  app.use(errorHandlerMiddleware);
}
