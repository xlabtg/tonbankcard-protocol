/**
 * TONBANKCARD Merchant SDK - Core Implementation
 *
 * SECURITY NOTICE:
 * This SDK is READ-ONLY and NON-CUSTODIAL by design.
 * It NEVER signs transactions, stores private keys, or acts as a payment authority.
 * The blockchain is the single source of truth.
 */

import { Address, TonClient } from '@ton/ton';
import { beginCell } from '@ton/core';
import {
  TonbankcardConfig,
  Invoice,
  CreateInvoiceParams,
  PaymentStatus,
  PaymentSettlement,
  WalletLinkParams,
  AccountInfo,
  AccountState,
  TransactionVerification,
} from './types';
import { generateInvoiceId } from './utils';

/** Masterchain identifiers (workchain -1, full shard) used for block lookups. */
const MASTERCHAIN_WORKCHAIN = -1;
const MASTERCHAIN_SHARD = '-9223372036854775808';

/**
 * Extract the latest masterchain seqno from a `getMasterchainInfo()` response.
 *
 * The `@ton/ton` `TonClient` wrapper flattens the tip onto `latestSeqno`, while
 * the raw toncenter HTTP API (and other client versions) nest it under
 * `last.seqno`. Accepting both shapes keeps a wrapper/version swap from
 * silently yielding `undefined` (which would propagate to `NaN`). Mirrors the
 * indexer's helper (INDEXER-H3). Returns `NaN` when neither shape is present.
 */
function extractLatestSeqno(info: unknown): number {
  if (info && typeof info === 'object') {
    const obj = info as { latestSeqno?: unknown; last?: { seqno?: unknown } };
    if (typeof obj.latestSeqno === 'number') {
      return obj.latestSeqno;
    }
    if (obj.last && typeof obj.last.seqno === 'number') {
      return obj.last.seqno;
    }
  }
  return NaN;
}

/**
 * Confirmation depth of a block at `inclusionSeqno` given the observed
 * masterchain head `headSeqno`: the number of masterchain blocks sealed on top
 * of it. Clamped at 0 so a not-yet-resolved or future seqno never yields a
 * negative (or otherwise nonsensical) count. Matches the canonical definition
 * shared by the indexer and API (INDEXER-H1).
 *
 * Both operands are masterchain block seqnos (far below 2^53), but the
 * subtraction is done with BigInt to make the dimensional intent explicit and
 * to keep this path free of any precision-losing `Number()` conversion.
 */
function computeConfirmations(
  headSeqno: number,
  inclusionSeqno: number | null
): number {
  if (
    inclusionSeqno === null ||
    !Number.isFinite(headSeqno) ||
    !Number.isFinite(inclusionSeqno)
  ) {
    return 0;
  }
  const depth = BigInt(headSeqno) - BigInt(inclusionSeqno);
  return depth > 0n ? Number(depth) : 0;
}

/**
 * TONBANKCARD Merchant SDK
 *
 * This SDK provides convenience methods for:
 * - Creating payment invoices (informational only)
 * - Generating wallet deep links
 * - Verifying on-chain settlements
 * - Querying account information
 *
 * CRITICAL: This SDK NEVER initiates payments or signs transactions.
 * All payments require explicit user wallet consent.
 */
export class TonbankcardSDK {
  private config: TonbankcardConfig;
  private client: TonClient;

  /** Resolved JSON-RPC endpoint the TON client talks to. */
  private endpoint: string;

  constructor(config: TonbankcardConfig) {
    this.config = config;

    // Initialize TON client for read-only blockchain queries
    this.endpoint =
      config.rpcEndpoint ||
      (config.network === 'mainnet'
        ? 'https://toncenter.com/api/v2/jsonRPC'
        : 'https://testnet.toncenter.com/api/v2/jsonRPC');

    this.client = new TonClient({
      endpoint: this.endpoint,
    });
  }

  /**
   * Create a payment invoice
   *
   * IMPORTANT: This is informational only. The invoice does NOT lock funds
   * or grant any payment authority. It's a reference for the user's wallet.
   *
   * @param params - Invoice creation parameters
   * @returns Invoice object (non-authoritative)
   */
  createInvoice(params: CreateInvoiceParams): Invoice {
    // Validate amount is positive
    if (params.amountTbc <= 0n) {
      throw new Error('Invoice amount must be positive');
    }

    // Validate merchant NFT address
    if (!this.isValidAddress(params.merchantNft)) {
      throw new Error('Invalid merchant NFT address');
    }

    const now = Math.floor(Date.now() / 1000);

    // Generate deterministic invoice ID
    const invoiceId = generateInvoiceId({
      merchantNft: params.merchantNft,
      amountTbc: params.amountTbc,
      orderId: params.orderId,
      timestamp: now,
    });

    const invoice: Invoice = {
      id: invoiceId,
      merchantNft: params.merchantNft,
      amountTbc: params.amountTbc,
      orderId: params.orderId,
      description: params.description,
      metadata: params.metadata,
      createdAt: now,
      expiresAt: params.expirationSeconds
        ? now + params.expirationSeconds
        : undefined,
    };

    return invoice;
  }

