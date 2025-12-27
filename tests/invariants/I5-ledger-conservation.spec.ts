/**
 * INVARIANT I5: Ledger Conservation
 *
 * Tests that verify conservation of funds:
 * - Sum of balances before = sum of balances after
 * - No funds created or destroyed during transfers
 * - Internal transfers have zero fees
 * - No rounding errors
 *
 * Reference: docs/invariants.md - I5
 */

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { PaymentHub } from '../../wrappers/PaymentHub';
import { MerchantPaymentHub } from '../../wrappers/MerchantPaymentHub';
import '@ton/test-utils';

describe('Invariant I5 - Ledger Conservation', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let paymentHub: SandboxContract<PaymentHub>;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let charlie: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');
        charlie = await blockchain.treasury('charlie');

        paymentHub = blockchain.openContract(
            await PaymentHub.fromInit(deployer.address)
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Setup accounts with various balances
        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: alice.address,
                owner: alice.address,
                initial_balance: toNano('1000'),
                initial_state: 0,
            }
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: bob.address,
                owner: bob.address,
                initial_balance: toNano('2000'),
                initial_state: 0,
            }
        );

        await paymentHub.send(
            deployer.getSender(),
            { value: toNano('0.01') },
            {
                $$type: 'InitializeAccount',
                nft_address: charlie.address,
                owner: charlie.address,
                initial_balance: toNano('3000'),
                initial_state: 0,
            }
        );
    });

    async function getTotalBalance(): Promise<bigint> {
        const balances = await Promise.all([
            paymentHub.getGetBalance(alice.address),
            paymentHub.getGetBalance(bob.address),
            paymentHub.getGetBalance(charlie.address),
        ]);
        return balances.reduce((sum, balance) => sum + balance, 0n);
    }

    describe('Single Transfer Conservation', () => {
        it('should conserve total balance after single transfer', async () => {
            const totalBefore = await getTotalBalance();
            expect(totalBefore).toBe(toNano('6000')); // 1000 + 2000 + 3000

            // Alice transfers to Bob
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('500'),
                    payload: null,
                }
            );

            const totalAfter = await getTotalBalance();

            // INVARIANT: Total balance unchanged
            expect(totalAfter).toBe(totalBefore);
            expect(totalAfter).toBe(toNano('6000'));

            // Verify individual balances
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);

            expect(aliceBalance).toBe(toNano('500'));  // 1000 - 500
            expect(bobBalance).toBe(toNano('2500'));   // 2000 + 500
        });

        it('should verify no fees deducted from transfers', async () => {
            const aliceBefore = await paymentHub.getGetBalance(alice.address);
            const bobBefore = await paymentHub.getGetBalance(bob.address);

            const transferAmount = toNano('250');

            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            const aliceAfter = await paymentHub.getGetBalance(alice.address);
            const bobAfter = await paymentHub.getGetBalance(bob.address);

            // INVARIANT: Exact debit/credit (zero fees)
            expect(aliceAfter).toBe(aliceBefore - transferAmount);
            expect(bobAfter).toBe(bobBefore + transferAmount);

            // Verify no hidden fees
            const aliceLoss = aliceBefore - aliceAfter;
            const bobGain = bobAfter - bobBefore;
            expect(aliceLoss).toBe(bobGain); // Perfect conservation
        });
    });

    describe('Multiple Transfers Conservation', () => {
        it('should conserve balance across multiple sequential transfers', async () => {
            const totalInitial = await getTotalBalance();

            // Series of transfers
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            await paymentHub.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: bob.address,
                    to_nft: charlie.address,
                    amount_tbc: toNano('200'),
                    payload: null,
                }
            );

            await paymentHub.send(
                charlie.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: charlie.address,
                    to_nft: alice.address,
                    amount_tbc: toNano('300'),
                    payload: null,
                }
            );

            const totalFinal = await getTotalBalance();

            // INVARIANT: Total unchanged after multiple transfers
            expect(totalFinal).toBe(totalInitial);
            expect(totalFinal).toBe(toNano('6000'));
        });

        it('should conserve balance in circular transfer pattern', async () => {
            const totalBefore = await getTotalBalance();

            // Circular: Alice -> Bob -> Charlie -> Alice
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            await paymentHub.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: bob.address,
                    to_nft: charlie.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            await paymentHub.send(
                charlie.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: charlie.address,
                    to_nft: alice.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            const totalAfter = await getTotalBalance();

            // INVARIANT: Total conserved even in circular pattern
            expect(totalAfter).toBe(totalBefore);

            // Individual balances should be back to original
            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);
            const charlieBalance = await paymentHub.getGetBalance(charlie.address);

            expect(aliceBalance).toBe(toNano('1000'));
            expect(bobBalance).toBe(toNano('2000'));
            expect(charlieBalance).toBe(toNano('3000'));
        });
    });

    describe('Failed Transfers Do Not Affect Conservation', () => {
        it('should maintain conservation when transfer fails', async () => {
            const totalBefore = await getTotalBalance();

            // Failed transfer (insufficient balance)
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('5000'), // More than Alice has
                    payload: null,
                }
            );

            const totalAfter = await getTotalBalance();

            // INVARIANT: Failed transfer doesn't create/destroy funds
            expect(totalAfter).toBe(totalBefore);
        });
    });

    describe('Self-Transfer Conservation', () => {
        it('should maintain balance during self-transfer', async () => {
            const totalBefore = await getTotalBalance();
            const aliceBefore = await paymentHub.getGetBalance(alice.address);

            // Self-transfer
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: alice.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            const totalAfter = await getTotalBalance();
            const aliceAfter = await paymentHub.getGetBalance(alice.address);

            // INVARIANT: Total conserved
            expect(totalAfter).toBe(totalBefore);
            // Individual balance unchanged (no-op)
            expect(aliceAfter).toBe(aliceBefore);
        });
    });

    describe('No Rounding Errors', () => {
        it('should handle precise arithmetic without rounding', async () => {
            // Transfer odd amounts that might cause rounding issues
            const transferAmount = toNano('123.456789');

            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: transferAmount,
                    payload: null,
                }
            );

            const aliceBalance = await paymentHub.getGetBalance(alice.address);
            const bobBalance = await paymentHub.getGetBalance(bob.address);

            // INVARIANT: Precise arithmetic, no rounding
            expect(aliceBalance).toBe(toNano('1000') - transferAmount);
            expect(bobBalance).toBe(toNano('2000') + transferAmount);

            // Verify conservation
            const total = await getTotalBalance();
            expect(total).toBe(toNano('6000'));
        });
    });

    describe('MerchantPaymentHub Conservation', () => {
        let merchantHub: SandboxContract<MerchantPaymentHub>;
        let payer: SandboxContract<TreasuryContract>;
        let merchant: SandboxContract<TreasuryContract>;

        beforeEach(async () => {
            payer = await blockchain.treasury('payer');
            merchant = await blockchain.treasury('merchant');

            merchantHub = blockchain.openContract(
                await MerchantPaymentHub.fromInit()
            );

            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                { $$type: 'Deploy', queryId: 0n }
            );

            // Setup payer and merchant
            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: payer.address,
                    state: 0,
                    owner: payer.address,
                }
            );

            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountBalance',
                    nft_address: payer.address,
                    balance: toNano('1000'),
                }
            );

            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountState',
                    nft_address: merchant.address,
                    state: 0,
                    owner: merchant.address,
                }
            );

            await merchantHub.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'SetAccountBalance',
                    nft_address: merchant.address,
                    balance: toNano('0'),
                }
            );
        });

        it('should conserve balances in merchant payments', async () => {
            const payerBefore = await merchantHub.getGetBalance(payer.address);
            const merchantBefore = await merchantHub.getGetBalance(merchant.address);
            const totalBefore = payerBefore + merchantBefore;

            const paymentAmount = toNano('250');

            await merchantHub.send(
                payer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'MerchantPaymentRequest',
                    payer_nft: payer.address,
                    merchant_nft: merchant.address,
                    amount_tbc: paymentAmount,
                    payload: null,
                }
            );

            const payerAfter = await merchantHub.getGetBalance(payer.address);
            const merchantAfter = await merchantHub.getGetBalance(merchant.address);
            const totalAfter = payerAfter + merchantAfter;

            // INVARIANT: Total conserved in merchant payment
            expect(totalAfter).toBe(totalBefore);
            expect(totalAfter).toBe(toNano('1000'));

            // Exact debit/credit
            expect(payerAfter).toBe(toNano('750'));
            expect(merchantAfter).toBe(toNano('250'));
        });
    });

    describe('INVARIANT VERIFICATION: Complete Conservation', () => {
        it('should verify conservation across all transfer types', async () => {
            const initialTotal = toNano('6000');
            let currentTotal = await getTotalBalance();
            expect(currentTotal).toBe(initialTotal);

            // Scenario 1: Regular transfer
            await paymentHub.send(
                alice.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: alice.address,
                    to_nft: bob.address,
                    amount_tbc: toNano('50'),
                    payload: null,
                }
            );

            currentTotal = await getTotalBalance();
            expect(currentTotal).toBe(initialTotal);

            // Scenario 2: Multiple transfers
            await paymentHub.send(
                bob.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: bob.address,
                    to_nft: charlie.address,
                    amount_tbc: toNano('75'),
                    payload: null,
                }
            );

            currentTotal = await getTotalBalance();
            expect(currentTotal).toBe(initialTotal);

            // Scenario 3: Back to Alice
            await paymentHub.send(
                charlie.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'TransferInternalRequest',
                    from_nft: charlie.address,
                    to_nft: alice.address,
                    amount_tbc: toNano('100'),
                    payload: null,
                }
            );

            currentTotal = await getTotalBalance();
            expect(currentTotal).toBe(initialTotal);

            // INVARIANT: Total always equals initial total
            expect(currentTotal).toBe(toNano('6000'));
        });
    });
});
