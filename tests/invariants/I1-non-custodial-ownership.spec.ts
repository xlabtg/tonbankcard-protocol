/**
 * INVARIANT I1: Non-Custodial Ownership
 *
 * Tests that verify the protocol maintains non-custodial ownership:
 * - Only NFT owners can initiate transfers
 * - No admin can move funds without owner signature
 * - Backend services cannot execute transfers
 * - External adapters cannot bypass ownership checks
 *
 * Reference: docs/invariants.md - I1
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address } from '@ton/core';
import { PaymentHub } from '../../wrappers/PaymentHub';
import '@ton/test-utils';

describe('Invariant I1 - Non-Custodial Ownership', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<PaymentHub>;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');
        attacker = await blockchain.treasury('attacker');

        paymentHub = blockchain.openContract(
            await PaymentHub.fromInit(deployer.address)
        );

        const deployResult = await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: paymentHub.address,
            deploy: true,
            success: true,
        });

        // Setup Alice's account with balance
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: alice.address,
                owner: alice.address,
                initial_balance: toNano('1000'),
                initial_state: 0, // ACTIVE
            }
        );

        // Setup Bob's account
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: bob.address,
                owner: bob.address,
                initial_balance: toNano('0'),
                initial_state: 0, // ACTIVE
            }
        );
    });

    describe('Positive Tests: Owner-Initiated Transfers', () => {
        it('should allow NFT owner to transfer funds', async () => {
            const transferResult = await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: alice.address,
                to: paymentHub.address,
                success: true,
            });

            // Verify balances updated correctly
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);

            expect(aliceBalance).toBe(toNano('900'));
            expect(bobBalance).toBe(toNano('100'));
        });
    });

    describe('Negative Tests: Non-Owner Cannot Transfer', () => {
        it('should reject transfer initiated by non-owner', async () => {
            // Attacker tries to transfer Alice's funds to themselves
            const transferResult = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,  // Alice's account
                    to_nft: attacker.address, // To attacker
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Transaction should fail due to unauthorized sender
            expect(transferResult.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            // Alice's balance should remain unchanged
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            expect(aliceBalance).toBe(toNano('1000'));

            // Attacker should not have received funds
            const attackerBalance = await paymentHub.getGetBalance(attacker.address);
            expect(attackerBalance).toBe(0n);
        });

        it('should reject transfer when Bob tries to move Alice\'s funds', async () => {
            // Bob (legitimate user) tries to transfer Alice's funds
            const transferResult = await paymentHub.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,  // Alice's account
                    to_nft: bob.address,      // To Bob
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Should fail - Bob is not owner of Alice's NFT
            expect(transferResult.transactions).toHaveTransaction({
                from: bob.address,
                to: paymentHub.address,
                success: false,
            });

            // Balances should remain unchanged
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);

            expect(aliceBalance).toBe(toNano('1000'));
            expect(bobBalance).toBe(0n);
        });
    });

    describe('Negative Tests: Admin Cannot Move Funds', () => {
        it('should not allow deployer to transfer user funds', async () => {
            // Deployer tries to transfer Alice's funds
            const transferResult = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: deployer.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Should fail - deployer is not NFT owner
            expect(transferResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
            });

            // Alice's balance should remain unchanged
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            expect(aliceBalance).toBe(toNano('1000'));
        });
    });

    describe('INVARIANT VERIFICATION: Ownership is Always Checked', () => {
        it('should verify ownership on every transfer attempt', async () => {
            // Successful transfer by owner
            const successResult = await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            expect(successResult.transactions).toHaveTransaction({
                from: alice.address,
                to: paymentHub.address,
                success: true,
            });

            // Failed transfer by non-owner
            const failResult = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: attacker.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            expect(failResult.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            // Final balance check: Only owner's transfer succeeded
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            expect(aliceBalance).toBe(toNano('950')); // 1000 - 50 = 950
        });
    });

    describe('Edge Cases', () => {
        it('should maintain non-custodial property across multiple transfers', async () => {
            // Alice transfers to Bob
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('200'),
                    payload: null,
                }
            );

            // Now Bob owns 200 TBC - only Bob can transfer it
            const bobTransferResult = await paymentHub.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: bob.address,
                    to_nft: alice.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            expect(bobTransferResult.transactions).toHaveTransaction({
                from: bob.address,
                to: paymentHub.address,
                success: true,
            });

            // Attacker cannot transfer Bob's funds
            const attackResult = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: bob.address,
                    to_nft: attacker.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            expect(attackResult.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            // Final balances
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);
            const attackerBalance = await paymentHub.getGetBalance(attacker.address);

            expect(aliceBalance).toBe(toNano('850')); // 1000 - 200 + 50
            expect(bobBalance).toBe(toNano('150'));   // 200 - 50
            expect(attackerBalance).toBe(0n);
        });
    });
});
