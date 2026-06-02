/**
 * Unit tests for MockTonbankcardSDK and MockSettlementStore
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Address } from '@ton/core';
import { MockTonbankcardSDK, MockSettlementStore, createMockSDK } from '../src/mock';
import { PaymentStatus, AccountState } from '../src/types';
import { parseTBC } from '../src/utils';

describe('createMockSDK', () => {
  it('should create a MockTonbankcardSDK with default options', () => {
    const sdk = createMockSDK();
    expect(sdk).toBeInstanceOf(MockTonbankcardSDK);
  });

  it('should create a MockTonbankcardSDK with autoApproveSettlements', () => {
    const sdk = createMockSDK({ autoApproveSettlements: true });
    expect(sdk).toBeInstanceOf(MockTonbankcardSDK);
  });
});

describe('MockTonbankcardSDK', () => {
  let sdk: MockTonbankcardSDK;
  const testMerchantNft = Address.parse(
    'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
  );

  beforeEach(() => {
    sdk = createMockSDK();
  });

  describe('createInvoice', () => {
    it('should create a valid invoice without network calls', () => {
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
    });

    it('should throw on zero amount', () => {
      expect(() =>
        sdk.createInvoice({
          merchantNft: testMerchantNft,
          amountTbc: BigInt(0),
        })
      ).toThrow('Invoice amount must be positive');
    });
  });

  describe('getInvoice', () => {
    it('should return invoice created via createInvoice', async () => {
      const created = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('5.00'),
        orderId: 'ORDER-GET-TEST',
      });

      const retrieved = await sdk.getInvoice(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.orderId).toBe('ORDER-GET-TEST');
    });

    it('should return null for unknown invoice ID', async () => {
      const result = await sdk.getInvoice('nonexistent-invoice-id');
      expect(result).toBeNull();
    });
  });

  describe('getInvoiceStatus', () => {
    it('should return PENDING for unpaid invoice', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
      });

      const status = await sdk.getInvoiceStatus(invoice.id);
      expect(status).toBe(PaymentStatus.PENDING);
    });

    it('should return SETTLED after simulateSettlement', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
        orderId: 'ORDER-SETTLE',
      });

      sdk.simulateSettlement(invoice.id, 'mock_tx_123');

      const status = await sdk.getInvoiceStatus(invoice.id);
      expect(status).toBe(PaymentStatus.SETTLED);
    });

    it('should return EXPIRED for expired invoice', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
        expirationSeconds: -1,  // Already expired
      });

      const status = await sdk.getInvoiceStatus(invoice.id);
      expect(status).toBe(PaymentStatus.EXPIRED);
    });
  });

  describe('generateWalletLink', () => {
    it('should generate valid wallet link', () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.50'),
        description: 'Test',
      });

      const link = sdk.generateWalletLink({ invoice });
      expect(link).toContain('ton://transfer/');
      expect(link).toContain('amount=10500000000');
    });
  });

  describe('verifySettlement', () => {
    it('should return invalid for unknown tx hash', async () => {
      const result = await sdk.verifySettlement('unknown_tx_hash');
      expect(result.isValid).toBe(false);
    });

    it('should return valid for registered settlement tx hash', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
      });

      sdk.simulateSettlement(invoice.id, 'known_tx_hash_456');

      const result = await sdk.verifySettlement('known_tx_hash_456');
      expect(result.isValid).toBe(true);
      expect(result.confirmations).toBeGreaterThan(0);
    });

    it('should auto-approve with autoApproveSettlements option', async () => {
      const autoSdk = createMockSDK({ autoApproveSettlements: true });

      const result = await autoSdk.verifySettlement('any_tx_hash');
      expect(result.isValid).toBe(true);
      expect(result.confirmations).toBe(10);
    });

    it('should report matchesInvoice false without an invoice to match', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
      });
      sdk.simulateSettlement(invoice.id, 'match_tx');

      const result = await sdk.verifySettlement('match_tx');
      expect(result.isValid).toBe(true);
      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('No invoice provided');
    });

    it('should report matchesInvoice true when the settlement matches the invoice', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
      });
      sdk.simulateSettlement(invoice.id, 'match_tx');

      const result = await sdk.verifySettlement('match_tx', invoice);
      expect(result.matchesInvoice).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should report matchesInvoice false when the amount differs', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('10.00'),
      });
      sdk.simulateSettlement(invoice.id, 'match_tx');

      const result = await sdk.verifySettlement('match_tx', {
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('99.00'),
      });
      expect(result.matchesInvoice).toBe(false);
      expect(result.error).toContain('does not match');
    });
  });

  describe('getAccountInfo', () => {
    it('should return default active account for unknown address', async () => {
      const info = await sdk.getAccountInfo(testMerchantNft);
      expect(info).toBeDefined();
      expect(info.nftAddress).toEqual(testMerchantNft);
      expect(info.state).toBe(AccountState.ACTIVE);
      expect(info.canSend).toBe(true);
      expect(info.canReceive).toBe(true);
    });

    it('should return registered account state', async () => {
      const testAddress = Address.parse(
        'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'
      );

      sdk.registerAccount({
        nftAddress: testAddress,
        balance: parseTBC('100.00'),
        state: AccountState.FROZEN,
        canSend: false,
        canReceive: true,
      });

      const info = await sdk.getAccountInfo(testAddress);
      expect(info.state).toBe(AccountState.FROZEN);
      expect(info.canSend).toBe(false);
      expect(info.balance).toBe(parseTBC('100.00'));
    });
  });

  describe('reset', () => {
    it('should clear all mock state', async () => {
      const invoice = sdk.createInvoice({
        merchantNft: testMerchantNft,
        amountTbc: parseTBC('5.00'),
      });

      sdk.simulateSettlement(invoice.id);
      sdk.reset();

      const retrieved = await sdk.getInvoice(invoice.id);
      expect(retrieved).toBeNull();
    });
  });
});

describe('MockSettlementStore', () => {
  let store: MockSettlementStore;
  const testMerchantNft = Address.parse(
    'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
  );

  beforeEach(() => {
    store = new MockSettlementStore();
  });

  it('should store and retrieve a settlement', () => {
    const mockSdk = createMockSDK();
    const invoice = mockSdk.createInvoice({
      merchantNft: testMerchantNft,
      amountTbc: parseTBC('10.00'),
    });

    const settlement = store.settle(invoice, 'tx_abc123');

    expect(settlement.invoiceId).toBe(invoice.id);
    expect(settlement.txHash).toBe('tx_abc123');
    expect(settlement.status).toBe(PaymentStatus.SETTLED);

    expect(store.get(invoice.id)).toEqual(settlement);
    expect(store.isSettled(invoice.id)).toBe(true);
  });

  it('should report false for unsettled invoice', () => {
    expect(store.isSettled('nonexistent-id')).toBe(false);
    expect(store.get('nonexistent-id')).toBeUndefined();
  });

  it('should clear all settlements', () => {
    const mockSdk = createMockSDK();
    const invoice = mockSdk.createInvoice({
      merchantNft: testMerchantNft,
      amountTbc: parseTBC('5.00'),
    });

    store.settle(invoice, 'tx_xyz');
    store.clear();

    expect(store.isSettled(invoice.id)).toBe(false);
  });

  it('should integrate with MockTonbankcardSDK via asMap()', async () => {
    const mockSdk = createMockSDK();
    const invoice = mockSdk.createInvoice({
      merchantNft: testMerchantNft,
      amountTbc: parseTBC('10.00'),
    });

    store.settle(invoice, 'tx_integration_test');

    const sdkWithStore = createMockSDK({ settlements: store.asMap() });
    sdkWithStore.registerInvoice(invoice);

    const status = await sdkWithStore.getInvoiceStatus(invoice.id);
    expect(status).toBe(PaymentStatus.SETTLED);
  });
});
