/**
 * Request ID middleware
 *
 * Tags every inbound HTTP request with a stable, opaque identifier so the
 * API and the indexer can correlate logs, error envelopes, and downstream
 * traces. Accepts a caller-supplied `X-Request-Id` header (echoed back to
 * the client) and synthesises one when absent.
 *
 * The same identifier is:
 *   - attached to `req.requestId` for handler / error-middleware use,
 *   - mirrored on the response as `X-Request-Id` so clients and proxies
 *     can quote it back when reporting an issue,
 *   - included in every error log line emitted by `errorHandler.ts`.
 *
 * The identifier is intentionally not derived from authentication state,
 * so it cannot leak credentials or merchant identity if logged elsewhere.
 *
 * @see docs/error-codes.md
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

/** Header used to propagate the request identifier in both directions. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Accept-with-caution policy for inbound `X-Request-Id`: the value is
 * reflected verbatim only if it matches a conservative pattern. This
 * prevents log-injection and header-splitting attacks via attacker-
 * controlled identifiers.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header(REQUEST_ID_HEADER);
  const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
