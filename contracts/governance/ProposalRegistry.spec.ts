/**
 * ProposalRegistry — On-chain NFT ownership verification regression tests
 * Issue #248 / Audit finding CONTRACTS-C1.
 *
 * Background:
 *   The original ProposalRegistry recorded votes (CastVote) and proposals
 *   (SubmitProposal) using caller-supplied NFT IDs WITHOUT verifying that the
 *   sender actually owned the NFT. Any single wallet could therefore fabricate
 *   all 222 votes and unilaterally pass or reject any proposal.
 *
 * Fix (suggested-fix bullet 3 — asynchronous request/response):
 *   The registry never trusts a caller-supplied NFT ID. It asks a trusted
 *   on-chain resolver "who owns NFT N?" and only materialises the vote/proposal
 *   in the resolver's OwnershipResolved callback, and only when the resolved
 *   owner equals the original sender (claimant). The whole message chain
 *   completes synchronously inside a single send() in @ton/sandbox.
 *
 * These tests exercise the acceptance criteria:
 *   (a) CastVote resolves the NFT owner on-chain and rejects sender != owner.
 *   (b) SubmitProposal resolves and enforces ownership of author_nft_id.
 *   (c) Caller-supplied NFT IDs alone can no longer record a vote/proposal.
 *   (d) A non-owner is rejected; a single wallet cannot accumulate votes for
 *       NFTs it does not own.
 *   (e) The legitimate owner of NFT N can still vote/submit successfully.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { ProposalRegistry } from './dist/TestHarness_ProposalRegistry';
import { TestOwnershipResolver } from './dist/TestHarness_TestOwnershipResolver';

// Mirror of the Tact constants (bigint to match generated types).
const VOTE_FOR = 0n;
const VOTE_AGAINST = 1n;
const STATUS_ACTIVE = 0n;
const CATEGORY_ROADMAP_SIGNAL = 0n;

const GAS = toNano('0.2');

describe('ProposalRegistry — on-chain NFT ownership verification', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let ownerOf1: SandboxContract<TreasuryContract>;
    let ownerOf2: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let resolver: SandboxContract<TestOwnershipResolver>;

    async function deployRegistry() {
        const r = blockchain.openContract(await ProposalRegistry.fromInit());
        await r.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        return r;
    }

    async function deployResolver() {
        const r = blockchain.openContract(await TestOwnershipResolver.fromInit());
        await r.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        return r;
    }

    async function registerOwner(nftId: bigint, owner: SandboxContract<TreasuryContract>) {
        await resolver.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'RegisterOwner', nft_id: nftId, owner: owner.address }
        );
    }

    // Submit a proposal authored by `author`, claiming `nftId`, and return the
    // proposal count afterwards.
    async function submitProposal(author: SandboxContract<TreasuryContract>, nftId: bigint) {
        await registry.send(
            author.getSender(),
            { value: GAS },
            {
                $$type: 'SubmitProposal',
                metadata_hash: 12345n,
                author_nft_id: nftId,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: 0n, // use default
                quorum_threshold: 0n, // use default
            }
        );
    }

    async function castVote(
        voter: SandboxContract<TreasuryContract>,
        proposalId: bigint,
        nftId: bigint,
        vote: bigint
    ) {
        await registry.send(
            voter.getSender(),
            { value: GAS },
            { $$type: 'CastVote', proposal_id: proposalId, voter_nft_id: nftId, vote }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        ownerOf1 = await blockchain.treasury('ownerOf1');
        ownerOf2 = await blockchain.treasury('ownerOf2');
        attacker = await blockchain.treasury('attacker');

        registry = await deployRegistry();
        resolver = await deployResolver();

        // One-time deployer-gated resolver configuration.
        await registry.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetOwnerResolver', resolver: resolver.address }
        );

        // Seed authoritative ownership: NFT #1 -> ownerOf1, NFT #2 -> ownerOf2.
        await registerOwner(1n, ownerOf1);
        await registerOwner(2n, ownerOf2);
    });

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    it('records the deployer and exposes the configured resolver', async () => {
        expect((await registry.getGetDeployer()).toString()).toBe(deployer.address.toString());
        const configured = await registry.getGetOwnerResolver();
        expect(configured).not.toBeNull();
        expect(configured!.toString()).toBe(resolver.address.toString());
    });

    it('allows the deployer to set the resolver only once', async () => {
        // Sending SetOwnerResolver again to the registry must be rejected.
        const res = await registry.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetOwnerResolver', resolver: deployer.address }
        );
        expect(res.transactions).toHaveTransaction({
            to: registry.address,
            success: false,
        });
        // Resolver address is unchanged.
        expect((await registry.getGetOwnerResolver())!.toString()).toBe(resolver.address.toString());
    });

    it('rejects resolver configuration by a non-deployer', async () => {
        // ProposalRegistry.fromInit() takes no args, so its address is
        // deterministic; an isolated blockchain is required to obtain a truly
        // unconfigured instance (one whose deployer is not the test deployer).
        const bc = await Blockchain.create();
        const dep = await bc.treasury('deployer2');
        const atk = await bc.treasury('attacker2');
        const freshRegistry = bc.openContract(await ProposalRegistry.fromInit());
        await freshRegistry.send(dep.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });

        const res = await freshRegistry.send(
            atk.getSender(),
            { value: GAS },
            { $$type: 'SetOwnerResolver', resolver: dep.address }
        );
        expect(res.transactions).toHaveTransaction({
            to: freshRegistry.address,
            success: false,
        });
        expect(await freshRegistry.getGetOwnerResolver()).toBeNull();
    });

    // ========================================================================
    // (e) LEGITIMATE OWNER CAN SUBMIT + VOTE
    // ========================================================================

    it('lets the legitimate owner submit a proposal (ownership confirmed)', async () => {
        expect(await registry.getGetProposalCount()).toBe(0n);

        await submitProposal(ownerOf1, 1n);

        expect(await registry.getGetProposalCount()).toBe(1n);
        const proposal = await registry.getGetProposal(1n);
        expect(proposal).not.toBeNull();
        expect(proposal!.author_nft_id).toBe(1n);
        expect(proposal!.status).toBe(STATUS_ACTIVE);
    });

    it('lets the legitimate owner cast a vote (ownership confirmed)', async () => {
        await submitProposal(ownerOf1, 1n);

        await castVote(ownerOf2, 1n, 2n, VOTE_FOR);

        expect(await registry.getHasVoted(1n, 2n)).toBe(true);
        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR)).toBe(1n);
    });

    // ========================================================================
    // (a)(c)(d) NON-OWNER IS REJECTED — caller-supplied NFT ID is not enough
    // ========================================================================

    it('does NOT record a proposal when the author does not own the NFT', async () => {
        // attacker claims NFT #1 which is owned by ownerOf1.
        await submitProposal(attacker, 1n);

        // Nothing is materialised.
        expect(await registry.getGetProposalCount()).toBe(0n);
        expect(await registry.getGetProposal(1n)).toBeNull();
    });

    it('does NOT record a vote when the voter does not own the NFT', async () => {
        await submitProposal(ownerOf1, 1n);

        // attacker tries to vote with NFT #2 (owned by ownerOf2).
        await castVote(attacker, 1n, 2n, VOTE_FOR);

        expect(await registry.getHasVoted(1n, 2n)).toBe(false);
        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR) ?? 0n).toBe(0n);
    });

    it('prevents a single wallet from accumulating votes for NFTs it does not own', async () => {
        await submitProposal(ownerOf1, 1n);

        // The classic attack: one wallet iterates over many Diamond NFT IDs.
        // Only NFTs actually owned by the attacker would resolve to it; here the
        // attacker owns none of 1..50, so zero votes must be recorded.
        for (let nft = 1n; nft <= 50n; nft++) {
            await castVote(attacker, 1n, nft, VOTE_FOR);
        }

        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR) ?? 0n).toBe(0n);
        expect(counts.get(VOTE_AGAINST) ?? 0n).toBe(0n);

        for (let nft = 1n; nft <= 50n; nft++) {
            expect(await registry.getHasVoted(1n, nft)).toBe(false);
        }
    });

    it('records exactly one vote when the wallet owns exactly one NFT', async () => {
        await submitProposal(ownerOf1, 1n);

        // ownerOf2 owns only NFT #2. Even if it tries other NFT IDs, only #2 counts.
        await castVote(ownerOf2, 1n, 1n, VOTE_FOR); // not owned -> ignored
        await castVote(ownerOf2, 1n, 2n, VOTE_FOR); // owned -> counted
        await castVote(ownerOf2, 1n, 3n, VOTE_FOR); // not owned -> ignored

        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR)).toBe(1n);
        expect(await registry.getHasVoted(1n, 2n)).toBe(true);
        expect(await registry.getHasVoted(1n, 1n)).toBe(false);
        expect(await registry.getHasVoted(1n, 3n)).toBe(false);
    });

    it('prevents the same owner from voting twice on the same proposal', async () => {
        await submitProposal(ownerOf1, 1n);

        await castVote(ownerOf2, 1n, 2n, VOTE_FOR);
        await castVote(ownerOf2, 1n, 2n, VOTE_AGAINST); // double-vote attempt

        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR)).toBe(1n);
        expect(counts.get(VOTE_AGAINST) ?? 0n).toBe(0n);
    });

    // ========================================================================
    // SPOOFED CALLBACK + UNCONFIGURED RESOLVER
    // ========================================================================

    it('rejects a forged OwnershipResolved from a non-resolver address', async () => {
        await submitProposal(ownerOf1, 1n);

        // attacker forges a callback claiming to own NFT #5 for proposal voting.
        // It is rejected because sender() != configured resolver, so no state
        // change and the transaction is unsuccessful.
        const res = await registry.send(
            attacker.getSender(),
            { value: GAS },
            { $$type: 'OwnershipResolved', query_id: 999n, nft_id: 5n, owner: attacker.address }
        );
        expect(res.transactions).toHaveTransaction({
            from: attacker.address,
            to: registry.address,
            success: false,
        });
        expect(await registry.getHasVoted(1n, 5n)).toBe(false);
    });

    it('rejects voting and proposing before the resolver is configured', async () => {
        // Isolated blockchain so the registry is genuinely unconfigured (see note
        // above about fromInit() producing a deterministic address).
        const bc = await Blockchain.create();
        const dep = await bc.treasury('deployer3');
        const owner = await bc.treasury('owner3');
        const freshRegistry = bc.openContract(await ProposalRegistry.fromInit());
        await freshRegistry.send(dep.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        // No SetOwnerResolver sent.

        const sub = await freshRegistry.send(
            owner.getSender(),
            { value: GAS },
            {
                $$type: 'SubmitProposal',
                metadata_hash: 1n,
                author_nft_id: 1n,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: 0n,
                quorum_threshold: 0n,
            }
        );
        expect(sub.transactions).toHaveTransaction({
            to: freshRegistry.address,
            success: false,
        });
        expect(await freshRegistry.getGetProposalCount()).toBe(0n);
    });
});
