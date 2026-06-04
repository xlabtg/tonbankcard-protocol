/**
 * Redis Idempotency Storage — Production Stub
 *
 * This file provides a skeleton for a Redis-backed `IIdempotencyStorage`
 * implementation suitable for production use.
 *
 * Redis is the recommended choice for idempotency keys because:
 *  - Native key TTL — expired keys are evicted automatically, preventing
 *    unbounded memory growth.
 *  - Sub-millisecond latency — suitable for hot-path invoice creation.
 *  - Shared across all horizontal replicas — ensures idempotency is
 *    enforced globally, not just within a single process.
 *
 * ## Prerequisites
 *
 *   npm install ioredis @types/ioredis
 *
 * ## Setup steps
 *
 * 1. Set the following environment variables:
 *
 *   ```env
 *   REDIS_URL=redis://localhost:6379
 *   # For Redis Cluster:
 *   # REDIS_URL=redis://node1:6379,node2:6379,node3:6379
 *   ```
 *
 * 2. Instantiate and inject into InvoiceService:
 *
 *   ```typescript
 *   import Redis from 'ioredis';
 *   import { RedisIdempotencyStorage } from './storage/RedisIdempotencyStorage';
 *   import { PostgresInvoiceStorage }  from './storage/PostgresStorage';
 *   import { apiKeyService } from './services/ApiKeyService';
 *   import { InvoiceService }          from './services/InvoiceService';
 *   import { Pool } from 'pg';
 *
 *   const redis = new Redis(process.env.REDIS_URL);
 *   const pool  = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 *   const invoiceStorage     = new PostgresInvoiceStorage(pool);
 *   const idempotencyStorage = new RedisIdempotencyStorage(redis);
 *
 *   export const invoiceService = new InvoiceService(
 *     apiKeyService,
 *     invoiceStorage,
 *     idempotencyStorage,
 *   );
 *   ```
 *
 * ## Key format
 *
 *   `idempotency:<sha256-of-request-parameters>`
 *
 *   Values are stored as JSON: `{"invoiceId":"inv_...","expiresAt":<ms>}`
 *
 * @see IStorage.ts for the interface contract
 * @see PostgresStorage.ts for the invoice storage counterpart
 */

import { IIdempotencyStorage, IdempotencyRecord } from './IStorage';

/** Key prefix to namespace idempotency records within the Redis keyspace. */
const KEY_PREFIX = 'idempotency:';

/**
 * Minimal Redis interface compatible with ioredis-style command arguments,
 * without importing a concrete Redis client at compile time.
 */
interface RedisClientLike {
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    px: number,
    condition?: 'NX',
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

/**
 * Redis-backed idempotency storage.
 *
 * Keys are stored with a native Redis TTL (millisecond precision via PX) so
 * they expire automatically — no manual cleanup required.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * const redis   = new Redis(process.env.REDIS_URL);
 * const storage = new RedisIdempotencyStorage(redis);
 * ```
 */
export class RedisIdempotencyStorage implements IIdempotencyStorage {
  constructor(private readonly client: RedisClientLike) {}

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    const redisKey = KEY_PREFIX + key;
    const value = JSON.stringify(record);

    // Compute TTL in milliseconds, clamped to at least 1 ms.
    const ttlMs = Math.max(1, record.expiresAt - Date.now());

    // PX sets the expiry in milliseconds — native TTL, no cron needed.
    await this.client.set(redisKey, value, 'PX', ttlMs);
  }

  async setIfAbsent(
    key: string,
    record: IdempotencyRecord,
  ): Promise<IdempotencyRecord | undefined> {
    const redisKey = KEY_PREFIX + key;
    const value = JSON.stringify(record);
    const ttlMs = Math.max(1, record.expiresAt - Date.now());

    const result = await this.client.set(redisKey, value, 'PX', ttlMs, 'NX');
    if (result) {
      return undefined;
    }

    return this.get(key);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const raw = await this.client.get(KEY_PREFIX + key);

    if (!raw) {
      return undefined;
    }

    const record = JSON.parse(raw) as IdempotencyRecord;

    // Belt-and-suspenders: treat as absent if Redis somehow returned an
    // expired record (e.g., clock skew between app server and Redis).
    if (record.expiresAt < Date.now()) {
      return undefined;
    }

    return record;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(KEY_PREFIX + key);
  }
}
