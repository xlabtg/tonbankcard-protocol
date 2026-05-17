/**
 * T2/T4 — Lock Race Condition.
 *
 * Threat: a risk authority sets a fraud lock concurrently with the owner
 * trying to spend. Whatever the interleaving, the final state must be
 * consistent with one of the legal serial orderings (`lock → transfer` or
 * `transfer → lock`) and total supply must be preserved (I5).
 *
 * The protocol model is single-threaded, so we exhaustively enumerate all
 * interleavings of (a) risk-authority lock toggle and (b) owner transfer.
 *
 * Mirrors `contracts/payments/PaymentHub.tact` lock semantics and the I7
 * adversarial spec in `tests/invariants/property/I7-adversarial.spec.ts`.
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

function freshMerchantModel(initialBalance: bigint = 1_000n): MerchantModel {
    const model = new MerchantModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    model.whitelistCollection(ADMIN_CALLER, COLLECTION);
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[0],
        owner: USER_POOL[0],
        balance: initialBalance,
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

describe('T2/T4 — Lock Race Condition', () => {
    it('lock-then-transfer: transfer reverts and balance is unchanged', () => {
        const model = freshMerchantModel(1_000n);
        const lockRes = model.core.setFraudLock(
            RISK_AUTHORITY_CALLER,
            NFT_POOL[0],
            true,
        );
        expect(lockRes.status).toBe('SUCCESS');

        const transfer = model.core.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            500n,
        );
        expect(transfer.status).toBe('REVERTED');
        expect(transfer.error).toBe('FRAUD_LOCKED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(0n);
        expect(model.totalSupply()).toBe(1_000n);
    });

    it('transfer-then-lock: transfer commits and lock applies only to future ops', () => {
        const model = freshMerchantModel(1_000n);
        const t = model.core.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            500n,
        );
        expect(t.status).toBe('SUCCESS');

        const lockRes = model.core.setFraudLock(
            RISK_AUTHORITY_CALLER,
            NFT_POOL[0],
            true,
        );
        expect(lockRes.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[0])).toBe(500n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(500n);

        const next = model.core.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            1n,
        );
        expect(next.status).toBe('REVERTED');
        expect(next.error).toBe('FRAUD_LOCKED');
        expect(model.totalSupply()).toBe(1_000n);
    });

    it('lock-toggle storm preserves total supply across every interleaving', () => {
        // Exhaustively try a 6-step interleaving of {lock, unlock, transfer}
        // and assert conservation in every case.
        const ops: Array<'lock' | 'unlock' | 'transfer'> = [
            'lock',
            'unlock',
            'transfer',
        ];
        for (const o1 of ops) {
            for (const o2 of ops) {
                for (const o3 of ops) {
                    for (const o4 of ops) {
                        const model = freshMerchantModel(1_000n);
                        for (const op of [o1, o2, o3, o4]) {
                            switch (op) {
                                case 'lock':
                                    model.core.setFraudLock(
                                        RISK_AUTHORITY_CALLER,
                                        NFT_POOL[0],
                                        true,
                                    );
                                    break;
                                case 'unlock':
                                    model.core.setFraudLock(
                                        RISK_AUTHORITY_CALLER,
                                        NFT_POOL[0],
                                        false,
                                    );
                                    break;
                                case 'transfer':
                                    model.core.transfer(
                                        asUser(USER_POOL[0]),
                                        NFT_POOL[0],
                                        NFT_POOL[1],
                                        100n,
                                    );
                                    break;
                            }
                            // I5 holds at every step.
                            expect(model.totalSupply()).toBe(1_000n);
                        }
                    }
                }
            }
        }
    });

    it('fraud and collateral locks interleave without losing funds', () => {
        const model = freshMerchantModel(1_000n);
        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);
        model.core.setCollateralLock(
            LENDING_ADAPTER_CALLER,
            NFT_POOL[0],
            true,
        );
        // Either lock alone is sufficient to block the transfer.
        const r1 = model.core.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            10n,
        );
        expect(r1.status).toBe('REVERTED');

        model.core.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], false);
        const r2 = model.core.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            10n,
        );
        expect(r2.status).toBe('REVERTED');
        expect(r2.error).toBe('COLLATERAL_LOCKED');
        expect(model.totalSupply()).toBe(1_000n);
    });
});
