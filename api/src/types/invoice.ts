/**
 * Merchant API Types
 *
 * Type definitions for the Tonbankcard Merchant API.
 * These types correspond to the API specification defined in docs/merchant-api-spec.md
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/24
 */

/**
 * Invoice status enum
 */
export type InvoiceStatus = 'pending' | 'settled' | 'expired';

/**
 * Invoice metadata
 * Arbitrary key-value pairs with constraints:
 * - Max 10 fields
 * - Max 1KB total size
 */
export interface InvoiceMetadata {
  order_id?: string;
  description?: string;
  customer_email?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Settlement proof
 * Contains on-chain verification data
 */
export interface Settlement {
  /** Payer NFT address */
  payer_nft: string;

  /** Merchant NFT address */
  merchant_nft: string;

  /** Amount in TBC nanocoins */
  amount_tbc: string;

  /** Block number where payment was settled */
  block_number: number;

  /** Transaction hash */
  tx_hash: string;

  /** Settlement timestamp (ISO 8601) */
  timestamp: string;

  /** Hash of payment metadata */
  payload_hash: string;

  /** API verified on-chain */
  on_chain_verified: boolean;

  /** Blockchain explorer link */
  verification_url: string;

  /**
   * Number of block confirmations at the time of API response.
   * Higher confirmations = higher confidence in finality.
   *
   * Recommended thresholds:
   * - 1 confirmation: Low-value transactions
   * - 3 confirmations: Standard transactions
   * - 6 confirmations: High-value transactions (default MIN_CONFIRMATIONS)
   * - 12+ confirmations: Mission-critical transactions
   */
  confirmations?: number;

  /**
   * Whether the settlement is considered final based on confirmation count.
   * True if confirmations >= CONSTANTS.MIN_CONFIRMATIONS (default: 6)
   *
   * Note: For high-value transactions, merchants should verify finality
   * independently using their own TON node or trusted RPC provider.
   */
  is_final?: boolean;
}

/**
 * Invoice
 * Represents a payment intent
 */
export interface Invoice {
  /** Unique identifier (UUID v4) */
  invoice_id: string;

  /** Merchant NFT address */
  merchant_nft: string;

  /** Amount in TBC nanocoins (1 TBC = 10^9 nanocoins) */
  amount_tbc: string;

  /** Currency (always "TBC") */
  currency: 'TBC';

  /** Optional metadata */
  metadata?: InvoiceMetadata;

  /** Invoice status */
  status: InvoiceStatus;

  /** Creation timestamp (ISO 8601) */
  created_at: string;

  /** Expiration timestamp (ISO 8601) */
  expires_at: string;

  /** Deep link for wallet */
  payment_url: string;

  /** Settlement proof (present if status = settled) */
  settlement?: Settlement;
}

/**
 * Create invoice request
 */
export interface CreateInvoiceRequest {
  /** Merchant NFT address */
  merchant_nft: string;

  /** Amount in TBC nanocoins */
  amount_tbc: string;

  /** Currency (must be "TBC") */
  currency: 'TBC';

  /** Optional metadata */
  metadata?: InvoiceMetadata;

  /** Expiration timestamp (ISO 8601), default: 24 hours from now */
  expires_at?: string;
}

/**
 * Create invoice response
 */
export interface CreateInvoiceResponse extends Invoice {}

/**
 * Get invoice response
 *
 * Returned by the *authenticated* merchant detail endpoint and therefore
 * carries the full invoice (merchant identity, metadata, settlement).
 */
export interface GetInvoiceResponse extends Invoice {}

/**
 * Public (payer-facing) invoice view.
 *
 * Returned by the unauthenticated `GET /v1/invoice/:invoice_id` endpoint.
 * It deliberately exposes ONLY the fields a payer needs to settle an
 * invoice and omits everything that could leak merchant identity or
 * customer PII:
 *
 *  - `merchant_nft` is dropped (merchant identity disclosure).
 *  - `metadata` is dropped (may hold `customer_email`, `order_id`, …).
 *  - `settlement` is dropped (on-chain merchant/payer identities).
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/253
 */
export interface PublicInvoiceView {
  /** Unique identifier (UUID v4) */
  invoice_id: string;

