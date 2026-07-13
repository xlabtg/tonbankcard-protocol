/**
 * Utility functions for TONBANKCARD Merchant SDK
 */

import { Address } from '@ton/core';
import { sha256_sync } from '@ton/crypto';

export { formatTBC, parseTBC } from './amount';

/**
 * Parameters for generating invoice ID
 */
export interface InvoiceIdParams {
  merchantNft: Address | string;
  amountTbc: bigint;
  orderId?: string;
  timestamp: number | bigint;
}

/**
 * Canonicalize a TON address to raw `workchain:account_hex` form.
 *
 * Friendly address flags such as bounceable/testOnly must not affect hashes.
 */
export function canonicalizeTonAddress(address: Address | string): string {
  const parsed =
    typeof address === 'string' ? Address.parse(address.trim()) : address;
  return parsed.toRawString();
}

/**
 * Encode a string as a canonical JSON string literal.
 *
 * `JSON.stringify` leaves U+2028 (line separator) and U+2029 (paragraph
 * separator) as raw UTF-8 bytes, but Go's `encoding/json` escapes them. To keep
 * canonical bytes identical across the TypeScript, Go, and Python SDKs we always
 * escape them to the lowercase `\u2028` / `\u2029` forms (see audit finding
 * PC-06). The replacement is safe because those code points never appear inside
 * an ASCII escape sequence emitted by `JSON.stringify`.
 */
function encodeCanonicalString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Compare two strings by Unicode code point.
 *
 * `Array.prototype.sort` with no comparator orders by UTF-16 code unit, which
 * disagrees with code-point order for astral-plane characters (U+10000+,
 * encoded as surrogate pairs). The Go SDK (`encoding/json`, UTF-8 byte order)
 * and the Python SDK (`json.dumps(sort_keys=True)`, code-point order) both sort
 * by code point, and UTF-8 byte order equals code-point order. Using this
 * comparator keeps the TS canonical bytes — and therefore the SHA-256 hashes —
 * identical across all three SDKs even when an object key contains an
 * astral-plane character.
 */
function compareByCodePoint(a: string, b: string): number {
  const aCodePoints = Array.from(a);
  const bCodePoints = Array.from(b);
  const length = Math.min(aCodePoints.length, bCodePoints.length);

  for (let i = 0; i < length; i++) {
    const diff =
      (aCodePoints[i].codePointAt(0) as number) -
      (bCodePoints[i].codePointAt(0) as number);
    if (diff !== 0) {
      return diff;
    }
  }

  return aCodePoints.length - bCodePoints.length;
}

/**
 * Canonical JSON used by SDK hashing helpers.
 *
 * Objects are encoded with lexicographically sorted keys, arrays keep their
 * original order, BigInt values are decimal strings, and no insignificant
 * whitespace is emitted.
 *
 * Numbers must be integers in the 53-bit safe range
 * (`[-(2^53 - 1), 2^53 - 1]`); floating-point and out-of-range values are
 * rejected so the result cannot diverge across SDK languages. Larger or
 * fractional values must be supplied as a `bigint` (encoded as a decimal
 * string) or as a decimal string.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'bigint') {
    return encodeCanonicalString(value.toString());
  }

  if (typeof value === 'string') {
    return encodeCanonicalString(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError(
        Number.isFinite(value)
          ? 'Canonical JSON forbids floating-point numbers; use integer minor units, a bigint, or a decimal string'
          : 'Canonical JSON does not support non-finite numbers'
      );
    }
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        'Canonical JSON forbids integers outside the 53-bit safe range; use a bigint or a decimal string'
      );
    }
    return value.toString();
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        'Canonical JSON supports only plain objects and arrays'
      );
    }

    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort(compareByCodePoint)
      .map(
        (key) => `${encodeCanonicalString(key)}:${canonicalJson(objectValue[key])}`
      )
      .join(',')}}`;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value} values`);
}

function canonicalTimestamp(timestamp: number | bigint): string {
  if (typeof timestamp === 'bigint') {
    return timestamp.toString();
  }
  if (!Number.isSafeInteger(timestamp)) {
    throw new TypeError(
      'Invoice timestamp must be a safe integer Unix timestamp'
    );
  }
  return timestamp.toString();
}

/**
 * Canonical byte string hashed by generateInvoiceId.
 */
export function canonicalInvoiceIdPayload(params: InvoiceIdParams): string {
  const { merchantNft, amountTbc, orderId, timestamp } = params;

  return canonicalJson({
    amount_tbc: amountTbc.toString(),
    merchant_nft: canonicalizeTonAddress(merchantNft),
    order_id: orderId ?? '',
    timestamp: canonicalTimestamp(timestamp),
  });
}

/**
 * Generate deterministic invoice ID
 *
 * The invoice ID is a hash of:
 * - merchant NFT address
 * - amount
 * - order ID (if provided)
 * - timestamp
 *
 * This ensures uniqueness and deterministic verification.
 *
 * @param params - Invoice parameters
 * @returns Hex-encoded invoice ID
 */
export function generateInvoiceId(params: InvoiceIdParams): string {
  const data = canonicalInvoiceIdPayload(params);
  const hash = sha256_sync(data);
  return Buffer.from(hash).toString('hex');
}

/**
 * Create payload hash for on-chain verification
 *
 * @param payload - Payment payload (order ID, memo, etc.)
 * @returns Hash as bigint
 */
export function createPayloadHash(payload: Record<string, unknown>): bigint {
  const data = canonicalJson(payload);
  const hash = sha256_sync(data);
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
}

/**
 * Validate TON address format
 *
 * @param address - Address string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTonAddress(address: string): boolean {
  try {
    Address.parse(address.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Short address format for display
 *
 * @param address - Full address
 * @param chars - Number of characters to show on each side (default: 6)
 * @returns Shortened address (e.g., "EQAjHk...3il-Le")
 */
export function shortAddress(
  address: Address | string,
  chars: number = 6
): string {
  const addr = typeof address === 'string' ? address : address.toString();
  if (addr.length <= chars * 2 + 3) {
    return addr;
  }
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/**
 * Check if invoice has expired
 *
 * @param expiresAt - Expiration timestamp (seconds)
 * @returns true if expired, false otherwise
 */
export function isExpired(expiresAt?: number): boolean {
  if (expiresAt === undefined) {
    return false;
  }
  return expiresAt <= Math.floor(Date.now() / 1000);
}

/**
 * Deep-copy metadata/payload values so caller mutations cannot affect SDK
 * objects after creation.
 */
export function cloneJsonSerializable<T>(value: T): T {
  if (value === null) {
    return value;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('JSON clone does not support non-finite numbers');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonSerializable(item)) as T;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('JSON clone supports only plain objects and arrays');
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = cloneJsonSerializable(item);
    }
    return result as T;
  }

  throw new TypeError(`JSON clone does not support ${typeof value} values`);
}

/**
 * Format timestamp to ISO string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Safe bigint serialization for JSON
 *
 * @param value - Value to serialize
 * @returns JSON-safe value
 */
export function serializeBigInt(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInt(val);
    }
    return result;
  }
  return value;
}
