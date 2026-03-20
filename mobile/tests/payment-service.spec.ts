/**
 * Unit tests for PaymentService
 */

import { describe, it, expect } from '@jest/globals';
import { PaymentService } from '../src/services/PaymentService';
import { MobileConfig, PaymentRequest } from '../src/types';

const testConfig: MobileConfig = {
  network: 'testnet',
  paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
};

const merchantAddress = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';

describe('PaymentService', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const service = new PaymentService(testConfig);
      expect(service).toBeInstanceOf(PaymentService);
    });
  });

  describe('generatePaymentLink', () => {
    const service = new PaymentService(testConfig);

    it('should generate valid ton:// deep link', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toMatch(/^ton:\/\/transfer\//);
    });

    it('should include merchant address in link', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(merchantAddress);
    });

    it('should include amount in link', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '5000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain('amount=5000000000');
    });

    it('should include order ID when provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
        orderId: 'ORDER-123',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(encodeURIComponent('Order: ORDER-123'));
    });

    it('should include description when provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
        description: 'Coffee purchase',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(encodeURIComponent('Coffee purchase'));
    });

    it('should include return URL when provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
        returnUrl: 'https://shop.example.com/callback',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(
        `return=${encodeURIComponent('https://shop.example.com/callback')}`
      );
    });

    it('should exclude order ID when not provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).not.toContain('Order:');
    });

    it('should exclude return URL when not provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).not.toContain('return=');
    });

    it('should always include TONBANKCARD Payment text', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(encodeURIComponent('TONBANKCARD Payment'));
    });

    it('should include all optional fields when provided', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '2500000000',
        orderId: 'ORD-456',
        description: 'Premium subscription',
        returnUrl: 'https://app.example.com/done',
      };

      const link = service.generatePaymentLink(request);
      expect(link).toContain(merchantAddress);
      expect(link).toContain('amount=2500000000');
      expect(link).toContain(encodeURIComponent('Order: ORD-456'));
      expect(link).toContain(encodeURIComponent('Premium subscription'));
      expect(link).toContain(
        `return=${encodeURIComponent('https://app.example.com/done')}`
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should return empty array when no API endpoint is configured', async () => {
      const service = new PaymentService(testConfig);
      const history = await service.getTransactionHistory(merchantAddress);
      expect(history).toEqual([]);
    });
  });

  describe('getTransactionById', () => {
    it('should return null when no API endpoint is configured', async () => {
      const service = new PaymentService(testConfig);
      const tx = await service.getTransactionById('tx-123');
      expect(tx).toBeNull();
    });
  });
});
