/**
 * TONBANKCARD Merchant Dashboard
 *
 * A read-only, non-custodial dashboard for merchants to monitor payments,
 * generate payment links, and manage webhook configurations.
 *
 * CRITICAL SECURITY PRINCIPLES:
 * =============================
 * 1. This dashboard is READ-ONLY with respect to funds
 * 2. It NEVER signs transactions
 * 3. It NEVER stores private keys
 * 4. It NEVER acts as a payment authority
 * 5. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Merchants trust ON-CHAIN settlement events
 * - Users trust THEIR WALLET
 * - Dashboard is a CONVENIENCE WRAPPER, not a protocol layer
 *
 * @packageDocumentation
 */

export { TonbankcardDashboard } from './components/DashboardApp';
export { TonbankcardTransparencyDashboard } from './components/TransparencyDashboard';

export {
  // Types
  DashboardConfig,
  PaymentRecord,
  MerchantStats,
  WebhookConfig,
  DashboardView,
  InvoiceGeneratorParams,
  // Phase 4 Types
  RecurringSubscriber,
  RecurringPaymentStats,
  MultiSigPaymentRecord,
  // E4 Transparency Types (Issue #135)
  TransparencyDashboardConfig,
  TransparencyMetricsSnapshot,
  TransparencyProtocolMetricsRow,
  TransparencyLockActivityRow,
  TransparencyParameterChangeRow,
} from './types';

export {
  // Utilities
  formatTBC,
  shortAddress,
  formatDate,
  formatCurrency,
  calculateSuccessRate,
  generateInvoiceLink,
} from './utils';

/**
 * Dashboard Version
 */
export const VERSION = '1.0.0';
