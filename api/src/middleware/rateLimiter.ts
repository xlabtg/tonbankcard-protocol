/**
 * Rate Limiting Middleware
 *
 * Two-tier rate limiting for the Merchant API, built on `express-rate-limit`:
 *
 *   1. **Per-IP limiter** — guards unauthenticated routes and the
 *      authentication step itself. Cheap, coarse, and resilient to
 *      credential-stuffing-style probes. Default: 10 requests/minute/IP.
 *
 *   2. **Per-API-key limiter** — fairness for authenticated traffic.
 *      Merchants behind a shared NAT must not be throttled by their
 *      neighbours, so the bucket key is the `key_id` rather than the IP.
 *      Defaults: 60 rpm for invoice creation, 300 rpm for status reads.
 *
 * Why per-key
 * -----------
 * Per-IP rate limiting penalises merchants who share an egress IP (NAT,
 * cloud regions) and rewards adversaries who control many addresses.
 * After authentication, the `key_id` is a strictly better signal of
 * identity, so we switch to it for the protected endpoints.
 *
 * Configuration
 * -------------
 * Every limit and window is overridable via environment variables so
 * operators can tune without redeploying:
 *
 *   RATE_LIMIT_WINDOW_MS                (default 60_000)
 *   RATE_LIMIT_INVOICE_CREATE_PER_MIN   (default 60)
 *   RATE_LIMIT_INVOICE_STATUS_PER_MIN   (default 300)
 *   RATE_LIMIT_INVOICE_READ_PER_MIN     (default 1000)
 *   RATE_LIMIT_PUBLIC_PER_MIN           (default 10)
 *
 * Response envelope
 * -----------------
 * 429 responses use the standard error envelope (see
 * `middleware/errorHandler.ts`) so clients can rely on a single shape.
 * The `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
 * `X-RateLimit-Reset` headers are set per RFC 6585 / IETF draft.
 *
 * @see docs/merchant-api-spec.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import type { Request, Response } from 'express';
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { ErrorCode, ErrorResponse } from '../types/errors';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/** Window size used by every limiter (defaults to one minute). */
export const RATE_LIMIT_WINDOW_MS = envNumber('RATE_LIMIT_WINDOW_MS', 60_000);

/** Per-key cap for `POST /v1/invoice/create`. Specified by issue #130. */
export const RATE_LIMIT_INVOICE_CREATE = envNumber(
  'RATE_LIMIT_INVOICE_CREATE_PER_MIN',
  60,
);

/** Per-key cap for `GET /v1/invoice/:id/status`. Specified by issue #130. */
export const RATE_LIMIT_INVOICE_STATUS = envNumber(
  'RATE_LIMIT_INVOICE_STATUS_PER_MIN',
  300,
);

/**
 * Per-key cap for `GET /v1/invoice/:id` when authenticated.
 * Defaults higher than the issue requires because invoice reads are idempotent
 * and frequently polled by merchant dashboards.
 */
export const RATE_LIMIT_INVOICE_READ = envNumber(
  'RATE_LIMIT_INVOICE_READ_PER_MIN',
  1000,
);

/**
 * Per-IP cap for unauthenticated requests (e.g. public invoice lookup,
 * `POST /v1/keys` issuance). Specified by issue #130 as 10 rpm.
 */
export const RATE_LIMIT_PUBLIC_PER_MIN = envNumber('RATE_LIMIT_PUBLIC_PER_MIN', 10);

/**
 * Per-IP cap for *failed* requests on protected routes (CHECK405-L1).
 *
 * The per-key limiters only run *after* `authenticateWithPermission`, which
 * short-circuits on failure without calling `next()`. That left the API-key
 * validation path completely un-throttled — an attacker could brute-force keys
 * (each attempt doing a key-hash lookup) without ever tripping a limiter. This
 * limiter sits *in front* of auth and, thanks to `skipSuccessfulRequests`,
 * counts only requests that end in an error response, so legitimate
 * authenticated traffic (which flows at the far higher per-key rates) is never
 * penalised while failed-auth probes are capped per IP.
 */
