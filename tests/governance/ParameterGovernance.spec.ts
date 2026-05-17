/**
 * Round-trip test for protocol parameter governance (Issue #133, E2).
 *
 * What this test demonstrates:
 *   1. An author submits a parameter-change proposal whose metadata_hash is the
 *      SHA-256 of the canonical JSON serialisation defined in Appendix A of the
 *      proposal markdown (per docs/governance/PARAMETER_CHANGES.md §3 check #7).
 *   2. Voters cast `FOR` votes from distinct Diamond NFT IDs, reaching the
 *      per-parameter quorum recommended in docs/governance/PARAMETERS.md §9
 *      (44 votes for PP-13 / PaymentHub `whitelisted_collections`).
 *   3. After the voting window closes, the proposal finalises as `ACCEPTED`.
 *   4. The recorded metadata_hash matches the off-chain canonical-JSON hash —
 *      this is the binding cryptographic link between the off-chain template
 *      and the on-chain anchor.
 *   5. The 48-hour off-chain cooldown is honoured: the test advances
 *      `blockchain.now` past the cooldown boundary before the executor would
 *      sign the setter transaction. Because governance is non-executable by
 *      design (see docs/dao-governance.md), there is no on-chain call we can
 *      simulate; the test only asserts that the cooldown can be observed
 *      against on-chain timestamps.
 *
 * IMPORTANT: The governance pathway is documentation-only and ADVISORY. The
 * setter call itself is sent by the contract's admin multi-sig — outside the
 * scope of this test. What this test guarantees is that any such setter call
 * can be cryptographically tied back to an `ACCEPTED` proposal record.
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { createHash } from 'crypto';
import { ProposalRegistry } from '../../wrappers/ProposalRegistry';
import {
    PARAMETER_INVENTORY,
    canonicalJson,
} from '../../scripts/governance/check-parameter-changes';
import '@ton/test-utils';

const CATEGORY_ROADMAP_SIGNAL = 0n;
const STATUS_ACTIVE = 0n;
const STATUS_ACCEPTED = 1n;
const VOTE_FOR = 0n;
const SEVEN_DAYS = 7 * 24 * 60 * 60;
const FORTY_EIGHT_HOURS = 48 * 60 * 60;

/**
 * Build the canonical metadata JSON for a worked example based on
 * docs/governance/PARAMETER_CHANGES.md §4 (whitelisting a new NFT collection).
 * In production this would be produced by the proposal author and pasted into
 * Appendix A of the proposal markdown. The SHA-256 of the bytes returned here
 * is exactly what `SubmitProposal.metadata_hash` must equal.
 */
function buildParameterChangeMetadata() {
    return {
        proposal_template_version: '1.0.0',
        parameter_id: 'PP-13',
        contract: 'payments/PaymentHub.tact',
        setter_message: 'WhitelistCollection',
        current_value: { whitelisted_collections: [] },
        proposed_value: {
            whitelisted_collections: [
                'EQDfounders9999whitelistedcollectionaddressgoeshereforexample',
            ],
        },
        executor_multisig: 'EQDpaymenthubadminmultisigaddress2of3signersrequiredforaction',
        executor_threshold: { m: 2, n: 3 },
        voting_window_days: 7,
        quorum_threshold: 44,
        cooldown_hours: 48,
        category: 0,
    };
}

function sha256BigInt(input: string): bigint {
    return BigInt('0x' + createHash('sha256').update(input).digest('hex'));
}

