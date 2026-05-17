/**
 * Webhook Signature Helpers (server side)
 *
 * Implements the `X-Tonbankcard-Signature` header used by outgoing webhook
 * deliveries. Mirrors the verification helper exposed to merchants via the
 * SDK (`sdk/src/webhook.ts`).
 *
 * Signature format
 * ----------------
 *   X-Tonbankcard-Signature: t=<unix-timestamp>,v1=<hex-hmac-sha256>
 *
 *   v1 = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * Reasons for this scheme
 * -----------------------
 *  - Timestamp is part of the signed payload, so a captured signature
 *    cannot be replayed after the configurable freshness window expires.
 *  - The raw HTTP body is signed verbatim — no re-serialisation — to
 *    avoid signature mismatches caused by key reordering or whitespace.
 *  - Comparisons use `crypto.timingSafeEqual` to defeat timing oracles.
 *  - The same format is used by the merchant SDK so signing and
 *    verification cannot drift apart.
 *
 * @see docs/merchant-api-spec.md
 * @see sdk/src/webhook.ts
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import crypto from 'crypto';

/** Header name used on outgoing webhook deliveries. */
export const SIGNATURE_HEADER = 'X-Tonbankcard-Signature';

/** Default freshness window: reject signatures older than 5 minutes. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

/** Signature scheme identifier. Bumped if the algorithm ever changes. */
export const SIGNATURE_VERSION = 'v1';

/**
 * Result of a signature verification attempt.
 *
 * `reason` is populated only on failure so production code can branch on
 * `valid` without inspecting the field.
 */
export interface SignatureVerificationResult {
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

/**
 * Compute the raw HMAC-SHA256 digest of `${timestamp}.${rawBody}`.
 *
 * Exported so tests can verify byte-for-byte equality with the SDK helper.
 *
 * @param secret    - Per-merchant signing secret
 * @param timestamp - Unix timestamp in seconds (as a string)
 * @param rawBody   - Raw HTTP body bytes (string or Buffer)
 */
export function computeSignature(
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
 * Build the value for the `X-Tonbankcard-Signature` header.
 *
 * @param secret    - Per-merchant signing secret
 * @param rawBody   - Raw HTTP body to sign
 * @param timestamp - Unix timestamp (seconds) — defaults to "now"
 * @returns Header value in the form `t=<ts>,v1=<hex>`
 */
export function signWebhook(
  secret: string,
  rawBody: string | Buffer,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const ts = timestamp.toString();
  const sig = computeSignature(secret, ts, rawBody);
  return `t=${ts},${SIGNATURE_VERSION}=${sig}`;
}

/** Internal representation of a parsed signature header. */
interface ParsedSignature {
  timestamp: number;
  versionedSignatures: Map<string, string>;
}

/**
 * Parse a header value into its `t=…` and `vN=…` components.
 *
 * Defensive: tolerates extra whitespace and ignores unknown keys to keep
 * forward compatibility with future signature schemes.
 *
 * @returns Parsed structure, or `null` if the header is malformed.
 */
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
    // Ignore unknown keys.
  }

  if (timestamp === undefined || versionedSignatures.size === 0) {
    return null;
  }

  return { timestamp, versionedSignatures };
}

/**
 * Constant-time string equality for hex digests.
 *
 * `crypto.timingSafeEqual` throws if the inputs differ in length, so we
 * short-circuit on length first.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Verify a `X-Tonbankcard-Signature` header.
 *
 * @param secret    - Per-merchant signing secret
 * @param rawBody   - Raw HTTP body as received (no re-serialisation)
 * @param header    - Value of the `X-Tonbankcard-Signature` header
 * @param options.tolerance - Freshness window in seconds (default 300)
 * @param options.now       - Current Unix timestamp (seconds) — injectable for tests
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  header: string | undefined,
  options: { tolerance?: number; now?: number } = {}
): SignatureVerificationResult {
  if (!header) {
    return { valid: false, reason: 'missing_signature' };
  }

  const parsed = parseSignatureHeader(header);
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

  const expected = computeSignature(secret, parsed.timestamp.toString(), rawBody);
  if (!constantTimeEqual(provided, expected)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true };
}
