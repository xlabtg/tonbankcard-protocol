/**
 * SecretCipher tests (audit finding API-M1, issue #269).
 *
 * Verifies the AES-256-GCM secret-at-rest cipher used to protect webhook
 * signing secrets:
 *  1. encrypt() never emits the plaintext and round-trips via decrypt();
 *  2. a fresh IV per call makes repeated encryptions diverge;
 *  3. tampering, truncation, unknown schemes, and wrong keys are rejected;
 *  4. createWebhookSecretCipher() resolves a usable key in test mode and
 *     fails fast outside it when WEBHOOK_SECRET_ENCRYPTION_KEY is missing.
 */

import { describe, it, expect } from '@jest/globals';
import {
  SecretCipher,
  SecretDecryptionError,
  createWebhookSecretCipher,
} from '../src/utils/secretCipher';
import { InsecureSecretError } from '../src/config/secrets';

const KEY = 'unit-test-encryption-key-abcdef1234567890';
const PLAINTEXT = 'whsec_super_secret_signing_value';

describe('SecretCipher', () => {
  const cipher = new SecretCipher(KEY);

  it('encrypts to a versioned, non-plaintext representation', () => {
    const ct = cipher.encrypt(PLAINTEXT);
    expect(ct.startsWith('v1:')).toBe(true);
    expect(ct).not.toContain(PLAINTEXT);
    expect(ct.split(':')).toHaveLength(4);
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const ct = cipher.encrypt(PLAINTEXT);
    expect(cipher.decrypt(ct)).toBe(PLAINTEXT);
  });

  it('uses a fresh IV so the same plaintext yields different ciphertexts', () => {
    expect(cipher.encrypt(PLAINTEXT)).not.toBe(cipher.encrypt(PLAINTEXT));
  });

  it('handles empty strings and unicode', () => {
    for (const value of ['', '🔐 ключ — secret', 'a'.repeat(2048)]) {
      expect(cipher.decrypt(cipher.encrypt(value))).toBe(value);
    }
  });

  it('rejects ciphertext encrypted under a different key', () => {
    const other = new SecretCipher('a-completely-different-key-0987654321');
    const ct = other.encrypt(PLAINTEXT);
    expect(() => cipher.decrypt(ct)).toThrow(SecretDecryptionError);
  });

  it('rejects a tampered auth tag / ciphertext', () => {
    const ct = cipher.encrypt(PLAINTEXT);
    const parts = ct.split(':');
    // Flip the last base64 character of the ciphertext segment.
    const data = parts[3];
    const flipped = (data[data.length - 1] === 'A' ? 'B' : 'A');
    parts[3] = data.slice(0, -1) + flipped;
    expect(() => cipher.decrypt(parts.join(':'))).toThrow(SecretDecryptionError);
  });

  it('rejects malformed ciphertext (wrong segment count)', () => {
    expect(() => cipher.decrypt('v1:only:three')).toThrow(SecretDecryptionError);
    expect(() => cipher.decrypt('not-even-close')).toThrow(SecretDecryptionError);
  });

  it('rejects an unknown scheme version', () => {
    const ct = cipher.encrypt(PLAINTEXT);
    const reversioned = ct.replace(/^v1:/, 'v9:');
    expect(() => cipher.decrypt(reversioned)).toThrow(/Unsupported ciphertext scheme/);
  });
});

describe('createWebhookSecretCipher', () => {
  it('resolves a usable cipher under NODE_ENV=test', () => {
    const cipher = createWebhookSecretCipher({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(cipher.decrypt(cipher.encrypt(PLAINTEXT))).toBe(PLAINTEXT);
  });

  it('fails fast when the key is missing outside test mode', () => {
    expect(() =>
      createWebhookSecretCipher({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    ).toThrow(InsecureSecretError);
  });
});
