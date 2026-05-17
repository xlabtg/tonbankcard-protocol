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

// =============================================================================
// PHASE 4: RECURRING PAYMENT TYPES (Merchant View)
// =============================================================================

/**
 * Recurring payment subscriber record for merchant dashboard
 */
export interface RecurringSubscriber {
  /** Mandate ID */
  mandateId: string;

  /** Payer's address */
  payerAddress: string;

  /** Amount per period in nanocoins */
  amountPerPeriod: string;

  /** Period in seconds */
  periodSeconds: number;

  /** Subscriber status */
  status: 'active' | 'cancelled' | 'completed';

  /** Number of successful payments */
  paymentCount: number;

  /** Total volume received from this subscriber */
  totalVolume: string;

  /** When subscription was created */
  createdAt: number;

  /** Next expected payment timestamp */
  nextPaymentAt?: number;
}

/**
 * Recurring payments statistics for merchant dashboard
 */
export interface RecurringPaymentStats {
  /** Total active subscribers */
  activeSubscribers: number;

  /** Total recurring volume (all time) */
  totalRecurringVolume: string;

  /** Monthly recurring revenue */
  monthlyRecurringRevenue: string;

  /** Average subscription duration in days */
  averageSubscriptionDays: number;

  /** Churn rate (cancellations / total) */
  churnRate: number;
}

// =============================================================================
// PHASE 4: MULTI-SIG PAYMENT TYPES (Merchant View)
// =============================================================================

/**
 * Multi-sig payment record for merchant dashboard
 */
export interface MultiSigPaymentRecord {
  /** Payment ID */
  paymentId: string;

  /** Payer address */
  payerAddress: string;

  /** Amount in nanocoins */
  amount: string;

  /** Whether payment was from a multi-sig card */
  isMultiSig: boolean;

  /** Number of approvals received */
  approvalCount: number;

  /** Payment timestamp */
  timestamp: number;

  /** Transaction hash */
  txHash?: string;
}

// =============================================================================
// E4: TRANSPARENCY DASHBOARD TYPES (Issue #135)
// =============================================================================

/**
 * Configuration for the public transparency dashboard.
 *
 * The transparency dashboard is unbound to any specific merchant — it
 * renders the aggregated protocol snapshot served by the indexer.
 */
export interface TransparencyDashboardConfig {
  /** Container element ID to render into (required) */
  containerId: string;

  /** Dashboard color theme */
  theme?: 'light' | 'dark';

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Callback when the dashboard has mounted */
  onReady?: () => void;
}

/**
 * Latest aggregated protocol metrics for a single period.
 * Mirrors `TransparencyProtocolMetricsRow` from the indexer API.
 */
export interface TransparencyProtocolMetricsRow {
  periodStart: number;
  periodEnd: number;
  activeAccounts: number;
  /** String representation of bigint (nanocoins) */
  tbcVolumeTransferred: string;
  transferCount: number;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Latest aggregated lock-activity counters for a single period.
 * Mirrors `TransparencyLockActivityRow` from the indexer API.
 */
export interface TransparencyLockActivityRow {
  periodStart: number;
  periodEnd: number;
  locksSet: number;
  locksCleared: number;
  locksActive: number;
  appealsFiled: number;
  appealsOverturned: number;
  appealsUpheld: number;
  blockNumber: number;
  transactionHash: string;
}

/**
 * A single recorded parameter change (PP-* governance flow).
 * Mirrors `TransparencyParameterChangeRow` from the indexer API.
 */
export interface TransparencyParameterChangeRow {
  parameterId: string;
  oldValueHash: string;
  newValueHash: string;
  effectiveBlock: number;
  governanceProposalId: number | null;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

/**
 * Full transparency snapshot as returned by
 * `GET /api/v1/transparency/metrics`. Documented in
 * docs/governance/TRANSPARENCY_REPORTING.md §4.1.
 */
export interface TransparencyMetricsSnapshot {
  disclaimer: string;
  snapshot: {
    indexedAt: number;
    latestBlockIndexed: number;
  };
  protocolMetrics: {
    latest: TransparencyProtocolMetricsRow | null;
    history: TransparencyProtocolMetricsRow[];
    periodCount: number;
  };
  lockActivity: {
    latest: TransparencyLockActivityRow | null;
    history: TransparencyLockActivityRow[];
    periodCount: number;
  };
  parameterChanges: {
    total: number;
    history: TransparencyParameterChangeRow[];
  };
}
