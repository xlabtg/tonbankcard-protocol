/**
 * T5 — Merchant Payment Replay Attack.
 *
 * Threat: an attacker (or a buggy front-end) submits the same merchant
 * payment invoice twice. The protocol must settle it at most once and the
 * second attempt must be a single atomic revert with no state change.
 *
 * Mirrors the invariants documented in `docs/threat-model.md` (T5) and the
 * receive flow in `contracts/MerchantPaymentHub.tact:120-216`.
 *
 * NOTE on @ton/sandbox: the protocol-level model in `tests/invariants/model/`
 * is the executable specification for the on-chain contract. The
 * @ton/sandbox-based scaffold (`tests/adversarial/README.md` §"Test Execution")
 * depends on Blueprint wrappers that are not yet wired up at the repo root; the
 * upstream invariants suite already follows this model-first pattern (see
 * `tests/invariants/property/I4-adversarial.spec.ts`). When the wrappers are
 * generated we will port these specs to drive the real contracts; the model is
 * deliberately written so the assertions transfer 1:1.
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
        nft: NFT_POOL[0],
        owner: USER_POOL[0],
        balance: 10_000n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[1],
        owner: USER_POOL[1],
        balance: 0n,
        collection: COLLECTION,
        state: AccountState.ACTIVE,
    });
    return model;
}

describe('T5 — Replay Attack (Merchant Payment)', () => {
    const invoice = {
        id: 'invoice-001',
        merchantNft: NFT_POOL[1],
        amount: 250n,
    };

    it('settles the first submission and rejects the replay', () => {
        const model = freshMerchantModel();

        const first = model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        expect(first.status).toBe('SUCCESS');
        expect(first.receipt).toMatchObject({
            invoiceId: 'invoice-001',
            payerNft: NFT_POOL[0],
            merchantNft: NFT_POOL[1],
            amount: 250n,
        });

        const replay = model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        expect(replay.status).toBe('REVERTED');
        expect(replay.error).toBe('INVOICE_ALREADY_SETTLED');
        expect(replay.receipt).toBeUndefined();
    });

    it('only the first submission moves funds; the replay is a no-op', () => {
        const model = freshMerchantModel();
        model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        const balancesAfterFirst = {
            payer: model.balanceOf(NFT_POOL[0]),
            merchant: model.balanceOf(NFT_POOL[1]),
            supply: model.totalSupply(),
        };

        const replay = model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        expect(replay.status).toBe('REVERTED');
        expect(model.balanceOf(NFT_POOL[0])).toBe(balancesAfterFirst.payer);
        expect(model.balanceOf(NFT_POOL[1])).toBe(balancesAfterFirst.merchant);
        expect(model.totalSupply()).toBe(balancesAfterFirst.supply);
    });

    it('exactly one receipt is recorded even after multiple replays', () => {
        const model = freshMerchantModel();
        model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        for (let i = 0; i < 5; i++) {
            const replay = model.payInvoice(
                asUser(USER_POOL[0]),
                invoice,
                NFT_POOL[0],
            );
            expect(replay.status).toBe('REVERTED');
        }
        expect(model.receiptsOf(invoice.id)).toHaveLength(1);
        expect(model.settledInvoiceCount()).toBe(1);
    });

    it('a failed payment does NOT consume the invoice id (no settle-on-failure)', () => {
        const model = freshMerchantModel();
        // Force the first attempt to fail with INSUFFICIENT_BALANCE — invoice
        // must not be marked settled, so the legitimate retry below succeeds.
        const tooBig = { ...invoice, amount: 1_000_000n };
        const first = model.payInvoice(asUser(USER_POOL[0]), tooBig, NFT_POOL[0]);
        expect(first.status).toBe('REVERTED');
        expect(first.error).toBe('INSUFFICIENT_BALANCE');
        expect(model.settledInvoiceCount()).toBe(0);

        const retry = model.payInvoice(asUser(USER_POOL[0]), invoice, NFT_POOL[0]);
        expect(retry.status).toBe('SUCCESS');
        expect(model.settledInvoiceCount()).toBe(1);
    });

    it('different invoice ids on the same payer/merchant pair are independent', () => {
        const model = freshMerchantModel();
        const a = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'invoice-A', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );
        const b = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'invoice-B', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[0],
        );
        expect(a.status).toBe('SUCCESS');
        expect(b.status).toBe('SUCCESS');
        expect(model.settledInvoiceCount()).toBe(2);
        expect(model.balanceOf(NFT_POOL[1])).toBe(200n);
    });
});
