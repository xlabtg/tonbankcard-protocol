/**
 * Standardised error handling for the Merchant API.
 *
 * All non-2xx responses go through this module so the response envelope
 * is identical regardless of where the failure originated (validation,
 * authentication, rate limiting, unhandled exception, unknown route).
 *
 * Wire-format guarantees:
 *   - body is `{ "error": { "code", "message", "details"? } }`
 *     (see `types/errors.ts` for the exhaustive `ErrorCode` enum),
 *   - HTTP status comes from `getHttpStatusForErrorCode`,
 *   - `details` never contains stack traces, file paths or raw exception
 *     text in production (`NODE_ENV === 'production'`),
 *   - Errors are logged with `requestId`, `errorCode`, method and path so
 *     operators can correlate the envelope returned to the client with
 *     the entry in the server log.
 *
 * Information-leak guard: `INVOICE_NOT_FOUND` is returned without
 * disclosing whether the resource exists for a different merchant; see
 * `docs/error-codes.md` for the policy.
 *
 * @see docs/error-codes.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 */

import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/validation';
import {
  ErrorCode,
  ErrorResponse,
  getHttpStatusForErrorCode,
} from '../types/errors';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Strip implementation detail before details ever leave the process. */
function sanitiseDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null) continue;
    // Never echo low-level error messages or stack traces.
    if (key === 'error' || key === 'stack' || key === 'cause') continue;
    safe[key] = value;
  }
  return Object.keys(safe).length ? safe : undefined;
}

/**
 * Serialise an error to the standard envelope and write it to `res`.
 *
 * Handlers should call this and `return` rather than throwing; the
 * Express error middleware below is the safety net for anything that
 * escapes.
 */
export function sendErrorResponse(
  req: Request,
  res: Response,
  error: ValidationError | Error,
): Response {
  const requestId = req.requestId;

  if (error instanceof ValidationError) {
    const statusCode = getHttpStatusForErrorCode(error.code);
    const envelope: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: sanitiseDetails(error.details),
      },
    };

    if (statusCode >= 500) {
      logServerError(req, error.code, error);
    } else {
      logClientError(req, error.code, error.message);
    }

    return res.status(statusCode).json(envelope);
  }

  // Unhandled exception path: never surface internals to the caller.
  logServerError(req, ErrorCode.INTERNAL_ERROR, error);

  const envelope: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      details: IS_PRODUCTION
        ? requestId
          ? { requestId }
          : undefined
        : { requestId, error: error.message },
    },
  };
  return res.status(500).json(envelope);
}

/**
 * Express error middleware. Catches synchronous and promise-rejection
 * exceptions that escape route handlers.
 *
 * Must be registered last with the four-argument signature so Express
 * recognises it as an error handler.
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (res.headersSent) {
    // Express has nothing better to do; abort the connection to avoid
    // a half-formed response with the wrong shape.
    return;
  }
  sendErrorResponse(req, res, err as Error);
}

/**
 * 404 handler for unknown routes. Returns the standard envelope.
 */
export function notFoundHandlerMiddleware(req: Request, res: Response): void {
  const envelope: ErrorResponse = {
    error: {
      code: ErrorCode.INVOICE_NOT_FOUND,
      message: 'Resource not found',
    },
  };
  // Use 404 for unknown paths. We deliberately reuse INVOICE_NOT_FOUND
  // rather than introducing a separate ROUTE_NOT_FOUND code: from a
  // client perspective "the thing you asked for is not here" is the
  // same outcome, and a separate code would be one more lever for
  // resource enumeration.
  res.status(404).json(envelope);
}

/* ---------- structured logging ----------------------------------------- */

interface ErrorLogContext {
  level: 'warn' | 'error';
  msg: string;
  requestId: string | undefined;
  method: string;
  path: string;
  errorCode: string;
  err?: { name: string; message: string };
}

function logClientError(req: Request, code: ErrorCode, message: string): void {
  emit({
    level: 'warn',
    msg: message,
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl ?? req.url,
    errorCode: code,
  });
}

function logServerError(req: Request, code: ErrorCode, error: Error): void {
  emit({
    level: 'error',
    msg: error.message,
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl ?? req.url,
    errorCode: code,
    err: { name: error.name, message: error.message },
  });
}

function emit(entry: ErrorLogContext): void {
  // Structured single-line JSON keeps the log volume bounded (well under
  // the 20% cap from issue #129) and makes downstream ingestion trivial.
  const target = entry.level === 'error' ? console.error : console.warn;
  target(JSON.stringify(entry));
}
