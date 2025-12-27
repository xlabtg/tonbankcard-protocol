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
 */
export interface GetInvoiceResponse extends Invoice {}

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
 * Error response
 */
export interface ErrorResponse {
  error: {
    /** Machine-readable error code */
    code: string;

    /** Human-readable error message */
    message: string;

    /** Additional context (optional) */
    details?: Record<string, any>;
  };
}

/**
 * Error codes
 */
export enum ErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED_MERCHANT = 'UNAUTHORIZED_MERCHANT',
  INVALID_NFT_ADDRESS = 'INVALID_NFT_ADDRESS',
  NFT_NOT_WHITELISTED = 'NFT_NOT_WHITELISTED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_METADATA = 'INVALID_METADATA',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  INVOICE_EXPIRED = 'INVOICE_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BLOCKCHAIN_UNAVAILABLE = 'BLOCKCHAIN_UNAVAILABLE',
}

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
} as const;
