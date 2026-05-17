/**
 * Invoice API Routes
 *
 * Express.js route handlers for the Merchant API endpoints.
 * This is a reference implementation demonstrating the API specification.
 *
 * In production, this would be integrated with:
 * - Express.js or similar web framework
 * - Authentication middleware
 * - Rate limiting middleware
 * - Logging and monitoring
 *
 * @see docs/merchant-api-spec.md
 */

import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/InvoiceService';
import { apiKeyService } from '../services/ApiKeyService';
import { ValidationError } from '../utils/validation';
import {
  ApiKey,
  ApiKeyPermission,
  RateLimitBucket,
} from '../types/invoice';
import { ErrorCode } from '../types/errors';
import {
  sendErrorResponse,
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
} from '../middleware/errorHandler';
import { requestIdMiddleware } from '../middleware/requestId';

/**
 * ⚠️ PRODUCTION WARNING: In-memory stores MUST NOT be used in production.
 *
 * `rateLimitBuckets` and `apiKeyStore` below are process-local Maps that:
 *  - Lose all state on server restart or crash
 *  - Are not shared across horizontal replicas (each instance enforces limits
 *    independently, allowing N×RPM through N load-balanced replicas)
 *  - Grow without bound under sustained load, risking OOM crashes
 *
 * For production, replace with:
 *  - Redis for rate limiting: use a sliding-window or token-bucket algorithm
 *    backed by Redis atomic operations (e.g., `INCR` + `EXPIRE`, or a library
 *    such as `rate-limiter-flexible`).
 *  - PostgreSQL/MongoDB for API key storage: store hashed keys with scoped
 *    permissions and look them up on each authenticated request.
 *
 * The `IInvoiceStorage` / `IIdempotencyStorage` abstractions in
 * `src/storage/IStorage.ts` demonstrate the pattern to follow when
 * extracting these in-memory stores into injectable, swappable adapters.
 */

/** Rate limit buckets per API key + endpoint (in-memory, for reference only) */
const rateLimitBuckets = new Map<string, RateLimitBucket>();

/**
 * Default rate limits per endpoint (requests per minute)
 */
const DEFAULT_RATE_LIMITS = {
  'invoice:create': 100,
  'invoice:read': 1000,
  'invoice:status': 500,
} as const;

/**
 * Extract API key from Authorization header
 */
function extractApiKey(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Authorization header is required');
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ValidationError(
      ErrorCode.INVALID_API_KEY,
      'Authorization header must be in format: Bearer <API_KEY>'
    );
  }

  return parts[1];
}

/**
 * POST /invoice/create
 *
 * Create a new invoice
 */
export async function createInvoice(req: Request, res: Response): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const invoice = await invoiceService.createInvoice(req.body, apiKey);
    return res.status(201).json(invoice);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * GET /invoice/:invoice_id
 *
 * Get invoice details
 * Public endpoint (no authentication required)
 */
export async function getInvoice(req: Request, res: Response): Promise<Response> {
  try {
    const { invoice_id } = req.params;
    const invoice = await invoiceService.getInvoice(invoice_id);
    return res.status(200).json(invoice);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * GET /invoice/:invoice_id/status
 *
 * Get invoice status
 * Requires authentication
 */
export async function getInvoiceStatus(req: Request, res: Response): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const { invoice_id } = req.params;
    const status = await invoiceService.getInvoiceStatus(invoice_id, apiKey);
    return res.status(200).json(status);
  } catch (error) {
    return sendErrorResponse(req, res, error as Error);
  }
}

/**
 * Check if API key has required permission (scoping)
 *
 * @param apiKey - API key to check
 * @param requiredPermission - Required permission
 * @returns true if permitted, false otherwise
 */
function hasPermission(apiKey: ApiKey, requiredPermission: ApiKeyPermission): boolean {
  return apiKey.permissions.includes(requiredPermission);
}

/**
 * Check rate limit for API key + endpoint
 *
 * Uses token bucket algorithm with per-key limits.
 * In production, use Redis for distributed rate limiting.
 *
 * @param apiKeyId - API key identifier
 * @param endpoint - Endpoint permission being accessed
 * @param limit - Requests per minute limit
 * @returns Object with allowed status and retry info
 */
