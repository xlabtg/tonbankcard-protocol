const NANOCOINS_PER_TBC = 1_000_000_000n;
export const MAX_TBC_NANOCOINS = (2n ** 120n) - 1n;
const MAX_FIXED_DECIMALS = 100;
const DECIMAL_AMOUNT = /^\+?(?:(\d+)(?:\.(\d*))?|\.(\d+))$/;

function normalizeFixedDecimals(decimals: number): number {
  const digits = Number.isNaN(decimals) ? 0 : Math.trunc(decimals);

  if (!Number.isFinite(digits) || digits < 0 || digits > MAX_FIXED_DECIMALS) {
    throw new RangeError('decimals must be between 0 and 100');
  }

  return digits;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Format TBC amount from nanocoins to human-readable decimal string.
 *
 * @param nanocoins - Amount in nanocoins (1 TBC = 10^9 nanocoins)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatTBC(nanocoins: bigint, decimals: number = 2): string {
  const digits = normalizeFixedDecimals(decimals);
  const sign = nanocoins < 0n ? '-' : '';
  const absoluteNanocoins = nanocoins < 0n ? -nanocoins : nanocoins;

  if (digits <= 9) {
    const roundingDivisor = pow10(9 - digits);
    const roundedUnits =
      (absoluteNanocoins + roundingDivisor / 2n) / roundingDivisor;

    if (digits === 0) {
      return `${sign}${roundedUnits.toString()}`;
    }

    const fractionalScale = pow10(digits);
    const whole = roundedUnits / fractionalScale;
    const fraction = (roundedUnits % fractionalScale)
      .toString()
      .padStart(digits, '0');

    return `${sign}${whole.toString()}.${fraction}`;
  }

  const whole = absoluteNanocoins / NANOCOINS_PER_TBC;
  const fraction =
    (absoluteNanocoins % NANOCOINS_PER_TBC).toString().padStart(9, '0') +
    '0'.repeat(digits - 9);

  return `${sign}${whole.toString()}.${fraction}`;
}

/**
 * Parse TBC amount from human-readable decimal string to nanocoins.
 *
 * @param tbc - Amount in TBC (e.g., "10.5")
 * @returns Amount in nanocoins
 */
export function parseTBC(tbc: string): bigint {
  const match = tbc.trim().match(DECIMAL_AMOUNT);

  if (!match) {
    throw new Error('Invalid TBC amount');
  }

  const wholePart = match[1] ?? '0';
  const fractionalPart = match[2] ?? match[3] ?? '';
  const nanocoinFraction = (fractionalPart + '0'.repeat(9)).slice(0, 9);

  return BigInt(wholePart) * NANOCOINS_PER_TBC + BigInt(nanocoinFraction);
}

/**
 * Validate that an amount is a non-negative integer string (nanocoins).
 *
 * TBC amounts are expressed in nanocoins as decimal strings for precision,
 * so a valid value is one or more digits with no sign, separators, or
 * fractional part. Rejecting anything else prevents query-parameter
 * injection through the amount field of a payment deep link.
 *
 * @param amount - Amount string to validate
 * @returns The validated amount string (unchanged)
 * @throws Error if the value is not a non-negative numeric string
 */
export function assertAmount(amount: string): string {
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new Error(`Invalid amount: ${String(amount)}`);
  }
  return amount;
}
