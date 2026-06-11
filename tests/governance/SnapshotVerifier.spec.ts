/**
 * Unit Tests for Snapshot Verifier (Issue #38)
 * Tests snapshot registration and voter eligibility verification
 *
 * IMPORTANT: This verifier is for ADVISORY governance only.
 *
 * NOTE (Issue #370 — sender authentication):
 *   This spec imports a hand-written `../../wrappers/SnapshotVerifier` wrapper
 *   and is NOT wired into CI (there is no package.json under tests/governance).
 *   The CANONICAL, CI-runnable tests — including the full sender-authentication
 *   coverage (unauthorized rejection, fail-closed before configuration,
 *   deployer-only trusted-indexer designation, forged-overwrite rejection) —
 *   live in contracts/governance/SnapshotVerifier.spec.ts and run against the
 *   Tact-generated wrapper.
 *
 *   Since Issue #370 the RegisterSnapshot handler rejects every sender that is
 *   not the configured trusted indexer, and a missing snapshot denies
 *   eligibility (fail-closed, CONTRACTS-LOW / L-2). To keep this functional spec
 *   consistent with the deployed contract, each beforeEach below now authorizes
 *   `indexer` as the trusted indexer before any RegisterSnapshot is sent.
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Dictionary, Cell } from '@ton/core';
import { SnapshotVerifier } from '../../wrappers/SnapshotVerifier';
import '@ton/test-utils';

// TBC Diamonds total supply
const DIAMONDS_TOTAL_SUPPLY = 222n;

describe('SnapshotVerifier - Snapshot Registration', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;
    let indexer: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        indexer = await blockchain.treasury('indexer');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());

        const deployResult = await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            deploy: true,
            success: true,
        });

        // Sender authentication (Issue #370): authorize the off-chain indexer as
        // the trusted writer before any RegisterSnapshot is sent.
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'SetTrustedIndexer', indexer: indexer.address }
        );
    });

    describe('Register Snapshot', () => {
        it('should successfully register a snapshot for a proposal', async () => {
            // Create eligible NFTs map (simulating ownership snapshot)
            const eligibleNfts: Map<bigint, boolean> = new Map();
            eligibleNfts.set(1n, true);
            eligibleNfts.set(5n, true);
            eligibleNfts.set(10n, true);
            eligibleNfts.set(50n, true);
            eligibleNfts.set(100n, true);

            const result = await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: true,
            });

            // Verify snapshot was registered
            const hasSnapshot = await verifier.getHasSnapshot(1n);
            expect(hasSnapshot).toBe(true);

            // Verify eligible count
            const eligibleCount = await verifier.getEligibleCount(1n);
            expect(eligibleCount).toEqual(5n);
        });

        it('should reject duplicate snapshot for same proposal', async () => {
            const eligibleNfts: Map<bigint, boolean> = new Map();
            eligibleNfts.set(1n, true);

            // First registration
            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts,
                }
            );

            // Try duplicate registration
            const result = await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n, // Same proposal ID
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });

        it('should allow snapshots for different proposals', async () => {
            const eligibleNfts1: Map<bigint, boolean> = new Map();
            eligibleNfts1.set(1n, true);
            eligibleNfts1.set(2n, true);

            const eligibleNfts2: Map<bigint, boolean> = new Map();
            eligibleNfts2.set(3n, true);
            eligibleNfts2.set(4n, true);
            eligibleNfts2.set(5n, true);

            // Register snapshot for proposal 1
            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts1,
                }
            );

            // Register snapshot for proposal 2
            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 2n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts2,
                }
            );

            expect(await verifier.getHasSnapshot(1n)).toBe(true);
            expect(await verifier.getHasSnapshot(2n)).toBe(true);
            expect(await verifier.getEligibleCount(1n)).toEqual(2n);
            expect(await verifier.getEligibleCount(2n)).toEqual(3n);
        });

        it('should reject invalid proposal ID (0)', async () => {
            const eligibleNfts: Map<bigint, boolean> = new Map();
            eligibleNfts.set(1n, true);

            const result = await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 0n, // Invalid
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: eligibleNfts,
                }
            );

            expect(result.transactions).toHaveTransaction({
                success: false,
            });
        });
    });
});

describe('SnapshotVerifier - Eligibility Verification', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;
    let indexer: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        indexer = await blockchain.treasury('indexer');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());

        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Sender authentication (Issue #370): authorize the off-chain indexer as
        // the trusted writer before any RegisterSnapshot is sent.
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'SetTrustedIndexer', indexer: indexer.address }
        );

        // Register a snapshot
        const eligibleNfts: Map<bigint, boolean> = new Map();
        eligibleNfts.set(1n, true);
        eligibleNfts.set(10n, true);
        eligibleNfts.set(50n, true);
        eligibleNfts.set(100n, true);
        eligibleNfts.set(222n, true);

        await verifier.send(
            indexer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'RegisterSnapshot',
                proposal_id: 1n,
                timestamp: BigInt(Math.floor(Date.now() / 1000)),
                eligible_nfts: eligibleNfts,
            }
        );
    });

    describe('Verify Eligibility', () => {
        it('should return true for eligible NFT IDs', async () => {
            expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 10n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 50n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 100n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 222n)).toBe(true);
        });

        it('should return false for non-eligible NFT IDs', async () => {
            expect(await verifier.getIsEligible(1n, 2n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 5n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 99n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 200n)).toBe(false);
        });

        it('should return false for invalid NFT IDs', async () => {
            expect(await verifier.getIsEligible(1n, 0n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 223n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 1000n)).toBe(false);
        });

        it('should return false for invalid proposal IDs', async () => {
            expect(await verifier.getIsEligible(0n, 1n)).toBe(false);
            expect(await verifier.getIsEligible(-1n, 1n)).toBe(false);
        });

        it('denies eligibility for proposals without a snapshot (fail-closed)', async () => {
            // CONTRACTS-LOW / L-2: a missing snapshot must DENY eligibility rather
            // than treat every valid Diamond NFT as eligible. Proposal 999 has no
            // snapshot, so every NFT — valid or not — is ineligible.
            expect(await verifier.getIsEligible(999n, 1n)).toBe(false);
            expect(await verifier.getIsEligible(999n, 100n)).toBe(false);
            expect(await verifier.getIsEligible(999n, 222n)).toBe(false);

            // Invalid IDs are likewise rejected.
            expect(await verifier.getIsEligible(999n, 0n)).toBe(false);
            expect(await verifier.getIsEligible(999n, 223n)).toBe(false);
        });
    });

    describe('Snapshot Queries', () => {
        it('should return correct snapshot metadata', async () => {
            const snapshot = await verifier.getSnapshot(1n);

            expect(snapshot).not.toBeNull();
            expect(snapshot?.proposal_id).toEqual(1n);
            expect(snapshot?.eligible_count).toEqual(5n);
            expect(snapshot?.timestamp).toBeGreaterThan(0n);
        });

        it('should return null for non-existent snapshot', async () => {
            const snapshot = await verifier.getSnapshot(999n);
            expect(snapshot).toBeNull();
        });

        it('should return correct timestamp', async () => {
            const beforeTime = BigInt(Math.floor(Date.now() / 1000) - 10);
            const afterTime = BigInt(Math.floor(Date.now() / 1000) + 10);

            const timestamp = await verifier.getSnapshotTimestamp(1n);

            expect(timestamp).toBeGreaterThan(beforeTime);
            expect(timestamp).toBeLessThan(afterTime);
        });

        it('should return 0 timestamp for non-existent proposal', async () => {
            const timestamp = await verifier.getSnapshotTimestamp(999n);
            expect(timestamp).toEqual(0n);
        });
    });
});

describe('SnapshotVerifier - Correctness Tests', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<SnapshotVerifier>;
    let indexer: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        indexer = await blockchain.treasury('indexer');

        verifier = blockchain.openContract(await SnapshotVerifier.fromInit());

        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Sender authentication (Issue #370): authorize the off-chain indexer as
        // the trusted writer before any RegisterSnapshot is sent.
        await verifier.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'SetTrustedIndexer', indexer: indexer.address }
        );
    });

    describe('Snapshot Correctness', () => {
        it('should correctly count all eligible NFTs', async () => {
            // Create snapshot with all 222 NFTs eligible
            const allEligible: Map<bigint, boolean> = new Map();
            for (let i = 1n; i <= 222n; i++) {
                allEligible.set(i, true);
            }

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.5') }, // More gas for larger operation
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: allEligible,
                }
            );

            const eligibleCount = await verifier.getEligibleCount(1n);
            expect(eligibleCount).toEqual(222n);
        });

        it('should correctly handle partial eligibility', async () => {
            // Only odd-numbered NFTs are eligible (111 NFTs)
            const oddEligible: Map<bigint, boolean> = new Map();
            for (let i = 1n; i <= 222n; i += 2n) {
                oddEligible.set(i, true);
            }

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.3') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: oddEligible,
                }
            );

            const eligibleCount = await verifier.getEligibleCount(1n);
            expect(eligibleCount).toEqual(111n);

            // Verify odd numbers are eligible
            expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 3n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 221n)).toBe(true);

            // Verify even numbers are not eligible
            expect(await verifier.getIsEligible(1n, 2n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 4n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 222n)).toBe(false);
        });

        it('should preserve eligibility across proposals', async () => {
            // Proposal 1: First 100 NFTs eligible
            const first100: Map<bigint, boolean> = new Map();
            for (let i = 1n; i <= 100n; i++) {
                first100.set(i, true);
            }

            // Proposal 2: Last 100 NFTs eligible
            const last100: Map<bigint, boolean> = new Map();
            for (let i = 123n; i <= 222n; i++) {
                last100.set(i, true);
            }

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.3') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: first100,
                }
            );

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.3') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 2n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: last100,
                }
            );

            // Verify proposal 1 eligibility
            expect(await verifier.getIsEligible(1n, 50n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 150n)).toBe(false);

            // Verify proposal 2 eligibility
            expect(await verifier.getIsEligible(2n, 50n)).toBe(false);
            expect(await verifier.getIsEligible(2n, 150n)).toBe(true);

            // Verify counts
            expect(await verifier.getEligibleCount(1n)).toEqual(100n);
            expect(await verifier.getEligibleCount(2n)).toEqual(100n);
        });
    });

    describe('Boundary Conditions', () => {
        it('should handle minimum eligible count (1 NFT)', async () => {
            const singleEligible: Map<bigint, boolean> = new Map();
            singleEligible.set(1n, true);

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: singleEligible,
                }
            );

            expect(await verifier.getEligibleCount(1n)).toEqual(1n);
            expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 2n)).toBe(false);
        });

        it('should handle boundary NFT IDs (1 and 222)', async () => {
            const boundaries: Map<bigint, boolean> = new Map();
            boundaries.set(1n, true);  // First valid ID
            boundaries.set(222n, true); // Last valid ID

            await verifier.send(
                indexer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RegisterSnapshot',
                    proposal_id: 1n,
                    timestamp: BigInt(Math.floor(Date.now() / 1000)),
                    eligible_nfts: boundaries,
                }
            );

            expect(await verifier.getIsEligible(1n, 1n)).toBe(true);
            expect(await verifier.getIsEligible(1n, 222n)).toBe(true);

            // Adjacent invalid IDs
            expect(await verifier.getIsEligible(1n, 0n)).toBe(false);
            expect(await verifier.getIsEligible(1n, 223n)).toBe(false);
        });

        it('should return correct total supply constant', async () => {
            const totalSupply = await verifier.getDiamondsTotalSupply();
            expect(totalSupply).toEqual(222n);
        });
    });
});
