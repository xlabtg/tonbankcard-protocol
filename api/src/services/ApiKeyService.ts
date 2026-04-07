/**
 * API Key Service
 *
 * Manages API key registration, secure lookup, and merchant authorization checks.
 *
 * Design principles
 * -----------------
 * 1. Plaintext API keys are NEVER stored.  Only an HMAC-SHA256 hash (keyed
 *    with API_KEY_SECRET) is kept in the store so that a compromised store
 *    does not expose usable credentials.
 * 2. Lookup is always by hash, never by plaintext value.
 * 3. The merchant_nft bound to the key is returned and verified at the call
 *    site (isAuthorizedMerchant) to prevent cross-merchant abuse.
 * 4. Authorization checks are cached with a short TTL (60 s) to reduce
 *    redundant lookups on hot paths without meaningfully delaying revocation.
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

/** Cache entry for authorization results */
interface AuthCacheEntry {
  authorized: boolean;
  expiresAt: number;
}

/** TTL for the authorization cache (60 seconds) */
const AUTH_CACHE_TTL_MS = 60 * 1000;

/** Short-lived authorization cache: `${keyHash}:${merchantNft}` → AuthCacheEntry */
const authCache = new Map<string, AuthCacheEntry>();

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
    // Invalidate any cached authorization for this key
    this._invalidateCacheForKey(keyHash, merchantNft);
    return apiKey;
  }

  /**
   * Convenience alias for registerApiKey used in tests and simple callers.
   *
   * @param plaintextKey - Plaintext API key
   * @param merchantNft  - NFT address this key is authorised for
   * @returns Stored ApiKey record
   */
  registerKey(plaintextKey: string, merchantNft: string): ApiKey {
    return this.registerApiKey(plaintextKey, merchantNft);
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
   * Check whether a plaintext API key is authorised for the given merchant NFT.
   *
   * Results are cached for AUTH_CACHE_TTL_MS to keep hot-path latency low.
   * The cache is invalidated automatically on expiry and when a key is
   * registered/deactivated.
   *
   * An inactive or expired key is treated as unauthorised.
   *
   * @param plaintextKey - Plaintext API key presented by the caller
   * @param merchantNft  - Merchant NFT address from the invoice request
   * @returns true if the key is valid, active, and bound to merchantNft
   */
  isAuthorizedMerchant(plaintextKey: string, merchantNft: string): boolean {
    const keyHash = hashApiKey(plaintextKey);
    const cacheKey = `${keyHash}:${merchantNft}`;
    const now = Date.now();

    // Return cached result if still valid
    const cached = authCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.authorized;
    }

    // Compute fresh result
    const apiKey = apiKeyRegistry.get(keyHash);
    const authorized =
      apiKey !== undefined &&
      apiKey.is_active &&
      apiKey.merchant_nft === merchantNft &&
      (!apiKey.expires_at || new Date(apiKey.expires_at) >= new Date());

    // Cache and return
    authCache.set(cacheKey, { authorized, expiresAt: now + AUTH_CACHE_TTL_MS });
    return authorized;
  }

  /**
   * Invalidate the authorization cache for a specific key/merchant pair.
   * Call this when an API key is revoked or its merchant NFT changes.
   *
   * @param keyHash     - Hash of the raw API key
   * @param merchantNft - Merchant NFT address
   */
  private _invalidateCacheForKey(keyHash: string, merchantNft: string): void {
    authCache.delete(`${keyHash}:${merchantNft}`);
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
      // Invalidate cached authorization for all merchant NFTs bound to this key
      this._invalidateCacheForKey(keyHash, apiKey.merchant_nft);
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
    authCache.clear();
  }
}

/** Singleton instance used by the route middleware */
export const apiKeyService = new ApiKeyService();
