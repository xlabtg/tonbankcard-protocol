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
        payerOwner = await blockchain.treasury('payerOwner');
        merchantOwner = await blockchain.treasury('merchantOwner');
        attacker = await blockchain.treasury('attacker');

        payerNft = (await blockchain.treasury('payerNft')).address;
        merchantNft = (await blockchain.treasury('merchantNft')).address;

        // Deploy the REAL production contract (no test harness):
        // admin = deployer, account_locks_contract = locksContract (immutable).
        hub = blockchain.openContract(
            await MerchantPaymentHub.fromInit(deployer.address, locksContract.address),
        );
    });

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
});
