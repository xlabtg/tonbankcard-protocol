/**
 * T1/T6 — NFT Spoofing via Non-Whitelisted Collection.
 *
 * Threat: an attacker mints an NFT in a collection of their own choosing and
 * presents it as a payer (or as a merchant) to the merchant payment hub. The
 * hub must reject any settlement that touches a non-whitelisted collection on
 * either side.
 *
 * Mirrors `MerchantPaymentHub.tact:WhitelistMerchantCollection` semantics and
 * the merchant-payment receive flow.
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

const WHITELISTED = 'whitelisted-collection';
const ROGUE = 'rogue-collection';

function freshMerchantModel(): MerchantModel {
    const model = new MerchantModel({
        admin: ADMIN,
        riskAuthority: RISK_AUTHORITY,
        lendingAdapter: LENDING_ADAPTER,
    });
    model.whitelistCollection(ADMIN_CALLER, WHITELISTED);
    // payer + merchant in whitelisted collection
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[0],
        owner: USER_POOL[0],
        balance: 1_000n,
        collection: WHITELISTED,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[1],
        owner: USER_POOL[1],
        balance: 0n,
        collection: WHITELISTED,
        state: AccountState.ACTIVE,
    });
    // rogue NFTs in non-whitelisted collection
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[2],
        owner: USER_POOL[2],
        balance: 1_000n,
        collection: ROGUE,
        state: AccountState.ACTIVE,
    });
    model.registerAccount(ADMIN_CALLER, {
        nft: NFT_POOL[3],
        owner: USER_POOL[3],
        balance: 0n,
        collection: ROGUE,
        state: AccountState.ACTIVE,
    });
    return model;
}

describe('T1/T6 — NFT Spoofing via Non-Whitelisted Collection', () => {
    it('rogue payer collection: payInvoice reverts', () => {
        const model = freshMerchantModel();
        const res = model.payInvoice(
            asUser(USER_POOL[2]),
            { id: 'inv-rogue-payer', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[2],
        );
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('PAYER_COLLECTION_NOT_WHITELISTED');
        expect(model.settledInvoiceCount()).toBe(0);
        expect(model.balanceOf(NFT_POOL[1])).toBe(0n);
        expect(model.balanceOf(NFT_POOL[2])).toBe(1_000n);
    });

    it('rogue merchant collection: payInvoice reverts', () => {
        const model = freshMerchantModel();
        const res = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-rogue-merchant', merchantNft: NFT_POOL[3], amount: 100n },
            NFT_POOL[0],
        );
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('MERCHANT_COLLECTION_NOT_WHITELISTED');
        expect(model.settledInvoiceCount()).toBe(0);
        expect(model.balanceOf(NFT_POOL[0])).toBe(1_000n);
        expect(model.balanceOf(NFT_POOL[3])).toBe(0n);
    });

    it('both sides rogue: payInvoice reverts on payer check first', () => {
        const model = freshMerchantModel();
        const res = model.payInvoice(
            asUser(USER_POOL[2]),
            { id: 'inv-both-rogue', merchantNft: NFT_POOL[3], amount: 100n },
            NFT_POOL[2],
        );
        expect(res.status).toBe('REVERTED');
        // Payer check runs first per MerchantPaymentHub.tact ordering.
        expect(res.error).toBe('PAYER_COLLECTION_NOT_WHITELISTED');
    });

    it('admin can whitelist a new collection and previously-blocked pay then succeeds', () => {
        const model = freshMerchantModel();
        const blocked = model.payInvoice(
            asUser(USER_POOL[2]),
            { id: 'inv-late', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[2],
        );
        expect(blocked.status).toBe('REVERTED');

        const wl = model.whitelistCollection(ADMIN_CALLER, ROGUE);
        expect(wl.status).toBe('SUCCESS');

        const ok = model.payInvoice(
            asUser(USER_POOL[2]),
            { id: 'inv-late-2', merchantNft: NFT_POOL[1], amount: 100n },
            NFT_POOL[2],
        );
        expect(ok.status).toBe('SUCCESS');
        expect(model.balanceOf(NFT_POOL[1])).toBe(100n);
    });

    it('revoking a whitelisted collection blocks subsequent payments', () => {
        const model = freshMerchantModel();

        const before = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-before', merchantNft: NFT_POOL[1], amount: 50n },
            NFT_POOL[0],
        );
        expect(before.status).toBe('SUCCESS');

        const rv = model.revokeCollection(ADMIN_CALLER, WHITELISTED);
        expect(rv.status).toBe('SUCCESS');

        const after = model.payInvoice(
            asUser(USER_POOL[0]),
            { id: 'inv-after', merchantNft: NFT_POOL[1], amount: 50n },
            NFT_POOL[0],
        );
        expect(after.status).toBe('REVERTED');
        expect(after.error).toBe('PAYER_COLLECTION_NOT_WHITELISTED');
    });

    it('non-admin cannot whitelist a collection', () => {
        const model = freshMerchantModel();
        const attacker = asUser(USER_POOL[0]);
        const res = model.whitelistCollection(attacker, ROGUE);
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('NOT_ADMIN');
        expect(model.isCollectionWhitelisted(ROGUE)).toBe(false);
    });

    it('non-admin cannot revoke a collection', () => {
        const model = freshMerchantModel();
        const attacker = asUser(USER_POOL[0]);
        const res = model.revokeCollection(attacker, WHITELISTED);
        expect(res.status).toBe('REVERTED');
        expect(res.error).toBe('NOT_ADMIN');
        expect(model.isCollectionWhitelisted(WHITELISTED)).toBe(true);
    });
});
