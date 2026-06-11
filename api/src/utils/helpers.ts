/**
 * Helper Utilities
 *
 * Utility functions for ID generation, hashing, and data manipulation.
 *
 * @see docs/merchant-api-spec.md
 */

import crypto from 'crypto';
import { CreateInvoiceRequest, InvoiceMetadata, CONSTANTS } from '../types/invoice';
import { resolveApiKeySecret } from '../config/secrets';

/**
 * Generate a unique invoice ID
 *
 * Format: inv_<16 hex characters>
 * Uses cryptographically secure random bytes
 *
 * @returns Invoice ID string
 */
export function generateInvoiceId(): string {
  const randomBytes = crypto.randomBytes(8); // 8 bytes = 16 hex chars
  const hexString = randomBytes.toString('hex');
  return `inv_${hexString}`;
}

/**
 * Deterministically serialise a value to a canonical JSON string.
 *
 * Object keys are sorted **at every nesting level** so that two logically
 * equal values always produce byte-identical output regardless of the order in
 * which their keys were inserted. Arrays keep their element order (order is
 * semantically meaningful for arrays).
 *
 * Why not `JSON.stringify(value, Object.keys(value).sort())`? The second
 * argument of `JSON.stringify` is a *replacer array*: it is an allow-list of
 * property names applied **recursively at every level**. Passing only the
 * top-level keys therefore silently drops every nested key — e.g. `metadata.*`
 * — so two values differing only inside a nested object serialise identically.
 * That shortcut caused idempotency-key collisions (audit finding PC-04, issue
 * #373); this helper recurses instead, so nested differences survive.
 *
 * Values with no JSON representation (`undefined`, functions, symbols) are
 * omitted from objects and rendered as `null` inside arrays — matching the
 * behaviour of `JSON.stringify`. For flat objects (no nested objects) the
 * output is byte-identical to the previous `JSON.stringify(obj, sortedKeys)`
 * form, so hashes of flat payloads are unchanged.
 *
 * @param value - Any JSON-serialisable value
 * @returns Canonical JSON string, or `undefined` when `value` itself has no
 *          JSON representation (caller treats this as the JSON literal `null`)
 */
