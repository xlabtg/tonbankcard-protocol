/**
 * TONBANKCARD Recurring Payments Adapter
 *
 * This adapter manages off-chain coordination for recurring payment mandates.
 *
 * ============================================================================
 * ⚠️ CRITICAL: NON-CUSTODIAL RECURRING PAYMENT ADAPTER
 * ============================================================================
 *
 * This adapter DOES NOT:
 * - Custody or hold user funds
 * - Automatically deduct payments
 * - Execute transactions without user consent
 * - Override user-created mandates
 * - Store private keys
 *
 * This adapter ONLY:
 * - Tracks mandate state off-chain for UX purposes
 * - Validates mandate parameters before on-chain submission
 * - Provides mandate status queries
 * - Generates execution records for display
 *
 * TRUST MODEL:
 * - Users create and control all mandates
 * - Merchants can trigger execution within mandate limits
 * - On-chain contract enforces all constraints
 * - This adapter is a convenience wrapper only
 */

import type {
  RecurringPaymentMandate,
  RecurringPaymentExecution,
  ProviderError,
} from './types';

/**
 * Minimum period between recurring payments (1 hour in seconds)
 */
const MIN_PERIOD_SECONDS = 3600;

/**
 * Maximum period between recurring payments (1 year in seconds)
 */
const MAX_PERIOD_SECONDS = 365 * 24 * 3600;

/**
 * Recurring Payments Adapter
 *
 * A non-custodial coordination layer for managing recurring
 * payment mandates between NFT card accounts.
 */
export class RecurringPaymentsAdapter {

  // ===========================================================================
  // MANDATE MANAGEMENT
  // ===========================================================================

  /**
   * Create a recurring payment mandate record
   *
   * This creates an off-chain mandate record. The actual on-chain
   * mandate must be created separately through the RecurringPayments contract.
   *
   * ⚠️ The user MUST sign the on-chain transaction themselves.
   *
   * @param payerNftAccountId - Payer's NFT Account ID
   * @param merchantNftAccountId - Merchant's NFT Account ID
   * @param amountPerPeriod - Amount per execution
   * @param periodSeconds - Interval between executions
   * @param maxExecutions - Maximum executions (0 = unlimited)
   * @returns Mandate record
   */
  createMandate(
    payerNftAccountId: string,
    merchantNftAccountId: string,
    amountPerPeriod: string,
    periodSeconds: number,
    maxExecutions: number = 0
  ): RecurringPaymentMandate {
    // Validate inputs
    this.validateMandateParams(amountPerPeriod, periodSeconds, maxExecutions);

    const mandateId = this.generateMandateId();
    const now = new Date();

    return {
      mandateId,
      payerNftAccountId,
      merchantNftAccountId,
      amountPerPeriod,
      periodSeconds,
      maxExecutions,
      executionCount: 0,
      status: 'active',
      createdAt: now,
    };
  }

  /**
   * Cancel a mandate
   *
   * ⚠️ This only updates the off-chain record.
   * The on-chain cancellation must be done separately.
   *
   * @param mandate - Existing mandate
   * @returns Cancelled mandate
   */
  cancelMandate(mandate: RecurringPaymentMandate): RecurringPaymentMandate {
    if (mandate.status !== 'active') {
      throw this.createError(
        'Can only cancel active mandates',
        'INVALID_STATUS'
      );
    }

    return {
      ...mandate,
      status: 'cancelled',
    };
  }

  /**
   * Record a payment execution
   *
   * This creates an off-chain execution record after a recurring
   * payment has been executed on-chain.
   *
   * @param mandate - The mandate being executed
   * @param txHash - On-chain transaction hash
   * @returns Updated mandate and execution record
   */
  recordExecution(
    mandate: RecurringPaymentMandate,
    txHash?: string
  ): { mandate: RecurringPaymentMandate; execution: RecurringPaymentExecution } {
    if (mandate.status !== 'active') {
      throw this.createError(
        'Can only execute active mandates',
        'INVALID_STATUS'
      );
    }

    const newCount = mandate.executionCount + 1;
    const now = new Date();

    // Check if this is the last execution
    const isCompleted = mandate.maxExecutions > 0 && newCount >= mandate.maxExecutions;

    const updatedMandate: RecurringPaymentMandate = {
      ...mandate,
      executionCount: newCount,
      lastExecutedAt: now,
      status: isCompleted ? 'completed' : 'active',
    };

    const execution: RecurringPaymentExecution = {
      mandateId: mandate.mandateId,
      executionNumber: newCount,
      amount: mandate.amountPerPeriod,
      txHash,
      executedAt: now,
      status: txHash ? 'confirmed' : 'pending',
    };

    return { mandate: updatedMandate, execution };
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Check if a mandate is eligible for execution
   *
   * @param mandate - The mandate to check
   * @returns Whether the mandate can be executed now
   */
  canExecute(mandate: RecurringPaymentMandate): boolean {
    // Must be active
    if (mandate.status !== 'active') {
      return false;
    }

    // Check max executions
    if (mandate.maxExecutions > 0 && mandate.executionCount >= mandate.maxExecutions) {
      return false;
    }

    // Check period elapsed
    if (mandate.lastExecutedAt) {
      const nextAllowed = new Date(
        mandate.lastExecutedAt.getTime() + mandate.periodSeconds * 1000
      );
      if (new Date() < nextAllowed) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the next execution time for a mandate
   *
   * @param mandate - The mandate
   * @returns Next allowed execution time, or null if not applicable
   */
  getNextExecutionTime(mandate: RecurringPaymentMandate): Date | null {
    if (mandate.status !== 'active') {
      return null;
    }

    if (mandate.maxExecutions > 0 && mandate.executionCount >= mandate.maxExecutions) {
      return null;
    }

    if (!mandate.lastExecutedAt) {
      return new Date(); // Can execute immediately (first execution)
    }

    return new Date(
      mandate.lastExecutedAt.getTime() + mandate.periodSeconds * 1000
    );
  }

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  /**
   * Validate mandate parameters
   */
  private validateMandateParams(
    amountPerPeriod: string,
    periodSeconds: number,
    maxExecutions: number
  ): void {
    if (!amountPerPeriod || parseFloat(amountPerPeriod) <= 0) {
      throw this.createError(
        'Amount per period must be positive',
        'INVALID_AMOUNT'
      );
    }

    if (periodSeconds < MIN_PERIOD_SECONDS) {
      throw this.createError(
        `Period must be at least ${MIN_PERIOD_SECONDS} seconds (1 hour)`,
        'INVALID_PERIOD'
      );
    }

    if (periodSeconds > MAX_PERIOD_SECONDS) {
      throw this.createError(
        `Period must not exceed ${MAX_PERIOD_SECONDS} seconds (1 year)`,
        'INVALID_PERIOD'
      );
    }

    if (maxExecutions < 0) {
      throw this.createError(
        'Max executions must be non-negative',
        'INVALID_MAX_EXECUTIONS'
      );
    }
  }

  /**
   * Generate unique mandate ID
   */
  private generateMandateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `mandate_${timestamp}_${random}`;
  }

  /**
   * Create standardized error
   */
  private createError(message: string, code?: string): ProviderError {
    return {
      message,
      code,
      provider: 'RecurringPayments',
    };
  }
}

/**
 * Factory function to create Recurring Payments adapter
 *
 * @returns Configured recurring payments adapter
 */
export function createRecurringPaymentsAdapter(): RecurringPaymentsAdapter {
  return new RecurringPaymentsAdapter();
}
