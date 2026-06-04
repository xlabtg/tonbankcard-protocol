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
export type ExternalProvider =
  | 'ChangeNOW'
  | 'NOWPayments'
  | 'CoinRabbit'
  | 'RecurringPayments';

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

// =============================================================================
// LENDING ADAPTER TYPES (Issue 6.2 - CoinRabbit Integration)
// =============================================================================

/**
 * ⚠️ CRITICAL DESIGN PRINCIPLES FOR LENDING ADAPTER
 *
 * The Lending Adapter is intentionally WEAK by design:
 * - DOES NOT issue loans
 * - DOES NOT custody collateral
 * - DOES NOT enforce repayments
 * - DOES NOT liquidate assets
 * - DOES NOT track debt
 * - DOES NOT give lender any protocol-level authority
 *
 * It serves purely as a COORDINATION and SIGNALING layer.
 * Lending happens OUTSIDE the protocol.
 */

/**
 * Borrower identity based on NFT account ownership
 *
 * In TONBANKCARD, identity is determined by NFT ownership, NOT wallet address.
 * This enables account abstraction where the same identity persists
 * even if the underlying wallet changes.
 */
export interface BorrowerIdentity {
  /** NFT Account ID (e.g., '7777001', '8888042') - PRIMARY identifier */
  nftAccountId: string;

  /** NFT collection address for validation */
  collectionAddress: string;

  /** Current owner wallet address (informational only, may change) */
  currentOwnerAddress?: string;

  /** Whether the NFT account is valid (from whitelisted collection, not burned) */
  isValid: boolean;

  /** Timestamp when identity was resolved */
  resolvedAt: Date;
}

/**
 * Read-only collateral signal information
 *
 * This represents a snapshot of collateral signal data from Issue 6.1.
 * The adapter can only READ this information, never modify it.
 */
export interface CollateralSignalInfo {
  /** Unique collateral signal ID (from Issue 6.1 contract) */
  signalId: string;

  /** NFT Account ID that created the signal */
  nftAccountId: string;

  /** Asset type being signaled as collateral */
  assetType: string;

  /** Amount being signaled (for display purposes only) */
  signalAmount: string;

  /** Whether the signal is currently active */
  isActive: boolean;

  /** On-chain timestamp when signal was created */
  createdAt: Date;

  /** On-chain timestamp when signal expires (if applicable) */
  expiresAt?: Date;

  /** TON blockchain transaction hash of the signal creation */
  signalTxHash?: string;
}

/**
 * Loan intent request from borrower
 *
 * This represents the borrower's INTENT to request a loan.
 * The protocol does not process or fulfill this - it only
 * provides standardized metadata for external lenders.
 */
export interface LoanIntentRequest {
  /** NFT Account ID of the borrower */
  nftAccountId: string;

  /** Collateral signal ID (from Issue 6.1) */
  collateralSignalId?: string;

  /** Requested loan amount (informational only) */
  requestedAmount?: string;

  /** Requested loan currency (informational only) */
  requestedCurrency?: string;

  /** External lender identifier (e.g., 'coinrabbit') */
  targetLender: string;

  /** Optional callback URL for lender */
  callbackUrl?: string;

  /** Optional user-provided metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Loan intent response with lender deep-link
 *
 * This provides standardized metadata and optional UX deep-links
 * for the borrower to proceed with the external lender.
 */
export interface LoanIntentResponse {
  /** Unique intent ID for tracking */
  intentId: string;

  /** Resolved borrower identity */
  borrowerIdentity: BorrowerIdentity;

  /** Collateral signal info (if collateral was signaled) */
  collateralInfo?: CollateralSignalInfo;

  /** Deep-link URL to external lender (user-facing) */
  lenderUrl?: string;

  /** Timestamp when intent was created */
  createdAt: Date;

  /** Intent expiration time */
  expiresAt: Date;

  /**
   * Verification data that lender can use to verify on-chain
   * This contains READ-ONLY references, not proofs or guarantees
   */
  verificationData: LenderVerificationData;
}

/**
 * Read-only verification data for external lenders
 *
 * ⚠️ CRITICAL: This data is for VERIFICATION only.
 * The protocol makes NO guarantees about:
 * - Collateral availability
 * - Balance sufficiency
 * - Repayment ability
 *
 * Lenders must perform their own due diligence.
 */
export interface LenderVerificationData {
  /** NFT Account ID to verify */
  nftAccountId: string;

  /** NFT collection address for on-chain verification */
  collectionAddress: string;

  /** NFT item index within collection */
  nftIndex?: number;

  /** Collateral signal ID for on-chain verification (if applicable) */
  collateralSignalId?: string;

  /** Smart contract address to query for collateral signal verification */
  collateralContractAddress?: string;

  /** Chain ID (TON mainnet = 1, testnet = 2) */
  chainId: number;

