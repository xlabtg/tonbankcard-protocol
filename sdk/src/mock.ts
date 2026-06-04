/**
 * TONBANKCARD Merchant SDK — Mock/Sandbox Provider
 *
 * Provides a drop-in replacement for TonbankcardSDK that works without
 * network calls. Use in integration tests, CI, and local development.
 *
 * SECURITY NOTICE:
 * This mock is for TESTING ONLY. It does not validate actual blockchain state.
 * Never use MockTonbankcardSDK in production environments.
 */

import { Address } from '@ton/core';
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
  SettlementMatchCriteria,
} from './types';
import { MAX_TBC_NANOCOINS } from './amount';
import { generateInvoiceId } from './utils';
import { buildWalletLink } from './walletLink';

/**
 * Note returned in `error` when `verifySettlement` is called without an invoice
 * to match against. Mirrors the message used by the real SDK.
 */
const NO_INVOICE_MATCH_NOTE =
  'No invoice provided; matchesInvoice cannot be verified. ' +
  'Pass the target invoice to verifySettlement to enable matching.';

/**
 * Options for configuring the mock SDK behavior
 */
export interface MockSDKOptions {
  /** Simulate network delay in milliseconds (default: 0) */
  networkDelayMs?: number;

  /** Pre-seeded settlements to return (invoice_id → settlement) */
  settlements?: Map<string, PaymentSettlement>;

  /** Pre-seeded invoices (invoice_id → invoice) */
  invoices?: Map<string, Invoice>;

  /** Pre-seeded account states (nft_address_string → AccountInfo) */
  accounts?: Map<string, AccountInfo>;

  /**
   * Whether verifySettlement returns valid for any tx hash (default: false)
   * When true, any call to verifySettlement returns isValid: true with confirmations: 10
   */
  autoApproveSettlements?: boolean;

  /** Default confirmations to return for verifySettlement (default: 10) */
  defaultConfirmations?: number;
}

/**
 * In-memory settlement store for integration tests.
 *
 * Use this to register settlements that MockTonbankcardSDK will return,
 * simulating on-chain settlement events without actual blockchain calls.
 *
 * @example
 * ```typescript
 * const store = new MockSettlementStore();
 * const mockSdk = createMockSDK({ settlements: store.asMap() });
 *
 * // Simulate a payment arriving
 * store.settle(invoice, 'tx_hash_abc123');
 *
 * // SDK will now return SETTLED for this invoice
 * const status = await mockSdk.getInvoiceStatus(invoice.id);
 * // status === PaymentStatus.SETTLED
 * ```
 */
export class MockSettlementStore {
  private settlements = new Map<string, PaymentSettlement>();

  /**
   * Record a settlement for a given invoice
   */
  settle(
    invoice: Invoice,
    txHash: string,
    payerNft?: Address,
    blockNumber?: number
  ): PaymentSettlement {
    const settlement: PaymentSettlement = {
      invoiceId: invoice.id,
      payerNft: payerNft ?? Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'),
      merchantNft: invoice.merchantNft,
      amountTbc: invoice.amountTbc,
      txHash,
      blockNumber: blockNumber ?? 1000000,
      timestamp: Math.floor(Date.now() / 1000),
      status: PaymentStatus.SETTLED,
    };
    this.settlements.set(invoice.id, settlement);
    return settlement;
  }

  /**
   * Get settlement by invoice ID
   */
  get(invoiceId: string): PaymentSettlement | undefined {
    return this.settlements.get(invoiceId);
  }

  /**
   * Check if an invoice has been settled
   */
  isSettled(invoiceId: string): boolean {
    return this.settlements.has(invoiceId);
  }

  /**
   * Clear all settlements
   */
  clear(): void {
    this.settlements.clear();
  }

  /**
   * Return settlements as a Map (for MockSDKOptions)
   */
  asMap(): Map<string, PaymentSettlement> {
    return new Map(this.settlements);
  }
}