export function canonicalize(value: unknown): string | undefined {
  // No JSON representation — signal omission to the object/array caller.
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  // Primitives (string, number, boolean) and explicit null: defer to
  // JSON.stringify for spec-correct escaping and number formatting.
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  // Arrays: preserve order; non-representable elements collapse to null.
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item) ?? 'null');
    return `[${items.join(',')}]`;
  }

  // Plain objects: recurse with keys sorted at this level, dropping any
  // property whose value has no JSON representation (as JSON.stringify does).
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const serialized = canonicalize(record[key]);
    if (serialized === undefined) {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${serialized}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * Generate idempotency key from invoice request
 *
 * Same input parameters should produce the same key within the expiry window,
 * enabling idempotent invoice creation. Crucially, the key:
 *
 *  - includes `expires_at` so two otherwise-identical creates that request
 *    different expiries do NOT collide. Previously `expires_at` was omitted,
 *    so the second create silently returned the first invoice with the stale
 *    expiry (audit finding API-M2).
 *  - is scoped to the authenticated merchant identity via `keyId`, so two
 *    different API keys (even ones bound to the same merchant NFT) never share
 *    an idempotency namespace.
 *
 * @param request - Create invoice request
 * @param keyId   - Public identifier of the authenticated API key (scope). When
 *                  omitted (e.g. internal callers), the key is computed without
 *                  a key scope.
 * @returns Idempotency key (hex string)
 */
export function generateIdempotencyKey(
  request: CreateInvoiceRequest,
  keyId?: string
): string {
  const data = {
    key_id: keyId ?? null,
    merchant_nft: request.merchant_nft,
    amount_tbc: request.amount_tbc,
    currency: request.currency,
    metadata: request.metadata || {},
    expires_at: request.expires_at ?? null,
  };

  // `canonicalize` recurses into `metadata`, so two requests that differ only
  // inside a nested metadata field produce distinct keys (audit finding PC-04,
  // issue #373). `data` is always an object, so `canonicalize` never returns
  // `undefined`; the `?? ''` keeps the type a plain string for TypeScript.
  const jsonString = canonicalize(data) ?? '';
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Hash metadata for on-chain payload matching
 *
 * This hash is used to match on-chain MerchantPayment events
 * to invoices created via the API.
 *
 * Uses the same recursive `canonicalize` as {@link generateIdempotencyKey} so
 * the buggy replacer-array shortcut (PC-04) lives nowhere in the codebase. For
 * the flat metadata this function receives, `canonicalize` is byte-identical to
 * the previous `JSON.stringify(metadata, sortedKeys)`, so on-chain payload-hash
 * matching is unchanged (pinned by a golden-vector regression test).
 *
 * @param metadata - Invoice metadata (including invoice_id)
 * @returns Hash as hex string
 */
export function hashMetadata(metadata: InvoiceMetadata & { invoice_id: string }): string {
  const jsonString = canonicalize(metadata) ?? '';
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Generate default expiration time
 *
 * @returns ISO 8601 timestamp (24 hours from now)
 */
export function generateDefaultExpiry(): string {
  const now = new Date();
  const expiry = new Date(now.getTime() + CONSTANTS.DEFAULT_EXPIRY_MS);
  return expiry.toISOString();
}

/**
 * Generate payment URL for wallet deep link
 *
 * @param invoiceId - Invoice ID
 * @param baseUrl - Base URL (default: production wallet URL)
 * @returns Payment URL
 */
export function generatePaymentUrl(
  invoiceId: string,
  baseUrl: string = 'https://wallet.tonbankcard.io'
): string {
  return `${baseUrl}/pay/${invoiceId}`;
}

/**
 * Generate blockchain explorer URL
 *
 * @param txHash - Transaction hash
 * @param explorer - Explorer base URL (default: tonscan.org)
 * @returns Explorer URL
 */
export function generateExplorerUrl(
  txHash: string,
  explorer: string = 'https://tonscan.org'
): string {
  return `${explorer}/tx/${txHash}`;
}

/**
 * Check if invoice is expired
 *
 * @param expiresAt - Expiration timestamp (ISO 8601)
 * @returns true if expired
 */
export function isExpired(expiresAt: string): boolean {
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  return expiryDate <= now;
}

/**
 * Format TBC amount for display
 *
 * @param amountNanocoins - Amount in nanocoins (string)
 * @returns Formatted amount (e.g., "1.500000000 TBC")
 */
export function formatTbcAmount(amountNanocoins: string): string {
  const amount = BigInt(amountNanocoins);
  const tbc = Number(amount) / Number(CONSTANTS.TBC_MULTIPLIER);
  return `${tbc.toFixed(9)} TBC`;
}

/**
 * Parse TBC amount from human-readable format
 *
 * @param tbcAmount - Amount in TBC (e.g., "1.5")
 * @returns Amount in nanocoins (string)
 */
export function parseTbcAmount(tbcAmount: string): string {
  const tbc = parseFloat(tbcAmount);
  if (isNaN(tbc) || tbc < 0) {
    throw new Error('Invalid TBC amount');
  }

  const nanocoins = BigInt(Math.floor(tbc * Number(CONSTANTS.TBC_MULTIPLIER)));
  return nanocoins.toString();
}

/**
 * Sanitize metadata for safe storage
 *
 * Removes undefined values and limits field count
 *
 * @param metadata - Raw metadata
 * @returns Sanitized metadata
 */
export function sanitizeMetadata(metadata?: InvoiceMetadata): InvoiceMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: InvoiceMetadata = {};
  let fieldCount = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && fieldCount < CONSTANTS.MAX_METADATA_FIELDS) {
      sanitized[key] = value;
      fieldCount++;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Hash an API key for secure storage/lookup
 *
 * Uses HMAC-SHA256 with a server-side secret so that the hash cannot be
 * reversed or pre-computed without knowledge of the secret.  The secret is
 * resolved from `API_KEY_SECRET` via {@link resolveApiKeySecret}, which fails
 * fast outside test mode rather than falling back to a publicly known constant
 * (audit finding API-H1). Tests may override it by passing `secret` explicitly.
 *
 * IMPORTANT: Never store or log the plaintext API key – only the hash.
 *
 * @param apiKeyValue - Plaintext API key as supplied by the caller
 * @param secret      - HMAC secret (defaults to the validated API_KEY_SECRET)
 * @returns Lowercase hex HMAC-SHA256 digest
 */
export function hashApiKey(
  apiKeyValue: string,
  secret: string = resolveApiKeySecret()
): string {
  return crypto.createHmac('sha256', secret).update(apiKeyValue).digest('hex');
}

/**
 * Generate current ISO 8601 timestamp
 *
 * @returns Current timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff: baseDelay * 2^(attempt - 1)
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
