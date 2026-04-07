/**
 * API Key Service
 *
 * Manages merchant API keys: storage, lookup by hash, and authorization checks.
 * In production this would query a database; here we use an in-memory store to
 * keep the reference implementation self-contained.
 *
 * Security notes:
 * - Raw API keys are NEVER stored; only SHA-256 hashes are kept.
 * - Authorization checks are O(1) via hash lookup.
 * - A short-lived in-process cache (TTL: AUTH_CACHE_TTL_MS) reduces redundant
 *   lookups on hot paths without meaningfully delaying revocation propagation.
 */

import { ApiKey, ErrorCode } from '../types/invoice';
import { hashApiKey } from '../utils/helpers';
import { ValidationError } from '../utils/validation';

/** Cache entry for authorization results */
interface AuthCacheEntry {
  authorized: boolean;
  expiresAt: number;
}

/** TTL for the authorization cache (60 seconds) */
const AUTH_CACHE_TTL_MS = 60 * 1000;

/**
 * API Key Service
 *
 * Handles registration and authorization of merchant API keys.
 */
export class ApiKeyService {
  /**
   * In-memory store: key_hash → ApiKey
   *
   * In production replace with a database query.
   */
  private readonly keyStore = new Map<string, ApiKey>();

  /**
   * Short-lived authorization cache: `${keyHash}:${merchantNft}` → AuthCacheEntry
   *
   * Entries expire after AUTH_CACHE_TTL_MS to limit stale-revocation windows.
   */
  private readonly authCache = new Map<string, AuthCacheEntry>();

  /**
   * Register a new API key.
   *
   * The caller must supply the raw key exactly once; afterward only the hash is
   * retained.  Returns the stored ApiKey record (without the raw key).
   *
   * @param rawApiKey  - Raw API key (e.g. "tbck_live_…")
   * @param merchantNft - Merchant NFT address this key is authorised for
   * @param permissions - Scoped permissions to grant (defaults to all)
   * @returns Stored ApiKey record
   */
  registerKey(
    rawApiKey: string,
    merchantNft: string,
    permissions: ApiKey['permissions'] = ['invoice:create', 'invoice:read', 'invoice:status']
  ): ApiKey {
    const keyHash = hashApiKey(rawApiKey);
    const keyId = `key_${keyHash.slice(0, 12)}`;

    const apiKey: ApiKey = {
      key_id: keyId,
      key_hash: keyHash,
      merchant_nft: merchantNft,
      permissions,
      rate_limits: {
        invoice_create_rpm: 60,
        invoice_read_rpm: 120,
        invoice_status_rpm: 120,
      },
      created_at: new Date().toISOString(),
    } as ApiKey;

    this.keyStore.set(keyHash, apiKey);
    return apiKey;
  }

  /**
   * Look up an API key record by the hash of the raw key.
   *
   * @param rawApiKey - Raw API key to look up
   * @returns ApiKey record if found, undefined otherwise
   */
  findByKeyHash(rawApiKey: string): ApiKey | undefined {
    const keyHash = hashApiKey(rawApiKey);
    return this.keyStore.get(keyHash);
  }

  /**
   * Check whether a raw API key is authorised for the given merchant NFT.
   *
   * Results are cached for AUTH_CACHE_TTL_MS to keep hot-path latency low.
   * The cache is invalidated automatically on expiry.
   *
   * @param rawApiKey  - Raw API key presented by the caller
   * @param merchantNft - Merchant NFT address from the invoice request
   * @returns true if authorised
   */
  isAuthorizedMerchant(rawApiKey: string, merchantNft: string): boolean {
    const keyHash = hashApiKey(rawApiKey);
    const cacheKey = `${keyHash}:${merchantNft}`;
    const now = Date.now();

    // Return cached result if still valid
    const cached = this.authCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.authorized;
    }

    // Compute fresh result
    const apiKey = this.keyStore.get(keyHash);
    const authorized = apiKey !== undefined && apiKey.merchant_nft === merchantNft;

    // Cache and return
    this.authCache.set(cacheKey, { authorized, expiresAt: now + AUTH_CACHE_TTL_MS });
    return authorized;
  }

  /**
   * Invalidate the authorization cache for a specific key/merchant pair.
   * Call this when an API key is revoked or its merchant NFT changes.
   *
   * @param rawApiKey  - Raw API key whose cache entry should be cleared
   * @param merchantNft - Merchant NFT address
   */
  invalidateAuthCache(rawApiKey: string, merchantNft: string): void {
    const keyHash = hashApiKey(rawApiKey);
    this.authCache.delete(`${keyHash}:${merchantNft}`);
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
