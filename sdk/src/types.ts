/**
 * TONBANKCARD Merchant SDK - Type Definitions
 *
 * NON-CUSTODIAL GUARANTEE:
 * This SDK contains NO signing logic, NO private key storage, and NO custody mechanisms.
 * All payment operations require user wallet consent via TON Connect or similar.
 */

import { Address } from '@ton/core';

/**
 * Account states as defined in the Payment Hub contract
 */
export enum AccountState {
  ACTIVE = 0,
  FROZEN = 1,
  COLLATERAL_LOCKED = 2,
  CLOSED = 3,
}

/**
 * Payment status as observed on-chain
 */
export enum PaymentStatus {
  PENDING = 'pending',      // Invoice created, awaiting payment
  SETTLED = 'settled',      // Payment confirmed on-chain
  FAILED = 'failed',        // Payment failed or reverted
  EXPIRED = 'expired',      // Invoice expired (optional)
}

/**
 * Invoice metadata structure
 * This is informational only - NOT authoritative
 */
export interface Invoice {
  /** Unique invoice identifier (deterministic) */
  id: string;

  /** Merchant's NFT account address */
  merchantNft: Address;

  /** Payment amount in TBC (nanocoins) */
  amountTbc: bigint;

  /** Optional order ID for merchant tracking */
  orderId?: string;

  /** Optional human-readable description */
  description?: string;

  /** Optional metadata (JSON serializable) */
  metadata?: Record<string, unknown>;

  /** Timestamp when invoice was created */
  createdAt: number;

  /** Optional expiration timestamp */
  expiresAt?: number;
}

/**
 * Payment settlement information from on-chain verification
 */
export interface PaymentSettlement {
  /** Invoice ID this settlement corresponds to */
  invoiceId: string;

  /** Payer's NFT account address */
  payerNft: Address;

  /** Merchant's NFT account address */
  merchantNft: Address;

  /** Amount paid in TBC (nanocoins) */
  amountTbc: bigint;

  /** Transaction hash */
  txHash: string;

  /** Block number where settlement occurred */
  blockNumber: number;

  /** Timestamp of settlement */
  timestamp: number;

  /** Payment status */
  status: PaymentStatus;
}

/**
 * Parameters for creating an invoice
 */
export interface CreateInvoiceParams {
  /** Merchant's NFT account address */
  merchantNft: Address;

  /** Payment amount in TBC (nanocoins) */
  amountTbc: bigint;

  /** Optional order ID for merchant tracking */
  orderId?: string;

  /** Optional human-readable description */
  description?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Optional expiration duration in seconds (default: no expiration) */
  expirationSeconds?: number;
}

/**
 * TON Connect wallet link parameters
 */
export interface WalletLinkParams {
  /** The invoice to create a payment link for */
  invoice: Invoice;

  /** Optional callback URL after payment */
  returnUrl?: string;
}

/**
 * Account information retrieved from Payment Hub
 */
export interface AccountInfo {
  /** NFT account address */
  nftAddress: Address;

  /** Current TBC balance (nanocoins) */
  balance: bigint;

  /** Account state */
  state: AccountState;

  /** Whether account can send payments */
  canSend: boolean;

  /** Whether account can receive payments */
  canReceive: boolean;
}

/**
 * SDK Configuration
 */
export interface TonbankcardConfig {
  /** TON network: 'mainnet' or 'testnet' */
  network: 'mainnet' | 'testnet';

  /** Payment Hub contract address */
  paymentHubAddress: Address;

  /** Optional RPC endpoint URL */
  rpcEndpoint?: string;

  /** Optional API endpoint for invoice resolution (read-only) */
  apiEndpoint?: string;
}

/**
 * Transaction verification result
 */
export interface TransactionVerification {
  /** Whether transaction is valid and confirmed */
  isValid: boolean;

  /** Transaction hash */
  txHash: string;

  /** Number of confirmations */
  confirmations: number;

  /** Whether transaction matches the invoice */
  matchesInvoice: boolean;

  /** Error message if verification failed */
  error?: string;
}

/**
 * Merchant payment event from on-chain logs
 */
export interface MerchantPaymentEvent {
  /** Payer's NFT address */
  payerNft: Address;

  /** Merchant's NFT address */
  merchantNft: Address;

  /** Amount paid in TBC */
  amountTbc: bigint;

  /** Hash of the payment payload */
  payloadHash: bigint;

  /** Timestamp of the payment */
  timestamp: number;

  /** Transaction hash */
  txHash: string;

  /** Block number */
  blockNumber: number;
}
