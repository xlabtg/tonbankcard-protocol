/**
 * SnapshotVerifier regression tests.
 *
 * Two security properties are covered:
 *
 *  - CONTRACTS-LOW / L-2 (fail-closed eligibility): a missing snapshot denies
 *    eligibility instead of treating every valid Diamond NFT as eligible.
 *
 *  - Issue #370 / PC-01 (sender authentication): the eligibility roll is the
 *    single source of truth ProposalRegistry consults when deciding whether an
 *    NFT may vote. It must therefore be writable ONLY by the deployer-designated
 *    trusted indexer. These tests prove that
 *      (1) a RegisterSnapshot from any non-authorized sender is rejected;
 *      (2) the trusted-indexer slot can only be assigned by the deployer, so it
 *          cannot be claimed by an arbitrary first caller;
 *      (3) the full sequence holds — a non-indexer write throws, the indexer
 *          write succeeds, and a subsequent forged overwrite is rejected; and
 *      (4) the eligibility decisions ProposalRegistry consumes (synchronous
 *          getter AND asynchronous EligibilityCheckResponse) derive ONLY from
 *          an authorized snapshot, never from a rejected forgery.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { beginCell, Dictionary, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import {
    SnapshotVerifier,
    storeEligibilityCheckResponse,
} from './dist/SnapshotVerifier_SnapshotVerifier';

const GAS = toNano('0.2');
const SNAPSHOT_GAS = toNano('2');

// Exit codes Tact derives (by hashing) from the require() reason strings — see
// the error map in the generated wrapper. Asserting on them proves each
// rejection fails for the RIGHT reason (authorization) and not, say, out of gas.
const EXIT_ONLY_TRUSTED_INDEXER = 7875;
const EXIT_SNAPSHOT_ALREADY_EXISTS = 8358;
const EXIT_ONLY_DEPLOYER_SET_INDEXER = 25579;
const EXIT_ONLY_DEPLOYER_SET_REGISTRY = 36935;
const EXIT_REGISTRY_ALREADY_SET = 47753;
const EXIT_INDEXER_NOT_CONFIGURED = 63046;

function eligibilityRoll(eligibleIds: bigint[]) {
    const roll = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
    for (const nftId of eligibleIds) {
        roll.set(nftId, true);
    }
    return roll;
}

function registerSnapshotMessage(proposalId: bigint, eligibleIds: bigint[], timestamp: bigint) {
    return {
        $$type: 'RegisterSnapshot' as const,
        proposal_id: proposalId,
        timestamp,
        eligible_nfts: eligibilityRoll(eligibleIds),
    };
}

// Expected EligibilityCheckResponse body — used to assert the EXACT eligibility
// value the verifier returns to a consumer (ProposalRegistry's async path).
function eligibilityResponseBody(
    queryId: bigint,
    proposalId: bigint,
    nftId: bigint,
    eligible: boolean
) {
    return beginCell()
        .store(
            storeEligibilityCheckResponse({
                $$type: 'EligibilityCheckResponse',
                query_id: queryId,
                proposal_id: proposalId,
                nft_id: nftId,
                eligible,
            })
        )
        .endCell();
}

describe('SnapshotVerifier fail-closed eligibility', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let indexer: SandboxContract<TreasuryContract>;
    let requester: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        indexer = await blockchain.treasury('indexer');
        requester = await blockchain.treasury('requester');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Issue #370: designate the trusted indexer before any snapshot can be
        // registered. Without this the handler fails closed (see the dedicated
        // authentication suite below).
        await verifier.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetTrustedIndexer', indexer: indexer.address }
        );
    });

    async function registerSnapshot(proposalId: bigint, eligibleIds: bigint[]) {
        const result = await verifier.send(
            indexer.getSender(),
            { value: SNAPSHOT_GAS },
            registerSnapshotMessage(
                proposalId,
                eligibleIds,
                BigInt(blockchain.now ?? Math.floor(Date.now() / 1000))
            )
        );
        expect(result.transactions).toHaveTransaction({
            from: indexer.address,
            to: verifier.address,
            success: true,
        });
    }

    it('returns false when no snapshot is registered', async () => {
        expect(await verifier.getIsEligible(1n, 1n)).toBe(false);
        expect(await verifier.getIsEligible(1n, 222n)).toBe(false);
        expect(await verifier.getGetEligibleCount(1n)).toBe(0n);
    });

    it('returns true only for NFTs included in a registered snapshot', async () => {
        await registerSnapshot(1n, [1n, 7n]);

        expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
        expect(await verifier.getIsEligible(1n, 7n)).toBe(true);
        expect(await verifier.getIsEligible(1n, 2n)).toBe(false);
        expect(await verifier.getGetEligibleCount(1n)).toBe(2n);
    });

    it('answers asynchronous eligibility checks with the same fail-closed result', async () => {
        const response = await verifier.send(
            requester.getSender(),
            { value: GAS },
            { $$type: 'EligibilityCheckRequest', query_id: 10n, proposal_id: 999n, nft_id: 1n }
        );

        expect(response.transactions).toHaveTransaction({
            from: verifier.address,
            to: requester.address,
            success: true,
            body: eligibilityResponseBody(10n, 999n, 1n, false),
        });
        expect(await verifier.getIsEligible(999n, 1n)).toBe(false);
    });
});

describe('SnapshotVerifier sender authentication (Issue #370 / PC-01)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let indexer: SandboxContract<TreasuryContract>;
    let rotatedIndexer: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let requester: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        indexer = await blockchain.treasury('indexer');
        rotatedIndexer = await blockchain.treasury('rotatedIndexer');
        attacker = await blockchain.treasury('attacker');
        requester = await blockchain.treasury('requester');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    async function configureIndexer(indexerContract: SandboxContract<TreasuryContract>) {
        const result = await verifier.send(
            deployer.getSender(),
            { value: GAS },
            { $$type: 'SetTrustedIndexer', indexer: indexerContract.address }
        );
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: true,
        });
    }

    async function sendRegisterSnapshot(
        from: SandboxContract<TreasuryContract>,
        proposalId: bigint,
        eligibleIds: bigint[]
    ) {
        return verifier.send(
            from.getSender(),
            { value: SNAPSHOT_GAS },
            registerSnapshotMessage(proposalId, eligibleIds, 1000n)
        );
    }

    it('captures the deployer as the configuration authority at init()', async () => {
        // The deployer that performed Deploy is recorded as the configuration
        // authority, and the indexer slot starts null (fail-closed).
        expect((await verifier.getGetDeployer()).toString()).toBe(deployer.address.toString());
        expect(await verifier.getGetTrustedIndexer()).toBeNull();
    });

    it('CRITERION 1 (pre-config): fails closed before any trusted indexer is set', async () => {
        // Even the address that will later become the indexer cannot write yet:
        // until the deployer configures the slot, every snapshot is rejected, so
        // a forged roll can never be injected in the deploy→configure window.
        const result = await sendRegisterSnapshot(indexer, 1n, [7n]);

        expect(result.transactions).toHaveTransaction({
            from: indexer.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_INDEXER_NOT_CONFIGURED,
        });
        expect(await verifier.getHasSnapshot(1n)).toBe(false);
        expect(await verifier.getIsEligible(1n, 7n)).toBe(false);
    });

    it('CRITERION 2: only the deployer can designate the trusted indexer', async () => {
        // An arbitrary first caller cannot claim the trusted-indexer slot, so it
        // can never be "first-caller-wins" hijacked.
        const hijack = await verifier.send(
            attacker.getSender(),
            { value: GAS },
            { $$type: 'SetTrustedIndexer', indexer: attacker.address }
        );
        expect(hijack.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_DEPLOYER_SET_INDEXER,
        });
        expect(await verifier.getGetTrustedIndexer()).toBeNull();

        // The deployer, by contrast, can configure it, and the slot reflects the
        // authorized indexer afterwards.
        await configureIndexer(indexer);
        expect((await verifier.getGetTrustedIndexer())!.toString()).toBe(indexer.address.toString());
    });

    it('CRITERION 1 (post-config): an arbitrary sender cannot forge a snapshot', async () => {
        await configureIndexer(indexer);

        const forged = await sendRegisterSnapshot(attacker, 1n, [7n]);
        expect(forged.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_TRUSTED_INDEXER,
        });
        expect(await verifier.getHasSnapshot(1n)).toBe(false);
        expect(await verifier.getIsEligible(1n, 7n)).toBe(false);
    });

    it('CRITERION 3: non-indexer write throws, indexer write succeeds, forged overwrite rejected', async () => {
        await configureIndexer(indexer);

        // (a) A non-indexer (the deployer itself — the configuration authority,
        //     which must NOT be able to forge a roll) is rejected.
        const byDeployer = await sendRegisterSnapshot(deployer, 1n, [13n]);
        expect(byDeployer.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_TRUSTED_INDEXER,
        });

        // (b) The authorized indexer succeeds and establishes the roll.
        const legit = await sendRegisterSnapshot(indexer, 1n, [1n, 7n]);
        expect(legit.transactions).toHaveTransaction({
            from: indexer.address,
            to: verifier.address,
            success: true,
        });
        expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
        expect(await verifier.getIsEligible(1n, 7n)).toBe(true);
        expect(await verifier.getGetEligibleCount(1n)).toBe(2n);

        // (c) An attacker's attempt to overwrite the established roll is rejected,
        //     and the original eligibility is left intact.
        const overwrite = await sendRegisterSnapshot(attacker, 1n, [13n]);
        expect(overwrite.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_TRUSTED_INDEXER,
        });
        expect(await verifier.getIsEligible(1n, 13n)).toBe(false);
        expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
        expect(await verifier.getGetEligibleCount(1n)).toBe(2n);

        // (d) Even the authorized indexer cannot silently rewrite an existing
        //     snapshot (write-once preserves the recorded roll).
        const reRegister = await sendRegisterSnapshot(indexer, 1n, [13n]);
        expect(reRegister.transactions).toHaveTransaction({
            from: indexer.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_SNAPSHOT_ALREADY_EXISTS,
        });
        expect(await verifier.getIsEligible(1n, 13n)).toBe(false);
        expect(await verifier.getGetEligibleCount(1n)).toBe(2n);
    });

    it('CRITERION 4: ProposalRegistry-facing eligibility derives only from authorized snapshots', async () => {
        await configureIndexer(indexer);

        // Before any authorized snapshot, the async response ProposalRegistry
        // consumes is fail-closed (eligible=false).
        const before = await verifier.send(
            requester.getSender(),
            { value: GAS },
            { $$type: 'EligibilityCheckRequest', query_id: 1n, proposal_id: 5n, nft_id: 7n }
        );
        expect(before.transactions).toHaveTransaction({
            from: verifier.address,
            to: requester.address,
            body: eligibilityResponseBody(1n, 5n, 7n, false),
        });

        // A forged snapshot from the attacker is rejected and therefore CANNOT
        // influence the eligibility answer.
        const forged = await sendRegisterSnapshot(attacker, 5n, [7n]);
        expect(forged.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
        });

        const afterForge = await verifier.send(
            requester.getSender(),
            { value: GAS },
            { $$type: 'EligibilityCheckRequest', query_id: 2n, proposal_id: 5n, nft_id: 7n }
        );
        expect(afterForge.transactions).toHaveTransaction({
            from: verifier.address,
            to: requester.address,
            body: eligibilityResponseBody(2n, 5n, 7n, false),
        });

        // Only the authorized indexer's snapshot moves the answer to eligible.
        await sendRegisterSnapshot(indexer, 5n, [7n]);
        const afterAuth = await verifier.send(
            requester.getSender(),
            { value: GAS },
            { $$type: 'EligibilityCheckRequest', query_id: 3n, proposal_id: 5n, nft_id: 7n }
        );
        expect(afterAuth.transactions).toHaveTransaction({
            from: verifier.address,
            to: requester.address,
            body: eligibilityResponseBody(3n, 5n, 7n, true),
        });
        // An NFT the authorized snapshot did NOT include stays ineligible.
        const excluded = await verifier.send(
            requester.getSender(),
            { value: GAS },
            { $$type: 'EligibilityCheckRequest', query_id: 4n, proposal_id: 5n, nft_id: 8n }
        );
        expect(excluded.transactions).toHaveTransaction({
            from: verifier.address,
            to: requester.address,
            body: eligibilityResponseBody(4n, 5n, 8n, false),
        });
    });

    it('supports deployer-only rotation of the trusted indexer', async () => {
        await configureIndexer(indexer);

        // Rotate to a fresh key (e.g. after the old indexer key is retired).
        await configureIndexer(rotatedIndexer);
        expect((await verifier.getGetTrustedIndexer())!.toString()).toBe(
            rotatedIndexer.address.toString()
        );

        // The previous indexer is no longer authorized.
        const stale = await sendRegisterSnapshot(indexer, 1n, [7n]);
        expect(stale.transactions).toHaveTransaction({
            from: indexer.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_TRUSTED_INDEXER,
        });

        // The rotated indexer is.
        const fresh = await sendRegisterSnapshot(rotatedIndexer, 1n, [7n]);
        expect(fresh.transactions).toHaveTransaction({
            from: rotatedIndexer.address,
            to: verifier.address,
            success: true,
        });
        expect(await verifier.getIsEligible(1n, 7n)).toBe(true);
    });

    it('binds the proposal registry deployer-only and exactly once', async () => {
        // A stranger cannot claim the registry binding (closes first-caller-wins).
        const hijack = await verifier.send(
            attacker.getSender(),
            { value: GAS },
            'set_registry'
        );
        expect(hijack.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_ONLY_DEPLOYER_SET_REGISTRY,
        });
        expect(await verifier.getGetProposalRegistry()).toBeNull();

        // The deployer can perform the one-time binding.
        const bind = await verifier.send(deployer.getSender(), { value: GAS }, 'set_registry');
        expect(bind.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: true,
        });
        expect((await verifier.getGetProposalRegistry())!.toString()).toBe(
            deployer.address.toString()
        );

        // And it is irreversible: a second binding attempt is rejected.
        const rebind = await verifier.send(deployer.getSender(), { value: GAS }, 'set_registry');
        expect(rebind.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: false,
            exitCode: EXIT_REGISTRY_ALREADY_SET,
        });
    });
});
