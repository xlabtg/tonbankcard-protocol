/**
 * PaymentHub — Admin Transfer Tests (Issue #96)
 *
 * Tests for the two-phase admin transfer mechanism with 7-day timelock:
 * - Phase 1: Current admin proposes a new admin (ProposeAdminTransfer)
 * - Phase 2: Proposed admin executes after timelock expires (ExecuteAdminTransfer)
 * - Cancel: Current admin can cancel a pending proposal (CancelAdminTransfer)
 *
 * Security invariants verified:
 * - INVARIANT I3: Admin transfer does NOT move user funds
 * - Only current admin can propose a transfer
 * - Only proposed admin can execute (not current admin)
 * - Execution before timelock expiry must revert
 * - Non-admin cannot propose a transfer
 *
 * Reference: docs/invariants.md - I3, Issue #96
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentHub } from '../../wrappers/PaymentHub';
import '@ton/test-utils';

// 7-day timelock in seconds
const SEVEN_DAYS = 7 * 24 * 60 * 60;

describe('PaymentHub - Admin Transfer (Issue #96)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let newAdmin: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<PaymentHub>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        newAdmin = await blockchain.treasury('newAdmin');
        attacker = await blockchain.treasury('attacker');
        user = await blockchain.treasury('user');

        paymentHub = blockchain.openContract(
            await PaymentHub.fromInit(deployer.address)
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Setup user account with balance to verify I3 later
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: user.address,
                owner: user.address,
                initial_balance: toNano('5000'),
                initial_state: 0n, // ACTIVE
            }
        );
    });

    // =========================================================
    // Getter verification
    // =========================================================

    it('should have deployer as initial admin', async () => {
        const admin = await paymentHub.getGetAdmin();
        expect(admin.toString()).toBe(deployer.address.toString());
    });

    it('should have no pending admin transfer initially', async () => {
        const pending = await paymentHub.getGetPendingAdmin();
        expect(pending).toBeNull();
        const execAt = await paymentHub.getGetPendingAdminExecutableAt();
        expect(execAt).toBe(0n);
    });

    // =========================================================
    // Phase 1: ProposeAdminTransfer
    // =========================================================

    describe('ProposeAdminTransfer', () => {
        it('should allow current admin to propose a new admin', async () => {
            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: true,
            });

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending?.toString()).toBe(newAdmin.address.toString());

            const execAt = await paymentHub.getGetPendingAdminExecutableAt();
            expect(execAt).toBeGreaterThan(0n);
        });

        it('should reject proposal from non-admin', async () => {
            const result = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: attacker.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            // Admin should remain unchanged
            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());

            // No pending transfer should be set
            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending).toBeNull();
        });

        it('should allow admin to overwrite a pending proposal', async () => {
            const anotherAdmin = await blockchain.treasury('anotherAdmin');

            // First proposal
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );

            // Overwrite with a new proposal
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: anotherAdmin.address }
            );

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending?.toString()).toBe(anotherAdmin.address.toString());
        });
    });

    // =========================================================
    // Phase 2: ExecuteAdminTransfer
    // =========================================================

    describe('ExecuteAdminTransfer', () => {
        beforeEach(async () => {
            // Propose a transfer first
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );
        });

        it('should reject execution before timelock expires', async () => {
            // Try to execute immediately (timelock not expired)
            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: false,
            });

            // Admin should remain unchanged
            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());
        });

        it('should reject execution by current admin (not proposed admin)', async () => {
            // Advance time past 7 days
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
            });

            // Admin should remain unchanged
            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());
        });

        it('should reject execution by an unrelated address', async () => {
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });
        });

        it('should successfully transfer admin after timelock expires', async () => {
            // Advance time past 7 days
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: true,
            });

            // Admin should now be newAdmin
            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(newAdmin.address.toString());

            // Pending transfer should be cleared
            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending).toBeNull();
            const execAt = await paymentHub.getGetPendingAdminExecutableAt();
            expect(execAt).toBe(0n);
        });

        it('should reject execution when no pending transfer exists', async () => {
            // Cancel first
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'CancelAdminTransfer' }
            );

            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: false,
            });
        });
    });

    // =========================================================
    // CancelAdminTransfer
    // =========================================================

    describe('CancelAdminTransfer', () => {
        it('should allow admin to cancel a pending proposal', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );

            const cancelResult = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'CancelAdminTransfer' }
            );

            expect(cancelResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: true,
            });

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending).toBeNull();
        });

        it('should reject cancel from non-admin', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );

            const result = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.01') },
                { $$type: 'CancelAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            // Pending should remain
            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending?.toString()).toBe(newAdmin.address.toString());
        });

        it('should reject cancel when no pending transfer exists', async () => {
            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'CancelAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
            });
        });
    });

    // =========================================================
    // Post-transfer admin capabilities
    // =========================================================

    describe('New admin capabilities after transfer', () => {
        beforeEach(async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );
        });

        it('should allow new admin to whitelist a collection', async () => {
            const collection = await blockchain.treasury('collection');

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'WhitelistCollection', collection_address: collection.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: true,
            });
        });

        it('should reject old admin from whitelisting', async () => {
            const collection = await blockchain.treasury('collection2');

            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'WhitelistCollection', collection_address: collection.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
            });
        });

        it('should allow new admin to propose a further transfer', async () => {
            const thirdAdmin = await blockchain.treasury('thirdAdmin');

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: thirdAdmin.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: true,
            });
        });
    });

    // =========================================================
    // INVARIANT I3: Admin transfer does NOT move user funds
    // =========================================================

    describe('INVARIANT I3: Admin transfer does not move funds', () => {
        it('should preserve all user balances after admin transfer', async () => {
            const initialBalance = await paymentHub.getGetBalance(user.address);
            expect(initialBalance).toBe(toNano('5000'));

            // Propose and execute admin transfer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            // User balance must be unchanged
            const finalBalance = await paymentHub.getGetBalance(user.address);
            expect(finalBalance).toBe(toNano('5000'));
        });

        it('should prevent new admin from moving user funds', async () => {
            // Complete admin transfer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'ExecuteAdminTransfer' }
            );

            // New admin tries to steal user funds
            const stealAttempt = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: user.address,
                    to_nft: newAdmin.address,
                    amount_tbc: toNano('5000'),
                    payload: null,
                }
            );

            expect(stealAttempt.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: false,
            });

            // Balance must remain unchanged
            const balance = await paymentHub.getGetBalance(user.address);
            expect(balance).toBe(toNano('5000'));
        });
    });
});
