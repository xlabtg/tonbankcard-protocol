/**
 * INVARIANT I6 — Lock ≠ Confiscation (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ account A, ∀ lock L in {fraud, collateral}:
 *     IF is_locked(A, L) THEN
 *       balance(A)_after_lock = balance(A)_before_lock
 *       AND owner(A)_after_lock = owner(A)_before_lock
 *       AND can_receive(A) = TRUE
 *       AND ∃ authority R with role_for(L): R can clear L
 *
 * The property test alternates lock / unlock cycles and asserts the balance
 * and ownership remain unchanged at every step.
 */

import * as fc from 'fast-check';
import { ProtocolModel, AccountState } from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    NFT_POOL,
    USER_POOL,
} from './arbitraries';
import {
    ADMIN_CALLER,
    LENDING_ADAPTER_CALLER,
    RISK_AUTHORITY_CALLER,
    asUser,
} from './helpers';

describe('I6 — Lock ≠ Confiscation (property)', () => {
    it('locking and unlocking never changes balance or ownership', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 0n, max: 1_000_000n }),
                fc.array(
                    fc.tuple(
                        fc.constantFrom<'fraud' | 'collateral'>(
                            'fraud',
                            'collateral',
                        ),
                        fc.boolean(),
                    ),
                    { minLength: 1, maxLength: 20 },
                ),
                (nft, owner, balance, lockOps) => {
                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft,
                        owner,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    for (const [kind, value] of lockOps) {
                        if (kind === 'fraud') {
                            model.setFraudLock(
                                RISK_AUTHORITY_CALLER,
                                nft,
                                value,
                            );
                        } else {
                            model.setCollateralLock(
                                LENDING_ADAPTER_CALLER,
                                nft,
                                value,
                            );
                        }
                        // Balance and ownership are invariant under locks.
                        expect(model.balanceOf(nft)).toBe(balance);
                        expect(model.getAccount(nft)?.owner).toBe(owner);
                    }
                },
            ),
            { numRuns: 200 },
        );
    });

    it('a locked account can still receive funds', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 1n, max: 100_000n }),
                fc.bigInt({ min: 1n, max: 1_000n }),
                fc.boolean(),
                fc.boolean(),
                (
                    senderNft,
                    receiverNft,
                    senderOwner,
                    receiverOwner,
                    senderBalance,
                    amount,
                    fraudLock,
                    collateralLock,
                ) => {
                    fc.pre(senderNft !== receiverNft);
                    fc.pre(senderOwner !== receiverOwner);
                    fc.pre(amount <= senderBalance);
                    const model = new ProtocolModel({
                        admin: ADMIN,
                        riskAuthority: RISK_AUTHORITY,
                        lendingAdapter: LENDING_ADAPTER,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: senderNft,
                        owner: senderOwner,
                        balance: senderBalance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: receiverNft,
                        owner: receiverOwner,
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    if (fraudLock) {
                        model.setFraudLock(
                            RISK_AUTHORITY_CALLER,
                            receiverNft,
                            true,
                        );
                    }
                    if (collateralLock) {
                        model.setCollateralLock(
                            LENDING_ADAPTER_CALLER,
                            receiverNft,
                            true,
                        );
                    }

                    const res = model.transfer(
                        asUser(senderOwner),
                        senderNft,
                        receiverNft,
                        amount,
                    );
                    expect(res.status).toBe('SUCCESS');
                    expect(model.balanceOf(receiverNft)).toBe(amount);
                },
            ),
            { numRuns: 200 },
        );
    });
});
