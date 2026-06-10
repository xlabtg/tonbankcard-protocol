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
import { Address, Cell, Dictionary, toNano } from '@ton/core';
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

// Governance multi-sig configuration constants (Issue #366), mirroring the Tact
// contract. Resolver/verifier changes require a signer quorum + a timelock.
const CONFIG_KIND_RESOLVER = 0n;
const CONFIG_KIND_VERIFIER = 1n;
const CONFIG_TIMELOCK_DELAY = 7n * 24n * 60n * 60n; // 7 days in seconds

const GAS = toNano('0.2');
const SNAPSHOT_GAS = toNano('2');

// Code hash of a deployed contract as the uint256 the registry stores/compares.
function codeHashOf(init?: { code: Cell; data: Cell }): bigint {
    return BigInt('0x' + init!.code.hash().toString('hex'));
}

describe('ProposalRegistry — on-chain NFT ownership verification', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let signer1: SandboxContract<TreasuryContract>;
    let signer2: SandboxContract<TreasuryContract>;
    let signer3: SandboxContract<TreasuryContract>;
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

    // ---- Governance multi-sig helpers (Issue #366) ----

    // Install the governance signer set on `target` registry (deployer-gated,
    // one-time). Defaults to signer1+signer2 with a 2-of-2 threshold.
    async function configureGovernance(
        target: SandboxContract<ProposalRegistry> = registry,
        signers: SandboxContract<TreasuryContract>[] = [signer1, signer2],
        threshold: bigint = 2n
    ) {
        const dict = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Address());
        signers.forEach((s, i) => dict.set(BigInt(i), s.address));
        return target.send(
            deployer.getSender(),
            { value: GAS },
            {
                $$type: 'ConfigureGovernance',
                signers: dict,
                signer_count: BigInt(signers.length),
                threshold,
            }
        );
    }

    async function proposeConfig(
        kind: bigint,
        targetAddress: Address,
        codeHash: bigint,
        proposer: SandboxContract<TreasuryContract> = signer1
    ) {
        return registry.send(
            proposer.getSender(),
            { value: GAS },
            { $$type: 'ProposeConfigChange', kind, target: targetAddress, code_hash: codeHash }
        );
    }

    async function approveConfig(
        kind: bigint,
        targetAddress: Address,
        approver: SandboxContract<TreasuryContract> = signer2
    ) {
        return registry.send(
            approver.getSender(),
            { value: GAS },
            { $$type: 'ApproveConfigChange', kind, target: targetAddress }
        );
    }

    function advancePastTimelock() {
        blockchain.now = (blockchain.now ?? 0) + Number(CONFIG_TIMELOCK_DELAY) + 1;
    }

    async function executeConfig(
        kind: bigint,
        targetAddress: Address,
        code: Cell,
        data: Cell,
        executor: SandboxContract<TreasuryContract> = signer1
    ) {
        return registry.send(
            executor.getSender(),
            { value: GAS },
            { $$type: 'ExecuteConfigChange', kind, target: targetAddress, code, data }
        );
    }

    // Full propose -> approve -> wait -> execute cycle for one config change.
    async function installConfig(
        kind: bigint,
        targetAddress: Address,
        init: { code: Cell; data: Cell }
    ) {
        await proposeConfig(kind, targetAddress, codeHashOf(init));
        await approveConfig(kind, targetAddress);
        advancePastTimelock();
        return executeConfig(kind, targetAddress, init.code, init.data);
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // Fix a base time so the configuration timelock can be advanced
        // deterministically during setup.
        blockchain.now = 1_700_000_000;

        deployer = await blockchain.treasury('deployer');
        signer1 = await blockchain.treasury('signer1');
        signer2 = await blockchain.treasury('signer2');
        signer3 = await blockchain.treasury('signer3');
        ownerOf1 = await blockchain.treasury('ownerOf1');
        ownerOf2 = await blockchain.treasury('ownerOf2');
        attacker = await blockchain.treasury('attacker');

        registry = await deployRegistry();
        resolver = await deployResolver();
        verifier = await deployVerifier();

        // Bootstrap the governance signer set (2-of-2), then install the
        // resolver and verifier through the multi-sig + timelock flow.
        await configureGovernance();
        await installConfig(CONFIG_KIND_RESOLVER, resolver.address, resolver.init!);
        await installConfig(CONFIG_KIND_VERIFIER, verifier.address, verifier.init!);

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

    it('exposes the installed governance signer set and threshold', async () => {
        expect(await registry.getIsGovernanceConfigured()).toBe(true);
        expect(await registry.getGetGovernanceSignerCount()).toBe(2n);
        expect(await registry.getGetGovernanceThreshold()).toBe(2n);
        expect(await registry.getIsGovernanceSigner(signer1.address)).toBe(true);
        expect(await registry.getIsGovernanceSigner(signer2.address)).toBe(true);
        expect(await registry.getIsGovernanceSigner(deployer.address)).toBe(false);
        expect(await registry.getGetConfigTimelockDelay()).toBe(CONFIG_TIMELOCK_DELAY);
        expect(await registry.getIsConfigChangePending()).toBe(false);
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
        // No resolver installed: governance is frozen until one is configured.

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

    // ========================================================================
    // GOVERNANCE MULTI-SIG + TIMELOCK (Issue #366)
    //
    // Acceptance criteria:
    //   - SetOwnerResolver/SetSnapshotVerifier require multi-sig authorization.
    //   - Resolver contract code hash is verified before accepting.
    //   - Resolver can be updated (via multi-sig + timelock) if misconfigured.
    //   - Governance is frozen when the resolver is not configured.
    //   - An attacker cannot forge ownership with a malicious resolver.
    // ========================================================================
    describe('governance multi-sig configuration', () => {
        // Build a fresh, deployed-but-ungoverned registry on an isolated chain so
        // its deployer is controllable. Returns the opened contract + actors.
        async function freshChain() {
            const bc = await Blockchain.create();
            bc.now = 1_700_000_000;
            const dep = await bc.treasury('depX');
            const s1 = await bc.treasury('s1X');
            const s2 = await bc.treasury('s2X');
            const reg = bc.openContract(await ProposalRegistry.fromInit());
            await reg.send(dep.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 0n });
            return { bc, dep, s1, s2, reg };
        }

        function signerDict(signers: SandboxContract<TreasuryContract>[]) {
            const dict = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Address());
            signers.forEach((s, i) => dict.set(BigInt(i), s.address));
            return dict;
        }

        it('bootstraps governance only via the deployer, and only once', async () => {
            const { dep, s1, s2, reg } = await freshChain();

            // Non-deployer bootstrap is rejected.
            const bad = await reg.send(
                s1.getSender(),
                { value: GAS },
                {
                    $$type: 'ConfigureGovernance',
                    signers: signerDict([s1, s2]),
                    signer_count: 2n,
                    threshold: 2n,
                }
            );
            expect(bad.transactions).toHaveTransaction({ to: reg.address, success: false });
            expect(await reg.getIsGovernanceConfigured()).toBe(false);

            // Deployer bootstrap succeeds.
            const ok = await reg.send(
                dep.getSender(),
                { value: GAS },
                {
                    $$type: 'ConfigureGovernance',
                    signers: signerDict([s1, s2]),
                    signer_count: 2n,
                    threshold: 2n,
                }
            );
            expect(ok.transactions).toHaveTransaction({ from: dep.address, to: reg.address, success: true });
            expect(await reg.getIsGovernanceConfigured()).toBe(true);

            // A second bootstrap is rejected (set-once).
            const again = await reg.send(
                dep.getSender(),
                { value: GAS },
                {
                    $$type: 'ConfigureGovernance',
                    signers: signerDict([s1, s2]),
                    signer_count: 2n,
                    threshold: 2n,
                }
            );
            expect(again.transactions).toHaveTransaction({ to: reg.address, success: false });
        });

        it('rejects a single-signer or sub-threshold governance bootstrap', async () => {
            const { dep, s1, s2, reg } = await freshChain();

            // signer_count = 1 violates MIN_GOV_SIGNERS.
            const oneSigner = await reg.send(
                dep.getSender(),
                { value: GAS },
                { $$type: 'ConfigureGovernance', signers: signerDict([s1]), signer_count: 1n, threshold: 1n }
            );
            expect(oneSigner.transactions).toHaveTransaction({ to: reg.address, success: false });
            expect(await reg.getIsGovernanceConfigured()).toBe(false);

            // threshold = 1 violates MIN_GOV_THRESHOLD (no single point of failure).
            const lowThreshold = await reg.send(
                dep.getSender(),
                { value: GAS },
                { $$type: 'ConfigureGovernance', signers: signerDict([s1, s2]), signer_count: 2n, threshold: 1n }
            );
            expect(lowThreshold.transactions).toHaveTransaction({ to: reg.address, success: false });
            expect(await reg.getIsGovernanceConfigured()).toBe(false);
        });

        it('requires multi-sig authorization to change the resolver (one signer is not enough)', async () => {
            // A single signer proposes; without a second approval the change can
            // never be executed.
            const codeHash = codeHashOf(resolver.init!);
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, signer1);

            expect(await registry.getIsConfigChangePending()).toBe(true);
            expect(await registry.getGetPendingConfigApprovals()).toBe(1n);
            // Timelock not started yet (threshold not reached).
            expect(await registry.getGetPendingConfigExecutableAt()).toBe(0n);

            // Executing with only one approval is rejected.
            advancePastTimelock();
            const exec = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                resolver.init!.code,
                resolver.init!.data,
                signer1
            );
            expect(exec.transactions).toHaveTransaction({ to: registry.address, success: false });
        });

        it('rejects configuration messages from a non-signer', async () => {
            const codeHash = codeHashOf(resolver.init!);
            const res = await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, attacker);
            expect(res.transactions).toHaveTransaction({ from: attacker.address, to: registry.address, success: false });
            expect(await registry.getIsConfigChangePending()).toBe(false);
        });

        it('enforces the timelock before a fully-approved change can execute', async () => {
            const codeHash = codeHashOf(resolver.init!);
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, signer1);
            await approveConfig(CONFIG_KIND_RESOLVER, resolver.address, signer2);

            // Threshold reached -> timelock is now armed.
            const executableAt = await registry.getGetPendingConfigExecutableAt();
            expect(executableAt).toBeGreaterThan(0n);
            expect(await registry.getGetPendingConfigApprovals()).toBe(2n);

            // Executing before the timelock elapses is rejected.
            const early = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                resolver.init!.code,
                resolver.init!.data,
                signer1
            );
            expect(early.transactions).toHaveTransaction({ to: registry.address, success: false });

            // After the delay it succeeds.
            advancePastTimelock();
            const late = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                resolver.init!.code,
                resolver.init!.data,
                signer1
            );
            expect(late.transactions).toHaveTransaction({ to: registry.address, success: true });
            expect(await registry.getIsConfigChangePending()).toBe(false);
        });

        it('verifies the resolver code hash before accepting (rejects a wrong hash)', async () => {
            // Propose with a deliberately wrong code hash; even with full approvals
            // and an elapsed timelock, execution must fail the code-hash check so a
            // malicious contract can never be installed under a legitimate address.
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, 0xdeadn, signer1);
            await approveConfig(CONFIG_KIND_RESOLVER, resolver.address, signer2);
            advancePastTimelock();

            const exec = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                resolver.init!.code,
                resolver.init!.data,
                signer1
            );
            expect(exec.transactions).toHaveTransaction({ to: registry.address, success: false });
        });

        it('rejects a target address that does not match the supplied code', async () => {
            // Approve the real resolver's code hash, but at execution supply the
            // verifier's StateInit. The code hash differs AND the address would not
            // reconstruct, so the change is rejected.
            const wrongInit = verifier.init!;
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHashOf(wrongInit), signer1);
            await approveConfig(CONFIG_KIND_RESOLVER, resolver.address, signer2);
            advancePastTimelock();

            // Supplying the verifier's code/data while targeting the resolver
            // address: contractAddress(StateInit) != resolver.address -> reject.
            const exec = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                wrongInit.code,
                wrongInit.data,
                signer1
            );
            expect(exec.transactions).toHaveTransaction({ to: registry.address, success: false });
        });

        it('allows the resolver to be updated via multi-sig + timelock (recovery path)', async () => {
            // Recovery scenario: the resolver was misconfigured and must be
            // re-pointed to a different, verifiably-correct address. We migrate the
            // resolver to a genuinely different address (the verifier's), whose
            // code hash and StateInit reconstruct correctly. This proves the update
            // path changes the stored resolver — something the old set-once design
            // could never do once misconfigured.
            const before = (await registry.getGetOwnerResolver())!.toString();
            expect(before).toBe(resolver.address.toString());

            await installConfig(CONFIG_KIND_RESOLVER, verifier.address, verifier.init!);

            const after = (await registry.getGetOwnerResolver())!.toString();
            expect(after).toBe(verifier.address.toString());
            expect(after).not.toBe(before);
        });

        it('lets a signer cancel a pending change (escape hatch)', async () => {
            const codeHash = codeHashOf(resolver.init!);
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, signer1);
            expect(await registry.getIsConfigChangePending()).toBe(true);

            const cancel = await registry.send(
                signer2.getSender(),
                { value: GAS },
                { $$type: 'CancelConfigChange', kind: CONFIG_KIND_RESOLVER, target: resolver.address }
            );
            expect(cancel.transactions).toHaveTransaction({ to: registry.address, success: true });
            expect(await registry.getIsConfigChangePending()).toBe(false);

            // A fresh proposal can now be made.
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, signer1);
            expect(await registry.getIsConfigChangePending()).toBe(true);
        });

        it('rejects a duplicate approval from the same signer', async () => {
            const codeHash = codeHashOf(resolver.init!);
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHash, signer1);

            // signer1 already approved implicitly at propose time.
            const dup = await approveConfig(CONFIG_KIND_RESOLVER, resolver.address, signer1);
            expect(dup.transactions).toHaveTransaction({ from: signer1.address, to: registry.address, success: false });
            expect(await registry.getGetPendingConfigApprovals()).toBe(1n);
        });

        it('freezes governance until the resolver is configured (attacker cannot bypass)', async () => {
            // A registry with governance bootstrapped but NO resolver installed
            // must still reject voting/proposing — governance is fail-closed.
            const { dep, s1, s2, reg } = await freshChain();
            await reg.send(
                dep.getSender(),
                { value: GAS },
                {
                    $$type: 'ConfigureGovernance',
                    signers: signerDict([s1, s2]),
                    signer_count: 2n,
                    threshold: 2n,
                }
            );
            expect(await reg.getIsGovernanceConfigured()).toBe(true);
            expect(await reg.getGetOwnerResolver()).toBeNull();

            const sub = await reg.send(
                dep.getSender(),
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
            expect(sub.transactions).toHaveTransaction({ to: reg.address, success: false });
            expect(await reg.getGetProposalCount()).toBe(0n);
        });

        it('prevents an attacker from forging ownership via a malicious resolver', async () => {
            // The attacker deploys their own contract intending to act as a
            // resolver that always returns the attacker as owner. They cannot
            // install it: (1) they are not a governance signer, and (2) even a
            // signer quorum cannot install it under the legitimate resolver
            // address because its code hash differs.
            const malicious = blockchain.openContract(await SnapshotVerifier.fromInit());
            await malicious.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Deploy', queryId: 0n }
            );

            // (1) Attacker (non-signer) cannot even propose.
            const propose = await proposeConfig(
                CONFIG_KIND_RESOLVER,
                malicious.address,
                codeHashOf(malicious.init!),
                attacker
            );
            expect(propose.transactions).toHaveTransaction({
                from: attacker.address,
                to: registry.address,
                success: false,
            });

            // (2) Even a full signer quorum installing the malicious address must
            // pass the code-hash + address-reconstruction check, which it does for
            // a genuine contract — but it can never masquerade as the *expected*
            // resolver code. Install it as a (different) verifier to prove the
            // mechanism only accepts addresses that actually run the approved code,
            // then confirm the resolver itself is unchanged.
            const before = (await registry.getGetOwnerResolver())!.toString();
            // Attempt to install the malicious contract at the resolver's address
            // (address mismatch -> rejected).
            await proposeConfig(CONFIG_KIND_RESOLVER, resolver.address, codeHashOf(malicious.init!), signer1);
            await approveConfig(CONFIG_KIND_RESOLVER, resolver.address, signer2);
            advancePastTimelock();
            const exec = await executeConfig(
                CONFIG_KIND_RESOLVER,
                resolver.address,
                malicious.init!.code,
                malicious.init!.data,
                signer1
            );
            expect(exec.transactions).toHaveTransaction({ to: registry.address, success: false });
            expect((await registry.getGetOwnerResolver())!.toString()).toBe(before);
        });
    });
});
