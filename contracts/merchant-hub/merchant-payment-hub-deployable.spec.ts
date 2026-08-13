/**
 * MerchantPaymentHub — DEPLOYABLE-contract regression tests (Issue #397).
 *
 * Issue #363 removed the test-only admin bootstrap handlers
 * (`SetAccountState` / `SetAccountBalance` / `SetAccountLock`) from the deployable
 * production contract and documented that "Account registration (nft_owners /
 * account_states) is performed by the NFT Account Resolver integration". That
 * replacement handler was never implemented (audit finding CHECK393-M1), so a
 * freshly deployed `MerchantPaymentHub` had permanently empty `nft_owners` /
 * `account_states` maps and EVERY `MerchantPaymentRequest` short-circuited to
 * `ERROR_PAYER_NOT_EXISTS` (7) / `ERROR_MERCHANT_NOT_EXISTS` (8). The contract was
 * non-functional for its primary purpose.
 *
 * These tests run against the REAL deployable `MerchantPaymentHub` (NOT the test
 * harness), so they prove the production artefact itself is functional:
 *   (1) Reproduction: a fresh deployable contract rejects every payment because
 *       nothing can populate `nft_owners` (`ERROR_PAYER_NOT_EXISTS`).
 *   (2) Fix: the trusted NFT Account Resolver registers payer + merchant via the
 *       new resolver-gated, write-once `ResolveNFTOwner` handler, after which a
 *       full payment succeeds end-to-end (balances move) on the deployable
 *       contract. Funding the payer mirrors the external on-chain TBC settlement
 *       flow and is injected here via a sandbox storage fixture.
 *   (3) Access control (invariant I3): the deployer / an attacker cannot register
 *       ownership — only `nft_resolver` can.
 *   (4) Write-once binding: an NFT cannot be silently re-pointed to a new owner.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import {
    MerchantPaymentHub,
    storeMerchantPaymentResponse,
} from './dist/MerchantPaymentHub_MerchantPaymentHub';

// Mirror of the Tact account-state constants (bigint to match generated types).
const ACCOUNT_STATE_ACTIVE = 0n;

// Mirror of the MerchantPaymentHub error codes.
const ERROR_NONE = 0n;
const ERROR_NOT_OWNER = 1n;
const ERROR_PAYER_NOT_EXISTS = 7n;

const GAS = toNano('0.2');

// Build the exact MerchantPaymentResponse body the hub replies with, so tests can
// assert on the concrete error code carried back to the sender.
function paymentResponse(success: boolean, errorCode: bigint): Cell {
    return beginCell()
        .store(storeMerchantPaymentResponse({ $$type: 'MerchantPaymentResponse', success, error_code: errorCode }))
        .endCell();
}

describe('MerchantPaymentHub — deployable production contract (Issue #397)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>; // initial admin
    let locksContract: SandboxContract<TreasuryContract>; // dedicated Account Locks authority
    let nftResolver: SandboxContract<TreasuryContract>; // trusted NFT Account Resolver
    let tbcSettlement: SandboxContract<TreasuryContract>; // trusted TBC settlement authority
    let payerOwner: SandboxContract<TreasuryContract>;
    let merchantOwner: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let hub: SandboxContract<MerchantPaymentHub>;

    // Stand-in NFT account addresses (any addresses work; the contract only keys maps by them).
    let payerNft: Address;
    let merchantNft: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
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

        // Deploy the REAL production contract (no test harness). All three init
        // dependencies are immutable: admin = deployer, account_locks_contract =
        // locksContract, nft_resolver = nftResolver (the trusted NFT Account Resolver
        // — the ONLY authority allowed to register ownership; invariant I3).
        hub = blockchain.openContract(
            await MerchantPaymentHub.fromInit(
                deployer.address,
                locksContract.address,
                nftResolver.address,
                tbcSettlement.address,
            ),
        );
    });

    // The trusted resolver registers an NFT → owner binding (and marks it ACTIVE) via
    // the production `ResolveNFTOwner` handler. `from` defaults to the legitimate
    // resolver; pass another treasury to exercise the access-control guard (I3).
    async function resolveOwner(
        nft: Address,
        owner: Address,
        from: SandboxContract<TreasuryContract> = nftResolver,
    ) {
        return hub.send(
            from.getSender(),
            { value: GAS },
            { $$type: 'ResolveNFTOwner', nft_address: nft, owner },
        );
    }

    async function deposit(
        depositId: bigint,
        nft: Address,
        amount: bigint,
        from: SandboxContract<TreasuryContract> = tbcSettlement,
    ) {
        return hub.send(
            from.getSender(),
            { value: GAS },
            {
                $$type: 'TBCDeposit',
                deposit_id: depositId,
                nft_address: nft,
                amount_tbc: amount,
            },
        );
    }

    // Send a MerchantPaymentRequest from `from` on behalf of `payer` → `merchant`.
    async function pay(
        from: SandboxContract<TreasuryContract>,
        payer: Address,
        merchant: Address,
        amount: bigint,
    ) {
        return hub.send(
            from.getSender(),
            { value: GAS },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer,
                merchant_nft: merchant,
                amount_tbc: amount,
                payload: null,
            },
        );
    }

    // ========================================================================
    // (1) Reproduction of Issue #397 — fresh deployable contract is non-functional
    // ========================================================================
    describe('reproduction: a freshly deployed hub rejects every payment', () => {
        it('replies ERROR_PAYER_NOT_EXISTS because nft_owners is empty', async () => {
            const res = await hub.send(
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

            // The hub processes the request but reports the payer does not exist.
            expect(res.transactions).toHaveTransaction({
                from: hub.address,
                to: payerOwner.address,
                body: paymentResponse(false, ERROR_PAYER_NOT_EXISTS),
            });

            // No funds moved: the deployable contract cannot settle any payment.
            expect(await hub.getGetBalance(payerNft)).toBe(0n);
            expect(await hub.getGetBalance(merchantNft)).toBe(0n);
            expect(await hub.getAccountExists(payerNft)).toBe(false);
        });
    });

    // ========================================================================
    // (2) Fix — the NFT Account Resolver registration makes the contract usable
    // ========================================================================
    describe('fix: NFT Account Resolver registration makes the deployable contract functional', () => {
        beforeEach(async () => {
            // The trusted resolver binds payer + merchant NFTs to their owners (ACTIVE).
            // This first message also deploys the contract (state-init is attached).
            await resolveOwner(payerNft, payerOwner.address);
            await resolveOwner(merchantNft, merchantOwner.address);
            await deposit(1n, payerNft, toNano('100'));
        });

        it('populates nft_owners + account_states on the deployable contract', async () => {
            expect(await hub.getAccountExists(payerNft)).toBe(true);
            expect(await hub.getAccountExists(merchantNft)).toBe(true);
            expect(await hub.getGetAccountState(payerNft)).toBe(ACCOUNT_STATE_ACTIVE);
            expect(await hub.getGetAccountState(merchantNft)).toBe(ACCOUNT_STATE_ACTIVE);
        });

        it('exposes the immutable nft_resolver authority via a getter', async () => {
            expect((await hub.getGetNftResolver()).toString()).toBe(
                nftResolver.address.toString(),
            );
        });

        it('settles a full payment end-to-end: debits payer, credits merchant', async () => {
            const res = await pay(payerOwner, payerNft, merchantNft, toNano('30'));

            // The hub replies with a success response (error_code == ERROR_NONE).
            expect(res.transactions).toHaveTransaction({
                from: hub.address,
                to: payerOwner.address,
                body: paymentResponse(true, ERROR_NONE),
            });

            // Funds moved atomically: payer −30, merchant +30 (ledger conservation, I5).
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('70'));
            expect(await hub.getGetBalance(merchantNft)).toBe(toNano('30'));
        });
    });

    describe('production TBC funding path', () => {
        beforeEach(async () => {
            await resolveOwner(payerNft, payerOwner.address);
            await resolveOwner(merchantNft, merchantOwner.address);
        });

        it('settles fresh NFT → deposit → merchant payment', async () => {
            await deposit(1n, payerNft, toNano('100'));
            expect((await hub.getGetTbcSettlement()).toString()).toBe(
                tbcSettlement.address.toString(),
            );
            expect(await hub.getIsDepositProcessed(1n)).toBe(true);
            const res = await pay(payerOwner, payerNft, merchantNft, toNano('30'));

            expect(res.transactions).toHaveTransaction({
                from: hub.address,
                to: payerOwner.address,
                body: paymentResponse(true, ERROR_NONE),
            });
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('70'));
            expect(await hub.getGetBalance(merchantNft)).toBe(toNano('30'));
        });

        it('rejects forged deposits without changing balance', async () => {
            const res = await deposit(1n, payerNft, toNano('100'), attacker);
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getGetBalance(payerNft)).toBe(0n);
        });

        it('rejects a replayed deposit without crediting twice', async () => {
            await deposit(1n, payerNft, toNano('100'));
            const replay = await deposit(1n, payerNft, toNano('100'));
            expect(replay.transactions).toHaveTransaction({
                from: tbcSettlement.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('100'));
        });

        it('rejects zero-value deposits without consuming their id', async () => {
            const res = await deposit(2n, payerNft, 0n);
            expect(res.transactions).toHaveTransaction({
                from: tbcSettlement.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getGetBalance(payerNft)).toBe(0n);
            expect(await hub.getIsDepositProcessed(2n)).toBe(false);
        });

        it('rejects deposits to unregistered NFTs without consuming their id', async () => {
            const unknownNft = (await blockchain.treasury('unknownNft')).address;
            const res = await deposit(3n, unknownNft, toNano('100'));
            expect(res.transactions).toHaveTransaction({
                from: tbcSettlement.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getGetBalance(unknownNft)).toBe(0n);
            expect(await hub.getIsDepositProcessed(3n)).toBe(false);
        });
    });

    // ========================================================================
    // (3) Access control (invariant I3) — only the resolver may register ownership
    // ========================================================================
    describe('access control (invariant I3): only the resolver may register ownership', () => {
        beforeEach(async () => {
            // Deploy the contract via one legitimate registration so the checks below
            // run against an already-live contract.
            await resolveOwner(payerNft, payerOwner.address);
        });

        it('rejects ResolveNFTOwner from the deployer / admin', async () => {
            const res = await resolveOwner(merchantNft, attacker.address, deployer);
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: hub.address,
                success: false,
            });
            // Nothing was registered.
            expect(await hub.getAccountExists(merchantNft)).toBe(false);
        });

        it('rejects ResolveNFTOwner from an arbitrary attacker', async () => {
            const res = await resolveOwner(merchantNft, attacker.address, attacker);
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: hub.address,
                success: false,
            });
            expect(await hub.getAccountExists(merchantNft)).toBe(false);
        });
    });

    // ========================================================================
    // (4) Write-once binding — a registered NFT cannot be silently re-pointed
    // ========================================================================
    describe('write-once binding: a registered NFT cannot be silently re-pointed', () => {
        beforeEach(async () => {
            await resolveOwner(payerNft, payerOwner.address);
            await resolveOwner(merchantNft, merchantOwner.address);
            await deposit(1n, payerNft, toNano('100'));
        });

        it('rejects a second ResolveNFTOwner for the same NFT (even from the resolver)', async () => {
            const res = await resolveOwner(payerNft, attacker.address); // resolver re-point attempt
            expect(res.transactions).toHaveTransaction({
                from: nftResolver.address,
                to: hub.address,
                success: false,
            });
        });

        it('keeps the original owner binding after a rejected re-registration', async () => {
            await resolveOwner(payerNft, attacker.address); // rejected, must be a no-op

            // The attacker (the claimed "new owner") still cannot spend the payer NFT...
            const usurp = await pay(attacker, payerNft, merchantNft, toNano('30'));
            expect(usurp.transactions).toHaveTransaction({
                from: hub.address,
                to: attacker.address,
                body: paymentResponse(false, ERROR_NOT_OWNER),
            });

            // ...and the original owner still can: the binding is unchanged.
            const legit = await pay(payerOwner, payerNft, merchantNft, toNano('30'));
            expect(legit.transactions).toHaveTransaction({
                from: hub.address,
                to: payerOwner.address,
                body: paymentResponse(true, ERROR_NONE),
            });
            expect(await hub.getGetBalance(payerNft)).toBe(toNano('70'));
            expect(await hub.getGetBalance(merchantNft)).toBe(toNano('30'));
        });
    });
});
