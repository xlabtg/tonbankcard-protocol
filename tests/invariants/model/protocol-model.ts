/**
 * Executable model of the TONBANKCARD protocol state machine.
 *
 * Mirrors the operations described in `docs/invariants.md` and the Tact/FunC
 * contract sources in `contracts/`. The model is intentionally minimal: it
 * captures the operations relevant to invariants I1–I7 (ownership, atomicity,
 * locks, conservation, admin scope, external-adapter isolation) and ignores
 * gas/fees, Merkle proofs and cross-shard plumbing.
 *
 * The model is deterministic and pure — every transition either commits an
 * atomic state change or returns an error without touching state. Property
 * tests in `tests/invariants/property/*` exercise this model with `fast-check`
 * to attempt to violate the seven invariants.
 */

export type Address = string;

export enum AccountState {
    ACTIVE = 0,
    FROZEN = 1,
    SUSPENDED = 2,
    CLOSED = 3,
}

export interface Account {
    nft: Address;
    owner: Address;
    balance: bigint;
    state: AccountState;
    fraudLocked: boolean;
    collateralLocked: boolean;
}

export type CallerRole =
    | 'admin'
    | 'risk_authority'
    | 'lending_adapter'
    | 'external_adapter'
    | 'user';

export interface Caller {
    address: Address;
    role: CallerRole;
}

export type TxStatus = 'SUCCESS' | 'REVERTED';

export interface TxResult {
    status: TxStatus;
    error?: string;
}

export interface ProtocolSnapshot {
    accounts: ReadonlyMap<Address, Readonly<Account>>;
    admin: Address;
    riskAuthority: Address;
    lendingAdapter: Address;
    reentrancyLocked: boolean;
}

/**
 * The model is single-threaded; reentrancy is simulated by attempting to
 * invoke a second `transfer` while the model is already inside one. The flag
 * is exposed to property tests so they can construct adversarial scenarios.
 */
export class ProtocolModel {
    private readonly accounts = new Map<Address, Account>();
    private _admin: Address;
    private _riskAuthority: Address;
    private _lendingAdapter: Address;
    private _reentrancyLocked = false;

    constructor(params: {
        admin: Address;
        riskAuthority?: Address;
        lendingAdapter?: Address;
    }) {
        this._admin = params.admin;
        this._riskAuthority = params.riskAuthority ?? params.admin;
        this._lendingAdapter = params.lendingAdapter ?? params.admin;
    }

    get admin(): Address {
        return this._admin;
    }

    get riskAuthority(): Address {
        return this._riskAuthority;
    }

    get lendingAdapter(): Address {
        return this._lendingAdapter;
    }

    get reentrancyLocked(): boolean {
        return this._reentrancyLocked;
    }

    snapshot(): ProtocolSnapshot {
        const copy = new Map<Address, Account>();
        for (const [k, v] of this.accounts) {
            copy.set(k, { ...v });
        }
        return {
            accounts: copy,
            admin: this._admin,
            riskAuthority: this._riskAuthority,
            lendingAdapter: this._lendingAdapter,
            reentrancyLocked: this._reentrancyLocked,
        };
    }

    getAccount(nft: Address): Readonly<Account> | undefined {
        const acc = this.accounts.get(nft);
        return acc ? { ...acc } : undefined;
    }

    balanceOf(nft: Address): bigint {
        return this.accounts.get(nft)?.balance ?? 0n;
    }

    totalSupply(): bigint {
        let sum = 0n;
        for (const acc of this.accounts.values()) {
            sum += acc.balance;
        }
        return sum;
    }

    /**
     * Admin-only: register an account record. Used in test setup. Mirrors
     * `InitializeAccount` in PaymentHub.tact / `SetAccountState`+`SetAccountBalance`
     * in MerchantPaymentHub.tact.
     */
    initializeAccount(
        caller: Caller,
        params: {
            nft: Address;
            owner: Address;
            balance: bigint;
            state?: AccountState;
        },
    ): TxResult {
        if (caller.role !== 'admin' || caller.address !== this._admin) {
            return { status: 'REVERTED', error: 'NOT_ADMIN' };
        }
        if (params.balance < 0n) {
            return { status: 'REVERTED', error: 'NEGATIVE_BALANCE' };
        }
        this.accounts.set(params.nft, {
            nft: params.nft,
            owner: params.owner,
            balance: params.balance,
            state: params.state ?? AccountState.ACTIVE,
            fraudLocked: false,
            collateralLocked: false,
        });
        return { status: 'SUCCESS' };
    }

