/**
 * INVARIANT I4 — Atomic Transfers (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ transfer T from A to B with amount X:
 *     EITHER (status(T) = SUCCESS
 *             ∧ balance(A)_after = balance(A)_before - X
 *             ∧ balance(B)_after = balance(B)_before + X
 *             ∧ ∀ other account C: balance(C)_after = balance(C)_before)
 *     OR     (status(T) = REVERTED ∧ ∀ account C: balance(C)_after = balance(C)_before)
 *
 * This is the **minimum deliverable** named in the issue. It is exercised
 * with random callers, random amounts, random states/locks and random
 * sequences of transfers. The conservation half is shared with I5; this
 * file proves the per-transfer atomic identity.
 */

import * as fc from 'fast-check';
import { ProtocolModel, AccountState } from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    NFT_POOL,
    USER_POOL,
    amountArb,
} from './arbitraries';
import {
    ADMIN_CALLER,
    asUser,
    snapshotBalances,
} from './helpers';

describe('I4 — Atomic Transfers (property)', () => {
    it('every transfer is either fully applied or fully reverted', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                amountArb,
                amountArb,
                amountArb,
                fc.constantFrom<AccountState>(
                    AccountState.ACTIVE,
                    AccountState.FROZEN,
                    AccountState.SUSPENDED,
                    AccountState.CLOSED,
                ),
                fc.boolean(),
                fc.boolean(),
                (
                    fromNft,
                    toNft,
                    fromOwner,
                    toOwner,
                    fromBalance,
                    toBalance,
                    amount,
                    fromState,
                    fraud,
                    collateral,
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
                        balance: fromBalance,
                        state: fromState,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: toNft,
                        owner: toOwner,
                        balance: toBalance,
                        state: AccountState.ACTIVE,
                    });

                    if (fraud) {
                        model.setFraudLock(
                            { address: RISK_AUTHORITY, role: 'risk_authority' },
                            fromNft,
                            true,
                        );
                    }
                    if (collateral) {
                        model.setCollateralLock(
                            {
                                address: LENDING_ADAPTER,
                                role: 'lending_adapter',
                            },
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
                    const after = snapshotBalances(model);

                    if (res.status === 'SUCCESS') {
                        // The transfer must have moved exactly `amount` from
                        // `fromNft` to `toNft`, with all other accounts
                        // untouched.
                        expect(after.get(fromNft)).toBe(
                            (before.get(fromNft) ?? 0n) - amount,
                        );
                        expect(after.get(toNft)).toBe(
                            (before.get(toNft) ?? 0n) + amount,
                        );
                        for (const [nft, balance] of before) {
                            if (nft === fromNft || nft === toNft) continue;
                            expect(after.get(nft)).toBe(balance);
                        }
                    } else {
                        // REVERTED — nothing must have moved.
                        expect(after).toEqual(before);
                    }
                },
            ),
            { numRuns: 300 },
        );
    });

    it('a sequence of transfers preserves atomicity per step', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        fromNft: fc.constantFrom(...NFT_POOL),
                        toNft: fc.constantFrom(...NFT_POOL),
                        caller: fc.constantFrom(...USER_POOL),
                        amount: fc.bigInt({ min: 0n, max: 5_000n }),
                    }),
                    { minLength: 1, maxLength: 20 },
                ),
                fc.array(
                    fc.record({
                        nft: fc.constantFrom(...NFT_POOL),
                        owner: fc.constantFrom(...USER_POOL),
                        balance: fc.bigInt({ min: 0n, max: 10_000n }),
                    }),
                    { minLength: 1, maxLength: NFT_POOL.length },
                ),
                (steps, initSpecs) => {
                    const model = new ProtocolModel({ admin: ADMIN });
                    for (const spec of initSpecs) {
                        model.initializeAccount(ADMIN_CALLER, {
                            nft: spec.nft,
                            owner: spec.owner,
                            balance: spec.balance,
                            state: AccountState.ACTIVE,
                        });
                    }
                    for (const step of steps) {
                        const before = snapshotBalances(model);
                        const beforeSum = model.totalSupply();
                        const res = model.transfer(
                            asUser(step.caller),
                            step.fromNft,
                            step.toNft,
                            step.amount,
                        );
                        const after = snapshotBalances(model);
                        const afterSum = model.totalSupply();
                        // Conservation across every step (links into I5).
                        expect(afterSum).toBe(beforeSum);
                        if (res.status === 'REVERTED') {
                            expect(after).toEqual(before);
                        }
                    }
                },
            ),
            { numRuns: 100 },
        );
    });

    it('reentrant transfers are rejected', () => {
        // Direct simulation: flip the internal flag and verify the model
        // surfaces REVERTED with no state change. This guards the property
        // even when fast-check cannot construct a reentrant call directly,
        // because the model is single-threaded.
        const model = new ProtocolModel({ admin: ADMIN });
        model.initializeAccount(ADMIN_CALLER, {
            nft: NFT_POOL[0],
            owner: USER_POOL[0],
            balance: 1_000n,
            state: AccountState.ACTIVE,
        });
        model.initializeAccount(ADMIN_CALLER, {
            nft: NFT_POOL[1],
            owner: USER_POOL[1],
            balance: 0n,
            state: AccountState.ACTIVE,
        });

        // Reach into the model to simulate a nested call.
        (model as unknown as { _reentrancyLocked: boolean })._reentrancyLocked =
            true;
        const before = snapshotBalances(model);
        const res = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('REENTRANCY');
        expect(snapshotBalances(model)).toEqual(before);
    });
});
