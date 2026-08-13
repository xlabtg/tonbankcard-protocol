/**
 * LendingProtocolCoordinator - update regression tests.
 * Issue #398.
 *
 * UpdateLendingIntent had no state-transition guard: it unconditionally wrote
 * `intent_state: ACTIVE`. That silently (a) materialized a never-registered
 * intent and (b) resurrected a CANCELLED intent back to ACTIVE. An update may
 * only mutate an already-ACTIVE intent; every other state must be rejected and
 * leave storage untouched.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano, Address } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { LendingProtocolCoordinatorHarness } from './dist/LendingProtocolCoordinatorHarness_LendingProtocolCoordinatorHarness';

const LENDING_INTENT_NONE = 0n;
const LENDING_INTENT_ACTIVE = 1n;
const LENDING_INTENT_CANCELLED = 2n;

const GAS = toNano('0.2');
const START_TIME = 1_700_000_000;

describe('LendingProtocolCoordinator - lending intent update guard (#398)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let coordinator: SandboxContract<LendingProtocolCoordinatorHarness>;
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

    async function updateIntent(
        collateralSignalAmount = toNano('9'),
        targetLender = 11n,
        nftAddress: Address = nft
    ) {
        return coordinator.send(
            owner.getSender(),
            { value: GAS },
            {
                $$type: 'UpdateLendingIntent',
                nft_address: nftAddress,
                collateral_signal_amount: collateralSignalAmount,
                target_lender: targetLender,
            }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = START_TIME;

        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        nft = (await blockchain.treasury('nft-card')).address;

        coordinator = blockchain.openContract(await LendingProtocolCoordinatorHarness.fromInit());

        const result = await registerOwner(owner.address);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: coordinator.address,
            success: true,
        });
    });

    it('reverts update of an owner-registered NFT with no intent', async () => {
        const result = await updateIntent();
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

    it('updates an active intent while preserving its creation metadata', async () => {
        blockchain.now = START_TIME + 100;
        await registerIntent(toNano('5'), 3n);

        const before = await coordinator.getGetLendingIntentInfo(nft);
        expect(before.intent_state).toBe(LENDING_INTENT_ACTIVE);
        expect(before.created_at).toBe(BigInt(START_TIME + 100));

        blockchain.now = START_TIME + 250;
        const result = await updateIntent(toNano('9'), 11n);
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: true,
        });

        const after = await coordinator.getGetLendingIntentInfo(nft);
        expect(after.intent_state).toBe(LENDING_INTENT_ACTIVE);
        expect(after.collateral_signal_amount).toBe(toNano('9'));
        expect(after.target_lender).toBe(11n);
        expect(after.created_at).toBe(before.created_at);
        expect(after.updated_at).toBe(BigInt(START_TIME + 250));
        expect(await coordinator.getHasActiveLendingIntent(nft)).toBe(true);
    });

    it('does not resurrect a CANCELLED intent back to ACTIVE', async () => {
        await registerIntent(toNano('5'), 3n);

        blockchain.now = START_TIME + 10;
        await cancelIntent();
        const cancelled = await coordinator.getGetLendingIntentInfo(nft);
        expect(cancelled.intent_state).toBe(LENDING_INTENT_CANCELLED);

        blockchain.now = START_TIME + 20;
        const result = await updateIntent(toNano('9'), 11n);
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: false,
        });

        const after = await coordinator.getGetLendingIntentInfo(nft);
        expect(after).toEqual(cancelled);
        expect(after.intent_state).toBe(LENDING_INTENT_CANCELLED);
        expect(await coordinator.getHasActiveLendingIntent(nft)).toBe(false);
    });

    it('rejects update from a non-owner sender', async () => {
        await registerIntent(toNano('5'), 3n);
        const before = await coordinator.getGetLendingIntentInfo(nft);

        const attacker = await blockchain.treasury('attacker');
        const result = await coordinator.send(
            attacker.getSender(),
            { value: GAS },
            {
                $$type: 'UpdateLendingIntent',
                nft_address: nft,
                collateral_signal_amount: toNano('100'),
                target_lender: 99n,
            }
        );
        expect(result.transactions).toHaveTransaction({
            from: attacker.address,
            to: coordinator.address,
            success: true,
        });

        const after = await coordinator.getGetLendingIntentInfo(nft);
        expect(after).toEqual(before);
    });
});
