/**
 * Issue #370 / PC-01 — minimal reproduction of the unauthenticated
 * RegisterSnapshot vulnerability in SnapshotVerifier.tact.
 *
 * On the VULNERABLE contract (no sender() check) an arbitrary attacker can
 * forge the governance eligibility roll, so this test FAILS. On the FIXED
 * contract (trusted-indexer guard) the attacker is rejected and this test
 * PASSES. See README.md in this folder for how to run it against each state.
 *
 * The authoritative regression suite is
 * contracts/governance/SnapshotVerifier.spec.ts — this file is the standalone
 * experiment kept under ./experiments per the repo's investigation guidelines.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Dictionary, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
// Wrapper produced by `npm run build` inside contracts/governance.
import { SnapshotVerifier } from '../../contracts/governance/dist/SnapshotVerifier_SnapshotVerifier';

describe('PC-01 reproduction: unauthenticated RegisterSnapshot', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        attacker = await blockchain.treasury('attacker');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
    });

    it('SECURITY: an arbitrary attacker must NOT be able to forge a snapshot', async () => {
        const forged = Dictionary.empty(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        forged.set(7n, true); // attacker grants eligibility to an NFT it controls

        const result = await verifier.send(
            attacker.getSender(),
            { value: toNano('2') },
            {
                $$type: 'RegisterSnapshot',
                proposal_id: 1n,
                timestamp: 1000n,
                eligible_nfts: forged,
            }
        );

        // Secure behaviour: the attacker's RegisterSnapshot is rejected...
        expect(result.transactions).toHaveTransaction({
            from: attacker.address,
            to: verifier.address,
            success: false,
        });
        // ...and no forged eligibility leaks into the roll.
        expect(await verifier.getIsEligible(1n, 7n)).toBe(false);
    });
});
