/**
 * API Key Service
 *
 * Manages API key registration and secure lookup.
 *
 * Design principles
 * -----------------
 * 1. Plaintext API keys are NEVER stored.  Only an HMAC-SHA256 hash (keyed
 *    with API_KEY_SECRET) is kept in the store so that a compromised store
 *    does not expose usable credentials.
 * 2. Lookup is always by hash, never by plaintext value.
 * 3. The merchant_nft bound to the key is returned and verified at the call
 *    site (authenticateWithPermission) to prevent cross-merchant abuse.
 *
 * In production this in-memory store must be replaced with a persistent
 * database (PostgreSQL, MongoDB, etc.).
 */

import { ApiKey, ApiKeyPermission } from '../types/invoice';
import { hashApiKey } from '../utils/helpers';
import { ValidationError } from '../utils/validation';
import { ErrorCode } from '../types/invoice';

/**
 * In-memory API key registry keyed by key_hash.
 *
 * ⚠️ PRODUCTION WARNING: Replace with a database-backed store.
 */
const apiKeyRegistry = new Map<string, ApiKey>();

export class ApiKeyService {
  /**
   * Register a new API key.
   *
   * @param plaintextKey  - Plaintext API key (shown to the merchant once; never stored)
   * @param merchantNft   - NFT address that this key is authorised to act on behalf of
   * @param permissions   - Scoped permissions for this key
   * @param rateLimits    - Optional rate-limit overrides
   * @param expiresAt     - Optional expiration timestamp (ISO 8601)
   * @returns The stored ApiKey record (contains the hash, not the plaintext)
   */
  registerApiKey(
    plaintextKey: string,
    merchantNft: string,
    permissions: ApiKeyPermission[] = ['invoice:create', 'invoice:read', 'invoice:status'],
    rateLimits?: Partial<ApiKey['rate_limits']>,
    expiresAt: string | null = null
  ): ApiKey {
    const keyHash = hashApiKey(plaintextKey);
    const keyId = `key_${plaintextKey.substring(0, 8)}`;

    const apiKey: ApiKey = {
      key_id: keyId,
      key_hash: keyHash,
      merchant_nft: merchantNft,
      permissions,
      rate_limits: {
        invoice_create_rpm: 100,
        invoice_read_rpm: 1000,
        invoice_status_rpm: 500,
        ...rateLimits,
      },
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      last_used_at: null,
      is_active: true,
    };

    apiKeyRegistry.set(keyHash, apiKey);
    return apiKey;
  }

  /**
   * Look up an API key by its plaintext value.
   *
   * Throws INVALID_API_KEY if:
   *  - no matching hash found in the registry,
   *  - the key is marked inactive, or
   *  - the key has expired.
   *
   * @param plaintextKey - Plaintext API key from the Authorization header
   * @returns The matching ApiKey record
   */
  findAndValidateKey(plaintextKey: string): ApiKey {
    const keyHash = hashApiKey(plaintextKey);
    const apiKey = apiKeyRegistry.get(keyHash);

    if (!apiKey) {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Invalid API key');
    }

    if (!apiKey.is_active) {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'API key is deactivated');
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      throw new ValidationError(ErrorCode.INVALID_API_KEY, 'API key has expired');
    }

    return apiKey;
  }

  /**
   * Update the last_used_at timestamp for a key.
   *
   * @param keyHash - The key_hash of the key to update
   */
  touchKey(keyHash: string): void {
    const apiKey = apiKeyRegistry.get(keyHash);
    if (apiKey) {
      apiKey.last_used_at = new Date().toISOString();
      apiKeyRegistry.set(keyHash, apiKey);
    }
  }

  /**
   * Deactivate an API key (revocation).
   *
   * @param keyHash - The key_hash of the key to deactivate
   */
  deactivateKey(keyHash: string): void {
    const apiKey = apiKeyRegistry.get(keyHash);
    if (apiKey) {
      apiKey.is_active = false;
      apiKeyRegistry.set(keyHash, apiKey);
    }
  }

  /**
   * Return the number of registered keys (useful for tests).
   */
  size(): number {
    return apiKeyRegistry.size;
  }

  /**
   * Clear all keys (test helper – do not use in production).
   */
  clearAll(): void {
    apiKeyRegistry.clear();
  }
}

/** Singleton instance used by the route middleware */
export const apiKeyService = new ApiKeyService();
