/**
 * Unit tests for TonbankcardSDK
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Address, beginCell, Cell } from '@ton/core';
import { TonbankcardSDK } from '../src/sdk';
import { parseTBC } from '../src/utils';
import {
  TonbankcardApiError,
  TonbankcardConfigurationError,
  TonbankcardInvoiceNotFoundError,
  TonbankcardValidationError,
} from '../src/errors';

/**
 * Tact op code for the `MerchantPayment` event emitted by the Payment Hub.
 * Mirrors the constant in `src/sdk.ts` and the indexer's event parser.
 */
const MERCHANT_PAYMENT_OP = 0x3b4c2365;
const MERCHANT_PAYMENT_REQUEST_OP = 0x16b56831;
const MAX_TBC_NANOCOINS = (2n ** 120n) - 1n;

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
  now?: number;
}): any {
  const messages = eventBodies.map((body) => ({
    info: { type: 'external-out' },
    body,
  }));
  return {
    lt: options?.lt ?? 100n,
    // Gen time used by verifySettlement to resolve the inclusion block seqno
    // (SDK-H2). A fixed unix timestamp keeps the lookupBlock URL deterministic.
    now: options?.now ?? 1_700_000_000,
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
  const testPayerNft = Address.parseRaw(
    '0:1111111111111111111111111111111111111111111111111111111111111111'
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
      ).toThrow(TonbankcardValidationError);
    });

    it('should throw on negative amount', () => {
      expect(() =>
        sdk.createInvoice({
          merchantNft: testMerchantNft,
          amountTbc: BigInt(-1000),
        })
      ).toThrow('Invoice amount must be positive');
    });

    it('should enforce the on-chain amount upper bound', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: MAX_TBC_NANOCOINS,
      });

      expect(invoice.amountTbc).toBe(MAX_TBC_NANOCOINS);
      expect(() =>
        sdk.createInvoice({
          merchantNft: testMerchantNft,
          amountTbc: MAX_TBC_NANOCOINS + 1n,
        })
      ).toThrow('Invoice amount exceeds maximum of 2^120 - 1');
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

    it('should allow zero-second expiration as an explicit immediate expiry', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        expirationSeconds: 0,
      });

      expect(invoice.expiresAt).toBe(invoice.createdAt);
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

    it('should snapshot metadata instead of sharing caller references', () => {
      const metadata = {
        product: {
          id: 'PROD-123',
          tags: ['starter', 'digital'],
        },
      };

      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        metadata,
      });

      metadata.product.id = 'PROD-999';
      metadata.product.tags.push('mutated');

      expect(invoice.metadata).toEqual({
        product: {
          id: 'PROD-123',
          tags: ['starter', 'digital'],
        },
      });
    });
  });

  describe('getInvoice', () => {
    it('should expose a catchable configuration error when API endpoint is absent', async () => {
      await expect(sdk.getInvoice('inv_missing')).rejects.toThrow(
        TonbankcardConfigurationError
      );
    });

    it('should expose catchable API errors for non-404 API failures', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as Response);
      const apiSdk = new TonbankcardSDK({
        network: 'testnet',
        paymentHubAddress: testPaymentHub,
        apiEndpoint: 'https://api.test.tonbankcard.local',
      });

      await expect(apiSdk.getInvoice('inv_500')).rejects.toThrow(
        TonbankcardApiError
      );

      fetchMock.mockRestore();
    });
  });

  describe('getInvoiceStatus', () => {
    it('should expose a catchable not-found error when API returns 404', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);
      const apiSdk = new TonbankcardSDK({
        network: 'testnet',
        paymentHubAddress: testPaymentHub,
        apiEndpoint: 'https://api.test.tonbankcard.local',
      });

      await expect(apiSdk.getInvoiceStatus('inv_missing')).rejects.toThrow(
        TonbankcardInvoiceNotFoundError
      );

      fetchMock.mockRestore();
    });
  });

  describe('generateWalletLink', () => {
    function parseTonTransferLink(link: string): {
      address: string;
      query: URLSearchParams;
    } {
      const prefix = 'ton://transfer/';
      expect(link.startsWith(prefix)).toBe(true);
      const [target, query = ''] = link.slice(prefix.length).split('?');
      return { address: target, query: new URLSearchParams(query) };
    }

    it('should generate valid TON Connect link', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        orderId: 'ORDER-123',
        description: 'Test Product',
      });

      const link = sdk.generateWalletLink({ invoice, payerNft: testPayerNft });

      expect(link).toContain('ton://transfer/');
      expect(link).toContain(testPaymentHub.toString());
      expect(link).toContain('amount=50000000');
      expect(link).toContain('bin=');
      expect(link).toContain('text=');
    });

    it('should put native TON in amount and encode the TBC payment request in bin payload', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        orderId: 'ORDER-123',
        description: 'Test Product',
      });

      const link = sdk.generateWalletLink({ invoice, payerNft: testPayerNft });
      const { address, query } = parseTonTransferLink(link);

      expect(address).toBe(testPaymentHub.toString());
      expect(query.get('amount')).toBe('50000000');
      expect(query.get('amount')).not.toBe(invoice.amountTbc.toString());

      const bin = query.get('bin');
      expect(bin).toBeTruthy();

      const [body] = Cell.fromBoc(Buffer.from(bin!, 'base64url'));
      const slice = body.beginParse();

      expect(slice.loadUint(32)).toBe(MERCHANT_PAYMENT_REQUEST_OP);
      expect(slice.loadAddress().equals(testPayerNft)).toBe(true);
      expect(slice.loadAddress().equals(invoice.merchantNft)).toBe(true);
      expect(slice.loadCoins()).toBe(invoice.amountTbc);

      const payload = slice.loadMaybeRef();
      expect(payload).not.toBeNull();
      const payloadSlice = payload!.beginParse();
      expect(payloadSlice.loadUint(8)).toBe(2);
      expect(payloadSlice.loadStringTail()).toBe(invoice.id);
    });

    it('should include return URL when specified', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
      });

      const returnUrl = 'https://example.com/success';
      const link = sdk.generateWalletLink({
        invoice,
        payerNft: testPayerNft,
        returnUrl,
      });

      expect(link).toContain(`return=${encodeURIComponent(returnUrl)}`);
    });

    it('should encode description in link', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
        description: 'Special Product: Test & Demo',
      });

      const link = sdk.generateWalletLink({ invoice, payerNft: testPayerNft });
      const { query } = parseTonTransferLink(link);

      expect(link).toContain('text=');
      expect(query.get('text')).toContain('TONBANKCARD Payment:');
      expect(query.get('text')).toContain('Special Product: Test & Demo');
    });

    it('should throw on invalid invoice amount', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10'),
      });

      // Manually corrupt the invoice
      invoice.amountTbc = BigInt(0);

      expect(() =>
        sdk.generateWalletLink({ invoice, payerNft: testPayerNft })
      ).toThrow('Invalid invoice amount');
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

  describe('verifySettlement confirmations (SDK-H2)', () => {
    const originalFetch = global.fetch;

    // A transaction whose logical time deliberately exceeds 2^53. If `lt` ever
    // leaked back into the confirmation math, the result would be a huge
    // (negative) number instead of the expected block-depth — so these tests
    // double as a regression guard against the original dimensional bug.
    const makeTx = (overrides: Record<string, unknown> = {}) =>
      ({
        lt: BigInt('99999999999999999999'),
        now: 1_700_000_000,
        description: { type: 'generic', aborted: false },
        ...overrides,
      }) as any;

    const mockHeadAndTx = (head: unknown, txObj: unknown): void => {
      const client = (sdk as any).client;
      jest
        .spyOn(client, 'getMasterchainInfo')
        .mockResolvedValue({ latestSeqno: head } as any);
      jest.spyOn(client, 'getTransaction').mockResolvedValue(txObj as any);
    };

    // Mock the toncenter `lookupBlock` REST call used to resolve the
    // transaction's inclusion seqno.
    const mockInclusionSeqno = (seqno: number): void => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, result: { seqno } }),
      })) as any;
    };

    afterEach(() => {
      jest.restoreAllMocks();
      global.fetch = originalFetch;
    });

    it('reports confirmations as the block-seqno difference (N deep => N)', async () => {
      const head = 1_000_000;
      const depth = 7;
      mockHeadAndTx(head, makeTx());
      mockInclusionSeqno(head - depth);

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.confirmations).toBe(depth);
      expect(result.isValid).toBe(true);
      // lt (10^19) must not appear in the result — the difference is tiny.
      expect(result.confirmations).toBeLessThan(1000);
    });

    it('never returns a negative count when inclusion seqno is at/above head', async () => {
      const head = 1_000_000;
      mockHeadAndTx(head, makeTx());
      mockInclusionSeqno(head + 5);

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.confirmations).toBe(0);
    });

    it('does not derive confirmations from the transaction lt (no precision loss)', async () => {
      const head = 70_000_000;
      const depth = 3;
      mockHeadAndTx(head, makeTx({ lt: BigInt('123456789012345678901234') }));
      mockInclusionSeqno(head - depth);

      const result = await sdk.verifySettlement(
        '123456789012345678901234:abc123'
      );

      expect(result.confirmations).toBe(depth);
      expect(Number.isInteger(result.confirmations)).toBe(true);
      expect(result.confirmations).toBeGreaterThanOrEqual(0);
    });

    it('accepts the nested `last.seqno` masterchain info shape', async () => {
      mockHeadAndTx(undefined, makeTx());
      const client = (sdk as any).client;
      jest
        .spyOn(client, 'getMasterchainInfo')
        .mockResolvedValue({ last: { seqno: 500 } } as any);
      mockInclusionSeqno(496);

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.confirmations).toBe(4);
    });

    it('reports 0 confirmations when the inclusion block cannot be resolved', async () => {
      mockHeadAndTx(1_000_000, makeTx());
      global.fetch = jest.fn(async () => ({ ok: false })) as any;

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.confirmations).toBe(0);
      // A successful transaction is still valid even if depth is unknown.
      expect(result.isValid).toBe(true);
    });

    it('marks aborted transactions invalid while still reporting depth', async () => {
      const head = 1_000_000;
      mockHeadAndTx(
        head,
        makeTx({ description: { type: 'generic', aborted: true } })
      );
      mockInclusionSeqno(head - 2);

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.isValid).toBe(false);
      expect(result.confirmations).toBe(2);
    });

    it('rejects a malformed txHash without touching the chain', async () => {
      const result = await sdk.verifySettlement('no-separator');

      expect(result.isValid).toBe(false);
      expect(result.confirmations).toBe(0);
      expect(result.error).toMatch(/Invalid txHash format/);
    });

    it('returns not-found (0 confirmations) for a missing transaction', async () => {
      const client = (sdk as any).client;
      jest.spyOn(client, 'getTransaction').mockResolvedValue(null as any);

      const result = await sdk.verifySettlement('1000:abc123');

      expect(result.isValid).toBe(false);
      expect(result.confirmations).toBe(0);
      expect(result.error).toBe('Transaction not found');
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

    // verifySettlement resolves the transaction's inclusion block seqno via the
    // toncenter `lookupBlock` REST call (SDK-H2). Stub it so confirmations are a
    // small positive block depth (head 1000 − inclusion 995 = 5) instead of
    // hitting the network. Restored after each test.
    const originalFetch = global.fetch;
    beforeEach(() => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, result: { seqno: 995 } }),
      })) as any;
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

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
