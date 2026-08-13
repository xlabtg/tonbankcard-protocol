/**
 * TONBANKCARD CoinRabbit Lending Adapter
 *
 * This adapter integrates TONBANKCARD with CoinRabbit for external crypto lending.
 *
 * ============================================================================
 * ⚠️ CRITICAL: NON-CUSTODIAL LENDING ADAPTER - INTENTIONALLY WEAK BY DESIGN
 * ============================================================================
 *
 * This adapter DOES NOT:
 * - Issue loans
 * - Custody collateral
 * - Enforce repayments
 * - Liquidate assets
 * - Track debt
 * - Grant lender any protocol-level authority
 *
 * This adapter ONLY:
 * - Resolves NFT-based borrower identity
 * - Provides read-only collateral signal verification
 * - Generates standardized metadata for lenders
 * - Creates optional UX deep-links
 *
 * TRUST MODEL:
 * - Users trust their wallet
 * - Lenders trust their own systems
 * - The protocol trusts no one
 * - All enforcement is external
 *
 * Any proposal that embeds lending logic, introduces liquidation hooks,
 * or grants lender privileges MUST be rejected.
 *
 * @see https://coinrabbit.io/
 */

import type {
  CoinRabbitConfig,
  BorrowerIdentity,
  CollateralSignalInfo,
  LoanIntentRequest,
  LoanIntentResponse,
  LoanReference,
  LoanReferenceStatus,
  LenderVerificationData,
  CollateralVerificationRequest,
  CollateralVerificationResponse,
  ProviderError,
  ChainSnapshot,
} from './types';

/**
 * Protocol version for compatibility tracking
 */
const PROTOCOL_VERSION = '1.0.0';

/**
 * Whitelisted NFT collections for TONBANKCARD accounts
 */
const WHITELISTED_COLLECTIONS = {
  SERIES_7777: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
  SERIES_8888: 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7',
} as const;

/**
 * Standard disclaimer for all lender-facing data
 */
const LENDER_DISCLAIMER =
  'TONBANKCARD protocol makes NO guarantees about collateral, balances, or repayment. ' +
  'Lenders MUST verify all data on-chain independently. ' +
  'The protocol is non-custodial and does not enforce loan terms.';

/**
 * CoinRabbit Lending Adapter
 *
 * A non-custodial coordination layer for connecting NFT-based accounts
 * with external lending services.
 */
export class CoinRabbitAdapter {
  private readonly config: Omit<Required<CoinRabbitConfig>, 'chainGateway'> &
    Pick<CoinRabbitConfig, 'chainGateway'>;

