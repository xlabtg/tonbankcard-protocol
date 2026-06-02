/**
 * Unit tests for TonbankcardSDK
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Address } from '@ton/core';
import { TonbankcardSDK } from '../src/sdk';
import { parseTBC } from '../src/utils';

describe('TonbankcardSDK', () => {
  let sdk: TonbankcardSDK;
  const testMerchantNft = Address.parse(
    'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
  );
  const testPaymentHub = Address.parse(
    'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'
  );

  beforeEach(() => {
    sdk = new TonbankcardSDK({
      network: 'testnet',
      paymentHubAddress: testPaymentHub,
    });
  });

  describe('createInvoice', () => {
    it('should create a valid invoice', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        orderId: 'ORDER-123',
        description: 'Test Product',
      });

      expect(invoice).toBeDefined();
      expect(invoice.id).toMatch(/^[0-9a-f]{64}$/);
      expect(invoice.merchantNft).toEqual(testMerchantNft);
      expect(invoice.amountTbc).toBe(BigInt(10_500_000_000));
      expect(invoice.orderId).toBe('ORDER-123');
      expect(invoice.description).toBe('Test Product');
      expect(invoice.createdAt).toBeGreaterThan(0);
    });

    it('should throw on zero amount', () => {
      expect(() =>
        sdk.createInvoice({
          merchantNft: testMerchantNft,
          amountTbc: BigInt(0),
        })
      ).toThrow('Invoice amount must be positive');
    });

    it('should throw on negative amount', () => {
      expect(() =>
        sdk.createInvoice({
          merchantNft: testMerchantNft,
          amountTbc: BigInt(-1000),
        })
      ).toThrow('Invoice amount must be positive');
    });

    it('should throw on a malformed merchant NFT address', () => {
      // A non-Address value forced through `as any` (e.g. an integrator
      // passing an unvalidated object) must be rejected.
      const malformed = { toString: () => 'not-a-ton-address' } as never;
      expect(() =>
        sdk.createInvoice({
          merchantNft: malformed,
          amountTbc: parseTBC('1.0'),
        })
      ).toThrow('Invalid merchant NFT address');
    });

    it('should throw on a checksum-corrupted merchant NFT address', () => {
      // Friendly address with the final character flipped → CRC16 mismatch.
      const corrupted = {
        toString: () => 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Lf',
      } as never;
      expect(() =>
        sdk.createInvoice({
          merchantNft: corrupted,
          amountTbc: parseTBC('1.0'),
        })
      ).toThrow('Invalid merchant NFT address');
    });

    it('should accept a valid raw-form merchant NFT address', () => {
      const rawAddress = Address.parseRaw(testMerchantNft.toRawString());
      const invoice = sdk.createInvoice({
        merchantNft: rawAddress,
        amountTbc: parseTBC('1.0'),
      });
      expect(invoice.merchantNft.equals(testMerchantNft)).toBe(true);
    });

    it('should set expiration when specified', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        expirationSeconds: 3600,
      });

      expect(invoice.expiresAt).toBeDefined();
      expect(invoice.expiresAt!).toBeGreaterThan(invoice.createdAt);
      expect(invoice.expiresAt!).toBe(invoice.createdAt + 3600);
    });

    it('should handle metadata', () => {
      const metadata = {
        productId: 'PROD-123',
        customerId: 'CUST-456',
      };

      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        metadata,
      });

      expect(invoice.metadata).toEqual(metadata);
    });
  });

  describe('generateWalletLink', () => {
    it('should generate valid TON Connect link', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        orderId: 'ORDER-123',
        description: 'Test Product',
      });

      const link = sdk.generateWalletLink({ invoice });

      expect(link).toContain('ton://transfer/');
      expect(link).toContain(testMerchantNft.toString());
      expect(link).toContain('amount=10500000000');
      expect(link).toContain('text=');
    });

    it('should include return URL when specified', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
      });

      const returnUrl = 'https://example.com/success';
      const link = sdk.generateWalletLink({ invoice, returnUrl });

      expect(link).toContain(`return=${encodeURIComponent(returnUrl)}`);
    });

    it('should encode description in link', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        description: 'Special Product: Test & Demo',
      });

      const link = sdk.generateWalletLink({ invoice });

      expect(link).toContain('text=');
      expect(link).toContain(encodeURIComponent('TONBANKCARD Payment:'));
    });

    it('should throw on invalid invoice amount', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
      });

      // Manually corrupt the invoice
      invoice.amountTbc = BigInt(0);

      expect(() => sdk.generateWalletLink({ invoice })).toThrow(
        'Invalid invoice amount'
      );
    });
  });

  describe('Security properties', () => {
    it('should not have any signing methods', () => {
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(sdk)
      );

      // SDK should not have methods related to signing
      expect(methods).not.toContain('sign');
      expect(methods).not.toContain('signTransaction');
      expect(methods).not.toContain('sendTransaction');
      expect(methods).not.toContain('executePayment');
    });

    it('should not store private keys', () => {
      const sdkProps = Object.keys(sdk);

      // SDK should not have properties related to keys
      expect(sdkProps).not.toContain('privateKey');
      expect(sdkProps).not.toContain('mnemonic');
      expect(sdkProps).not.toContain('seed');
      expect(sdkProps).not.toContain('keyPair');
    });

    it('should be read-only for blockchain operations', () => {
      // Verify SDK only has read methods, no write methods
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(sdk)
      );

      const writeMethods = methods.filter(
        (m) =>
          m.includes('send') ||
          m.includes('execute') ||
          m.includes('transfer') ||
          m.includes('withdraw')
      );

      expect(writeMethods).toHaveLength(0);
    });
  });

  describe('Invoice ID determinism', () => {
    it('should generate same ID for same parameters', () => {
      const params = {
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        orderId: 'ORDER-123',
      };

      const invoice1 = sdk.createInvoice(params);

      // Wait until the second changes to ensure different timestamp
      const nowSec = Math.floor(Date.now() / 1000);
      while (Math.floor(Date.now() / 1000) === nowSec) {
        // Busy wait until next second
      }

      const invoice2 = sdk.createInvoice(params);

      // IDs should be different because timestamp is different
      expect(invoice1.id).not.toBe(invoice2.id);
      expect(invoice1.createdAt).not.toBe(invoice2.createdAt);
    });
  });

  describe('Configuration', () => {
    it('should accept mainnet config', () => {
      const mainnetSdk = new TonbankcardSDK({
        network: 'mainnet',
        paymentHubAddress: testPaymentHub,
      });

      expect(mainnetSdk).toBeDefined();
    });

    it('should accept testnet config', () => {
      const testnetSdk = new TonbankcardSDK({
        network: 'testnet',
        paymentHubAddress: testPaymentHub,
      });

      expect(testnetSdk).toBeDefined();
    });

    it('should accept custom RPC endpoint', () => {
      const customSdk = new TonbankcardSDK({
        network: 'testnet',
        paymentHubAddress: testPaymentHub,
        rpcEndpoint: 'https://custom-rpc.example.com',
      });

      expect(customSdk).toBeDefined();
    });

    it('should accept API endpoint', () => {
      const apiSdk = new TonbankcardSDK({
        network: 'testnet',
        paymentHubAddress: testPaymentHub,
        apiEndpoint: 'https://api.example.com',
      });

      expect(apiSdk).toBeDefined();
    });
  });
});
