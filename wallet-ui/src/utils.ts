/**
 * TONBANKCARD Wallet UI - Utility Functions
 *
 * SECURITY NOTICE:
 * These utilities are for DISPLAY PURPOSES ONLY.
 * They do NOT modify, sign, or authorize any on-chain operations.
 */

import { AccountState } from './types';

/**
 * Format TBC amount from nanocoins string to human-readable display
 *
 * @param nanocoins - Amount in nanocoins as string (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "10.50")
 */
export function formatTBC(nanocoins: string, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
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
