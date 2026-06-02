/**
 * Unit tests for utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatTBC,
  shortAddress,
  formatTimestamp,
  formatRelativeTime,
  isValidTonAddress,
  assertAmount,
} from '../src/utils';

describe('Utils', () => {
  describe('formatTBC', () => {
    it('should format nanocoins to TBC with default decimals', () => {
      expect(formatTBC('10500000000')).toBe('10.50');
    });

    it('should format 1 TBC correctly', () => {
      expect(formatTBC('1000000000')).toBe('1.00');
    });

    it('should handle zero', () => {
      expect(formatTBC('0')).toBe('0.00');
    });

    it('should support custom decimal places', () => {
      expect(formatTBC('10500000000', 4)).toBe('10.5000');
    });

    it('should support zero decimal places', () => {
      expect(formatTBC('10500000000', 0)).toBe('11');
    });

    it('should handle small amounts', () => {
      expect(formatTBC('123456789')).toBe('0.12');
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

    it('should handle addresses at boundary length', () => {
      // 15 chars = 6 + 3 + 6, should not be shortened
      const addr = 'ABCDEFGHIJKLMNO';
      const short = shortAddress(addr);
      expect(short).toBe(addr);
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to ISO string', () => {
      const timestamp = 1234567890;
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2009-02-13T23:31:30.000Z');
    });

    it('should handle zero timestamp', () => {
      const formatted = formatTimestamp(0);
      expect(formatted).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should produce valid ISO 8601 format', () => {
      const formatted = formatTimestamp(1700000000);
      expect(formatted).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('formatRelativeTime', () => {
    it('should format seconds ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 30)).toBe('30 seconds ago');
    });

    it('should format single second', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 1)).toBe('1 second ago');
    });

    it('should format minutes ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 120)).toBe('2 minutes ago');
    });

    it('should format single minute', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 60)).toBe('1 minute ago');
    });

    it('should format hours ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 7200)).toBe('2 hours ago');
    });

    it('should format single hour', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 3600)).toBe('1 hour ago');
    });

    it('should format days ago', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 172800)).toBe('2 days ago');
    });

    it('should handle future timestamps', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      expect(formatRelativeTime(future)).toBe('in the future');
    });
  });

  describe('isValidTonAddress', () => {
    it('should validate correct addresses', () => {
      expect(
        isValidTonAddress('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le')
      ).toBe(true);
    });

    it('should validate another correct address', () => {
      expect(
        isValidTonAddress('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7')
      ).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidTonAddress('invalid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidTonAddress('')).toBe(false);
    });

    it('should reject Ethereum-style addresses', () => {
      expect(isValidTonAddress('0x1234567890abcdef')).toBe(false);
    });
  });

  describe('assertAmount', () => {
    it('should accept a non-negative integer string', () => {
      expect(assertAmount('1000000000')).toBe('1000000000');
    });

    it('should accept zero', () => {
      expect(assertAmount('0')).toBe('0');
    });

    it('should reject negative values', () => {
      expect(() => assertAmount('-1')).toThrow(/Invalid amount/);
    });

    it('should reject decimal values', () => {
      expect(() => assertAmount('1.5')).toThrow(/Invalid amount/);
    });

    it('should reject non-numeric values', () => {
      expect(() => assertAmount('NaN')).toThrow(/Invalid amount/);
    });

    it('should reject empty strings', () => {
      expect(() => assertAmount('')).toThrow(/Invalid amount/);
    });

    it('should reject values containing injection characters', () => {
      expect(() => assertAmount('10&bin=evil')).toThrow(/Invalid amount/);
    });
  });
});
