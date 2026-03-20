/**
 * Multi-Signature Card Adapter Test Suite (Phase 4)
 *
 * Tests for the MultiSigCardAdapter covering:
 * - Configuration management
 * - Proposal creation and validation
 * - Approval workflow
 * - Security invariant verification
 *
 * ⚠️ CRITICAL: These tests verify that the adapter remains NON-CUSTODIAL
 * and maintains the permission-layer design specified in Phase 4.
 */

import {
  MultiSigCardAdapter,
  createMultiSigCardAdapter,
} from '../../backend/adapters/multisig';
import type {
  MultiSigCardConfig,
  PaymentProposal,
} from '../../backend/adapters/types';

describe('Multi-Signature Card Adapter', () => {
  let adapter: MultiSigCardAdapter;

  const SIGNER_1 = 'EQD_signer_1_address';
  const SIGNER_2 = 'EQD_signer_2_address';
  const SIGNER_3 = 'EQD_signer_3_address';
  const NFT_ACCOUNT = '7777001';

  beforeEach(() => {
    adapter = createMultiSigCardAdapter();
  });

  // ===========================================================================
  // CONFIGURATION MANAGEMENT
  // ===========================================================================

  describe('Configuration Management', () => {
    test('should create valid multi-sig config with 1 signer', () => {
      const config = adapter.createConfig(NFT_ACCOUNT, 1, [SIGNER_1]);

      expect(config.nftAccountId).toBe(NFT_ACCOUNT);
      expect(config.requiredSignatures).toBe(1);
      expect(config.signers).toEqual([SIGNER_1]);
      expect(config.isActive).toBe(true);
      expect(config.createdAt).toBeInstanceOf(Date);
    });

    test('should create config with multiple signers', () => {
      const config = adapter.createConfig(NFT_ACCOUNT, 2, [SIGNER_1, SIGNER_2, SIGNER_3]);

      expect(config.requiredSignatures).toBe(2);
      expect(config.signers).toHaveLength(3);
    });

    test('should reject threshold > max signers', () => {
      expect(() => {
        adapter.createConfig(NFT_ACCOUNT, 4, [SIGNER_1, SIGNER_2, SIGNER_3]);
      }).toThrow();
    });

    test('should reject threshold < 1', () => {
      expect(() => {
        adapter.createConfig(NFT_ACCOUNT, 0, [SIGNER_1]);
      }).toThrow();
    });

    test('should reject insufficient signers for threshold', () => {
      expect(() => {
        adapter.createConfig(NFT_ACCOUNT, 3, [SIGNER_1, SIGNER_2]);
      }).toThrow();
    });

    test('should reject duplicate signers', () => {
      expect(() => {
        adapter.createConfig(NFT_ACCOUNT, 2, [SIGNER_1, SIGNER_1]);
      }).toThrow();
    });

    test('should deactivate config', () => {
      const config = adapter.createConfig(NFT_ACCOUNT, 1, [SIGNER_1]);
      const deactivated = adapter.deactivateConfig(config);

      expect(deactivated.isActive).toBe(false);
      expect(deactivated.nftAccountId).toBe(NFT_ACCOUNT);
    });
  });

  // ===========================================================================
  // PROPOSAL MANAGEMENT
  // ===========================================================================

  describe('Proposal Management', () => {
    let config: MultiSigCardConfig;

    beforeEach(() => {
      config = adapter.createConfig(NFT_ACCOUNT, 2, [SIGNER_1, SIGNER_2]);
    });

    test('should create valid proposal', () => {
      const proposal = adapter.createProposal(
        NFT_ACCOUNT,
        'EQD_recipient',
        '1000000000',
        config
      );

      expect(proposal.nftAccountId).toBe(NFT_ACCOUNT);
      expect(proposal.recipient).toBe('EQD_recipient');
      expect(proposal.amount).toBe('1000000000');
      expect(proposal.status).toBe('pending');
      expect(proposal.approvalCount).toBe(0);
      expect(proposal.requiredApprovals).toBe(2);
      expect(proposal.approvers).toEqual([]);
      expect(proposal.proposalId).toBeTruthy();
    });

    test('should reject proposal with invalid amount', () => {
      expect(() => {
        adapter.createProposal(NFT_ACCOUNT, 'EQD_recipient', '0', config);
      }).toThrow();
    });

    test('should reject proposal with negative amount', () => {
      expect(() => {
        adapter.createProposal(NFT_ACCOUNT, 'EQD_recipient', '-100', config);
      }).toThrow();
    });

    test('should reject proposal with empty recipient', () => {
      expect(() => {
        adapter.createProposal(NFT_ACCOUNT, '', '1000', config);
      }).toThrow();
    });

    test('should reject proposal when multi-sig is not active', () => {
      const deactivated = adapter.deactivateConfig(config);
      expect(() => {
        adapter.createProposal(NFT_ACCOUNT, 'EQD_recipient', '1000', deactivated);
      }).toThrow();
    });
  });

  // ===========================================================================
  // APPROVAL WORKFLOW
  // ===========================================================================

  describe('Approval Workflow', () => {
    let config: MultiSigCardConfig;
    let proposal: PaymentProposal;

    beforeEach(() => {
      config = adapter.createConfig(NFT_ACCOUNT, 2, [SIGNER_1, SIGNER_2, SIGNER_3]);
      proposal = adapter.createProposal(
        NFT_ACCOUNT,
        'EQD_recipient',
        '1000000000',
        config
      );
    });

    test('should record approval from registered signer', () => {
      const updated = adapter.recordApproval(proposal, SIGNER_1, config);

      expect(updated.approvalCount).toBe(1);
      expect(updated.approvers).toContain(SIGNER_1);
      expect(updated.status).toBe('pending');
    });

    test('should approve proposal when threshold reached', () => {
      const after1 = adapter.recordApproval(proposal, SIGNER_1, config);
      const after2 = adapter.recordApproval(after1, SIGNER_2, config);

      expect(after2.approvalCount).toBe(2);
      expect(after2.status).toBe('approved');
    });

    test('should reject approval from non-signer', () => {
      expect(() => {
        adapter.recordApproval(proposal, 'EQD_unknown_address', config);
      }).toThrow();
    });

    test('should reject duplicate approval', () => {
      const after1 = adapter.recordApproval(proposal, SIGNER_1, config);
      expect(() => {
        adapter.recordApproval(after1, SIGNER_1, config);
      }).toThrow();
    });

    test('should reject approval on non-pending proposal', () => {
      const after1 = adapter.recordApproval(proposal, SIGNER_1, config);
      const approved = adapter.recordApproval(after1, SIGNER_2, config);

      expect(() => {
        adapter.recordApproval(approved, SIGNER_3, config);
      }).toThrow();
    });

    test('should reject proposal', () => {
      const rejected = adapter.rejectProposal(proposal);
      expect(rejected.status).toBe('rejected');
    });

    test('should not reject already rejected proposal', () => {
      const rejected = adapter.rejectProposal(proposal);
      expect(() => {
        adapter.rejectProposal(rejected);
      }).toThrow();
    });

    test('should mark approved proposal as executed', () => {
      const after1 = adapter.recordApproval(proposal, SIGNER_1, config);
      const approved = adapter.recordApproval(after1, SIGNER_2, config);
      const executed = adapter.markExecuted(approved);

      expect(executed.status).toBe('executed');
    });

    test('should not execute non-approved proposal', () => {
      expect(() => {
        adapter.markExecuted(proposal);
      }).toThrow();
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
        m.includes('sign')
      );
      expect(dangerousMethods).toHaveLength(0);
    });

    test('adapter cannot modify on-chain state', () => {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter));
      const stateModifyingMethods = methods.filter(m =>
        m.includes('deploy') ||
        m.includes('send') ||
        m.includes('broadcast')
      );
      expect(stateModifyingMethods).toHaveLength(0);
    });

    test('proposal IDs are unique', () => {
      const config = adapter.createConfig(NFT_ACCOUNT, 1, [SIGNER_1]);
      const p1 = adapter.createProposal(NFT_ACCOUNT, 'EQD_r1', '100', config);
      const p2 = adapter.createProposal(NFT_ACCOUNT, 'EQD_r2', '200', config);
      expect(p1.proposalId).not.toBe(p2.proposalId);
    });
  });
});
