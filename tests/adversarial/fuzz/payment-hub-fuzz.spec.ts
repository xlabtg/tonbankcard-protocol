/**
 * Fuzz tests for PaymentHub entry points (`transfer`, `lockAccount`,
 * `unlockAccount`).
 *
 * Per issue #127 §"Fuzz Test Targets" the fuzz inputs MUST include:
 *   - zero values
 *   - MAX_UINT values
 *   - empty strings
 *   - maximum-length strings
 * and the budget MUST be bounded (≤30s per target in CI).
 *
 * We use fast-check on top of the deterministic `ProtocolModel`. The model
 * mirrors the on-chain semantics described in `contracts/payments/PaymentHub.tact`
 * for transfer, fraud-lock and collateral-lock so the invariants asserted here
 * are the same the contracts must hold.
 *
 * Bounds (numRuns) are calibrated so each `it` finishes well under 30s on the
 * Jest 60s timeout configured in `tests/adversarial/package.json`.
 */

import * as fc from 'fast-check';
import {
    AccountState,
    Address,
    ProtocolModel,
    TxResult,
} from '../../invariants/model/protocol-model';
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
    snapshotBalances,
} from '../../invariants/property/helpers';

// Edge-case constants required by issue §7.
const ZERO = 0n;
const MAX_UINT256 = (1n << 256n) - 1n;
const EMPTY = '';
const MAX_LEN_ADDR = 'x'.repeat(1024);
const FUZZ_RUNS = 200; // bounded runtime; each iteration is O(1) state ops

/** Random caller (user/admin/risk/lending) over a small pool. */
const callerArb = fc.oneof(
    fc.record({
        address: fc.constantFrom(...USER_POOL),
        role: fc.constant('user' as const),
    }),
    fc.record({
        address: fc.constant(ADMIN),
        role: fc.constant('admin' as const),
    }),
    fc.record({
        address: fc.constant(RISK_AUTHORITY),
        role: fc.constant('risk_authority' as const),
    }),
    fc.record({
        address: fc.constant(LENDING_ADAPTER),
        role: fc.constant('lending_adapter' as const),
    }),
    fc.record({
        address: fc.constant('external_adapter'),
        role: fc.constant('external_adapter' as const),
    }),
);

/** NFT address — pool entries, empty string, max-length string. */
const nftArb = fc.oneof(
    fc.constantFrom(...NFT_POOL),
    fc.constant(EMPTY),
    fc.constant(MAX_LEN_ADDR),
);

/** Amount — edge-case-heavy: 0, MAX_UINT, near boundaries, random bigints. */
const amountArb = fc.oneof(
    fc.constant(ZERO),
    fc.constant(1n),
    fc.constant(-1n),
    fc.constant(MAX_UINT256),
    fc.constant(MAX_UINT256 - 1n),
    fc.bigInt({ min: -1_000n, max: 1_000_000_000n }),
);

function freshModel(initialBalance: bigint = 1_000n): ProtocolModel {
    const model = new ProtocolModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    model.initializeAccount(ADMIN_CALLER, {
        nft: NFT_POOL[0],
        owner: USER_POOL[0],
        balance: initialBalance,
        state: AccountState.ACTIVE,
    });
    model.initializeAccount(ADMIN_CALLER, {
        nft: NFT_POOL[1],
        owner: USER_POOL[1],
        balance: ZERO,
        state: AccountState.ACTIVE,
    });
    return model;
}

function deltaSupply(before: bigint, after: bigint): bigint {
    return after - before;
}

