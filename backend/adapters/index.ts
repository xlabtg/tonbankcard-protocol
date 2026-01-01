/**
 * TONBANKCARD External Payment Providers Adapter
 *
 * This module provides integration with external payment and exchange providers
 * while maintaining TONBANKCARD's core non-custodial principles.
 *
 * @module adapters
 */

// Type definitions
export * from './types';

// ChangeNOW adapter
export { ChangeNOWAdapter, createChangeNOWAdapter } from './changenow';

// NOWPayments adapter
export { NOWPaymentsAdapter, createNOWPaymentsAdapter } from './nowpayments';

// CoinRabbit lending adapter (Issue 6.2)
export { CoinRabbitAdapter, createCoinRabbitAdapter } from './coinrabbit';
