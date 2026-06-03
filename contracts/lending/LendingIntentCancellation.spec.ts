/**
 * LendingProtocolCoordinator - cancellation regression tests.
 * Issue #282 / Audit finding CONTRACTS-M4.
 *
 * The cancellation path must not materialize unknown intents, must preserve the
 * original creation metadata, and must only allow active intents to transition
 * to CANCELLED.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano, Address } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { LendingProtocolCoordinator } from './dist/LendingProtocolCoordinator_LendingProtocolCoordinator';

const LENDING_INTENT_NONE = 0n;
const LENDING_INTENT_ACTIVE = 1n;
const LENDING_INTENT_CANCELLED = 2n;

const GAS = toNano('0.2');
const START_TIME = 1_700_000_000;

describe('LendingProtocolCoordinator - lending intent cancellation (CONTRACTS-M4)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let coordinator: SandboxContract<LendingProtocolCoordinator>;
    let nft: Address;

    async function registerOwner(ownerAddress: Address, nftAddress: Address = nft) {
        return coordinator.send(
            deployer.getSender(),
            { value: toNano('0.5') },
            { $$type: 'RegisterNFTOwnerLending', nft_address: nftAddress, owner: ownerAddress }
        );
    }

    async function registerIntent(
        collateralSignalAmount = toNano('3'),
        targetLender = 7n,
        nftAddress: Address = nft
    ) {
        return coordinator.send(
            owner.getSender(),
            { value: GAS },
            {
                $$type: 'RegisterLendingIntent',
                nft_address: nftAddress,
                collateral_signal_amount: collateralSignalAmount,
                target_lender: targetLender,
            }
        );
    }

    async function cancelIntent(nftAddress: Address = nft) {
        return coordinator.send(
            owner.getSender(),
            { value: GAS },
            { $$type: 'CancelLendingIntent', nft_address: nftAddress }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = START_TIME;

        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        nft = (await blockchain.treasury('nft-card')).address;

        coordinator = blockchain.openContract(await LendingProtocolCoordinator.fromInit());

        const result = await registerOwner(owner.address);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: coordinator.address,
            success: true,
        });
    });

    it('reverts cancellation of an owner-registered NFT with no intent', async () => {
        const result = await cancelIntent();
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: false,
        });

        const info = await coordinator.getGetLendingIntentInfo(nft);
        expect(info.intent_state).toBe(LENDING_INTENT_NONE);
        expect(info.collateral_signal_amount).toBe(0n);
        expect(info.target_lender).toBe(0n);
        expect(info.created_at).toBe(0n);
        expect(info.updated_at).toBe(0n);
        expect(await coordinator.getHasActiveLendingIntent(nft)).toBe(false);
    });

    it('preserves original intent metadata when cancelling an active intent', async () => {
        blockchain.now = START_TIME + 100;
        await registerIntent(toNano('5'), 3n);

        const before = await coordinator.getGetLendingIntentInfo(nft);
        expect(before.intent_state).toBe(LENDING_INTENT_ACTIVE);
        expect(before.collateral_signal_amount).toBe(toNano('5'));
        expect(before.target_lender).toBe(3n);
        expect(before.created_at).toBe(BigInt(START_TIME + 100));
        expect(before.updated_at).toBe(BigInt(START_TIME + 100));

        blockchain.now = START_TIME + 250;
        const result = await cancelIntent();
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: true,
        });

        const after = await coordinator.getGetLendingIntentInfo(nft);
        expect(after.intent_state).toBe(LENDING_INTENT_CANCELLED);
        expect(after.collateral_signal_amount).toBe(before.collateral_signal_amount);
        expect(after.target_lender).toBe(before.target_lender);
        expect(after.created_at).toBe(before.created_at);
        expect(after.updated_at).toBe(BigInt(START_TIME + 250));
        expect(await coordinator.getHasActiveLendingIntent(nft)).toBe(false);
    });

    it('rejects cancellation after the intent already left the active state', async () => {
        await registerIntent();

        blockchain.now = START_TIME + 10;
        await cancelIntent();
        const cancelled = await coordinator.getGetLendingIntentInfo(nft);

        blockchain.now = START_TIME + 20;
        const result = await cancelIntent();
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: false,
        });

        const after = await coordinator.getGetLendingIntentInfo(nft);
        expect(after).toEqual(cancelled);
    });
});
