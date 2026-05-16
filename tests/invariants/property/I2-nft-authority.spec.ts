/**
 * INVARIANT I2 — NFT = Account Authority (property-based tests).
 *
 * Formal predicate:
 *
 *   ∀ NFT n, ∀ time t1 < t2:
 *     IF owner(n, t1) ≠ owner(n, t2)
 *     THEN any successful transfer from account(n) in (t1, t2] was authorized
 *          by the owner at the time of the transfer.
 *
 * Operationally, the property test:
 *   1. initialises an account owned by U1;
 *   2. transfers the NFT to U2;
 *   3. asserts that U1 can no longer move funds and U2 can.
 */

import * as fc from 'fast-check';
import { ProtocolModel, AccountState } from '../model/protocol-model';
import {
    ADMIN,
    NFT_POOL,
    USER_POOL,
    amountArb,
} from './arbitraries';
import { ADMIN_CALLER, asUser, snapshotBalances } from './helpers';

describe('I2 — NFT = Account Authority (property)', () => {
    it('previous owner loses authority after NFT transfer', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...NFT_POOL),
                fc.constantFrom(...USER_POOL),
                fc.constantFrom(...USER_POOL),
                fc.bigInt({ min: 100n, max: 1_000_000n }),
                fc.bigInt({ min: 1n, max: 100n }),
                (sourceNft, sinkNft, u1, u2, balance, amount) => {
                    fc.pre(sourceNft !== sinkNft);
                    fc.pre(u1 !== u2);

                    const model = new ProtocolModel({ admin: ADMIN });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: sourceNft,
                        owner: u1,
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft: sinkNft,
                        owner: USER_POOL[0],
                        balance: 0n,
                        state: AccountState.ACTIVE,
                    });

                    // u1 transfers the NFT to u2
                    const nftXfer = model.transferNFT(asUser(u1), sourceNft, u2);
                    expect(nftXfer.status).toBe('SUCCESS');
                    expect(model.getAccount(sourceNft)?.owner).toBe(u2);

                    // u1 must now be unable to move funds
                    const before = snapshotBalances(model);
                    const denied = model.transfer(
                        asUser(u1),
                        sourceNft,
                        sinkNft,
                        amount,
                    );
                    expect(denied.status).toBe('REVERTED');
                    expect(snapshotBalances(model)).toEqual(before);

                    // u2 (new owner) can move funds
                    const allowed = model.transfer(
                        asUser(u2),
                        sourceNft,
                        sinkNft,
                        amount,
                    );
                    expect(allowed.status).toBe('SUCCESS');
                    expect(model.balanceOf(sourceNft)).toBe(balance - amount);
                    expect(model.balanceOf(sinkNft)).toBe(amount);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('account authority always equals the current NFT owner', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...NFT_POOL),
                fc.array(fc.constantFrom(...USER_POOL), {
                    minLength: 1,
                    maxLength: 6,
                }),
                amountArb,
                (nft, transferChain, balance) => {
                    const model = new ProtocolModel({ admin: ADMIN });
                    model.initializeAccount(ADMIN_CALLER, {
                        nft,
                        owner: transferChain[0],
                        balance,
                        state: AccountState.ACTIVE,
                    });
                    let currentOwner = transferChain[0];
                    for (const next of transferChain.slice(1)) {
                        if (next === currentOwner) continue;
                        const res = model.transferNFT(
                            asUser(currentOwner),
                            nft,
                            next,
                        );
                        expect(res.status).toBe('SUCCESS');
                        currentOwner = next;
                    }
                    expect(model.getAccount(nft)?.owner).toBe(currentOwner);
                },
            ),
            { numRuns: 100 },
        );
    });
});
