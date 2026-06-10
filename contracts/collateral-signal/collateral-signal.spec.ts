/**
 * CollateralSignal — production-hardening regression tests (Issue #364).
 *
 * Issue #364 removed the test-only `RegisterNFTOwner` handler from the deployable
 * production contract. That handler was gated only behind the deployer recorded at
 * init() (audit finding HIGH / cross-cutting X-1), which let the deployer
 * unilaterally seed the NFT authorisation map — a backdoor that violates protocol
 * invariant I3 (No Admin Control).
 *
 * NFT ownership is now bound ONLY by the trusted on-chain NFT Account Resolver
 * (`nft_resolver`, set immutably at init) via `receive(msg: ResolveNFTOwner)` —
 * directly analogous to how MerchantPaymentHub (Issue #363) replaced the admin
 * `SetAccountLock` with the Account-Locks-contract-gated `ApplyAccountLock`. The
 * binding stays write-once (CONTRACTS-M1 / #279).
 *
 * These tests run against the deployable production contract itself (there is no
 * test-only handler left to hide in a harness), so they exercise the real
 * production logic end to end.
 *
 * Coverage:
 *   (1) Deploys with the expected immutable NFT resolver authority.
 *   (2) Only the trusted resolver may register ownership; the deployer and an
 *       attacker cannot (invariant I3, the core of Issue #364).
 *   (3) Ownership binding is write-once (CONTRACTS-M1) and survives a rejected
 *       overwrite attempt.
 *   (4) Once the resolver registers ownership, only the NFT owner can signal /
 *       update / release collateral (invariants I1 / I2); a non-owner and an
 *       unregistered NFT cannot change signal state.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import '@ton/test-utils';
import { Address, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { CollateralSignal } from './dist/CollateralSignal_CollateralSignal';

// Mirror of the Tact collateral-signal state constants (bigint to match getters).
const COLLATERAL_SIGNAL_NONE = 0n;
const COLLATERAL_SIGNAL_ACTIVE = 1n;
const COLLATERAL_SIGNAL_WARNING = 2n;
const COLLATERAL_SIGNAL_RELEASED = 3n;

const GAS = toNano('0.1');

describe('CollateralSignal — production hardening (Issue #364)', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let nftResolver: SandboxContract<TreasuryContract>; // the trusted NFT Account Resolver authority
    let aliceOwner: SandboxContract<TreasuryContract>;
    let bobOwner: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;
    let signal: SandboxContract<CollateralSignal>;

    // Stand-in NFT account addresses (any addresses work; the contract only keys maps by them).
    let aliceNft: Address;
    let bobNft: Address;

    async function resolveOwner(
        sender: SandboxContract<TreasuryContract>,
        nft: Address,
        owner: Address,
    ) {
        return signal.send(
            sender.getSender(),
            { value: GAS },
            { $$type: 'ResolveNFTOwner', nft_address: nft, owner },
        );
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        nftResolver = await blockchain.treasury('nftResolver');
        aliceOwner = await blockchain.treasury('aliceOwner');
        bobOwner = await blockchain.treasury('bobOwner');
        attacker = await blockchain.treasury('attacker');

        aliceNft = (await blockchain.treasury('aliceNft')).address;
        bobNft = (await blockchain.treasury('bobNft')).address;

        // Deploy: nft_resolver = nftResolver (immutable).
        signal = blockchain.openContract(await CollateralSignal.fromInit(nftResolver.address));

        // First message auto-attaches the init state and registers Alice's NFT
        // through the trusted resolver (the real production ownership path).
        await resolveOwner(nftResolver, aliceNft, aliceOwner.address);
    });

    it('deploys with the expected immutable NFT resolver authority', async () => {
        expect((await signal.getGetNftResolver()).toString()).toBe(nftResolver.address.toString());
    });

    describe('NFT ownership registration is resolver-gated (Issue #364)', () => {
        it('lets the trusted resolver register a new NFT owner', async () => {
            const res = await resolveOwner(nftResolver, bobNft, bobOwner.address);
            expect(res.transactions).toHaveTransaction({
                from: nftResolver.address,
                to: signal.address,
                success: true,
            });
        });

        it('rejects ResolveNFTOwner from the deployer (invariant I3: deployer cannot register)', async () => {
            const res = await resolveOwner(deployer, bobNft, deployer.address);
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: signal.address,
                success: false,
            });
            // Bob's NFT must remain unregistered: the deployer could not seed it.
            const probe = await signal.send(
                bobOwner.getSender(),
                { value: GAS },
                { $$type: 'SignalCollateralRequest', nft_address: bobNft, collateral_amount_ton: toNano('10') },
            );
            expect(probe.transactions).toHaveTransaction({ from: bobOwner.address, to: signal.address });
            expect(await signal.getGetCollateralSignalState(bobNft)).toBe(COLLATERAL_SIGNAL_NONE);
        });

        it('rejects ResolveNFTOwner from an arbitrary attacker', async () => {
            const res = await resolveOwner(attacker, bobNft, attacker.address);
            expect(res.transactions).toHaveTransaction({
                from: attacker.address,
                to: signal.address,
                success: false,
            });
        });

        it('is write-once: even the resolver cannot overwrite an existing binding (CONTRACTS-M1)', async () => {
            const res = await resolveOwner(nftResolver, aliceNft, attacker.address);
            expect(res.transactions).toHaveTransaction({
                from: nftResolver.address,
                to: signal.address,
                success: false,
            });
        });

        it('preserves the original owner binding after a rejected overwrite (CONTRACTS-M1)', async () => {
            // Attempt to re-point Alice's NFT to the attacker.
            await resolveOwner(nftResolver, aliceNft, attacker.address);

            // Alice can still act as the owner; the attacker cannot.
            await signal.send(
                aliceOwner.getSender(),
                { value: GAS },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: aliceNft,
                    new_state: COLLATERAL_SIGNAL_WARNING,
                    collateral_amount_ton: toNano('500'),
                },
            );
            expect(await signal.getGetCollateralSignalState(aliceNft)).toBe(COLLATERAL_SIGNAL_WARNING);
        });
    });

    describe('collateral signalling (NFT owner only, invariants I1 / I2)', () => {
        it('lets the registered NFT owner signal active collateral', async () => {
            await signal.send(
                aliceOwner.getSender(),
                { value: GAS },
                { $$type: 'SignalCollateralRequest', nft_address: aliceNft, collateral_amount_ton: toNano('100') },
            );
            expect(await signal.getGetCollateralSignalState(aliceNft)).toBe(COLLATERAL_SIGNAL_ACTIVE);
            expect(await signal.getHasActiveCollateralSignal(aliceNft)).toBe(true);
            expect(await signal.getGetSignaledCollateralAmount(aliceNft)).toBe(toNano('100'));
        });

        it('does not let a non-owner change another NFT signal state', async () => {
            await signal.send(
                attacker.getSender(),
                { value: GAS },
                { $$type: 'SignalCollateralRequest', nft_address: aliceNft, collateral_amount_ton: toNano('100') },
            );
            // The non-owner request is answered with an error response, not applied.
            expect(await signal.getGetCollateralSignalState(aliceNft)).toBe(COLLATERAL_SIGNAL_NONE);
        });

        it('does not let anyone signal for an unregistered NFT', async () => {
            await signal.send(
                bobOwner.getSender(),
                { value: GAS },
                { $$type: 'SignalCollateralRequest', nft_address: bobNft, collateral_amount_ton: toNano('100') },
            );
            expect(await signal.getGetCollateralSignalState(bobNft)).toBe(COLLATERAL_SIGNAL_NONE);
        });

        it('lets the owner release a previously active signal', async () => {
            await signal.send(
                aliceOwner.getSender(),
                { value: GAS },
                { $$type: 'SignalCollateralRequest', nft_address: aliceNft, collateral_amount_ton: toNano('100') },
            );
            expect(await signal.getGetCollateralSignalState(aliceNft)).toBe(COLLATERAL_SIGNAL_ACTIVE);

            await signal.send(
                aliceOwner.getSender(),
                { value: GAS },
                { $$type: 'ReleaseCollateralSignalRequest', nft_address: aliceNft },
            );
            expect(await signal.getGetCollateralSignalState(aliceNft)).toBe(COLLATERAL_SIGNAL_RELEASED);
            expect(await signal.getHasActiveCollateralSignal(aliceNft)).toBe(false);
        });
    });
});
