/**
 * Account State Machine Unit Tests
 * Issue #5: Payment Hub - Account State Machine & Internal Ledger
 *
 * Test coverage:
 * - Balance management (deposit, withdraw, transfer)
 * - State transitions
 * - Authorization checks
 * - Edge cases (NFT transfer, frozen states, etc.)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Address, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { AccountStateMachine } from './account-state';

// State constants
const STATE_ACTIVE = 1;
const STATE_FROZEN = 2;
const STATE_COLLATERAL_LOCKED = 3;
const STATE_CLOSED = 4;

describe('AccountStateMachine', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let accountStateMachine: SandboxContract<AccountStateMachine>;
    let nftAccount1: Address;
    let nftAccount2: Address;
    let nftAccount3: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        // Deploy the contract
        accountStateMachine = blockchain.openContract(
            await AccountStateMachine.fromInit(deployer.address)
        );

        // Mock NFT addresses
        nftAccount1 = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
        nftAccount2 = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7');
        nftAccount3 = Address.parse('EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M');
    });

    // ========================================================================
    // BALANCE MANAGEMENT TESTS
    // ========================================================================

    describe('Balance Management', () => {
        it('should allow deposit to a new account', async () => {
            const depositAmount = toNano('100');

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(depositAmount);
        });

        it('should accumulate multiple deposits correctly', async () => {
            const deposit1 = toNano('100');
            const deposit2 = toNano('50');

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: deposit1,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: deposit2,
                }
            );

            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(deposit1 + deposit2);
        });

        it('should allow withdrawal from ACTIVE account', async () => {
            const depositAmount = toNano('100');
            const withdrawAmount = toNano('30');

            // Deposit first
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            // Withdraw
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawTBC',
                    nft_address: nftAccount1,
                    amount: withdrawAmount,
                    destination: deployer.address,
                }
            );

            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(depositAmount - withdrawAmount);
        });

        it('should reject withdrawal with insufficient balance', async () => {
            const depositAmount = toNano('100');
            const withdrawAmount = toNano('150');

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawTBC',
                    nft_address: nftAccount1,
                    amount: withdrawAmount,
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should perform internal transfer between NFT accounts', async () => {
            const depositAmount = toNano('200');
            const transferAmount = toNano('75');

            // Setup: deposit to first account
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            // Transfer
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount2,
                    amount: transferAmount,
                }
            );

            const balance1 = await accountStateMachine.getBalance(nftAccount1);
            const balance2 = await accountStateMachine.getBalance(nftAccount2);

            expect(balance1).toBe(depositAmount - transferAmount);
            expect(balance2).toBe(transferAmount);
        });

        it('should reject self-transfer', async () => {
            const depositAmount = toNano('100');

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount1,
                    amount: toNano('50'),
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });
    });

    // ========================================================================
    // STATE TRANSITION TESTS
    // ========================================================================

    describe('State Transitions', () => {
        it('should initialize accounts as ACTIVE by default', async () => {
            const state = await accountStateMachine.getState(nftAccount1);
            expect(state).toBe(STATE_ACTIVE);
        });

        it('should allow ACTIVE -> FROZEN transition', async () => {
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            const state = await accountStateMachine.getState(nftAccount1);
            expect(state).toBe(STATE_FROZEN);
        });

        it('should allow ACTIVE -> COLLATERAL_LOCKED transition', async () => {
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_COLLATERAL_LOCKED,
                }
            );

            const state = await accountStateMachine.getState(nftAccount1);
            expect(state).toBe(STATE_COLLATERAL_LOCKED);
        });

        it('should reject FROZEN -> ACTIVE transition (requires DAO)', async () => {
            // First freeze the account
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            // Attempt to unfreeze without authorization
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_ACTIVE,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should reject COLLATERAL_LOCKED -> ACTIVE transition (requires lending adapter)', async () => {
            // First lock the account
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_COLLATERAL_LOCKED,
                }
            );

            // Attempt to unlock without authorization
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_ACTIVE,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });
    });

    // ========================================================================
    // STATE-BASED OPERATION TESTS
    // ========================================================================

    describe('State-Based Operations', () => {
        it('should block withdrawal from FROZEN account', async () => {
            const depositAmount = toNano('100');

            // Deposit and freeze
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            // Attempt withdrawal
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawTBC',
                    nft_address: nftAccount1,
                    amount: toNano('50'),
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should block withdrawal from COLLATERAL_LOCKED account', async () => {
            const depositAmount = toNano('100');

            // Deposit and lock
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_COLLATERAL_LOCKED,
                }
            );

            // Attempt withdrawal
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawTBC',
                    nft_address: nftAccount1,
                    amount: toNano('50'),
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should allow deposit to FROZEN account', async () => {
            // Freeze account first
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            // Deposit should still work
            const depositAmount = toNano('100');
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(depositAmount);
        });

        it('should block transfer from FROZEN account', async () => {
            const depositAmount = toNano('100');

            // Deposit and freeze
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            // Attempt transfer
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount2,
                    amount: toNano('50'),
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should allow transfer TO a FROZEN account', async () => {
            const depositAmount = toNano('100');
            const transferAmount = toNano('50');

            // Setup: deposit to account1, freeze account2
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount2,
                    new_state: STATE_FROZEN,
                }
            );

            // Transfer should succeed
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount2,
                    amount: transferAmount,
                }
            );

            const balance2 = await accountStateMachine.getBalance(nftAccount2);
            expect(balance2).toBe(transferAmount);
        });
    });

    // ========================================================================
    // EDGE CASES
    // ========================================================================

    describe('Edge Cases', () => {
        it('should handle NFT transferred with balance > 0', async () => {
            const depositAmount = toNano('500');

            // Deposit to NFT account
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            // Balance should remain with the NFT address
            // regardless of who owns the NFT
            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(depositAmount);

            // NOTE: Actual ownership verification would happen through
            // NFT Account Resolver (Issue #4) integration
        });

        it('should handle NFT transferred while COLLATERAL_LOCKED', async () => {
            const depositAmount = toNano('1000');

            // Deposit and lock
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_COLLATERAL_LOCKED,
                }
            );

            // State should remain COLLATERAL_LOCKED
            const state = await accountStateMachine.getState(nftAccount1);
            expect(state).toBe(STATE_COLLATERAL_LOCKED);

            // Balance should be preserved
            const balance = await accountStateMachine.getBalance(nftAccount1);
            expect(balance).toBe(depositAmount);
        });

        it('should handle zero balance withdrawal attempt gracefully', async () => {
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawTBC',
                    nft_address: nftAccount1,
                    amount: toNano('10'),
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });
        });

        it('should handle deposit to CLOSED account', async () => {
            // Close the account
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_CLOSED,
                }
            );

            // Attempt deposit (should fail based on future requirements)
            // For now, deposits are allowed to all states
            const depositAmount = toNano('100');
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            // This test documents current behavior
            // Future: may want to reject deposits to CLOSED accounts
        });

        it('should prevent double-spend through multiple simultaneous transfers', async () => {
            const depositAmount = toNano('100');
            const transferAmount = toNano('60');

            // Deposit
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            // First transfer should succeed
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount2,
                    amount: transferAmount,
                }
            );

            // Second transfer with same amount should fail (insufficient balance)
            const result = await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternal',
                    from_nft: nftAccount1,
                    to_nft: nftAccount3,
                    amount: transferAmount,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: accountStateMachine.address,
                success: false,
            });

            // Verify final balances
            const balance1 = await accountStateMachine.getBalance(nftAccount1);
            expect(balance1).toBe(depositAmount - transferAmount);
        });
    });

    // ========================================================================
    // QUERY FUNCTIONS
    // ========================================================================

    describe('Query Functions', () => {
        it('should correctly report canSend for ACTIVE account', async () => {
            const canSend = await accountStateMachine.canSend(nftAccount1);
            expect(canSend).toBe(true);
        });

        it('should correctly report canSend for FROZEN account', async () => {
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            const canSend = await accountStateMachine.canSend(nftAccount1);
            expect(canSend).toBe(false);
        });

        it('should correctly report canReceive for all states except CLOSED', async () => {
            // ACTIVE
            let canReceive = await accountStateMachine.canReceive(nftAccount1);
            expect(canReceive).toBe(true);

            // FROZEN
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );
            canReceive = await accountStateMachine.canReceive(nftAccount1);
            expect(canReceive).toBe(true);

            // COLLATERAL_LOCKED
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_ACTIVE,
                }
            );
            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_COLLATERAL_LOCKED,
                }
            );
            canReceive = await accountStateMachine.canReceive(nftAccount1);
            expect(canReceive).toBe(true);

            // Note: Cannot test CLOSED -> ACTIVE transition
            // as it's blocked in current implementation
        });

        it('should return complete account state', async () => {
            const depositAmount = toNano('250');

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'DepositTBC',
                    nft_address: nftAccount1,
                    amount: depositAmount,
                }
            );

            await accountStateMachine.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeAccountState',
                    nft_address: nftAccount1,
                    new_state: STATE_FROZEN,
                }
            );

            const accountState = await accountStateMachine.getAccountState(nftAccount1);
            expect(accountState.balance_tbc).toBe(depositAmount);
            expect(accountState.state).toBe(STATE_FROZEN);
        });
    });
});
