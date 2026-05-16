/**
 * INVARIANT I1 — Non-Custodial Ownership (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ transfer T from account A with amount X > 0 reaching status SUCCESS:
 *     caller(T).role = 'user'  AND  caller(T).address = owner(A)
 *
 * In contrapositive form: every non-owner caller MUST observe a REVERTED
 * status with the model unchanged. The property test enumerates all five
 * caller roles (admin, risk_authority, lending_adapter, external_adapter,
 * user≠owner) together with random transfer amounts.
 */

import * as fc from 'fast-check';
import { ProtocolModel, AccountState, Caller } from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    EXTERNAL_ADAPTER,
    USER_POOL,
    NFT_POOL,
    amountArb,
} from './arbitraries';
import {
    ADMIN_CALLER,
    buildModel,
    snapshotBalances,
} from './helpers';

describe('I1 — Non-Custodial Ownership (property)', () => {
    it('no non-owner caller can debit any account', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        nft: fc.constantFrom(...NFT_POOL),
                        owner: fc.constantFrom(...USER_POOL),
                        balance: amountArb,
                    }),
                    { minLength: 2, maxLength: 4 },
                ),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                amountArb,
                fc.integer({ min: 0, max: 4 }),
                (initSpecs, fromNft, toNft, amount, callerIdx) => {
                    const model = buildModel(
                        initSpecs.map((s) => ({
                            ...s,
                            state: AccountState.ACTIVE,
                        })),
                    );
                    const from = model.getAccount(fromNft);
                    if (!from || !model.getAccount(toNft)) return;

                    // Build a non-owner caller deterministically from callerIdx.
                    const candidates: Caller[] = [
                        { address: ADMIN, role: 'admin' },
                        { address: RISK_AUTHORITY, role: 'risk_authority' },
                        { address: LENDING_ADAPTER, role: 'lending_adapter' },
                        {
                            address: EXTERNAL_ADAPTER,
                            role: 'external_adapter',
                        },
                        // a user that is provably not the owner
                        {
                            address:
                                USER_POOL.find((u) => u !== from.owner) ??
                                USER_POOL[0],
                            role: 'user',
                        },
                    ];
                    const caller = candidates[callerIdx];
                    if (
                        caller.role === 'user' &&
                        caller.address === from.owner
                    ) {
                        return; // not a non-owner; skip
                    }

                    const before = snapshotBalances(model);
                    const res = model.transfer(caller, fromNft, toNft, amount);
                    const after = snapshotBalances(model);

                    expect(res.status).toBe('REVERTED');
                    expect(after).toEqual(before);
                },
            ),
            { numRuns: 200 },
        );
    });

    it('only the current NFT owner can authorize a debit', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 1n, max: 1_000_000n }),
                fc.bigInt({ min: 1n, max: 1_000_000n }),
                (fromNft, toNft, owner, balance, amount) => {
                    fc.pre(fromNft !== toNft);
                    fc.pre(amount <= balance);
                    const model = new ProtocolModel({ admin: ADMIN });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: fromNft,
                        owner,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: toNft,
                        owner: USER_POOL[0],
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    const res = model.transfer(
                        { address: owner, role: 'user' },
                        fromNft,
                        toNft,
                        amount,
                    );
                    expect(res.status).toBe('SUCCESS');
                    expect(model.balanceOf(fromNft)).toBe(balance - amount);
                    expect(model.balanceOf(toNft)).toBe(amount);
                },
            ),
            { numRuns: 200 },
        );
    });
});
