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
}
