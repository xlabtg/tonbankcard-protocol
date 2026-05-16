/**
 * INVARIANT I5 — Ledger Conservation (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ sequence of transfers S applied to model M:
 *     Σ balance(M_after(S)) = Σ balance(M_before(S))
 *
 * (mints/burns/fees are zero by construction in the model — those operations
 * do not exist in PaymentHub.tact or MerchantPaymentHub.tact).
 */

import * as fc from 'fast-check';
import {
    ProtocolModel,
    AccountState,
} from '../model/protocol-model';
import {
    ADMIN,
    NFT_POOL,
    USER_POOL,
} from './arbitraries';
import { ADMIN_CALLER, asUser } from './helpers';

describe('I5 — Ledger Conservation (property)', () => {
    it('sum of balances is preserved across any sequence of operations', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        nft: fc.constantFrom(...NFT_POOL),
                        owner: fc.constantFrom(...USER_POOL),
                        balance: fc.bigInt({ min: 0n, max: 10_000n }),
                    }),
                    { minLength: 1, maxLength: NFT_POOL.length },
                ),
                fc.array(
                    fc.record({
                        fromNft: fc.constantFrom(...NFT_POOL),
                        toNft: fc.constantFrom(...NFT_POOL),
                        caller: fc.constantFrom(...USER_POOL),
                        amount: fc.bigInt({ min: 0n, max: 5_000n }),
                    }),
                    { minLength: 0, maxLength: 30 },
                ),
                (initSpecs, transfers) => {
                    const model = new ProtocolModel({ admin: ADMIN });
                    for (const spec of initSpecs) {
                        model.initializeAccount(ADMIN_CALLER, {
                            nft: spec.nft,
                            owner: spec.owner,
                            balance: spec.balance,
                            state: AccountState.ACTIVE,
                        });
                    }
                    const initialSupply = model.totalSupply();

                    for (const t of transfers) {
                        model.transfer(
                            asUser(t.caller),
                            t.fromNft,
                            t.toNft,
                            t.amount,
                        );
                    }
                    expect(model.totalSupply()).toBe(initialSupply);
                },
            ),
            { numRuns: 200 },
        );
    });
});
