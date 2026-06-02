/**
 * Unit tests for dashboard utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatTBC,
  shortAddress,
  formatDate,
  formatCurrency,
  calculateSuccessRate,
  generateInvoiceLink,
} from '../src/utils';

describe('Utils', () => {
  describe('formatTBC', () => {
    it('should format 1 TBC correctly', () => {
      expect(formatTBC('1000000000')).toBe('1.00');
    });

    it('should format 0.5 TBC correctly', () => {
      expect(formatTBC('500000000')).toBe('0.50');
    });

    it('should format 0 TBC correctly', () => {
      expect(formatTBC('0')).toBe('0.00');
    });

    it('should format large amounts correctly', () => {
      expect(formatTBC('999000000000')).toBe('999.00');
    });

    it('should support custom decimal places', () => {
      expect(formatTBC('1500000000', 4)).toBe('1.5000');
    });

    it('should format fractional amounts', () => {
      expect(formatTBC('123456789')).toBe('0.12');
    });

    it('should handle 0 decimals', () => {
      expect(formatTBC('10500000000', 0)).toBe('11');
    });
  });

  describe('shortAddress', () => {
    it('should shorten long addresses', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      expect(shortAddress(addr)).toBe('EQAjHk...3il-Le');
    });

    it('should not shorten short addresses', () => {
      const addr = 'EQAjHk';
      expect(shortAddress(addr)).toBe('EQAjHk');
    });

    it('should support custom char count', () => {
      const addr = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
      expect(shortAddress(addr, 4)).toBe('EQAj...l-Le');
    });

    it('should handle address exactly at boundary', () => {
      // 15 chars = 6 + 3 + 6, should not be shortened
      const addr = '123456789012345';
      expect(shortAddress(addr)).toBe(addr);
    });
  });

  describe('formatDate', () => {
    it('should format a known timestamp', () => {
      const result = formatDate(1234567890);
      // The exact output depends on locale, but should contain year and month
      expect(result).toContain('2009');
    });

    it('should format a recent timestamp', () => {
      const result = formatDate(1700000000);
      expect(result).toContain('2023');
    });
  });

  describe('formatCurrency', () => {
    it('should format with thousands separator', () => {
      expect(formatCurrency('1234560000000')).toBe('1,234.56 TBC');
    });

    it('should format 1 TBC', () => {
      expect(formatCurrency('1000000000')).toBe('1.00 TBC');
    });

    it('should format 0 TBC', () => {
      expect(formatCurrency('0')).toBe('0.00 TBC');
    });

    it('should format large amounts', () => {
      expect(formatCurrency('1000000000000')).toBe('1,000.00 TBC');
    });
  });

  describe('calculateSuccessRate', () => {
    it('should calculate 100% success rate', () => {
      expect(calculateSuccessRate(10, 10)).toBe(1);
    });

    it('should calculate 0% success rate', () => {
      expect(calculateSuccessRate(0, 10)).toBe(0);
    });

    it('should calculate 50% success rate', () => {
      expect(calculateSuccessRate(5, 10)).toBe(0.5);
    });

    it('should handle zero total payments', () => {
      expect(calculateSuccessRate(0, 0)).toBe(0);
    });

    it('should handle fractional rates', () => {
      const rate = calculateSuccessRate(1, 3);
      expect(rate).toBeCloseTo(0.3333, 4);
    });
  });

  describe('generateInvoiceLink', () => {
    const merchantNft = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

    it('should generate a basic ton:// link', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
      });
      expect(link).toContain('ton://transfer/');
      expect(link).toContain(merchantNft);
      expect(link).toContain('amount=1000000000');
    });

    it('should include order ID in link text', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
        orderId: 'ORD-123',
      });
      expect(link).toContain('ORD-123');
    });

    it('should include description in link text', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
        description: 'Premium Plan',
      });
      expect(link).toContain('Premium%20Plan');
    });

    it('should include expiration when provided', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
        expirationMinutes: 30,
      });
      expect(link).toContain('exp=');
    });

    it('should not include expiration when not provided', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
      });
      expect(link).not.toContain('exp=');
    });

    it('should generate link without optional fields', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '500000000',
      });
      expect(link.startsWith('ton://transfer/')).toBe(true);
      expect(link).toContain('amount=500000000');
      expect(link).toContain('text=');
    });

    it('should include all optional fields together', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '2000000000',
        orderId: 'ORD-999',
        description: 'Full package',
        expirationMinutes: 60,
      });
      expect(link).toContain('amount=2000000000');
      expect(link).toContain('ORD-999');
      expect(link).toContain('Full%20package');
      expect(link).toContain('exp=');
    });

    // --- Security regression tests (audit finding FRONTEND-H1) ---

    it('should reject an amount that injects extra query parameters', () => {
      expect(() =>
        generateInvoiceLink(merchantNft, {
          amountTbc: '10&bin=evil',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should reject a non-numeric amount', () => {
      expect(() =>
        generateInvoiceLink(merchantNft, {
          amountTbc: 'abc',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should reject a negative amount', () => {
      expect(() =>
        generateInvoiceLink(merchantNft, {
          amountTbc: '-1',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should reject an empty amount', () => {
      expect(() =>
        generateInvoiceLink(merchantNft, {
          amountTbc: '',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should accept a decimal amount', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1.5',
      });
      expect(link).toContain('amount=1.5');
    });

    it('should reject an invalid merchant address', () => {
      expect(() =>
        generateInvoiceLink('not-a-ton-address', {
          amountTbc: '1000000000',
        })
      ).toThrow(/Invalid TON address/);
    });

    it('should reject a merchant address carrying an injected parameter', () => {
      expect(() =>
        generateInvoiceLink(`${merchantNft}?bin=evil`, {
          amountTbc: '1000000000',
        })
      ).toThrow(/Invalid TON address/);
    });

    it('should not inject parameters from the description field', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
        description: 'Pay&bin=evil',
      });
      // The raw `&bin=` must be encoded inside text, not appear as its own param.
      expect(link).not.toContain('&bin=evil');
      expect(link).toContain('bin%3Devil');
    });

    it('should produce exactly one amount parameter', () => {
      const link = generateInvoiceLink(merchantNft, {
        amountTbc: '1000000000',
        orderId: 'ORD-1',
        description: 'Plan',
        expirationMinutes: 15,
      });
      const amountMatches = link.match(/[?&]amount=/g) ?? [];
      expect(amountMatches).toHaveLength(1);
    });
  });
});
