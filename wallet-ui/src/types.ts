/**
 * TONBANKCARD Wallet UI - Type Definitions
 *
 * SECURITY NOTICE:
 * This module defines types for a READ-ONLY, PRESENTATIONAL wallet interface.
 * - NO private key storage
 * - NO transaction signing
 * - NO custody of funds
 * - The blockchain is the ONLY source of truth
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
 * Available wallet views
 */
export enum WalletView {
  BALANCE = 'balance',
  TRANSACTIONS = 'transactions',
  SETTINGS = 'settings',
}

/**
 * Wallet UI configuration
 */
export interface WalletUIConfig {
  /** TON network: 'mainnet' or 'testnet' */
  network: 'mainnet' | 'testnet';

  /** Payment Hub contract address */
  paymentHubAddress: string;

  /** Optional RPC endpoint URL */
  rpcEndpoint?: string;

  /** Optional API endpoint for data retrieval (read-only) */
  apiEndpoint?: string;

  /** Container element ID to render the wallet UI into */
  containerId: string;

  /** UI theme */
  theme?: 'light' | 'dark';

  /** Callback on error */
  onError?: (error: Error) => void;

  /** Callback when widget is ready */
  onReady?: () => void;

  /**
   * TON Connect v2 dapp manifest URL. When provided, the "Connect
   * Wallet" button opens a wallet selector modal (Tonkeeper, Tonhub,
   * OpenMask, ...) instead of a bare `ton://transfer` link. The URL
   * MUST be HTTPS and point to a publicly fetchable manifest document.
   */
  tonConnectManifestUrl?: string;

  /**
   * Optional inline TON Connect manifest. When supplied, the manifest
   * is validated at construction time (HTTPS URLs, required fields).
   */
  tonConnectManifest?: TonConnectManifestConfig;
}

/**
 * TON Connect manifest configuration, surfaced through the public
 * {@link WalletUIConfig.tonConnectManifest} field.
 */
export interface TonConnectManifestConfig {
  url: string;
  name: string;
  iconUrl: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
}

/**
 * Wallet account information (read-only view of on-chain state)
 */
export interface WalletAccount {
  /** NFT account address */
  nftAddress: string;

  /** Current TBC balance in nanocoins */
  balance: string;

  /** Account state */
  state: AccountState;

  /** Whether account can send payments */
  canSend: boolean;

  /** Whether account can receive payments */
  canReceive: boolean;
}

/**
 * Transaction record for display purposes
 */
export interface TransactionRecord {
  /** Unique transaction identifier */
  id: string;

  /** Transaction type */
  type: 'send' | 'receive';

  /** Counterparty address */
  counterparty: string;

  /** Amount in nanocoins */
  amount: string;

  /** Unix timestamp in seconds */
  timestamp: number;

  /** Transaction status */
  status: 'confirmed' | 'pending';

  /** Optional on-chain transaction hash */
  txHash?: string;
}

// =============================================================================
// PHASE 4: MULTI-SIGNATURE CARD TYPES
// =============================================================================

/**
 * Multi-sig card status display information
 */
export interface MultiSigCardStatus {
  /** Whether multi-sig is enabled for this card */
  isEnabled: boolean;

  /** Number of required co-signatures */
  requiredSignatures: number;

  /** Number of registered co-signers */
  signerCount: number;

  /** Pending proposals count */
  pendingProposals: number;
}

// =============================================================================
// PHASE 4: RECURRING PAYMENT TYPES
// =============================================================================

/**
 * Recurring payment mandate display information
 */
export interface RecurringMandateDisplay {
  /** Mandate ID */
  mandateId: string;

  /** Merchant address */
  merchantAddress: string;

  /** Amount per period in nanocoins */
  amountPerPeriod: string;

  /** Period in human-readable format */
  periodLabel: string;

  /** Mandate status */
  status: 'active' | 'cancelled' | 'completed';

  /** Number of executions */
  executionCount: number;

  /** Next execution time (Unix timestamp) */
  nextExecutionAt?: number;
}

// =============================================================================
// PHASE 4: CROSS-CHAIN BRIDGE TYPES
// =============================================================================

/**
 * Bridge transaction display information
 */
export interface BridgeTransactionDisplay {
  /** Intent ID */
  intentId: string;

  /** Target chain name */
  targetChain: string;

  /** Amount being bridged */
  amount: string;

  /** Bridge status */
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';

  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// PHASE 4: LENDING TYPES
// =============================================================================

/**
 * Lending intent display information
 */
export interface LendingIntentDisplay {
  /** Intent ID */
  intentId: string;

  /** Collateral amount */
  collateralAmount: string;

  /** Target lender name */
  targetLender: string;

  /** Intent state */
  state: 'active' | 'cancelled';

  /** Timestamp */
  timestamp: number;
}
