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
  PublicInvoiceView,
  InvoiceStatus,
  Settlement,
  ErrorCode,
  CONSTANTS,
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

import { ApiKeyService, apiKeyService } from './ApiKeyService';

import { resolveSettlementIndexerSecret } from '../config/secrets';

import {
  SettlementEvent,
  verifySettlementAttestation,
} from '../utils/settlementAttestation';

import { IInvoiceStorage, IIdempotencyStorage } from '../storage/IStorage';

import {
  InMemoryInvoiceStorage,
  InMemoryIdempotencyStorage,
} from '../storage/InMemoryStorage';

/** Default TTL for idempotency keys (24 hours in milliseconds) */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Options accepted by {@link InvoiceService.processSettlementEvent}.
 */
export interface ProcessSettlementOptions {
  /**
   * Attestation proving the event came from the trusted, authenticated indexer
   * (HMAC of the canonical event under `SETTLEMENT_INDEXER_SECRET`). Required:
   * an event without a valid attestation is rejected so a forged event cannot
   * flip an invoice to `settled` (audit finding API-H3).
   *
   * @see api/src/utils/settlementAttestation.ts
   */
  attestation?: string;

  /**
   * Current chain head block number, used to compute confirmations. Required
   * for finality: without it confirmations are unknown and the invoice is NOT
   * marked settled.
   */
  currentBlockNumber?: number;

  /**
   * Override the indexer secret used to verify the attestation. Defaults to the
   * validated `SETTLEMENT_INDEXER_SECRET`. Primarily an injection point for
   * tests.
   */
  indexerSecret?: string;
}

/** Machine-readable reason a settlement event did not settle an invoice. */
export type SettlementRejectionReason =
  /** Event lacked a valid trusted-indexer attestation. */
  | 'untrusted_source'
  /** Confirmations were absent or below `MIN_CONFIRMATIONS` (not yet final). */
  | 'insufficient_confirmations'
  /** No pending invoice matched the event. */
  | 'no_matching_invoice';

/**
 * Outcome of {@link InvoiceService.processSettlementEvent}.
 *
 * `settled` is `true` only when an invoice was transitioned to `settled` with a
 * final, on-chain-verified settlement. Otherwise `reason` explains why not.
 */
export interface ProcessSettlementResult {
  settled: boolean;
  reason?: SettlementRejectionReason;
  /** The settled invoice's id, present only when `settled === true`. */
  invoiceId?: string;
}

/**
 * Invoice Service
 * Handles all invoice-related operations.
 *
 * ## Storage injection
 *
 * The service accepts any implementations of `IInvoiceStorage` and
 * `IIdempotencyStorage` at construction time, enabling drop-in replacement
 * of the default in-memory stores with production-grade backends.
 *
 * ```typescript
 * // Development / tests (default — in-memory)
 * const service = new InvoiceService();
 *
 * // Production (PostgreSQL + Redis)
 * import { Pool } from 'pg';
 * import Redis from 'ioredis';
 * import { apiKeyService } from './ApiKeyService';
 * import { PostgresInvoiceStorage }    from '../storage/PostgresStorage';
 * import { RedisIdempotencyStorage }   from '../storage/RedisIdempotencyStorage';
 *
 * const pool  = new Pool({ connectionString: process.env.DATABASE_URL });
 * const redis = new Redis(process.env.REDIS_URL);
 *
 * const service = new InvoiceService(
 *   apiKeyService,
 *   new PostgresInvoiceStorage(pool),
 *   new RedisIdempotencyStorage(redis),
 * );
 * ```
 */
export class InvoiceService {
  private readonly apiKeyService: ApiKeyService;
  private readonly invoiceStorage: IInvoiceStorage;
  private readonly idempotencyStorage: IIdempotencyStorage;