export const RATE_LIMIT_AUTH_FAIL_PER_MIN = envNumber(
  'RATE_LIMIT_AUTH_FAIL_PER_MIN',
  10,
);

/* ------------------------------------------------------------------ */
/* Shared handler                                                      */
/* ------------------------------------------------------------------ */

/**
 * Custom `handler` used by every limiter so a 429 returns the same envelope
 * as every other Merchant API error and the `Retry-After` is consistent.
 */
function rateLimitHandler(req: Request, res: Response, _next: unknown, options: Options): void {
  const windowSeconds = Math.ceil(options.windowMs / 1000);

  const retryAfterHeader = res.getHeader('Retry-After');
  const retryAfter = typeof retryAfterHeader === 'string' || typeof retryAfterHeader === 'number'
    ? Number(retryAfterHeader)
    : windowSeconds;

  const limit = typeof options.max === 'number' ? options.max : undefined;

  const envelope: ErrorResponse = {
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      details: {
        retryAfter,
        limit,
        window: windowSeconds,
      },
    },
  };

  res.status(options.statusCode).json(envelope);
}

/* ------------------------------------------------------------------ */
/* Per-IP limiter                                                      */
/* ------------------------------------------------------------------ */

/**
 * Limiter for unauthenticated routes. Keys on the trusted client IP.
 *
 * Notes:
 *  - Express must be configured with `app.set('trust proxy', ...)` when
 *    running behind a load balancer so `req.ip` reflects the true client.
 *    The production app does this via the `TRUST_PROXY` env var — see
 *    `config/trustProxy.ts`.
 *  - `standardHeaders: 'draft-7'` emits RateLimit-Policy/RateLimit
 *    in addition to legacy X-RateLimit-* for client compatibility.
 */
export const publicIpRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_PUBLIC_PER_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: true,
  handler: rateLimitHandler,
});

/**
 * Per-IP limiter for the authentication step on protected routes.
 *
 * Mounted *before* `authenticateWithPermission` so failed-auth requests are
 * throttled regardless of outcome. `skipSuccessfulRequests: true` makes the
 * limiter decrement the counter for any response with status < 400, so only
 * error responses (401/403 on bad keys, 400 on malformed input) accrue against
 * the per-IP budget. A merchant making thousands of *successful* authenticated
 * calls from one IP is unaffected; an attacker hammering invalid keys is capped
 * at `RATE_LIMIT_AUTH_FAIL_PER_MIN` failures per window. See CHECK405-L1.
 */
export const authFailureRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_FAIL_PER_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: true,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});

/* ------------------------------------------------------------------ */
/* Per-API-key limiter factory                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a limiter that keys on the authenticated API key id.
 *
 * Must run *after* the authentication middleware so `req.apiKey` is set.
 * When called without an authenticated key (e.g. mis-ordered middleware),
 * the limiter falls back to the IP so misconfiguration cannot bypass
 * the limit entirely.
 */
export function createApiKeyRateLimiter(max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: true,
    keyGenerator: (req) => {
      const keyId = (req as Request & { apiKey?: { key_id?: string } }).apiKey?.key_id;
      return keyId ?? `ip:${req.ip ?? 'unknown'}`;
    },
    handler: rateLimitHandler,
  });
}

/** Pre-built limiter for `POST /v1/invoice/create` (60 rpm/key). */
export const invoiceCreateRateLimiter = createApiKeyRateLimiter(
  RATE_LIMIT_INVOICE_CREATE,
);

/** Pre-built limiter for `GET /v1/invoice/:id/status` (300 rpm/key). */
export const invoiceStatusRateLimiter = createApiKeyRateLimiter(
  RATE_LIMIT_INVOICE_STATUS,
);

/** Pre-built limiter for authenticated invoice reads (1000 rpm/key). */
export const invoiceReadRateLimiter = createApiKeyRateLimiter(
  RATE_LIMIT_INVOICE_READ,
);
