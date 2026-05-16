/**
 * INVARIANT I3 — No Admin Fund Control (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ admin operation O issued by any privileged role R
 *     in {admin, risk_authority, lending_adapter}:
 *       ∀ NFT n:  balance(n)_after(O) = balance(n)_before(O)
 *
 * The property runs every privileged role through every legal admin-side
 * operation (setAccountState, setFraudLock, setCollateralLock) and through
 * an illegal direct transfer attempt, then asserts that no balance moved.
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
    NFT_POOL,
    USER_POOL,
    amountArb,
} from './arbitraries';
import {
    ADMIN_CALLER,
    LENDING_ADAPTER_CALLER,
    RISK_AUTHORITY_CALLER,
    snapshotBalances,
} from './helpers';

const PRIV_CALLERS: readonly Caller[] = [
    ADMIN_CALLER,
    RISK_AUTHORITY_CALLER,
    LENDING_ADAPTER_CALLER,
];

describe('I3 — No Admin Fund Control (property)', () => {
    it('privileged admin-side operations never modify balances', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                amountArb,
                amountArb,
                fc.integer({ min: 0, max: PRIV_CALLERS.length - 1 }),
                fc.boolean(),
                fc.boolean(),
                (
                    nft1,
                    nft2,
                    owner1,
                    owner2,
                    balance1,
                    balance2,
                    callerIdx,
                    fraudValue,
                    collateralValue,
                ) => {
                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: nft1,
                        owner: owner1,
                        balance: balance1,
                        state: AccountState.ACTIVE,
                    });
                    if (nft1 !== nft2) {
                        model.initializeAccount(ADMIN_CALLER, {
                            nft: nft2,
                            owner: owner2,
                            balance: balance2,
                            state: AccountState.ACTIVE,
                        });
                    }
                    const caller = PRIV_CALLERS[callerIdx];
                    const before = snapshotBalances(model);

                    // Every admin-side operation that exists in the model is
                    // exercised. None of them is permitted to change balances.
                    model.setAccountState(caller, nft1, AccountState.FROZEN);
                    model.setFraudLock(caller, nft1, fraudValue);
                    model.setCollateralLock(caller, nft1, collateralValue);

                    // A direct attempt to move funds via a privileged role
                    // must be rejected.
                    const denied = model.transfer(
                        caller,
                        nft1,
                        nft2,
                        balance1 > 0n ? 1n : 0n,
                    );
                    expect(denied.status).toBe('REVERTED');

                    expect(snapshotBalances(model)).toEqual(before);
                },
            ),
            { numRuns: 200 },
        );
    });
});
