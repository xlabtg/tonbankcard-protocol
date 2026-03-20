/**
 * Recurring Payments Adapter Test Suite (Phase 4)
 *
 * Tests for the RecurringPaymentsAdapter covering:
 * - Mandate creation and validation
 * - Execution tracking
 * - Period enforcement
 * - Cancellation and completion
 * - Security invariant verification
 *
 * ⚠️ CRITICAL: These tests verify that the adapter remains NON-CUSTODIAL
 * and mandates are strictly USER-CONTROLLED.
 */

import {
  RecurringPaymentsAdapter,
  createRecurringPaymentsAdapter,
} from '../../backend/adapters/recurring';
import type {
  RecurringPaymentMandate,
} from '../../backend/adapters/types';

describe('Recurring Payments Adapter', () => {
  let adapter: RecurringPaymentsAdapter;

  const PAYER = '7777001';
  const MERCHANT = '8888001';
  const AMOUNT = '1000000000'; // 1 TBC
  const PERIOD = 86400; // 24 hours

  beforeEach(() => {
    adapter = createRecurringPaymentsAdapter();
  });

  // ===========================================================================
  // MANDATE CREATION
  // ===========================================================================

  describe('Mandate Creation', () => {
    test('should create valid mandate with unlimited executions', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);

      expect(mandate.payerNftAccountId).toBe(PAYER);
      expect(mandate.merchantNftAccountId).toBe(MERCHANT);
      expect(mandate.amountPerPeriod).toBe(AMOUNT);
      expect(mandate.periodSeconds).toBe(PERIOD);
      expect(mandate.maxExecutions).toBe(0);
      expect(mandate.executionCount).toBe(0);
      expect(mandate.status).toBe('active');
      expect(mandate.mandateId).toBeTruthy();
    });

    test('should create mandate with max executions', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 12);

      expect(mandate.maxExecutions).toBe(12);
    });

    test('should reject zero amount', () => {
      expect(() => {
        adapter.createMandate(PAYER, MERCHANT, '0', PERIOD);
      }).toThrow();
    });

    test('should reject negative amount', () => {
      expect(() => {
        adapter.createMandate(PAYER, MERCHANT, '-100', PERIOD);
      }).toThrow();
    });

    test('should reject period less than 1 hour', () => {
      expect(() => {
        adapter.createMandate(PAYER, MERCHANT, AMOUNT, 1800); // 30 minutes
      }).toThrow();
    });

    test('should reject period more than 1 year', () => {
      expect(() => {
        adapter.createMandate(PAYER, MERCHANT, AMOUNT, 366 * 24 * 3600);
      }).toThrow();
    });

    test('should reject negative max executions', () => {
      expect(() => {
        adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, -1);
      }).toThrow();
    });

    test('should generate unique mandate IDs', () => {
      const m1 = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const m2 = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      expect(m1.mandateId).not.toBe(m2.mandateId);
    });
  });

  // ===========================================================================
  // CANCELLATION
  // ===========================================================================

  describe('Cancellation', () => {
    test('should cancel active mandate', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const cancelled = adapter.cancelMandate(mandate);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.mandateId).toBe(mandate.mandateId);
    });

    test('should not cancel already cancelled mandate', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const cancelled = adapter.cancelMandate(mandate);

      expect(() => {
        adapter.cancelMandate(cancelled);
      }).toThrow();
    });
  });

  // ===========================================================================
  // EXECUTION TRACKING
  // ===========================================================================

  describe('Execution Tracking', () => {
    test('should record execution with tx hash', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const result = adapter.recordExecution(mandate, 'tx_hash_123');

      expect(result.mandate.executionCount).toBe(1);
      expect(result.mandate.lastExecutedAt).toBeInstanceOf(Date);
      expect(result.mandate.status).toBe('active');
      expect(result.execution.mandateId).toBe(mandate.mandateId);
      expect(result.execution.executionNumber).toBe(1);
      expect(result.execution.amount).toBe(AMOUNT);
      expect(result.execution.txHash).toBe('tx_hash_123');
      expect(result.execution.status).toBe('confirmed');
    });

    test('should record execution without tx hash (pending)', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const result = adapter.recordExecution(mandate);

      expect(result.execution.status).toBe('pending');
      expect(result.execution.txHash).toBeUndefined();
    });

    test('should complete mandate after max executions', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 2);

      const result1 = adapter.recordExecution(mandate, 'tx1');
      expect(result1.mandate.status).toBe('active');

      const result2 = adapter.recordExecution(result1.mandate, 'tx2');
      expect(result2.mandate.status).toBe('completed');
      expect(result2.mandate.executionCount).toBe(2);
    });

    test('should not execute cancelled mandate', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const cancelled = adapter.cancelMandate(mandate);

      expect(() => {
        adapter.recordExecution(cancelled);
      }).toThrow();
    });

    test('should increment execution count correctly', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 5);

      let current = mandate;
      for (let i = 1; i <= 3; i++) {
        const result = adapter.recordExecution(current, `tx_${i}`);
        expect(result.mandate.executionCount).toBe(i);
        expect(result.execution.executionNumber).toBe(i);
        current = result.mandate;
      }
    });
  });

  // ===========================================================================
  // EXECUTION ELIGIBILITY
  // ===========================================================================

  describe('Execution Eligibility', () => {
    test('should allow first execution immediately', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      expect(adapter.canExecute(mandate)).toBe(true);
    });

    test('should disallow execution before period elapsed', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const result = adapter.recordExecution(mandate, 'tx1');

      // Just executed, so should not be eligible yet
      expect(adapter.canExecute(result.mandate)).toBe(false);
    });

    test('should disallow execution when max reached', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 1);
      const result = adapter.recordExecution(mandate, 'tx1');

      expect(adapter.canExecute(result.mandate)).toBe(false);
    });

    test('should disallow execution when cancelled', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const cancelled = adapter.cancelMandate(mandate);

      expect(adapter.canExecute(cancelled)).toBe(false);
    });
  });

  // ===========================================================================
  // NEXT EXECUTION TIME
  // ===========================================================================

  describe('Next Execution Time', () => {
    test('should return now for first execution', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const nextTime = adapter.getNextExecutionTime(mandate);

      expect(nextTime).toBeInstanceOf(Date);
    });

    test('should return null for cancelled mandate', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
      const cancelled = adapter.cancelMandate(mandate);

      expect(adapter.getNextExecutionTime(cancelled)).toBeNull();
    });

    test('should return null for completed mandate', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 1);
      const result = adapter.recordExecution(mandate, 'tx1');

      expect(adapter.getNextExecutionTime(result.mandate)).toBeNull();
    });

    test('should return future time after execution', () => {
      const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD, 10);
      const result = adapter.recordExecution(mandate, 'tx1');

      const nextTime = adapter.getNextExecutionTime(result.mandate);
      expect(nextTime).toBeInstanceOf(Date);
      expect(nextTime!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ===========================================================================
  // SECURITY INVARIANTS
  // ===========================================================================

  describe('Security Invariants', () => {
    test('adapter has no fund custody methods', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const dangerousMethods = methods.filter(m =>
        m.includes('transfer') ||
        m.includes('withdraw') ||
        m.includes('custody') ||
        m.includes('sign') ||
        m.includes('debit') ||
        m.includes('deduct')
      );
      expect(dangerousMethods).toHaveLength(0);
    });

    test('adapter cannot automatically deduct payments', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const autoPayMethods = methods.filter(m =>
        m.includes('autoPay') ||
        m.includes('autoDeduct') ||
        m.includes('directDebit')
      );
      expect(autoPayMethods).toHaveLength(0);
    });

    test('mandate IDs are unique', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const mandate = adapter.createMandate(PAYER, MERCHANT, AMOUNT, PERIOD);
        expect(ids.has(mandate.mandateId)).toBe(false);
        ids.add(mandate.mandateId);
      }
    });
  });
});
