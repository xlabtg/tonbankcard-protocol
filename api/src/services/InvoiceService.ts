/**
 * Invoice Service
 *
 * Stateless service for invoice creation, retrieval, and status checking.
 * This is a reference implementation demonstrating the non-custodial design.
 *
 * In production, this would integrate with:
 * - A database for invoice storage
 * - A blockchain indexer for settlement verification
 * - An authentication system for merchant API keys
 *
 * @see docs/merchant-api-spec.md
 */

import {
  Invoice,
  CreateInvoiceRequest,
  GetInvoiceResponse,
  GetInvoiceStatusResponse,
  InvoiceStatus,
  Settlement,
  ErrorCode,
} from '../types/invoice';

import {
  validateWhitelistedNFT,
  validateAmount,
  validateMetadata,
  validateExpirationTime,
  validateInvoiceId,
  ValidationError,
} from '../utils/validation';

import {
  generateInvoiceId,
  generateIdempotencyKey,
  generateDefaultExpiry,
  generatePaymentUrl,
  generateExplorerUrl,
  getCurrentTimestamp,
  isExpired,
  sanitizeMetadata,
  hashMetadata,
} from '../utils/helpers';

/**
 * ⚠️ PRODUCTION WARNING: In-memory storage MUST NOT be used in production.
 *
 * This reference implementation uses in-memory storage which:
 * - Loses all data on server restart
 * - Does not support horizontal scaling
 * - Has no durability guarantees
 *
 * For production, replace with:
 * - PostgreSQL or MongoDB for invoice storage
 * - Redis for idempotency keys (with TTL)
 */
const invoiceStore = new Map<string, Invoice>();

/**
 * ⚠️ PRODUCTION WARNING: Idempotency store needs TTL in production.
 *
 * In production, use Redis with automatic TTL expiration:
 * - Set TTL = invoice expiration time (e.g., 24 hours)
 * - This prevents unbounded memory growth
 * - Enables idempotency across server restarts
 */
const idempotencyStore = new Map<string, { invoiceId: string; expiresAt: number }>();

/** Default TTL for idempotency keys (24 hours in milliseconds) */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Invoice Service
 * Handles all invoice-related operations
 */
export class InvoiceService {
  /**
   * Create a new invoice
   *
   * This method is idempotent: same input parameters return the same invoice
   * within the expiry window.
   *
   * @param request - Create invoice request
   * @param merchantApiKey - Merchant API key (for authorization)
   * @returns Created invoice
   * @throws ValidationError if input is invalid
   */
  async createInvoice(
    request: CreateInvoiceRequest,
    merchantApiKey: string
  ): Promise<Invoice> {
    // Validate inputs
    this.validateCreateInvoiceRequest(request);

    // TODO: In production, validate merchantApiKey and verify it's authorized
    // for the merchant_nft address
    // if (!this.isAuthorizedMerchant(merchantApiKey, request.merchant_nft)) {
    //   throw new ValidationError(
    //     ErrorCode.UNAUTHORIZED_MERCHANT,
    //     'Merchant NFT not authorized for this API key'
    //   );
    // }

    // Check idempotency (with TTL support)
    const idempotencyKey = generateIdempotencyKey(request);
    const existingEntry = idempotencyStore.get(idempotencyKey);

    if (existingEntry) {
      const now = Date.now();

      // Check if idempotency key has expired (TTL)
      if (existingEntry.expiresAt < now) {
        // TTL expired, clean up and allow new invoice creation
        idempotencyStore.delete(idempotencyKey);
      } else {
        const existingInvoice = invoiceStore.get(existingEntry.invoiceId);

        // Return existing invoice if not expired
        if (existingInvoice && !isExpired(existingInvoice.expires_at)) {
          return existingInvoice;
        }

        // Clean up expired invoice
        if (existingInvoice) {
          idempotencyStore.delete(idempotencyKey);
          invoiceStore.delete(existingEntry.invoiceId);
        }
      }
    }

    // Generate invoice
    const invoiceId = generateInvoiceId();
    const createdAt = getCurrentTimestamp();
    const expiresAt = request.expires_at || generateDefaultExpiry();

    // Validate expiration time
    try {
      validateExpirationTime(expiresAt);
    } catch (error) {
      // If validation fails, use default expiry
      request.expires_at = generateDefaultExpiry();
    }

    const invoice: Invoice = {
      invoice_id: invoiceId,
      merchant_nft: request.merchant_nft,
      amount_tbc: request.amount_tbc,
      currency: 'TBC',
      metadata: sanitizeMetadata(request.metadata),
      status: 'pending',
      created_at: createdAt,
      expires_at: request.expires_at || generateDefaultExpiry(),
      payment_url: generatePaymentUrl(invoiceId),
      settlement: undefined,
    };

    // Store invoice
    invoiceStore.set(invoiceId, invoice);

    // Store idempotency key with TTL
    // TTL is set to the invoice expiration time, ensuring idempotency
    // is maintained for the lifetime of the invoice
    const expiresAt = new Date(invoice.expires_at).getTime();
    idempotencyStore.set(idempotencyKey, {
      invoiceId,
      expiresAt: Math.max(expiresAt, Date.now() + IDEMPOTENCY_TTL_MS),
    });

    return invoice;
  }

