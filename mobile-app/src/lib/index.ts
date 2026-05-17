/**
 * Public API of the mobile-app platform-agnostic library.
 *
 * Everything exported from this file is safe to consume from React Native
 * screens, unit tests, or future surfaces (web companion, Telegram MiniApp).
 *
 * SECURITY GUARANTEES (mirrors @tonbankcard/mobile-core):
 * 1. Read-only with respect to funds — no signing logic.
 * 2. No private key storage anywhere in this package.
 * 3. The blockchain is the single source of truth.
 * 4. Wallet consent (TON Connect) is required for every state-changing action.
 */

export {
  validateAppConfig,
  assertHttpsEndpoint,
  DEFAULT_MAINNET_CONFIG,
  DEFAULT_TESTNET_CONFIG,
  type AppConfig,
  type CertificatePin,
} from './config';

export * from './services';
export * from './tonconnect';
export * from './secure';
export * from './utils';

export { HttpsClient, HttpsOnlyError } from './network/httpsClient';
export type { HttpsClientOptions, HttpsFetchOptions, CertificateValidator } from './network/httpsClient';
