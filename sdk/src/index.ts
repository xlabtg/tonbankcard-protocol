/**
 * TONBANKCARD Merchant SDK
 *
 * A lightweight, non-custodial SDK for integrating TONBANKCARD payments.
 *
 * CRITICAL SECURITY PRINCIPLES:
 * =============================
 * 1. This SDK is READ-ONLY with respect to funds
 * 2. It NEVER signs transactions
 * 3. It NEVER stores private keys
 * 4. It NEVER acts as a payment authority
 * 5. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Merchants trust ON-CHAIN settlement events
 * - Users trust THEIR WALLET
 * - SDK is a CONVENIENCE WRAPPER, not a protocol layer
 *
 * @packageDocumentation
 */

export { TonbankcardSDK } from './sdk';

export {
  // Types
  AccountState,
  PaymentStatus,
  Invoice,
  CreateInvoiceParams,
  PaymentSettlement,
  WalletLinkParams,
  AccountInfo,
  TonbankcardConfig,
  TransactionVerification,
  MerchantPaymentEvent,
  // Phase 4 Types
  MultiSigConfig,
  MultiSigProposal,
  RecurringMandate,
  BridgeIntentInfo,
  LendingIntent,
} from './types';

export {
  // Utilities
  generateInvoiceId,
  createPayloadHash,
  formatTBC,
  parseTBC,
  isValidTonAddress,
  shortAddress,
  isExpired,
  formatTimestamp,
  serializeBigInt,
} from './utils';

export {
  // Testing / Sandbox
  MockTonbankcardSDK,
  MockSettlementStore,
  MockSDKOptions,
  createMockSDK,
} from './mock';

export {
  // Payment Widget
  TonbankcardPaymentWidget,
  PaymentWidgetConfig,
} from './widget';

export {
  // Webhook signature verification
  verifyWebhook,
  computeWebhookSignature,
  SIGNATURE_HEADER,
  SIGNATURE_VERSION,
  DEFAULT_TOLERANCE_SECONDS,
  WebhookVerificationResult,
  VerifyWebhookOptions,
} from './webhook';

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
