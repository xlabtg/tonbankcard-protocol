import * as fc from 'fast-check';
import { Address, AccountState, CallerRole } from '../model/protocol-model';

export const ADMIN: Address = 'admin';
export const RISK_AUTHORITY: Address = 'risk_authority';
export const LENDING_ADAPTER: Address = 'lending_adapter';
export const EXTERNAL_ADAPTER: Address = 'external_adapter';

export const USER_POOL: readonly Address[] = [
    'alice',
    'bob',
    'carol',
    'dave',
    'eve',
];

export const NFT_POOL: readonly Address[] = [
    'nft-1',
    'nft-2',
    'nft-3',
    'nft-4',
];

export const userArb = fc.constantFrom(...USER_POOL);
export const nftArb = fc.constantFrom(...NFT_POOL);

export const callerRoleArb = fc.constantFrom<CallerRole>(
    'admin',
    'risk_authority',
    'lending_adapter',
    'external_adapter',
    'user',
);

export const stateArb = fc.constantFrom<AccountState>(
    AccountState.ACTIVE,
    AccountState.FROZEN,
    AccountState.SUSPENDED,
    AccountState.CLOSED,
);

/**
 * Bounded bigint generator. Bounds are intentionally large enough to surface
 * arithmetic edge cases but small enough that the test stays under the 60s
 * budget mandated by the issue.
 */
export const amountArb = fc.bigInt({
    min: 0n,
    max: 1_000_000_000_000_000n,
});

export interface InitAccountSpec {
    nft: Address;
    owner: Address;
    balance: bigint;
    state: AccountState;
}

export const initAccountArb: fc.Arbitrary<InitAccountSpec> = fc.record({
    nft: nftArb,
    owner: userArb,
    balance: amountArb,
    state: stateArb,
});

export const callerArb = fc.record({
    address: fc.oneof(
        userArb,
        fc.constantFrom(ADMIN, RISK_AUTHORITY, LENDING_ADAPTER, EXTERNAL_ADAPTER),
    ),
    role: callerRoleArb,
});