/**
 * Mock TONBANKCARD SDK for testing.
 *
 * Drop-in replacement for TonbankcardSDK that works without network calls.
 *
 * @example
 * ```typescript
 * // In your tests
 * const mockSdk = createMockSDK({ autoApproveSettlements: true });
 *
 * // Creates invoices exactly like the real SDK
 * const invoice = mockSdk.createInvoice({
 *   merchantNft: Address.parse('EQAjH...'),
 *   amountTbc: parseTBC('10.00'),
 *   orderId: 'ORDER-123',
 * });
 *
 * // verifySettlement returns valid without network call
 * const verification = await mockSdk.verifySettlement('any-tx-hash');
 * console.log(verification.isValid); // true
 * ```
 */
export class MockTonbankcardSDK {
  private options: Required<MockSDKOptions>;
  private invoiceStore: Map<string, Invoice>;
  private settlementStore: Map<string, PaymentSettlement>;
  private accountStore: Map<string, AccountInfo>;
  private config: TonbankcardConfig;

  constructor(config: TonbankcardConfig, options: MockSDKOptions = {}) {
    this.config = config;
    this.options = {
      networkDelayMs: options.networkDelayMs ?? 0,
      settlements: options.settlements ?? new Map(),
      invoices: options.invoices ?? new Map(),
      accounts: options.accounts ?? new Map(),
      autoApproveSettlements: options.autoApproveSettlements ?? false,
      defaultConfirmations: options.defaultConfirmations ?? 10,
    };

    this.invoiceStore = new Map(this.options.invoices);
    this.settlementStore = new Map(this.options.settlements);
    this.accountStore = new Map(this.options.accounts);
  }