function checkRateLimit(
  apiKeyId: string,
  endpoint: ApiKeyPermission,
  limit: number
): { allowed: boolean; retryAfter?: number; remaining: number } {
  const bucketKey = `${apiKeyId}:${endpoint}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  let bucket = rateLimitBuckets.get(bucketKey);

  if (!bucket) {
    // Initialize new bucket
    bucket = {
      tokens: limit,
      max_tokens: limit,
      last_refill: now,
      refill_at: now + windowMs,
    };
    rateLimitBuckets.set(bucketKey, bucket);
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.last_refill;
  const refillAmount = (elapsed / windowMs) * limit;

  bucket.tokens = Math.min(bucket.max_tokens, bucket.tokens + refillAmount);
  bucket.last_refill = now;

  if (bucket.tokens < 1) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((1 - bucket.tokens) * (windowMs / limit) / 1000);
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }

  // Consume token
  bucket.tokens -= 1;
  bucket.refill_at = now + windowMs;

  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
  };
}

/**
 * Authentication middleware with permission scoping
 *
 * Validates API key and checks:
 * 1. Key exists and is valid
 * 2. Key has required permission
 * 3. Key is not expired
 * 4. Rate limit not exceeded
 *
 * @param requiredPermission - Permission required for this endpoint
 */
export function authenticateWithPermission(requiredPermission: ApiKeyPermission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKeyValue = extractApiKey(req);

      // Look up API key by hash – throws INVALID_API_KEY if not found,
      // deactivated, or expired.
      const apiKey = apiKeyService.findAndValidateKey(apiKeyValue);

      // Check permission (scoping)
      if (!hasPermission(apiKey, requiredPermission)) {
        throw new ValidationError(
          ErrorCode.UNAUTHORIZED_MERCHANT,
          `API key does not have permission: ${requiredPermission}`,
          { required_permission: requiredPermission }
        );
      }

      // Check rate limit (per-key)
      const rateLimit = apiKey.rate_limits[
        requiredPermission.replace(':', '_') as keyof typeof apiKey.rate_limits
      ] || DEFAULT_RATE_LIMITS[requiredPermission];

      const rateLimitResult = checkRateLimit(apiKey.key_id, requiredPermission, rateLimit);

      if (!rateLimitResult.allowed) {
        res.setHeader('Retry-After', rateLimitResult.retryAfter!.toString());
        res.setHeader('X-RateLimit-Limit', rateLimit.toString());
        res.setHeader('X-RateLimit-Remaining', '0');

        throw new ValidationError(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          'Rate limit exceeded',
          {
            retryAfter: rateLimitResult.retryAfter,
            limit: rateLimit,
            window: 60,
          }
        );
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());

      // Update last used timestamp
      apiKeyService.touchKey(apiKey.key_hash);

      // Store API key info in request for later use
      (req as any).apiKey = apiKey;

      next();
    } catch (error) {
      sendErrorResponse(req, res, error as Error);
    }
  };
}

/**
 * Authentication middleware (legacy, uses full permissions)
 *
 * @deprecated Use authenticateWithPermission for scoped access
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  authenticateWithPermission('invoice:create')(req, res, next);
}

/**
 * Rate limiting middleware (stub)
 *
 * In production, use express-rate-limit or similar
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Implement rate limiting
  // Example:
  // const key = req.ip + ':' + req.path;
  // const limit = await rateLimiter.checkLimit(key, limits[req.path]);
  //
  // if (limit.exceeded) {
  //   const errorResponse: ErrorResponse = {
  //     error: {
  //       code: ErrorCode.RATE_LIMIT_EXCEEDED,
  //       message: 'Too many requests',
  //       details: {
  //         retryAfter: limit.retryAfter,
  //       },
  //     },
  //   };
  //   return res.status(429)
  //     .header('Retry-After', limit.retryAfter.toString())
  //     .json(errorResponse);
  // }

  next();
}

/**
 * CORS middleware configuration
 *
 * Never defaults to wildcard '*'. When ALLOWED_ORIGINS is unset (e.g. in
 * production without explicit configuration) all cross-origin requests are
 * rejected. Server-to-server calls that carry no Origin header are always
 * allowed.
 *
 * Set the ALLOWED_ORIGINS environment variable to a comma-separated list of
 * permitted origins:
 *   ALLOWED_ORIGINS=https://yourdomain.com,https://staging.yourdomain.com
 *
 * Fixes: https://github.com/xlabtg/tonbankcard-protocol/issues/92
 */
const _allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow server-to-server requests (no Origin header present)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (_allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

/**
 * Example Express.js app setup
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import cors from 'cors';
 * import { setupInvoiceRoutes, corsOptions } from './routes/invoiceRoutes';
 *
 * const app = express();
 * app.use(cors(corsOptions));
 * app.use(express.json());
 *
 * setupInvoiceRoutes(app);
 *
 * app.listen(3000, () => {
 *   console.log('Merchant API listening on port 3000');
 * });
 * ```
 */
export function setupInvoiceRoutes(app: any): void {
  // Tag every request with a stable identifier (and mirror it as
  // X-Request-Id on the response) so log entries and error envelopes
  // can be correlated. Must run before any route handler.
  app.use(requestIdMiddleware);

  // Public endpoint (no auth required, but rate limited by IP)
  app.get('/v1/invoice/:invoice_id', rateLimitMiddleware, getInvoice);

  // Protected endpoints with scoped permissions and per-key rate limiting
  app.post(
    '/v1/invoice/create',
    authenticateWithPermission('invoice:create'),
    createInvoice
  );

  app.get(
    '/v1/invoice/:invoice_id/status',
    authenticateWithPermission('invoice:status'),
    getInvoiceStatus
  );

  // Health check endpoint
  app.get('/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Standardised 404 for any unmatched route. Must be registered after
  // the real routes so they get first refusal.
  app.use(notFoundHandlerMiddleware);

  // Final safety net: any error that escapes a handler is funnelled
  // through the shared envelope. Must be the *last* middleware and use
  // the four-argument signature so Express routes errors to it.
  app.use(errorHandlerMiddleware);
}
