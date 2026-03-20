/**
 * Utility functions for TONBANKCARD Mobile Core
 */

import { Address } from '@ton/core';

/**
 * Format TBC amount from nanocoins string to human-readable
 *
 * @param nanocoins - Amount in nanocoins as string (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatTBC(nanocoins: string, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
}

/**
 * Short address format for display
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
 * Format Unix timestamp to ISO 8601 string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Format Unix timestamp as relative time string
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 0) {
    return 'in the future';
  }

  if (diff < 60) {
    return diff === 1 ? '1 second ago' : `${diff} seconds ago`;
  }

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  const hours = Math.floor(diff / 3600);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const days = Math.floor(diff / 86400);
  if (days < 30) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  const months = Math.floor(diff / 2592000);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(diff / 31536000);
  return years === 1 ? '1 year ago' : `${years} years ago`;
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
