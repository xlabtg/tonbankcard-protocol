/**
 * Adversarial scenarios for I7 — Lock Enforcement.
 *
 * Targets attempts to bypass locks using:
 *   - lock-then-unlock-then-replay
 *   - lock-with-stale-owner (NFT transferred while locked)
 *   - non-authorised role flipping the lock
 *   - reaching balance via NFT transfer then sending
 *   - admin attempting to clear locks (must fail — locks are role-scoped)
 */

import { ProtocolModel, AccountState } from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    EXTERNAL_ADAPTER,
    NFT_POOL,
    USER_POOL,
} from './arbitraries';
import {
    ADMIN_CALLER,
    LENDING_ADAPTER_CALLER,
    RISK_AUTHORITY_CALLER,
    asUser,
    snapshotBalances,
} from './helpers';

function setupLockedAccount() {
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
    model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);
    return model;
}

describe('I7 — Adversarial Lock Enforcement', () => {
    it('admin cannot clear a fraud lock (role-scoped authority)', () => {
        const model = setupLockedAccount();
        const beforeLocks = model.getAccount(NFT_POOL[0])?.fraudLocked;
        expect(beforeLocks).toBe(true);

        // Wrong role for fraud lock
        const denied = model.setFraudLock(
            { address: ADMIN, role: 'admin' },
            NFT_POOL[0],
            false,
        );
        expect(denied.status).toBe('REVERTED');
        expect(model.getAccount(NFT_POOL[0])?.fraudLocked).toBe(true);
    });

    it('lending_adapter cannot toggle fraud locks (only risk_authority can)', () => {
        const model = setupLockedAccount();
        const denied = model.setFraudLock(
            LENDING_ADAPTER_CALLER,
            NFT_POOL[0],
            false,
        );
        expect(denied.status).toBe('REVERTED');
        expect(model.getAccount(NFT_POOL[0])?.fraudLocked).toBe(true);
    });

    it('external adapter cannot bypass a lock by initiating the transfer itself', () => {
        const model = setupLockedAccount();
        const before = snapshotBalances(model);
        const res = model.transfer(
            { address: EXTERNAL_ADAPTER, role: 'external_adapter' },
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(res.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(before);
    });

    it('NFT transfer while locked does not bypass the lock for the new owner', () => {
        const model = setupLockedAccount();
        const xfer = model.transferNFT(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            USER_POOL[2],
        );
        expect(xfer.status).toBe('SUCCESS');
        // New owner still cannot send while the lock is in place.
        const before = snapshotBalances(model);
        const denied = model.transfer(
            asUser(USER_POOL[2]),
            NFT_POOL[0],
            NFT_POOL[1],
            50n,
        );
        expect(denied.status).toBe('REVERTED');
        expect(snapshotBalances(model)).toEqual(before);
    });

    it('a replay after unlock succeeds exactly once and reverts on second drain', () => {
        const model = setupLockedAccount();
        // Unlock and drain
        model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], false);
        const first = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            1_000n,
        );
        expect(first.status).toBe('SUCCESS');
        // Re-lock and replay — must revert because there is nothing left.
        model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], true);
        const replay = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            1_000n,
        );
        expect(replay.status).toBe('REVERTED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(0n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(1_000n);
    });

    it('collateral lock applied independently still blocks sends', () => {
        const model = new ProtocolModel({
            admin: ADMIN,
            riskAuthority: RISK_AUTHORITY,
            lendingAdapter: LENDING_ADAPTER,
        });
        model.initializeAccount(ADMIN_CALLER, {
            nft: NFT_POOL[0],
            owner: USER_POOL[0],
            balance: 500n,
            state: AccountState.ACTIVE,
        });
        model.initializeAccount(ADMIN_CALLER, {
            nft: NFT_POOL[1],
            owner: USER_POOL[1],
            balance: 0n,
            state: AccountState.ACTIVE,
        });
        model.setCollateralLock(LENDING_ADAPTER_CALLER, NFT_POOL[0], true);
        const before = snapshotBalances(model);
        const res = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            10n,
        );
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('COLLATERAL_LOCKED');
        expect(snapshotBalances(model)).toEqual(before);
    });
});
