/**
 * Unit tests for TonbankcardPaymentWidget
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';

// Set up DOM environment for testing
let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body><div id="pay-container"></div></body></html>', {
    url: 'http://localhost',
  });
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
});

afterEach(() => {
  delete (global as any).document;
  delete (global as any).HTMLElement;
});

// Import after DOM setup
import { TonbankcardPaymentWidget } from '../src/widget/PaymentWidget';

describe('TonbankcardPaymentWidget', () => {
  const testConfig = {
    containerId: 'pay-container',
    merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
    amountTbc: '1000000000', // 1 TBC
  };

  describe('constructor', () => {
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
  });

  describe('mount/unmount', () => {
    it('should mount into container element', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      widget.mount();

      const container = dom.window.document.getElementById('pay-container');
      expect(container?.children.length).toBeGreaterThan(0);
    });

    it('should call onReady callback when mounted', () => {
      let ready = false;
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        onReady: () => { ready = true; },
      });
      widget.mount();
      expect(ready).toBe(true);
    });

    it('should throw when container not found', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        containerId: 'nonexistent',
      });
      expect(() => widget.mount()).toThrow('Container element not found');
    });

    it('should unmount and clear container', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      widget.mount();
      widget.unmount();

      const container = dom.window.document.getElementById('pay-container');
      expect(container?.innerHTML).toBe('');
    });

    it('should not mount twice', () => {
      const widget = new TonbankcardPaymentWidget(testConfig);
      widget.mount();
      const firstContent = dom.window.document.getElementById('pay-container')?.innerHTML;
      widget.mount(); // Second mount should be no-op
      expect(dom.window.document.getElementById('pay-container')?.innerHTML).toBe(firstContent);
    });
  });

  describe('inline mode', () => {
    it('should render inline payment card', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        mode: 'inline',
        description: 'Test Payment',
      });
      widget.mount();

      const container = dom.window.document.getElementById('pay-container');
      expect(container?.innerHTML).toContain('TONBANKCARD Payment');
      expect(container?.innerHTML).toContain('1.00 TBC');
      expect(container?.innerHTML).toContain('Test Payment');
    });
  });

  describe('dark theme', () => {
    it('should apply dark theme styling', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        theme: 'dark',
      });
      widget.mount();

      const container = dom.window.document.getElementById('pay-container');
      expect(container?.innerHTML).toContain('#1a1a2e');
    });
  });

  describe('updateAmount', () => {
    it('should update the displayed amount', () => {
      const widget = new TonbankcardPaymentWidget({
        ...testConfig,
        mode: 'inline',
      });
      widget.mount();

      widget.updateAmount('5000000000'); // 5 TBC

      const container = dom.window.document.getElementById('pay-container');
      expect(container?.innerHTML).toContain('5.00 TBC');
    });
  });
});
