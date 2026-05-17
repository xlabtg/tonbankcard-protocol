/**
 * Request ID middleware (indexer API).
 *
 * Tags every inbound HTTP request with a stable, opaque identifier so the
 * Merchant API, the indexer API and the indexer worker can correlate logs
 * across services. Accepts a caller-supplied `X-Request-Id` header
 * (echoed back) and synthesises one when absent.
 *
 * Mirrors `api/src/middleware/requestId.ts`: same header name, same
 * accept-with-caution regex so an attacker cannot inject a malicious value
 * into our logs via header-splitting / log-forging.
 *
 * @see docs/error-codes.md  (`§3 Indexer Structured Logging`)
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/129
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    /** Stable identifier for log/error correlation. Set by requestIdMiddleware. */
    requestId?: string;
  }
}

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Conservative pattern: must not contain CRLF, quotes, or control bytes. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header(REQUEST_ID_HEADER);
  const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
