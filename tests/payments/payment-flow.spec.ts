/**
 * Integration tests for Phase 2 Payment Flow
 *
 * Tests the end-to-end payment flow across components:
 * 1. Merchant API creates invoice
 * 2. SDK generates wallet link
 * 3. (User pays via wallet - simulated)
 * 4. Indexer detects settlement event
 * 5. API reports settlement status
 *
 * These tests use mocked blockchain interactions but verify
 * the data flow between components.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Direct import of API service for testing
// In production, these would be separate services communicating via HTTP
import { InvoiceService } from '../../api/src/services/InvoiceService';
import {
  validateTonAddress,
  validateAmount,
  validateMetadata,
} from '../../api/src/utils/validation';
import {
  generateInvoiceId,
  hashMetadata,
  generatePaymentUrl,
} from '../../api/src/utils/helpers';

describe('Phase 2: Payment Flow Integration', () => {
  let invoiceService: InvoiceService;

  const testMerchantNft = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
  const testPayerNft = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';

  beforeEach(() => {
    invoiceService = new InvoiceService();
  });

  describe('1. Invoice Creation', () => {
    it('should create an invoice with valid parameters', async () => {
      const invoice = await invoiceService.createInvoice(
        {
          merchant_nft: testMerchantNft,
          amount_tbc: '1000000000', // 1 TBC
          currency: 'TBC',
          metadata: { order_id: 'TEST-001', description: 'Test product' },
        },
        'test-api-key'
      );

      expect(invoice).toBeDefined();
      expect(invoice.invoice_id).toMatch(/^inv_[a-f0-9]{16}$/);
      expect(invoice.merchant_nft).toBe(testMerchantNft);
      expect(invoice.amount_tbc).toBe('1000000000');
      expect(invoice.currency).toBe('TBC');
      expect(invoice.status).toBe('pending');
      expect(invoice.payment_url).toContain(invoice.invoice_id);
    });

    it('should enforce idempotency for same parameters', async () => {
      const request = {
        merchant_nft: testMerchantNft,
        amount_tbc: '2000000000',
        currency: 'TBC' as const,
        metadata: { order_id: 'IDEMP-001' },
      };

      const invoice1 = await invoiceService.createInvoice(request, 'test-key');
      const invoice2 = await invoiceService.createInvoice(request, 'test-key');

      expect(invoice1.invoice_id).toBe(invoice2.invoice_id);
    });
  });

  describe('2. Invoice Retrieval', () => {
    it('should retrieve a created invoice', async () => {
      const created = await invoiceService.createInvoice(
        {
          merchant_nft: testMerchantNft,
          amount_tbc: '500000000',
          currency: 'TBC',
        },
        'test-key'
      );

      const retrieved = await invoiceService.getInvoice(created.invoice_id);
      expect(retrieved.invoice_id).toBe(created.invoice_id);
      expect(retrieved.status).toBe('pending');
    });

    it('should return 404 for non-existent invoice', async () => {
      await expect(
        invoiceService.getInvoice('inv_0000000000000000')
      ).rejects.toThrow('Invoice not found');
    });
  });

  describe('3. Settlement Processing', () => {
    it('should process settlement event and update invoice status', async () => {
      // Step 1: Create invoice
      const invoice = await invoiceService.createInvoice(
        {
          merchant_nft: testMerchantNft,
          amount_tbc: '1000000000',
          currency: 'TBC',
          metadata: { order_id: 'SETTLE-001' },
        },
        'test-key'
      );

      // Step 2: Simulate on-chain settlement event
      const payloadHash = hashMetadata({
        invoice_id: invoice.invoice_id,
        order_id: 'SETTLE-001',
      });

      await invoiceService.processSettlementEvent(
        {
          payer_nft: testPayerNft,
          merchant_nft: testMerchantNft,
          amount_tbc: '1000000000',
          payload_hash: payloadHash,
          block_number: 12345,
          tx_hash: 'abc123def456',
          timestamp: Math.floor(Date.now() / 1000),
        },
        12351 // current block (6 confirmations)
      );

      // Step 3: Verify status is updated
      const status = await invoiceService.getInvoiceStatus(
        invoice.invoice_id,
        'test-key'
      );

      expect(status.status).toBe('settled');
      expect(status.settlement).toBeDefined();
      expect(status.settlement!.payer_nft).toBe(testPayerNft);
      expect(status.settlement!.on_chain_verified).toBe(true);
      expect(status.settlement!.confirmations).toBe(6);
      expect(status.settlement!.is_final).toBe(true);
    });

    it('should mark settlement with insufficient confirmations as not final', async () => {
      const invoice = await invoiceService.createInvoice(
        {
          merchant_nft: testMerchantNft,
          amount_tbc: '750000000',
          currency: 'TBC',
          metadata: { order_id: 'CONFIRM-001' },
        },
        'test-key'
      );

      const payloadHash = hashMetadata({
        invoice_id: invoice.invoice_id,
        order_id: 'CONFIRM-001',
      });

      await invoiceService.processSettlementEvent(
        {
          payer_nft: testPayerNft,
          merchant_nft: testMerchantNft,
          amount_tbc: '750000000',
          payload_hash: payloadHash,
          block_number: 100,
          tx_hash: 'lowconf123',
          timestamp: Math.floor(Date.now() / 1000),
        },
        102 // Only 2 confirmations
      );

      const status = await invoiceService.getInvoiceStatus(
        invoice.invoice_id,
        'test-key'
      );

      expect(status.status).toBe('settled');
      expect(status.settlement!.confirmations).toBe(2);
      expect(status.settlement!.is_final).toBe(false);
    });
  });

  describe('4. Validation', () => {
    it('should validate TON address format', () => {
      expect(validateTonAddress(testMerchantNft)).toBe(true);
      expect(() => validateTonAddress('invalid')).toThrow();
      expect(() => validateTonAddress('')).toThrow();
    });

    it('should validate TBC amounts', () => {
      expect(validateAmount('1000000000')).toBe(true);
      expect(() => validateAmount('0')).toThrow();
      expect(() => validateAmount('-1')).toThrow();
      expect(() => validateAmount('not-a-number')).toThrow();
    });

    it('should validate metadata constraints', () => {
      expect(validateMetadata({ order_id: 'test' })).toBe(true);
      expect(validateMetadata(undefined)).toBe(true);

      // Too many fields
      const tooManyFields: Record<string, string> = {};
      for (let i = 0; i < 15; i++) {
        tooManyFields[`field_${i}`] = `value_${i}`;
      }
      expect(() => validateMetadata(tooManyFields)).toThrow();
    });
  });

  describe('5. Utility Functions', () => {
    it('should generate unique invoice IDs', () => {
      const id1 = generateInvoiceId();
      const id2 = generateInvoiceId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^inv_[a-f0-9]{16}$/);
    });

    it('should generate deterministic payload hashes', () => {
      const metadata = { invoice_id: 'test-123', order_id: 'ORD-001' };
      const hash1 = hashMetadata(metadata);
      const hash2 = hashMetadata(metadata);
      expect(hash1).toBe(hash2);
    });

    it('should generate payment URLs', () => {
      const url = generatePaymentUrl('inv_abc123');
      expect(url).toContain('inv_abc123');
    });
  });

  describe('6. Cleanup', () => {
    it('should clean up expired invoices', async () => {
      const result = await invoiceService.cleanupExpiredInvoices();
      expect(result).toBeDefined();
      expect(typeof result.invoicesCleaned).toBe('number');
      expect(typeof result.idempotencyKeysCleaned).toBe('number');
    });
  });
});