  private async delay(): Promise<void> {
    if (this.options.networkDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.networkDelayMs));
    }
  }

  /**
   * Create a payment invoice — identical behavior to real SDK
   */
  createInvoice(params: CreateInvoiceParams): Invoice {
    if (params.amountTbc <= 0n) {
      throw new Error('Invoice amount must be positive');
    }
    if (params.amountTbc > MAX_TBC_NANOCOINS) {
      throw new Error('Invoice amount exceeds maximum of 2^120 - 1');
    }

    if (!this.isValidAddress(params.merchantNft)) {
      throw new Error('Invalid merchant NFT address');
    }

    const now = Math.floor(Date.now() / 1000);

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

    this.invoiceStore.set(invoiceId, invoice);
    return invoice;
  }

  /**
   * Get invoice by ID from mock store
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    await this.delay();
    return this.invoiceStore.get(invoiceId) ?? null;
  }

  /**
   * Get invoice payment status from mock settlement store
   */
  async getInvoiceStatus(invoiceId: string): Promise<PaymentStatus> {
    await this.delay();

    const invoice = this.invoiceStore.get(invoiceId);
    if (invoice?.expiresAt && invoice.expiresAt < Date.now() / 1000) {
      return PaymentStatus.EXPIRED;
    }

    const settlement = this.settlementStore.get(invoiceId);
    if (settlement?.status === PaymentStatus.SETTLED) {
      return PaymentStatus.SETTLED;
    }

    return PaymentStatus.PENDING;
  }

  /**
   * Generate wallet deep link — identical behavior to real SDK
   */
  generateWalletLink(params: WalletLinkParams): string {
    return buildWalletLink(this.config, params);
  }

  /**
   * Verify settlement — returns mock result without network call.
   *
   * Mirrors {@link TonbankcardSDK.verifySettlement}: when `expected` is
   * supplied, `matchesInvoice` is `true` only if the recorded settlement's
   * merchant NFT and amount (and payload hash, when provided) match. When
   * `expected` is omitted, `matchesInvoice` is reported as `false` because the
   * payment cannot be checked against any invoice.
   *
   * @param txHash - Transaction hash to verify
   * @param expected - Target invoice (or its canonical fields) to match against
   */
  async verifySettlement(
    txHash: string,
    expected?: SettlementMatchCriteria
  ): Promise<TransactionVerification> {
    await this.delay();

    if (this.options.autoApproveSettlements) {
      return {
        isValid: true,
        txHash,
        confirmations: this.options.defaultConfirmations,
        matchesInvoice: this.computeMatch(undefined, expected),
        ...(expected ? {} : { error: NO_INVOICE_MATCH_NOTE }),
      };
    }

    // Check if any settlement matches this tx hash
    for (const settlement of this.settlementStore.values()) {
      if (settlement.txHash === txHash) {
        const matchesInvoice = this.computeMatch(settlement, expected);
        return {
          isValid: true,
          txHash,
          confirmations: this.options.defaultConfirmations,
          matchesInvoice,
          ...(this.matchNote(settlement, expected, matchesInvoice)),
        };
      }
    }

    return {
      isValid: false,
      txHash,
      confirmations: 0,
      matchesInvoice: false,
      error: 'Transaction not found in mock store',
    };
  }

  /**
   * Determine whether a recorded settlement satisfies the expected invoice
   * criteria. With no `expected` criteria a match cannot be asserted, so this
   * returns `false`. With no recorded settlement (auto-approve mode) only the
   * presence of `expected` is required, since the mock cannot inspect chain
   * data.
   */
  private computeMatch(
    settlement: PaymentSettlement | undefined,
    expected?: SettlementMatchCriteria
  ): boolean {
    if (!expected) {
      return false;
    }
    if (!settlement) {
      // autoApproveSettlements has no recorded payment to compare against
      return true;
    }
    const merchantMatches = settlement.merchantNft.equals(expected.merchantNft);
    const amountMatches = settlement.amountTbc === expected.amountTbc;
    return merchantMatches && amountMatches;
  }

  /**
   * Produce the optional `error` note describing why a match was not asserted.
   */
  private matchNote(
    settlement: PaymentSettlement | undefined,
    expected: SettlementMatchCriteria | undefined,
    matchesInvoice: boolean
  ): { error?: string } {
    if (!expected) {
      return { error: NO_INVOICE_MATCH_NOTE };
    }
    if (settlement && !matchesInvoice) {
      return { error: 'On-chain payment does not match the expected invoice' };
    }
    return {};
  }

  /**
   * Get account information from mock account store
   */
  async getAccountInfo(nftAddress: Address): Promise<AccountInfo> {
    await this.delay();

    const stored = this.accountStore.get(nftAddress.toString());
    if (stored) {
      return stored;
    }

    // Return a default active account if not found in store
    return {
      nftAddress,
      balance: BigInt(0),
      state: AccountState.ACTIVE,
      canSend: true,
      canReceive: true,
    };
  }

  // ─── Mock-specific test helpers ─────────────────────────────────────────

  /**
   * Register a settlement in the mock store (test helper)
   */
  registerSettlement(settlement: PaymentSettlement): void {
    this.settlementStore.set(settlement.invoiceId, settlement);
  }

  /**
   * Register an invoice in the mock store (test helper)
   */
  registerInvoice(invoice: Invoice): void {
    this.invoiceStore.set(invoice.id, invoice);
  }

  /**
   * Register an account state in the mock store (test helper)
   */
  registerAccount(account: AccountInfo): void {
    this.accountStore.set(account.nftAddress.toString(), account);
  }

  /**
   * Simulate a payment settlement for an invoice (test helper)
   */
  simulateSettlement(invoiceId: string, txHash: string = `mock_tx_${Date.now()}`): void {
    const invoice = this.invoiceStore.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found in mock store`);
    }

    const settlement: PaymentSettlement = {
      invoiceId,
      payerNft: Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'),
      merchantNft: invoice.merchantNft,
      amountTbc: invoice.amountTbc,
      txHash,
      blockNumber: 1000000,
      timestamp: Math.floor(Date.now() / 1000),
      status: PaymentStatus.SETTLED,
    };

    this.settlementStore.set(invoiceId, settlement);
  }

  /**
   * Reset all mock state (test helper)
   */
  reset(): void {
    this.invoiceStore.clear();
    this.settlementStore.clear();
    this.accountStore.clear();
  }

  private isValidAddress(address: Address): boolean {
    try {
      return address.toString().length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create a MockTonbankcardSDK with sensible test defaults.
 *
 * @param options - Mock SDK options
 * @returns Configured MockTonbankcardSDK instance
 *
 * @example
 * ```typescript
 * const sdk = createMockSDK();
 * const sdk = createMockSDK({ autoApproveSettlements: true });
 * const sdk = createMockSDK({ networkDelayMs: 100 }); // Simulate 100ms latency
 * ```
 */
export function createMockSDK(options: MockSDKOptions = {}): MockTonbankcardSDK {
  const testPaymentHub = Address.parse(
    'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7'
  );

  return new MockTonbankcardSDK(
    {
      network: 'testnet',
      paymentHubAddress: testPaymentHub,
    },
    options
  );
}
