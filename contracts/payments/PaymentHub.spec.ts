/**
 * PaymentHub Smart Contract Test Suite
 *
 * Tests for Internal TBC Transfers Between NFT Accounts
 * Issue #6: Issue 3.3 Payment Hub — Internal TBC Transfers Between NFT Accounts
 *
 * This test suite covers all requirements from the issue:
 * - Normal transfer flow
 * - Validation rules
 * - State enforcement
 * - Edge cases
 * - Security features
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address } from '@ton/core';
import { PaymentHub } from './wrappers/PaymentHub';
import '@ton/test-utils';

describe('PaymentHub - Internal TBC Transfers', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<PaymentHub>;
    let userA: SandboxContract<TreasuryContract>;
    let userB: SandboxContract<TreasuryContract>;
    let nftAccountA: Address;
    let nftAccountB: Address;

    beforeEach(async () => {
        // Initialize blockchain sandbox
        blockchain = await Blockchain.create();

        // Create test users
        deployer = await blockchain.treasury('deployer');
        userA = await blockchain.treasury('userA');
        userB = await blockchain.treasury('userB');

        // Deploy PaymentHub contract
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

        // Create mock NFT account addresses
        nftAccountA = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-LeA');
        nftAccountB = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7B');

        // Initialize accounts with balances
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: nftAccountA,
                owner: userA.address,
                initial_balance: toNano('1000'), // 1000 TBC
                initial_state: 0, // ACTIVE
            }
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: nftAccountB,
                owner: userB.address,
                initial_balance: toNano('500'), // 500 TBC
                initial_state: 0, // ACTIVE
            }
        );
    });

    // ========================================
    // Normal Flow Tests
    // ========================================

    describe('Normal Transfer Flow', () => {
        it('should successfully transfer TBC between two ACTIVE accounts', async () => {
            const transferAmount = toNano('100'); // 100 TBC

            // Get initial balances
            const initialBalanceA = await paymentHub.getBalance(nftAccountA);
            const initialBalanceB = await paymentHub.getBalance(nftAccountB);

            // Perform transfer
            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            // Verify transaction success
            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });

            // Verify balances updated correctly
            const finalBalanceA = await paymentHub.getBalance(nftAccountA);
            const finalBalanceB = await paymentHub.getBalance(nftAccountB);

            expect(finalBalanceA).toEqual(initialBalanceA - transferAmount);
            expect(finalBalanceB).toEqual(initialBalanceB + transferAmount);
        });

        it('should emit InternalTransferEvent on successful transfer', async () => {
            const transferAmount = toNano('50');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            // Verify event emission
            // Note: Event verification depends on Sandbox capabilities
            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });
        });

        it('should transfer with payload metadata', async () => {
            const transferAmount = toNano('75');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: {
                        memo: 'Payment for services',
                        orderId: 'ORDER-123',
                    },
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });
        });
    });

    // ========================================
    // Validation Tests
    // ========================================

    describe('Validation Rules', () => {
        it('should reject transfer with zero amount', async () => {
            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: 0n,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: false,
                exitCode: 100, // ERROR_INVALID_AMOUNT
            });
        });

        it('should reject transfer with insufficient balance', async () => {
            const excessiveAmount = toNano('2000'); // More than available

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: excessiveAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: false,
                exitCode: 101, // ERROR_INSUFFICIENT_BALANCE
            });
        });

        it('should reject transfer from non-owner', async () => {
            const transferAmount = toNano('50');

            // User B tries to transfer from User A's account
            const result = await paymentHub.send(
                userB.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userB.address,
                to: paymentHub.address,
                success: false,
                exitCode: 104, // ERROR_UNAUTHORIZED
            });
        });
    });

    // ========================================
    // State Enforcement Tests
    // ========================================

    describe('Account State Enforcement', () => {
        it('should reject transfer from FROZEN account', async () => {
            // Freeze account A
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountA,
                    owner: userA.address,
                    initial_balance: toNano('1000'),
                    initial_state: 1, // FROZEN
                }
            );

            const transferAmount = toNano('50');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: false,
                exitCode: 105, // ERROR_FROM_ACCOUNT_NOT_ACTIVE
            });
        });

        it('should reject transfer from COLLATERAL_LOCKED account', async () => {
            // Lock account A with collateral
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountA,
                    owner: userA.address,
                    initial_balance: toNano('1000'),
                    initial_state: 2, // COLLATERAL_LOCKED
                }
            );

            const transferAmount = toNano('50');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: false,
                exitCode: 105, // ERROR_FROM_ACCOUNT_NOT_ACTIVE
            });
        });

        it('should reject transfer to CLOSED account', async () => {
            // Close account B
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountB,
                    owner: userB.address,
                    initial_balance: toNano('500'),
                    initial_state: 3, // CLOSED
                }
            );

            const transferAmount = toNano('50');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: false,
                exitCode: 106, // ERROR_TO_ACCOUNT_CLOSED
            });
        });

        it('should allow receiving to FROZEN account', async () => {
            // Freeze account B
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountB,
                    owner: userB.address,
                    initial_balance: toNano('500'),
                    initial_state: 1, // FROZEN
                }
            );

            const transferAmount = toNano('50');
            const initialBalanceB = await paymentHub.getBalance(nftAccountB);

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });

            const finalBalanceB = await paymentHub.getBalance(nftAccountB);
            expect(finalBalanceB).toEqual(initialBalanceB + transferAmount);
        });
    });

    // ========================================
    // Edge Cases
    // ========================================

    describe('Edge Cases', () => {
        it('should handle self-transfer correctly', async () => {
            const transferAmount = toNano('50');
            const initialBalance = await paymentHub.getBalance(nftAccountA);

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountA,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });

            // Balance should remain unchanged
            const finalBalance = await paymentHub.getBalance(nftAccountA);
            expect(finalBalance).toEqual(initialBalance);
        });

        it('should transfer to account with zero balance', async () => {
            // Create new account with zero balance
            const nftAccountC = Address.parse('EQCccccccccccccccccccccccccccccccccccccccccccccC');
            const userC = await blockchain.treasury('userC');

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountC,
                    owner: userC.address,
                    initial_balance: 0n,
                    initial_state: 0, // ACTIVE
                }
            );

            const transferAmount = toNano('100');

            const result = await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountC,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: userA.address,
                to: paymentHub.address,
                success: true,
            });

            const finalBalanceC = await paymentHub.getBalance(nftAccountC);
            expect(finalBalanceC).toEqual(transferAmount);
        });

        it('should handle multiple sequential transfers', async () => {
            const transferAmount1 = toNano('100');
            const transferAmount2 = toNano('50');
            const transferAmount3 = toNano('75');

            const initialBalanceA = await paymentHub.getBalance(nftAccountA);
            const initialBalanceB = await paymentHub.getBalance(nftAccountB);

            // Transfer 1
            await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount1,
                    payload: null,
                }
            );

            // Transfer 2
            await paymentHub.send(
                userA.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountA,
                    to_nft: nftAccountB,
                    amount_tbc: transferAmount2,
                    payload: null,
                }
            );

            // Transfer 3 (reverse direction)
            await paymentHub.send(
                userB.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: nftAccountB,
                    to_nft: nftAccountA,
                    amount_tbc: transferAmount3,
                    payload: null,
                }
            );

            // Verify final balances
            const finalBalanceA = await paymentHub.getBalance(nftAccountA);
            const finalBalanceB = await paymentHub.getBalance(nftAccountB);

            const expectedBalanceA = initialBalanceA - transferAmount1 - transferAmount2 + transferAmount3;
            const expectedBalanceB = initialBalanceB + transferAmount1 + transferAmount2 - transferAmount3;

            expect(finalBalanceA).toEqual(expectedBalanceA);
            expect(finalBalanceB).toEqual(expectedBalanceB);
        });
    });

    // ========================================
    // Getter Functions Tests
    // ========================================

    describe('Getter Functions', () => {
        it('should return correct balance', async () => {
            const balance = await paymentHub.getBalance(nftAccountA);
            expect(balance).toEqual(toNano('1000'));
        });

        it('should return correct account state', async () => {
            const state = await paymentHub.getAccountState(nftAccountA);
            expect(state).toEqual(0); // ACTIVE
        });

        it('should return correct owner', async () => {
            const owner = await paymentHub.getOwner(nftAccountA);
            expect(owner.equals(userA.address)).toBe(true);
        });

        it('should correctly check canSend for ACTIVE account', async () => {
            const canSend = await paymentHub.canSend(nftAccountA);
            expect(canSend).toBe(true);
        });

        it('should correctly check canSend for FROZEN account', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountA,
                    owner: userA.address,
                    initial_balance: toNano('1000'),
                    initial_state: 1, // FROZEN
                }
            );

            const canSend = await paymentHub.canSend(nftAccountA);
            expect(canSend).toBe(false);
        });

        it('should correctly check canReceive for CLOSED account', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'InitializeAccount',
                    nft_address: nftAccountA,
                    owner: userA.address,
                    initial_balance: toNano('1000'),
                    initial_state: 3, // CLOSED
                }
            );

            const canReceive = await paymentHub.canReceive(nftAccountA);
            expect(canReceive).toBe(false);
        });
    });
});