  /** Protocol version for compatibility */
  protocolVersion: string;

  /**
   * ⚠️ DISCLAIMER: Protocol does not guarantee any of this data.
   * Lender must verify on-chain independently.
   */
  disclaimer: string;
}

/**
 * Off-chain loan reference record
 *
 * This is a READ-ONLY record linking an external loan to an NFT account.
 * The protocol does NOT track debt, enforce repayment, or manage the loan.
 */
export interface LoanReference {
  /** Unique reference ID */
  referenceId: string;

  /** External provider (CoinRabbit) */
  provider: 'CoinRabbit';

  /** External lender's loan ID */
  externalLoanId?: string;

  /** NFT Account ID associated with the loan */
  nftAccountId: string;

  /** Collateral signal ID (if applicable) */
  collateralSignalId?: string;

  /** Loan intent ID that initiated this */
  intentId: string;

  /** When the reference was created */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Reference status (for tracking purposes only)
   * The protocol does NOT enforce or act on this status
   */
  status: LoanReferenceStatus;

  /** Additional metadata from lender */
  metadata?: Record<string, unknown>;
}

/**
 * Loan reference status
 *
 * ⚠️ NOTE: This is purely for TRACKING and UX purposes.
 * The protocol does NOT:
 * - Enforce loan status
 * - Take action based on status
 * - Guarantee status accuracy
 */
export type LoanReferenceStatus =
  | 'pending'     // Intent created, waiting for lender
  | 'active'      // Lender confirmed loan is active
  | 'completed'   // Loan marked as repaid by lender
  | 'cancelled'   // Intent/loan was cancelled
  | 'unknown';    // Status unknown (lender not responding)

/**
 * Configuration for CoinRabbit lending adapter
 */
export interface CoinRabbitConfig {
  /** Partner API key for CoinRabbit (if available) */
  apiKey?: string;

  /** Base URL for CoinRabbit (defaults to https://coinrabbit.io) */
  baseUrl?: string;

  /** Partner affiliate ID for deep-links */
  affiliateId?: string;

  /** NFT Account Resolver contract address */
  resolverContractAddress?: string;

  /** Collateral Signal contract address (Issue 6.1) */
  collateralContractAddress?: string;

  /** Chain ID (1 = mainnet, 2 = testnet) */
  chainId?: number;
}

/**
 * Collateral verification request (read-only)
 *
 * Used by lenders to verify collateral signal on-chain.
 */
export interface CollateralVerificationRequest {
  /** Collateral signal ID to verify */
  signalId: string;

  /** NFT Account ID that should own the signal */
  nftAccountId: string;
}

/**
 * Collateral verification response (read-only)
 *
 * ⚠️ This is a READ-ONLY snapshot. Protocol makes no guarantees.
 */
export interface CollateralVerificationResponse {
  /** Whether signal exists and is active */
  isValid: boolean;

  /** Whether NFT account matches signal owner */
  ownershipVerified: boolean;

  /** Collateral signal details (if valid) */
  signalInfo?: CollateralSignalInfo;

  /** Block number at which verification was performed */
  verifiedAtBlock?: number;

  /** Timestamp of verification */
  verifiedAt: Date;

  /** Verification disclaimer */
  disclaimer: string;
}

// =============================================================================
// PHASE 4: MULTI-SIGNATURE CARD TYPES
// =============================================================================

/**
 * Multi-signature card configuration
 *
 * Multi-sig is a PERMISSION LAYER, not a custodial mechanism.
 * The NFT owner ALWAYS remains the primary authority.
 */
export interface MultiSigCardConfig {
  /** NFT account address */
  nftAccountId: string;

  /** Number of required co-signatures (1-3) */
  requiredSignatures: number;

  /** List of co-signer addresses */
  signers: string[];

  /** Whether multi-sig is currently active */
  isActive: boolean;

  /** When configuration was created */
  createdAt: Date;
}

/**
 * Multi-sig payment proposal
 *
 * Proposals are created by the NFT owner and require
 * co-signer approval before execution.
 */
export interface PaymentProposal {
  /** Unique proposal ID */
  proposalId: string;

  /** NFT account that created the proposal */
  nftAccountId: string;

  /** Payment recipient address */
  recipient: string;

  /** Payment amount */
  amount: string;

  /** Current proposal status */
  status: 'pending' | 'approved' | 'rejected' | 'executed';

  /** Number of approvals received */
  approvalCount: number;

  /** Required number of approvals */
  requiredApprovals: number;

  /** Addresses that have approved */
  approvers: string[];

