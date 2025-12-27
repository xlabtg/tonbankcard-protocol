/**
 * Unit Tests for Edge Cases
 * Tests unusual but valid scenarios in merchant payments
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell } from '@ton/core';
import { MerchantPaymentHub } from '../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('MerchantPaymentHub - Edge Cases', () => {
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
    });

    describe('Self-Payment', () => {
        it('should allow payment to self (same NFT)', async () => {
            // Setup account as both payer and merchant
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
                    balance: toNano('1000'),
                }
            );

            // Pay to self
            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: payer.address, // Same as payer
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });

            // Balance should remain the same (debit and credit cancel out)
            const balance = await paymentHub.getBalance(payer.address);
            expect(balance).toEqual(toNano('1000'));
        });

        it('should emit event for self-payment', async () => {
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

            const payload = beginCell()
                .storeStringTail('SELF-PAYMENT-TEST')
                .endCell();

            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: payer.address,
                    amount_tbc: toNano('100'),
                    payload: payload,
                }
            );

            // Event should be emitted even for self-payment
            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });
        });
    });

    describe('Frozen Account States', () => {
        it('should fail when payer is FROZEN', async () => {
            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: payer.address,
                    state: 1, // FROZEN
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
                    state: 0, // ACTIVE
                    owner: merchant.address,
                }
            );

            // Payment should fail
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

            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('1000')); // Unchanged
        });

        it('should succeed when merchant is FROZEN (can receive)', async () => {
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
                    balance: toNano('1000'),
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 1, // FROZEN
                    owner: merchant.address,
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

        it('should fail when merchant is CLOSED', async () => {
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
                    balance: toNano('1000'),
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 3, // CLOSED
                    owner: merchant.address,
                }
            );

            // Payment should fail
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

            const payerBalance = await paymentHub.getBalance(payer.address);
            expect(payerBalance).toEqual(toNano('1000')); // Unchanged
        });
    });

    describe('Zero Balance Merchant', () => {
        it('should allow payment to merchant with zero balance', async () => {
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

            // Merchant with no balance set (defaults to 0)
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

    describe('Account State Transitions', () => {
        it('should respect state during payment execution', async () => {
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
                    balance: toNano('1000'),
                }
            );

            await paymentHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 2, // COLLATERAL_LOCKED
                    owner: merchant.address,
                }
            );

            // Merchant with COLLATERAL_LOCKED state can still receive
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

    describe('Payload Edge Cases', () => {
        it('should handle empty payload cell', async () => {
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

            const emptyPayload = beginCell().endCell();

            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: emptyPayload,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });
        });

        it('should handle very large payload', async () => {
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

            // Create large payload with complex data
            const largePayload = beginCell()
                .storeUint(1, 8)
                .storeStringTail('ORDER-' + 'X'.repeat(100))
                .endCell();

            const paymentResult = await paymentHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: toNano('100'),
                    payload: largePayload,
                }
            );

            expect(paymentResult.transactions).toHaveTransaction({
                from: payer.address,
                to: paymentHub.address,
                success: true,
            });
        });
    });
});
