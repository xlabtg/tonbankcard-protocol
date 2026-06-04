import { describe, expect, it } from '@jest/globals';
import { RedisIdempotencyStorage } from '../src/storage/RedisIdempotencyStorage';
import { IdempotencyRecord } from '../src/storage/IStorage';

class FakeRedisClient {
  readonly setCalls: Array<[string, string, 'PX', number, 'NX' | undefined]> =
    [];

  private readonly store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async set(
    key: string,
    value: string,
    expiryMode: 'PX',
    px: number,
    condition?: 'NX',
  ): Promise<'OK' | null> {
    this.setCalls.push([key, value, expiryMode, px, condition]);
    this.expireIfNeeded(key);

    if (condition === 'NX' && this.store.has(key)) {
      return null;
    }

    this.store.set(key, { value, expiresAt: Date.now() + px });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    this.expireIfNeeded(key);
    return this.store.get(key)?.value ?? null;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  private expireIfNeeded(key: string): void {
    const record = this.store.get(key);
    if (record && record.expiresAt < Date.now()) {
      this.store.delete(key);
    }
  }
}

describe('RedisIdempotencyStorage', () => {
  it('stores records with a Redis PX TTL', async () => {
    const redis = new FakeRedisClient();
    const storage = new RedisIdempotencyStorage(redis);
    const record: IdempotencyRecord = {
      invoiceId: 'inv_aaaaaaaaaaaaaaaa',
      expiresAt: Date.now() + 60_000,
    };

    await storage.set('merchant:create:one', record);

    expect(redis.setCalls[0][0]).toBe('idempotency:merchant:create:one');
    expect(redis.setCalls[0][2]).toBe('PX');
    expect(redis.setCalls[0][3]).toBeGreaterThan(0);
    await expect(storage.get('merchant:create:one')).resolves.toEqual(record);
  });

  it('uses NX on setIfAbsent and returns the existing active record on collision', async () => {
    const redis = new FakeRedisClient();
    const storage = new RedisIdempotencyStorage(redis);
    const first: IdempotencyRecord = {
      invoiceId: 'inv_first___________',
      expiresAt: Date.now() + 60_000,
    };
    const duplicate: IdempotencyRecord = {
      invoiceId: 'inv_duplicate_______',
      expiresAt: Date.now() + 60_000,
    };

    await expect(
      storage.setIfAbsent('merchant:create:one', first),
    ).resolves.toBeUndefined();
    await expect(
      storage.setIfAbsent('merchant:create:one', duplicate),
    ).resolves.toEqual(first);

    expect(redis.setCalls[0][4]).toBe('NX');
    expect(redis.setCalls[1][4]).toBe('NX');
    await expect(storage.get('merchant:create:one')).resolves.toEqual(first);
  });
});
