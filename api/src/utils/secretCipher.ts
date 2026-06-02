/**
 * Symmetric secret encryption at rest (AES-256-GCM).
 *
 * Some server-side secrets cannot be one-way hashed because the API must
 * recover the original value to use it. The webhook signing secret is the
 * canonical example: each outbound delivery is signed with HMAC-SHA256 over
 * the registered secret (see `services/WebhookService.ts` and
 * `utils/webhookSignature.ts`), so the plaintext has to be available at
 * delivery time. Storing it verbatim, however, means a dump of the endpoint
 * store or a memory disclosure leaks every merchant's signing secret, letting
 * an attacker forge webhook payloads (audit finding API-M1, issue #269).
 *
 * This module encrypts such secrets at rest with authenticated symmetric
 * encryption so the store only ever holds ciphertext. The encryption key is
 * resolved from the environment via
 * {@link resolveWebhookSecretEncryptionKey}, which enforces the same fail-fast
 * policy as every other security secret (no publicly known fallback outside
 * the test environment).
 *
 * Ciphertext format
 * -----------------
 *   v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 *  - `v1` is a scheme version so the algorithm can be rotated later without
 *    ambiguity.
 *  - The IV is a fresh 12-byte random value per encryption (GCM nonce).
 *  - The 16-byte GCM auth tag detects tampering on decrypt.
 *
 * The raw key material is run through HKDF-SHA256 to derive a uniformly random
 * 32-byte AES key, so operators may supply a high-entropy passphrase of any
 * length (the resolver already requires at least 16 characters).
 *
 * @see api/src/services/WebhookService.ts
 * @see api/src/config/secrets.ts (resolveWebhookSecretEncryptionKey)
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/269
 */

import crypto from 'crypto';
import { resolveWebhookSecretEncryptionKey } from '../config/secrets';

/** Current ciphertext scheme version. */
const SCHEME_VERSION = 'v1';

/** AES-256-GCM cipher identifier. */
const ALGORITHM = 'aes-256-gcm';

/** GCM nonce length in bytes (96 bits — the recommended size for GCM). */
const IV_LENGTH = 12;

/** AES-256 key length in bytes. */
const KEY_LENGTH = 32;

/** Fixed, non-secret HKDF salt — diversifies the derived key per use case. */
const HKDF_SALT = Buffer.from('tonbankcard-webhook-secret-cipher-v1', 'utf8');

/** Fixed, non-secret HKDF info string. */
const HKDF_INFO = Buffer.from('webhook-signing-secret', 'utf8');

/** Raised when a stored ciphertext cannot be parsed or authenticated. */
export class SecretDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretDecryptionError';
  }
}

/**
 * Derive a uniformly random 32-byte AES key from arbitrary key material.
 *
 * `crypto.hkdfSync` returns an `ArrayBuffer`; wrap it in a `Buffer` so it can
 * be handed straight to `createCipheriv`.
 */
function deriveKey(keyMaterial: string): Buffer {
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(keyMaterial, 'utf8'),
    HKDF_SALT,
    HKDF_INFO,
    KEY_LENGTH
  );
  return Buffer.from(derived);
}

/**
 * Authenticated symmetric cipher for secrets stored at rest.
 *
 * Instantiate once and reuse: the AES key is derived from the supplied key
 * material in the constructor. Inject a fixed key material in tests; in
 * production use {@link createWebhookSecretCipher}, which resolves the key from
 * the environment.
 */
export class SecretCipher {
  private readonly key: Buffer;

  /**
   * @param keyMaterial - High-entropy passphrase / key (already validated by
   *                       the caller). HKDF-expanded to a 32-byte AES key.
   */
  constructor(keyMaterial: string) {
    this.key = deriveKey(keyMaterial);
  }

  /**
   * Encrypt `plaintext`, returning a self-describing ciphertext string.
   *
   * A fresh random IV is generated per call, so encrypting the same plaintext
   * twice yields different ciphertexts.
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      SCHEME_VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a ciphertext produced by {@link encrypt}.
   *
   * @throws {SecretDecryptionError} when the value is malformed, uses an
   *         unknown scheme, or fails GCM authentication (tampering / wrong key).
   */
  decrypt(value: string): string {
    const parts = typeof value === 'string' ? value.split(':') : [];
    if (parts.length !== 4) {
      throw new SecretDecryptionError('Malformed ciphertext: expected 4 segments');
    }
    const [version, ivB64, tagB64, dataB64] = parts;
    if (version !== SCHEME_VERSION) {
      throw new SecretDecryptionError(`Unsupported ciphertext scheme: ${version}`);
    }
    try {
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(tagB64, 'base64');
      const ciphertext = Buffer.from(dataB64, 'base64');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch (err) {
      throw new SecretDecryptionError(
        `Failed to decrypt secret: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/**
 * Build a {@link SecretCipher} keyed by the environment-resolved webhook
 * encryption key. Fails fast (via the resolver) outside test mode when the key
 * is missing or insecurely configured.
 *
 * @param env - Environment to read from (defaults to `process.env`)
 */
export function createWebhookSecretCipher(
  env: NodeJS.ProcessEnv = process.env
): SecretCipher {
  return new SecretCipher(resolveWebhookSecretEncryptionKey(env));
}
