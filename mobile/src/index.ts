/**
 * TONBANKCARD Mobile Core
 *
 * A platform-agnostic core logic layer for TONBANKCARD mobile applications.
 *
 * CRITICAL SECURITY PRINCIPLES:
 * =============================
 * 1. This package is READ-ONLY with respect to funds
 * 2. It NEVER signs transactions
 * 3. It NEVER stores private keys
 * 4. It NEVER acts as a payment authority
 * 5. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Users trust THEIR WALLET for transaction signing
 * - This package is a CONVENIENCE WRAPPER, not a protocol layer
 * - All data is read from on-chain state or the indexer API
 *
 * @packageDocumentation
 */

export { AccountService } from './services/AccountService';
export { PaymentService } from './services/PaymentService';
export { SyncService } from './services/SyncService';

export {
  // Types
  AccountState,
  MobileConfig,
  CardAccount,
  PaymentRequest,
  TransactionItem,
  SyncStatus,
  NotificationPreferences,
  // Phase 4 Types
  MobileMultiSigProposal,
  MobileRecurringMandate,
  MobileBridgeIntent,
} from './types';

export {
  // Utilities
  formatTBC,
  shortAddress,
  formatTimestamp,
  formatRelativeTime,
  isValidTonAddress,
  assertAmount,
} from './utils';

/**
 * SDK Version
 */
export const VERSION = '1.0.0';

/**
 * Default configuration for mainnet
 */
export const MAINNET_CONFIG = {
  network: 'mainnet' as const,
  paymentHubAddress: '', // To be filled when contract is deployed
  rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
};

/**
 * Default configuration for testnet
 */
export const TESTNET_CONFIG = {
  network: 'testnet' as const,
  paymentHubAddress: '', // To be filled when contract is deployed
  rpcEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
};