    /**
     * Internal TBC transfer. Models I1 (owner-only), I4 (atomic),
     * I5 (conservation), I6 (lock prevents sending), I7 (no privileged path).
     */
    transfer(
        caller: Caller,
        fromNft: Address,
        toNft: Address,
        amount: bigint,
    ): TxResult {
        if (this._reentrancyLocked) {
            return { status: 'REVERTED', error: 'REENTRANCY' };
        }
        this._reentrancyLocked = true;
        try {
            return this.transferUnchecked(caller, fromNft, toNft, amount);
        } finally {
            this._reentrancyLocked = false;
        }
    }

    private transferUnchecked(
        caller: Caller,
        fromNft: Address,
        toNft: Address,
        amount: bigint,
    ): TxResult {
        const from = this.accounts.get(fromNft);
        const to = this.accounts.get(toNft);

        if (!from) return { status: 'REVERTED', error: 'NO_FROM_ACCOUNT' };
        if (!to) return { status: 'REVERTED', error: 'NO_TO_ACCOUNT' };
        if (amount < 0n) return { status: 'REVERTED', error: 'NEGATIVE_AMOUNT' };

        // I1: only the NFT owner can initiate a transfer. Admin / risk_authority /
        // lending_adapter / external_adapter must all be rejected.
        if (caller.role !== 'user' || caller.address !== from.owner) {
            return { status: 'REVERTED', error: 'NOT_OWNER' };
        }

        if (from.state !== AccountState.ACTIVE) {
            return { status: 'REVERTED', error: 'FROM_NOT_ACTIVE' };
        }
        if (to.state === AccountState.CLOSED) {
            return { status: 'REVERTED', error: 'TO_CLOSED' };
        }

        // I6/I7: locks prevent sending but never receiving.
        if (from.fraudLocked) {
            return { status: 'REVERTED', error: 'FRAUD_LOCKED' };
        }
        if (from.collateralLocked) {
            return { status: 'REVERTED', error: 'COLLATERAL_LOCKED' };
        }

        if (from.balance < amount) {
            return { status: 'REVERTED', error: 'INSUFFICIENT_BALANCE' };
        }

        // Self-transfer is a no-op (matches PaymentHub.tact behaviour).
        if (fromNft === toNft) {
            return { status: 'SUCCESS' };
        }

        // I4: atomic — both updates in the same transition or none.
        from.balance -= amount;
        to.balance += amount;
        return { status: 'SUCCESS' };
    }

    /**
     * NFT transfer changes account authority. Mirrors I2.
     */
    transferNFT(caller: Caller, nft: Address, newOwner: Address): TxResult {
        const acc = this.accounts.get(nft);
        if (!acc) return { status: 'REVERTED', error: 'NO_ACCOUNT' };
        if (caller.role !== 'user' || caller.address !== acc.owner) {
            return { status: 'REVERTED', error: 'NOT_OWNER' };
        }
        acc.owner = newOwner;
        return { status: 'SUCCESS' };
    }

    /**
     * Risk-authority operation: set/clear fraud lock. Models I6 (lock does not
     * touch balance/ownership) and I3 (only allowed roles).
     */
    setFraudLock(caller: Caller, nft: Address, value: boolean): TxResult {
        if (
            caller.role !== 'risk_authority' ||
            caller.address !== this._riskAuthority
        ) {
            return { status: 'REVERTED', error: 'NOT_RISK_AUTHORITY' };
        }
        const acc = this.accounts.get(nft);
        if (!acc) return { status: 'REVERTED', error: 'NO_ACCOUNT' };
        acc.fraudLocked = value;
        return { status: 'SUCCESS' };
    }

    /**
     * Lending-adapter operation: set/clear collateral lock.
     */
    setCollateralLock(caller: Caller, nft: Address, value: boolean): TxResult {
        if (
            caller.role !== 'lending_adapter' ||
            caller.address !== this._lendingAdapter
        ) {
            return { status: 'REVERTED', error: 'NOT_LENDING_ADAPTER' };
        }
        const acc = this.accounts.get(nft);
        if (!acc) return { status: 'REVERTED', error: 'NO_ACCOUNT' };
        acc.collateralLocked = value;
        return { status: 'SUCCESS' };
    }

    /**
     * Admin-only state change (FROZEN, SUSPENDED, etc.). Mirrors I3: admin
     * can flag accounts but cannot move funds.
     */
    setAccountState(caller: Caller, nft: Address, state: AccountState): TxResult {
        if (caller.role !== 'admin' || caller.address !== this._admin) {
            return { status: 'REVERTED', error: 'NOT_ADMIN' };
        }
        const acc = this.accounts.get(nft);
        if (!acc) return { status: 'REVERTED', error: 'NO_ACCOUNT' };
        acc.state = state;
        return { status: 'SUCCESS' };
    }
}
