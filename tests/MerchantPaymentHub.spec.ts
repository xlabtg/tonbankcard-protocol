/**
 * Unit Tests for Merchant Payment Hub
 * Tests basic merchant payment functionality
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell } from '@ton/core';
import { MerchantPaymentHub } from '../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('MerchantPaymentHub - Basic Functionality', () => {
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

        const deployResult = await paymentHub.send(
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
            to: paymentHub.address,
            deploy: true,
            success: true,
        });
    });

    describe('Static Merchant Payment', () => {
        it('should successfully process a basic merchant payment', async () => {
            // Setup payer account with balance
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
                    balance: toNano('1000'), // 1000 TBC
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

            // Execute payment
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'), // 100 TBC
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });

            // Verify balances
            const payerBalance = await paymentHub.getBalance(payer.address);
            const merchantBalance = await paymentHub.getBalance(merchant.address);

            expect(payerBalance).toEqual(toNano('900')); // 1000 - 100
            expect(merchantBalance).toEqual(toNano('100')); // 0 + 100
        });

        it('should fail when payer has insufficient balance', async () => {
            // Setup payer with low balance
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: payer.address,
                    state: 0,
                    owner: payer.address,
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountBalance',
                    nft_address: payer.address,
                    balance: toNano('50'), // Only 50 TBC
                }
            );

            // Setup merchant
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 0,
                    owner: merchant.address,
                }
            );

            // Try to pay 100 TBC (should fail)
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

            // Should receive error response
            expect(paymentResult.transactions).toHaveTransaction({
                from: paymentHub.address,
                to: payer.address,
                success: true,
            });

            // Balances should not change
            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('50'));
        });

        it('should fail when amount is zero', async () => {
            // Setup accounts
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: payer.address,
                    state: 0,
                    owner: payer.address,
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountBalance',
                    nft_address: payer.address,
                    balance: toNano('1000'),
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 0,
                    owner: merchant.address,
                }
            );

            // Try payment with zero amount
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: 0n,
                    payload: null,
                }
            );

            // Should fail with error
            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('1000')); // Unchanged
        });

        it('should fail when sender is not the NFT owner', async () => {
            const unauthorizedSender = await blockchain.treasury('unauthorized');

            // Setup payer account
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: payer.address,
                    state: 0,
                    owner: payer.address, // Real owner
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountBalance',
                    nft_address: payer.address,
                    balance: toNano('1000'),
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 0,
                    owner: merchant.address,
                }
            );

            // Try payment from unauthorized sender
            const paymentResult = await paymentHub.send(
                unauthorizedSender.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            // Should fail
            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('1000')); // Unchanged
        });
    });
});
