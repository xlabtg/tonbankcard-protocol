/**
 * INVARIANT I7 — Lock Enforcement & External Adapter Isolation
 *                (property-based tests).
 *
 * Formal predicate (lock enforcement half — the "must-have" half called out
 * in the issue as the highest-risk invariant to prove mechanically):
 *
 *   ∀ account A with fraud_locked(A) ∨ collateral_locked(A):
 *     ∀ amount X > 0, ∀ destination B:
 *       transfer(owner(A), A, B, X).status = REVERTED
 *       AND balance(A)_after = balance(A)_before
 *       AND balance(B)_after = balance(B)_before
 *
 * Formal predicate (adapter isolation half):
 *
 *   ∀ caller C with role ∈ {external_adapter, risk_authority, lending_adapter}:
 *     ∀ transfer parameters: transfer(C, …).status = REVERTED
 *
 * This file is the **minimum deliverable** for I7 named in the issue.
 */

import * as fc from 'fast-check';
import {
    ProtocolModel,
    AccountState,
    Caller,
} from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    EXTERNAL_ADAPTER,
    NFT_POOL,
    USER_POOL,
    amountArb,
} from './arbitraries';
import {
    ADMIN_CALLER,
    LENDING_ADAPTER_CALLER,
    RISK_AUTHORITY_CALLER,
    asUser,
    snapshotBalances,
} from './helpers';

describe('I7 — Lock Enforcement (property)', () => {
    it('a locked account cannot initiate sends under any amount', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 1n, max: 1_000_000n }),
                amountArb,
                fc.constantFrom<'fraud' | 'collateral' | 'both'>(
                    'fraud',
                    'collateral',
                    'both',
                ),
                (
                    fromNft,
                    toNft,
                    fromOwner,
                    toOwner,
                    balance,
                    amount,
                    lockKind,
                ) => {
                    fc.pre(fromNft !== toNft);
                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: fromNft,
                        owner: fromOwner,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: toNft,
                        owner: toOwner,
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    if (lockKind === 'fraud' || lockKind === 'both') {
                        model.setFraudLock(
                            RISK_AUTHORITY_CALLER,
                            fromNft,
                            true,
                        );
                    }
                    if (lockKind === 'collateral' || lockKind === 'both') {
                        model.setCollateralLock(
                            LENDING_ADAPTER_CALLER,
                            fromNft,
                            true,
                        );
                    }

                    const before = snapshotBalances(model);
                    const res = model.transfer(
                        asUser(fromOwner),
                        fromNft,
                        toNft,
                        amount,
                    );
                    expect(res.status).toBe('REVERTED');
                    expect(snapshotBalances(model)).toEqual(before);
                },
            ),
            { numRuns: 300 },
        );
    });

    it('clearing the lock immediately restores the ability to send', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 1n, max: 1_000n }),
                fc.bigInt({ min: 1n, max: 1_000n }),
                (fromNft, toNft, fromOwner, toOwner, balance, amount) => {
                    fc.pre(fromNft !== toNft);
                    fc.pre(amount <= balance);
                    fc.pre(fromOwner !== toOwner);

                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: fromNft,
                        owner: fromOwner,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: toNft,
                        owner: toOwner,
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    model.setFraudLock(RISK_AUTHORITY_CALLER, fromNft, true);
                    expect(
                        model.transfer(
                            asUser(fromOwner),
                            fromNft,
                            toNft,
                            amount,
                        ).status,
                    ).toBe('REVERTED');

                    model.setFraudLock(RISK_AUTHORITY_CALLER, fromNft, false);
                    expect(
                        model.transfer(
                            asUser(fromOwner),
                            fromNft,
                            toNft,
                            amount,
                        ).status,
                    ).toBe('SUCCESS');
                    expect(model.balanceOf(fromNft)).toBe(balance - amount);
                    expect(model.balanceOf(toNft)).toBe(amount);
                },
            ),
            { numRuns: 100 },
        );
    });
});

describe('I7 — External Adapter Isolation (property)', () => {
    it('no external/privileged role can initiate a fund transfer', () => {
        const adapters: readonly Caller[] = [
            { address: EXTERNAL_ADAPTER, role: 'external_adapter' },
            { address: RISK_AUTHORITY, role: 'risk_authority' },
            { address: LENDING_ADAPTER, role: 'lending_adapter' },
            { address: ADMIN, role: 'admin' },
        ];
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 0n, max: 1_000_000n }),
                amountArb,
                fc.integer({ min: 0, max: adapters.length - 1 }),
                (
                    fromNft,
                    toNft,
                    fromOwner,
                    toOwner,
                    balance,
                    amount,
                    adapterIdx,
                ) => {
                    fc.pre(fromNft !== toNft);
                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: fromNft,
                        owner: fromOwner,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: toNft,
                        owner: toOwner,
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    const before = snapshotBalances(model);
                    const res = model.transfer(
                        adapters[adapterIdx],
                        fromNft,
                        toNft,
                        amount,
                    );
                    expect(res.status).toBe('REVERTED');
                    expect(snapshotBalances(model)).toEqual(before);
                },
            ),
            { numRuns: 200 },
        );
    });
});
