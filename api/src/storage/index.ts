/**
 * Storage module public API
 *
 * Re-exports all storage interfaces and implementations so that consumers
 * can import from a single path:
 *
 * ```typescript
 * import {
 *   IInvoiceStorage,
 *   IIdempotencyStorage,
 *   InMemoryInvoiceStorage,
 *   InMemoryIdempotencyStorage,
 *   PostgresInvoiceStorage,
 *   RedisIdempotencyStorage,
 * } from '../storage';
 * ```
 */

export type { IInvoiceStorage, IIdempotencyStorage, IdempotencyRecord } from './IStorage';
export { InMemoryInvoiceStorage, InMemoryIdempotencyStorage } from './InMemoryStorage';
export { PostgresInvoiceStorage } from './PostgresStorage';
export { RedisIdempotencyStorage } from './RedisIdempotencyStorage';
