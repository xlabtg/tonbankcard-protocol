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
  const parsed = typeof address === 'string' ? Address.parse(address) : address;
  return parsed.toRawString();
}

/**
 * Canonical JSON used by SDK hashing helpers.
 *
 * Objects are encoded with lexicographically sorted keys, arrays keep their
 * original order, BigInt values are decimal strings, and no insignificant
 * whitespace is emitted.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'bigint') {
    return JSON.stringify(value.toString());
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers');
    }
    return JSON.stringify(value);
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
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
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
    Address.parse(address);
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
  if (!expiresAt) {
    return false;
  }
  return expiresAt < Date.now() / 1000;
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
