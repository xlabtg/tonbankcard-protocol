/**
 * SnapshotVerifier fail-closed eligibility regression tests.
 *
 * CONTRACTS-LOW / L-2 requires missing snapshots to deny eligibility instead
 * of treating every valid Diamond NFT as eligible.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Dictionary, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { SnapshotVerifier } from './dist/SnapshotVerifier_SnapshotVerifier';

const GAS = toNano('0.2');
const SNAPSHOT_GAS = toNano('2');

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
    });

    async function registerSnapshot(proposalId: bigint, eligibleIds: bigint[]) {
        const eligibleNfts = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        for (const nftId of eligibleIds) {
            eligibleNfts.set(nftId, true);
        }

        const result = await verifier.send(
            indexer.getSender(),
            { value: SNAPSHOT_GAS },
            {
                $$type: 'RegisterSnapshot',
                proposal_id: proposalId,
                timestamp: BigInt(blockchain.now ?? Math.floor(Date.now() / 1000)),
                eligible_nfts: eligibleNfts,
            }
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
        });
        expect(await verifier.getIsEligible(999n, 1n)).toBe(false);
    });
});