describe('Fuzz: PaymentHub.transfer', () => {
    it('never violates conservation regardless of caller/amount/addresses', () => {
        fc.assert(
            fc.property(
                callerArb,
                nftArb,
                nftArb,
                amountArb,
                (caller, from, to, amount) => {
                    const model = freshModel();
                    const supplyBefore = model.totalSupply();
                    const res = model.transfer(caller, from, to, amount);
                    const supplyAfter = model.totalSupply();
                    // I5 conservation must hold even if the call reverts.
                    expect(deltaSupply(supplyBefore, supplyAfter)).toBe(0n);
                    // Reverts never produce a SUCCESS that moves negative
                    // amounts or to unknown accounts.
                    if (res.status === 'SUCCESS') {
                        expect(amount >= 0n).toBe(true);
                        // Both NFTs must be known.
                        expect(model.getAccount(from)).toBeDefined();
                        expect(model.getAccount(to)).toBeDefined();
                    }
                },
            ),
            { numRuns: FUZZ_RUNS },
        );
    });

    it('zero-amount transfer between known accounts is a successful no-op', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...USER_POOL),
                (anyUser) => {
                    const model = freshModel();
                    const owner = USER_POOL[0];
                    const res = model.transfer(
                        asUser(owner),
                        NFT_POOL[0],
                        NFT_POOL[1],
                        ZERO,
                    );
                    if (anyUser === owner) {
                        expect(res.status).toBe('SUCCESS');
                    }
                    expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
                    expect(model.balanceOf(NFT_POOL[1])).toBe(0n);
                },
            ),
            { numRuns: 50 },
        );
    });

    it('MAX_UINT256 amount reverts with INSUFFICIENT_BALANCE not overflow', () => {
        fc.assert(
            fc.property(fc.constantFrom(...USER_POOL), (anyUser) => {
                const model = freshModel();
                const res = model.transfer(
                    asUser(USER_POOL[0]),
                    NFT_POOL[0],
                    NFT_POOL[1],
                    MAX_UINT256,
                );
                expect(res.status).toBe('REVERTED');
                expect(res.error).toBe('INSUFFICIENT_BALANCE');
                expect(model.totalSupply()).toBe(1_000n);
                void anyUser;
            }),
            { numRuns: 20 },
        );
    });

    it('negative amounts always revert (no underflow)', () => {
        fc.assert(
            fc.property(
                fc.bigInt({ min: -1_000_000n, max: -1n }),
                (neg) => {
                    const model = freshModel();
                    const before = snapshotBalances(model);
                    const res = model.transfer(
                        asUser(USER_POOL[0]),
                        NFT_POOL[0],
                        NFT_POOL[1],
                        neg,
                    );
                    expect(res.status).toBe('REVERTED');
                    expect(snapshotBalances(model)).toEqual(before);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('empty-string and max-length addresses revert as missing accounts', () => {
        const edges: Address[] = [EMPTY, MAX_LEN_ADDR];
        for (const bad of edges) {
            const model = freshModel();
            const r1 = model.transfer(
                asUser(USER_POOL[0]),
                bad,
                NFT_POOL[1],
                10n,
            );
            expect(r1.status).toBe('REVERTED');
            expect(r1.error === 'NO_FROM_ACCOUNT' || r1.error === 'NOT_OWNER').toBe(
                true,
            );

            const r2 = model.transfer(
                asUser(USER_POOL[0]),
                NFT_POOL[0],
                bad,
                10n,
            );
            expect(r2.status).toBe('REVERTED');
            expect(r2.error).toBe('NO_TO_ACCOUNT');
            expect(model.totalSupply()).toBe(1_000n);
        }
    });

    it('non-owner callers can never debit any account (I1)', () => {
        fc.assert(
            fc.property(callerArb, amountArb, (caller, amount) => {
                const model = freshModel();
                if (caller.role === 'user' && caller.address === USER_POOL[0]) {
                    return; // owner case is the happy path, excluded here
                }
                const before = snapshotBalances(model);
                const res = model.transfer(
                    caller,
                    NFT_POOL[0],
                    NFT_POOL[1],
                    amount,
                );
                expect(res.status).toBe('REVERTED');
                expect(snapshotBalances(model)).toEqual(before);
            }),
            { numRuns: FUZZ_RUNS },
        );
    });
});

describe('Fuzz: PaymentHub.lockAccount / unlockAccount', () => {
    it('only the risk authority may toggle a fraud lock', () => {
        fc.assert(
            fc.property(
                callerArb,
                nftArb,
                fc.boolean(),
                (caller, nft, value) => {
                    const model = freshModel();
                    const supplyBefore = model.totalSupply();
                    const res = model.setFraudLock(caller, nft, value);
                    expect(model.totalSupply()).toBe(supplyBefore);
                    const isAuthorised =
                        caller.role === 'risk_authority' &&
                        caller.address === RISK_AUTHORITY;
                    const isKnownAccount = model.getAccount(nft) !== undefined;
                    if (res.status === 'SUCCESS') {
                        expect(isAuthorised).toBe(true);
                        expect(isKnownAccount).toBe(true);
                        expect(model.getAccount(nft)?.fraudLocked).toBe(value);
                    } else if (!isAuthorised) {
                        expect(res.error).toBe('NOT_RISK_AUTHORITY');
                    } else {
                        // Authorised caller but unknown NFT account.
                        expect(res.error).toBe('NO_ACCOUNT');
                    }
                },
            ),
            { numRuns: FUZZ_RUNS },
        );
    });

    it('only the lending adapter may toggle a collateral lock', () => {
        fc.assert(
            fc.property(
                callerArb,
                nftArb,
                fc.boolean(),
                (caller, nft, value) => {
                    const model = freshModel();
                    const supplyBefore = model.totalSupply();
                    const res = model.setCollateralLock(caller, nft, value);
                    expect(model.totalSupply()).toBe(supplyBefore);
                    const isAuthorised =
                        caller.role === 'lending_adapter' &&
                        caller.address === LENDING_ADAPTER;
                    const isKnownAccount = model.getAccount(nft) !== undefined;
                    if (res.status === 'SUCCESS') {
                        expect(isAuthorised).toBe(true);
                        expect(isKnownAccount).toBe(true);
                        expect(model.getAccount(nft)?.collateralLocked).toBe(
                            value,
                        );
                    } else if (!isAuthorised) {
                        expect(res.error).toBe('NOT_LENDING_ADAPTER');
                    } else {
                        expect(res.error).toBe('NO_ACCOUNT');
                    }
                },
            ),
            { numRuns: FUZZ_RUNS },
        );
    });

    it('lock idempotency: setting the same value twice never moves funds', () => {
        fc.assert(
            fc.property(fc.boolean(), (value) => {
                const model = freshModel();
                const before = snapshotBalances(model);
                model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], value);
                model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[0], value);
                expect(model.getAccount(NFT_POOL[0])?.fraudLocked).toBe(value);
                expect(snapshotBalances(model)).toEqual(before);
            }),
            { numRuns: 20 },
        );
    });

    it('locks have no effect on receiving transfers (I6)', () => {
        const model = freshModel();
        model.setFraudLock(RISK_AUTHORITY_CALLER, NFT_POOL[1], true);
        const res = model.transfer(
            asUser(USER_POOL[0]),
            NFT_POOL[0],
            NFT_POOL[1],
            100n,
        );
        expect(res.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[1])).toBe(100n);
        expect(model.getAccount(NFT_POOL[1])?.fraudLocked).toBe(true);
    });

    it('empty-string and max-length NFT addresses fail safely', () => {
        for (const bad of [EMPTY, MAX_LEN_ADDR]) {
            const f = freshModel();
            const r1 = f.setFraudLock(RISK_AUTHORITY_CALLER, bad, true);
            expect(r1.status).toBe('REVERTED');
            expect(r1.error).toBe('NO_ACCOUNT');

            const r2 = f.setCollateralLock(LENDING_ADAPTER_CALLER, bad, true);
            expect(r2.status).toBe('REVERTED');
            expect(r2.error).toBe('NO_ACCOUNT');
        }
    });
});

