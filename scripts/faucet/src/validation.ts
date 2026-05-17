/**
 * Address validation for the TBC faucet.
 *
 * The faucet accepts the two TON address forms most wallets emit:
 *
 *   - Raw form: `<workchain>:<hex64>` (e.g. `0:abc…`)
 *   - User-friendly base64url form: 48 chars, e.g. `EQAbc…` / `kQAbc…`
 *
 * We intentionally avoid pulling in `@ton/core` here so the faucet can run as
 * a tiny standalone service without the heavier TON SDK dependency.
 */

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

const RAW_ADDRESS_RE = /^-?[0-9]+:[0-9a-fA-F]{64}$/;
const FRIENDLY_ADDRESS_RE = /^[A-Za-z0-9_-]{48}$/;

export function isValidTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return RAW_ADDRESS_RE.test(trimmed) || FRIENDLY_ADDRESS_RE.test(trimmed);
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
  return trimmed;
}

/** Default dispense amount in TBC nanocoins (10 TBC). */
export const DEFAULT_DISPENSE_NANOCOINS = 10_000_000_000n;

/** Hard upper bound the sandbox will ever hand out per call (100 TBC). */
export const MAX_DISPENSE_NANOCOINS = 100_000_000_000n;

export function parseDispenseAmount(raw: unknown): bigint {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_DISPENSE_NANOCOINS;
  }
  let value: bigint;
  try {
    value = typeof raw === 'bigint' ? raw : BigInt(String(raw));
  } catch {
    throw new FaucetValidationError(
      'INVALID_AMOUNT',
      'amount must be an integer number of TBC nanocoins',
    );
  }
  if (value <= 0n) {
    throw new FaucetValidationError('INVALID_AMOUNT', 'amount must be positive');
  }
  if (value > MAX_DISPENSE_NANOCOINS) {
    throw new FaucetValidationError(
      'AMOUNT_EXCEEDED',
      `amount may not exceed ${MAX_DISPENSE_NANOCOINS.toString()} nanocoins per dispense`,
    );
  }
  return value;
}
