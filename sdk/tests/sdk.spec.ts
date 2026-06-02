/**
 * Unit tests for TonbankcardSDK
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Address, beginCell, Cell } from '@ton/core';
import { TonbankcardSDK } from '../src/sdk';
import { parseTBC } from '../src/utils';

/**
 * Tact op code for the `MerchantPayment` event emitted by the Payment Hub.
 * Mirrors the constant in `src/sdk.ts` and the indexer's event parser.
 */
const MERCHANT_PAYMENT_OP = 0x3b4c2365;

/**
 * Build the body cell of a `MerchantPayment` external-out event as Tact's
 * `emit()` would serialise it.
 */
function buildMerchantPaymentBody(params: {
  payerNft: Address;
  merchantNft: Address;
  amountTbc: bigint;
  payloadHash?: bigint;
  timestamp?: number;
}): Cell {
  return beginCell()
    .storeUint(MERCHANT_PAYMENT_OP, 32)
    .storeAddress(params.payerNft)
    .storeAddress(params.merchantNft)
    .storeCoins(params.amountTbc)
    .storeInt(params.payloadHash ?? 0n, 257)
    .storeUint(params.timestamp ?? 1_700_000_000, 32)
    .endCell();
}

/**
 * Build a parsed-transaction stub matching the shape `@ton/ton`'s
 * `getTransaction` returns, carrying the supplied external-out event bodies.
 */
function buildTransactionStub(eventBodies: Cell[], options?: {
  aborted?: boolean;
  descriptionType?: string;
  lt?: bigint;
}): any {
  const messages = eventBodies.map((body) => ({
    info: { type: 'external-out' },
    body,
  }));
  return {
    lt: options?.lt ?? 100n,
    description: {
      type: options?.descriptionType ?? 'generic',
      aborted: options?.aborted ?? false,
    },
    outMessages: {
      values: () => messages,
    },
  };
}

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

  describe('verifySettlement', () => {
    // Regression coverage for SDK-H1: `matchesInvoice` must reflect a real
    // comparison of the on-chain payment against the invoice, not a hardcoded
    // `true`. See https://github.com/xlabtg/tonbankcard-protocol/issues/266
    const payerNft = Address.parse(
      'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
    );
    const otherMerchantNft = Address.parse(
      'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'
    );
    const txHash = '100:abcdef';

    /** Replace the SDK's TonClient with a stub returning the given transaction. */
    function stubClient(tx: any): void {
      (sdk as any).client = {
        getTransaction: jest.fn(async () => tx),
        getMasterchainInfo: jest.fn(async () => ({ latestSeqno: 1000 })),
      };
    }

    function makeInvoice(amount = '10.50') {
      return sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC(amount),
        orderId: 'ORDER-1',
      });
    }

    it('should report matchesInvoice true for a correct payment', async () => {
      const invoice = makeInvoice();
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: invoice.merchantNft,
            amountTbc: invoice.amountTbc,
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash, invoice);

      expect(result.isValid).toBe(true);
      expect(result.matchesInvoice).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.confirmations).toBeGreaterThan(0);
    });

    it('should report matchesInvoice false for a payment to a different merchant', async () => {
      const invoice = makeInvoice();
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: otherMerchantNft, // wrong recipient
            amountTbc: invoice.amountTbc,
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash, invoice);

      expect(result.isValid).toBe(true);
      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should report matchesInvoice false for a payment with the wrong amount', async () => {
      const invoice = makeInvoice('10.50');
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: invoice.merchantNft,
            amountTbc: parseTBC('1.00'), // underpayment
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash, invoice);

      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should compare payload hash when expected payloadHash is provided', async () => {
      const invoice = makeInvoice();
      const expectedPayloadHash = 0x1234n;
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: invoice.merchantNft,
            amountTbc: invoice.amountTbc,
            payloadHash: 0x9999n, // wrong payload hash
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash, {
        merchantNft: invoice.merchantNft,
        amountTbc: invoice.amountTbc,
        payloadHash: expectedPayloadHash,
      });

      expect(result.matchesInvoice).toBe(false);
    });

    it('should match when payload hash also matches', async () => {
      const invoice = makeInvoice();
      const payloadHash = 0xdeadbeefn;
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: invoice.merchantNft,
            amountTbc: invoice.amountTbc,
            payloadHash,
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash, {
        merchantNft: invoice.merchantNft,
        amountTbc: invoice.amountTbc,
        payloadHash,
      });

      expect(result.matchesInvoice).toBe(true);
    });

    it('should report matchesInvoice false when no invoice is provided', async () => {
      const invoice = makeInvoice();
      stubClient(
        buildTransactionStub([
          buildMerchantPaymentBody({
            payerNft,
            merchantNft: invoice.merchantNft,
            amountTbc: invoice.amountTbc,
          }),
        ])
      );

      const result = await sdk.verifySettlement(txHash);

      expect(result.isValid).toBe(true);
      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('No invoice provided');
    });

    it('should report matchesInvoice false when no MerchantPayment event is present', async () => {
      const invoice = makeInvoice();
      stubClient(buildTransactionStub([])); // no emitted events

      const result = await sdk.verifySettlement(txHash, invoice);

      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('No MerchantPayment event');
    });

    it('should report invalid for a malformed txHash', async () => {
      const result = await sdk.verifySettlement('no-separator');
      expect(result.isValid).toBe(false);
      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('Invalid txHash format');
    });

    it('should not mark an aborted transaction as valid', async () => {
      const invoice = makeInvoice();
      stubClient(
        buildTransactionStub(
          [
            buildMerchantPaymentBody({
              payerNft,
              merchantNft: invoice.merchantNft,
              amountTbc: invoice.amountTbc,
            }),
          ],
          { aborted: true }
        )
      );

      const result = await sdk.verifySettlement(txHash, invoice);
      expect(result.isValid).toBe(false);
    });
  });
});