  /**
   * @param keyService         - API key service for merchant authorization.
   *   Defaults to the module-level singleton.
   * @param invoiceStorage     - Persistent store for invoices.
   *   Defaults to `InMemoryInvoiceStorage` (⚠️ not for production).
   * @param idempotencyStorage - Persistent store for idempotency keys.
   *   Defaults to `InMemoryIdempotencyStorage` (⚠️ not for production).
   */
  constructor(
    keyService: ApiKeyService = apiKeyService,
    invoiceStorage: IInvoiceStorage = new InMemoryInvoiceStorage(),
    idempotencyStorage: IIdempotencyStorage = new InMemoryIdempotencyStorage(),
  ) {
    this.apiKeyService = keyService;
    this.invoiceStorage = invoiceStorage;
    this.idempotencyStorage = idempotencyStorage;
  }

  /**
   * Fail fast when a production boot still points at reference-only storage.
   *
   * Tests and local development may use the in-memory adapters. A production
   * process must inject durable invoice storage and an atomic shared
   * idempotency backend before it starts accepting requests.
   */
  assertProductionStorageConfigured(
    env: NodeJS.ProcessEnv = process.env,
  ): void {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    if (
      this.invoiceStorage instanceof InMemoryInvoiceStorage ||
      this.idempotencyStorage instanceof InMemoryIdempotencyStorage
    ) {
      throw new Error(
        'Persistent invoice and idempotency storage are required in production',
      );
    }
  }

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
    merchantApiKey: string,
  ): Promise<Invoice> {
    // Validate inputs
    this.validateCreateInvoiceRequest(request);

    // Verify the API key is authorised for the requested merchant NFT.
    // This prevents any API key holder from creating invoices on behalf of
    // a merchant they are not linked to (UNAUTHORIZED_MERCHANT protection).
    if (
      !this.apiKeyService.isAuthorizedMerchant(
        merchantApiKey,
        request.merchant_nft,
      )
    ) {
      // Audit-log cross-merchant attempts so operators can detect misuse.
      console.warn(
        `[AUDIT] Unauthorized invoice creation attempt: ` +
          `merchant_nft="${request.merchant_nft}" ` +
          `api_key_prefix="${merchantApiKey.slice(0, 12)}…" ` +
          `timestamp="${new Date().toISOString()}"`,
      );
      throw new ValidationError(
        ErrorCode.UNAUTHORIZED_MERCHANT,
        'API key not authorized for this merchant NFT',
      );
    }

    // Check idempotency (with TTL support).
    //
    // The key is scoped to the authenticated API key (`key_id`) and includes
    // the requested `expires_at`, so that:
    //   - two different keys never share an idempotency namespace, and
    //   - two otherwise-identical creates with different expiries do NOT
    //     collide (which previously returned the first invoice with a stale
    //     expiry — audit finding API-M2).
    // `getKeyId` resolves the public identifier without exposing the plaintext
    // key; it is defined here because authorization above already succeeded.
    const keyId = this.apiKeyService.getKeyId(merchantApiKey);
    const idempotencyKey = generateIdempotencyKey(request, keyId);
    const existingEntry = await this.idempotencyStorage.get(idempotencyKey);

    if (existingEntry) {
      const existingInvoice = await this.invoiceStorage.get(
        existingEntry.invoiceId,
      );

      // Return existing invoice if not expired
      if (existingInvoice && !isExpired(existingInvoice.expires_at)) {
        return existingInvoice;
      }

      // Clean up stale references
      if (existingInvoice) {
        await this.idempotencyStorage.delete(idempotencyKey);
        await this.invoiceStorage.delete(existingEntry.invoiceId);
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
      expires_at: expiresAt,
      payment_url: generatePaymentUrl(invoiceId),
      settlement: undefined,
    };

    // Store the candidate invoice before publishing the idempotency record.
    // If another concurrent request wins `setIfAbsent`, this candidate is
    // deleted below and the winning invoice is returned instead.
    await this.invoiceStorage.set(invoice);

    // Atomically publish the idempotency key with TTL. This closes the
    // check-then-set race where concurrent identical creates could each return
    // a distinct invoice before the final idempotency write overwrote the map.
    const expiresAtMs = new Date(invoice.expires_at).getTime();
    const existingRecord = await this.idempotencyStorage.setIfAbsent(
      idempotencyKey,
      {
        invoiceId,
        expiresAt: Math.max(expiresAtMs, Date.now() + IDEMPOTENCY_TTL_MS),
      },
    );

    if (existingRecord) {
      await this.invoiceStorage.delete(invoiceId);

      const existingInvoice = await this.invoiceStorage.get(
        existingRecord.invoiceId,
      );
      if (existingInvoice && !isExpired(existingInvoice.expires_at)) {
        return existingInvoice;
      }

      // Defensive stale cleanup. `setIfAbsent` treats expired idempotency
      // records as absent, but the referenced invoice may have expired while
      // the record is still within its retention window.
      await this.idempotencyStorage.delete(idempotencyKey);
      if (existingInvoice) {
        await this.invoiceStorage.delete(existingRecord.invoiceId);
      }
      return this.createInvoice(request, merchantApiKey);
    }

    return invoice;
  }

  /**
   * Get the full invoice by ID (internal / authenticated use).
   *
   * Returns the complete `Invoice`, including `merchant_nft`, `metadata`,
   * and `settlement`. Because this exposes merchant identity and any
   * customer PII embedded in metadata, callers MUST NOT hand the result to
   * unauthenticated clients — use {@link getPublicInvoice} for the
   * payer-facing endpoint and {@link getInvoiceDetail} for the
   * authenticated merchant view.
   *
   * @param invoiceId - Invoice ID
   * @returns Full invoice details
   * @throws ValidationError if invoice not found or invalid
   */
  async getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
    validateInvoiceId(invoiceId);

    const invoice = await this.invoiceStorage.get(invoiceId);

    if (!invoice) {
      throw new ValidationError(
        ErrorCode.INVOICE_NOT_FOUND,
        'Invoice not found',
        { invoice_id: invoiceId },
      );
    }

    // Check if expired
    if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
      invoice.status = 'expired';
      await this.invoiceStorage.set(invoice);
    }

    return invoice;
  }

  /**
   * Get the public, payer-facing view of an invoice.
   *
   * This is the method backing the unauthenticated
   * `GET /v1/invoice/:invoice_id` endpoint. It returns only the fields a
   * payer needs to settle the invoice and strips merchant identity
   * (`merchant_nft`), arbitrary `metadata` (which may contain customer PII
   * such as `customer_email` / `order_id`), and `settlement` details.
   *
   * @param invoiceId - Invoice ID
   * @returns Payer-facing invoice view (no merchant data or PII)
   * @throws ValidationError if invoice not found or invalid
   * @see https://github.com/xlabtg/tonbankcard-protocol/issues/253
   */
  async getPublicInvoice(invoiceId: string): Promise<PublicInvoiceView> {
    const invoice = await this.getInvoice(invoiceId);
    return InvoiceService.toPublicView(invoice);
  }

  /**
   * Get the full invoice detail for an authenticated merchant.
   *
   * Unlike {@link getPublicInvoice}, this returns the complete invoice
   * (merchant identity, metadata, settlement). The presented API key must
   * be valid, active, and bound to the invoice's `merchant_nft`; otherwise
   * an `UNAUTHORIZED_MERCHANT` error is thrown so one merchant cannot read
   * another merchant's invoices.
   *
   * @param invoiceId      - Invoice ID
   * @param merchantApiKey - Plaintext merchant API key (for authorization)
   * @returns Full invoice details
   * @throws ValidationError if invoice not found or the key is not
   *   authorized for the invoice's merchant
   */
  async getInvoiceDetail(
    invoiceId: string,
    merchantApiKey: string,
  ): Promise<GetInvoiceResponse> {
    const invoice = await this.getInvoice(invoiceId);

    if (
      !this.apiKeyService.isAuthorizedMerchant(
        merchantApiKey,
        invoice.merchant_nft,
      )
    ) {
      throw new ValidationError(
        ErrorCode.UNAUTHORIZED_MERCHANT,
        'API key not authorized for this invoice',
      );
    }

    return invoice;
  }

  /**
   * Map a full `Invoice` to its public, payer-facing projection.
   *
   * Centralised here so the field allowlist lives in one place: adding a
   * sensitive field to `Invoice` will not accidentally leak through the
   * public endpoint because it must be explicitly added here too.
   */
  private static toPublicView(invoice: Invoice): PublicInvoiceView {
    return {
      invoice_id: invoice.invoice_id,
      amount_tbc: invoice.amount_tbc,
      currency: invoice.currency,
      status: invoice.status,
      created_at: invoice.created_at,
      expires_at: invoice.expires_at,
      payment_url: invoice.payment_url,
    };
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
    merchantApiKey: string,
  ): Promise<GetInvoiceStatusResponse> {
    // TODO: In production, validate merchantApiKey
    // if (!this.isValidApiKey(merchantApiKey)) {
    //   throw new ValidationError(
    //     ErrorCode.INVALID_API_KEY,
    //     'Invalid API key'
    //   );
    // }

    validateInvoiceId(invoiceId);

    const invoice = await this.invoiceStorage.get(invoiceId);

    if (!invoice) {
      throw new ValidationError(
        ErrorCode.INVOICE_NOT_FOUND,
        'Invoice not found',
        { invoice_id: invoiceId },
      );
    }

    // Check if expired
    if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
      invoice.status = 'expired';
      await this.invoiceStorage.set(invoice);
    }

    // TODO: In production, verify settlement on-chain
    // const settlement = await this.verifySettlementOnChain(invoice);
    // if (settlement) {
    //   invoice.status = 'settled';
    //   invoice.settlement = settlement;
    //   await this.invoiceStorage.set(invoice);
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
        'Request body is required',
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
        { currency: request.currency },
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
  private async verifySettlementOnChain(
    invoice: Invoice,
  ): Promise<Settlement | undefined> {
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
   * Process an on-chain settlement event reported by the blockchain indexer.
   *
   * Settlement state is owned by the blockchain — the API is informational only
   * (see `index.ts`). This method therefore enforces two guards before it will
   * ever mark an invoice `settled`, closing audit finding API-H3:
   *
   * 1. **Trusted source.** The event MUST carry a valid attestation proving it
   *    came from the authenticated indexer (HMAC over the canonical event under
   *    `SETTLEMENT_INDEXER_SECRET`). A forged or unauthenticated event is
   *    rejected with `UNTRUSTED_SETTLEMENT_SOURCE` and never mutates an invoice.
   *
   * 2. **Finality.** The invoice is marked `settled` only when the event has
   *    `confirmations >= MIN_CONFIRMATIONS` (i.e. `is_final === true`). An event
   *    with absent or insufficient confirmations leaves the invoice `pending` —
   *    the API never presents a premature settlement as authoritative.
   *
   * @param event   - MerchantPayment event observed on-chain by the indexer
   * @param options - Trusted-source attestation, current block, and overrides
   * @returns Structured outcome describing whether (and why not) it settled
   * @throws {ValidationError} `UNTRUSTED_SETTLEMENT_SOURCE` when the attestation
   *         is missing or invalid.
   */
  async processSettlementEvent(
    event: SettlementEvent,
    options: ProcessSettlementOptions = {},
  ): Promise<ProcessSettlementResult> {
    const { attestation, currentBlockNumber } = options;

    // Guard 1: reject events that do not originate from the trusted indexer.
    // Without this, any caller able to reach the API could forge a settlement.
    const indexerSecret =
      options.indexerSecret ?? resolveSettlementIndexerSecret();
    if (!verifySettlementAttestation(indexerSecret, event, attestation)) {
      console.warn(
        `[AUDIT] Rejected settlement event from untrusted source: ` +
          `merchant_nft="${event.merchant_nft}" ` +
          `tx_hash="${event.tx_hash}" ` +
          `timestamp="${new Date().toISOString()}"`,
      );
      throw new ValidationError(
        ErrorCode.UNTRUSTED_SETTLEMENT_SOURCE,
        'Settlement event is not attested by the trusted indexer',
      );
    }

    // Guard 2: confirmations must be known and meet the finality threshold.
    // confirmations / is_final are undefined when the current block is unknown,
    // which is treated as "not final" — never settled.
    const confirmations =
      currentBlockNumber !== undefined
        ? currentBlockNumber - event.block_number
        : undefined;
    const isFinal =
      confirmations !== undefined &&
      confirmations >= CONSTANTS.MIN_CONFIRMATIONS;

    if (!isFinal) {
      return { settled: false, reason: 'insufficient_confirmations' };
    }

    // Find matching invoice by merchant NFT, amount, and payload hash.
    // In production the invoice_id would be extracted from the payload; the
    // reference implementation iterates the pending invoices.
    for (const [, invoice] of await this.invoiceStorage.entries()) {
      if (invoice.status !== 'pending') {
        continue;
      }

      if (
        invoice.merchant_nft !== event.merchant_nft ||
        invoice.amount_tbc !== event.amount_tbc
      ) {
        continue;
      }

      const expectedHash = hashMetadata({
        invoice_id: invoice.invoice_id,
        ...invoice.metadata,
      });

      if (expectedHash !== event.payload_hash) {
        continue;
      }

      // Settlement matched and final — record the on-chain-verified proof.
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
        is_final: true,
      };

      invoice.status = 'settled';
      invoice.settlement = settlement;
      await this.invoiceStorage.set(invoice);

      return { settled: true, invoiceId: invoice.invoice_id };
    }

    return { settled: false, reason: 'no_matching_invoice' };
  }

  /**
   * Clean up expired invoices and idempotency keys (periodic maintenance task)
   *
   * Should be called periodically (e.g., every hour) to remove expired invoices
   * and free up memory/storage.
   *
   * In production with Redis, idempotency keys are expired automatically via TTL,
   * so idempotency cleanup here is belt-and-suspenders only.
   */
  async cleanupExpiredInvoices(): Promise<{
    invoicesCleaned: number;
    idempotencyKeysCleaned: number;
  }> {
    let invoicesCleaned = 0;
    let idempotencyKeysCleaned = 0;
    const now = Date.now();

    // Clean up expired invoices
    for (const [invoiceId, invoice] of await this.invoiceStorage.entries()) {
      if (isExpired(invoice.expires_at) && invoice.status === 'pending') {
        invoice.status = 'expired';
        await this.invoiceStorage.set(invoice);
      }

      // Remove invoices that have been expired for >7 days
      if (invoice.status === 'expired') {
        const expiryDate = new Date(invoice.expires_at);
        const daysSinceExpiry =
          (now - expiryDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceExpiry > 7) {
          await this.invoiceStorage.delete(invoiceId);
          invoicesCleaned++;
        }
      }
    }

    // Clean up idempotency records that point to invoices which no longer
    // exist (belt-and-suspenders; Redis TTL handles this automatically).
    //
    // We sweep by stored invoiceId rather than reconstructing the key from the
    // invoice: the idempotency key is now scoped to the API key (`key_id`) and
    // the requested `expires_at`, neither of which can be derived from a stored
    // invoice alone. Backends without enumeration support (e.g. Redis, which
    // expires keys natively) simply skip this pass.
    if (this.idempotencyStorage.entries) {
      for (const [key, record] of await this.idempotencyStorage.entries()) {
        const invoice = await this.invoiceStorage.get(record.invoiceId);
        if (!invoice) {
          await this.idempotencyStorage.delete(key);
          idempotencyKeysCleaned++;
        }
      }
    }

    return { invoicesCleaned, idempotencyKeysCleaned };
  }
}

// Export singleton instance using in-memory storage (reference/development default).
// ⚠️  For production, construct InvoiceService with PostgresStorage + RedisIdempotencyStorage
//    and export that instance instead — see class JSDoc above for an example.
export const invoiceService = new InvoiceService();
