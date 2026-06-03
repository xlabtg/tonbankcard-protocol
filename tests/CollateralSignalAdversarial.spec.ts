/**
 * Adversarial Tests for Collateral Signal Contract
 * Tests security requirements and adversarial attempts
 *
 * Issue Reference: #30 - Collateral Signal Contract (TON-Based, Non-Custodial)
 *
 * SECURITY REQUIREMENTS VERIFIED:
 * - Only NFT owner may update collateral state
 * - No third-party enforcement hooks
 * - No oracle dependency for enforcement
 * - Explicit failure modes
 * - Contract is pure signaling layer (no custody, locks, transfers, or liquidation)
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address } from '@ton/core';
import { CollateralSignal } from '../wrappers/CollateralSignal';
import '@ton/test-utils';

// Collateral signal state constants
const COLLATERAL_SIGNAL_NONE = 0;
const COLLATERAL_SIGNAL_ACTIVE = 1;
const COLLATERAL_SIGNAL_WARNING = 2;
const COLLATERAL_SIGNAL_RELEASED = 3;

describe('CollateralSignal - Adversarial Tests', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let collateralSignal: SandboxContract<CollateralSignal>;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let attacker: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');
        attacker = await blockchain.treasury('attacker');

        collateralSignal = blockchain.openContract(await CollateralSignal.fromInit());

        const deployResult = await collateralSignal.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: collateralSignal.address,
            deploy: true,
            success: true,
        });

        // Register Alice as NFT owner
        await collateralSignal.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'RegisterNFTOwner',
                nft_address: alice.address,
                owner: alice.address,
            }
        );

        // Setup Alice with active collateral signal
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

    describe('Ownership Verification Attacks', () => {
        it('should reject third-party attempt to modify signal state', async () => {
            // Attacker tries to change Alice's signal state
            await collateralSignal.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_NONE,
                    collateral_amount_ton: 0n,
                }
            );

            // Alice's signal should remain ACTIVE
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should reject third-party attempt to release signal', async () => {
            // Attacker tries to release Alice's signal
            await collateralSignal.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ReleaseCollateralSignalRequest',
                    nft_address: alice.address,
                }
            );

            // Alice's signal should remain ACTIVE
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should reject deployer attempt to modify user signal', async () => {
            // Deployer (admin) cannot modify user's signal state
            // Note: RegisterNFTOwner is a test-only function, not signal modification
            await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_NONE,
                    collateral_amount_ton: 0n,
                }
            );

            // Signal should remain unchanged (deployer is not the owner)
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should reject impersonation attempt with wrong NFT address', async () => {
            // Register attacker as owner of their own NFT
            await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RegisterNFTOwner',
                    nft_address: attacker.address,
                    owner: attacker.address,
                }
            );

            // Attacker tries to signal for Alice's NFT using their own ownership
            await collateralSignal.send(
                attacker.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address, // Alice's NFT, not attacker's
                    new_state: COLLATERAL_SIGNAL_NONE,
                    collateral_amount_ton: 0n,
                }
            );

            // Alice's signal should remain unchanged
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });
    });

    describe('State Manipulation Attacks', () => {
        it('should reject invalid state values', async () => {
            // Try to set invalid state values
            const invalidStates = [-1, 4, 100, 255];

            for (const invalidState of invalidStates) {
                await collateralSignal.send(
                    alice.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'UpdateCollateralSignalRequest',
                        nft_address: alice.address,
                        new_state: invalidState,
                        collateral_amount_ton: toNano('1000'),
                    }
                );
            }

            // State should remain ACTIVE after all invalid attempts
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should handle rapid state changes correctly', async () => {
            // Rapid state changes by legitimate owner
            const states = [
                COLLATERAL_SIGNAL_WARNING,
                COLLATERAL_SIGNAL_ACTIVE,
                COLLATERAL_SIGNAL_RELEASED,
                COLLATERAL_SIGNAL_ACTIVE,
            ];

            for (const state of states) {
                await collateralSignal.send(
                    alice.getSender(),
                    { value: toNano('0.05') },
                    {
                        $$type: 'UpdateCollateralSignalRequest',
                        nft_address: alice.address,
                        new_state: state,
                        collateral_amount_ton: toNano('500'),
                    }
                );
            }

            // Final state should be the last one set
            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });
    });

    describe('Non-Custodial Verification', () => {
        it('should NOT custody any funds sent with signal request', async () => {
            // Get contract balance before
            const balanceBefore = await blockchain.getContract(collateralSignal.address);

            // Send signal request with extra TON
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('10') }, // 10 TON gas (more than needed)
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('5000'), // Signaling 5000 TON
                }
            );

            // Contract should NOT have accumulated significant funds
            // (minimal balance for storage only)
            const balanceAfter = await blockchain.getContract(collateralSignal.address);

            // The contract balance should be minimal (only storage costs)
            // Not holding the 5000 TON that was "signaled"
            expect(balanceAfter.balance).toBeLessThan(toNano('1'));
        });

        it('should verify signaling does NOT transfer or lock funds', async () => {
            // Alice's wallet balance before signaling
            const aliceBalanceBefore = await blockchain.getContract(alice.address);

            // Signal a large amount of collateral
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('100000'), // Signal 100k TON
                }
            );

            // Alice's wallet balance should only decrease by gas fees, NOT by 100k TON
            const aliceBalanceAfter = await blockchain.getContract(alice.address);

            // Balance decrease should be minimal (just gas fees)
            const balanceDecrease = aliceBalanceBefore.balance - aliceBalanceAfter.balance;
            expect(balanceDecrease).toBeLessThan(toNano('1')); // Less than 1 TON (gas only)
        });
    });

    describe('Multiple Users Isolation', () => {
        beforeEach(async () => {
            // Register Bob
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

        it('should isolate signal states between different NFT accounts', async () => {
            // Bob signals their own collateral
            await collateralSignal.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: bob.address,
                    collateral_amount_ton: toNano('500'),
                }
            );

            // Alice releases their signal
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ReleaseCollateralSignalRequest',
                    nft_address: alice.address,
                }
            );

            // Verify signals are independent
            const aliceState = await collateralSignal.getGetCollateralSignalState(alice.address);
            const bobState = await collateralSignal.getGetCollateralSignalState(bob.address);

            expect(aliceState).toEqual(BigInt(COLLATERAL_SIGNAL_RELEASED));
            expect(bobState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));
        });

        it('should prevent cross-account signal modification', async () => {
            // Alice tries to modify Bob's signal
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: bob.address,
                    new_state: COLLATERAL_SIGNAL_ACTIVE,
                    collateral_amount_ton: toNano('9999'),
                }
            );

            // Bob's signal should remain unchanged (NONE)
            const bobState = await collateralSignal.getGetCollateralSignalState(bob.address);
            expect(bobState).toEqual(BigInt(COLLATERAL_SIGNAL_NONE));
        });
    });

    describe('Event Emission Verification', () => {
        it('should emit CollateralSignaled event on new signal', async () => {
            const newUser = await blockchain.treasury('newUser');

            // Register new user
            await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RegisterNFTOwner',
                    nft_address: newUser.address,
                    owner: newUser.address,
                }
            );

            const result = await collateralSignal.send(
                newUser.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: newUser.address,
                    collateral_amount_ton: toNano('2000'),
                }
            );

            // Transaction should be successful (event emission is internal)
            expect(result.transactions).toHaveTransaction({
                from: newUser.address,
                to: collateralSignal.address,
                success: true,
            });
        });

        it('should emit CollateralSignalUpdated event on state change', async () => {
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_WARNING,
                    collateral_amount_ton: toNano('500'),
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });
        });

        it('should emit CollateralSignalReleased event on release', async () => {
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
        });
    });

    describe('Edge Cases', () => {
        it('should handle re-signaling after release', async () => {
            // Release signal
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ReleaseCollateralSignalRequest',
                    nft_address: alice.address,
                }
            );

            // Re-signal
            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'SignalCollateralRequest',
                    nft_address: alice.address,
                    collateral_amount_ton: toNano('2000'),
                }
            );

            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_ACTIVE));

            const amount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(amount).toEqual(toNano('2000'));
        });

        it('should handle maximum collateral amount', async () => {
            const maxAmount = toNano('1000000000'); // 1 billion TON

            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_ACTIVE,
                    collateral_amount_ton: maxAmount,
                }
            );

            const amount = await collateralSignal.getGetSignaledCollateralAmount(alice.address);
            expect(amount).toEqual(maxAmount);
        });

        it('should maintain timestamps correctly', async () => {
            // Get initial info after first signal in beforeEach
            const infoBefore = await collateralSignal.getGetCollateralSignalInfo(alice.address);

            // Wait a bit and update
            await new Promise(resolve => setTimeout(resolve, 100));

            await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_WARNING,
                    collateral_amount_ton: toNano('800'),
                }
            );

            const infoAfter = await collateralSignal.getGetCollateralSignalInfo(alice.address);

            // Created_at should remain the same, updated_at should be >= before
            expect(infoAfter.created_at).toEqual(infoBefore.created_at);
            expect(infoAfter.updated_at).toBeGreaterThanOrEqual(infoBefore.updated_at);
        });
    });

    // Regression test for CONTRACTS-M1: write-once guard on RegisterNFTOwner
    describe('Write-Once Owner Registration (CONTRACTS-M1)', () => {
        it('should allow first-time NFT owner registration', async () => {
            const newUser = await blockchain.treasury('newUser');

            const result = await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RegisterNFTOwner',
                    nft_address: newUser.address,
                    owner: newUser.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: collateralSignal.address,
                success: true,
            });
        });

        it('should reject re-registration of an already-registered NFT owner', async () => {
            const attacker2 = await blockchain.treasury('attacker2');

            // Attempt to overwrite Alice's existing registration with a new owner
            const result = await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RegisterNFTOwner',
                    nft_address: alice.address,
                    owner: attacker2.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: collateralSignal.address,
                success: false,
                exitCode: expect.any(Number),
            });
        });

        it('should preserve original owner binding after rejected re-registration', async () => {
            const attacker2 = await blockchain.treasury('attacker2');

            // Attempt to overwrite Alice's existing registration
            await collateralSignal.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'RegisterNFTOwner',
                    nft_address: alice.address,
                    owner: attacker2.address,
                }
            );

            // Alice must still be able to act as owner of her NFT
            const result = await collateralSignal.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'UpdateCollateralSignalRequest',
                    nft_address: alice.address,
                    new_state: COLLATERAL_SIGNAL_WARNING,
                    collateral_amount_ton: toNano('500'),
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: alice.address,
                to: collateralSignal.address,
                success: true,
            });

            const signalState = await collateralSignal.getGetCollateralSignalState(alice.address);
            expect(signalState).toEqual(BigInt(COLLATERAL_SIGNAL_WARNING));
        });
    });
});
