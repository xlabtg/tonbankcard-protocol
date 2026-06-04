/**
 * Storage Interfaces
 *
 * Abstractions over persistent storage for invoices and idempotency keys.
 *
 * This module decouples the InvoiceService from any concrete storage
 * implementation, enabling the service to run against:
 *
 *  - In-memory Maps (default, reference/test only)
 *  - PostgreSQL (recommended for production invoice storage)
 *  - MongoDB (alternative for production invoice storage)
 *  - Redis (recommended for idempotency keys with automatic TTL)
 *
 * ## Production migration guide
 *
 * 1. Implement `IInvoiceStorage` using your preferred database client.
 * 2. Implement `IIdempotencyStorage` using Redis (recommended) or your DB.
 * 3. Pass both implementations to `new InvoiceService(invoiceStorage, idempotencyStorage)`.
 * 4. Update `invoiceService` export in `InvoiceService.ts` accordingly.
 *
 * @see InMemoryStorage.ts for reference implementation
 * @see PostgresStorage.ts for PostgreSQL stub
 * @see RedisIdempotencyStorage.ts for Redis stub
 */

import { Invoice } from '../types/invoice';

/**
 * Idempotency record stored alongside invoices to prevent duplicate creation.
 */
export interface IdempotencyRecord {
  /** ID of the invoice this key maps to */
  invoiceId: string;

  /**
   * Expiry timestamp in milliseconds (Unix epoch).
   * After this time, the record may be discarded and re-used.
   */
  expiresAt: number;
}

/**
 * Persistent storage for invoices.
 *
 * Implementations MUST guarantee:
 *  - Durability: data survives process restarts
 *  - Consistency: concurrent reads/writes produce correct results
 *
 * All methods return Promises so that implementations may perform
 * asynchronous I/O without blocking the event loop.
 */
export interface IInvoiceStorage {
  /**
   * Persist a new invoice or overwrite an existing one with the same ID.
   *
   * @param invoice - Invoice to store
   */
  set(invoice: Invoice): Promise<void>;

  /**
   * Retrieve an invoice by its ID.
   *
   * @param invoiceId - Invoice ID
   * @returns The invoice, or `undefined` if not found
   */
  get(invoiceId: string): Promise<Invoice | undefined>;

  /**
   * Delete an invoice by its ID.
   *
   * @param invoiceId - Invoice ID
   */
  delete(invoiceId: string): Promise<void>;

  /**
   * Iterate over all invoices.
   *
   * The order of iteration is unspecified.
   * This method is used primarily by cleanup tasks and settlement matching.
   */
  entries(): Promise<Iterable<[string, Invoice]>>;
}

/**
 * Persistent storage for idempotency keys.
 *
 * In production, use Redis with native TTL support so that expired keys
 * are automatically evicted without a manual cleanup pass.
 *
 * Implementations MUST guarantee:
 *  - Atomic check-and-set semantics
 *  - TTL-based expiration (either native or emulated)
 */
export interface IIdempotencyStorage {
  /**
   * Persist an idempotency record.
   *
   * If a record already exists for the given key it MUST be overwritten.
   *
   * @param key - Idempotency key (SHA-256 hash of request parameters)
   * @param record - Record to store
   */
  set(key: string, record: IdempotencyRecord): Promise<void>;

  /**
   * Atomically persist an idempotency record only when no active record exists.
   *
   * Expired records MUST be treated as absent. When an active record already
   * exists, the implementation MUST leave it unchanged and return that existing
   * record to the caller. This is the operation used on the invoice-create hot
   * path so concurrent identical requests converge on one invoice.
   *
   * @param key - Idempotency key (SHA-256 hash of request parameters)
   * @param record - Candidate record to store
   * @returns The pre-existing active record, or `undefined` when `record` won
   */
  setIfAbsent(
    key: string,
    record: IdempotencyRecord,
  ): Promise<IdempotencyRecord | undefined>;

  /**
   * Retrieve an idempotency record.
   *
   * @param key - Idempotency key
   * @returns The record, or `undefined` if not found / already expired
   */
  get(key: string): Promise<IdempotencyRecord | undefined>;

  /**
   * Delete an idempotency record.
   *
   * @param key - Idempotency key
   */
  delete(key: string): Promise<void>;

  /**
   * Iterate over all idempotency records (key → record).
   *
   * OPTIONAL. The order of iteration is unspecified. Used by the
   * `InvoiceService.cleanupExpiredInvoices` maintenance task to evict records
   * that point to invoices which no longer exist — without relying on the
   * idempotency-key derivation formula (which is scoped to the API key and the
   * requested expiry and therefore cannot be reconstructed from a stored
   * invoice alone).
   *
   * Backends with native TTL (e.g. Redis) expire records automatically and may
   * omit this method; the cleanup task simply skips the idempotency sweep when
   * it is absent.
   */
  entries?(): Promise<Iterable<[string, IdempotencyRecord]>>;
}
