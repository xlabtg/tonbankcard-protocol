/**
 * Unit tests for SDK utilities
 */

import { describe, it, expect } from '@jest/globals';
import { Address } from '@ton/core';
import {
  generateInvoiceId,
  formatTBC,
  parseTBC,
  isValidTonAddress,
  shortAddress,
  isExpired,
  formatTimestamp,
  serializeBigInt,
} from '../src/utils';

describe('Utils', () => {
  describe('generateInvoiceId', () => {
    it('should generate deterministic invoice ID', () => {
      const params = {
        merchantNft: Address.parse(
          'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
        ),
        amountTbc: BigInt(10_000_000_000),
        orderId: 'ORDER-123',
        timestamp: 1234567890,
      };

      const id1 = generateInvoiceId(params);
      const id2 = generateInvoiceId(params);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    it('should generate different IDs for different inputs', () => {
      const base = {
        merchantNft: Address.parse(
          'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
        ),
        amountTbc: BigInt(10_000_000_000),
        orderId: 'ORDER-123',
        timestamp: 1234567890,
      };

      const id1 = generateInvoiceId(base);
      const id2 = generateInvoiceId({ ...base, amountTbc: BigInt(20_000_000_000) });
      const id3 = generateInvoiceId({ ...base, orderId: 'ORDER-456' });

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });
  });

  describe('formatTBC', () => {
    it('should format nanocoins to TBC', () => {
      expect(formatTBC(BigInt(10_500_000_000))).toBe('10.50');
      expect(formatTBC(BigInt(1_000_000_000))).toBe('1.00');
      expect(formatTBC(BigInt(123_456_789))).toBe('0.12');
    });

    it('should handle zero', () => {
      expect(formatTBC(BigInt(0))).toBe('0.00');
    });

    it('should support custom decimals', () => {
      expect(formatTBC(BigInt(10_500_000_000), 4)).toBe('10.5000');
      expect(formatTBC(BigInt(10_500_000_000), 0)).toBe('11');
    });

    it('should preserve values above the JavaScript safe integer limit', () => {
      const nanocoins = 2n ** 53n + 3n;

      const formatted = formatTBC(nanocoins, 9);

      expect(formatted).toBe('9007199.254740995');
      expect(parseTBC(formatted)).toBe(nanocoins);
    });
  });

  describe('parseTBC', () => {
    it('should parse TBC to nanocoins', () => {
      expect(parseTBC('10.50')).toBe(BigInt(10_500_000_000));
      expect(parseTBC('1')).toBe(BigInt(1_000_000_000));
      expect(parseTBC('0.123')).toBe(BigInt(123_000_000));
    });

    it('should handle zero', () => {
      expect(parseTBC('0')).toBe(BigInt(0));
    });

    it('should throw on invalid input', () => {
      expect(() => parseTBC('invalid')).toThrow('Invalid TBC amount');
      expect(() => parseTBC('-10')).toThrow('Invalid TBC amount');
    });
  });

  describe('isValidTonAddress', () => {
    it('should validate correct addresses', () => {
      expect(
        isValidTonAddress('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le')
      ).toBe(true);
      expect(
        isValidTonAddress('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7')
      ).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidTonAddress('invalid')).toBe(false);
      expect(isValidTonAddress('')).toBe(false);
      expect(isValidTonAddress('0x1234')).toBe(false);
    });

    it('should reject addresses with a corrupted CRC16 checksum', () => {
      // Same as the valid address above but with the final character flipped,
      // which invalidates the CRC16 checksum.
      expect(
        isValidTonAddress('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Lf')
      ).toBe(false);
    });

    it('should accept raw address form', () => {
      const raw = Address.parse(
        'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
      ).toRawString();
      expect(isValidTonAddress(raw)).toBe(true);
    });
  });

  describe('shortAddress', () => {
    it('should shorten long addresses', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      const short = shortAddress(addr);
      expect(short).toBe('EQAjHk...3il-Le');
    });

    it('should not shorten short addresses', () => {
      const addr = 'EQAjHk';
      const short = shortAddress(addr);
      expect(short).toBe(addr);
    });

    it('should support custom char count', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      const short = shortAddress(addr, 4);
      expect(short).toBe('EQAj...l-Le');
    });

    it('should accept Address objects', () => {
      const addr = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
      const short = shortAddress(addr);
      expect(short).toContain('...');
    });
  });

  describe('isExpired', () => {
    it('should detect expired timestamps', () => {
      const past = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(isExpired(past)).toBe(true);
    });

    it('should detect non-expired timestamps', () => {
      const future = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      expect(isExpired(future)).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isExpired(undefined)).toBe(false);
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to ISO string', () => {
      const timestamp = 1234567890;
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2009-02-13T23:31:30.000Z');
    });
  });

  describe('serializeBigInt', () => {
    it('should serialize bigint to string', () => {
      const value = BigInt(123456789);
      expect(serializeBigInt(value)).toBe('123456789');
    });

    it('should serialize objects with bigints', () => {
      const obj = {
        amount: BigInt(10_000_000_000),
        count: 5,
        nested: {
          value: BigInt(999),
        },
      };

      const serialized = serializeBigInt(obj);
      expect(serialized).toEqual({
        amount: '10000000000',
        count: 5,
        nested: {
          value: '999',
        },
      });
    });

    it('should serialize arrays with bigints', () => {
      const arr = [BigInt(1), BigInt(2), BigInt(3)];
      expect(serializeBigInt(arr)).toEqual(['1', '2', '3']);
    });

    it('should handle mixed types', () => {
      const value = {
        str: 'hello',
        num: 42,
        big: BigInt(999),
        arr: [1, BigInt(2), 3],
      };

      const serialized = serializeBigInt(value);
      expect(serialized).toEqual({
        str: 'hello',
        num: 42,
        big: '999',
        arr: [1, '2', 3],
      });
    });
  });
});