  /** Amount in TBC nanocoins (1 TBC = 10^9 nanocoins) */
  amount_tbc: string;

  /** Currency (always "TBC") */
  currency: 'TBC';

  /** Invoice status */
  status: InvoiceStatus;

  /** Creation timestamp (ISO 8601) */
  created_at: string;

  /** Expiration timestamp (ISO 8601) */
  expires_at: string;

  /** Deep link for wallet */
  payment_url: string;
}

/**
 * Get invoice status response
 */
export interface GetInvoiceStatusResponse {
  /** Invoice ID */
  invoice_id: string;

  /** Invoice status */
  status: InvoiceStatus;

  /** Creation timestamp (ISO 8601) */
  created_at: string;

  /** Expiration timestamp (ISO 8601) */
  expires_at: string;

  /** Settlement proof (present if status = settled) */
  settlement?: Settlement;
}

/**
 * Error response envelope and codes are defined in `./errors` so they
 * can be consumed without pulling in the rest of the invoice types.
 * Re-exported here for backwards compatibility with existing imports.
 *
 * @see ./errors
 * @see docs/error-codes.md
 */
export { ErrorCode, ERROR_CODE_HTTP_STATUS, getHttpStatusForErrorCode } from './errors';
export type { ErrorResponse } from './errors';

/**
 * Whitelisted NFT collections
 */
export const WHITELISTED_NFT_COLLECTIONS = [
  'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le', // Series 7777
  'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7', // Series 8888
] as const;

/**
 * TBC token address
 */
export const TBC_TOKEN_ADDRESS = 'EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq';

/**
 * Constants
 */
export const CONSTANTS = {
  /** 1 TBC in nanocoins */
  TBC_DECIMALS: 9,
  TBC_MULTIPLIER: BigInt(10 ** 9),

  /** Maximum TBC amount (2^120 - 1) */
  MAX_TBC_AMOUNT: BigInt(2 ** 120) - BigInt(1),

  /** Maximum metadata fields */
  MAX_METADATA_FIELDS: 10,

  /** Maximum metadata size in bytes */
  MAX_METADATA_SIZE: 1024,

  /** Default invoice expiration (24 hours in milliseconds) */
  DEFAULT_EXPIRY_MS: 24 * 60 * 60 * 1000,

  /** Minimum confirmations for settlement */
  MIN_CONFIRMATIONS: 6,

  /** Default idempotency key TTL (24 hours in milliseconds) */
  IDEMPOTENCY_TTL_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * API Key Permissions
 *
 * Scoped permissions for API keys:
 * - invoice:create - Create new invoices
 * - invoice:read - Read invoice details (public endpoint, but tracked)
 * - invoice:status - Check settlement status
 *
 * Default: All permissions granted for new keys
 */
export type ApiKeyPermission = 'invoice:create' | 'invoice:read' | 'invoice:status';

/**
 * API Key with scoping and rate limits
 *
 * In production, this would be stored in a database with the key_hash (SHA-256 + salt).
 * The actual API key is never stored, only the hash.
 */
export interface ApiKey {
  /** Unique key identifier (public, can be logged) */
  key_id: string;

  /** Hash of the API key (SHA-256 with salt) */
  key_hash: string;

  /** Authorized merchant NFT address */
  merchant_nft: string;

  /** Scoped permissions */
  permissions: ApiKeyPermission[];

  /** Per-key rate limits */
  rate_limits: {
    /** Requests per minute for invoice:create */
    invoice_create_rpm: number;
    /** Requests per minute for invoice:read */
    invoice_read_rpm: number;
    /** Requests per minute for invoice:status */
    invoice_status_rpm: number;
  };

  /** Creation timestamp (ISO 8601) */
  created_at: string;

  /** Expiration timestamp (ISO 8601), null = never expires */
  expires_at: string | null;

  /** Last used timestamp (ISO 8601), null = never used */
  last_used_at: string | null;

  /** Whether the key is active */
  is_active: boolean;
}

/**
 * Rate limit bucket (token bucket algorithm)
 */
export interface RateLimitBucket {
  /** Current token count */
  tokens: number;

  /** Maximum tokens */
  max_tokens: number;

  /** Last refill timestamp */
  last_refill: number;

  /** Next refill timestamp */
  refill_at: number;
}
