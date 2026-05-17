/**
 * In-memory implementation of SecureKeyValueStore for testing and SSR.
 *
 * Production builds inject a Keychain/Keystore-backed implementation through
 * dependency injection (see `src/screens` wiring). This implementation is
 * deliberately ephemeral so it cannot leak data across processes.
 */

import type { SecureKeyValueStore } from './interfaces';

export class InMemorySecureStore implements SecureKeyValueStore {
  private readonly entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}
