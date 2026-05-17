/**
 * Webhook Signature Helpers (merchant SDK)
 *
 * Public helpers that mirror the server-side implementation in
 * `api/src/utils/webhookSignature.ts`. Merchants integrate by calling
 * `verifyWebhook(secret, rawBody, header)` from their HTTP handler.
 *
 * Signature format
 * ----------------
 *   X-Tonbankcard-Signature: t=<unix-timestamp>,v1=<hex-hmac-sha256>
 *
 *   v1 = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * Security properties
 * -------------------
 *  - Timestamp is part of the signed payload, so a captured signature
 *    cannot be replayed once the freshness window expires.
 *  - The raw HTTP body is signed verbatim — pass the bytes you received,
 *    do not re-serialise the parsed JSON.
 *  - Comparisons use `crypto.timingSafeEqual` to defeat timing oracles.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import crypto from 'crypto';

/** Header name used on incoming webhook deliveries. */
export const SIGNATURE_HEADER = 'X-Tonbankcard-Signature';

/** Default freshness window: reject signatures older than 5 minutes. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Signature scheme identifier emitted by the server. */
export const SIGNATURE_VERSION = 'v1';

/**
 * Result of a signature verification attempt.
 *
 * `reason` is populated only on failure so production code can simply
 * branch on `valid`.
 */
export interface WebhookVerificationResult {
  /** True if the signature, timestamp and body all line up. */
  valid: boolean;
  /** Machine-readable reason on failure. */
  reason?:
    | 'missing_signature'
    | 'malformed_signature'
    | 'unsupported_version'
    | 'timestamp_out_of_tolerance'
    | 'signature_mismatch';
}

/** Options accepted by {@link verifyWebhook}. */
export interface VerifyWebhookOptions {
  /** Freshness window in seconds (default 300). */
  tolerance?: number;
  /** Override the current timestamp — used in tests. */
  now?: number;
}

/** Internal representation of a parsed signature header. */
interface ParsedSignature {
  timestamp: number;
  versionedSignatures: Map<string, string>;
}

function parseSignatureHeader(value: string): ParsedSignature | null {
  if (typeof value !== 'string' || value.length === 0) return null;

  let timestamp: number | undefined;
  const versionedSignatures = new Map<string, string>();

  for (const part of value.split(',')) {
    const [rawKey, rawVal] = part.split('=');
    if (!rawKey || rawVal === undefined) return null;
    const key = rawKey.trim();
    const val = rawVal.trim();
    if (key === 't') {
      const parsed = Number(val);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      timestamp = parsed;
    } else if (/^v\d+$/.test(key)) {
      versionedSignatures.set(key, val);
    }
  }

  if (timestamp === undefined || versionedSignatures.size === 0) {
    return null;
  }

  return { timestamp, versionedSignatures };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Compute the HMAC-SHA256 digest of `${timestamp}.${rawBody}`.
 *
 * Exposed so application code can produce signatures for testing or for
 * replaying a known body. Production code should use {@link verifyWebhook}.
 */
export function computeWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string | Buffer
): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.`);
  hmac.update(rawBody);
  return hmac.digest('hex');
}

/**
 * Verify a `X-Tonbankcard-Signature` header against the raw request body.
 *
 * Usage:
 * ```ts
 * import { verifyWebhook } from '@tonbankcard/merchant-sdk';
 *
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const result = verifyWebhook(
 *     process.env.TBC_WEBHOOK_SECRET!,
 *     req.body, // raw Buffer, NOT JSON-parsed
 *     req.header('X-Tonbankcard-Signature'),
 *   );
 *   if (!result.valid) return res.status(400).json({ error: result.reason });
 *   // ...handle event
 * });
 * ```
 *
 * @param secret    - Webhook signing secret issued by Tonbankcard
 * @param rawBody   - Raw HTTP body as received (no re-serialisation)
 * @param signature - Value of the `X-Tonbankcard-Signature` header
 * @param options   - Optional tolerance and `now` override
 */
export function verifyWebhook(
  secret: string,
  rawBody: string | Buffer,
  signature: string | undefined | null,
  options: VerifyWebhookOptions = {}
): WebhookVerificationResult {
  if (!signature) {
    return { valid: false, reason: 'missing_signature' };
  }

  const parsed = parseSignatureHeader(signature);
  if (!parsed) {
    return { valid: false, reason: 'malformed_signature' };
  }

  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' };
  }

  const provided = parsed.versionedSignatures.get(SIGNATURE_VERSION);
  if (!provided) {
    return { valid: false, reason: 'unsupported_version' };
  }

  const expected = computeWebhookSignature(
    secret,
    parsed.timestamp.toString(),
    rawBody
  );
  if (!constantTimeEqual(provided, expected)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true };
}
