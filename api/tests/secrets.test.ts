/**
 * API_KEY_SECRET configuration tests (audit finding API-H1, issue #250).
 *
 * Verifies that the HMAC secret used to hash API keys at rest:
 *  1. fails fast outside test mode when missing, empty, a known weak/default
 *     value, or too short — instead of silently using a hardcoded constant;
 *  2. falls back to a deterministic, non-production value only under
 *     `NODE_ENV === 'test'`;
 *  3. is accepted when a sufficiently long, unique value is supplied.
 */

import { describe, it, expect } from '@jest/globals';
import {
  resolveApiKeySecret,
  resolveSettlementIndexerSecret,
  resolveWebhookSecretEncryptionKey,
  assertApiKeySecretConfigured,
  InsecureSecretError,
  TEST_API_KEY_SECRET,
  TEST_SETTLEMENT_INDEXER_SECRET,
  TEST_WEBHOOK_SECRET_ENCRYPTION_KEY,
  MIN_API_KEY_SECRET_LENGTH,
} from '../src/config/secrets';

/** Build a minimal env object for injection. */
function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return overrides as unknown as NodeJS.ProcessEnv;
}

const STRONG_SECRET = 'a'.repeat(MIN_API_KEY_SECRET_LENGTH) + '-unique-value';

describe('resolveApiKeySecret', () => {
  describe('production (and other non-test environments)', () => {
    it('throws when API_KEY_SECRET is unset', () => {
      expect(() => resolveApiKeySecret(env({ NODE_ENV: 'production' }))).toThrow(
        InsecureSecretError
      );
    });

    it('throws when API_KEY_SECRET is empty / whitespace', () => {
      expect(() =>
        resolveApiKeySecret(env({ NODE_ENV: 'production', API_KEY_SECRET: '' }))
      ).toThrow(InsecureSecretError);
      expect(() =>
        resolveApiKeySecret(env({ NODE_ENV: 'production', API_KEY_SECRET: '   ' }))
      ).toThrow(InsecureSecretError);
    });

    it('throws when API_KEY_SECRET is the historical hardcoded default', () => {
      expect(() =>
        resolveApiKeySecret(
          env({ NODE_ENV: 'production', API_KEY_SECRET: 'default-dev-secret' })
        )
      ).toThrow(InsecureSecretError);
    });

    it('throws on the shipped .env.example placeholder (case-insensitive)', () => {
      expect(() =>
        resolveApiKeySecret(
          env({
            NODE_ENV: 'production',
            API_KEY_SECRET: 'Change-Me-To-A-32-Byte-Random-Value',
          })
        )
      ).toThrow(InsecureSecretError);
    });

    it('throws when the secret is shorter than the minimum length', () => {
      expect(() =>
        resolveApiKeySecret(env({ NODE_ENV: 'production', API_KEY_SECRET: 'short' }))
      ).toThrow(InsecureSecretError);
    });

    it('also fails fast in non-production, non-test environments', () => {
      expect(() => resolveApiKeySecret(env({ NODE_ENV: 'development' }))).toThrow(
        InsecureSecretError
      );
      // NODE_ENV unset is treated strictly too.
      expect(() => resolveApiKeySecret(env({}))).toThrow(InsecureSecretError);
    });

    it('accepts and returns a strong, unique secret', () => {
      expect(
        resolveApiKeySecret(env({ NODE_ENV: 'production', API_KEY_SECRET: STRONG_SECRET }))
      ).toBe(STRONG_SECRET);
    });

    it('trims surrounding whitespace from a valid secret', () => {
      expect(
        resolveApiKeySecret(
          env({ NODE_ENV: 'production', API_KEY_SECRET: `  ${STRONG_SECRET}  ` })
        )
      ).toBe(STRONG_SECRET);
    });
  });

  describe('test environment', () => {
    it('falls back to the deterministic test secret when unset', () => {
      expect(resolveApiKeySecret(env({ NODE_ENV: 'test' }))).toBe(TEST_API_KEY_SECRET);
    });

    it('returns a provided value without enforcing strength', () => {
      expect(
        resolveApiKeySecret(env({ NODE_ENV: 'test', API_KEY_SECRET: 'short' }))
      ).toBe('short');
    });
  });
});

