/**
 * Smoke tests for the dependency-free browser entry point.
 *
 * Importing from `../src/browser` (not from `../src`) guarantees that the
 * vanilla HTML / IIFE bundle keeps a closed surface and does not accidentally
 * pull `@ton/ton` or `@ton/core` back into the browser build.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PaymentWidget,
  formatTBC,
  parseTBC,
  serializeBigInt,
} from '../src/browser';

describe('browser entry', () => {
  it('exposes the payment widget class', () => {
    expect(typeof PaymentWidget).toBe('function');
    // Constructor enforces required fields.
    expect(
      () =>
        new PaymentWidget({
          containerId: '',
          merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
          amountTbc: '1000000000',
        }),
    ).toThrow();
  });

  it('parseTBC and formatTBC round-trip', () => {
    expect(formatTBC(parseTBC('1.50'))).toBe('1.50');
    expect(formatTBC(parseTBC('0'))).toBe('0.00');
    expect(formatTBC(1_000_000_000n)).toBe('1.00');
  });

  it('parseTBC rejects negative and NaN values', () => {
    expect(() => parseTBC('-1')).toThrow('Invalid TBC amount');
    expect(() => parseTBC('abc')).toThrow('Invalid TBC amount');
  });

  it('serializeBigInt converts nested bigints to strings', () => {
    expect(
      serializeBigInt({
        a: 1n,
        b: [2n, { c: 3n }],
      }),
    ).toEqual({ a: '1', b: ['2', { c: '3' }] });
  });
});