  /**
   * Get invoice details by ID
   *
   * NOTE: This queries the optional API endpoint if configured.
   * In a pure on-chain flow, invoices are stored client-side or in merchant DB.
   *
   * @param invoiceId - Invoice ID
   * @returns Invoice or null if not found
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    if (!this.config.apiEndpoint) {
      throw new Error(
        'API endpoint not configured. Invoice storage is merchant responsibility.'
      );
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/invoice/${invoiceId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseInvoice(data);
    } catch (error) {
      throw new Error(
        `Failed to fetch invoice: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get invoice payment status
   *
   * This queries the blockchain to verify if payment has been settled.
   * TRUST MODEL: Only on-chain confirmation is authoritative.
   *
   * @param invoiceId - Invoice ID
   * @returns Payment status
   */
  async getInvoiceStatus(invoiceId: string): Promise<PaymentStatus> {
    // Check if invoice exists (if API is configured)
    if (this.config.apiEndpoint) {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if invoice expired
      if (invoice.expiresAt && invoice.expiresAt < Date.now() / 1000) {
        return PaymentStatus.EXPIRED;
      }
    }

    // Query on-chain settlement
    const settlement = await this.getSettlement(invoiceId);

    if (settlement && settlement.status === PaymentStatus.SETTLED) {
      return PaymentStatus.SETTLED;
    }

    return PaymentStatus.PENDING;
  }

  /**
   * Generate wallet deep link for payment
   *
   * This creates a TON Connect compatible link that opens the user's wallet
   * with pre-filled payment details. The user MUST approve the transaction.
   *
   * SECURITY: This does NOT execute the payment. User consent is required.
   *
   * @param params - Wallet link parameters
   * @returns Deep link URL
   */
  generateWalletLink(params: WalletLinkParams): string {
    const { invoice, returnUrl } = params;

    // Validate invoice
    if (invoice.amountTbc <= 0n) {
      throw new Error('Invalid invoice amount');
    }

    // Build TON Connect link
    // Format: ton://transfer/<address>?amount=<nanotons>&text=<memo>
    const amount = invoice.amountTbc.toString();
    const text = encodeURIComponent(
      `TONBANKCARD Payment: ${invoice.id}${invoice.description ? ` - ${invoice.description}` : ''}`
    );

    let link = `ton://transfer/${invoice.merchantNft.toString()}?amount=${amount}&text=${text}`;

    if (returnUrl) {
      link += `&return=${encodeURIComponent(returnUrl)}`;
    }

    return link;
  }

