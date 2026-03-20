/**
 * TONBANKCARD Wallet UI
 *
 * A lightweight, non-custodial wallet interface for viewing TONBANKCARD
 * NFT card balances, transaction history, and account settings.
 *
 * CRITICAL SECURITY PRINCIPLES:
 * =============================
 * 1. This UI is READ-ONLY and PRESENTATIONAL
 * 2. It NEVER signs transactions
 * 3. It NEVER stores private keys
 * 4. It NEVER custodies funds
 * 5. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Users trust THEIR WALLET for signing
 * - This UI displays ON-CHAIN state
 * - Wallet connection uses TON Connect deep links only
 * - No sensitive operations are performed
 *
 * @packageDocumentation
 */

export { TonbankcardWalletUI } from './components/WalletApp';

export {
  // Types
  AccountState,
  WalletView,
  WalletUIConfig,
  WalletAccount,
  TransactionRecord,
  // Phase 4 Types
  MultiSigCardStatus,
  RecurringMandateDisplay,
  BridgeTransactionDisplay,
  LendingIntentDisplay,
} from './types';

export {
  // Utilities
  formatTBC,
  shortAddress,
  formatDate,
  getAccountStateLabel,
} from './utils';

/**
 * Wallet UI Version
 */
export const VERSION = '1.0.0';
