import { describe, it, expect } from '@jest/globals';
import { InMemorySecureStore } from '../../src/lib/secure/secureStore';

describe('InMemorySecureStore', () => {
  it('returns null for missing keys', async () => {
    const store = new InMemorySecureStore();
    expect(await store.get('missing')).toBeNull();
  });

  it('round-trips set → get → delete', async () => {
    const store = new InMemorySecureStore();
    await store.set('k', 'v');
    expect(await store.get('k')).toBe('v');
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
    expect(store.size).toBe(0);
  });

  it('overwrites existing keys', async () => {
    const store = new InMemorySecureStore();
    await store.set('k', 'old');
    await store.set('k', 'new');
    expect(await store.get('k')).toBe('new');
    expect(store.size).toBe(1);
  });

  it('delete on a missing key is a no-op', async () => {
    const store = new InMemorySecureStore();
    await expect(store.delete('absent')).resolves.toBeUndefined();
  });
});