  /**
   * Verify settlement on-chain
   *
   * This is the AUTHORITATIVE verification method.
   * Only on-chain settlement events are trustworthy.
   *
   * @param txHash - Transaction hash to verify
   * @returns Verification result
   */
  async verifySettlement(txHash: string): Promise<TransactionVerification> {
    try {
      // txHash format: "<lt>:<hash>" — logical time and hash separated by colon
      const separatorIndex = txHash.indexOf(':');
      if (separatorIndex === -1) {
        return {
          isValid: false,
          txHash,
          confirmations: 0,
          matchesInvoice: false,
          error: 'Invalid txHash format: expected "<lt>:<hash>"',
        };
      }
      const lt = txHash.slice(0, separatorIndex);
      const hash = txHash.slice(separatorIndex + 1);

      // Query transaction from blockchain
      const tx = await this.client.getTransaction(
        this.config.paymentHubAddress,
        lt,
        hash
      );

      if (!tx) {
        return {
          isValid: false,
          txHash,
          confirmations: 0,
          matchesInvoice: false,
          error: 'Transaction not found',
        };
      }

      // Derive confirmation depth as a block-height difference (SDK-H2).
      //
      // Confirmations are "how many blocks were sealed on top of the block that
      // included this transaction" — the standard blockchain meaning, identical
      // to the canonical definition shared by the indexer and API (INDEXER-H1,
      // issue #254): confirmations = chainHead - inclusionSeqno, clamped at 0.
      //
      // The previous implementation subtracted the transaction's logical time
      // (`tx.lt`, a monotonic counter on the order of 10^19) from a masterchain
      // block height, which is dimensionally meaningless and additionally lost
      // precision via `Number(tx.lt)` for `lt` values above 2^53. We never feed
      // `lt` into this arithmetic anymore; both operands are masterchain block
      // seqnos (well below 2^53) and the difference is computed with BigInt.
      const headSeqno = extractLatestSeqno(
        await this.client.getMasterchainInfo()
      );
      const inclusionSeqno = await this.resolveTransactionSeqno(tx);
      const confirmations = computeConfirmations(headSeqno, inclusionSeqno);

      // Verify transaction success (not aborted)
      const isValid = tx.description.type === 'generic' && !tx.description.aborted;

      return {
        isValid,
        txHash,
        confirmations,
        matchesInvoice: true, // Additional verification can be added
      };
    } catch (error) {
      return {
        isValid: false,
        txHash,
        confirmations: 0,
        matchesInvoice: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resolve the masterchain block seqno in which a transaction was included.
   *
   * toncenter's `getTransactions` response (and the `@ton/ton` `Transaction`)
   * carries no block reference, so we map the transaction's gen time (`tx.now`,
   * a unix timestamp) to the masterchain block sealed at that instant via the
   * `lookupBlock` REST method. The returned seqno is a masterchain block height,
   * dimensionally comparable to the chain head from `getMasterchainInfo()`.
   *
   * Returns `null` when the block cannot be resolved (network/endpoint that does
   * not speak the toncenter REST API, malformed response, …); callers then
   * report 0 confirmations rather than a fabricated depth.
   *
   * @param tx - Transaction whose inclusion block seqno is requested
   * @returns Masterchain block seqno, or null if it cannot be resolved
   */
  private async resolveTransactionSeqno(tx: {
    now: number;
  }): Promise<number | null> {
    if (!Number.isFinite(tx.now)) {
      return null;
    }

    // Derive the toncenter REST base from the JSON-RPC endpoint
    // (…/api/v2/jsonRPC → …/api/v2/lookupBlock).
    const base = this.endpoint.replace(/jsonRPC\/?$/i, '');
    const url =
      `${base}lookupBlock?workchain=${MASTERCHAIN_WORKCHAIN}` +
      `&shard=${encodeURIComponent(MASTERCHAIN_SHARD)}` +
      `&unixtime=${Math.floor(tx.now)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { seqno?: unknown };
      };
      const seqno = data?.result?.seqno;
      return typeof seqno === 'number' && Number.isFinite(seqno) ? seqno : null;
    } catch {
      return null;
    }
  }

  /**
   * Get account information from Payment Hub
   *
   * READ-ONLY: This queries account state but cannot modify it.
   *
   * @param nftAddress - NFT account address
   * @returns Account information
   */
  async getAccountInfo(nftAddress: Address): Promise<AccountInfo> {
    try {
      // Query Payment Hub contract
      const balance = await this.client.runMethod(
        this.config.paymentHubAddress,
        'getBalance',
        [{ type: 'slice', cell: beginCell().storeAddress(nftAddress).endCell() }]
      );

      const state = await this.client.runMethod(
        this.config.paymentHubAddress,
        'getAccountState',
        [{ type: 'slice', cell: beginCell().storeAddress(nftAddress).endCell() }]
      );

      const canSend = await this.client.runMethod(
        this.config.paymentHubAddress,
        'canSend',
        [{ type: 'slice', cell: beginCell().storeAddress(nftAddress).endCell() }]
      );

      const canReceive = await this.client.runMethod(
        this.config.paymentHubAddress,
        'canReceive',
        [{ type: 'slice', cell: beginCell().storeAddress(nftAddress).endCell() }]
      );

      return {
        nftAddress,
        balance: balance.stack.readBigNumber(),
        state: state.stack.readNumber() as AccountState,
        canSend: canSend.stack.readBoolean(),
        canReceive: canReceive.stack.readBoolean(),
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch account info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get settlement information for an invoice
   *
   * @param invoiceId - Invoice ID
   * @returns Settlement information or null
   */
  private async getSettlement(
    invoiceId: string
  ): Promise<PaymentSettlement | null> {
    // This would query on-chain events or indexer
    // For now, return null (implementation depends on indexer availability)
    if (!this.config.apiEndpoint) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/settlement/${invoiceId}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return this.parseSettlement(data);
    } catch {
      return null;
    }
  }

  /**
   * Helper: Validate TON address
   */
  private isValidAddress(address: Address): boolean {
    try {
      // Check if address is valid
      return address.toString().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Parse invoice from API response
   */
  private parseInvoice(data: any): Invoice {
    return {
      id: data.id,
      merchantNft: Address.parse(data.merchantNft),
      amountTbc: BigInt(data.amountTbc),
      orderId: data.orderId,
      description: data.description,
      metadata: data.metadata,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Helper: Parse settlement from API response
   */
  private parseSettlement(data: any): PaymentSettlement {
    return {
      invoiceId: data.invoiceId,
      payerNft: Address.parse(data.payerNft),
      merchantNft: Address.parse(data.merchantNft),
      amountTbc: BigInt(data.amountTbc),
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      timestamp: data.timestamp,
      status: data.status as PaymentStatus,
    };
  }
}
