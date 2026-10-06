import { Pool } from 'pg';
import Redis from 'ioredis';
import { InvoiceService, invoiceService } from '../services/InvoiceService';
import { ApiKeyService, apiKeyService } from '../services/ApiKeyService';
import { PostgresInvoiceStorage } from './PostgresStorage';
import { PostgresApiKeyStorage } from './PostgresApiKeyStorage';
import { RedisIdempotencyStorage } from './RedisIdempotencyStorage';

/** Establish shared stores before accepting traffic; no process-local production fallback. */
export async function configureProductionStorage(
  invoices: InvoiceService = invoiceService,
  keys: ApiKeyService = apiKeyService,
  env: NodeJS.ProcessEnv = process.env,
  connect = (databaseUrl: string, redisUrl: string) => ({
    pool: new Pool({connectionString:databaseUrl}),
    redis: new Redis(redisUrl, {lazyConnect:true, maxRetriesPerRequest:2}),
  }),
): Promise<{close(): Promise<void>} | undefined> {
  if (env.NODE_ENV !== 'production') return undefined;
  if (!env.DATABASE_URL || !env.REDIS_URL) throw new Error('Production requires DATABASE_URL and REDIS_URL');
  const {pool,redis} = connect(env.DATABASE_URL, env.REDIS_URL);
  try {
    await pool.query('SELECT 1');
    await redis.connect();
    await redis.ping();
    // Schema is managed by migrations; missing tables fail before listen.
    await pool.query('SELECT invoice_id FROM invoices LIMIT 0');
    await pool.query('SELECT key_hash FROM api_keys LIMIT 0');
    invoices.configureStorage(new PostgresInvoiceStorage(pool),new RedisIdempotencyStorage(redis));
    keys.configureStorage(new PostgresApiKeyStorage(pool));
    return {close:async () => { await redis.quit(); await pool.end(); }};
  } catch (error) {
    redis.disconnect();
    await pool.end();
    throw error;
  }
}
