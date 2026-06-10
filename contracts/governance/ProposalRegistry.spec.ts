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
import { Dictionary, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { ProposalRegistry } from './dist/TestHarness_ProposalRegistry';
import { TestOwnershipResolver } from './dist/TestHarness_TestOwnershipResolver';
import { SnapshotVerifier } from './dist/SnapshotVerifier_SnapshotVerifier';

// Mirror of the Tact constants (bigint to match generated types).
const VOTE_FOR = 0n;
const VOTE_AGAINST = 1n;
const STATUS_NO_QUORUM = 3n;
const STATUS_ACTIVE = 0n;
const CATEGORY_ROADMAP_SIGNAL = 0n;

const TOTAL_DIAMONDS = 222n;
const DEFAULT_QUORUM_PERCENTAGE = 10n;
const PERCENT_DENOMINATOR = 100n;
const RESOLVER_STYLE_DEFAULT_QUORUM =
    (TOTAL_DIAMONDS * DEFAULT_QUORUM_PERCENTAGE + PERCENT_DENOMINATOR - 1n) / PERCENT_DENOMINATOR;

const GAS = toNano('0.2');
const SNAPSHOT_GAS = toNano('2');

describe('ProposalRegistry — on-chain NFT ownership verification', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let ownerOf1: SandboxContract<TreasuryContract>;
    let ownerOf2: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let resolver: SandboxContract<TestOwnershipResolver>;
    let verifier: SandboxContract<SnapshotVerifier>;

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

    async function deployVerifier() {
        const v = blockchain.openContract(await SnapshotVerifier.fromInit());
        await v.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
        // Issue #370: the verifier rejects RegisterSnapshot until the deployer
        // designates the trusted indexer. These integration tests use the
        // deployer treasury as the snapshot writer, so authorize it explicitly.
        await v.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetTrustedIndexer', indexer: deployer.address }
        );
        return v;
    }

    async function registerOwner(nftId: bigint, owner: SandboxContract<TreasuryContract>) {
        await resolver.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'RegisterOwner', nft_id: nftId, owner: owner.address }
        );
    }

    async function registerSnapshot(proposalId: bigint, eligibleIds: bigint[]) {
        const eligibleNfts = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        for (const nftId of eligibleIds) {
            eligibleNfts.set(nftId, true);
        }

        const result = await verifier.send(
            deployer.getSender(),
            { value: SNAPSHOT_GAS },
            {
                $$type: 'RegisterSnapshot',
                proposal_id: proposalId,
                timestamp: BigInt(blockchain.now ?? Math.floor(Date.now() / 1000)),
                eligible_nfts: eligibleNfts,
            }
        );
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: true,
        });
    }

    async function registerRangeSnapshot(proposalId: bigint, start: bigint, end: bigint) {
        const eligibleIds: bigint[] = [];
        for (let nftId = start; nftId <= end; nftId++) {
            eligibleIds.push(nftId);
        }
        await registerSnapshot(proposalId, eligibleIds);
    }

    // Submit a proposal authored by `author`, claiming `nftId`, and return the
    // proposal count afterwards.
    async function submitProposal(
        author: SandboxContract<TreasuryContract>,
        nftId: bigint,
        votingDuration: bigint = 0n,
        quorumThreshold: bigint = 0n
    ) {
        await registry.send(
            author.getSender(),
            { value: GAS },
            {
                $$type: 'SubmitProposal',
                metadata_hash: 12345n,
                author_nft_id: nftId,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: votingDuration, // 0 uses default
                quorum_threshold: quorumThreshold, // 0 uses default
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
        verifier = await deployVerifier();

        // One-time deployer-gated resolver configuration.
        await registry.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetOwnerResolver', resolver: resolver.address }
        );
        await registry.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetSnapshotVerifier', verifier: verifier.address }
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
        const snapshotVerifier = await registry.getGetSnapshotVerifier();
        expect(snapshotVerifier).not.toBeNull();
        expect(snapshotVerifier!.toString()).toBe(verifier.address.toString());
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

    it('uses the resolver-style rounded-up 10% quorum by default', async () => {
        expect(RESOLVER_STYLE_DEFAULT_QUORUM).toBe(23n);
        expect(await registry.getGetDiamondsTotalSupply()).toBe(TOTAL_DIAMONDS);
        expect(await registry.getGetDefaultQuorumThreshold()).toBe(RESOLVER_STYLE_DEFAULT_QUORUM);

        await submitProposal(ownerOf1, 1n);

        const proposal = await registry.getGetProposal(1n);
        expect(proposal).not.toBeNull();
        expect(proposal!.quorum_threshold).toBe(RESOLVER_STYLE_DEFAULT_QUORUM);
    });

    it('finalizes 22 default-threshold votes as NO_QUORUM, matching the resolver boundary', async () => {
        const startTime = (blockchain.now ?? Math.floor(Date.now() / 1000)) + 60;
        blockchain.now = startTime;

        await submitProposal(ownerOf1, 1n, 10n);
        const proposal = await registry.getGetProposal(1n);
        expect(proposal).not.toBeNull();
        expect(proposal!.quorum_threshold).toBe(RESOLVER_STYLE_DEFAULT_QUORUM);

        const boundaryVotes = RESOLVER_STYLE_DEFAULT_QUORUM - 1n;
        await registerRangeSnapshot(1n, 2n, boundaryVotes + 1n);
        for (let offset = 0n; offset < boundaryVotes; offset++) {
            const nftId = offset + 2n;
            const voter = await blockchain.treasury(`boundaryVoter${nftId}`);
            await registerOwner(nftId, voter);
            await castVote(voter, 1n, nftId, VOTE_FOR);
        }

        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR)).toBe(boundaryVotes);
        expect(boundaryVotes >= RESOLVER_STYLE_DEFAULT_QUORUM).toBe(false);

        blockchain.now = Number(proposal!.voting_end + 1n);
        await registry.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'FinalizeProposal', proposal_id: 1n }
        );

        expect(await registry.getGetProposalStatus(1n)).toBe(STATUS_NO_QUORUM);
        expect(await registry.getGetStatusName(STATUS_NO_QUORUM)).toBe('NO_QUORUM');
    });

    it('lets the legitimate owner cast a vote (ownership confirmed)', async () => {
        await submitProposal(ownerOf1, 1n);
        await registerSnapshot(1n, [2n]);

        await castVote(ownerOf2, 1n, 2n, VOTE_FOR);

        expect(await registry.getHasVoted(1n, 2n)).toBe(true);
        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR)).toBe(1n);
    });

    it('does NOT record a vote when no snapshot is registered for the proposal', async () => {
        await submitProposal(ownerOf1, 1n);

        await castVote(ownerOf2, 1n, 2n, VOTE_FOR);

        expect(await registry.getHasVoted(1n, 2n)).toBe(false);
        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR) ?? 0n).toBe(0n);
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
        await registerSnapshot(1n, [2n]);

        // attacker tries to vote with NFT #2 (owned by ownerOf2).
        await castVote(attacker, 1n, 2n, VOTE_FOR);

        expect(await registry.getHasVoted(1n, 2n)).toBe(false);
        const counts = await registry.getGetVoteCounts(1n);
        expect(counts.get(VOTE_FOR) ?? 0n).toBe(0n);
    });

    it('prevents a single wallet from accumulating votes for NFTs it does not own', async () => {
        await submitProposal(ownerOf1, 1n);
        await registerRangeSnapshot(1n, 1n, 50n);

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
        await registerSnapshot(1n, [2n]);

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
        await registerSnapshot(1n, [2n]);

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
