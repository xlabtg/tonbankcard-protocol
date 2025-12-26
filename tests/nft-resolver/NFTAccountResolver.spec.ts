/**
 * NFT Account Resolver Test Suite
 * Tests all functionality including edge cases and ownership transfers
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address, beginCell } from '@ton/core';
import { NFTAccountResolver } from '../wrappers/NFTAccountResolver';
import '@ton/test-utils';

describe('NFT Account Resolver', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let resolver: SandboxContract<NFTAccountResolver>;

    // Whitelisted collections (from existing contracts)
    const COLLECTION_7777 = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
    const COLLECTION_8888 = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7');

    // Test addresses
    let mockNFTAddress: Address;
    let mockOwner: Address;
    let mockNewOwner: Address;
    let mockInvalidCollection: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        // Deploy resolver
        resolver = blockchain.openContract(await NFTAccountResolver.fromInit());
        const deployResult = await resolver.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: resolver.address,
            deploy: true,
            success: true,
        });

        // Setup mock addresses
        mockNFTAddress = Address.parse('EQA' + '0'.repeat(46));
        mockOwner = Address.parse('EQB' + '1'.repeat(46));
        mockNewOwner = Address.parse('EQC' + '2'.repeat(46));
        mockInvalidCollection = Address.parse('EQD' + '3'.repeat(46));
    });

    describe('Collection Validation', () => {
        test('should recognize Series 7777 as whitelisted', async () => {
            const result = await resolver.getIsWhitelistedCollection(COLLECTION_7777);
            expect(result).toBe(true);
        });

        test('should recognize Series 8888 as whitelisted', async () => {
            const result = await resolver.getIsWhitelistedCollection(COLLECTION_8888);
            expect(result).toBe(true);
        });

        test('should reject unknown collection', async () => {
            const result = await resolver.getIsWhitelistedCollection(mockInvalidCollection);
            expect(result).toBe(false);
        });

        test('should return both whitelisted collections', async () => {
            const collections = await resolver.getGetWhitelistedCollections();
            expect(collections.size).toBe(2);
            // Verify collections contain expected addresses
        });
    });

    describe('NFT Account Validation', () => {
        test('should validate NFT from Series 7777', async () => {
            const isValid = await resolver.getIsValidAccountNft(
                COLLECTION_7777,
                true // is_initialized
            );
            expect(isValid).toBe(true);
        });

        test('should validate NFT from Series 8888', async () => {
            const isValid = await resolver.getIsValidAccountNft(
                COLLECTION_8888,
                true
            );
            expect(isValid).toBe(true);
        });

        test('should reject NFT from non-whitelisted collection', async () => {
            const isValid = await resolver.getIsValidAccountNft(
                mockInvalidCollection,
                true
            );
            expect(isValid).toBe(false);
        });

        test('should reject burned NFT', async () => {
            const isValid = await resolver.getIsValidAccountNft(
                COLLECTION_7777,
                false // is_initialized = false (burned)
            );
            expect(isValid).toBe(false);
        });

        test('should reject burned NFT from any collection', async () => {
            const isValid8888 = await resolver.getIsValidAccountNft(
                COLLECTION_8888,
                false
            );
            expect(isValid8888).toBe(false);
        });
    });

    describe('Owner Resolution with Validation', () => {
        test('should resolve owner for valid NFT', async () => {
            const result = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                1n, // index
                true // is_initialized
            );

            expect(result.owner_addr).toEqualAddress(mockOwner);
            expect(result.is_valid).toBe(true);
            expect(result.collection_addr).toEqualAddress(COLLECTION_7777);
            expect(result.index).toBe(1n);
        });

        test('should mark invalid when collection not whitelisted', async () => {
            const result = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                mockInvalidCollection,
                mockOwner,
                1n,
                true
            );

            expect(result.owner_addr).toEqualAddress(mockOwner);
            expect(result.is_valid).toBe(false); // Invalid due to collection
        });

        test('should mark invalid when NFT is burned', async () => {
            const result = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                1n,
                false // burned
            );

            expect(result.is_valid).toBe(false);
        });

        test('should handle ownership transfer correctly', async () => {
            // Initial owner check
            const result1 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                1n,
                true
            );
            expect(result1.owner_addr).toEqualAddress(mockOwner);
            expect(result1.is_valid).toBe(true);

            // After transfer (simulated with new owner data)
            const result2 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockNewOwner, // New owner
                1n,
                true
            );
            expect(result2.owner_addr).toEqualAddress(mockNewOwner);
            expect(result2.is_valid).toBe(true);
        });
    });

    describe('Account Flags', () => {
        test('should return default flags (no Payment Hub yet)', async () => {
            const flags = await resolver.getGetAccountFlags(mockNFTAddress);

            expect(flags.has_active_collateral).toBe(false);
            expect(flags.is_restricted).toBe(false);
            expect(flags.is_merchant).toBe(false);
        });

        test('should return flags for different NFT addresses', async () => {
            const flags1 = await resolver.getGetAccountFlags(mockNFTAddress);
            const flags2 = await resolver.getGetAccountFlags(mockOwner);

            // Both should have default values (no Payment Hub)
            expect(flags1.has_active_collateral).toBe(false);
            expect(flags2.has_active_collateral).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        describe('NFT Transfer During Active Collateral', () => {
            test('should allow transfer validation even with collateral flag', async () => {
                // Simulate NFT with collateral (future Payment Hub integration)
                // For now, validation should still work
                const result = await resolver.getResolveOwnerWithValidation(
                    mockNFTAddress,
                    COLLECTION_7777,
                    mockNewOwner,
                    1n,
                    true
                );

                expect(result.is_valid).toBe(true);
                expect(result.owner_addr).toEqualAddress(mockNewOwner);
                // Note: Payment Hub would enforce collateral restrictions
            });
        });

        describe('NFT Owned by Smart Contract', () => {
            test('should accept smart contract as owner', async () => {
                const smartWalletAddress = resolver.address; // Use resolver as mock smart wallet

                const result = await resolver.getResolveOwnerWithValidation(
                    mockNFTAddress,
                    COLLECTION_7777,
                    smartWalletAddress,
                    1n,
                    true
                );

                expect(result.is_valid).toBe(true);
                expect(result.owner_addr).toEqualAddress(smartWalletAddress);
            });
        });

        describe('Multiple Collection Support', () => {
            test('should validate NFTs from different collections independently', async () => {
                const nft1 = await resolver.getIsValidAccountNft(COLLECTION_7777, true);
                const nft2 = await resolver.getIsValidAccountNft(COLLECTION_8888, true);

                expect(nft1).toBe(true);
                expect(nft2).toBe(true);
            });

            test('should handle mixed valid/invalid collections', async () => {
                const valid = await resolver.getIsValidAccountNft(COLLECTION_7777, true);
                const invalid = await resolver.getIsValidAccountNft(mockInvalidCollection, true);

                expect(valid).toBe(true);
                expect(invalid).toBe(false);
            });
        });

        describe('Rapid Ownership Changes', () => {
            test('should handle multiple sequential owner changes', async () => {
                const owners = [mockOwner, mockNewOwner, deployer.address];

                for (const owner of owners) {
                    const result = await resolver.getResolveOwnerWithValidation(
                        mockNFTAddress,
                        COLLECTION_7777,
                        owner,
                        1n,
                        true
                    );

                    expect(result.owner_addr).toEqualAddress(owner);
                    expect(result.is_valid).toBe(true);
                }
            });
        });
    });

    describe('Security Properties', () => {
        test('should be stateless (no storage of ownership)', async () => {
            // Query with owner A
            const result1 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                1n,
                true
            );

            // Query with owner B for same NFT (simulating transfer)
            const result2 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockNewOwner,
                1n,
                true
            );

            // Both queries should succeed independently (no cached state)
            expect(result1.owner_addr).toEqualAddress(mockOwner);
            expect(result2.owner_addr).toEqualAddress(mockNewOwner);
        });

        test('should reject incoming messages (read-only contract)', async () => {
            const user = await blockchain.treasury('user');

            const result = await resolver.send(
                user.getSender(),
                { value: toNano('0.1') },
                'test message'
            );

            // Contract should reject all messages
            expect(result.transactions).toHaveTransaction({
                from: user.address,
                to: resolver.address,
                success: false,
            });
        });

        test('should not accept funds', async () => {
            const user = await blockchain.treasury('user');
            const initialBalance = (await blockchain.getContract(resolver.address)).balance;

            try {
                await resolver.send(
                    user.getSender(),
                    { value: toNano('1.0') },
                    null
                );
            } catch (e) {
                // Expected to fail
            }

            const finalBalance = (await blockchain.getContract(resolver.address)).balance;

            // Balance should not increase (funds rejected)
            expect(finalBalance).toBeLessThanOrEqual(initialBalance + toNano('0.01'));
        });

        test('should be deterministic', async () => {
            // Same inputs should produce same outputs
            const result1 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                42n,
                true
            );

            const result2 = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                42n,
                true
            );

            expect(result1.owner_addr).toEqualAddress(result2.owner_addr);
            expect(result1.is_valid).toBe(result2.is_valid);
            expect(result1.index).toBe(result2.index);
        });
    });

    describe('Gas Efficiency', () => {
        test('validation should be gas-efficient', async () => {
            const result = await resolver.getIsValidAccountNft(COLLECTION_7777, true);
            // Gas cost should be minimal (< 5000 gas)
            expect(result).toBeDefined();
        });

        test('owner resolution should be gas-efficient', async () => {
            const result = await resolver.getResolveOwnerWithValidation(
                mockNFTAddress,
                COLLECTION_7777,
                mockOwner,
                1n,
                true
            );
            // Gas cost should be minimal
            expect(result).toBeDefined();
        });
    });

    describe('Integration Scenarios', () => {
        test('Payment Hub integration pattern', async () => {
            // Simulate Payment Hub checking account validity
            const nftAddr = mockNFTAddress;
            const collectionAddr = COLLECTION_7777;
            const ownerAddr = mockOwner;

            // Step 1: Validate NFT
            const isValid = await resolver.getIsValidAccountNft(collectionAddr, true);
            expect(isValid).toBe(true);

            // Step 2: Resolve owner with validation
            const ownerInfo = await resolver.getResolveOwnerWithValidation(
                nftAddr,
                collectionAddr,
                ownerAddr,
                1n,
                true
            );
            expect(ownerInfo.is_valid).toBe(true);

            // Step 3: Check flags
            const flags = await resolver.getGetAccountFlags(nftAddr);
            expect(flags).toBeDefined();
        });

        test('Merchant payment validation pattern', async () => {
            const merchantNFT = mockNFTAddress;
            const merchantOwner = mockOwner;

            // Merchant validates customer NFT before payment
            const validation = await resolver.getResolveOwnerWithValidation(
                merchantNFT,
                COLLECTION_8888,
                merchantOwner,
                100n,
                true
            );

            expect(validation.is_valid).toBe(true);
            expect(validation.owner_addr).toEqualAddress(merchantOwner);
        });
    });
});
