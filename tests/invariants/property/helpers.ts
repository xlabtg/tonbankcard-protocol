import { ProtocolModel, Caller, AccountState, Address } from '../model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    InitAccountSpec,
    USER_POOL,
} from './arbitraries';

export function buildModel(initSpecs: InitAccountSpec[]): ProtocolModel {
    const model = new ProtocolModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    const adminCaller: Caller = { address: ADMIN, role: 'admin' };
    // Deduplicate by nft — the last spec wins (matches how InitializeAccount
    // overwrites in PaymentHub.tact).
    const dedup = new Map<Address, InitAccountSpec>();
    for (const spec of initSpecs) {
        dedup.set(spec.nft, spec);
    }
    for (const spec of dedup.values()) {
        model.initializeAccount(adminCaller, spec);
    }
    return model;
}

export function totalSupply(model: ProtocolModel): bigint {
    return model.totalSupply();
}

export function snapshotBalances(model: ProtocolModel): Map<Address, bigint> {
    const out = new Map<Address, bigint>();
    for (const [nft, acc] of model.snapshot().accounts) {
        out.set(nft, acc.balance);
    }
    return out;
}

export function snapshotOwners(model: ProtocolModel): Map<Address, Address> {
    const out = new Map<Address, Address>();
    for (const [nft, acc] of model.snapshot().accounts) {
        out.set(nft, acc.owner);
    }
    return out;
}

export function snapshotLocks(
    model: ProtocolModel,
): Map<Address, { fraud: boolean; collateral: boolean }> {
    const out = new Map<Address, { fraud: boolean; collateral: boolean }>();
    for (const [nft, acc] of model.snapshot().accounts) {
        out.set(nft, {
            fraud: acc.fraudLocked,
            collateral: acc.collateralLocked,
        });
    }
    return out;
}

export function nonOwners(ownerAddress: Address): Address[] {
    return USER_POOL.filter((u) => u !== ownerAddress);
}

export function asUser(address: Address): Caller {
    return { address, role: 'user' };
}

export const ADMIN_CALLER: Caller = { address: ADMIN, role: 'admin' };
export const RISK_AUTHORITY_CALLER: Caller = {
    address: RISK_AUTHORITY,
    role: 'risk_authority',
};
export const LENDING_ADAPTER_CALLER: Caller = {
    address: LENDING_ADAPTER,
    role: 'lending_adapter',
};

export function isActive(model: ProtocolModel, nft: Address): boolean {
    return model.getAccount(nft)?.state === AccountState.ACTIVE;
}
