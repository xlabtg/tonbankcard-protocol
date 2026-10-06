import { ApiKey } from '../types/invoice';
import { ApiKeyStore } from '../services/ApiKeyService';
export interface KeyPool { query(sql: string, args?: unknown[]): Promise<{rows: Record<string, unknown>[]}>; }
export class PostgresApiKeyStorage implements ApiKeyStore {
  constructor(private readonly pool: KeyPool) {}
  async get(hash: string): Promise<ApiKey | undefined> {
    const result = await this.pool.query('SELECT record FROM api_keys WHERE key_hash = $1', [hash]);
    return result.rows[0]?.record as ApiKey | undefined;
  }
  async set(key: ApiKey): Promise<void> {
    await this.pool.query(`INSERT INTO api_keys (key_hash,key_id,record) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT (key_hash) DO UPDATE SET key_id=EXCLUDED.key_id, record=EXCLUDED.record`,
    [key.key_hash,key.key_id,JSON.stringify(key)]);
  }
  async findById(id: string): Promise<ApiKey | undefined> {
    const result = await this.pool.query('SELECT record FROM api_keys WHERE key_id = $1', [id]);
    return result.rows[0]?.record as ApiKey | undefined;
  }
  async revoke(id: string): Promise<boolean> {
    const result = await this.pool.query(`UPDATE api_keys SET record = jsonb_set(record,'{is_active}','false')
      WHERE key_id = $1 RETURNING key_id`, [id]);
    return result.rows.length > 0;
  }
  async touch(hash: string): Promise<void> {
    await this.pool.query(`UPDATE api_keys SET record = jsonb_set(record,'{last_used_at}',to_jsonb($2::text)) WHERE key_hash = $1`,
      [hash,new Date().toISOString()]);
  }
}
