/**
 * Unit tests for PaymentService
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { PaymentService } from '../src/services/PaymentService';
import { MobileConfig, PaymentRequest } from '../src/types';

const testConfig: MobileConfig = {
  network: 'testnet',
  paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
};

const apiConfig: MobileConfig = {
  ...testConfig,
  apiEndpoint: 'https://api.example.com',
};

/** Build a minimal `fetch`-compatible Response stub for the mocked calls. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response;
}

const merchantAddress = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';
const rawMerchantAddress =
  '0:0000000000000000000000000000000000000000000000000000000000000000';

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

    it('should encode raw-form merchant addresses in the link path', () => {
      const link = service.generatePaymentLink({
        merchantNft: rawMerchantAddress,
        amountTbc: '1000000000',
      });

      expect(link).toContain(`ton://transfer/${encodeURIComponent(rawMerchantAddress)}?`);
      expect(link).not.toContain(`ton://transfer/${rawMerchantAddress}?`);
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

  describe('generatePaymentLink security (FRONTEND-H2)', () => {
    const service = new PaymentService(testConfig);

    it('should reject query-parameter injection through amountTbc', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '10&bin=evil',
      };

      expect(() => service.generatePaymentLink(request)).toThrow(/Invalid amount/);
    });

    it('should not produce an injected parameter when amount is malformed', () => {
      const request: PaymentRequest = {
        merchantNft: merchantAddress,
        amountTbc: '10&bin=evil',
      };

      let link = '';
      try {
        link = service.generatePaymentLink(request);
      } catch {
        link = '';
      }
      expect(link).not.toContain('bin=evil');
    });

    it('should reject non-numeric amountTbc values', () => {
      expect(() =>
        service.generatePaymentLink({
          merchantNft: merchantAddress,
          amountTbc: 'NaN',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should reject negative amountTbc values', () => {
      expect(() =>
        service.generatePaymentLink({
          merchantNft: merchantAddress,
          amountTbc: '-100',
        })
      ).toThrow(/Invalid amount/);
    });

    it('should reject an invalid merchant NFT address', () => {
      expect(() =>
        service.generatePaymentLink({
          merchantNft: 'not-an-address&injected=1',
          amountTbc: '1000000000',
        })
      ).toThrow(/Invalid merchant NFT address/);
    });

    it('should encode reserved characters in the return URL exactly once', () => {
      const returnUrl = 'https://shop.example.com/cb?a=1&b=2';
      const link = service.generatePaymentLink({
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
        returnUrl,
      });

      expect(link).toContain(`return=${encodeURIComponent(returnUrl)}`);
      // The raw, unencoded ampersand from the return URL must not appear as a
      // standalone query separator that could inject parameters.
      expect(link).not.toContain('&b=2');
    });

    it('should reject javascript return URLs', () => {
      expect(() =>
        service.generatePaymentLink({
          merchantNft: merchantAddress,
          amountTbc: '1000000000',
          returnUrl: 'javascript:alert(1)',
        })
      ).toThrow(/Invalid return URL/);
    });

    it('should reject return URLs outside the configured host allowlist', () => {
      const allowlistedService = new PaymentService({
        ...testConfig,
        allowedReturnUrlHosts: ['shop.example.com'],
      });

      expect(() =>
        allowlistedService.generatePaymentLink({
          merchantNft: merchantAddress,
          amountTbc: '1000000000',
          returnUrl: 'https://evil.example.com/callback',
        })
      ).toThrow(/Invalid return URL/);
    });

    it('should encode reserved characters injected via orderId exactly once', () => {
      const link = service.generatePaymentLink({
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
        orderId: '1&amount=999',
      });

      // The injected "amount=999" must be encoded inside the text field, not a
      // second standalone amount parameter.
      expect(link.match(/[?&]amount=/g)?.length).toBe(1);
      expect(link).toContain(encodeURIComponent('Order: 1&amount=999'));
    });

    it('should produce exactly one amount parameter for a valid request', () => {
      const link = service.generatePaymentLink({
        merchantNft: merchantAddress,
        amountTbc: '1000000000',
      });

      expect(link.match(/[?&]amount=/g)?.length).toBe(1);
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

  describe('request URL hardening (PC-09)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('percent-encodes nftAddress in the transactions request path', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(jsonResponse([]));

      const service = new PaymentService(apiConfig);
      const crafted = '../admin?inject=1&x=2';
      await service.getTransactionHistory(crafted);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toBe(
        `https://api.example.com/transactions/${encodeURIComponent(crafted)}`
      );
      // The raw, unencoded id must not survive: no path traversal, no injected
      // query parameters.
      expect(calledUrl).not.toContain('../admin');
      expect(calledUrl).not.toContain('?inject=1');
    });

    it('percent-encodes txId in the transaction request path', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(jsonResponse({ id: 'tx', type: 'send' }));

      const service = new PaymentService(apiConfig);
      const crafted = '1/../../secret?admin=true';
      await service.getTransactionById(crafted);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toBe(
        `https://api.example.com/transaction/${encodeURIComponent(crafted)}`
      );
      expect(calledUrl).not.toContain('../../secret');
      expect(calledUrl).not.toContain('?admin=true');
    });

    it('leaves ordinary identifiers byte-for-byte unchanged', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(jsonResponse([]));

      const service = new PaymentService(apiConfig);
      await service.getTransactionHistory(merchantAddress);

      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toBe(
        `https://api.example.com/transactions/${encodeURIComponent(merchantAddress)}`
      );
      // A user-friendly base64url address contains no reserved characters, so
      // encoding is a no-op and the address is preserved verbatim.
      expect(calledUrl).toBe(`https://api.example.com/transactions/${merchantAddress}`);
    });
  });
});
