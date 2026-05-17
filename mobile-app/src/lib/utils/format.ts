/**
 * Mobile-specific formatting helpers built on top of the core utilities.
 */

import { formatTBC, shortAddress } from '@tonbankcard/mobile-core';

export function formatBalance(nanocoins: string): string {
  return `${formatTBC(nanocoins, 2)} TBC`;
}

export function formatRecipient(address: string): string {
  return shortAddress(address, 8);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function parseDecimalToNanocoins(decimal: string): string {
  const trimmed = decimal.trim();
  if (trimmed === '') {
    throw new Error('Empty amount');
  }
  if (!/^\d+(\.\d{1,9})?$/.test(trimmed)) {
    throw new Error(`Invalid TBC amount: ${decimal}`);
  }
  const [whole, fractional = ''] = trimmed.split('.');
  const paddedFraction = (fractional + '000000000').slice(0, 9);
  const nanocoins = BigInt(whole) * 1_000_000_000n + BigInt(paddedFraction);
  return nanocoins.toString();
}
