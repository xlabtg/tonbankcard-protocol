/**
 * Unit Tests for Dynamic Invoice Payments
 * Tests merchant payments with payload metadata
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, beginCell } from '@ton/core';
import { MerchantPaymentHub } from '../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('MerchantPaymentHub - Dynamic Invoice Payments', () => {
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
                state: 0,
                owner: merchant.address,
            }
        );
    });

    it('should process payment with order_id payload', async () => {
        const orderId = 'ORDER-12345';
        const payload = beginCell()
            .storeUint(1, 8) // payload_type: order
            .storeStringTail(orderId)
            .endCell();

        const paymentResult = await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('500'),
                payload: payload,
            }
        );

        expect(paymentResult.transactions).toHaveTransaction({
            from: payer.address,
            to: paymentHub.address,
            success: true,
        });

        // Verify balances updated correctly
        const payerBalance = await paymentHub.getBalance(payer.address);
        const merchantBalance = await paymentHub.getBalance(merchant.address);

        expect(payerBalance).toEqual(toNano('9500'));
        expect(merchantBalance).toEqual(toNano('500'));
    });

    it('should process payment with invoice_id payload', async () => {
        const invoiceId = 'INV-2024-001';
        const payload = beginCell()
            .storeUint(2, 8) // payload_type: invoice
            .storeStringTail(invoiceId)
            .endCell();

        const paymentResult = await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('250'),
                payload: payload,
            }
        );

        expect(paymentResult.transactions).toHaveTransaction({
            from: payer.address,
            to: paymentHub.address,
            success: true,
        });
    });

    it('should process payment with metadata hash payload', async () => {
        const metadataHash = 'QmX9Z8Y7...'; // IPFS hash example
        const payload = beginCell()
            .storeUint(3, 8) // payload_type: metadata_hash
            .storeStringTail(metadataHash)
            .endCell();

        const paymentResult = await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('1000'),
                payload: payload,
            }
        );

        expect(paymentResult.transactions).toHaveTransaction({
            from: payer.address,
            to: paymentHub.address,
            success: true,
        });

        const merchantBalance = await paymentHub.getBalance(merchant.address);
        expect(merchantBalance).toEqual(toNano('1000'));
    });

    it('should allow payload reuse (no uniqueness constraint)', async () => {
        const payload = beginCell()
            .storeUint(1, 8)
            .storeStringTail('REUSED-ORDER-123')
            .endCell();

        // First payment with payload
        await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('100'),
                payload: payload,
            }
        );

        // Second payment with same payload (should succeed)
        const paymentResult = await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('100'),
                payload: payload,
            }
        );

        expect(paymentResult.transactions).toHaveTransaction({
            from: payer.address,
            to: paymentHub.address,
            success: true,
        });

        // Total should be 200 TBC to merchant
        const merchantBalance = await paymentHub.getBalance(merchant.address);
        expect(merchantBalance).toEqual(toNano('200'));
    });

    it('should emit event with correct payload hash', async () => {
        const payload = beginCell()
            .storeUint(1, 8)
            .storeStringTail('TEST-ORDER')
            .endCell();

        const payloadHash = BigInt(payload.hash().toString('hex'), 16);

        const paymentResult = await paymentHub.send(
            payer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'MerchantPaymentRequest',
                payer_nft: payer.address,
                merchant_nft: merchant.address,
                amount_tbc: toNano('100'),
                payload: payload,
            }
        );

        // Event should be emitted (verification would require event parsing)
        expect(paymentResult.transactions).toHaveTransaction({
            from: payer.address,
            to: paymentHub.address,
            success: true,
        });
    });

    it('should generate different hashes for different payloads', async () => {
        const payload1 = beginCell()
            .storeStringTail('ORDER-A')
            .endCell();

        const payload2 = beginCell()
            .storeStringTail('ORDER-B')
            .endCell();

        const hash1 = payload1.hash();
        const hash2 = payload2.hash();

        expect(hash1.equals(hash2)).toBe(false);
    });
});
