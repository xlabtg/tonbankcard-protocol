/**
 * T4/T5 — Double-Spend across Simultaneous Invoices.
 *
 * Threat: a payer attempts to pay two merchants (or the same merchant twice
 * under different invoice ids) such that the sum exceeds their balance. The
 * protocol must process them as a serial sequence: one settles, the second
 * reverts with `INSUFFICIENT_BALANCE`, and supply is conserved (I5).
 *
 * Also covers the variant where two invoices target the same merchant — the
 * idempotency key is invoice-id, not (payer, merchant), so distinct invoice
 * ids must be honoured independently up to balance.
 */

import { AccountState } from '../../invariants/model/protocol-model';
import {
    ADMIN,
    RISK_AUTHORITY,
    LENDING_ADAPTER,
    NFT_POOL,
    USER_POOL,
} from '../../invariants/property/arbitraries';
import { ADMIN_CALLER, asUser } from '../../invariants/property/helpers';
import { MerchantModel } from '../model/merchant-model';

const COLLECTION = 'merchant-collection-1';

function freshMerchantModel(): MerchantModel {
    const model = new MerchantModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    model.whitelistCollection(ADMIN_CALLER, COLLECTION);
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[0], // payer
        owner: USER_POOL[0],
        balance: 1_000n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[1], // merchant A
        owner: USER_POOL[1],
        balance: 0n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[2], // merchant B
        owner: USER_POOL[2],
        balance: 0n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    return model;
}

describe('T4/T5 — Double-Spend across Simultaneous Invoices', () => {
    it('two invoices summing to > balance: first settles, second reverts', () => {
        const model = freshMerchantModel();

        const invA = { id: 'inv-A', merchantNft: NFT_POOL[1], amount: 700n };
        const invB = { id: 'inv-B', merchantNft: NFT_POOL[2], amount: 400n };

        const a = model.payInvoice(asUser(USER_POOL[0]), invA, NFT_POOL[0]);
        const b = model.payInvoice(asUser(USER_POOL[0]), invB, NFT_POOL[0]);

        expect(a.status).toBe('SUCCESS');
        expect(b.status).toBe('REVERTED');
        expect(b.error).toBe('INSUFFICIENT_BALANCE');

        expect(model.balanceOf(NFT_POOL[0])).toBe(300n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(700n);
        expect(model.balanceOf(NFT_POOL[2])).toBe(0n);
        expect(model.totalSupply()).toBe(1_000n);
        expect(model.settledInvoiceCount()).toBe(1);
    });

    it('two same-merchant invoices with distinct ids: both honoured if balance allows', () => {
        const model = freshMerchantModel();

        const invA = { id: 'inv-A', merchantNft: NFT_POOL[1], amount: 400n };
        const invB = { id: 'inv-B', merchantNft: NFT_POOL[1], amount: 400n };
        const a = model.payInvoice(asUser(USER_POOL[0]), invA, NFT_POOL[0]);
        const b = model.payInvoice(asUser(USER_POOL[0]), invB, NFT_POOL[0]);

        expect(a.status).toBe('SUCCESS');
        expect(b.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[0])).toBe(200n);
        expect(model.balanceOf(NFT_POOL[1])).toBe(800n);
        expect(model.totalSupply()).toBe(1_000n);
        expect(model.settledInvoiceCount()).toBe(2);
    });

    it('reordering the two invoices still yields a single successful settlement', () => {
        const orderings: Array<[bigint, bigint]> = [
            [700n, 400n],
            [400n, 700n],
            [999n, 2n],
        ];
        for (const [first, second] of orderings) {
            const model = freshMerchantModel();
            const a = model.payInvoice(
                asUser(USER_POOL[0]),
                { id: 'inv-A', merchantNft: NFT_POOL[1], amount: first },
                NFT_POOL[0],
            );
            const b = model.payInvoice(
                asUser(USER_POOL[0]),
                { id: 'inv-B', merchantNft: NFT_POOL[2], amount: second },
                NFT_POOL[0],
            );

            expect(a.status).toBe('SUCCESS');
            expect(b.status).toBe('REVERTED');
            expect(model.totalSupply()).toBe(1_000n);
            expect(model.settledInvoiceCount()).toBe(1);
        }
    });

    it('after a partial spend the remaining balance is exactly trackable', () => {
        const model = freshMerchantModel();
        model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-1', merchantNft: NFT_POOL[1], amount: 333n },
            NFT_POOL[0],
        );
        model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-2', merchantNft: NFT_POOL[2], amount: 333n },
            NFT_POOL[0],
        );
        // Third invoice exactly equals the remaining balance.
        const final = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-3', merchantNft: NFT_POOL[1], amount: 334n },
            NFT_POOL[0],
        );
        expect(final.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[0])).toBe(0n);
        expect(model.totalSupply()).toBe(1_000n);
    });

    it('attempting to pay zero-balance payer reverts every time', () => {
        const model = freshMerchantModel();
        // Drain the payer first.
        model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'drain', merchantNft: NFT_POOL[1], amount: 1_000n },
            NFT_POOL[0],
        );
        expect(model.balanceOf(NFT_POOL[0])).toBe(0n);

        for (let i = 0; i < 3; i++) {
            const res = model.payInvoice(
                asUser(USER_POOL[0]),
                {
                    id: `extra-${i}`,
                    merchantNft: NFT_POOL[2],
                    amount: 1n,
                },
                NFT_POOL[0],
            );
            expect(res.status).toBe('REVERTED');
            expect(res.error).toBe('INSUFFICIENT_BALANCE');
        }
        expect(model.totalSupply()).toBe(1_000n);
    });
});
