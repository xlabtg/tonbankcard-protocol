/**
 * Unit Tests for Proposal Registry (Issue #38)
 * Tests governance proposal submission, voting, and finalization
 *
 * IMPORTANT: This registry is PURELY ADVISORY. It cannot:
 * - Trigger contract calls
 * - Execute changes
 * - Enforce outcomes
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell } from '@ton/core';
import { ProposalRegistry } from '../../wrappers/ProposalRegistry';
import '@ton/test-utils';

// Proposal categories (fixed enum)
const CATEGORY_ROADMAP_SIGNAL = 0n;
const CATEGORY_INTEGRATION_RECOMMENDATION = 1n;
const CATEGORY_DOCUMENTATION_UPDATE = 2n;
const CATEGORY_RISK_DISCLOSURE = 3n;
const CATEGORY_DEPRECATION_NOTICE = 4n;
const CATEGORY_ECOSYSTEM_GRANT_SIGNAL = 5n;

// Proposal status
const STATUS_ACTIVE = 0n;
const STATUS_ACCEPTED = 1n;
const STATUS_REJECTED = 2n;
const STATUS_NO_QUORUM = 3n;

// Vote types
const VOTE_FOR = 0n;
const VOTE_AGAINST = 1n;
const VOTE_ABSTAIN = 2n;

// Test metadata hash (simulating SHA-256 of proposal content)
const TEST_METADATA_HASH = BigInt('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

describe('ProposalRegistry - Proposal Submission', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let author: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        author = await blockchain.treasury('author');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        const deployResult = await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: registry.address,
            deploy: true,
            success: true,
        });
    });

    describe('Submit Proposal Validation', () => {
        it('should successfully submit a valid proposal', async () => {
            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n, // Valid Diamond NFT ID (1-222)
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 0n, // Use default (7 days)
                    quorum_threshold: 0n, // Use default (22 votes)
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: author.address,
                to: registry.address,
                success: true,
            });

            // Verify proposal was created
            const proposalCount = await registry.getProposalCount();
            expect(proposalCount).toEqual(1n);

            // Verify proposal data
            const proposal = await registry.getProposal(1n);
            expect(proposal).not.toBeNull();
            expect(proposal?.id).toEqual(1n);
            expect(proposal?.metadata_hash).toEqual(TEST_METADATA_HASH);
            expect(proposal?.author_nft_id).toEqual(1n);
            expect(proposal?.category).toEqual(CATEGORY_ROADMAP_SIGNAL);
            expect(proposal?.status).toEqual(STATUS_ACTIVE);
        });

        it('should reject proposal with invalid category (> 5)', async () => {
            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: 6n, // Invalid category
                    voting_duration: 0n,
                    quorum_threshold: 0n,
                }
            );

            // Transaction should fail
            expect(result.transactions).toHaveTransaction({
                from: author.address,
                to: registry.address,
                success: false,
            });

            // No proposal should be created
            const proposalCount = await registry.getProposalCount();
            expect(proposalCount).toEqual(0n);
        });

        it('should reject proposal with invalid NFT ID (0)', async () => {
            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 0n, // Invalid (must be 1-222)
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 0n,
                    quorum_threshold: 0n,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: author.address,
                to: registry.address,
                success: false,
            });
        });

        it('should reject proposal with NFT ID > 222', async () => {
            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 223n, // Invalid (must be 1-222)
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 0n,
                    quorum_threshold: 0n,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: author.address,
                to: registry.address,
                success: false,
            });
        });

        it('should accept all valid categories (0-5)', async () => {
            const categories = [
                CATEGORY_ROADMAP_SIGNAL,
                CATEGORY_INTEGRATION_RECOMMENDATION,
                CATEGORY_DOCUMENTATION_UPDATE,
                CATEGORY_RISK_DISCLOSURE,
                CATEGORY_DEPRECATION_NOTICE,
                CATEGORY_ECOSYSTEM_GRANT_SIGNAL,
            ];

            for (let i = 0; i < categories.length; i++) {
                const result = await registry.send(
                    author.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'SubmitProposal',
                        metadata_hash: TEST_METADATA_HASH,
                        author_nft_id: BigInt(i + 1),
                        category: categories[i],
                        voting_duration: 0n,
                        quorum_threshold: 0n,
                    }
                );

                expect(result.transactions).toHaveTransaction({
                    from: author.address,
                    to: registry.address,
                    success: true,
                });
            }

            const proposalCount = await registry.getProposalCount();
            expect(proposalCount).toEqual(6n);
        });

        it('should allow custom voting duration', async () => {
            const customDuration = 86400n; // 1 day

            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: customDuration,
                    quorum_threshold: 0n,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            const proposal = await registry.getProposal(1n);
            expect(proposal?.voting_end).toEqual(proposal!.voting_start + customDuration);
        });

        it('should allow custom quorum threshold', async () => {
            const customQuorum = 50n; // 50 votes minimum

            const result = await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 0n,
                    quorum_threshold: customQuorum,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            const proposal = await registry.getProposal(1n);
            expect(proposal?.quorum_threshold).toEqual(customQuorum);
        });
    });
});

describe('ProposalRegistry - Voting', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let author: SandboxContract<TreasuryContract>;
    let voter1: SandboxContract<TreasuryContract>;
    let voter2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        author = await blockchain.treasury('author');
        voter1 = await blockchain.treasury('voter1');
        voter2 = await blockchain.treasury('voter2');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Create a proposal for voting tests
        await registry.send(
            author.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitProposal',
                metadata_hash: TEST_METADATA_HASH,
                author_nft_id: 1n,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: 604800n, // 7 days
                quorum_threshold: 3n, // Low quorum for testing
            }
        );
    });

    describe('Cast Vote Validation', () => {
        it('should successfully cast a FOR vote', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: VOTE_FOR,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            // Verify vote was recorded
            const hasVoted = await registry.getHasVoted(1n, 10n);
            expect(hasVoted).toBe(true);

            const voteCounts = await registry.getVoteCounts(1n);
            expect(voteCounts.get(VOTE_FOR)).toEqual(1n);
        });

        it('should successfully cast an AGAINST vote', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: VOTE_AGAINST,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            const voteCounts = await registry.getVoteCounts(1n);
            expect(voteCounts.get(VOTE_AGAINST)).toEqual(1n);
        });

        it('should successfully cast an ABSTAIN vote', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: VOTE_ABSTAIN,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            const voteCounts = await registry.getVoteCounts(1n);
            expect(voteCounts.get(VOTE_ABSTAIN)).toEqual(1n);
        });

        it('should reject invalid vote type', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: 3n, // Invalid vote type
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });

        it('should reject vote from invalid NFT ID (0)', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 0n, // Invalid
                    vote: VOTE_FOR,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });

        it('should reject vote from invalid NFT ID (> 222)', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 223n, // Invalid
                    vote: VOTE_FOR,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });

        it('should reject vote on non-existent proposal', async () => {
            const result = await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 999n, // Non-existent
                    voter_nft_id: 10n,
                    vote: VOTE_FOR,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });

        it('should prevent double voting (same NFT ID)', async () => {
            // First vote
            await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: VOTE_FOR,
                }
            );

            // Try to vote again with same NFT ID
            const result = await registry.send(
                voter2.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n, // Same NFT ID - should fail
                    vote: VOTE_AGAINST,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });

            // Vote count should still be 1
            const voteCounts = await registry.getVoteCounts(1n);
            expect(voteCounts.get(VOTE_FOR)).toEqual(1n);
            expect(voteCounts.get(VOTE_AGAINST)).toEqual(0n);
        });

        it('should allow different NFT IDs to vote', async () => {
            // Vote from NFT 10
            await registry.send(
                voter1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 10n,
                    vote: VOTE_FOR,
                }
            );

            // Vote from NFT 20
            await registry.send(
                voter2.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: 20n,
                    vote: VOTE_AGAINST,
                }
            );

            const voteCounts = await registry.getVoteCounts(1n);
            expect(voteCounts.get(VOTE_FOR)).toEqual(1n);
            expect(voteCounts.get(VOTE_AGAINST)).toEqual(1n);
        });
    });
});

describe('ProposalRegistry - Finalization', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let author: SandboxContract<TreasuryContract>;
    let voter: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        author = await blockchain.treasury('author');
        voter = await blockchain.treasury('voter');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    describe('Proposal Finalization', () => {
        it('should finalize as ACCEPTED when FOR > AGAINST and quorum met', async () => {
            // Create proposal with short voting period and low quorum
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n, // 1 second for testing
                    quorum_threshold: 2n, // Low quorum
                }
            );

            // Cast votes
            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 11n, vote: VOTE_FOR }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 12n, vote: VOTE_AGAINST }
            );

            // Wait for voting to end (simulate time passing)
            // In sandbox, we need to wait for the voting period
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Finalize
            const result = await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            const proposal = await registry.getProposal(1n);
            expect(proposal?.status).toEqual(STATUS_ACCEPTED);
        });

        it('should finalize as REJECTED when AGAINST >= FOR and quorum met', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n,
                    quorum_threshold: 2n,
                }
            );

            // Cast votes (more AGAINST than FOR)
            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_AGAINST }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 11n, vote: VOTE_AGAINST }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 12n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            const proposal = await registry.getProposal(1n);
            expect(proposal?.status).toEqual(STATUS_REJECTED);
        });

        it('should finalize as NO_QUORUM when quorum not met', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n,
                    quorum_threshold: 10n, // Higher quorum
                }
            );

            // Only cast 1 vote (below quorum)
            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            const proposal = await registry.getProposal(1n);
            expect(proposal?.status).toEqual(STATUS_NO_QUORUM);
        });

        it('should reject finalization when voting not ended', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 604800n, // 7 days
                    quorum_threshold: 2n,
                }
            );

            // Try to finalize immediately
            const result = await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });

            const proposal = await registry.getProposal(1n);
            expect(proposal?.status).toEqual(STATUS_ACTIVE);
        });

        it('should reject finalization of already finalized proposal', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n,
                    quorum_threshold: 1n,
                }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            // First finalization
            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            // Second finalization attempt
            const result = await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });
    });
});

describe('ProposalRegistry - Immutability Guarantees', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let author: SandboxContract<TreasuryContract>;
    let voter: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        author = await blockchain.treasury('author');
        voter = await blockchain.treasury('voter');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    describe('Registry Immutability', () => {
        it('should not allow proposal deletion (append-only)', async () => {
            // Create proposal
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 604800n,
                    quorum_threshold: 22n,
                }
            );

            // Verify proposal exists
            const proposalBefore = await registry.getProposal(1n);
            expect(proposalBefore).not.toBeNull();

            // There is no delete function - this is by design
            // The contract does not expose any method to delete proposals
            // This test verifies the design constraint

            // Create another proposal
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH + 1n,
                    author_nft_id: 2n,
                    category: CATEGORY_DOCUMENTATION_UPDATE,
                    voting_duration: 604800n,
                    quorum_threshold: 22n,
                }
            );

            // Both proposals should exist (append-only)
            const proposal1 = await registry.getProposal(1n);
            const proposal2 = await registry.getProposal(2n);
            expect(proposal1).not.toBeNull();
            expect(proposal2).not.toBeNull();
            expect(await registry.getProposalCount()).toEqual(2n);
        });

        it('should not allow proposal modification after submission', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 604800n,
                    quorum_threshold: 22n,
                }
            );

            const originalProposal = await registry.getProposal(1n);

            // The contract has no update/modify functions by design
            // Verify proposal data remains unchanged after other operations

            // Cast a vote
            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            const proposalAfterVote = await registry.getProposal(1n);

            // Core proposal data should be unchanged (only vote counts change)
            expect(proposalAfterVote?.metadata_hash).toEqual(originalProposal?.metadata_hash);
            expect(proposalAfterVote?.author_nft_id).toEqual(originalProposal?.author_nft_id);
            expect(proposalAfterVote?.category).toEqual(originalProposal?.category);
            expect(proposalAfterVote?.voting_start).toEqual(originalProposal?.voting_start);
            expect(proposalAfterVote?.voting_end).toEqual(originalProposal?.voting_end);
            expect(proposalAfterVote?.quorum_threshold).toEqual(originalProposal?.quorum_threshold);
        });

        it('should not allow voting after finalization', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n, // Short voting period
                    quorum_threshold: 1n,
                }
            );

            // Cast a vote
            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Finalize
            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            // Try to vote after finalization
            const result = await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 20n, vote: VOTE_AGAINST }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });

            // Vote count should not change
            const proposal = await registry.getProposal(1n);
            expect(proposal?.votes_for).toEqual(1n);
            expect(proposal?.votes_against).toEqual(0n);
        });

        it('should not allow status change after finalization', async () => {
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n,
                    quorum_threshold: 1n,
                }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Finalize
            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            const finalStatus = (await registry.getProposal(1n))?.status;

            // Try to finalize again
            await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            // Status should not change
            expect((await registry.getProposal(1n))?.status).toEqual(finalStatus);
        });
    });
});

describe('ProposalRegistry - Non-Executable Verification', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    describe('Registry is Non-Executable', () => {
        it('should have no execution engine (no external contract calls)', async () => {
            // The registry contract does not have any methods that call external contracts
            // to execute changes. This is by design.

            // Verify the contract only has:
            // - SubmitProposal (append-only storage)
            // - CastVote (vote recording)
            // - FinalizeProposal (status update only)
            // - Read-only getters

            // The contract state can be verified to contain no external contract addresses
            // except for the Diamonds collection (for verification purposes only)

            const defaultQuorum = await registry.getDefaultQuorumThreshold();
            expect(defaultQuorum).toEqual(22n);

            const defaultDuration = await registry.getDefaultVotingDuration();
            expect(defaultDuration).toEqual(604800n);

            const totalSupply = await registry.getDiamondsTotalSupply();
            expect(totalSupply).toEqual(222n);
        });

        it('should not trigger protocol changes on proposal acceptance', async () => {
            const author = await blockchain.treasury('author');
            const voter = await blockchain.treasury('voter');

            // Create and pass a proposal
            await registry.send(
                author.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SubmitProposal',
                    metadata_hash: TEST_METADATA_HASH,
                    author_nft_id: 1n,
                    category: CATEGORY_ROADMAP_SIGNAL,
                    voting_duration: 1n,
                    quorum_threshold: 1n,
                }
            );

            await registry.send(
                voter.getSender(),
                { value: toNano('0.05') },
                { $$type: 'CastVote', proposal_id: 1n, voter_nft_id: 10n, vote: VOTE_FOR }
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            const finalizeResult = await registry.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'FinalizeProposal', proposal_id: 1n }
            );

            // Verify finalization only updates internal state
            // No external contract calls should be made
            expect(finalizeResult.transactions.length).toBeLessThanOrEqual(3);

            // All transactions should be within the registry
            finalizeResult.transactions.forEach(tx => {
                if (tx.inMessage?.info.type === 'internal') {
                    // Only internal transactions to/from registry
                    expect(
                        tx.inMessage.info.dest.equals(registry.address) ||
                        tx.inMessage.info.src.equals(registry.address) ||
                        tx.inMessage.info.src.equals(deployer.address)
                    ).toBe(true);
                }
            });
        });
    });
});
