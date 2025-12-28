/**
 * TONBANKCARD External Payment Providers Adapter - Type Definitions
 *
 * This module defines the core types for the adapter layer that integrates
 * TONBANKCARD with external payment and exchange providers (ChangeNOW, NOWPayments).
 *
 * ⚠️ SECURITY PRINCIPLES:
 * - This is an off-chain service/backend adapter
 * - Works as orchestrator + indexer
 * - DOES NOT custody funds
 * - DOES NOT store user private keys
 * - All operations are user-initiated
 * - Cannot hold, modify, or revert transactions
 */

/**
 * Supported external payment/exchange providers
 */
export type ExternalProvider = 'ChangeNOW' | 'NOWPayments';

/**
 * Transaction status lifecycle
 */
export type TransactionStatus =
  | 'pending'      // Transaction created, waiting for user action
  | 'waiting'      // Waiting for incoming payment
  | 'confirming'   // Payment received, waiting for confirmations
  | 'exchanging'   // Exchange in progress (ChangeNOW)
  | 'sending'      // Sending to destination
  | 'finished'     // Successfully completed
  | 'failed'       // Failed or expired
  | 'refunded';    // Refunded to user

/**
 * Flow type for ChangeNOW exchanges
 */
export type ChangeNOWFlow = 'standard' | 'fixed-rate';

/**
 * Core data model for external transactions
 *
 * This represents the off-chain tracking of operations initiated
 * by users through external providers.
 */
export interface ExternalTransaction {
  /** External provider (ChangeNOW or NOWPayments) */
  provider: ExternalProvider;

  /** Provider's unique transaction ID */
  providerTxId: string;

  /** NFT Account ID (uint256) associated with this operation */
  nftAccountId: string;

  /** Input amount (in source currency) */
  amountIn: string;

  /** Output amount (in destination currency) */
  amountOut: string;

  /** Input asset ticker (e.g., 'ton', 'btc', 'tbc') */
  assetIn: string;

  /** Output asset ticker (e.g., 'ton', 'btc', 'tbc') */
  assetOut: string;

  /** Current transaction status */
  status: TransactionStatus;

  /** TON blockchain transaction hash (if applicable) */
  tonTxHash?: string;

  /** Timestamp when transaction was created */
  createdAt: Date;

  /** Timestamp of last status update */
  updatedAt: Date;

  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * ChangeNOW exchange creation request
 */
export interface CreateSwapRequest {
  /** Source currency ticker */
  fromCurrency: string;

  /** Destination currency ticker */
  toCurrency: string;

  /** Source blockchain network */
  fromNetwork: string;

  /** Destination blockchain network */
  toNetwork: string;

  /** Amount to exchange */
  fromAmount: string;

  /** Destination address where funds will be sent */
  address: string;

  /** NFT Account ID for tracking */
  nftAccountId: string;

  /** Exchange flow type */
  flow: ChangeNOWFlow;

  /** Optional: refund address in case of failure */
  refundAddress?: string;

  /** Optional: extra ID for destination (memo, tag, etc.) */
  extraId?: string;
}

/**
 * ChangeNOW exchange quote response
 */
export interface SwapQuote {
  /** Estimated output amount */
  estimatedAmount: string;

  /** Exchange rate */
  rate?: string;

  /** Rate ID for fixed-rate flow */
  rateId?: string;

  /** Minimum exchange amount */
  minAmount?: string;

  /** Maximum exchange amount */
  maxAmount?: string;

  /** Network fees */
  networkFee?: string;
}

/**
 * ChangeNOW exchange creation response
 */
export interface CreateSwapResponse {
  /** Exchange ID from ChangeNOW */
  id: string;

  /** Deposit address where user sends funds */
  payinAddress: string;

  /** Destination address */
  payoutAddress: string;

  /** Expected amount from user */
  fromAmount: string;

  /** Expected output amount */
  toAmount: string;

  /** Current status */
  status: string;

  /** Payout transaction hash (when available) */
  payoutHash?: string;

  /** Additional data */
  [key: string]: unknown;
}

/**
 * NOWPayments invoice creation request
 */
export interface CreateInvoiceRequest {
  /** Price amount in fiat or crypto */
  price_amount: number;

  /** Price currency (e.g., 'USD', 'EUR') */
  price_currency: string;

  /** Currency to receive payment in */
  pay_currency: string;

  /** NFT Account ID for merchant */
  nftAccountId: string;

  /** IPN callback URL for status updates */
  ipn_callback_url?: string;

  /** Success redirect URL */
  success_url?: string;

  /** Cancel redirect URL */
  cancel_url?: string;

  /** Order ID or description */
  order_id?: string;

  /** Order description */
  order_description?: string;
}

/**
 * NOWPayments invoice creation response
 */
export interface CreateInvoiceResponse {
  /** Invoice ID */
  id: string;

  /** Payment URL for user */
  invoice_url: string;

  /** Price amount */
  price_amount: string;

  /** Price currency */
  price_currency: string;

  /** Pay currency */
  pay_currency: string;

  /** Pay amount in crypto */
  pay_amount: string;

  /** Payment status */
  payment_status: string;

  /** Order ID */
  order_id?: string;

  /** Created at timestamp */
  created_at: string;

  /** Additional data */
  [key: string]: unknown;
}

/**
 * NOWPayments IPN (webhook) callback payload
 */
export interface PaymentCallback {
  /** Payment ID */
  payment_id: number;

  /** Payment status */
  payment_status: string;

  /** Pay address */
  pay_address: string;

  /** Price amount */
  price_amount: number;

  /** Price currency */
  price_currency: string;

  /** Pay amount */
  pay_amount: number;

  /** Pay currency */
  pay_currency: string;

  /** Order ID */
  order_id?: string;

  /** Order description */
  order_description?: string;

  /** Purchase ID */
  purchase_id?: string;

  /** Outcome amount */
  outcome_amount?: number;

  /** Outcome currency */
  outcome_currency?: string;

  /** Payin hash */
  payin_hash?: string;

  /** Additional data */
  [key: string]: unknown;
}

/**
 * Configuration for ChangeNOW adapter
 */
export interface ChangeNOWConfig {
  /** API key for ChangeNOW */
  apiKey: string;

  /** Base URL for API (defaults to https://api.changenow.io) */
  baseUrl?: string;

  /** API version (defaults to v2) */
  apiVersion?: string;
}

/**
 * Configuration for NOWPayments adapter
 */
export interface NOWPaymentsConfig {
  /** API key for NOWPayments */
  apiKey: string;

  /** Base URL for API (defaults to https://api.nowpayments.io) */
  baseUrl?: string;

  /** IPN secret key for webhook verification */
  ipnSecretKey?: string;
}

/**
 * Error response from external providers
 */
export interface ProviderError {
  /** Error message */
  message: string;

  /** Error code (if provided) */
  code?: string;

  /** HTTP status code */
  statusCode?: number;

  /** Provider name */
  provider: ExternalProvider;
}
