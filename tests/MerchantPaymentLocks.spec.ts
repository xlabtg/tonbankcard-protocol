/**
 * Unit Tests for Lock Enforcement
 * Tests merchant payments with account locks (fraud and collateral)
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { MerchantPaymentHub } from '../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('MerchantPaymentHub - Lock Enforcement', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<MerchantPaymentHub>;
    let payer: SandboxContract<TreasuryContract>;
    let merchant: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        payer = await blockchain.treasury('payer');
        merchant = await blockchain.treasury('merchant');

        paymentHub = blockchain.openContract(await MerchantPaymentHub.fromInit());

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        // Setup payer account
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountState',
                nft_address: payer.address,
                state: 0, // ACTIVE
                owner: payer.address,
            }
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountBalance',
                nft_address: payer.address,
                balance: toNano('10000'),
            }
        );

        // Setup merchant account
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'SetAccountState',
                nft_address: merchant.address,
                state: 0, // ACTIVE
                owner: merchant.address,
            }
        );
    });

    describe('Fraud Lock Enforcement', () => {
        it('should fail when payer has FRAUD_LOCK', async () => {
            // Apply fraud lock to payer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: payer.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            // Try to make payment (should fail)
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Payment should fail
            const payerBalance = await paymentHub.getBalance(payer.address);
            const merchantBalance = await paymentHub.getBalance(merchant.address);

            expect(payerBalance).toEqual(toNano('10000')); // Unchanged
            expect(merchantBalance).toEqual(0n); // No payment received
        });

        it('should succeed when merchant has FRAUD_LOCK (can receive)', async () => {
            // Apply fraud lock to merchant
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: merchant.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            // Payment should succeed (merchant can receive)
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });

            const merchantBalance = await paymentHub.getBalance(merchant.address);
            expect(merchantBalance).toEqual(toNano('100'));
        });
    });

    describe('Collateral Lock Enforcement', () => {
        it('should fail when payer has COLLATERAL_LOCK', async () => {
            // Apply collateral lock to payer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: payer.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            // Try to make payment (should fail)
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Payment should fail
            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('10000')); // Unchanged
        });

        it('should succeed when merchant has COLLATERAL_LOCK (can receive)', async () => {
            // Apply collateral lock to merchant
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: merchant.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: false,
                        collateral_locked: true,
                    },
                }
            );

            // Payment should succeed
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });

            const merchantBalance = await paymentHub.getBalance(merchant.address);
            expect(merchantBalance).toEqual(toNano('100'));
        });
    });

    describe('Multiple Lock Enforcement', () => {
        it('should fail when payer has both FRAUD_LOCK and COLLATERAL_LOCK', async () => {
            // Apply both locks to payer
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: payer.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: true,
                    },
                }
            );

            // Try to make payment (should fail)
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Payment should fail
            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('10000')); // Unchanged
        });

        it('should succeed when merchant has both locks (can still receive)', async () => {
            // Apply both locks to merchant
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: merchant.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: true,
                    },
                }
            );

            // Payment should succeed
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });

            const merchantBalance = await paymentHub.getBalance(merchant.address);
            expect(merchantBalance).toEqual(toNano('100'));
        });
    });

    describe('Lock Query Functions', () => {
        it('should correctly report lock state', async () => {
            // Set specific lock state
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountLock',
                    nft_address: payer.address,
                    lock_state: {
                        $$type: 'LockState',
                        fraud_locked: true,
                        collateral_locked: false,
                    },
                }
            );

            const isLocked = await paymentHub.getIsAccountLocked(payer.address);
            const hasFraudLock = await paymentHub.getHasFraudLock(payer.address);
            const hasCollateralLock = await paymentHub.getHasCollateralLock(payer.address);

            expect(isLocked).toBe(true);
            expect(hasFraudLock).toBe(true);
            expect(hasCollateralLock).toBe(false);
        });
    });
});
