/**
 * Merchant-payment extension of the protocol model.
 *
 * Wraps the core ProtocolModel (tests/invariants/model/protocol-model.ts) with
 * the semantics that are unique to the merchant payment surface modelled by
 * `contracts/MerchantPaymentHub.tact`:
 *
 *   - whitelisted NFT collections (admin-managed registry)
 *   - invoice idempotency keys (replay-resistant settlements)
 *   - merchant payment as a transfer + receipt event pair
 *
 * The goal is to provide a deterministic substrate for adversarial scenarios
 * that target the merchant payment entry points called out in D1:
 *   - Replay attack (T5)
 *   - Race condition on locks (T2/T4)
 *   - Double-spend across simultaneous invoices (T4/T5)
 *   - Lock bypass via merchant pay path (T4, R-CRIT-1 regression)
 *   - NFT spoofing using non-whitelisted collection (T1/T6)
 *
 * The model is intentionally small: it tracks only the state needed to make
 * these attacks distinguishable from happy-path behaviour. It does NOT model
 * gas, messages, or cell layout.
 */

import {
    Address,
    AccountState,
    Caller,
    ProtocolModel,
    TxResult,
} from '../../invariants/model/protocol-model';

export type CollectionAddress = Address;
export type InvoiceId = string;

export interface Invoice {
    readonly id: InvoiceId;
    readonly merchantNft: Address;
    readonly amount: bigint;
}

export interface MerchantPaymentReceipt {
    readonly invoiceId: InvoiceId;
    readonly payerNft: Address;
    readonly merchantNft: Address;
    readonly amount: bigint;
    readonly at: number;
}

export interface MerchantPaymentResult extends TxResult {
    receipt?: MerchantPaymentReceipt;
}

export class MerchantModel {
    private readonly protocol: ProtocolModel;
    private readonly collections = new Map<Address, CollectionAddress>();
    private readonly whitelist = new Set<CollectionAddress>();
    private readonly settledInvoices = new Set<InvoiceId>();
    private readonly receipts: MerchantPaymentReceipt[] = [];
    private clock = 0;

    constructor(params: {
        admin: Address;
        riskAuthority?: Address;
        lendingAdapter?: Address;
    }) {
        this.protocol = new ProtocolModel(params);
    }

    /** Direct access to the underlying protocol model (read/write). */
    get core(): ProtocolModel {
        return this.protocol;
    }

    /** Conservation helper — total TBC across all registered accounts. */
    totalSupply(): bigint {
        return this.protocol.totalSupply();
    }

    balanceOf(nft: Address): bigint {
        return this.protocol.balanceOf(nft);
    }

    settledInvoiceCount(): number {
        return this.settledInvoices.size;
    }

    receiptsOf(invoiceId: InvoiceId): MerchantPaymentReceipt[] {
        return this.receipts.filter((r) => r.invoiceId === invoiceId);
    }

    allReceipts(): readonly MerchantPaymentReceipt[] {
        return [...this.receipts];
    }

    /**
     * Register an account at a given collection. Mirrors the admin-only
     * `SetAccountState` + collection bookkeeping in MerchantPaymentHub.tact.
     */
    registerAccount(
        caller: Caller,
        params: {
            nft: Address;
            owner: Address;
            balance: bigint;
            collection: CollectionAddress;
            state?: AccountState;
        },
    ): TxResult {
        const init = this.protocol.initializeAccount(caller, {
            nft: params.nft,
            owner: params.owner,
            balance: params.balance,
            state: params.state,
        });
        if (init.status !== 'SUCCESS') {
            return init;
        }
        this.collections.set(params.nft, params.collection);
        return { status: 'SUCCESS' };
    }

    /** Admin-only collection whitelist toggle. */
    whitelistCollection(
        caller: Caller,
        collection: CollectionAddress,
    ): TxResult {
        if (caller.role !== 'admin' || caller.address !== this.protocol.admin) {
            return { status: 'REVERTED', error: 'NOT_ADMIN' };
        }
        this.whitelist.add(collection);
        return { status: 'SUCCESS' };
    }

    /** Admin-only collection whitelist removal. */
    revokeCollection(
        caller: Caller,
        collection: CollectionAddress,
    ): TxResult {
        if (caller.role !== 'admin' || caller.address !== this.protocol.admin) {
            return { status: 'REVERTED', error: 'NOT_ADMIN' };
        }
        this.whitelist.delete(collection);
        return { status: 'SUCCESS' };
    }

    isCollectionWhitelisted(collection: CollectionAddress): boolean {
        return this.whitelist.has(collection);
    }

    collectionOf(nft: Address): CollectionAddress | undefined {
        return this.collections.get(nft);
    }

    /**
     * Merchant payment with idempotency. Mirrors the invariant set in
     * `MerchantPaymentHub.tact:120-216`:
     *
     *  - reverts if invoice was previously settled (`INVOICE_ALREADY_SETTLED`)
     *  - reverts if either side belongs to a non-whitelisted collection
     *    (`COLLECTION_NOT_WHITELISTED`)
     *  - delegates ownership, lock and balance checks to ProtocolModel.transfer
     *    so the I1/I4/I5/I6 guarantees still apply
     */
    payInvoice(
        caller: Caller,
        invoice: Invoice,
        payerNft: Address,
    ): MerchantPaymentResult {
        if (this.settledInvoices.has(invoice.id)) {
            return { status: 'REVERTED', error: 'INVOICE_ALREADY_SETTLED' };
        }
        const payerCollection = this.collections.get(payerNft);
        const merchantCollection = this.collections.get(invoice.merchantNft);
        if (!payerCollection || !this.whitelist.has(payerCollection)) {
            return {
                status: 'REVERTED',
                error: 'PAYER_COLLECTION_NOT_WHITELISTED',
            };
        }
        if (!merchantCollection || !this.whitelist.has(merchantCollection)) {
            return {
                status: 'REVERTED',
                error: 'MERCHANT_COLLECTION_NOT_WHITELISTED',
            };
        }
        const transferResult = this.protocol.transfer(
            caller,
            payerNft,
            invoice.merchantNft,
            invoice.amount,
        );
        if (transferResult.status !== 'SUCCESS') {
            return transferResult;
        }
        // Mark settled *after* successful transfer — replays must not be able
        // to mark an invoice settled by failing the transfer.
        this.settledInvoices.add(invoice.id);
        const receipt: MerchantPaymentReceipt = {
            invoiceId: invoice.id,
            payerNft,
            merchantNft: invoice.merchantNft,
            amount: invoice.amount,
            at: this.tick(),
        };
        this.receipts.push(receipt);
        return { status: 'SUCCESS', receipt };
    }

    /** Returns the next monotonic tick. */
    private tick(): number {
        this.clock += 1;
        return this.clock;
    }
}
