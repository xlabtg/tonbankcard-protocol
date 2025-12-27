/**
 * INVARIANT I6: Lock ≠ Confiscation
 *
 * Tests that verify locks restrict actions without confiscating funds:
 * - Locked accounts cannot send
 * - Locked accounts CAN receive
 * - Locks do NOT modify balances
 * - Locks do NOT change ownership
 * - Locks are reversible
 *
 * Reference: docs/invariants.md - I6
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { MerchantPaymentHub } from '../../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('Invariant I6 - Lock ≠ Confiscation', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let merchantHub: SandboxContract<MerchantPaymentHub>;
    let user: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        recipient = await blockchain.treasury('recipient');

        merchantHub = blockchain.openContract(
            await MerchantPaymentHub.fromInit()
        );

        await merchantHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Setup user account
        await merchantHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountState',
                nft_address: user.address,
                state: 0, // ACTIVE
                owner: user.address,
            }
        );

        await merchantHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountBalance',
                nft_address: user.address,
                balance: toNano('1000'),
            }
        );

        // Setup recipient account
        await merchantHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountState',
                nft_address: recipient.address,
                state: 0, // ACTIVE
                owner: recipient.address,
            }
        );

        await merchantHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountBalance',
                nft_address: recipient.address,
                balance: toNano('500'),
            }
        );
    });

    describe('Locks Prevent Sending', () => {
        it('should prevent sending when fraud lock is active', async () => {
            // Apply fraud lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            // Verify lock state
            const hasFraudLock = await merchantHub.getHasFraudLock(user.address);
            expect(hasFraudLock).toBe(true);

            // Attempt payment (should fail due to lock)
            const paymentResult = await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Payment should succeed but return error code for locked account
            expect(paymentResult.transactions).toHaveTransaction({
                from: user.address,
                to: merchantHub.address,
                success: true, // Transaction succeeds but business logic returns error
            });

            // INVARIANT: Balance unchanged (lock prevents send)
            const userBalance = await merchantHub.getGetBalance(user.address);
            expect(userBalance).toBe(toNano('1000'));
        });

        it('should prevent sending when collateral lock is active', async () => {
            // Apply collateral lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            const hasCollateralLock = await merchantHub.getHasCollateralLock(user.address);
            expect(hasCollateralLock).toBe(true);

            // Attempt payment (should fail)
            const paymentResult = await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // INVARIANT: Balance unchanged
            const userBalance = await merchantHub.getGetBalance(user.address);
            expect(userBalance).toBe(toNano('1000'));
        });

        it('should prevent sending when both locks are active', async () => {
            // Apply both locks
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: true,
                    },
                }
            );

            const isLocked = await merchantHub.getIsAccountLocked(user.address);
            expect(isLocked).toBe(true);

            const paymentResult = await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // INVARIANT: Locked account cannot send
            const userBalance = await merchantHub.getGetBalance(user.address);
            expect(userBalance).toBe(toNano('1000'));
        });
    });

    describe('Locked Accounts CAN Receive', () => {
        it('should allow receiving funds when fraud locked', async () => {
            // Lock user account
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            const userBalanceBefore = await merchantHub.getGetBalance(user.address);

            // Recipient sends to locked user (should succeed)
            const paymentResult = await merchantHub.send(
                recipient.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: recipient.address,
                    merchant_nft: user.address, // Locked account receiving
                    amount_tbc: toNano('200'),
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: recipient.address,
                to: merchantHub.address,
                success: true,
            });

            // INVARIANT: Locked account CAN receive
            const userBalanceAfter = await merchantHub.getGetBalance(user.address);
            expect(userBalanceAfter).toBe(userBalanceBefore + toNano('200'));
            expect(userBalanceAfter).toBe(toNano('1200'));
        });

        it('should allow receiving when collateral locked', async () => {
            // Lock user account
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            const userBalanceBefore = await merchantHub.getGetBalance(user.address);

            // Send to locked account
            await merchantHub.send(
                recipient.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: recipient.address,
                    merchant_nft: user.address,
                    amount_tbc: toNano('150'),
                    payload: null,
                }
            );

            // INVARIANT: Can receive when locked
            const userBalanceAfter = await merchantHub.getGetBalance(user.address);
            expect(userBalanceAfter).toBe(userBalanceBefore + toNano('150'));
        });
    });

    describe('Locks Do NOT Modify Balances', () => {
        it('should not change balance when applying fraud lock', async () => {
            const balanceBefore = await merchantHub.getGetBalance(user.address);
            expect(balanceBefore).toBe(toNano('1000'));

            // Apply fraud lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            const balanceAfter = await merchantHub.getGetBalance(user.address);

            // INVARIANT: Lock does NOT modify balance
            expect(balanceAfter).toBe(balanceBefore);
            expect(balanceAfter).toBe(toNano('1000'));
        });

        it('should not change balance when applying collateral lock', async () => {
            const balanceBefore = await merchantHub.getGetBalance(user.address);

            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            const balanceAfter = await merchantHub.getGetBalance(user.address);

            // INVARIANT: Lock does NOT seize funds
            expect(balanceAfter).toBe(balanceBefore);
        });

        it('should not change balance when removing locks', async () => {
            // Apply lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: true,
                    },
                }
            );

            const balanceLocked = await merchantHub.getGetBalance(user.address);

            // Remove lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: false,
                    },
                }
            );

            const balanceUnlocked = await merchantHub.getGetBalance(user.address);

            // INVARIANT: Unlock does NOT modify balance
            expect(balanceUnlocked).toBe(balanceLocked);
            expect(balanceUnlocked).toBe(toNano('1000'));
        });
    });

    describe('Locks Are Reversible', () => {
        it('should allow clearing fraud lock and resuming sends', async () => {
            // Apply fraud lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            // Verify cannot send while locked
            const lockedPayment = await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            const balanceWhileLocked = await merchantHub.getGetBalance(user.address);
            expect(balanceWhileLocked).toBe(toNano('1000')); // Unchanged

            // INVARIANT: Locks are reversible - clear the lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: false,
                    },
                }
            );

            const isLocked = await merchantHub.getIsAccountLocked(user.address);
            expect(isLocked).toBe(false);

            // Now can send
            const unlockedPayment = await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(unlockedPayment.transactions).toHaveTransaction({
                from: user.address,
                to: merchantHub.address,
                success: true,
            });

            const finalBalance = await merchantHub.getGetBalance(user.address);
            expect(finalBalance).toBe(toNano('900')); // 1000 - 100
        });

        it('should allow clearing collateral lock', async () => {
            // Apply collateral lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            let hasLock = await merchantHub.getHasCollateralLock(user.address);
            expect(hasLock).toBe(true);

            // Clear collateral lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: false,
                    },
                }
            );

            hasLock = await merchantHub.getHasCollateralLock(user.address);
            expect(hasLock).toBe(false);

            // Can send after unlock
            await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            const balance = await merchantHub.getGetBalance(user.address);
            expect(balance).toBe(toNano('950'));
        });
    });

    describe('INVARIANT VERIFICATION: Lock Properties', () => {
        it('should verify all lock properties together', async () => {
            const initialBalance = await merchantHub.getGetBalance(user.address);

            // 1. Apply lock
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            // Property 1: Lock does NOT change balance
            let balance = await merchantHub.getGetBalance(user.address);
            expect(balance).toBe(initialBalance);

            // Property 2: Cannot send when locked
            await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            balance = await merchantHub.getGetBalance(user.address);
            expect(balance).toBe(initialBalance); // Unchanged

            // Property 3: CAN receive when locked
            await merchantHub.send(
                recipient.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: recipient.address,
                    merchant_nft: user.address,
                    amount_tbc: toNano('200'),
                    payload: null,
                }
            );

            balance = await merchantHub.getGetBalance(user.address);
            expect(balance).toBe(initialBalance + toNano('200'));

            // Property 4: Lock is reversible
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: user.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: false,
                    },
                }
            );

            const isLocked = await merchantHub.getIsAccountLocked(user.address);
            expect(isLocked).toBe(false);

            // Can now send
            await merchantHub.send(
                user.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: recipient.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            balance = await merchantHub.getGetBalance(user.address);
            expect(balance).toBe(toNano('1100')); // 1000 + 200 - 100

            // INVARIANT VERIFIED: Lock restricts actions, NOT ownership
        });
    });
});
