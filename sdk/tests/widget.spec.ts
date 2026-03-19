/**
 * Unit tests for TonbankcardPaymentWidget
 *
 * Tests the widget's configuration validation and payment link generation.
 * DOM rendering tests are excluded as they require a browser environment.
 */

import { describe, it, expect } from '@jest/globals';
import { TonbankcardPaymentWidget } from '../src/widget/PaymentWidget';

describe('TonbankcardPaymentWidget', () => {
  const testConfig = {
    containerId: 'pay-container',
    merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
    amountTbc: '1000000000', // 1 TBC
  };

  describe('constructor validation', () => {
    it('should create widget with valid config', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      expect(widget).toBeDefined();
    });

    it('should throw on missing merchantNft', () => {
      expect(() => new TonbankcardPaymentWidget({
        ...testConfig,
        merchantNft: '',
      })).toThrow('merchantNft is required');
    });

    it('should throw on missing amountTbc', () => {
      expect(() => new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '',
      })).toThrow('amountTbc is required');
    });

    it('should throw on missing containerId', () => {
      expect(() => new TonbankcardPaymentWidget({
        ...testConfig,
        containerId: '',
      })).toThrow('containerId is required');
    });
  });

  describe('generatePaymentLink', () => {
    it('should generate a valid TON Connect link', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      const link = widget.generatePaymentLink();

      expect(link).toContain('ton://transfer/');
      expect(link).toContain(testConfig.merchantNft);
      expect(link).toContain('amount=1000000000');
      expect(link).toContain('text=');
    });

    it('should include order ID in link text', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        orderId: 'ORD-456',
      });
      const link = widget.generatePaymentLink();
      expect(link).toContain('ORD-456');
    });

    it('should include description in link text', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        description: 'Premium subscription',
      });
      const link = widget.generatePaymentLink();
      expect(link).toContain('Premium%20subscription');
    });

    it('should include return URL when provided', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        returnUrl: 'https://merchant.example.com/callback',
      });
      const link = widget.generatePaymentLink();
      expect(link).toContain('return=');
      expect(link).toContain(encodeURIComponent('https://merchant.example.com/callback'));
    });

    it('should call onPaymentLinkGenerated callback', () => {
      let capturedLink = '';
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        onPaymentLinkGenerated: (link) => { capturedLink = link; },
      });
      const link = widget.generatePaymentLink();
      expect(capturedLink).toBe(link);
    });

    it('should generate link without optional fields', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      const link = widget.generatePaymentLink();

      // Should have basic structure
      expect(link.startsWith('ton://transfer/')).toBe(true);
      expect(link).not.toContain('return=');
    });

    it('should handle large amounts correctly', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '999000000000', // 999 TBC
      });
      const link = widget.generatePaymentLink();
      expect(link).toContain('amount=999000000000');
    });
  });

  describe('updateAmount', () => {
    it('should update config amount (without DOM)', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);

      // updateAmount changes internal state
      widget.updateAmount('5000000000');

      // New link should reflect updated amount
      const link = widget.generatePaymentLink();
      expect(link).toContain('amount=5000000000');
    });
  });
});
