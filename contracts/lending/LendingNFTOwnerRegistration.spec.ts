/**
 * LendingProtocolCoordinator — NFT owner registration regression tests.
 * Issue #280 / Audit finding CONTRACTS-M2.
 *
 * Background:
 *   The coordinator declared a handler `receive(msg: RegisterNFTOwner)` for a
 *   message type that was never defined or imported, while the message actually
 *   declared in the file was `RegisterNFTOwnerLending` (opcode 0x7e8764ef). The
 *   handler was therefore bound to a non-existent type — a latent compile error
 *   that stayed hidden because the contract was excluded from every build
 *   manifest exercised by CI.
 *
 * Fix:
 *   The handler now binds to the defined `RegisterNFTOwnerLending` message, and
 *   the contract is compiled (via `contracts/tact.config.lending.json`) and
 *   tested in CI so the message-type mismatch can never silently return.
 *
 * These tests exercise the acceptance criteria:
 *   (a) The `RegisterNFTOwnerLending` message is handled: a deployer-registered
 *       owner can subsequently register a lending intent (ownership is honoured).
 *   (b) Ownership-gated actions fail for an NFT that was never registered.
 *   (c) Registration is gated on the deployer (unauthorized senders rejected).
 *   (d) An already-registered owner cannot be overwritten (write-once guard).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano, Address } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { LendingProtocolCoordinatorHarness } from './dist/LendingProtocolCoordinatorHarness_LendingProtocolCoordinatorHarness';

// Mirror of the Tact intent-state constants.
const LENDING_INTENT_NONE = 0n;
const LENDING_INTENT_ACTIVE = 1n;

const GAS = toNano('0.2');

describe('LendingProtocolCoordinator — NFT owner registration (CONTRACTS-M2)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let coordinator: SandboxContract<LendingProtocolCoordinatorHarness>;

    // A stand-in NFT card address (the contract only uses it as a map key).
    let nft: Address;

    async function registerOwner(
        sender: SandboxContract<TreasuryContract>,
        ownerAddress: Address,
        nftAddress: Address = nft
    ) {
        return coordinator.send(
            sender.getSender(),
            { value: toNano('0.5') },
            { $$type: 'RegisterNFTOwnerLending', nft_address: nftAddress, owner: ownerAddress }
        );
    }

    async function registerIntent(sender: SandboxContract<TreasuryContract>, nftAddress: Address = nft) {
        return coordinator.send(
            sender.getSender(),
            { value: GAS },
            {
                $$type: 'RegisterLendingIntent',
                nft_address: nftAddress,
                collateral_signal_amount: toNano('1'),
                target_lender: 0n,
            }
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        attacker = await blockchain.treasury('attacker');
        nft = (await blockchain.treasury('nft-card')).address;

        coordinator = blockchain.openContract(await LendingProtocolCoordinatorHarness.fromInit());

        // The very first message both deploys the contract (init records the
        // deployer = sender) and registers the NFT owner via the test-only
        // `RegisterNFTOwnerLending` handler, which is gated on the deployer.
        const result = await registerOwner(deployer, owner.address);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: coordinator.address,
            success: true,
        });
    });

    it('(a) honours an owner registered via RegisterNFTOwnerLending', async () => {
        // Before the owner acts there is no intent.
        expect(await coordinator.getGetLendingIntentState(nft)).toBe(LENDING_INTENT_NONE);

        const result = await registerIntent(owner);
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: coordinator.address,
            success: true,
        });

        // The registered owner's ownership is recognised, so the intent is active.
        expect(await coordinator.getGetLendingIntentState(nft)).toBe(LENDING_INTENT_ACTIVE);
        expect(await coordinator.getHasActiveLendingIntent(nft)).toBe(true);
    });

    it('(b) rejects ownership-gated actions for an unregistered NFT', async () => {
        const otherNft = (await blockchain.treasury('other-nft')).address;

        await registerIntent(owner, otherNft);

        // No owner was ever registered for `otherNft`, so the intent is not created.
        expect(await coordinator.getGetLendingIntentState(otherNft)).toBe(LENDING_INTENT_NONE);
        expect(await coordinator.getHasActiveLendingIntent(otherNft)).toBe(false);
    });

    it('(c) rejects owner registration from a non-deployer', async () => {
        const otherNft = (await blockchain.treasury('other-nft')).address;

        const result = await registerOwner(attacker, attacker.address, otherNft);
        expect(result.transactions).toHaveTransaction({
            from: attacker.address,
            to: coordinator.address,
            success: false,
        });

        // The attacker gained no ownership: the intent cannot be registered.
        await registerIntent(attacker, otherNft);
        expect(await coordinator.getGetLendingIntentState(otherNft)).toBe(LENDING_INTENT_NONE);
    });

    it('(d) refuses to overwrite an already-registered owner', async () => {
        // `nft` already maps to `owner` (registered in beforeEach). A second
        // registration — even by the deployer — must be rejected.
        const result = await registerOwner(deployer, attacker.address);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: coordinator.address,
            success: false,
        });

        // The original owner still controls the NFT; the attacker does not.
        await registerIntent(attacker);
        expect(await coordinator.getGetLendingIntentState(nft)).toBe(LENDING_INTENT_NONE);

        await registerIntent(owner);
        expect(await coordinator.getGetLendingIntentState(nft)).toBe(LENDING_INTENT_ACTIVE);
    });
});
