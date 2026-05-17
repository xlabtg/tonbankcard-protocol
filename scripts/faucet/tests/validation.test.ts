import { describe, it, expect } from '@jest/globals';
import {
  assertValidTonAddress,
  isValidTonAddress,
  parseDispenseAmount,
  DEFAULT_DISPENSE_NANOCOINS,
  MAX_DISPENSE_NANOCOINS,
  FaucetValidationError,
} from '../src/validation';

describe('isValidTonAddress', () => {
  it.each([
    '0:' + 'a'.repeat(64),
    '-1:' + 'F'.repeat(64),
    'EQ' + 'A'.repeat(46),
    'kQ' + 'A'.repeat(46),
  ])('accepts %s', (addr) => {
    expect(isValidTonAddress(addr)).toBe(true);
  });

  it.each(['', 'not-an-address', '0:short', '0:' + 'g'.repeat(64), 'EQ-short'])(
    'rejects %s',
    (addr) => {
      expect(isValidTonAddress(addr)).toBe(false);
    },
  );
});

describe('assertValidTonAddress', () => {
  it('returns the trimmed address when valid', () => {
    const raw = '  0:' + 'a'.repeat(64) + '  ';
    const out = assertValidTonAddress(raw);
    expect(out).toBe(raw.trim());
  });

  it('throws MISSING_FIELD when nothing is supplied', () => {
    expect(() => assertValidTonAddress(undefined)).toThrow(FaucetValidationError);
    try {
      assertValidTonAddress(undefined);
    } catch (e) {
      expect((e as FaucetValidationError).code).toBe('MISSING_FIELD');
    }
  });

  it('throws INVALID_ADDRESS for malformed input', () => {
    try {
      assertValidTonAddress('garbage');
    } catch (e) {
      expect((e as FaucetValidationError).code).toBe('INVALID_ADDRESS');
    }
  });
});

describe('parseDispenseAmount', () => {
  it('falls back to default when empty', () => {
    expect(parseDispenseAmount(undefined)).toBe(DEFAULT_DISPENSE_NANOCOINS);
    expect(parseDispenseAmount('')).toBe(DEFAULT_DISPENSE_NANOCOINS);
    expect(parseDispenseAmount(null)).toBe(DEFAULT_DISPENSE_NANOCOINS);
  });

  it('parses bigint strings', () => {
    expect(parseDispenseAmount('5000000000')).toBe(5_000_000_000n);
  });

  it('rejects negatives and zero', () => {
    expect(() => parseDispenseAmount('0')).toThrow(FaucetValidationError);
    expect(() => parseDispenseAmount('-1')).toThrow(FaucetValidationError);
  });

  it('caps at MAX_DISPENSE_NANOCOINS', () => {
    expect(() => parseDispenseAmount((MAX_DISPENSE_NANOCOINS + 1n).toString())).toThrow(
      FaucetValidationError,
    );
  });

  it('rejects non-numeric strings', () => {
    expect(() => parseDispenseAmount('abc')).toThrow(FaucetValidationError);
  });
});