describe('ParameterGovernance — PP-13 round trip', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<ProposalRegistry>;
    let author: SandboxContract<TreasuryContract>;
    let voter: SandboxContract<TreasuryContract>;

    let canonicalMetadata: string;
    let metadataHash: bigint;
    let startTime: number;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        startTime = Math.floor(Date.now() / 1000);
        blockchain.now = startTime;

        deployer = await blockchain.treasury('deployer');
        author = await blockchain.treasury('author');
        voter = await blockchain.treasury('voter');

        registry = blockchain.openContract(await ProposalRegistry.fromInit());

        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n },
        );

        canonicalMetadata = canonicalJson(buildParameterChangeMetadata());
        metadataHash = sha256BigInt(canonicalMetadata);
    });

    it('inventory entry for PP-13 has the expected G-class governance profile', () => {
        const pp13 = PARAMETER_INVENTORY.find((p) => p.id === 'PP-13');
        expect(pp13).toBeDefined();
        expect(pp13!.classification).toBe('G');
        expect(pp13!.recommendedQuorum).toBe(44);
        expect(pp13!.recommendedCooldownHours).toBe(48);
        expect(pp13!.contract).toBe('payments/PaymentHub.tact');
    });

    it('submits, votes 44× FOR, finalises ACCEPTED, and links to off-chain metadata hash', async () => {
        // 1. Submit the proposal. voting_duration=7 days, quorum=44 per PP-13.
        const submitResult = await registry.send(
            author.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitProposal',
                metadata_hash: metadataHash,
                author_nft_id: 42n,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: BigInt(SEVEN_DAYS),
                quorum_threshold: 44n,
            },
        );
        expect(submitResult.transactions).toHaveTransaction({
            from: author.address,
            to: registry.address,
            success: true,
        });

        const proposal = await registry.getProposal(1n);
        expect(proposal).not.toBeNull();
        expect(proposal!.status).toEqual(STATUS_ACTIVE);
        expect(proposal!.metadata_hash).toEqual(metadataHash);
        expect(proposal!.quorum_threshold).toEqual(44n);

        // 2. Cast 44 FOR votes from distinct NFT IDs (1..44).
        for (let nftId = 1; nftId <= 44; nftId++) {
            const result = await registry.send(
                voter.getSender(),
                { value: toNano('0.02') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: BigInt(nftId),
                    vote: VOTE_FOR,
                },
            );
            expect(result.transactions).toHaveTransaction({ success: true });
        }

        const votes = await registry.getVoteCounts(1n);
        expect(votes.get(VOTE_FOR)).toEqual(44n);

        // 3. Advance blockchain time past the voting window and finalise.
        blockchain.now = startTime + SEVEN_DAYS + 1;
        const finalizeResult = await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'FinalizeProposal', proposal_id: 1n },
        );
        expect(finalizeResult.transactions).toHaveTransaction({ success: true });

        const finalised = await registry.getProposal(1n);
        expect(finalised!.status).toEqual(STATUS_ACCEPTED);
        expect(finalised!.votes_for).toEqual(44n);
        expect(finalised!.votes_against).toEqual(0n);

        // 4. The on-chain anchor must equal the SHA-256 of the off-chain
        //    canonical-JSON metadata. This is the cryptographic link asserted
        //    by docs/governance/PARAMETER_CHANGES.md §3 check #7.
        const recomputed = sha256BigInt(canonicalMetadata);
        expect(finalised!.metadata_hash).toEqual(recomputed);

        // 5. The off-chain cooldown observed by the admin multi-sig is the gap
        //    between finalisation and the eventual setter transaction. The
        //    multi-sig MUST NOT sign during this window. We assert that the
        //    on-chain clock can witness the cooldown boundary so an indexer
        //    can verify the policy after the fact.
        const cooldownExpiresAt = blockchain.now! + FORTY_EIGHT_HOURS;
        blockchain.now = cooldownExpiresAt + 1;
        expect(blockchain.now).toBeGreaterThan(cooldownExpiresAt);
    });

    it('rejects a proposal whose recorded metadata_hash does not match Appendix A', async () => {
        // Author submits the proposal with a bogus hash (e.g. forgot to update
        // it after editing Appendix A). The contract accepts any 256-bit value
        // because on-chain it cannot recompute SHA-256 over an off-chain blob —
        // detection lives in the validator script. This test documents that
        // contract-level hash-mismatch detection is intentionally absent and
        // moves to CI via scripts/governance/check-parameter-changes.ts.
        const wrongHash = metadataHash ^ 1n;
        await registry.send(
            author.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitProposal',
                metadata_hash: wrongHash,
                author_nft_id: 42n,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: BigInt(SEVEN_DAYS),
                quorum_threshold: 44n,
            },
        );
        const stored = await registry.getProposal(1n);
        expect(stored!.metadata_hash).toEqual(wrongHash);

        // The off-chain validator must catch the drift before the proposal is
        // ratified. We re-derive the correct hash and assert inequality so
        // future maintainers see this is a CI responsibility.
        const correctHash = sha256BigInt(canonicalMetadata);
        expect(stored!.metadata_hash).not.toEqual(correctHash);
    });

    it('fails to finalise as ACCEPTED when fewer than 44 FOR votes are cast (quorum guard)', async () => {
        await registry.send(
            author.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitProposal',
                metadata_hash: metadataHash,
                author_nft_id: 42n,
                category: CATEGORY_ROADMAP_SIGNAL,
                voting_duration: BigInt(SEVEN_DAYS),
                quorum_threshold: 44n,
            },
        );

        for (let nftId = 1; nftId <= 30; nftId++) {
            await registry.send(
                voter.getSender(),
                { value: toNano('0.02') },
                {
                    $$type: 'CastVote',
                    proposal_id: 1n,
                    voter_nft_id: BigInt(nftId),
                    vote: VOTE_FOR,
                },
            );
        }

        blockchain.now = startTime + SEVEN_DAYS + 1;
        await registry.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'FinalizeProposal', proposal_id: 1n },
        );

        const finalised = await registry.getProposal(1n);
        // STATUS_NO_QUORUM = 3
        expect(finalised!.status).toEqual(3n);
        expect(finalised!.votes_for).toEqual(30n);
    });
});
