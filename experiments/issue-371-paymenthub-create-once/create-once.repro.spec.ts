/**
 * Issue #371 / PC-02 — minimal reproduction of the InitializeAccount overwrite
 * vulnerability in PaymentHub.tact.
 *
 * VULNERABLE contract: `receive(msg: InitializeAccount)` only checked
 * `sender() == self.admin` and then unconditionally wrote `balance`/`owner` for
 * the target slot. A malicious or compromised admin could therefore
 * re-initialize an already-funded account, reassign `owner` to an
 * attacker-controlled address, and drain it via `TransferInternalRequest`
 * (which authorizes on `sender() == from_account.owner`). That breaks
 * invariant I1 (Non-Custodial) and I3 (No Admin Control over user funds).
 *
 * FIXED contract: account creation is write-once —
 *   require(self.accounts.get(msg.nft_address) == null, "Account already initialized");
 * and the read path (`getAccountOrDefault`) no longer persists a placeholder
 * slot, so a free query cannot squat an address and block its first init.
 *
 * | Contract state          | tests 1 & 2 (overwrite/drain) | tests 3 & 4 (lifecycle) |
 * | ----------------------- | ----------------------------- | ----------------------- |
 * | Before the fix          | FAIL (re-init succeeds)        | pass                    |
 * | Naive guard only        | pass                          | test 4 FAILS (query DoS)|
 * | After the full fix      | pass                          | pass                    |
 *
 * See README.md in this folder for how to run it against each state. The
 * CI-enforced regression lock for this `contracts/payments/` source lives in
 * contracts/payment-hub/non-production-stubs.spec.ts (a grep gate); this file is
 * the standalone behavioural reproduction kept under ./experiments.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { toNano, Address } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
// Wrapper produced by `npm run build` (tact --config tact.config.json), which
// compiles ../../contracts/payments/PaymentHub.tact into ./dist.
import { PaymentHub } from './dist/PaymentHub_PaymentHub';

const ACTIVE = 0n; // ACCOUNT_STATE_ACTIVE
// Enough gas for InitializeAccount to complete; the same value is used for the
// positive-control first init in test 3, proving a rejected re-init in tests 1
// and 2 is the create-once guard firing, not an out-of-gas abort. (The Tact
// hash exit code for "Account already initialized" is 18265.)
const GAS = toNano('0.05');

describe('PC-02 reproduction: PaymentHub.InitializeAccount must be create-once', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>; // deployer == hub admin
    let ownerX: SandboxContract<TreasuryContract>; // legitimate account owner
    let attackerY: SandboxContract<TreasuryContract>; // address the admin would hand the account to
    let hub: SandboxContract<PaymentHub>;
    let nftAccount: Address; // the funded account under attack
    let nftFresh: Address; // a never-initialized account

    const initAccount = (nft: Address, owner: Address, balance: bigint, state: bigint = ACTIVE) =>
        hub.send(
            admin.getSender(),
            { value: GAS },
            {
                $$type: 'InitializeAccount',
                nft_address: nft,
                owner,
                initial_balance: balance,
                initial_state: state,
            }
        );

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        ownerX = await blockchain.treasury('ownerX');
        attackerY = await blockchain.treasury('attackerY');

        // Deterministic sandbox addresses standing in for NFT item contracts.
        nftAccount = (await blockchain.treasury('nftAccount')).address;
        nftFresh = (await blockchain.treasury('nftFresh')).address;

        hub = blockchain.openContract(await PaymentHub.fromInit(admin.address));
        await hub.send(admin.getSender(), { value: GAS }, { $$type: 'Deploy', queryId: 0n });
    });

    it('rejects a second InitializeAccount for an already-initialized account', async () => {
        // Admin sets up account X with a real balance.
        await initAccount(nftAccount, ownerX.address, toNano('1000'));
        expect(await hub.getGetOwner(nftAccount)).toEqualAddress(ownerX.address);
        expect(await hub.getGetBalance(nftAccount)).toEqual(toNano('1000'));

        // Admin attempts to re-initialize the SAME account, handing ownership to Y
        // and zeroing the books. The write-once guard must reject this.
        const reinit = await initAccount(nftAccount, attackerY.address, 0n);
        expect(reinit.transactions).toHaveTransaction({
            from: admin.address,
            to: hub.address,
            success: false, // reverts with "Account already initialized"
        });

        // The original owner and balance are untouched.
        expect(await hub.getGetOwner(nftAccount)).toEqualAddress(ownerX.address);
        expect(await hub.getGetBalance(nftAccount)).toEqual(toNano('1000'));
    });

    it('prevents an admin from hijacking a funded account to drain it (I1/I3)', async () => {
        // X owns a funded account.
        await initAccount(nftAccount, ownerX.address, toNano('1000'));

        // Compromised admin tries to seize the account by re-initializing it to Y.
        const hijack = await initAccount(nftAccount, attackerY.address, toNano('1000'));
        expect(hijack.transactions).toHaveTransaction({
            from: admin.address,
            to: hub.address,
            success: false,
        });

        // Because ownership never moved, Y cannot move X's funds: a transfer signed
        // by Y from the account is rejected (sender is not the NFT owner).
        const drain = await hub.send(
            attackerY.getSender(),
            { value: GAS },
            {
                $$type: 'TransferInternalRequest',
                from_nft: nftAccount,
                to_nft: nftAccount,
                amount_tbc: toNano('1000'),
                payload: null,
            }
        );
        expect(drain.transactions).toHaveTransaction({
            from: attackerY.address,
            to: hub.address,
            success: false,
        });

        // X still owns the full balance.
        expect(await hub.getGetOwner(nftAccount)).toEqualAddress(ownerX.address);
        expect(await hub.getGetBalance(nftAccount)).toEqual(toNano('1000'));
    });

    it('still allows the first (one-time) initialization of a fresh account', async () => {
        // Positive control: a brand-new account initializes once, with the same gas
        // budget that the rejected re-inits used above.
        const result = await initAccount(nftFresh, ownerX.address, toNano('250'));
        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: hub.address,
            success: true,
        });
        expect(await hub.getGetOwner(nftFresh)).toEqualAddress(ownerX.address);
        expect(await hub.getGetBalance(nftFresh)).toEqual(toNano('250'));
    });

    it('does not let a read-only query squat a slot and block a later first init', async () => {
        // Anyone can query account state for a not-yet-initialized NFT. On the
        // vulnerable read path this persisted a placeholder slot; combined with the
        // create-once guard that would permanently block the legitimate first init
        // (a denial-of-service). The fixed read path must NOT persist anything.
        await hub.send(
            attackerY.getSender(),
            { value: GAS },
            { $$type: 'GetAccountStateRequest', nft_address: nftFresh }
        );

        // The legitimate first initialization must still succeed and bind the real
        // owner (not the placeholder NFT address).
        const result = await initAccount(nftFresh, ownerX.address, toNano('700'));
        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: hub.address,
            success: true,
        });
        expect(await hub.getGetOwner(nftFresh)).toEqualAddress(ownerX.address);
        expect(await hub.getGetBalance(nftFresh)).toEqual(toNano('700'));
    });
});
