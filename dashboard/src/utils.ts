/**
 * Utility functions for TONBANKCARD Merchant Dashboard
 *
 * SECURITY NOTICE:
 * These utilities are purely for data formatting and display.
 * They do NOT sign transactions, store keys, or custody funds.
 */

import { Address } from '@ton/core';

import { InvoiceGeneratorParams } from './types';

/**
 * Non-negative amount pattern: an integer or decimal with no sign, exponent,
 * or other characters. Matches values such as "10", "0", "1000000000",
 * and "1.5", but rejects "-1", "1e9", "10&bin=evil", or empty strings.
 */
const NON_NEGATIVE_AMOUNT = /^\d+(\.\d+)?$/;
const NANOCOINS_PER_TBC = 1_000_000_000n;

/**
 * Validate that an amount string is a non-negative integer or decimal.
 *
 * This guards the invoice link against query-parameter injection: a value
 * containing `&` or `=` (e.g. "10&bin=evil") would otherwise inject extra
 * parameters into the generated `ton://transfer` link.
 *
 * @param amount - Amount string to validate
 * @returns The validated amount string
 * @throws {Error} If the amount is not a non-negative integer/decimal
 */
function assertAmount(amount: string): string {
  if (typeof amount !== 'string' || !NON_NEGATIVE_AMOUNT.test(amount)) {
    throw new Error(
      `Invalid amount: expected a non-negative integer or decimal, got ${JSON.stringify(amount)}`
    );
  }
  return amount;
}

/**
 * Validate that a string is a parseable TON address.
 *
 * @param merchantNft - Merchant NFT account address to validate
 * @returns The validated address string
 * @throws {Error} If the address cannot be parsed as a TON address
 */
function assertTonAddress(merchantNft: string): string {
  try {
    Address.parse(merchantNft);
  } catch {
    throw new Error(`Invalid TON address: ${JSON.stringify(merchantNft)}`);
  }
  return merchantNft;
}

function assertDecimalPlaces(decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
    throw new RangeError('decimals must be an integer between 0 and 100');
  }
  return decimals;
}

/**
 * Format nanocoin amount to human-readable TBC string
 *
 * @param nanocoins - Amount in nanocoins as a string (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted TBC amount string (e.g., "10.50")
 */
export function formatTBC(nanocoins: string, decimals: number = 2): string {
  const decimalPlaces = assertDecimalPlaces(decimals);
  const amount = BigInt(nanocoins);
  const sign = amount < 0n ? '-' : '';
  const absoluteAmount = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(decimalPlaces);
  const rounded = (absoluteAmount * scale + NANOCOINS_PER_TBC / 2n) / NANOCOINS_PER_TBC;
  const integerPart = rounded / scale;

  if (decimalPlaces === 0) {
    return `${sign}${integerPart.toString()}`;
  }

  const fractionalPart = (rounded % scale).toString().padStart(decimalPlaces, '0');
  return `${sign}${integerPart.toString()}.${fractionalPart}`;
}

/**
 * Shorten an address for display
 *
 * @param address - Full wallet address
 * @param chars - Number of characters to show on each side (default: 6)
 * @returns Shortened address (e.g., "EQAjHk...3il-Le")
 */
export function shortAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format a Unix timestamp to a human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Human-readable date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format nanocoin amount as a display currency string with thousands separator
 *
 * @param nanocoins - Amount in nanocoins as a string
 * @returns Formatted currency string (e.g., "1,234.56 TBC")
 */
export function formatCurrency(nanocoins: string): string {
  const parts = formatTBC(nanocoins, 2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${integerPart}.${parts[1]} TBC`;
}

/**
 * Calculate the success rate from settled and total payment counts
 *
 * @param settled - Number of settled (successful) payments
 * @param total - Total number of payments
 * @returns Success rate as a ratio from 0 to 1
 */
export function calculateSuccessRate(settled: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return settled / total;
}

/**
 * Generate a ton:// deep link for a payment invoice
 *
 * This generates a link that opens the user's TON wallet.
 * The wallet handles signing - this function does NOT sign anything.
 *
 * @param merchantNft - Merchant's NFT account address
 * @param params - Invoice generation parameters
 * @returns ton:// deep link URL
 */
export function generateInvoiceLink(
  merchantNft: string,
  params: InvoiceGeneratorParams
): string {
  const textParts = [
    'TONBANKCARD Payment',
    params.orderId ? `Order: ${params.orderId}` : '',
    params.description || '',
  ]
    .filter(Boolean)
    .join(' | ');

  // Validate every interpolated field before building the link so no input
  // can inject additional query parameters (see audit finding FRONTEND-H1).
  // Each field is encoded exactly once with encodeURIComponent, which escapes
  // `&`, `=`, and spaces (as %20, the correct escaping for a URI query — unlike
  // URLSearchParams, which would emit form-style `+` for spaces).
  const address = assertTonAddress(merchantNft);

  const query: string[] = [
    `amount=${encodeURIComponent(assertAmount(params.amountTbc))}`,
    `text=${encodeURIComponent(textParts)}`,
  ];

  if (params.expirationMinutes !== undefined) {
    const expiresAt = Math.floor(Date.now() / 1000) + params.expirationMinutes * 60;
    query.push(`exp=${encodeURIComponent(String(expiresAt))}`);
  }

  return `ton://transfer/${encodeURIComponent(address)}?${query.join('&')}`;
}
