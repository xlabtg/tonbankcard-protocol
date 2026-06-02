/**
 * Merchant API Error Types
 *
 * Centralised, exhaustive registry of error codes used in Merchant API
 * responses, together with their canonical HTTP status mapping.
 *
 * The registry is the single source of truth for both producers
 * (`ValidationError` in `utils/validation.ts`, route handlers) and
 * consumers (tests, dashboards, indexer). Adding a new error condition
 * must always start here.
 *
 * The catalogue, security rules and HTTP status mapping are documented
 * in `docs/error-codes.md`.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 * @see docs/error-codes.md
 */

/**
 * Standardised Merchant API error envelope.
 *
 * Every non-2xx response from the Merchant API uses this shape:
 *
 *   {
 *     "error": {
 *       "code": "INVALID_NFT_ADDRESS",
 *       "message": "Human readable summary",
 *       "details": { ... }   // optional, never leaks internals
 *     }
 *   }
 *
 * Implementation requirements:
 *   - `code` is one of {@link ErrorCode} and is the only value clients
 *     are expected to switch on.
 *   - `message` is a stable, user-safe summary; it MUST NOT include
 *     stack traces, SQL queries, file paths, secrets, or internal
 *     identifiers.
 *   - `details` is optional context (e.g. validation hints). In
 *     production we strip implementation detail such as raw exception
 *     messages — see `sendErrorResponse` in `routes/invoiceRoutes.ts`.
 */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code. */
    code: ErrorCode;

    /** Human-readable message. Safe to display to API consumers. */
    message: string;

    /** Optional structured context. Never includes internal details. */
    details?: Record<string, unknown>;
  };
}

/**
 * Exhaustive Merchant API error codes.
 *
 * Adding a code requires four things, in this order:
 *   1. extend this enum,
 *   2. extend `ERROR_CODE_HTTP_STATUS` below,
 *   3. update `docs/error-codes.md`,
 *   4. cover it with a test.
 *
 * Codes are intentionally generic — they identify the *class* of error,
 * not the specific failing field. Detail goes into `ErrorResponse.details`.
 */
export enum ErrorCode {
  /** Missing, malformed or unknown API key. HTTP 401. */
  INVALID_API_KEY = 'INVALID_API_KEY',

  /**
   * API key lacks the permission scope required by the endpoint, or
   * does not authorise the merchant NFT supplied in the request body.
   * HTTP 403.
   *
   * Returned in place of 404 when the caller is not allowed to learn
   * whether the resource exists (information-leakage guard).
   */
  UNAUTHORIZED_MERCHANT = 'UNAUTHORIZED_MERCHANT',

  /** Address is not a syntactically valid TON address. HTTP 400. */
  INVALID_NFT_ADDRESS = 'INVALID_NFT_ADDRESS',

  /** NFT does not belong to a whitelisted collection. HTTP 403. */
  NFT_NOT_WHITELISTED = 'NFT_NOT_WHITELISTED',

  /** Amount is negative, zero, non-integer or exceeds protocol max. HTTP 400. */
  INVALID_AMOUNT = 'INVALID_AMOUNT',

  /** Metadata violates structural constraints (size, keys, types). HTTP 400. */
  INVALID_METADATA = 'INVALID_METADATA',

  /**
   * Invoice does not exist for the caller. HTTP 404.
   *
   * The Merchant API deliberately returns this code without disclosing
   * whether the invoice exists for a *different* merchant — see the
   * security notes in `docs/error-codes.md`.
   */
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',

  /** Invoice has passed its `expires_at`. HTTP 410. */
  INVOICE_EXPIRED = 'INVOICE_EXPIRED',

  /** Per-key rate limit exceeded. HTTP 429, with `Retry-After`. */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  /**
   * Unexpected server-side error. HTTP 500.
   *
   * Never carries implementation detail in production. The original
   * exception is logged with `errorCode: INTERNAL_ERROR` and a request
   * identifier, but is not surfaced to the client.
   */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** Upstream TON node / RPC is unreachable. HTTP 503. */
  BLOCKCHAIN_UNAVAILABLE = 'BLOCKCHAIN_UNAVAILABLE',

  /**
   * A settlement event was submitted without a valid trusted-indexer
   * attestation. HTTP 403.
   *
   * The Merchant API is informational only — the blockchain is the single
   * source of truth — so settlement events are accepted only from the trusted,
   * authenticated indexer. A forged or unauthenticated event is rejected with
   * this code and never flips an invoice to `settled` (audit finding API-H3).
   */
  UNTRUSTED_SETTLEMENT_SOURCE = 'UNTRUSTED_SETTLEMENT_SOURCE',
}

/**
 * Canonical HTTP status code for every {@link ErrorCode}.
 *
 * Declared as `Record<ErrorCode, number>` so TypeScript will fail the
 * build if a new enum member is added without a status. This is the
 * mechanism that keeps the registry exhaustive.
 */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.UNAUTHORIZED_MERCHANT]: 403,
  [ErrorCode.INVALID_NFT_ADDRESS]: 400,
  [ErrorCode.NFT_NOT_WHITELISTED]: 403,
  [ErrorCode.INVALID_AMOUNT]: 400,
  [ErrorCode.INVALID_METADATA]: 400,
  [ErrorCode.INVOICE_NOT_FOUND]: 404,
  [ErrorCode.INVOICE_EXPIRED]: 410,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BLOCKCHAIN_UNAVAILABLE]: 503,
  [ErrorCode.UNTRUSTED_SETTLEMENT_SOURCE]: 403,
};

/**
 * Resolve the HTTP status for a given error code.
 *
 * Falls back to 500 if an unknown string sneaks past the type system
 * (defence in depth: parsing user input or third-party data).
 */
export function getHttpStatusForErrorCode(code: ErrorCode | string): number {
  return ERROR_CODE_HTTP_STATUS[code as ErrorCode] ?? 500;
}
