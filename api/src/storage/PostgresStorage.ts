/**
 * PostgreSQL Invoice Storage — Production Stub
 *
 * This file provides a skeleton for a PostgreSQL-backed `IInvoiceStorage`
 * implementation suitable for production use.
 *
 * ## Prerequisites
 *
 *   npm install pg @types/pg
 *
 * ## Setup steps
 *
 * 1. Create the invoices table (run once, or via a migration tool):
 *
 *   ```sql
 *   CREATE TABLE invoices (
 *     invoice_id   VARCHAR(32)  PRIMARY KEY,
 *     merchant_nft VARCHAR(64)  NOT NULL,
 *     amount_tbc   VARCHAR(40)  NOT NULL,
 *     currency     VARCHAR(8)   NOT NULL DEFAULT 'TBC',
 *     status       VARCHAR(16)  NOT NULL DEFAULT 'pending',
 *     metadata     JSONB,
 *     settlement   JSONB,
 *     created_at   TIMESTAMPTZ  NOT NULL,
 *     expires_at   TIMESTAMPTZ  NOT NULL,
 *     payment_url  TEXT         NOT NULL
 *   );
 *
 *   -- Indexes for common query patterns
 *   CREATE INDEX idx_invoices_status       ON invoices (status);
 *   CREATE INDEX idx_invoices_merchant_nft ON invoices (merchant_nft);
 *   CREATE INDEX idx_invoices_expires_at   ON invoices (expires_at);
 *   ```
 *
 * 2. Set the following environment variables before starting the server:
 *
 *   ```env
 *   POSTGRES_HOST=localhost
 *   POSTGRES_PORT=5432
 *   POSTGRES_DB=tonbankcard
 *   POSTGRES_USER=api_user
 *   POSTGRES_PASSWORD=<secret>
 *   POSTGRES_POOL_MIN=2
 *   POSTGRES_POOL_MAX=10
 *   ```
 *
 * 3. Instantiate and inject into InvoiceService:
 *
 *   ```typescript
 *   import { Pool } from 'pg';
 *   import { PostgresInvoiceStorage } from './storage/PostgresStorage';
 *   import { RedisIdempotencyStorage } from './storage/RedisIdempotencyStorage';
 *   import { InvoiceService } from './services/InvoiceService';
 *
 *   const pool = new Pool({
 *     host:     process.env.POSTGRES_HOST,
 *     port:     Number(process.env.POSTGRES_PORT ?? 5432),
 *     database: process.env.POSTGRES_DB,
 *     user:     process.env.POSTGRES_USER,
 *     password: process.env.POSTGRES_PASSWORD,
 *     min:      Number(process.env.POSTGRES_POOL_MIN ?? 2),
 *     max:      Number(process.env.POSTGRES_POOL_MAX ?? 10),
 *   });
 *
 *   const invoiceStorage     = new PostgresInvoiceStorage(pool);
 *   const idempotencyStorage = new RedisIdempotencyStorage(redisClient);
 *
 *   export const invoiceService = new InvoiceService(invoiceStorage, idempotencyStorage);
 *   ```
 *
 * @see IStorage.ts for the interface contract
 * @see RedisIdempotencyStorage.ts for the idempotency counterpart
 */

import { Invoice } from '../types/invoice';
import { IInvoiceStorage } from './IStorage';

/**
 * Minimal Pool interface — matches `pg.Pool` so you can pass `new Pool(config)`
 * directly without this file importing `pg` at compile time.
 */
interface PoolLike {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * PostgreSQL-backed invoice storage.
 *
 * All SQL operations are parameterised to prevent SQL injection.
 * Connection pooling is handled by the `Pool` instance passed in at construction.
 *
 * @example
 * ```typescript
 * import { Pool } from 'pg';
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const storage = new PostgresInvoiceStorage(pool);
 * ```
 */
export class PostgresInvoiceStorage implements IInvoiceStorage {
  constructor(private readonly pool: PoolLike) {}

  async set(invoice: Invoice): Promise<void> {
    await this.pool.query(
      `INSERT INTO invoices
         (invoice_id, merchant_nft, amount_tbc, currency, status,
          metadata, settlement, created_at, expires_at, payment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (invoice_id) DO UPDATE SET
         status     = EXCLUDED.status,
         metadata   = EXCLUDED.metadata,
         settlement = EXCLUDED.settlement`,
      [
        invoice.invoice_id,
        invoice.merchant_nft,
        invoice.amount_tbc,
        invoice.currency,
        invoice.status,
        invoice.metadata   ? JSON.stringify(invoice.metadata)   : null,
        invoice.settlement ? JSON.stringify(invoice.settlement) : null,
        invoice.created_at,
        invoice.expires_at,
        invoice.payment_url,
      ]
    );
  }

  async get(invoiceId: string): Promise<Invoice | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM invoices WHERE invoice_id = $1`,
      [invoiceId]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.rowToInvoice(result.rows[0]);
  }

  async delete(invoiceId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM invoices WHERE invoice_id = $1`,
      [invoiceId]
    );
  }

  async entries(): Promise<Iterable<[string, Invoice]>> {
    const result = await this.pool.query(`SELECT * FROM invoices`);
    const pairs: [string, Invoice][] = result.rows.map(row => {
      const invoice = this.rowToInvoice(row);
      return [invoice.invoice_id, invoice];
    });
    return pairs;
  }

  /** Map a raw database row to an `Invoice` object. */
  private rowToInvoice(row: Record<string, unknown>): Invoice {
    return {
      invoice_id:  row['invoice_id']  as string,
      merchant_nft: row['merchant_nft'] as string,
      amount_tbc:  row['amount_tbc']  as string,
      currency:    'TBC',
      status:      row['status']      as Invoice['status'],
      metadata:    parseJsonbColumn(row['metadata'])   as Invoice['metadata'],
      settlement:  parseJsonbColumn(row['settlement']) as Invoice['settlement'],
      created_at:  toIsoString(row['created_at']),
      expires_at:  toIsoString(row['expires_at']),
      payment_url: row['payment_url'] as string,
    };
  }
}

/**
 * Read a `jsonb`/`json` column value. The `pg` driver already deserialises
 * `jsonb` columns into JavaScript values, so calling `JSON.parse` on them would
 * coerce the object to the string `"[object Object]"` and throw. We therefore
 * return objects as-is and only `JSON.parse` the legacy case where a column was
 * stored as raw `text`.
 */
function parseJsonbColumn(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    // Legacy/text storage — parse to an object.
    return JSON.parse(value);
  }
  // Already-parsed jsonb object/array.
  return value;
}

/**
 * Normalise a `timestamptz` column to an ISO-8601 string. The `pg` driver
 * returns `timestamptz` as a JavaScript `Date`, but the in-memory backend and
 * the API surface use ISO strings, so we convert to keep both backends
 * consistent.
 */
function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value as string;
}
