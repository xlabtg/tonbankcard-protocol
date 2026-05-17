/**
 * TONBANKCARD Wallet UI
 *
 * A lightweight, non-custodial wallet interface for viewing TONBANKCARD
 * NFT card balances, transaction history, and account settings. Ships
 * with a full TON Connect v2 integration that supports multi-wallet
 * connection, deep links, and QR code payment flows.
 *
 * CRITICAL SECURITY PRINCIPLES:
 * =============================
 * 1. This UI is READ-ONLY and PRESENTATIONAL
 * 2. It NEVER signs transactions (the user's wallet signs)
 * 3. It NEVER stores private keys
 * 4. It NEVER custodies funds
 * 5. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Users trust THEIR WALLET for signing
 * - This UI displays ON-CHAIN state and constructs sign-requests
 * - Wallet connection uses TON Connect v2 universal / deep links
 * - No sensitive operations are performed by this code
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

// TON Connect v2 integration. Importable directly via
// `@tonbankcard/wallet-ui` or the dedicated `'/tonconnect'` subpath.
export {
  KNOWN_WALLETS,
  getWalletById,
  detectPlatform,
  walletsForPlatform,
  buildManifest,
  validateManifest,
  serializeManifest,
  buildTonTransferLink,
  buildWalletConnectLink,
  buildWalletTransferLink,
  encodeTonConnectRequest,
  resolveTonLinks,
  generateQRMatrix,
  generateQRSvg,
  generateQRDataUrl,
  WalletSelector,
  TonConnectConnector,
} from './tonconnect';

export type {
  TonConnectWallet,
  WalletPlatform,
  WalletBridgeConfig,
  WalletBridgeType,
  SseBridgeConfig,
  JsBridgeConfig,
  TonConnectManifest,
  ManifestValidationResult,
  TonTransferParams,
  TonConnectRequestItem,
  TonConnectRequest,
  QRCodeOptions,
  QRErrorLevel,
  WalletSelectorOptions,
  TonConnectConnectorOptions,
  ConnectionStatus,
  ConnectionState,
  ConnectorEvent,
  ConnectorEventHandler,
  ConnectorStorage,
} from './tonconnect';

/**
 * Wallet UI Version
 */
export const VERSION = '1.1.0';