describe('Fuzz: PaymentHub state machine — random op sequences', () => {
    type Op =
        | { kind: 'transfer'; from: Address; to: Address; amount: bigint }
        | { kind: 'lock'; nft: Address; value: boolean }
        | { kind: 'collateral'; nft: Address; value: boolean }
        | { kind: 'setState'; nft: Address; state: AccountState };

    const opArb: fc.Arbitrary<Op> = fc.oneof(
        fc.record({
            kind: fc.constant('transfer' as const),
            from: fc.constantFrom(...NFT_POOL),
            to: fc.constantFrom(...NFT_POOL),
            amount: amountArb,
        }),
        fc.record({
            kind: fc.constant('lock' as const),
            nft: fc.constantFrom(...NFT_POOL),
            value: fc.boolean(),
        }),
        fc.record({
            kind: fc.constant('collateral' as const),
            nft: fc.constantFrom(...NFT_POOL),
            value: fc.boolean(),
        }),
        fc.record({
            kind: fc.constant('setState' as const),
            nft: fc.constantFrom(...NFT_POOL),
            state: fc.constantFrom<AccountState>(
                AccountState.ACTIVE,
                AccountState.FROZEN,
                AccountState.SUSPENDED,
                AccountState.CLOSED,
            ),
        }),
    );

    it('arbitrary op sequences preserve total supply (I5)', () => {
        fc.assert(
            fc.property(fc.array(opArb, { maxLength: 25 }), (ops) => {
                const model = freshModel(10_000n);
                const startSupply = model.totalSupply();
                for (const op of ops) {
                    let res: TxResult | undefined;
                    switch (op.kind) {
                        case 'transfer':
                            res = model.transfer(
                                asUser(USER_POOL[0]),
                                op.from,
                                op.to,
                                op.amount,
                            );
                            break;
                        case 'lock':
                            res = model.setFraudLock(
                                RISK_AUTHORITY_CALLER,
                                op.nft,
                                op.value,
                            );
                            break;
                        case 'collateral':
                            res = model.setCollateralLock(
                                LENDING_ADAPTER_CALLER,
                                op.nft,
                                op.value,
                            );
                            break;
                        case 'setState':
                            res = model.setAccountState(
                                ADMIN_CALLER,
                                op.nft,
                                op.state,
                            );
                            break;
                    }
                    expect(res?.status === 'SUCCESS' || res?.status === 'REVERTED').toBe(
                        true,
                    );
                    expect(model.totalSupply()).toBe(startSupply);
                }
            }),
            { numRuns: FUZZ_RUNS },
        );
    });
});
