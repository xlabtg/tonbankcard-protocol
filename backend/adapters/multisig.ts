/**
 * TONBANKCARD Multi-Signature Card Adapter
 *
 * This adapter manages off-chain coordination for multi-signature card operations.
 *
 * ============================================================================
 * ⚠️ CRITICAL: NON-CUSTODIAL MULTI-SIG ADAPTER
 * ============================================================================
 *
 * This adapter DOES NOT:
 * - Custody funds
 * - Store private keys
 * - Sign transactions on behalf of users
 * - Override NFT owner authority
 * - Execute payments without proper approvals
 *
 * This adapter ONLY:
 * - Tracks multi-sig configuration off-chain for UX
 * - Validates proposal parameters before on-chain submission
 * - Provides proposal status queries
 * - Generates approval records for display
 *
 * TRUST MODEL:
 * - NFT owner creates and controls all configurations
 * - Co-signers approve but cannot initiate operations
 * - On-chain contract enforces all constraints
 * - This adapter is a convenience wrapper only
 */

import type {
  MultiSigCardConfig,
  PaymentProposal,
  ProviderError,
} from './types';

/**
 * Maximum number of co-signers
 */
const MAX_SIGNERS = 3;

/**
 * Multi-Signature Card Adapter
 *
 * A non-custodial coordination layer for managing multi-signature
 * card configurations and payment proposals.
 */
export class MultiSigCardAdapter {

  // ===========================================================================
  // CONFIGURATION MANAGEMENT
  // ===========================================================================

  /**
   * Create a multi-sig configuration record
   *
   * This creates an off-chain configuration record. The actual on-chain
   * configuration must be created separately through the MultiSigCard contract.
   *
   * ⚠️ The NFT owner MUST sign the on-chain transaction themselves.
   *
   * @param nftAccountId - NFT Account ID
   * @param requiredSignatures - Number of required co-signatures
   * @param signers - List of co-signer addresses
   * @returns Multi-sig configuration
   */
  createConfig(
    nftAccountId: string,
    requiredSignatures: number,
    signers: string[]
  ): MultiSigCardConfig {
    // Validate inputs
    this.validateConfig(requiredSignatures, signers);

    return {
      nftAccountId,
      requiredSignatures,
      signers,
      isActive: true,
      createdAt: new Date(),
    };
  }

  /**
   * Deactivate a multi-sig configuration
   *
   * ⚠️ This only updates the off-chain record.
   * The on-chain removal must be done separately by the NFT owner.
   *
   * @param config - Existing configuration
   * @returns Deactivated configuration
   */
  deactivateConfig(config: MultiSigCardConfig): MultiSigCardConfig {
    return {
      ...config,
      isActive: false,
    };
  }

  // ===========================================================================
  // PROPOSAL MANAGEMENT
  // ===========================================================================

  /**
   * Create a payment proposal record
   *
   * This creates an off-chain proposal record. The actual on-chain
   * proposal must be created separately through the MultiSigCard contract.
   *
   * @param nftAccountId - NFT Account ID (proposer)
   * @param recipient - Payment recipient address
   * @param amount - Payment amount
   * @param config - Multi-sig configuration
   * @returns Payment proposal
   */
  createProposal(
    nftAccountId: string,
    recipient: string,
    amount: string,
    config: MultiSigCardConfig
  ): PaymentProposal {
    if (!config.isActive) {
      throw this.createError(
        'Multi-sig is not active for this account',
        'NOT_CONFIGURED'
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw this.createError('Invalid payment amount', 'INVALID_AMOUNT');
    }

    if (!recipient || recipient.trim().length === 0) {
      throw this.createError('Recipient address required', 'INVALID_RECIPIENT');
    }

    const proposalId = this.generateProposalId();

    return {
      proposalId,
      nftAccountId,
      recipient,
      amount,
      status: 'pending',
      approvalCount: 0,
      requiredApprovals: config.requiredSignatures,
      approvers: [],
      createdAt: new Date(),
    };
  }

  /**
   * Record an approval on a proposal
   *
   * ⚠️ This only updates the off-chain record.
   * The on-chain approval must be done separately.
   *
   * @param proposal - Existing proposal
   * @param approverAddress - Address of the approving co-signer
   * @param config - Multi-sig configuration
   * @returns Updated proposal
   */
  recordApproval(
    proposal: PaymentProposal,
    approverAddress: string,
    config: MultiSigCardConfig
  ): PaymentProposal {
    if (proposal.status !== 'pending') {
      throw this.createError(
        'Can only approve pending proposals',
        'INVALID_STATUS'
      );
    }

    // Validate approver is a registered signer
    if (!config.signers.includes(approverAddress)) {
      throw this.createError(
        'Approver is not a registered co-signer',
        'NOT_SIGNER'
      );
    }

    // Check for duplicate approval
    if (proposal.approvers.includes(approverAddress)) {
      throw this.createError(
        'Already approved by this signer',
        'ALREADY_APPROVED'
      );
    }

    const newApprovers = [...proposal.approvers, approverAddress];
    const newCount = proposal.approvalCount + 1;
    const isApproved = newCount >= proposal.requiredApprovals;

    return {
      ...proposal,
      approvalCount: newCount,
      approvers: newApprovers,
      status: isApproved ? 'approved' : 'pending',
    };
  }

  /**
   * Reject a proposal
   *
   * @param proposal - Existing proposal
   * @returns Rejected proposal
   */
  rejectProposal(proposal: PaymentProposal): PaymentProposal {
    if (proposal.status !== 'pending') {
      throw this.createError(
        'Can only reject pending proposals',
        'INVALID_STATUS'
      );
    }

    return {
      ...proposal,
      status: 'rejected',
    };
  }

  /**
   * Mark a proposal as executed
   *
   * @param proposal - Approved proposal
   * @returns Executed proposal
   */
  markExecuted(proposal: PaymentProposal): PaymentProposal {
    if (proposal.status !== 'approved') {
      throw this.createError(
        'Can only execute approved proposals',
        'INVALID_STATUS'
      );
    }

    return {
      ...proposal,
      status: 'executed',
    };
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate multi-sig configuration parameters
   */
  private validateConfig(
    requiredSignatures: number,
    signers: string[]
  ): void {
    if (requiredSignatures < 1 || requiredSignatures > MAX_SIGNERS) {
      throw this.createError(
        `Required signatures must be between 1 and ${MAX_SIGNERS}`,
        'INVALID_THRESHOLD'
      );
    }

    if (signers.length < requiredSignatures) {
      throw this.createError(
        'Not enough signers for the required threshold',
        'INSUFFICIENT_SIGNERS'
      );
    }

    if (signers.length > MAX_SIGNERS) {
      throw this.createError(
        `Maximum ${MAX_SIGNERS} co-signers allowed`,
        'TOO_MANY_SIGNERS'
      );
    }

    // Check for duplicate signers
    const uniqueSigners = new Set(signers);
    if (uniqueSigners.size !== signers.length) {
      throw this.createError(
        'Duplicate signer addresses',
        'DUPLICATE_SIGNERS'
      );
    }
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  /**
   * Generate unique proposal ID
   */
  private generateProposalId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `proposal_${timestamp}_${random}`;
  }

  /**
   * Create standardized error
   */
  private createError(message: string, code?: string): ProviderError {
    return {
      message,
      code,
      provider: 'ChangeNOW', // Using default provider type
    };
  }
}

/**
 * Factory function to create Multi-Sig Card adapter
 *
 * @returns Configured multi-sig adapter
 */
export function createMultiSigCardAdapter(): MultiSigCardAdapter {
  return new MultiSigCardAdapter();
}
