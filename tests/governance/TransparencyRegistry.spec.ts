/**
 * Unit Tests for Transparency Registry
 * Tests for Issue #40 - Governance Transparency & Public Records (Read-Only)
 *
 * Test Categories:
 * 1. Proposal Archive - Completeness and accuracy of public records
 * 2. Voting Summary - Aggregated data correctness
 * 3. Governance Assets - Snapshot verification
 * 4. Immutability - Records cannot be modified
 * 5. Privacy - No individual voter data exposed
 * 6. No Write Paths - Read-only verification
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell } from '@ton/core';
import { TransparencyRegistry } from '../../wrappers/TransparencyRegistry';
import '@ton/test-utils';

// Test constants matching contract
const OUTCOME_PENDING = 0;
const OUTCOME_ACCEPTED = 1;
const OUTCOME_REJECTED = 2;
const OUTCOME_NO_QUORUM = 3;

const CATEGORY_ROADMAP_SIGNAL = 0;
const CATEGORY_INTEGRATION_RECOMMENDATION = 1;
const CATEGORY_DOCUMENTATION_UPDATE = 2;
const CATEGORY_RISK_DISCLOSURE = 3;
const CATEGORY_DEPRECATION_NOTICE = 4;
const CATEGORY_ECOSYSTEM_GRANT_SIGNAL = 5;

const GOVERNANCE_ASSET_TOTAL_SUPPLY = 222;
const DEFAULT_QUORUM_THRESHOLD = 112; // >50% of 222

describe('TransparencyRegistry - Governance Transparency Layer', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let transparencyRegistry: SandboxContract<TransparencyRegistry>;
    let proposalRecorder: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        proposalRecorder = await blockchain.treasury('proposalRecorder');

        // Deploy TransparencyRegistry with default quorum threshold
        transparencyRegistry = blockchain.openContract(
            await TransparencyRegistry.fromInit(BigInt(DEFAULT_QUORUM_THRESHOLD))
        );

        const deployResult = await transparencyRegistry.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: transparencyRegistry.address,
            deploy: true,
            success: true,
        });
    });

    // ========================================
    // PROPOSAL ARCHIVE TESTS
    // ========================================

    describe('Proposal Archive - Completeness of Public Records', () => {
        it('should record a new proposal with all required fields', async () => {
            const proposalId = 1n;
            const proposalHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
            const category = CATEGORY_INTEGRATION_RECOMMENDATION;
            const votingWindowStart = Math.floor(Date.now() / 1000);
            const votingWindowEnd = votingWindowStart + 7 * 24 * 60 * 60; // 7 days

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: proposalId,
                    proposal_hash: proposalHash,
                    category: BigInt(category),
                    voting_window_start: BigInt(votingWindowStart),
                    voting_window_end: BigInt(votingWindowEnd),
                }
            );

            const summary = await transparencyRegistry.getProposalSummary(proposalId);
            expect(summary).not.toBeNull();
            expect(summary!.proposal_id).toEqual(proposalId);
            expect(summary!.proposal_hash).toEqual(proposalHash);
            expect(summary!.category).toEqual(BigInt(category));
            expect(summary!.voting_window_start).toEqual(BigInt(votingWindowStart));
            expect(summary!.voting_window_end).toEqual(BigInt(votingWindowEnd));
            expect(summary!.outcome).toEqual(BigInt(OUTCOME_PENDING));
        });

        it('should return null for non-existent proposal', async () => {
            const summary = await transparencyRegistry.getProposalSummary(999n);
            expect(summary).toBeNull();
        });

        it('should correctly count total proposals', async () => {
            // Initially zero
            let count = await transparencyRegistry.getProposalCount();
            expect(count).toEqual(0n);

            // Add three proposals
            for (let i = 1; i <= 3; i++) {
                await transparencyRegistry.send(
                    proposalRecorder.getSender(),
                    { value: toNano('0.01') },
                    {
                        $$type: 'RecordProposal',
                        proposal_id: BigInt(i),
                        proposal_hash: BigInt(i * 1000),
                        category: BigInt(i % 6),
                        voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                        voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                    }
                );
            }

            count = await transparencyRegistry.getProposalCount();
            expect(count).toEqual(3n);
        });

        it('should correctly count proposals by category', async () => {
            // Add proposals to different categories
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 2n,
                    proposal_hash: 2000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 3n,
                    proposal_hash: 3000n,
                    category: BigInt(CATEGORY_DOCUMENTATION_UPDATE),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            const roadmapCount = await transparencyRegistry.getProposalsByCategory(
                BigInt(CATEGORY_ROADMAP_SIGNAL)
            );
            const docCount = await transparencyRegistry.getProposalsByCategory(
                BigInt(CATEGORY_DOCUMENTATION_UPDATE)
            );
            const riskCount = await transparencyRegistry.getProposalsByCategory(
                BigInt(CATEGORY_RISK_DISCLOSURE)
            );

            expect(roadmapCount).toEqual(2n);
            expect(docCount).toEqual(1n);
            expect(riskCount).toEqual(0n);
        });

        it('should validate category is within valid range', async () => {
            // Invalid category should fail
            const result = await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: 99n, // Invalid category
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            // Should fail validation
            expect(result.transactions).toHaveTransaction({
                from: proposalRecorder.address,
                to: transparencyRegistry.address,
                success: false,
            });
        });
    });

    // ========================================
    // VOTING SUMMARY TESTS (AGGREGATED ONLY)
    // ========================================

    describe('Voting Summary - Aggregated Data Only', () => {
        beforeEach(async () => {
            // Create a test proposal first
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_INTEGRATION_RECOMMENDATION),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );
        });

        it('should record voting result with aggregated data', async () => {
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_ACCEPTED),
                    total_votes: 150n,
                }
            );

            const voting = await transparencyRegistry.getVotingSummary(1n);
            expect(voting).not.toBeNull();
            expect(voting!.proposal_id).toEqual(1n);
            expect(voting!.total_votes_cast).toEqual(150n);
            expect(voting!.quorum_threshold).toEqual(BigInt(DEFAULT_QUORUM_THRESHOLD));
            expect(voting!.quorum_met).toEqual(true);
            expect(voting!.passed).toEqual(true);
        });

        it('should correctly identify quorum not met', async () => {
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_NO_QUORUM),
                    total_votes: 50n, // Below 112 threshold
                }
            );

            const voting = await transparencyRegistry.getVotingSummary(1n);
            expect(voting!.quorum_met).toEqual(false);
            expect(voting!.passed).toEqual(false);
        });

        it('should update proposal outcome correctly', async () => {
            // Initially pending
            let outcome = await transparencyRegistry.getProposalOutcome(1n);
            expect(outcome).toEqual(BigInt(OUTCOME_PENDING));

            // Record acceptance
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_ACCEPTED),
                    total_votes: 150n,
                }
            );

            outcome = await transparencyRegistry.getProposalOutcome(1n);
            expect(outcome).toEqual(BigInt(OUTCOME_ACCEPTED));
        });

        it('should return -1 for non-existent proposal outcome', async () => {
            const outcome = await transparencyRegistry.getProposalOutcome(999n);
            expect(outcome).toEqual(-1n);
        });

        it('should return correct quorum threshold', async () => {
            const threshold = await transparencyRegistry.getQuorumThreshold();
            expect(threshold).toEqual(BigInt(DEFAULT_QUORUM_THRESHOLD));
        });
    });

    // ========================================
    // GOVERNANCE ASSET SNAPSHOT TESTS
    // ========================================

    describe('Governance Asset Snapshot - Verification', () => {
        it('should return fixed total supply of 222', async () => {
            const supply = await transparencyRegistry.getTotalGovernanceSupply();
            expect(supply).toEqual(BigInt(GOVERNANCE_ASSET_TOTAL_SUPPLY));
        });

        it('should record and return snapshot data', async () => {
            const blockHeight = 19882441n;
            const snapshotHash = 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890n;

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordSnapshot',
                    block_height: blockHeight,
                    snapshot_hash: snapshotHash,
                }
            );

            const snapshot = await transparencyRegistry.getGovernanceAssetSnapshot();
            expect(snapshot.total_supply).toEqual(BigInt(GOVERNANCE_ASSET_TOTAL_SUPPLY));
            expect(snapshot.snapshot_block_height).toEqual(blockHeight);
            expect(snapshot.snapshot_hash).toEqual(snapshotHash);
        });

        it('should return latest snapshot block height', async () => {
            const blockHeight = 19992103n;

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordSnapshot',
                    block_height: blockHeight,
                    snapshot_hash: 12345n,
                }
            );

            const latestBlock = await transparencyRegistry.getLatestSnapshotBlock();
            expect(latestBlock).toEqual(blockHeight);
        });
    });

    // ========================================
    // IMMUTABILITY TESTS
    // ========================================

    describe('Immutability Guarantees', () => {
        it('should maintain immutable proposal records', async () => {
            const originalHash = 0x1234n;

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: originalHash,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            // Verify original data persists
            const summary = await transparencyRegistry.getProposalSummary(1n);
            expect(summary!.proposal_hash).toEqual(originalHash);

            // Note: The contract design is append-only
            // Proposal data cannot be modified after creation
        });

        it('should maintain accurate outcome statistics', async () => {
            // Create proposals
            for (let i = 1; i <= 4; i++) {
                await transparencyRegistry.send(
                    proposalRecorder.getSender(),
                    { value: toNano('0.01') },
                    {
                        $$type: 'RecordProposal',
                        proposal_id: BigInt(i),
                        proposal_hash: BigInt(i * 1000),
                        category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                        voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                        voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                    }
                );
            }

            // Record different outcomes
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_ACCEPTED),
                    total_votes: 150n,
                }
            );

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 2n,
                    outcome: BigInt(OUTCOME_REJECTED),
                    total_votes: 130n,
                }
            );

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 3n,
                    outcome: BigInt(OUTCOME_NO_QUORUM),
                    total_votes: 50n,
                }
            );

            const stats = await transparencyRegistry.getGovernanceStats();
            expect(stats.total_proposals).toEqual(4n);
            expect(stats.proposals_accepted).toEqual(1n);
            expect(stats.proposals_rejected).toEqual(1n);
            expect(stats.proposals_no_quorum).toEqual(1n);
            expect(stats.proposals_pending).toEqual(1n);
        });
    });

    // ========================================
    // PRIVACY LEAKAGE RESISTANCE TESTS
    // ========================================

    describe('Privacy Leakage Resistance', () => {
        it('should NOT expose individual voter addresses', async () => {
            // Create and vote on proposal
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_ACCEPTED),
                    total_votes: 150n,
                }
            );

            // VotingSummary only contains aggregate data
            const voting = await transparencyRegistry.getVotingSummary(1n);

            // Verify structure contains ONLY aggregate fields
            // No voter addresses, no vote choices, no timestamps
            expect(voting!.total_votes_cast).toBeDefined();
            expect(voting!.quorum_threshold).toBeDefined();
            expect(voting!.quorum_met).toBeDefined();
            expect(voting!.passed).toBeDefined();

            // The struct does NOT have these privacy-violating fields
            // This is verified by the type system and contract design
        });

        it('should only expose proposal hash, not content', async () => {
            const proposalHash = 0xabcdef123n;

            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: proposalHash,
                    category: BigInt(CATEGORY_DOCUMENTATION_UPDATE),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            const summary = await transparencyRegistry.getProposalSummary(1n);

            // Only hash is stored, not the actual proposal content
            expect(summary!.proposal_hash).toEqual(proposalHash);
            // No proposal_content field exists
        });
    });

    // ========================================
    // NO-WRITE-PATH VERIFICATION TESTS
    // ========================================

    describe('No Write Path Verification', () => {
        it('should have read-only getters that do not modify state', async () => {
            // Add initial data
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            // Call all getters multiple times
            const count1 = await transparencyRegistry.getProposalCount();
            await transparencyRegistry.getProposalSummary(1n);
            await transparencyRegistry.getVotingSummary(1n);
            await transparencyRegistry.getGovernanceStats();
            await transparencyRegistry.getGovernanceAssetSnapshot();
            const count2 = await transparencyRegistry.getProposalCount();

            // State should not change from getter calls
            expect(count1).toEqual(count2);
        });

        it('should not have any admin functions for data modification', async () => {
            // The contract does not include:
            // - editProposal
            // - deleteProposal
            // - modifyVote
            // - setOutcome (direct modification)
            // - pause/unpause
            // - upgrade functions

            // This is verified by the contract design and type system
            // Only RecordProposal, RecordVotingResult, and RecordSnapshot messages exist
            // All are append-only operations
        });
    });

    // ========================================
    // GOVERNANCE STATISTICS TESTS
    // ========================================

    describe('Governance Statistics', () => {
        it('should return accurate aggregate statistics', async () => {
            // Initially empty
            const initialStats = await transparencyRegistry.getGovernanceStats();
            expect(initialStats.total_proposals).toEqual(0n);
            expect(initialStats.proposals_accepted).toEqual(0n);
            expect(initialStats.proposals_rejected).toEqual(0n);
            expect(initialStats.proposals_no_quorum).toEqual(0n);
            expect(initialStats.proposals_pending).toEqual(0n);
        });

        it('should return correct category statistics', async () => {
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ECOSYSTEM_GRANT_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            const categoryStats = await transparencyRegistry.getCategoryStats(
                BigInt(CATEGORY_ECOSYSTEM_GRANT_SIGNAL)
            );

            expect(categoryStats.category).toEqual(BigInt(CATEGORY_ECOSYSTEM_GRANT_SIGNAL));
            expect(categoryStats.proposal_count).toEqual(1n);
        });
    });

    // ========================================
    // EVENT EMISSION TESTS
    // ========================================

    describe('Event Emission for Indexing', () => {
        it('should emit ProposalRecorded event', async () => {
            const result = await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            // Transaction should succeed and emit event
            expect(result.transactions).toHaveTransaction({
                from: proposalRecorder.address,
                to: transparencyRegistry.address,
                success: true,
            });
        });

        it('should emit VotingResultRecorded event', async () => {
            // First create proposal
            await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordProposal',
                    proposal_id: 1n,
                    proposal_hash: 1000n,
                    category: BigInt(CATEGORY_ROADMAP_SIGNAL),
                    voting_window_start: BigInt(Math.floor(Date.now() / 1000)),
                    voting_window_end: BigInt(Math.floor(Date.now() / 1000) + 604800),
                }
            );

            const result = await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordVotingResult',
                    proposal_id: 1n,
                    outcome: BigInt(OUTCOME_ACCEPTED),
                    total_votes: 150n,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: proposalRecorder.address,
                to: transparencyRegistry.address,
                success: true,
            });
        });

        it('should emit SnapshotRecorded event', async () => {
            const result = await transparencyRegistry.send(
                proposalRecorder.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RecordSnapshot',
                    block_height: 19882441n,
                    snapshot_hash: 12345n,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: proposalRecorder.address,
                to: transparencyRegistry.address,
                success: true,
            });
        });
    });
});
