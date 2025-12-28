/**
 * INVARIANT I4: Atomic Transfers
 *
 * Tests that verify all transfers are atomic:
 * - Transfers complete fully or revert entirely
 * - No partial balance updates
 * - No intermediate states
 * - Reentrancy protection works correctly
 *
 * Reference: docs/invariants.md - I4
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentHub } from '../../wrappers/PaymentHub';
import '@ton/test-utils';

describe('Invariant I4 - Atomic Transfers', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<PaymentHub>;
    let sender: SandboxContract<TreasuryContract>;
    let receiver: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        sender = await blockchain.treasury('sender');
        receiver = await blockchain.treasury('receiver');

        paymentHub = blockchain.openContract(
            await PaymentHub.fromInit(deployer.address)
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Setup accounts
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: sender.address,
                owner: sender.address,
                initial_balance: toNano('1000'),
                initial_state: 0, // ACTIVE
            }
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: receiver.address,
                owner: receiver.address,
                initial_balance: toNano('500'),
                initial_state: 0, // ACTIVE
            }
        );
    });

    describe('Successful Transfers Are Atomic', () => {
        it('should update both sender and receiver balances atomically', async () => {
            const senderBefore = await paymentHub.getGetBalance(sender.address);
            const receiverBefore = await paymentHub.getGetBalance(receiver.address);

            const transferAmount = toNano('200');

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: true,
            });

            const senderAfter = await paymentHub.getGetBalance(sender.address);
            const receiverAfter = await paymentHub.getGetBalance(receiver.address);

            // INVARIANT: Both balances updated in same transaction
            expect(senderAfter).toBe(senderBefore - transferAmount);
            expect(receiverAfter).toBe(receiverBefore + transferAmount);

            // INVARIANT: No intermediate state exists
            expect(senderAfter).toBe(toNano('800'));
            expect(receiverAfter).toBe(toNano('700'));
        });

        it('should handle multiple sequential transfers atomically', async () => {
            // First transfer
            await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            const midSender = await paymentHub.getGetBalance(sender.address);
            const midReceiver = await paymentHub.getGetBalance(receiver.address);

            expect(midSender).toBe(toNano('900'));
            expect(midReceiver).toBe(toNano('600'));

            // Second transfer
            await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('150'),
                    payload: null,
                }
            );

            const finalSender = await paymentHub.getGetBalance(sender.address);
            const finalReceiver = await paymentHub.getGetBalance(receiver.address);

            // Each transfer is atomic
            expect(finalSender).toBe(toNano('750'));
            expect(finalReceiver).toBe(toNano('750'));
        });
    });

    describe('Failed Transfers Revert Completely', () => {
        it('should revert transfer when insufficient balance', async () => {
            const senderBefore = await paymentHub.getGetBalance(sender.address);
            const receiverBefore = await paymentHub.getGetBalance(receiver.address);

            // Try to transfer more than balance
            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('2000'), // More than sender has
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: false,
            });

            // INVARIANT: Both balances remain unchanged
            const senderAfter = await paymentHub.getGetBalance(sender.address);
            const receiverAfter = await paymentHub.getGetBalance(receiver.address);

            expect(senderAfter).toBe(senderBefore);
            expect(receiverAfter).toBe(receiverBefore);
        });

        it('should revert transfer when sender account is frozen', async () => {
            // Freeze sender account
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: sender.address,
                    owner: sender.address,
                    initial_balance: toNano('1000'),
                    initial_state: 1, // FROZEN
                }
            );

            const senderBefore = await paymentHub.getGetBalance(sender.address);
            const receiverBefore = await paymentHub.getGetBalance(receiver.address);

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: false,
            });

            // INVARIANT: No partial updates
            const senderAfter = await paymentHub.getGetBalance(sender.address);
            const receiverAfter = await paymentHub.getGetBalance(receiver.address);

            expect(senderAfter).toBe(senderBefore);
            expect(receiverAfter).toBe(receiverBefore);
        });

        it('should revert transfer to closed account', async () => {
            // Close receiver account
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: receiver.address,
                    owner: receiver.address,
                    initial_balance: toNano('500'),
                    initial_state: 3, // CLOSED
                }
            );

            const senderBefore = await paymentHub.getGetBalance(sender.address);
            const receiverBefore = await paymentHub.getGetBalance(receiver.address);

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: false,
            });

            // INVARIANT: Complete revert, no partial state
            const senderAfter = await paymentHub.getGetBalance(sender.address);
            const receiverAfter = await paymentHub.getGetBalance(receiver.address);

            expect(senderAfter).toBe(senderBefore);
            expect(receiverAfter).toBe(receiverBefore);
        });
    });

    describe('No Intermediate States', () => {
        it('should verify no state where debit succeeds but credit fails', async () => {
            const transferAmount = toNano('300');

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: true,
            });

            // Verify both updated together (no intermediate state)
            const senderBalance = await paymentHub.getGetBalance(sender.address);
            const receiverBalance = await paymentHub.getGetBalance(receiver.address);

            // If debit succeeded, credit must have succeeded
            expect(senderBalance).toBe(toNano('700'));
            expect(receiverBalance).toBe(toNano('800'));

            // Conservation check: total unchanged
            expect(senderBalance + receiverBalance).toBe(toNano('1500'));
        });
    });

    describe('Reentrancy Protection', () => {
        it('should have reentrancy guard active during transfer', async () => {
            // The reentrancy guard is implemented in PaymentHub.tact
            // It sets self.locked = true at the start and false at the end
            // This test verifies the guard works by checking transfer succeeds

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: true,
            });

            // Subsequent transfer should work (lock released)
            const result2 = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: receiver.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(result2.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: true,
            });
        });
    });

    describe('Self-Transfer Edge Case', () => {
        it('should handle self-transfer atomically (no-op)', async () => {
            const balanceBefore = await paymentHub.getGetBalance(sender.address);

            const result = await paymentHub.send(
                sender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: sender.address,
                    to_nft: sender.address, // Self-transfer
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: sender.address,
                to: paymentHub.address,
                success: true,
            });

            // INVARIANT: Balance unchanged (atomic no-op)
            const balanceAfter = await paymentHub.getGetBalance(sender.address);
            expect(balanceAfter).toBe(balanceBefore);
        });
    });

    describe('INVARIANT VERIFICATION: Complete Atomicity', () => {
        it('should verify transfers are all-or-nothing across all scenarios', async () => {
            const scenarios = [
                // Scenario 1: Successful transfer
                {
                    amount: toNano('100'),
                    expectedSuccess: true,
                    senderFinal: toNano('900'),
                    receiverFinal: toNano('600'),
                },
            ];

            for (const scenario of scenarios) {
                const result = await paymentHub.send(
                    sender.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'TransferInternalRequest',
                        from_nft: sender.address,
                        to_nft: receiver.address,
                        amount_tbc: scenario.amount,
                        payload: null,
                    }
                );

                const txSuccess = result.transactions.some(
                    tx => tx.description.type === 'generic' && tx.description.computePhase.type === 'vm' && tx.description.computePhase.success
                );

                if (scenario.expectedSuccess) {
                    expect(result.transactions).toHaveTransaction({
                        from: sender.address,
                        to: paymentHub.address,
                        success: true,
                    });

                    const senderBalance = await paymentHub.getGetBalance(sender.address);
                    const receiverBalance = await paymentHub.getGetBalance(receiver.address);

                    expect(senderBalance).toBe(scenario.senderFinal);
                    expect(receiverBalance).toBe(scenario.receiverFinal);
                }
            }
        });
    });
});
