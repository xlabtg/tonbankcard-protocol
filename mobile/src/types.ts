/**
 * TONBANKCARD Mobile Core - Type Definitions
 *
 * NON-CUSTODIAL GUARANTEE:
 * This package contains NO signing logic, NO private key storage, and NO custody mechanisms.
 * All payment operations require user wallet consent via TON Connect or similar.
 */

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
 * Mobile SDK configuration
 */
export interface MobileConfig {
  /** TON network: 'mainnet' or 'testnet' */
  network: 'mainnet' | 'testnet';

  /** Payment Hub contract address */
  paymentHubAddress: string;

  /** Optional RPC endpoint URL */
  rpcEndpoint?: string;

  /** Optional API endpoint for data queries (read-only) */
  apiEndpoint?: string;

  /** Optional exact host allowlist for HTTPS payment return URLs */
  allowedReturnUrlHosts?: readonly string[];
}

/**
 * Card account information retrieved from Payment Hub
 *
 * READ-ONLY: This represents account state observed on-chain.
 */
export interface CardAccount {
  /** NFT account address */
  nftAddress: string;

  /** Current TBC balance in nanocoins (string for precision) */
  balance: string;

  /** Account state */
  state: AccountState;

  /** Whether account can send payments */
  canSend: boolean;

  /** Whether account can receive payments */
  canReceive: boolean;

  /** Timestamp of last sync (Unix seconds) */
  lastSyncedAt: number;
}

/**
 * Payment request parameters for generating deep links
 *
 * This is informational only - it does NOT execute payments.
 */
export interface PaymentRequest {
  /** Merchant's NFT account address */
  merchantNft: string;

  /** Payment amount in TBC nanocoins (string for precision) */
  amountTbc: string;

  /** Optional order ID for merchant tracking */
  orderId?: string;

  /** Optional human-readable description */
  description?: string;

  /** Optional callback URL after payment */
  returnUrl?: string;
}

/**
 * Transaction history item
 */
export interface TransactionItem {
  /** Unique transaction identifier */
  id: string;

  /** Transaction type */
  type: 'send' | 'receive';

  /** Counterparty address */
  counterparty: string;

  /** Amount in nanocoins (string for precision) */
  amount: string;

  /** Transaction timestamp (Unix seconds) */
  timestamp: number;

  /** Transaction confirmation status */
  status: 'confirmed' | 'pending';

  /** On-chain transaction hash (if confirmed) */
  txHash?: string;
}

/**
 * Sync status information from the indexer
 */
export interface SyncStatus {
  /** Last indexed block number */
  lastBlock: number;

  /** Timestamp of last sync (Unix seconds) */
  lastSyncedAt: number;

  /** Whether indexer is currently syncing */
  isSyncing: boolean;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  /** Notify when payment is received */
  paymentReceived: boolean;

  /** Notify when payment is sent */
  paymentSent: boolean;

  /** Notify when account state changes */
  accountStateChanged: boolean;

  /** Notify when multi-sig proposal needs approval */
  multiSigProposalPending: boolean;

  /** Notify when recurring payment is executed */
  recurringPaymentExecuted: boolean;

  /** Notify when bridge transaction is confirmed */
  bridgeTransactionConfirmed: boolean;
}

// =============================================================================
// PHASE 4: MULTI-SIGNATURE CARD TYPES
// =============================================================================

/**
 * Multi-sig proposal for mobile display
 */
export interface MobileMultiSigProposal {
  /** Proposal ID */
  proposalId: string;

  /** Recipient address */
  recipient: string;

  /** Amount in nanocoins */
  amount: string;

  /** Status */
  status: 'pending' | 'approved' | 'rejected' | 'executed';

  /** Approval count */
  approvalCount: number;

  /** Required approvals */
  requiredApprovals: number;

  /** Timestamp */
  createdAt: number;
}

// =============================================================================
// PHASE 4: RECURRING PAYMENT TYPES
// =============================================================================

/**
 * Recurring mandate for mobile display
 */
export interface MobileRecurringMandate {
  /** Mandate ID */
  mandateId: string;

  /** Merchant address */
  merchantAddress: string;

  /** Amount per period */
  amountPerPeriod: string;

  /** Period in seconds */
  periodSeconds: number;

  /** Status */
  status: 'active' | 'cancelled' | 'completed';

  /** Execution count */
  executionCount: number;

  /** Max executions */
  maxExecutions: number;
}

// =============================================================================
// PHASE 4: CROSS-CHAIN BRIDGE TYPES
// =============================================================================

/**
 * Bridge intent for mobile display
 */
export interface MobileBridgeIntent {
  /** Intent ID */
  intentId: string;

  /** Target chain */
  targetChain: string;

  /** Amount */
  amount: string;

  /** Status */
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';

  /** Timestamp */
  timestamp: number;
}
