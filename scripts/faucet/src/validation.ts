import { Address } from '@ton/core';

export class FaucetValidationError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_ADDRESS'
      | 'INVALID_AMOUNT'
      | 'MISSING_FIELD'
      | 'AMOUNT_EXCEEDED',
    message: string,
  ) {
    super(message);
    this.name = 'FaucetValidationError';
  }
}

export function isValidTonAddress(address: string): boolean {
  if (typeof address !== 'string' || !address.trim()) return false;
  try { Address.parse(address.trim()); return true; } catch { return false; }
}

export function assertValidTonAddress(address: unknown): string {
  if (typeof address !== 'string' || address.length === 0) {
    throw new FaucetValidationError('MISSING_FIELD', 'address is required');
  }
  const trimmed = address.trim();
  if (!isValidTonAddress(trimmed)) {
    throw new FaucetValidationError(
      'INVALID_ADDRESS',
      'address must be a TON address in raw (`0:hex`) or user-friendly (48-char base64url) form',
    );
  }
  return Address.parse(trimmed).toRawString();
}

/** Default dispense amount in TBC nanocoins (10 TBC). */
export const DEFAULT_DISPENSE_NANOCOINS = 10_000_000_000n;

/** Hard upper bound the sandbox will ever hand out per call (100 TBC). */
export const MAX_DISPENSE_NANOCOINS = 100_000_000_000n;

export function parseDispenseAmount(raw: unknown, maximum = DEFAULT_DISPENSE_NANOCOINS): bigint {
  if (raw === undefined || raw === null || raw === '') {
    return maximum;
  }
  let value: bigint;
  try {
    if (!/^[0-9]+$/.test(String(raw))) throw new Error('Invalid decimal');
    value = BigInt(String(raw));
  } catch {
    throw new FaucetValidationError(
      'INVALID_AMOUNT',
      'amount must be an integer number of TBC nanocoins',
    );
  }
  if (value <= 0n) {
    throw new FaucetValidationError('INVALID_AMOUNT', 'amount must be positive');
  }
  if (value > maximum) {
    throw new FaucetValidationError(
      'AMOUNT_EXCEEDED',
      `amount may not exceed ${maximum.toString()} nanocoins per dispense`,
    );
  }
  return value;
}
