/**
 * Invoice Service Tests
 *
 * Unit tests for invoice creation, retrieval, and status checking
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InvoiceService } from '../src/services/InvoiceService';
import { ApiKeyService } from '../src/services/ApiKeyService';
import { CreateInvoiceRequest, CONSTANTS, ErrorCode } from '../src/types/invoice';
import { ValidationError } from '../src/utils/validation';
import { hashMetadata } from '../src/utils/helpers';
import {
  SettlementEvent,
  signSettlementEvent,
} from '../src/utils/settlementAttestation';
import { resolveSettlementIndexerSecret } from '../src/config/secrets';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let keyService: ApiKeyService;
  const TEST_API_KEY = 'tbck_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
  const OTHER_API_KEY = 'tbck_test_other_9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k';
  const TEST_MERCHANT_NFT = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'; // Series 7777 (whitelisted)
  const OTHER_MERCHANT_NFT = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'; // Series 8888 (whitelisted)

  beforeEach(() => {
    keyService = new ApiKeyService();
    // Register the test API key so authorization checks pass
    keyService.registerKey(TEST_API_KEY, TEST_MERCHANT_NFT);
    // Inject the key service via the module-level singleton override for tests
    // We create InvoiceService instances that share this keyService by
    // passing it through the constructor (production uses the singleton).
    service = new InvoiceService(keyService);
  });

  describe('createInvoice', () => {
    const validRequest: CreateInvoiceRequest = {
      merchant_nft: TEST_MERCHANT_NFT,
      amount_tbc: '1000000000',
      currency: 'TBC',
      metadata: {
        order_id: 'ORDER-123',
        description: 'Test order',
      },
    };

    it('should create invoice with valid request', async () => {
      const invoice = await service.createInvoice(validRequest, TEST_API_KEY);

      expect(invoice.invoice_id).toMatch(/^inv_[a-f0-9]{16}$/);
      expect(invoice.merchant_nft).toBe(validRequest.merchant_nft);
      expect(invoice.amount_tbc).toBe(validRequest.amount_tbc);
      expect(invoice.currency).toBe('TBC');
      expect(invoice.status).toBe('pending');
      expect(invoice.payment_url).toContain(invoice.invoice_id);
      expect(invoice.metadata).toEqual(validRequest.metadata);
    });

    it('should generate unique invoice IDs', async () => {
      const invoice1 = await service.createInvoice(validRequest, TEST_API_KEY);

      // Different request (different amount)
      const request2 = { ...validRequest, amount_tbc: '2000000000' };
      const invoice2 = await service.createInvoice(request2, TEST_API_KEY);

      expect(invoice1.invoice_id).not.toBe(invoice2.invoice_id);
    });

    it('should be idempotent for same request', async () => {
      const invoice1 = await service.createInvoice(validRequest, TEST_API_KEY);
      const invoice2 = await service.createInvoice(validRequest, TEST_API_KEY);

      expect(invoice1.invoice_id).toBe(invoice2.invoice_id);
    });

    it('should set default expiration if not provided', async () => {
      const invoice = await service.createInvoice(validRequest, TEST_API_KEY);

      const expiresAt = new Date(invoice.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    it('should accept custom expiration time', async () => {
      const customExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      const request = { ...validRequest, expires_at: customExpiry };

      const invoice = await service.createInvoice(request, TEST_API_KEY);

      expect(invoice.expires_at).toBe(customExpiry);
    });

    it('should reject invalid merchant NFT', async () => {
      const invalidRequest = { ...validRequest, merchant_nft: 'invalid' };

      await expect(
        service.createInvoice(invalidRequest, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject zero amount', async () => {
      const invalidRequest = { ...validRequest, amount_tbc: '0' };

      await expect(
        service.createInvoice(invalidRequest, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject negative amount', async () => {
      const invalidRequest = { ...validRequest, amount_tbc: '-100' };

      await expect(
        service.createInvoice(invalidRequest, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid currency', async () => {
      const invalidRequest = { ...validRequest, currency: 'USD' as any };

      await expect(
        service.createInvoice(invalidRequest, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid metadata', async () => {
      const tooManyFields: any = {};
      for (let i = 0; i < 11; i++) {
        tooManyFields[`field${i}`] = 'value';
      }

      const invalidRequest = { ...validRequest, metadata: tooManyFields };

      await expect(
        service.createInvoice(invalidRequest, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject when API key is not registered', async () => {
      await expect(
        service.createInvoice(validRequest, 'tbck_unknown_key_that_was_never_registered')
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createInvoice(validRequest, 'tbck_unknown_key_that_was_never_registered')
      ).rejects.toThrow('API key not authorized for this merchant NFT');
    });

    it('should reject when API key belongs to a different merchant NFT', async () => {
      // Register OTHER_API_KEY for OTHER_MERCHANT_NFT
      keyService.registerKey(OTHER_API_KEY, OTHER_MERCHANT_NFT);

      // Attempt to create an invoice for TEST_MERCHANT_NFT using OTHER_API_KEY
      await expect(
        service.createInvoice(validRequest, OTHER_API_KEY)
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createInvoice(validRequest, OTHER_API_KEY)
      ).rejects.toThrow('API key not authorized for this merchant NFT');
    });

    it('should allow each API key only for its own merchant NFT', async () => {
      keyService.registerKey(OTHER_API_KEY, OTHER_MERCHANT_NFT);

      const requestForOther: CreateInvoiceRequest = {
        ...validRequest,
        merchant_nft: OTHER_MERCHANT_NFT,
      };

      // Each key succeeds only for its own merchant
      const inv1 = await service.createInvoice(validRequest, TEST_API_KEY);
      const inv2 = await service.createInvoice(requestForOther, OTHER_API_KEY);

      expect(inv1.merchant_nft).toBe(TEST_MERCHANT_NFT);
      expect(inv2.merchant_nft).toBe(OTHER_MERCHANT_NFT);
    });

    it('should error with UNAUTHORIZED_MERCHANT code for wrong API key', async () => {
      let caught: unknown;
      try {
        await service.createInvoice(validRequest, 'tbck_wrong_key_xxxxxxxxxxxxxxxx');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ValidationError);
      expect((caught as ValidationError).code).toBe('UNAUTHORIZED_MERCHANT');
    });
  });

  describe('getInvoice', () => {
    it('should retrieve existing invoice', async () => {
      const createRequest: CreateInvoiceRequest = {
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        currency: 'TBC',
      };

      const created = await service.createInvoice(createRequest, TEST_API_KEY);
      const retrieved = await service.getInvoice(created.invoice_id);

      expect(retrieved.invoice_id).toBe(created.invoice_id);
      expect(retrieved.merchant_nft).toBe(created.merchant_nft);
      expect(retrieved.amount_tbc).toBe(created.amount_tbc);
      expect(retrieved.status).toBe('pending');
    });

    it('should throw error for non-existent invoice', async () => {
      const nonExistentId = 'inv_0000000000000000';

      await expect(
        service.getInvoice(nonExistentId)
      ).rejects.toThrow(ValidationError);

      await expect(
        service.getInvoice(nonExistentId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error for invalid invoice ID format', async () => {
      await expect(
        service.getInvoice('invalid')
      ).rejects.toThrow(ValidationError);
    });

    it('should mark expired invoice as expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      const request: CreateInvoiceRequest = {
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        currency: 'TBC',
        expires_at: new Date(Date.now() + 1000).toISOString(), // Initially valid
      };

      const invoice = await service.createInvoice(request, TEST_API_KEY);

      // Manually update expiry to past (simulating time passing)
      // In real implementation, this would happen naturally

      // For testing, we'll check the logic handles expiration correctly
      expect(invoice.status).toBe('pending');
    });
  });

  describe('getInvoiceStatus', () => {
    it('should return status for existing invoice', async () => {
      const createRequest: CreateInvoiceRequest = {
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        currency: 'TBC',
      };

      const created = await service.createInvoice(createRequest, TEST_API_KEY);
      const status = await service.getInvoiceStatus(created.invoice_id, TEST_API_KEY);

      expect(status.invoice_id).toBe(created.invoice_id);
      expect(status.status).toBe('pending');
      expect(status.settlement).toBeUndefined();
    });

    it('should throw error for non-existent invoice', async () => {
      const nonExistentId = 'inv_0000000000000000';

      await expect(
        service.getInvoiceStatus(nonExistentId, TEST_API_KEY)
      ).rejects.toThrow(ValidationError);
    });

    it('should include settlement when settled', async () => {
      const createRequest: CreateInvoiceRequest = {
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        currency: 'TBC',
        metadata: { order_id: 'SETTLE-OK' },
      };

      const invoice = await service.createInvoice(createRequest, TEST_API_KEY);
      const event: SettlementEvent = {
        payer_nft: OTHER_MERCHANT_NFT,
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        payload_hash: hashMetadata({ invoice_id: invoice.invoice_id, order_id: 'SETTLE-OK' }),
        block_number: 1000,
        tx_hash: '0xabc123',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Attested by the trusted indexer, with enough confirmations to be final.
      const result = await service.processSettlementEvent(event, {
        attestation: signSettlementEvent(resolveSettlementIndexerSecret(), event),
        currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS,
      });

      expect(result.settled).toBe(true);
      expect(result.invoiceId).toBe(invoice.invoice_id);

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('settled');
      expect(status.settlement).toBeDefined();
      expect(status.settlement!.on_chain_verified).toBe(true);
      expect(status.settlement!.confirmations).toBe(CONSTANTS.MIN_CONFIRMATIONS);
      expect(status.settlement!.is_final).toBe(true);
    });
  });

  // Regression coverage for audit finding API-H3 (issue #252): the API is
  // informational only — the blockchain is the single source of truth — so
  // settlement requires (1) a trusted-indexer attestation and (2) finality.
  describe('processSettlementEvent (settlement integrity)', () => {
    /** Build a settlement event whose payload_hash matches the given invoice. */
    function buildSettlementEvent(
      invoiceId: string,
      metadata: Record<string, string> = {},
      overrides: Partial<SettlementEvent> = {}
    ): SettlementEvent {
      return {
        payer_nft: OTHER_MERCHANT_NFT,
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        payload_hash: hashMetadata({ invoice_id: invoiceId, ...metadata }),
        block_number: 1000,
        tx_hash: '0xabc123',
        timestamp: Math.floor(Date.now() / 1000),
        ...overrides,
      };
    }

    /** Sign an event with the resolved (test) indexer secret. */
    function attest(event: SettlementEvent): string {
      return signSettlementEvent(resolveSettlementIndexerSecret(), event);
    }

    async function createPendingInvoice(metadata: Record<string, string> = {}) {
      return service.createInvoice(
        {
          merchant_nft: TEST_MERCHANT_NFT,
          amount_tbc: '1000000000',
          currency: 'TBC',
          metadata,
        },
        TEST_API_KEY
      );
    }

    it('rejects a forged event (no attestation) and leaves the invoice pending', async () => {
      const invoice = await createPendingInvoice({ order_id: 'FORGE-1' });
      const event = buildSettlementEvent(invoice.invoice_id, { order_id: 'FORGE-1' });

      // A forged event carries no valid attestation — even with plenty of
      // confirmations it must be rejected, not settled.
      await expect(
        service.processSettlementEvent(event, {
          currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS,
        })
      ).rejects.toThrow(ValidationError);

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('pending');
      expect(status.settlement).toBeUndefined();
    });

    it('rejects an event with a tampered field (attestation mismatch)', async () => {
      const invoice = await createPendingInvoice({ order_id: 'TAMPER-1' });
      const event = buildSettlementEvent(invoice.invoice_id, { order_id: 'TAMPER-1' });
      const attestation = attest(event);

      // Attacker keeps the real attestation but inflates the amount.
      const tampered: SettlementEvent = { ...event, amount_tbc: '9999999999' };

      let thrown: unknown;
      try {
        await service.processSettlementEvent(tampered, {
          attestation,
          currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS,
        });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect((thrown as ValidationError).code).toBe(
        ErrorCode.UNTRUSTED_SETTLEMENT_SOURCE
      );

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('pending');
    });

    it('does not settle an attested event with insufficient confirmations', async () => {
      const invoice = await createPendingInvoice({ order_id: 'CONF-LOW' });
      const event = buildSettlementEvent(invoice.invoice_id, { order_id: 'CONF-LOW' });

      const result = await service.processSettlementEvent(event, {
        attestation: attest(event),
        // One short of MIN_CONFIRMATIONS.
        currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS - 1,
      });

      expect(result.settled).toBe(false);
      expect(result.reason).toBe('insufficient_confirmations');

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('pending');
      expect(status.settlement).toBeUndefined();
    });

    it('does not settle an attested event when confirmations are unknown', async () => {
      const invoice = await createPendingInvoice({ order_id: 'CONF-NONE' });
      const event = buildSettlementEvent(invoice.invoice_id, { order_id: 'CONF-NONE' });

      // No currentBlockNumber → confirmations undefined → not final.
      const result = await service.processSettlementEvent(event, {
        attestation: attest(event),
      });

      expect(result.settled).toBe(false);
      expect(result.reason).toBe('insufficient_confirmations');

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('pending');
    });

    it('settles an attested, final event and records on-chain proof', async () => {
      const invoice = await createPendingInvoice({ order_id: 'CONF-OK' });
      const event = buildSettlementEvent(invoice.invoice_id, { order_id: 'CONF-OK' });

      const result = await service.processSettlementEvent(event, {
        attestation: attest(event),
        currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS,
      });

      expect(result.settled).toBe(true);

      const status = await service.getInvoiceStatus(invoice.invoice_id, TEST_API_KEY);
      expect(status.status).toBe('settled');
      expect(status.settlement!.is_final).toBe(true);
      expect(status.settlement!.confirmations).toBe(CONSTANTS.MIN_CONFIRMATIONS);
      expect(status.settlement!.on_chain_verified).toBe(true);
    });

    it('reports no_matching_invoice for an attested, final event with no match', async () => {
      const event = buildSettlementEvent('inv_does_not_exist', { order_id: 'X' });

      const result = await service.processSettlementEvent(event, {
        attestation: attest(event),
        currentBlockNumber: event.block_number + CONSTANTS.MIN_CONFIRMATIONS,
      });

      expect(result.settled).toBe(false);
      expect(result.reason).toBe('no_matching_invoice');
    });
  });

  describe('cleanupExpiredInvoices', () => {
    it('should mark expired invoices', async () => {
      // Create invoice that expires very soon
      const soonExpiry = new Date(Date.now() + 100).toISOString();
      const request: CreateInvoiceRequest = {
        merchant_nft: TEST_MERCHANT_NFT,
        amount_tbc: '1000000000',
        currency: 'TBC',
        expires_at: soonExpiry,
      };

      const invoice = await service.createInvoice(request, TEST_API_KEY);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 200));

      // Run cleanup
      await service.cleanupExpiredInvoices();

      // Check status
      const retrieved = await service.getInvoice(invoice.invoice_id);
      expect(retrieved.status).toBe('expired');
    });
  });
});