describe('resolveSettlementIndexerSecret', () => {
  describe('production (and other non-test environments)', () => {
    it('throws when SETTLEMENT_INDEXER_SECRET is unset', () => {
      expect(() =>
        resolveSettlementIndexerSecret(env({ NODE_ENV: 'production' }))
      ).toThrow(InsecureSecretError);
    });

    it('throws on a known weak/default value', () => {
      expect(() =>
        resolveSettlementIndexerSecret(
          env({ NODE_ENV: 'production', SETTLEMENT_INDEXER_SECRET: 'changeme' })
        )
      ).toThrow(InsecureSecretError);
    });

    it('throws when the secret is shorter than the minimum length', () => {
      expect(() =>
        resolveSettlementIndexerSecret(
          env({ NODE_ENV: 'production', SETTLEMENT_INDEXER_SECRET: 'short' })
        )
      ).toThrow(InsecureSecretError);
    });

    it('accepts and returns a strong, unique secret', () => {
      expect(
        resolveSettlementIndexerSecret(
          env({ NODE_ENV: 'production', SETTLEMENT_INDEXER_SECRET: STRONG_SECRET })
        )
      ).toBe(STRONG_SECRET);
    });
  });

  describe('test environment', () => {
    it('falls back to the deterministic test secret when unset', () => {
      expect(resolveSettlementIndexerSecret(env({ NODE_ENV: 'test' }))).toBe(
        TEST_SETTLEMENT_INDEXER_SECRET
      );
    });
  });

  it('uses a distinct env var from the API key secret', () => {
    // A configured API key secret must not satisfy the indexer secret.
    expect(() =>
      resolveSettlementIndexerSecret(
        env({ NODE_ENV: 'production', API_KEY_SECRET: STRONG_SECRET })
      )
    ).toThrow(InsecureSecretError);
  });
});

describe('resolveWebhookSecretEncryptionKey', () => {
  describe('production (and other non-test environments)', () => {
    it('throws when WEBHOOK_SECRET_ENCRYPTION_KEY is unset', () => {
      expect(() =>
        resolveWebhookSecretEncryptionKey(env({ NODE_ENV: 'production' }))
      ).toThrow(InsecureSecretError);
    });

    it('throws on a known weak/default value', () => {
      expect(() =>
        resolveWebhookSecretEncryptionKey(
          env({ NODE_ENV: 'production', WEBHOOK_SECRET_ENCRYPTION_KEY: 'changeme' })
        )
      ).toThrow(InsecureSecretError);
    });

    it('throws when the key is shorter than the minimum length', () => {
      expect(() =>
        resolveWebhookSecretEncryptionKey(
          env({ NODE_ENV: 'production', WEBHOOK_SECRET_ENCRYPTION_KEY: 'short' })
        )
      ).toThrow(InsecureSecretError);
    });

    it('accepts and returns a strong, unique key', () => {
      expect(
        resolveWebhookSecretEncryptionKey(
          env({ NODE_ENV: 'production', WEBHOOK_SECRET_ENCRYPTION_KEY: STRONG_SECRET })
        )
      ).toBe(STRONG_SECRET);
    });
  });

  describe('test environment', () => {
    it('falls back to the deterministic test key when unset', () => {
      expect(resolveWebhookSecretEncryptionKey(env({ NODE_ENV: 'test' }))).toBe(
        TEST_WEBHOOK_SECRET_ENCRYPTION_KEY
      );
    });
  });

  it('uses a distinct env var from the API key secret', () => {
    expect(() =>
      resolveWebhookSecretEncryptionKey(
        env({ NODE_ENV: 'production', API_KEY_SECRET: STRONG_SECRET })
      )
    ).toThrow(InsecureSecretError);
  });
});

describe('assertApiKeySecretConfigured', () => {
  it('throws in production when the secret is missing (boot fails fast)', () => {
    expect(() => assertApiKeySecretConfigured(env({ NODE_ENV: 'production' }))).toThrow(
      InsecureSecretError
    );
  });

  it('succeeds in production when a valid secret is set (boot proceeds)', () => {
    expect(() =>
      assertApiKeySecretConfigured(
        env({ NODE_ENV: 'production', API_KEY_SECRET: STRONG_SECRET })
      )
    ).not.toThrow();
  });
});
