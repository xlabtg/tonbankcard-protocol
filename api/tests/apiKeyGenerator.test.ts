/**
 * API Key Generator Tests
 *
 * Verifies that `utils/apiKeyGenerator.ts`:
 *  - emits keys in the canonical `tbc_(live|test)_{32 hex}` format
 *  - produces high-entropy random portions (no collisions)
 *  - validates format strictly
 *  - redacts plaintext keys safely for log output
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateApiKey,
  isValidApiKeyFormat,
  getApiKeyEnvironment,
  redactApiKey,
  API_KEY_PATTERN,
  LIVE_KEY_PREFIX,
  TEST_KEY_PREFIX,
} from '../src/utils/apiKeyGenerator';

describe('apiKeyGenerator', () => {
  describe('generateApiKey', () => {
    it('produces a live key matching the canonical pattern', () => {
      const key = generateApiKey('live');
      expect(key).toMatch(API_KEY_PATTERN);
      expect(key.startsWith(LIVE_KEY_PREFIX)).toBe(true);
    });

    it('produces a test key matching the canonical pattern', () => {
      const key = generateApiKey('test');
      expect(key).toMatch(API_KEY_PATTERN);
      expect(key.startsWith(TEST_KEY_PREFIX)).toBe(true);
    });

    it('defaults to a live key when no environment is given', () => {
      const key = generateApiKey();
      expect(key.startsWith(LIVE_KEY_PREFIX)).toBe(true);
    });

    it('produces unique values across 1000 invocations', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        generated.add(generateApiKey('live'));
      }
      expect(generated.size).toBe(1000);
    });
  });

  describe('isValidApiKeyFormat', () => {
    it.each([
      ['tbc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', true],
      ['tbc_test_0123456789abcdef0123456789abcdef', true],
      ['tbc_live_TOO_SHORT', false],
      ['tbc_live_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', false], // uppercase hex rejected
      ['TBC_LIVE_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', false], // wrong prefix case
      ['tbc_staging_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', false],
      ['', false],
    ])('isValidApiKeyFormat(%j) → %s', (input, expected) => {
      expect(isValidApiKeyFormat(input as string)).toBe(expected);
    });
  });

  describe('getApiKeyEnvironment', () => {
    it('returns "live" for live-prefixed keys', () => {
      expect(getApiKeyEnvironment(generateApiKey('live'))).toBe('live');
    });
    it('returns "test" for test-prefixed keys', () => {
      expect(getApiKeyEnvironment(generateApiKey('test'))).toBe('test');
    });
    it('returns null for unknown prefixes', () => {
      expect(getApiKeyEnvironment('tbck_legacy_value')).toBeNull();
    });
  });

  describe('redactApiKey', () => {
    it('reveals at most 12 characters and masks the remainder', () => {
      const key = 'tbc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const redacted = redactApiKey(key);
      expect(redacted.startsWith(key.slice(0, 12))).toBe(true);
      // Tail must contain only mask characters.
      expect(redacted.slice(12)).toMatch(/^\*+$/);
      // Length preserved so log lines stay aligned.
      expect(redacted.length).toBe(key.length);
    });

    it('does not leak the random suffix', () => {
      const key = 'tbc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const redacted = redactApiKey(key);
      expect(redacted).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('handles empty / non-string input safely', () => {
      expect(redactApiKey('')).toBe('');
      // @ts-expect-error testing runtime guard
      expect(redactApiKey(undefined)).toBe('');
    });
  });
});
