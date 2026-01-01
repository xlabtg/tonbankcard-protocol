/**
 * Utility functions for TONBANKCARD Merchant SDK
 */

import { Address } from '@ton/core';
import { sha256_sync } from '@ton/crypto';

/**
 * Parameters for generating invoice ID
 */
interface InvoiceIdParams {
  merchantNft: Address;
  amountTbc: bigint;
  orderId?: string;
  timestamp: number;
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
  const { merchantNft, amountTbc, orderId, timestamp } = params;

  // Concatenate parameters for hashing
  const data = [
    merchantNft.toString(),
    amountTbc.toString(),
    orderId || '',
    timestamp.toString(),
  ].join('|');

  // Hash using SHA-256
  const hash = sha256_sync(data);

  // Return hex-encoded hash
  return Buffer.from(hash).toString('hex');
}

/**
 * Create payload hash for on-chain verification
 *
 * @param payload - Payment payload (order ID, memo, etc.)
 * @returns Hash as bigint
 */
export function createPayloadHash(payload: Record<string, any>): bigint {
  const data = JSON.stringify(payload);
  const hash = sha256_sync(data);
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
}

/**
 * Format TBC amount from nanocoins to human-readable
 *
 * @param nanocoins - Amount in nanocoins (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatTBC(nanocoins: bigint, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
}

/**
 * Parse TBC amount from human-readable to nanocoins
 *
 * @param tbc - Amount in TBC (e.g., "10.5")
 * @returns Amount in nanocoins
 */
export function parseTBC(tbc: string): bigint {
  const num = parseFloat(tbc);
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid TBC amount');
  }
  return BigInt(Math.floor(num * 1e9));
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
export function shortAddress(address: Address | string, chars: number = 6): string {
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
