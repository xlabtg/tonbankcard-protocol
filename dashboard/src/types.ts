/**
 * TONBANKCARD Merchant Dashboard - Type Definitions
 *
 * NON-CUSTODIAL GUARANTEE:
 * This dashboard contains NO signing logic, NO private key storage, and NO custody mechanisms.
 * All data is read-only and sourced from the blockchain as the single source of truth.
 */

/**
 * Dashboard configuration options
 */
export interface DashboardConfig {
  /** Merchant's NFT account address (required) */
  merchantNft: string;

  /** Optional API endpoint URL */
  apiEndpoint?: string;

  /** Optional indexer endpoint URL */
  indexerEndpoint?: string;

  /** Container element ID to render the dashboard into (required) */
  containerId: string;

  /** Dashboard color theme */
  theme?: 'light' | 'dark';

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Callback when dashboard is ready */
  onReady?: () => void;
}

/**
 * A single payment record as observed on-chain
 */
export interface PaymentRecord {
  /** Unique payment identifier */
  id: string;

  /** Payer's wallet address */
  payerAddress: string;

  /** Payment amount in nanocoins (1 TBC = 10^9 nanocoins) */
  amount: string;

  /** Payment status as observed on-chain */
  status: 'settled' | 'pending' | 'failed' | 'expired';

  /** Optional merchant order ID */
  orderId?: string;

  /** Optional payment description */
  description?: string;

  /** Unix timestamp of the payment */
  timestamp: number;

  /** On-chain transaction hash */
  txHash?: string;
}

/**
 * Aggregated merchant statistics derived from on-chain data
 */
export interface MerchantStats {
  /** Total number of payments received */
  totalPayments: number;

  /** Total volume in nanocoins */
  totalVolume: string;

  /** Success rate as a ratio from 0 to 1 */
  successRate: number;

  /** Average payment amount in nanocoins */
  averageAmount: string;

  /** Period start timestamp */
  periodStart: number;

  /** Period end timestamp */
  periodEnd: number;
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookConfig {
  /** Webhook delivery URL */
  url: string;

  /** Events to subscribe to (e.g. ['payment.settled', 'payment.failed']) */
  events: string[];

  /** Optional shared secret for signature verification */
  secret?: string;

  /** Whether the webhook is currently enabled */
  enabled: boolean;
}

/**
 * Dashboard navigation views
 */
export enum DashboardView {
  OVERVIEW = 'overview',
  PAYMENTS = 'payments',
  GENERATE = 'generate',
  WEBHOOKS = 'webhooks',
}

/**
 * Parameters for generating a payment invoice link
 */
export interface InvoiceGeneratorParams {
  /** Payment amount in TBC nanocoins */
  amountTbc: string;

  /** Optional merchant order ID */
  orderId?: string;

  /** Optional payment description */
  description?: string;

  /** Optional expiration time in minutes */
  expirationMinutes?: number;
}
