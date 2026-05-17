/**
 * API Key Generator
 *
 * Produces and parses API keys in the canonical Tonbankcard format:
 *   tbc_live_{32 hex chars}   — production keys
 *   tbc_test_{32 hex chars}   — sandbox / test keys
 *
 * Format guarantees
 * -----------------
 *  - 32 hex characters provide 128 bits of entropy, well above any
 *    brute-force threshold.
 *  - The `live` / `test` prefix is explicit so operators can spot a
 *    production credential at a glance and so secret-scanning tools can
 *    distinguish severity.
 *  - The full key is shown to the merchant exactly once at creation and
 *    is never written to durable storage (see `ApiKeyService.registerApiKey`).
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/130
 */

import crypto from 'crypto';

/** Discriminator for the environment in which the key may be used. */
export type ApiKeyEnvironment = 'live' | 'test';

/** Prefix of a production key. */
export const LIVE_KEY_PREFIX = 'tbc_live_';

/** Prefix of a sandbox / test key. */
export const TEST_KEY_PREFIX = 'tbc_test_';

/** Length of the random portion of an API key (hex chars). */
export const API_KEY_RANDOM_LENGTH = 32;

/** Regex matching the canonical format. Anchored for safety. */
export const API_KEY_PATTERN = /^tbc_(live|test)_[0-9a-f]{32}$/;

/**
 * Generate a new API key in the canonical format.
 *
 * Uses Node's CSPRNG (`crypto.randomBytes`) for the random portion.
 *
 * @param environment - 'live' for production, 'test' for sandbox
 * @returns Plaintext API key (must be shown to the merchant exactly once)
 */
export function generateApiKey(environment: ApiKeyEnvironment = 'live'): string {
  const prefix = environment === 'live' ? LIVE_KEY_PREFIX : TEST_KEY_PREFIX;
  const random = crypto.randomBytes(API_KEY_RANDOM_LENGTH / 2).toString('hex');
  return `${prefix}${random}`;
}

/**
 * Strict format validation.
 *
 * @param key - Candidate API key
 * @returns true if the value matches the canonical format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return typeof key === 'string' && API_KEY_PATTERN.test(key);
}

/**
 * Derive the environment of a key from its prefix.
 *
 * @param key - API key
 * @returns 'live', 'test', or null when the prefix is unrecognised
 */
export function getApiKeyEnvironment(key: string): ApiKeyEnvironment | null {
  if (key.startsWith(LIVE_KEY_PREFIX)) return 'live';
  if (key.startsWith(TEST_KEY_PREFIX)) return 'test';
  return null;
}

/**
 * Build a log-safe representation of an API key by redacting the random
 * portion after the first 8 characters of the prefix+random combination.
 *
 * Example: `tbc_live_a1b2c3d4************************`
 *
 * @param key - Plaintext API key (or any string)
 * @returns Redacted form, safe to write to logs
 */
export function redactApiKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  // Reveal at most the first 12 characters (prefix + 3 hex chars) so the
  // environment is visible without leaking enough material to guess the
  // remainder.
  const visible = key.slice(0, 12);
  const redacted = '*'.repeat(Math.max(0, key.length - visible.length));
  return `${visible}${redacted}`;
}
