/**
 * TONBANKCARD Wallet UI - Utility Functions
 *
 * SECURITY NOTICE:
 * These utilities are for DISPLAY PURPOSES ONLY.
 * They do NOT modify, sign, or authorize any on-chain operations.
 */

import { AccountState } from './types';

const NANOCOINS_PER_TBC = 1_000_000_000n;

function assertDecimalPlaces(decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
    throw new RangeError('decimals must be an integer between 0 and 100');
  }
  return decimals;
}

/**
 * Format TBC amount from nanocoins string to human-readable display
 *
 * @param nanocoins - Amount in nanocoins as string (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "10.50")
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
 * Shorten address for display
 *
 * @param address - Full address string
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
 * Format unix timestamp to human-readable date string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Get human-readable label for account state
 *
 * @param state - Account state enum value
 * @returns Human-readable state label
 */
export function getAccountStateLabel(state: AccountState): string {
  switch (state) {
    case AccountState.ACTIVE:
      return 'Active';
    case AccountState.FROZEN:
      return 'Frozen';
    case AccountState.COLLATERAL_LOCKED:
      return 'Collateral Locked';
    case AccountState.CLOSED:
      return 'Closed';
    default:
      return 'Unknown';
  }
}
