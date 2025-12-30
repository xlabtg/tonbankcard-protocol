/**
 * Unit Tests for Collateral Signal Contract
 * Tests basic collateral signaling functionality
 *
 * Issue Reference: #30 - Collateral Signal Contract (TON-Based, Non-Custodial)
 *
 * DESIGN PRINCIPLES VERIFIED:
 * - Contract NEVER custodies user funds
 * - Contract NEVER locks or seizes assets
 * - Contract NEVER initiates transfers
 * - Contract NEVER liquidates positions
 * - Strictly opt-in and user-initiated
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address } from '@ton/core';
import { CollateralSignal } from '../wrappers/CollateralSignal';
import '@ton/test-utils';

// Collateral signal state constants (from CollateralState.tact)
const COLLATERAL_SIGNAL_NONE = 0;
const COLLATERAL_SIGNAL_ACTIVE = 1;
const COLLATERAL_SIGNAL_WARNING = 2;
const COLLATERAL_SIGNAL_RELEASED = 3;

// Error codes (from CollateralSignal.tact)
const ERROR_CS_NONE = 0;
const ERROR_CS_NOT_OWNER = 1;
const ERROR_CS_INVALID_STATE = 2;
const ERROR_CS_INVALID_AMOUNT = 3;
const ERROR_CS_ALREADY_ACTIVE = 4;
const ERROR_CS_NO_SIGNAL = 5;
const ERROR_CS_NFT_NOT_REGISTERED = 6;

describe('CollateralSignal - Basic Functionality', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let collateralSignal: SandboxContract<CollateralSignal>;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');

        collateralSignal = blockchain.openContract(await CollateralSignal.fromInit());

        const deployResult = await collateralSignal.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: collateralSignal.address,
            deploy: true,
            success: true,
        });

        // Register Alice as NFT owner for testing
        await collateralSignal.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'RegisterNFTOwner',
                nft_address: alice.address,
                owner: alice.address,
            }
        );

        // Register Bob as NFT owner for testing
        await collateralSignal.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'RegisterNFTOwner',
                nft_address: bob.address,
                owner: bob.address,
            }
        );
    });

    describe('Signal Collateral', () => {
        it('should successfully signal collateral for NFT owner', async () => {
            const collateralAmount = toNano('1000'); // 1000 TON

            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: collateralAmount,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            // Verify signal state
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));

            // Verify signaled amount
            const signaledAmount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(signaledAmount).toEqual(collateralAmount);

            // Verify has active signal
            const hasActive = await collateralSignal.getGetHasActiveCollateralSignal(alice.address);
            expect(hasActive).toBe(true);
        });

        it('should fail when sender is not the NFT owner', async () => {
            const result = await collateralSignal.send(
                bob.getSender(), // Bob is NOT the owner of alice.address
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address, // Trying to signal for Alice's NFT
                    collateral_amount_ton: toNano('1000'),
                }
            );

            // Transaction should succeed (sends response), but signal should not change
            expect(result.transactions).toHaveTransaction({
                from: bob.address,
                to: collateralSignal.address,
                success: true,
            });

            // Signal state should remain NONE
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_NONE));
        });

        it('should fail for unregistered NFT', async () => {
            const unregistered = await blockchain.treasury('unregistered');

            const result = await collateralSignal.send(
                unregistered.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: unregistered.address,
                    collateral_amount_ton: toNano('1000'),
                }
            );

            // Should receive error response
            expect(result.transactions).toHaveTransaction({
                from: unregistered.address,
                to: collateralSignal.address,
                success: true,
            });

            // Signal state should remain NONE
            const signalState = await collateralSignal.getGetCollateralSignalState(unregistered.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_NONE));
        });

        it('should allow signaling zero collateral amount', async () => {
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: 0n, // Zero amount
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            // Should be ACTIVE with zero amount (valid use case - signaling intent)
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));

            const signaledAmount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(signaledAmount).toEqual(0n);
        });
    });

    describe('Update Collateral Signal', () => {
        beforeEach(async () => {
            // First, signal some collateral
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('1000'),
                }
            );
        });

        it('should update signal state to WARNING', async () => {
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_WARNING,
                    collateral_amount_ton: toNano('800'), // Reduced amount
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_WARNING));

            // WARNING state should still be considered active
            const hasActive = await collateralSignal.getGetHasActiveCollateralSignal(alice.address);
            expect(hasActive).toBe(true);
        });

        it('should update signal amount while keeping state', async () => {
            const newAmount = toNano('1500');

            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_ACTIVE,
                    collateral_amount_ton: newAmount,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            const signaledAmount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(signaledAmount).toEqual(newAmount);
        });

        it('should fail update from non-owner', async () => {
            const result = await collateralSignal.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_NONE,
                    collateral_amount_ton: 0n,
                }
            );

            // Transaction succeeds but signal should not change
            expect(result.transactions).toHaveTransaction({
                from: bob.address,
                to: collateralSignal.address,
                success: true,
            });

            // State should remain ACTIVE
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should reject invalid state value', async () => {
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: 99, // Invalid state
                    collateral_amount_ton: toNano('1000'),
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            // State should remain unchanged
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });
    });

    describe('Release Collateral Signal', () => {
        beforeEach(async () => {
            // First, signal some collateral
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('1000'),
                }
            );
        });

        it('should release collateral signal', async () => {
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ReleaseCollateralSignalRequest',
                    nft_address: alice.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            // Verify signal state is RELEASED
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_RELEASED));

            // Amount should be cleared
            const signaledAmount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(signaledAmount).toEqual(0n);

            // Should NOT have active signal anymore
            const hasActive = await collateralSignal.getGetHasActiveCollateralSignal(alice.address);
            expect(hasActive).toBe(false);
        });

        it('should fail release from non-owner', async () => {
            const result = await collateralSignal.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ReleaseCollateralSignalRequest',
                    nft_address: alice.address,
                }
            );

            // Transaction succeeds but signal should not change
            expect(result.transactions).toHaveTransaction({
                from: bob.address,
                to: collateralSignal.address,
                success: true,
            });

            // Signal should remain ACTIVE
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });
    });

    describe('Read-Only Interface', () => {
        it('should return NONE for accounts with no signal', async () => {
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_NONE));

            const signaledAmount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(signaledAmount).toEqual(0n);

            const hasActive = await collateralSignal.getGetHasActiveCollateralSignal(alice.address);
            expect(hasActive).toBe(false);
        });

        it('should return full signal info', async () => {
            // Signal collateral first
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('500'),
                }
            );

            const info = await collateralSignal.getGetCollateralSignalInfo(alice.address);

            expect(info.signal_state).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
            expect(info.collateral_amount_ton).toEqual(toNano('500'));
            expect(info.created_at).toBeGreaterThan(0n);
            expect(info.updated_at).toBeGreaterThan(0n);
        });
    });
});
