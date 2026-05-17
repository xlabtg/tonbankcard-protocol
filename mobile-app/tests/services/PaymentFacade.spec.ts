import { describe, it, expect } from '@jest/globals';
import {
  PaymentService,
  type PaymentRequest,
  type TransactionItem,
} from '@tonbankcard/mobile-core';

import { PaymentFacade } from '../../src/lib/services/PaymentFacade';
import { DEFAULT_MAINNET_CONFIG, type AppConfig } from '../../src/lib/config';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const MERCHANT = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';

function makeConfig(): AppConfig {
  return { ...DEFAULT_MAINNET_CONFIG, paymentHubAddress: VALID_HUB };
}

class StubPaymentService extends PaymentService {
  private readonly txs: TransactionItem[];
  public lastRequest?: PaymentRequest;

  constructor(txs: TransactionItem[] = []) {
    super({ network: 'testnet', paymentHubAddress: VALID_HUB });
    this.txs = txs;
  }

  override generatePaymentLink(request: PaymentRequest): string {
    this.lastRequest = request;
    return `ton://transfer/${request.merchantNft}?amount=${request.amountTbc}`;
  }

  override async getTransactionHistory(_addr: string): Promise<TransactionItem[]> {
    return this.txs;
  }
}

describe('PaymentFacade.buildPaymentLink', () => {
  it('produces a deep link and formatted amount', () => {
    const stub = new StubPaymentService();
    const facade = new PaymentFacade(makeConfig(), stub);

    const result = facade.buildPaymentLink({
      merchantNft: MERCHANT,
      amountTbc: '2500000000',
    });

    expect(result.link).toBe(`ton://transfer/${MERCHANT}?amount=2500000000`);
    expect(result.amountFormatted).toBe('2.50 TBC');
    expect(stub.lastRequest?.merchantNft).toBe(MERCHANT);
  });

  it('rejects invalid merchant addresses', () => {
    const facade = new PaymentFacade(makeConfig(), new StubPaymentService());
    expect(() =>
      facade.buildPaymentLink({ merchantNft: 'not-an-address', amountTbc: '100' }),
    ).toThrow(/Invalid merchant NFT address/);
  });

  it('rejects zero or negative amounts', () => {
    const facade = new PaymentFacade(makeConfig(), new StubPaymentService());
    expect(() =>
      facade.buildPaymentLink({ merchantNft: MERCHANT, amountTbc: '0' }),
    ).toThrow(/positive integer in nanocoins/);
    expect(() =>
      facade.buildPaymentLink({ merchantNft: MERCHANT, amountTbc: '-1' }),
    ).toThrow(/positive integer in nanocoins/);
  });
});

describe('PaymentFacade.listTransactions', () => {
  it('formats counterparty, amount, and relative time', async () => {
    const tx: TransactionItem = {
      id: 'tx-1',
      type: 'receive',
      counterparty: MERCHANT,
      amount: '1500000000',
      timestamp: Math.floor(Date.now() / 1000) - 120,
      status: 'confirmed',
      txHash: '0xabc',
    };
    const facade = new PaymentFacade(makeConfig(), new StubPaymentService([tx]));

    const items = await facade.listTransactions(MERCHANT);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('tx-1');
    expect(items[0].type).toBe('receive');
    expect(items[0].amountFormatted).toBe('1.50 TBC');
    expect(items[0].counterpartyShort.length).toBeLessThan(MERCHANT.length);
    expect(items[0].relativeTime).toMatch(/ago$/);
    expect(items[0].status).toBe('confirmed');
    expect(items[0].txHash).toBe('0xabc');
  });

  it('returns an empty list when the service has no history', async () => {
    const facade = new PaymentFacade(makeConfig(), new StubPaymentService([]));
    const items = await facade.listTransactions(MERCHANT);
    expect(items).toEqual([]);
  });
});