  constructor(config: CoinRabbitConfig = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://coinrabbit.io',
      affiliateId: config.affiliateId || '',
      resolverContractAddress: config.resolverContractAddress || '',
      collateralContractAddress: config.collateralContractAddress || '',
      chainId: config.chainId || 1, // Default to mainnet
      chainGateway: config.chainGateway,
      maxSnapshotAgeSeconds: config.maxSnapshotAgeSeconds ?? 120,
    };
  }

  // ===========================================================================
  // IDENTITY RESOLUTION
  // ===========================================================================

  /**
   * Resolve borrower identity from NFT Account ID
   *
   * In TONBANKCARD, borrower identity is determined by NFT ownership,
   * NOT by wallet address. This enables account abstraction.
   *
   * ⚠️ This is a READ-ONLY operation that queries on-chain data.
   * The adapter cannot modify or forge identity.
   *
   * @param nftAccountId - NFT Account ID (e.g., '7777001')
   * @param ownerAddress - Optional: Current owner address for validation
   * @returns Resolved borrower identity
   */
  async resolveBorrowerIdentity(
    nftAccountId: string,
    ownerAddress?: string
  ): Promise<BorrowerIdentity> {
    // Validate NFT Account ID format
    if (!this.isValidNFTAccountId(nftAccountId)) {
      return {
        nftAccountId,
        collectionAddress: '',
        isValid: false,
        verificationStatus: 'invalid',
        resolvedAt: new Date(),
      };
    }

    const snapshot = await this.getUsableSnapshot();
    if (!snapshot || !this.config.chainGateway) {
      return this.unavailableIdentity(nftAccountId);
    }

    try {
      const data = await this.config.chainGateway.getNFTAccount(nftAccountId, snapshot);
      if (!data) {
        return {
          nftAccountId,
          collectionAddress: '',
          isValid: false,
          verificationStatus: 'unverified',
          verifiedAtBlock: snapshot.blockSeqno,
          resolvedAt: new Date(),
        };
      }

      const ownerMatches = !ownerAddress || data.ownerAddress === ownerAddress;
      const isValid =
        data.nftAccountId === nftAccountId &&
        data.initialized &&
        Boolean(data.ownerAddress) &&
        ownerMatches &&
        this.isWhitelistedCollection(data.collectionAddress);

      return {
        nftAccountId,
        collectionAddress: data.collectionAddress,
        currentOwnerAddress: data.ownerAddress,
        nftAddress: data.nftAddress,
        isValid,
        verificationStatus: isValid ? 'verified' : 'unverified',
        verifiedAtBlock: snapshot.blockSeqno,
        resolvedAt: new Date(),
      };
    } catch {
      return this.unavailableIdentity(nftAccountId);
    }
  }

  /**
   * Validate NFT account is from whitelisted collection
   *
   * @param nftAccountId - NFT Account ID
   * @returns Whether account is from valid collection
   */
  isValidNFTAccountId(nftAccountId: string): boolean {
    // NFT Account IDs should be numeric strings starting with 7777 or 8888
    if (!nftAccountId || typeof nftAccountId !== 'string') {
      return false;
    }

    return /^(7777|8888)\d{1,15}$/.test(nftAccountId);
  }

  /**
   * Get collection address for NFT Account ID
   *
   * @param nftAccountId - NFT Account ID
   * @returns Collection address
   */
  private getCollectionForAccount(nftAccountId: string): string {
    const numericId = nftAccountId.replace(/\D/g, '');

    if (numericId.startsWith('7777')) {
      return WHITELISTED_COLLECTIONS.SERIES_7777;
    }

    if (numericId.startsWith('8888')) {
      return WHITELISTED_COLLECTIONS.SERIES_8888;
    }

    return '';
  }

  /**
   * Check if collection is whitelisted
   *
   * @param collectionAddress - Collection address
   * @returns Whether collection is whitelisted
   */
  private isWhitelistedCollection(collectionAddress: string): boolean {
    return Object.values(WHITELISTED_COLLECTIONS).includes(
      collectionAddress as typeof WHITELISTED_COLLECTIONS[keyof typeof WHITELISTED_COLLECTIONS]
    );
  }

  // ===========================================================================
  // COLLATERAL SIGNAL VERIFICATION (READ-ONLY)
  // ===========================================================================

  /**
   * Verify collateral signal on-chain (READ-ONLY)
   *
   * This method queries the Collateral Signal Contract (Issue 6.1)
   * to verify that a collateral signal exists and is active.
   *
   * ⚠️ CRITICAL: This is READ-ONLY verification.
   * The adapter CANNOT:
   * - Create collateral signals
   * - Modify collateral signals
   * - Lock or unlock collateral
   * - Access the collateral
   *
   * @param request - Collateral verification request
   * @returns Verification response
   */
  async verifyCollateralSignal(
    request: CollateralVerificationRequest
  ): Promise<CollateralVerificationResponse> {
    if (!request.signalId || !this.isValidNFTAccountId(request.nftAccountId)) {
      return this.failedCollateralVerification('invalid');
    }

    const snapshot = await this.getUsableSnapshot();
    if (!snapshot || !this.config.chainGateway) {
      return this.failedCollateralVerification('unavailable');
    }

    const identity = await this.resolveBorrowerIdentityAtSnapshot(
      request.nftAccountId,
      snapshot
    );

    if (!identity.isValid) {
      return this.failedCollateralVerification(
        identity.verificationStatus,
        snapshot.blockSeqno
      );
    }

    try {
      const signal = await this.config.chainGateway.getCollateralSignal(
        request.signalId,
        snapshot
      );
      const ownershipVerified = Boolean(
        signal &&
        signal.signalId === request.signalId &&
        signal.nftAccountId === request.nftAccountId &&
        signal.nftAddress === identity.nftAddress
      );
      const isValid = ownershipVerified && Boolean(signal?.isActive);

      if (!signal || !isValid) {
        return this.failedCollateralVerification('unverified', snapshot.blockSeqno);
      }

      return {
        isValid: true,
        ownershipVerified: true,
        verificationStatus: 'verified',
        signalInfo: {
          signalId: signal.signalId,
          nftAccountId: signal.nftAccountId,
          assetType: signal.assetType,
          signalAmount: signal.signalAmount,
          isActive: signal.isActive,
          createdAt: signal.createdAt,
          expiresAt: signal.expiresAt,
          signalTxHash: signal.signalTxHash,
        },
        verifiedAtBlock: snapshot.blockSeqno,
        verifiedAt: new Date(),
        disclaimer: LENDER_DISCLAIMER,
      };
    } catch {
      return this.failedCollateralVerification('unavailable', snapshot.blockSeqno);
    }
  }

  /**
   * Get collateral signal info (READ-ONLY)
   *
   * @param signalId - Collateral signal ID
   * @param nftAccountId - NFT Account ID
   * @returns Collateral signal info or undefined
   */
  async getCollateralSignalInfo(
    signalId: string,
    nftAccountId: string
  ): Promise<CollateralSignalInfo | undefined> {
    if (!signalId || !nftAccountId) {
      return undefined;
    }

    const verification = await this.verifyCollateralSignal({ signalId, nftAccountId });
    return verification.verificationStatus === 'verified'
      ? verification.signalInfo
      : undefined;
  }

  private async getUsableSnapshot(): Promise<ChainSnapshot | undefined> {
    if (!this.config.chainGateway) return undefined;
    try {
      const snapshot = await this.config.chainGateway.getLatestSnapshot(this.config.chainId);
      const age = Date.now() - snapshot.observedAt.getTime();
      if (
        snapshot.chainId !== this.config.chainId ||
        !Number.isSafeInteger(snapshot.blockSeqno) ||
        snapshot.blockSeqno < 0 ||
        !Number.isFinite(age) ||
        age < 0 ||
        age > this.config.maxSnapshotAgeSeconds * 1000
      ) {
        return undefined;
      }
      return snapshot;
    } catch {
      return undefined;
    }
  }

  private unavailableIdentity(nftAccountId: string): BorrowerIdentity {
    return {
      nftAccountId,
      collectionAddress: '',
      isValid: false,
      verificationStatus: 'unavailable',
      resolvedAt: new Date(),
    };
  }

  private async resolveBorrowerIdentityAtSnapshot(
    nftAccountId: string,
    snapshot: ChainSnapshot
  ): Promise<BorrowerIdentity> {
    if (!this.config.chainGateway) return this.unavailableIdentity(nftAccountId);
    try {
      const data = await this.config.chainGateway.getNFTAccount(nftAccountId, snapshot);
      const isValid = Boolean(
        data &&
        data.nftAccountId === nftAccountId &&
        data.initialized &&
        data.ownerAddress &&
        this.isWhitelistedCollection(data.collectionAddress)
      );
      return {
        nftAccountId,
        collectionAddress: data?.collectionAddress || '',
        currentOwnerAddress: data?.ownerAddress,
        nftAddress: data?.nftAddress,
        isValid,
        verificationStatus: isValid ? 'verified' : 'unverified',
        verifiedAtBlock: snapshot.blockSeqno,
        resolvedAt: new Date(),
      };
    } catch {
      return this.unavailableIdentity(nftAccountId);
    }
  }

  private failedCollateralVerification(
    verificationStatus: CollateralVerificationResponse['verificationStatus'],
    verifiedAtBlock?: number
  ): CollateralVerificationResponse {
    return {
      isValid: false,
      ownershipVerified: false,
      verificationStatus,
      verifiedAtBlock,
      verifiedAt: new Date(),
      disclaimer: LENDER_DISCLAIMER,
    };
  }

  // ===========================================================================
  // LOAN INTENT CREATION
  // ===========================================================================

  /**
   * Create loan intent with lender metadata
   *
   * This creates a standardized intent that provides metadata
   * for external lenders. The protocol does NOT process the loan.
   *
   * ⚠️ IMPORTANT:
   * - Intent creation is user-initiated only
   * - No lender-initiated calls allowed
   * - Protocol remains a passive observer
   *
   * @param request - Loan intent request
   * @returns Loan intent response with lender deep-link
   */
  async createLoanIntent(
    request: LoanIntentRequest
  ): Promise<LoanIntentResponse> {
    // Resolve borrower identity
    const borrowerIdentity = await this.resolveBorrowerIdentity(
      request.nftAccountId
    );

    if (!borrowerIdentity.isValid) {
      throw this.createError(
        `Invalid NFT Account ID: ${request.nftAccountId}`,
        'INVALID_ACCOUNT'
      );
    }

    // Get collateral info if signal ID provided
    let collateralInfo: CollateralSignalInfo | undefined;
    if (request.collateralSignalId) {
      collateralInfo = await this.getCollateralSignalInfo(
        request.collateralSignalId,
        request.nftAccountId
      );
    }

    // Generate unique intent ID
    const intentId = this.generateIntentId();

    // Create verification data for lender
    const verificationData: LenderVerificationData = {
      nftAccountId: request.nftAccountId,
      collectionAddress: borrowerIdentity.collectionAddress,
      nftIndex: this.extractNFTIndex(request.nftAccountId),
      collateralSignalId: request.collateralSignalId,
      collateralContractAddress: this.config.collateralContractAddress || undefined,
      chainId: this.config.chainId,
      protocolVersion: PROTOCOL_VERSION,
      disclaimer: LENDER_DISCLAIMER,
    };

    // Generate lender deep-link URL
    const lenderUrl = this.generateLenderUrl(request, verificationData);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      intentId,
      borrowerIdentity,
      collateralInfo,
      lenderUrl,
      createdAt: now,
      expiresAt,
      verificationData,
    };
  }

  /**
   * Generate unique intent ID
   */
  private generateIntentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `intent_${timestamp}_${random}`;
  }

  /**
   * Extract NFT index from account ID
   */
  private extractNFTIndex(nftAccountId: string): number | undefined {
    const numericId = nftAccountId.replace(/\D/g, '');
    if (!numericId) return undefined;

    // Extract index portion (everything after series prefix)
    if (numericId.startsWith('7777')) {
      return parseInt(numericId.substring(4), 10) || undefined;
    }
    if (numericId.startsWith('8888')) {
      return parseInt(numericId.substring(4), 10) || undefined;
    }

    return undefined;
  }

  /**
   * Generate lender deep-link URL
   *
   * This creates a URL that users can click to navigate to
   * the external lender's website with pre-filled data.
   */
  private generateLenderUrl(
    request: LoanIntentRequest,
    verificationData: LenderVerificationData
  ): string {
    const baseUrl = this.config.baseUrl;
    const params = new URLSearchParams();

    // Add partner/affiliate ID if configured
    if (this.config.affiliateId) {
      params.set('ref', this.config.affiliateId);
    }

    // Add TONBANKCARD-specific parameters
    params.set('source', 'tonbankcard');
    params.set('nft_account', request.nftAccountId);
    params.set('chain', 'ton');

    // Add optional parameters
    if (request.collateralSignalId) {
      params.set('collateral_signal', request.collateralSignalId);
    }
    if (request.requestedAmount) {
      params.set('amount', request.requestedAmount);
    }
    if (request.requestedCurrency) {
      params.set('currency', request.requestedCurrency);
    }

    return `${baseUrl}/loans?${params.toString()}`;
  }

  // ===========================================================================
  // LOAN REFERENCE TRACKING (OFF-CHAIN)
  // ===========================================================================

  /**
   * Create off-chain loan reference
   *
   * This creates a reference record for tracking purposes ONLY.
   * The protocol does NOT:
   * - Enforce the loan
   * - Track debt
   * - Manage repayments
   *
   * @param intentId - Intent ID
   * @param nftAccountId - NFT Account ID
   * @param externalLoanId - Optional external loan ID from lender
   * @returns Loan reference record
   */
  createLoanReference(
    intentId: string,
    nftAccountId: string,
    externalLoanId?: string,
    collateralSignalId?: string
  ): LoanReference {
    const now = new Date();

    return {
      referenceId: this.generateReferenceId(),
      provider: 'CoinRabbit',
      externalLoanId,
      nftAccountId,
      collateralSignalId,
      intentId,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
    };
  }

  /**
   * Update loan reference status
   *
   * ⚠️ NOTE: This is for TRACKING and UX only.
   * The protocol does NOT enforce or act on status changes.
   *
   * @param reference - Existing loan reference
   * @param newStatus - New status
   * @param metadata - Optional additional metadata
   * @returns Updated loan reference
   */
  updateLoanReferenceStatus(
    reference: LoanReference,
    newStatus: LoanReferenceStatus,
    metadata?: Record<string, unknown>
  ): LoanReference {
    return {
      ...reference,
      status: newStatus,
      updatedAt: new Date(),
      metadata: {
        ...reference.metadata,
        ...metadata,
      },
    };
  }

  /**
   * Generate unique reference ID
   */
  private generateReferenceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `ref_${timestamp}_${random}`;
  }

  // ===========================================================================
  // LENDER METADATA (READ-ONLY)
  // ===========================================================================

  /**
   * Get standardized metadata for lenders
   *
   * This provides read-only metadata that lenders can use
   * to verify borrower identity on-chain.
   *
   * ⚠️ IMPORTANT: This data comes with NO guarantees.
   * Lenders MUST verify on-chain independently.
   *
   * @param nftAccountId - NFT Account ID
   * @param collateralSignalId - Optional collateral signal ID
   * @returns Lender verification data
   */
  async getLenderMetadata(
    nftAccountId: string,
    collateralSignalId?: string
  ): Promise<LenderVerificationData> {
    const identity = await this.resolveBorrowerIdentity(nftAccountId);

    return {
      nftAccountId,
      collectionAddress: identity.collectionAddress,
      nftIndex: this.extractNFTIndex(nftAccountId),
      collateralSignalId,
      collateralContractAddress: this.config.collateralContractAddress || undefined,
      chainId: this.config.chainId,
      protocolVersion: PROTOCOL_VERSION,
      disclaimer: LENDER_DISCLAIMER,
    };
  }

  /**
   * Get whitelisted collections
   *
   * @returns Map of whitelisted NFT collection addresses
   */
  getWhitelistedCollections(): Record<string, string> {
    return { ...WHITELISTED_COLLECTIONS };
  }

  /**
   * Get protocol version
   */
  getProtocolVersion(): string {
    return PROTOCOL_VERSION;
  }

  /**
   * Get standard disclaimer for lenders
   */
  getDisclaimer(): string {
    return LENDER_DISCLAIMER;
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  /**
   * Create standardized provider error
   */
  private createError(message: string, code?: string): Error & ProviderError {
    const error = new Error(message) as Error & ProviderError;
    error.code = code;
    error.provider = 'CoinRabbit';
    return error;
  }
}

/**
 * Factory function to create CoinRabbit lending adapter
 *
 * @param config - Optional configuration
 * @returns Configured CoinRabbit adapter
 */
export function createCoinRabbitAdapter(
  config?: CoinRabbitConfig
): CoinRabbitAdapter {
  return new CoinRabbitAdapter(config);
}