  /** When proposal was created */
  createdAt: Date;
}

// =============================================================================
// PHASE 4: RECURRING PAYMENT TYPES
// =============================================================================

/**
 * Recurring payment mandate
 *
 * Mandates are USER-CREATED and USER-CONTROLLED.
 * Users can cancel at any time.
 * Merchants CANNOT create mandates on behalf of users.
 */
export interface RecurringPaymentMandate {
  /** Unique mandate ID */
  mandateId: string;

  /** Payer's NFT account ID */
  payerNftAccountId: string;

  /** Merchant's NFT account ID (recipient) */
  merchantNftAccountId: string;

  /** Amount per execution */
  amountPerPeriod: string;

  /** Interval between executions (in seconds) */
  periodSeconds: number;

  /** Maximum number of executions (0 = unlimited) */
  maxExecutions: number;

  /** Number of times executed so far */
  executionCount: number;

  /** Timestamp of last execution */
  lastExecutedAt?: Date;

  /** Mandate status */
  status: 'active' | 'cancelled' | 'completed';

  /** When mandate was created */
  createdAt: Date;
}

/**
 * Recurring payment execution record
 *
 * This is an off-chain record of a recurring payment execution.
 * The actual fund transfer happens through the Payment Hub contract.
 */
export interface RecurringPaymentExecution {
  /** Mandate ID */
  mandateId: string;

  /** Execution number */
  executionNumber: number;

  /** Amount transferred */
  amount: string;

  /** On-chain transaction hash */
  txHash?: string;

  /** Execution timestamp */
  executedAt: Date;

  /** Execution status */
  status: 'pending' | 'confirmed' | 'failed';
}

// =============================================================================
// PHASE 4: CROSS-CHAIN BRIDGE TYPES
// =============================================================================

/**
 * Supported target chains for cross-chain bridging
 */
export type BridgeTargetChain = 'ethereum' | 'bitcoin' | 'bsc' | 'polygon' | 'solana';

/**
 * Bridge target chain ID mapping
 */
export const BRIDGE_CHAIN_IDS: Record<BridgeTargetChain, number> = {
  ethereum: 1,
  bitcoin: 2,
  bsc: 3,
  polygon: 4,
  solana: 5,
};

/**
 * Cross-chain bridge intent
 *
 * Bridge intents are user-initiated coordination records.
 * Actual cross-chain fund movement happens through external providers.
 */
export interface BridgeIntent {
  /** Unique intent ID */
  intentId: string;

  /** NFT account initiating the bridge */
  nftAccountId: string;

  /** Target blockchain */
  targetChain: BridgeTargetChain;

  /** Amount to bridge (informational) */
  amount: string;

  /** Target address on destination chain */
  targetAddress: string;

  /** External provider handling the bridge (e.g., ChangeNOW) */
  provider: ExternalProvider;

  /** External provider's transaction ID */
  providerTxId?: string;

  /** Intent status */
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';

  /** When intent was created */
  createdAt: Date;

  /** When bridge was confirmed */
  confirmedAt?: Date;

  /** External chain transaction hash */
  externalTxHash?: string;
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /** Supported chains and their adapters */
  supportedChains: BridgeTargetChain[];

  /** Default swap provider */
  defaultProvider: ExternalProvider;

  /** Bridge contract address (on TON) */
  bridgeContractAddress?: string;
}

/**
 * Bridge quote request
 */
export interface BridgeQuoteRequest {
  /** Source asset on TON (e.g., 'ton', 'tbc') */
  fromAsset: string;

  /** Destination asset on target chain */
  toAsset: string;

  /** Target chain */
  targetChain: BridgeTargetChain;

  /** Amount to bridge */
  amount: string;
}

/**
 * Bridge quote response
 */
export interface BridgeQuoteResponse {
  /** Estimated output amount on target chain */
  estimatedAmount: string;

  /** Exchange rate */
  rate?: string;

  /** Network fees */
  networkFee?: string;

  /** Minimum amount */
  minAmount?: string;

  /** Quote expiration time */
  expiresAt: Date;

  /** Provider offering the quote */
  provider: ExternalProvider;
}

// =============================================================================
// PHASE 4: LENDING PROTOCOL INTEGRATION TYPES (Enhanced)
// =============================================================================

/**
 * Enhanced lending intent with protocol coordination
 *
 * Extends the base LoanIntentRequest with on-chain coordination data.
 * The protocol remains a passive observer - all enforcement is external.
 */
export interface LendingProtocolIntent {
  /** Unique intent ID */
  intentId: string;

  /** NFT account ID */
  nftAccountId: string;

  /** Collateral signal amount (informational) */
  collateralSignalAmount: string;

  /** Target lender ID (0 = CoinRabbit) */
  targetLenderId: number;

  /** Intent state */
  state: 'active' | 'cancelled';

  /** On-chain intent registration tx hash */
  registrationTxHash?: string;

  /** When intent was registered */
  createdAt: Date;

  /** When intent was last updated */
  updatedAt: Date;
}
