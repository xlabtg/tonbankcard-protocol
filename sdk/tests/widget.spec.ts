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

  // Raw `workchain:account_hex` form whose `:` must be percent-encoded in the
  // deep-link path so it cannot break out of the path component.
  const rawMerchantAddress =
    '0:0000000000000000000000000000000000000000000000000000000000000000';

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

  describe('generatePaymentLink security (PC-05)', () => {
    it('should reject query-parameter injection through amountTbc', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '10&bin=evil',
      });

      expect(() => widget.generatePaymentLink()).toThrow(/Invalid amount/);
    });

    it('should not produce an injected parameter when amount is malformed', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '10&bin=evil',
      });

      let link = '';
      try {
        link = widget.generatePaymentLink();
      } catch {
        link = '';
      }
      expect(link).not.toContain('bin=evil');
    });

    it('should reject non-numeric amountTbc values', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: 'NaN',
      });

      expect(() => widget.generatePaymentLink()).toThrow(/Invalid amount/);
    });

    it('should reject negative amountTbc values', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '-100',
      });

      expect(() => widget.generatePaymentLink()).toThrow(/Invalid amount/);
    });

    it('should reject an invalid merchant NFT address', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        merchantNft: 'not-an-address&injected=1',
      });

      expect(() => widget.generatePaymentLink()).toThrow(
        /Invalid merchant NFT address/
      );
    });

    it('should not produce an injected parameter when merchantNft is malformed', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        merchantNft: 'EQabc?amount=1&bin=evil',
      });

      let link = '';
      try {
        link = widget.generatePaymentLink();
      } catch {
        link = '';
      }
      expect(link).not.toContain('bin=evil');
    });

    it('should encode raw-form merchant addresses in the link path', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        merchantNft: rawMerchantAddress,
      });
      const link = widget.generatePaymentLink();

      expect(link).toContain(
        `ton://transfer/${encodeURIComponent(rawMerchantAddress)}?`
      );
      expect(link).not.toContain(`ton://transfer/${rawMerchantAddress}?`);
    });

    it('should produce exactly one amount parameter for a valid request', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      const link = widget.generatePaymentLink();

      expect(link.match(/[?&]amount=/g)?.length).toBe(1);
    });

    it('should encode reserved characters injected via orderId exactly once', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        orderId: '1&amount=999',
      });
      const link = widget.generatePaymentLink();

      // The injected "amount=999" must be encoded inside the text field, not a
      // second standalone amount parameter.
      expect(link.match(/[?&]amount=/g)?.length).toBe(1);
      expect(link).toContain(encodeURIComponent('Order: 1&amount=999'));
    });

    it('should encode reserved characters injected via description exactly once', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        description: 'gift&bin=evil',
      });
      const link = widget.generatePaymentLink();

      expect(link).not.toContain('bin=evil');
      expect(link).toContain(encodeURIComponent('gift&bin=evil'));
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

  describe('formatAmount', () => {
    it('should format large display amounts without JavaScript number precision loss', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        amountTbc: '123456789012345678901234567890',
      });
      const formatAmount = Reflect.get(widget, 'formatAmount') as () => string;

      expect(formatAmount.call(widget)).toBe('123456789012345678901.23 TBC');
    });
  });
});
