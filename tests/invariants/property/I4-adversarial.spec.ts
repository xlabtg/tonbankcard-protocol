/**
 * Adversarial scenarios for I4 — Atomic Transfers.
 *
 * Each scenario tries to construct a partial-execution state. The model
 * must remain atomic: either the transfer succeeds with both sides updated,
 * or it reverts and no balance moves.
 *
 * Threat vectors covered:
 *  - replay of identical transfers
 *  - interleaved transfers with the same sender (race-like ordering)
 *  - reentrancy attempt mid-transfer
 *  - partial execution attempt after destination is closed
 *  - mid-flight lock followed by retry
 *
 * Mirrors `tests/adversarial/` in spirit. These tests are deterministic
 * unit tests rather than randomised property tests, because they target
 * specific attack scenarios called out in `docs/threat-model.md`.
 */

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
    RISK_AUTHORITY_CALLER,
    asUser,
    snapshotBalances,
} from './helpers';

function freshModel() {
    const model = new ProtocolModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
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
    return model;
}

describe('I4 — Adversarial Scenarios', () => {
    it('rejects replay of a transfer after the source is drained', () => {
        const model = freshModel();
        // Drain the sender.
        const first = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            1_000n,
        );
        expect(first.status).toBe('SUCCESS');
        const before = snapshotBalances(model);
        const replay = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            1_000n,
        );
        expect(replay.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(before);
    });

    it('preserves atomicity when two transfers race over the same balance', () => {
        const model = freshModel();
        // Two transfers of 600 each — second must revert because of
        // insufficient balance, and supply must be conserved.
        const a = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            600n,
        );
        const b = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            600n,
        );
        expect(a.status).toBe('SUCCESS');
        expect(b.status).toBe('REVERTED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(400n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(600n);
        expect(model.totalSupply()).toBe(1_000n);
    });

    it('rejects reentrancy and leaves balances untouched', () => {
        const model = freshModel();
        // Simulate a reentrant attempt by pre-flipping the guard.
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

    it('rejects transfer to a closed destination as a single atomic revert', () => {
        const model = freshModel();
        model.setAccountState(ADMIN_CALLER, NFT_POOL[1], AccountState.CLOSED);
        const before = snapshotBalances(model);
        const res = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(res.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(before);
    });

    it('cancels in-flight transfers once a fraud lock is applied mid-sequence', () => {
        const model = freshModel();
        const first = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            200n,
        );
        expect(first.status).toBe('SUCCESS');

        model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);

        const after = snapshotBalances(model);
        const second = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(second.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(after);
    });

    it('rejects negative amounts as a single atomic revert', () => {
        const model = freshModel();
        const before = snapshotBalances(model);
        const res = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            -1n,
        );
        expect(res.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(before);
    });
});
