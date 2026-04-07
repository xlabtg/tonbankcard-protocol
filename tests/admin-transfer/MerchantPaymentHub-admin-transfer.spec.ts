/**
 * MerchantPaymentHub — Admin Transfer Tests (Issue #96)
 *
 * Tests for the two-phase admin transfer mechanism with 7-day timelock:
 * - Phase 1: Current admin proposes a new admin (MerchantProposeAdminTransfer)
 * - Phase 2: Proposed admin executes after timelock expires (MerchantExecuteAdminTransfer)
 * - Cancel: Current admin can cancel a pending proposal (MerchantCancelAdminTransfer)
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
import { MerchantPaymentHub } from '../../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

// 7-day timelock in seconds
const SEVEN_DAYS = 7 * 24 * 60 * 60;

describe('MerchantPaymentHub - Admin Transfer (Issue #96)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let newAdmin: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<MerchantPaymentHub>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        newAdmin = await blockchain.treasury('newAdmin');
        attacker = await blockchain.treasury('attacker');
        user = await blockchain.treasury('user');

        paymentHub = blockchain.openContract(
            await MerchantPaymentHub.fromInit(deployer.address)
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Setup a user account with balance to verify I3 invariant
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountState',
                nft_address: user.address,
                state: 0n, // ACTIVE
                owner: user.address,
            }
        );
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountBalance',
                nft_address: user.address,
                balance: toNano('5000'),
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
    // Phase 1: MerchantProposeAdminTransfer
    // =========================================================

    describe('MerchantProposeAdminTransfer', () => {
        it('should allow current admin to propose a new admin', async () => {
            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
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
                { $$type: 'MerchantProposeAdminTransfer', new_admin: attacker.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending).toBeNull();
        });
    });

    // =========================================================
    // Phase 2: MerchantExecuteAdminTransfer
    // =========================================================

    describe('MerchantExecuteAdminTransfer', () => {
        beforeEach(async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );
        });

        it('should reject execution before timelock expires', async () => {
            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: false,
            });

            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());
        });

        it('should reject execution by current admin (not proposed admin)', async () => {
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
            });

            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(deployer.address.toString());
        });

        it('should reject execution by unrelated address', async () => {
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });
        });

        it('should successfully transfer admin after timelock expires', async () => {
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: paymentHub.address,
                success: true,
            });

            const admin = await paymentHub.getGetAdmin();
            expect(admin.toString()).toBe(newAdmin.address.toString());

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending).toBeNull();
            const execAt = await paymentHub.getGetPendingAdminExecutableAt();
            expect(execAt).toBe(0n);
        });
    });

    // =========================================================
    // MerchantCancelAdminTransfer
    // =========================================================

    describe('MerchantCancelAdminTransfer', () => {
        it('should allow admin to cancel a pending proposal', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );

            const cancelResult = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantCancelAdminTransfer' }
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
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );

            const result = await paymentHub.send(
                attacker.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantCancelAdminTransfer' }
            );

            expect(result.transactions).toHaveTransaction({
                from: attacker.address,
                to: paymentHub.address,
                success: false,
            });

            const pending = await paymentHub.getGetPendingAdmin();
            expect(pending?.toString()).toBe(newAdmin.address.toString());
        });

        it('should reject cancel when no pending transfer exists', async () => {
            const result = await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantCancelAdminTransfer' }
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
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );
        });

        it('should allow new admin to whitelist a collection', async () => {
            const collection = await blockchain.treasury('collection');

            const result = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'WhitelistMerchantCollection', collection_address: collection.address }
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
                { $$type: 'WhitelistMerchantCollection', collection_address: collection.address }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: paymentHub.address,
                success: false,
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

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            const finalBalance = await paymentHub.getGetBalance(user.address);
            expect(finalBalance).toBe(toNano('5000'));
        });

        it('should prevent new admin from directly modifying balances', async () => {
            // Complete admin transfer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address }
            );
            blockchain.now = Math.floor(Date.now() / 1000) + SEVEN_DAYS + 1;
            await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.01') },
                { $$type: 'MerchantExecuteAdminTransfer' }
            );

            // New admin is the admin, but payment still requires NFT ownership
            const stealAttempt = await paymentHub.send(
                newAdmin.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: user.address,
                    merchant_nft: newAdmin.address,
                    amount_tbc: toNano('5000'),
                    payload: null,
                }
            );

            // Transaction succeeds (returns error code in response) but balance unchanged
            const finalBalance = await paymentHub.getGetBalance(user.address);
            expect(finalBalance).toBe(toNano('5000'));
        });
    });
});
