/**
 * TONBANKCARD Wallet UI - TON Connect Module Barrel
 *
 * Public entry point for the TON Connect v2 integration. Importing
 * from `'@tonbankcard/wallet-ui/tonconnect'` should give the consumer
 * everything they need to:
 *
 * 1. Validate / build a TON Connect manifest.
 * 2. Render a wallet selector modal.
 * 3. Generate per-wallet universal and deep links.
 * 4. Render scannable QR codes for cross-device flows.
 * 5. Manage connection state across page reloads.
 */

export {
  KNOWN_WALLETS,
  getWalletById,
  detectPlatform,
  walletsForPlatform,
  type TonConnectWallet,
  type WalletPlatform,
  type WalletBridgeConfig,
  type WalletBridgeType,
  type SseBridgeConfig,
  type JsBridgeConfig,
} from './wallets';

export {
  buildManifest,
  validateManifest,
  serializeManifest,
  type TonConnectManifest,
  type ManifestValidationResult,
} from './manifest';

export {
  assertValidAddress,
  buildTonTransferLink,
  buildWalletConnectLink,
  buildWalletTransferLink,
  encodeTonConnectRequest,
  resolveTonLinks,
  type TonTransferParams,
  type TonConnectRequestItem,
  type TonConnectRequest,
} from './deepLink';

export {
  generateQRMatrix,
  generateQRSvg,
  generateQRDataUrl,
  type QRCodeOptions,
  type QRErrorLevel,
} from './qrCode';

export {
  WalletSelector,
  type WalletSelectorOptions,
} from './walletSelector';

export {
  TonConnectConnector,
  type TonConnectConnectorOptions,
  type ConnectionStatus,
  type ConnectionState,
  type ConnectorEvent,
  type ConnectorEventHandler,
  type ConnectorStorage,
} from './connector';
