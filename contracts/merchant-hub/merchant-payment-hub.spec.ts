/**
 * MerchantPaymentHub — production-hardening regression tests (Issue #363).
 *
 * Issue #363 removed the test-only admin bootstrap handlers
 * (`SetAccountState` / `SetAccountBalance` / `SetAccountLock`) from the deployable
 * production contract, because they were an admin-mint / admin-register backdoor
 * (audit findings C-MPH-C1 / C-MPH-H1) that violated protocol invariants I3
 * (No Admin Fund Control) and I6 (Lock != Confiscation).
 *
 * To keep the production payment logic fully testable WITHOUT shipping those
 * handlers, all logic now lives in the `MerchantPaymentHubBase` trait. The
 * deployable `MerchantPaymentHub` contract adds nothing but storage + init, while
 * a NON-deployable test harness (`MerchantPaymentHubHarness`) reuses the exact same
 * compiled trait and re-adds the bootstrap handlers FOR TESTS ONLY. These tests run
 * against the harness, so they exercise the real production trait logic.
 *
 * Coverage:
 *   (1) Bootstrap (SetAccountState / SetAccountBalance) is admin-gated.
 *   (2) A valid merchant payment debits payer and credits merchant atomically.
 *   (3) Only the NFT owner can initiate a payment (invariant I1 / I2).
 *   (4) Account locks are applied ONLY by the dedicated Account Locks contract,
 *       never by the admin/attacker (invariant I3); a locked payer cannot send,
 *       and unlocking restores the ability (invariant I6 — funds untouched).
 *   (5) Collection whitelisting is gated behind admin + a 7-day timelock
 *       (propose -> wait -> execute), with cancel support.
 *   (6) The two-phase admin transfer (Issue #96) still works end to end.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Address, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { MerchantPaymentHubHarness } from './dist/MerchantPaymentHubHarness_MerchantPaymentHubHarness';

// Mirror of the Tact account-state constants (bigint to match generated types).
const ACCOUNT_STATE_ACTIVE = 0n;
const ACCOUNT_STATE_CLOSED = 3n;

// Mirror of MERCHANT_WHITELIST_TIMELOCK_DELAY / MERCHANT_ADMIN_TRANSFER_DELAY (7 days, seconds).
const TIMELOCK_DELAY = 7 * 24 * 60 * 60;

const GAS = toNano('0.2');

describe('MerchantPaymentHub — production hardening (Issue #363)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>; // initial admin
    let locksContract: SandboxContract<TreasuryContract>; // the dedicated Account Locks contract authority
    let nftResolver: SandboxContract<TreasuryContract>; // the trusted NFT Account Resolver authority (Issue #397)
    let tbcSettlement: SandboxContract<TreasuryContract>;
    let payerOwner: SandboxContract<TreasuryContract>;
    let merchantOwner: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let hub: SandboxContract<MerchantPaymentHubHarness>;

    // Stand-in NFT account addresses (any addresses work; the contract only keys maps by them).
    let payerNft: Address;
    let merchantNft: Address;

    async function setAccountState(
        sender: SandboxContract<TreasuryContract>,
        nft: Address,
        state: bigint,
        owner: Address,
    ) {
        return hub.send(
            sender.getSender(),
            { value: GAS },
            { $$type: 'SetAccountState', nft_address: nft, state, owner },
        );
    }

    async function setBalance(
        sender: SandboxContract<TreasuryContract>,
        nft: Address,
        balance: bigint,
    ) {
        return hub.send(
            sender.getSender(),
            { value: GAS },
            { $$type: 'SetAccountBalance', nft_address: nft, balance },
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // Pin a deterministic clock up front so timelock tests can advance it
        // relatively (sandbox forbids moving `now` backwards past an executed tx).
        blockchain.now = 1_700_000_000;
        deployer = await blockchain.treasury('deployer');
        locksContract = await blockchain.treasury('locksContract');
        nftResolver = await blockchain.treasury('nftResolver');
        tbcSettlement = await blockchain.treasury('tbcSettlement');
        payerOwner = await blockchain.treasury('payerOwner');
        merchantOwner = await blockchain.treasury('merchantOwner');
        attacker = await blockchain.treasury('attacker');

        payerNft = (await blockchain.treasury('payerNft')).address;
        merchantNft = (await blockchain.treasury('merchantNft')).address;

        // Deploy: admin = deployer, account_locks_contract = locksContract,
        // nft_resolver = nftResolver (all immutable). These harness tests seed state
        // via the test-only SetAccountState/SetAccountBalance handlers; the deployable
        // resolver-gated registration path (ResolveNFTOwner) is covered end-to-end in
        // merchant-payment-hub-deployable.spec.ts (Issue #397).
        hub = blockchain.openContract(
            await MerchantPaymentHubHarness.fromInit(
                deployer.address,
                locksContract.address,
                nftResolver.address,
                tbcSettlement.address,
            ),
        );
        // First message auto-attaches the init state (no Deployable trait needed).
        await setAccountState(deployer, payerNft, ACCOUNT_STATE_ACTIVE, payerOwner.address);
        await setAccountState(deployer, merchantNft, ACCOUNT_STATE_ACTIVE, merchantOwner.address);
        await setBalance(deployer, payerNft, toNano('100'));
    });

    it('deploys with the expected admin and immutable account-locks authority', async () => {
        expect((await hub.getGetAdmin()).toString()).toBe(deployer.address.toString());
        expect((await hub.getGetAccountLocksContract()).toString()).toBe(
            locksContract.address.toString(),
        );
    });

    describe('test-only bootstrap is admin-gated', () => {
        it('lets the admin seed account state and balance', async () => {
            expect(await hub.getGetAccountState(payerNft)).toBe(ACCOUNT_STATE_ACTIVE);
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('100'));
            expect(await hub.getAccountExists(payerNft)).toBe(true);
        });

        it('rejects SetAccountState from a non-admin', async () => {
            const res = await setAccountState(
                attacker,
                payerNft,
                ACCOUNT_STATE_CLOSED,
                attacker.address,
            );
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            // State unchanged.
            expect(await hub.getGetAccountState(payerNft)).toBe(ACCOUNT_STATE_ACTIVE);
        });

        it('rejects SetAccountBalance from a non-admin (no admin-mint backdoor)', async () => {
            const res = await setBalance(attacker, payerNft, toNano('999999'));
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('100'));
        });
    });

    describe('merchant payment', () => {
        it('debits payer and credits merchant atomically when the NFT owner pays', async () => {
            await hub.send(
                payerOwner.getSender(),
                { value: GAS },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payerNft,
                    merchant_nft: merchantNft,
                    amount_tbc: toNano('30'),
                    payload: null,
                },
            );

            expect(await hub.getGetBalance(payerNft)).toBe(toNano('70'));
            expect(await hub.getGetBalance(merchantNft)).toBe(toNano('30'));
        });

        it('rejects a payment initiated by someone who is not the payer NFT owner', async () => {
            await hub.send(
                attacker.getSender(),
                { value: GAS },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payerNft,
                    merchant_nft: merchantNft,
                    amount_tbc: toNano('30'),
                    payload: null,
                },
            );

            // Balances untouched: the non-owner cannot move funds.
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('100'));
            expect(await hub.getGetBalance(merchantNft)).toBe(0n);
        });
    });

    describe('account locks (only the Account Locks contract may apply)', () => {
        it('lets the dedicated Account Locks contract apply a fraud lock', async () => {
            const res = await hub.send(
                locksContract.getSender(),
                { value: GAS },
                {
                    $$type: 'ApplyAccountLock',
                    nft_address: payerNft,
                    lock_state: { $$type: 'LockState', fraud_locked: true, collateral_locked: false },
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: locksContract.address,
                to: hub.address,
                success: true,
            });
            expect(await hub.getIsAccountLocked(payerNft)).toBe(true);
            expect(await hub.getHasFraudLock(payerNft)).toBe(true);
        });

        it('rejects ApplyAccountLock from the admin (invariant I3: admin cannot lock)', async () => {
            const res = await hub.send(
                deployer.getSender(),
                { value: GAS },
                {
                    $$type: 'ApplyAccountLock',
                    nft_address: payerNft,
                    lock_state: { $$type: 'LockState', fraud_locked: true, collateral_locked: false },
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getIsAccountLocked(payerNft)).toBe(false);
        });

        it('rejects ApplyAccountLock from an attacker', async () => {
            const res = await hub.send(
                attacker.getSender(),
                { value: GAS },
                {
                    $$type: 'ApplyAccountLock',
                    nft_address: payerNft,
                    lock_state: { $$type: 'LockState', fraud_locked: true, collateral_locked: false },
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getIsAccountLocked(payerNft)).toBe(false);
        });

        it('blocks a locked payer from sending but never moves funds (invariant I6)', async () => {
            await hub.send(
                locksContract.getSender(),
                { value: GAS },
                {
                    $$type: 'ApplyAccountLock',
                    nft_address: payerNft,
                    lock_state: { $$type: 'LockState', fraud_locked: true, collateral_locked: false },
                },
            );

            await hub.send(
                payerOwner.getSender(),
                { value: GAS },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payerNft,
                    merchant_nft: merchantNft,
                    amount_tbc: toNano('30'),
                    payload: null,
                },
            );
            // Locked: balances untouched.
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('100'));
            expect(await hub.getGetBalance(merchantNft)).toBe(0n);

            // Unlock and confirm the payer can send again (funds were never confiscated).
            await hub.send(
                locksContract.getSender(),
                { value: GAS },
                {
                    $$type: 'ApplyAccountLock',
                    nft_address: payerNft,
                    lock_state: { $$type: 'LockState', fraud_locked: false, collateral_locked: false },
                },
            );
            expect(await hub.getIsAccountLocked(payerNft)).toBe(false);

            await hub.send(
                payerOwner.getSender(),
                { value: GAS },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payerNft,
                    merchant_nft: merchantNft,
                    amount_tbc: toNano('30'),
                    payload: null,
                },
            );
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('70'));
            expect(await hub.getGetBalance(merchantNft)).toBe(toNano('30'));
        });
    });

    describe('collection whitelisting (admin + 7-day timelock)', () => {
        let collection: Address;

        beforeEach(async () => {
            collection = (await blockchain.treasury('collection')).address;
        });

        it('rejects ProposeWhitelistCollection from a non-admin', async () => {
            const res = await hub.send(
                attacker.getSender(),
                { value: GAS },
                { $$type: 'ProposeWhitelistCollection', collection_address: collection },
            );
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getIsCollectionWhitelisted(collection)).toBe(false);
        });

        it('does NOT whitelist until the timelock expires, then executes', async () => {
            await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'ProposeWhitelistCollection', collection_address: collection },
            );
            const pending = await hub.getGetPendingWhitelistCollection();
            expect(pending?.toString()).toBe(collection.toString());
            // Not whitelisted yet.
            expect(await hub.getIsCollectionWhitelisted(collection)).toBe(false);

            // Execute before the timelock expires -> rejected.
            const tooEarly = await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'ExecuteWhitelistCollection' },
            );
            expect(tooEarly.transactions).toHaveTransaction({
                from: deployer.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getIsCollectionWhitelisted(collection)).toBe(false);

            // Advance past the 7-day timelock and execute -> whitelisted.
            blockchain.now! += TIMELOCK_DELAY + 1;
            const res = await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'ExecuteWhitelistCollection' },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: hub.address,
                success: true,
            });
            expect(await hub.getIsCollectionWhitelisted(collection)).toBe(true);
            expect(await hub.getGetPendingWhitelistCollection()).toBeNull();
        });

        it('lets the admin cancel a pending whitelist proposal', async () => {
            await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'ProposeWhitelistCollection', collection_address: collection },
            );
            await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'CancelWhitelistCollection' },
            );
            expect(await hub.getGetPendingWhitelistCollection()).toBeNull();

            // After cancel, execute must fail (nothing pending).
            blockchain.now! += TIMELOCK_DELAY + 1;
            const res = await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'ExecuteWhitelistCollection' },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getIsCollectionWhitelisted(collection)).toBe(false);
        });
    });

    describe('two-phase admin transfer (Issue #96)', () => {
        it('transfers admin only after the timelock and only to the proposed admin', async () => {
            const newAdmin = await blockchain.treasury('newAdmin');

            await hub.send(
                deployer.getSender(),
                { value: GAS },
                { $$type: 'MerchantProposeAdminTransfer', new_admin: newAdmin.address },
            );
            expect((await hub.getGetPendingAdmin())?.toString()).toBe(newAdmin.address.toString());

            // Execute before timelock -> rejected.
            const tooEarly = await hub.send(
                newAdmin.getSender(),
                { value: GAS },
                { $$type: 'MerchantExecuteAdminTransfer' },
            );
            expect(tooEarly.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: hub.address,
                success: false,
            });
            expect((await hub.getGetAdmin()).toString()).toBe(deployer.address.toString());

            // Advance past the timelock and execute from the proposed admin -> success.
            blockchain.now! += TIMELOCK_DELAY + 1;
            const res = await hub.send(
                newAdmin.getSender(),
                { value: GAS },
                { $$type: 'MerchantExecuteAdminTransfer' },
            );
            expect(res.transactions).toHaveTransaction({
                from: newAdmin.address,
                to: hub.address,
                success: true,
            });
            expect((await hub.getGetAdmin()).toString()).toBe(newAdmin.address.toString());
            expect(await hub.getGetPendingAdmin()).toBeNull();
        });
    });
});