  /**
   * Get invoice by ID
   *
   * This method is public and does not require authentication,
   * allowing wallets to resolve payment intents.
   *
   * @param invoiceId - Invoice ID
   * @returns Invoice details
   * @throws ValidationError if invoice not found or expired
   */
  async getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
    validateInvoiceId(invoiceId);

    const invoice = invoiceStore.get(invoiceId);

    if (!invoice) {
      throw new ValidationError(
        ErrorCode.INVOICE_NOT_FOUND,
        'Invoice not found',
        { invoice_id: invoiceId }
      );
    }

    // Check if expired
    if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
      invoice.status = 'expired';
      invoiceStore.set(invoiceId, invoice);
    }

    return invoice;
  }

  /**
   * Get invoice status
   *
   * Returns settlement status and on-chain verification.
   * Requires merchant authentication.
   *
   * @param invoiceId - Invoice ID
   * @param merchantApiKey - Merchant API key (for authorization)
   * @returns Invoice status
   * @throws ValidationError if invoice not found
   */
  async getInvoiceStatus(
    invoiceId: string,
    merchantApiKey: string
  ): Promise<GetInvoiceStatusResponse> {
    // TODO: In production, validate merchantApiKey
    // if (!this.isValidApiKey(merchantApiKey)) {
    //   throw new ValidationError(
    //     ErrorCode.INVALID_API_KEY,
    //     'Invalid API key'
    //   );
    // }

    validateInvoiceId(invoiceId);

    const invoice = invoiceStore.get(invoiceId);

    if (!invoice) {
      throw new ValidationError(
        ErrorCode.INVOICE_NOT_FOUND,
        'Invoice not found',
        { invoice_id: invoiceId }
      );
    }

    // Check if expired
    if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
      invoice.status = 'expired';
      invoiceStore.set(invoiceId, invoice);
    }

    // TODO: In production, verify settlement on-chain
    // const settlement = await this.verifySettlementOnChain(invoice);
    // if (settlement) {
    //   invoice.status = 'settled';
    //   invoice.settlement = settlement;
    //   invoiceStore.set(invoiceId, invoice);
    // }

    return {
      invoice_id: invoice.invoice_id,
      status: invoice.status,
      created_at: invoice.created_at,
      expires_at: invoice.expires_at,
      settlement: invoice.settlement,
    };
  }

  /**
   * Validate create invoice request
   *
   * @param request - Request to validate
   * @throws ValidationError if invalid
   */
  private validateCreateInvoiceRequest(request: CreateInvoiceRequest): void {
    if (!request) {
      throw new ValidationError(
        ErrorCode.INVALID_METADATA,
        'Request body is required'
      );
    }

    // Validate merchant NFT
    validateWhitelistedNFT(request.merchant_nft);

    // Validate amount
    validateAmount(request.amount_tbc);

    // Validate currency
    if (request.currency !== 'TBC') {
      throw new ValidationError(
        ErrorCode.INVALID_METADATA,
        'Currency must be "TBC"',
        { currency: request.currency }
      );
    }

    // Validate metadata
    validateMetadata(request.metadata);

    // Validate expiration time if provided
    if (request.expires_at) {
      validateExpirationTime(request.expires_at);
    }
  }

  /**
   * Verify settlement on-chain (stub for reference implementation)
   *
   * In production, this would:
   * 1. Query blockchain indexer for MerchantPayment events
   * 2. Match events to invoice by payload_hash
   * 3. Verify event is in confirmed block (≥6 confirmations)
   * 4. Return settlement proof
   *
   * @param invoice - Invoice to verify
   * @returns Settlement proof if found, undefined otherwise
   */
  private async verifySettlementOnChain(invoice: Invoice): Promise<Settlement | undefined> {
    // TODO: Implement blockchain verification
    // Example pseudocode:
    //
    // const events = await blockchainIndexer.queryMerchantPaymentEvents({
    //   merchant_nft: invoice.merchant_nft,
    //   from_block: invoice.created_at_block,
    // });
    //
    // const expectedPayloadHash = hashMetadata({
    //   invoice_id: invoice.invoice_id,
    //   ...invoice.metadata,
    // });
    //
    // const matchingEvent = events.find(event =>
    //   event.merchant_nft === invoice.merchant_nft &&
    //   event.amount_tbc === BigInt(invoice.amount_tbc) &&
    //   event.payload_hash === expectedPayloadHash
    // );
    //
    // if (!matchingEvent) {
    //   return undefined;
    // }
    //
    // // Verify confirmations
    // const currentBlock = await tonClient.getLatestBlock();
    // const confirmations = currentBlock - matchingEvent.block_number;
    //
    // if (confirmations < CONSTANTS.MIN_CONFIRMATIONS) {
    //   return undefined; // Not enough confirmations yet
    // }
    //
    // return {
    //   payer_nft: matchingEvent.payer_nft,
    //   merchant_nft: matchingEvent.merchant_nft,
    //   amount_tbc: matchingEvent.amount_tbc.toString(),
    //   block_number: matchingEvent.block_number,
    //   tx_hash: matchingEvent.tx_hash,
    //   timestamp: new Date(matchingEvent.timestamp * 1000).toISOString(),
    //   payload_hash: matchingEvent.payload_hash,
    //   on_chain_verified: true,
    //   verification_url: generateExplorerUrl(matchingEvent.tx_hash),
    // };

    return undefined;
  }

  /**
   * Process on-chain settlement event (stub for reference implementation)
   *
   * This would be called by the blockchain indexer when a MerchantPayment
   * event is detected.
   *
   * @param event - MerchantPayment event from blockchain
   * @param currentBlockNumber - Current block number for confirmation calculation
   */
  async processSettlementEvent(
    event: {
      payer_nft: string;
      merchant_nft: string;
      amount_tbc: string;
      payload_hash: string;
      block_number: number;
      tx_hash: string;
      timestamp: number;
    },
    currentBlockNumber?: number
  ): Promise<void> {
    // Find matching invoice by payload_hash
    // The payload should contain the invoice_id, allowing us to match events to invoices

    // In production:
    // 1. Extract invoice_id from payload (if payload was stored)
    // 2. Or iterate through pending invoices and match by:
    //    - merchant_nft
    //    - amount_tbc
    //    - payload_hash (computed from invoice metadata)

    // For reference implementation, we'll iterate through pending invoices
    for (const [invoiceId, invoice] of invoiceStore.entries()) {
      if (invoice.status !== 'pending') {
        continue;
      }

      // Match by merchant NFT and amount
      if (
        invoice.merchant_nft === event.merchant_nft &&
        invoice.amount_tbc === event.amount_tbc
      ) {
        // Verify payload hash
        const expectedHash = hashMetadata({
          invoice_id: invoice.invoice_id,
          ...invoice.metadata,
        });

        if (expectedHash === event.payload_hash) {
          // Calculate confirmations if current block is provided
          const confirmations = currentBlockNumber
            ? currentBlockNumber - event.block_number
            : undefined;

          const isFinal = confirmations !== undefined
            ? confirmations >= 6 // CONSTANTS.MIN_CONFIRMATIONS
            : undefined;

          // Settlement matched!
          const settlement: Settlement = {
            payer_nft: event.payer_nft,
            merchant_nft: event.merchant_nft,
            amount_tbc: event.amount_tbc,
            block_number: event.block_number,
            tx_hash: event.tx_hash,
            timestamp: new Date(event.timestamp * 1000).toISOString(),
            payload_hash: event.payload_hash,
            on_chain_verified: true,
            verification_url: generateExplorerUrl(event.tx_hash),
            confirmations,
            is_final: isFinal,
          };

          invoice.status = 'settled';
          invoice.settlement = settlement;
          invoiceStore.set(invoiceId, invoice);

          break;
        }
      }
    }
  }

  /**
   * Clean up expired invoices and idempotency keys (periodic maintenance task)
   *
   * Should be called periodically (e.g., every hour) to remove expired invoices
   * and free up memory/storage.
   *
   * In production with Redis, idempotency keys would auto-expire via TTL.
   */
  async cleanupExpiredInvoices(): Promise<{ invoicesCleaned: number; idempotencyKeysCleaned: number }> {
    let invoicesCleaned = 0;
    let idempotencyKeysCleaned = 0;
    const now = Date.now();

    // Clean up expired idempotency keys (TTL-based)
    for (const [key, entry] of idempotencyStore.entries()) {
      if (entry.expiresAt < now) {
        idempotencyStore.delete(key);
        idempotencyKeysCleaned++;
      }
    }

    // Clean up expired invoices
    for (const [invoiceId, invoice] of invoiceStore.entries()) {
      if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
        invoice.status = 'expired';
        invoiceStore.set(invoiceId, invoice);
      }

      // Remove invoices that have been expired for >7 days
      if (invoice.status === 'expired') {
        const expiryDate = new Date(invoice.expires_at);
        const daysSinceExpiry = (now - expiryDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceExpiry > 7) {
          invoiceStore.delete(invoiceId);

          // Clean up idempotency store (belt-and-suspenders with TTL)
          const idempotencyKey = generateIdempotencyKey({
            merchant_nft: invoice.merchant_nft,
            amount_tbc: invoice.amount_tbc,
            currency: invoice.currency,
            metadata: invoice.metadata,
          });
          if (idempotencyStore.has(idempotencyKey)) {
            idempotencyStore.delete(idempotencyKey);
            idempotencyKeysCleaned++;
          }

          invoicesCleaned++;
        }
      }
    }

    return { invoicesCleaned, idempotencyKeysCleaned };
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();
