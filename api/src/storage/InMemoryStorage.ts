/**
 * In-Memory Storage Implementation
 *
 * ⚠️  PRODUCTION WARNING
 * ─────────────────────────────────────────────────────────────────────────────
 * This implementation stores all data in process-local JavaScript Maps.
 *
 * It is suitable ONLY for:
 *  - Local development
 *  - Unit / integration tests
 *  - The reference implementation walkthrough
 *
 * It MUST NOT be used in production because:
 *  - All data is lost on every process restart or crash
 *  - Each horizontal replica maintains independent state (no shared storage)
 *  - Unbounded memory growth under sustained load can cause OOM crashes
 *  - Violates durability requirements for financial data (no ACID guarantees)
 *
 * For production, replace with:
 *  - PostgresStorage (see PostgresStorage.ts) for invoice persistence
 *  - RedisIdempotencyStorage (see RedisIdempotencyStorage.ts) for idempotency keys
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Invoice } from '../types/invoice';
import {
  IInvoiceStorage,
  IIdempotencyStorage,
  IdempotencyRecord,
} from './IStorage';

/**
 * In-memory invoice storage.
 *
 * Thread-safety: JavaScript is single-threaded so no locking is required.
 * This does NOT hold for multi-process deployments (use a shared database instead).
 */
export class InMemoryInvoiceStorage implements IInvoiceStorage {
  /** @internal */
  private readonly store = new Map<string, Invoice>();

  async set(invoice: Invoice): Promise<void> {
    this.store.set(invoice.invoice_id, invoice);
  }

  async get(invoiceId: string): Promise<Invoice | undefined> {
    return this.store.get(invoiceId);
  }

  async delete(invoiceId: string): Promise<void> {
    this.store.delete(invoiceId);
  }

  async entries(): Promise<Iterable<[string, Invoice]>> {
    return this.store.entries();
  }
}

/**
 * In-memory idempotency storage.
 *
 * Unlike Redis, this implementation does not expire keys automatically.
 * Expired records are pruned lazily on `get` and eagerly by the
 * `InvoiceService.cleanupExpiredInvoices` maintenance task.
 *
 * ⚠️  Use `RedisIdempotencyStorage` in production to get native TTL.
 */
export class InMemoryIdempotencyStorage implements IIdempotencyStorage {
  /** @internal */
  private readonly store = new Map<string, IdempotencyRecord>();

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    this.store.set(key, record);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const record = this.store.get(key);

    if (!record) {
      return undefined;
    }

    // Lazy TTL enforcement: treat expired records as absent
    if (record.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return record;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
