/**
 * T4 — Lock Bypass via Merchant Pay Path (R-CRIT-1 regression).
 *
 * Threat: a fraudulently-locked payer attempts to drain funds by routing the
 * transfer through the merchant payment hub instead of the direct
 * PaymentHub.transfer. Both paths must honour the lock.
 *
 * I6 — locks block outgoing transfers but never block incoming ones; a locked
 * merchant must still be able to RECEIVE funds.
 *
 * Mirrors `tests/invariants/property/I6-lock-not-confiscation.spec.ts` and
 * `tests/invariants/property/I7-lock-enforcement.spec.ts`.
 */

import { AccountState } from '../../invariants/model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    NFT_POOL,
    USER_POOL,
} from '../../invariants/property/arbitraries';
import {
    ADMIN_CALLER,
    RISK_AUTHORITY_CALLER,
    LENDING_ADAPTER_CALLER,
    asUser,
} from '../../invariants/property/helpers';
import { MerchantModel } from '../model/merchant-model';

const COLLECTION = 'merchant-collection-1';

function freshMerchantModel(): MerchantModel {
    const model = new MerchantModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    model.whitelistCollection(ADMIN_CALLER, COLLECTION);
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[0],
        owner: USER_POOL[0],
        balance: 1_000n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[1],
        owner: USER_POOL[1],
        balance: 0n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    return model;
}

describe('T4 — Lock Bypass via Merchant Pay Path', () => {
    it('fraud-locked payer cannot complete payInvoice (R-CRIT-1)', () => {
        const model = freshMerchantModel();
        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);

        const res = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-locked', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );

        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('FRAUD_LOCKED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(0n);
        expect(model.settledInvoiceCount()).toBe(0);
    });

    it('collateral-locked payer cannot complete payInvoice', () => {
        const model = freshMerchantModel();
        model.core.setCollateralLock(
            LENDING_ADAPTER_CALLER,
            NFT_POOL[0],
            true,
        );

        const res = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-collateral', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );

        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('COLLATERAL_LOCKED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
    });

    it('frozen account cannot send (state != ACTIVE)', () => {
        const model = freshMerchantModel();
        model.core.setAccountState(
            ADMIN_CALLER,
            NFT_POOL[0],
            AccountState.FROZEN,
        );

        const res = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-frozen', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );

        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('FROM_NOT_ACTIVE');
    });

    it('I6: a locked MERCHANT can still RECEIVE funds', () => {
        const model = freshMerchantModel();
        // Lock the merchant's NFT, not the payer's.
        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[1], true);

        const res = model.payInvoice(
            asUser(USER_POOL[0]),
            {
                id: 'inv-recv-locked',
                merchantNft: NFT_POOL[1],
                amount: 250n,
            },
            NFT_POOL[0],
        );

        expect(res.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[1])).toBe(250n);
        expect(model.balanceOf(NFT_POOL[0])).toBe(750n);
        // Lock remains in place after receiving.
        expect(model.core.getAccount(NFT_POOL[1])?.fraudLocked).toBe(true);
    });

    it('unlocking releases the payer and allows the same invoice id to settle', () => {
        const model = freshMerchantModel();
        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);
        const blocked = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-once', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );
        expect(blocked.status).toBe('REVERTED');
        expect(model.settledInvoiceCount()).toBe(0);

        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], false);

        // Same invoice id should now settle exactly once.
        const ok = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-once', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );
        expect(ok.status).toBe('SUCCESS');
        expect(model.settledInvoiceCount()).toBe(1);

        // And replay still rejected.
        const replay = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-once', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );
        expect(replay.status).toBe('REVERTED');
        expect(replay.error).toBe('INVOICE_ALREADY_SETTLED');
    });

    it('admin cannot move funds out of a locked account (I3)', () => {
        const model = freshMerchantModel();
        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);

        // Admin is not the owner and not allowed to call transfer.
        const adminCaller = { address: ADMIN, role: 'admin' as const };
        const res = model.core.transfer(
            adminCaller,
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('NOT_OWNER');
        expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
    });
});
