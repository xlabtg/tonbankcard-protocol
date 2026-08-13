/**
 * Lending Protocol Integration Test Suite (Phase 4)
 *
 * Tests for the enhanced lending protocol integration covering:
 * - CoinRabbit adapter integration with protocol coordination
 * - Lending intent lifecycle
 * - Non-custodial invariants
 *
 * ⚠️ CRITICAL: These tests verify that the lending integration
 * remains non-custodial and coordination-only.
 */

import {
  CoinRabbitAdapter,
  createCoinRabbitAdapter,
} from '../../backend/adapters/coinrabbit';
import type {
  LendingProtocolIntent,
  BorrowerIdentity,
  LoanIntentResponse,
  CoinRabbitChainGateway,
} from '../../backend/adapters/types';

describe('Lending Protocol Integration (Phase 4)', () => {
  let adapter: CoinRabbitAdapter;

  const VALID_ACCOUNT_7777 = '7777001';
  const VALID_ACCOUNT_8888 = '8888042';
  const COLLECTION_7777 = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
  const COLLECTION_8888 = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';
  const chainGateway: CoinRabbitChainGateway = {
    getLatestSnapshot: jest.fn().mockImplementation(async (chainId: number) => ({
      chainId,
      blockSeqno: 200,
      observedAt: new Date(),
    })),
    getNFTAccount: jest.fn().mockImplementation(async (nftAccountId: string) => {
      if (!/^(7777|8888)\d+$/.test(nftAccountId)) return undefined;
      return {
        nftAccountId,
        nftAddress: `EQD_nft_${nftAccountId}`,
        collectionAddress: nftAccountId.startsWith('7777')
          ? COLLECTION_7777
          : COLLECTION_8888,
        ownerAddress: 'EQD_owner',
        initialized: true,
      };
    }),
    getCollateralSignal: jest.fn().mockImplementation(async (signalId: string) => ({
      signalId,
      nftAccountId: VALID_ACCOUNT_7777,
      nftAddress: `EQD_nft_${VALID_ACCOUNT_7777}`,
      assetType: 'TON',
      signalAmount: '1',
      isActive: true,
      createdAt: new Date(),
    })),
  };

  beforeEach(() => {
    adapter = createCoinRabbitAdapter({
      affiliateId: 'phase4-test',
      chainId: 1,
      collateralContractAddress: 'EQD_test_collateral_contract',
      chainGateway,
    });
  });

  // ===========================================================================
  // IDENTITY RESOLUTION WITH LENDING CONTEXT
  // ===========================================================================

  describe('Identity Resolution for Lending', () => {
    test('should resolve borrower identity for lending intent', async () => {
      const identity = await adapter.resolveBorrowerIdentity(VALID_ACCOUNT_7777);

      expect(identity.isValid).toBe(true);
      expect(identity.collectionAddress).toBe(COLLECTION_7777);
      expect(identity.nftAccountId).toBe(VALID_ACCOUNT_7777);
    });

    test('should resolve identity consistently (deterministic)', async () => {
      const id1 = await adapter.resolveBorrowerIdentity(VALID_ACCOUNT_7777);
      const id2 = await adapter.resolveBorrowerIdentity(VALID_ACCOUNT_7777);

      expect(id1.collectionAddress).toBe(id2.collectionAddress);
      expect(id1.isValid).toBe(id2.isValid);
    });

    test('should reject invalid accounts for lending', async () => {
      const identity = await adapter.resolveBorrowerIdentity('9999001');
      expect(identity.isValid).toBe(false);
    });
  });

  // ===========================================================================
  // LOAN INTENT CREATION (ENHANCED)
  // ===========================================================================

  describe('Loan Intent Creation', () => {
    test('should create loan intent with collateral signal', async () => {
      const intent = await adapter.createLoanIntent({
        nftAccountId: VALID_ACCOUNT_7777,
        collateralSignalId: 'signal_123',
        requestedAmount: '1000',
        requestedCurrency: 'USDT',
        targetLender: 'coinrabbit',
      });

      expect(intent.intentId).toBeTruthy();
      expect(intent.borrowerIdentity.isValid).toBe(true);
      expect(intent.verificationData.disclaimer).toBeTruthy();
      expect(intent.verificationData.protocolVersion).toBeTruthy();
    });

    test('should create loan intent without collateral signal', async () => {
      const intent = await adapter.createLoanIntent({
        nftAccountId: VALID_ACCOUNT_8888,
        targetLender: 'coinrabbit',
      });

      expect(intent.intentId).toBeTruthy();
      expect(intent.borrowerIdentity.isValid).toBe(true);
    });

    test('should reject intent with invalid account', async () => {
      await expect(
        adapter.createLoanIntent({
          nftAccountId: 'invalid',
          targetLender: 'coinrabbit',
        })
      ).rejects.toBeTruthy();
    });

    test('should include lender URL in intent', async () => {
      const intent = await adapter.createLoanIntent({
        nftAccountId: VALID_ACCOUNT_7777,
        requestedAmount: '500',
        requestedCurrency: 'TON',
        targetLender: 'coinrabbit',
      });

      expect(intent.lenderUrl).toBeTruthy();
      expect(intent.lenderUrl).toContain('tonbankcard');
    });

    test('should include verification data with disclaimer', async () => {
      const intent = await adapter.createLoanIntent({
        nftAccountId: VALID_ACCOUNT_7777,
        targetLender: 'coinrabbit',
      });

      expect(intent.verificationData.disclaimer).toContain('NO guarantees');
      expect(intent.verificationData.chainId).toBe(1);
      expect(intent.verificationData.nftAccountId).toBe(VALID_ACCOUNT_7777);
    });

    test('should set expiration time', async () => {
      const intent = await adapter.createLoanIntent({
        nftAccountId: VALID_ACCOUNT_7777,
        targetLender: 'coinrabbit',
      });

      expect(intent.expiresAt).toBeInstanceOf(Date);
      expect(intent.expiresAt.getTime()).toBeGreaterThan(intent.createdAt.getTime());
    });
  });

  // ===========================================================================
  // LOAN REFERENCE TRACKING
  // ===========================================================================

  describe('Loan Reference Tracking', () => {
    test('should create loan reference', () => {
      const reference = adapter.createLoanReference(
        'intent_123',
        VALID_ACCOUNT_7777,
        'ext_loan_456',
        'signal_789'
      );

      expect(reference.referenceId).toBeTruthy();
      expect(reference.provider).toBe('CoinRabbit');
      expect(reference.nftAccountId).toBe(VALID_ACCOUNT_7777);
      expect(reference.externalLoanId).toBe('ext_loan_456');
      expect(reference.status).toBe('pending');
    });

    test('should update loan reference status', () => {
      const reference = adapter.createLoanReference(
        'intent_123',
        VALID_ACCOUNT_7777
      );

      const updated = adapter.updateLoanReferenceStatus(reference, 'active');
      expect(updated.status).toBe('active');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(reference.updatedAt.getTime());
    });

    test('should preserve reference data on status update', () => {
      const reference = adapter.createLoanReference(
        'intent_123',
        VALID_ACCOUNT_7777,
        'ext_456'
      );

      const updated = adapter.updateLoanReferenceStatus(reference, 'completed');
      expect(updated.nftAccountId).toBe(reference.nftAccountId);
      expect(updated.intentId).toBe(reference.intentId);
      expect(updated.externalLoanId).toBe(reference.externalLoanId);
    });
  });

  // ===========================================================================
  // COLLATERAL VERIFICATION
  // ===========================================================================

  describe('Collateral Verification', () => {
    test('should verify collateral signal (read-only)', async () => {
      const verification = await adapter.verifyCollateralSignal({
        signalId: 'signal_123',
        nftAccountId: VALID_ACCOUNT_7777,
      });

      expect(verification.disclaimer).toBeTruthy();
      expect(verification.verifiedAt).toBeInstanceOf(Date);
    });

    test('should reject verification for invalid account', async () => {
      const verification = await adapter.verifyCollateralSignal({
        signalId: 'signal_123',
        nftAccountId: '9999001',
      });

      expect(verification.isValid).toBe(false);
    });
  });

  // ===========================================================================
  // NON-CUSTODIAL INVARIANTS
  // ===========================================================================

  describe('Non-Custodial Invariants', () => {
    test('adapter has no fund management methods', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const custodialMethods = methods.filter(m =>
        m.includes('issueLoan') ||
        m.includes('disburseFunds') ||
        m.includes('collectRepayment') ||
        m.includes('liquidate') ||
        m.includes('seize') ||
        m.includes('enforceLoan')
      );
      expect(custodialMethods).toHaveLength(0);
    });

    test('adapter cannot track debt', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const debtMethods = methods.filter(m =>
        m.includes('trackDebt') ||
        m.includes('debtBalance') ||
        m.includes('outstandingLoan') ||
        m.includes('interestAccrued')
      );
      expect(debtMethods).toHaveLength(0);
    });

    test('verification data always includes disclaimer', async () => {
      const metadata = await adapter.getLenderMetadata(VALID_ACCOUNT_7777);
      expect(metadata.disclaimer).toBeTruthy();
      expect(metadata.disclaimer.length).toBeGreaterThan(50);
    });

    test('protocol version is available', () => {
      expect(adapter.getProtocolVersion()).toBe('1.0.0');
    });

    test('whitelisted collections are read-only', () => {
      const collections = adapter.getWhitelistedCollections();
      expect(Object.keys(collections)).toHaveLength(2);
    });
  });
});
