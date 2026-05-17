/**
 * Thin facade around @tonbankcard/mobile-core's PaymentService.
 *
 * NON-CUSTODIAL:
 * - Generates wallet deep links ONLY.
 * - User wallet remains the sole signing authority.
 * - Returned transaction history is read-only data from the indexer.
 */

import {
  PaymentService,
  type PaymentRequest,
  type TransactionItem,
  formatTBC,
  isValidTonAddress,
  shortAddress,
  formatRelativeTime,
} from '@tonbankcard/mobile-core';

import type { AppConfig } from '../config';

export interface DisplayTransaction {
  readonly id: string;
  readonly type: TransactionItem['type'];
  readonly counterparty: string;
  readonly counterpartyShort: string;
  readonly amountFormatted: string;
  readonly amountNanocoins: string;
  readonly relativeTime: string;
  readonly timestamp: number;
  readonly status: TransactionItem['status'];
  readonly txHash?: string;
}

export interface PaymentLinkResult {
  readonly request: PaymentRequest;
  readonly link: string;
  readonly amountFormatted: string;
}

export class PaymentFacade {
  private readonly service: PaymentService;

  constructor(config: AppConfig, service?: PaymentService) {
    this.service = service ?? new PaymentService(config);
  }

  buildPaymentLink(request: PaymentRequest): PaymentLinkResult {
    if (!isValidTonAddress(request.merchantNft)) {
      throw new Error(`Invalid merchant NFT address: ${request.merchantNft}`);
    }
    const amount = BigInt(request.amountTbc);
    if (amount <= 0n) {
      throw new Error('Payment amount must be a positive integer in nanocoins');
    }

    const link = this.service.generatePaymentLink(request);
    return {
      request,
      link,
      amountFormatted: `${formatTBC(request.amountTbc, 2)} TBC`,
    };
  }

  async listTransactions(nftAddress: string): Promise<DisplayTransaction[]> {
    const items = await this.service.getTransactionHistory(nftAddress);
    return items.map((item): DisplayTransaction => ({
      id: item.id,
      type: item.type,
      counterparty: item.counterparty,
      counterpartyShort: shortAddress(item.counterparty),
      amountFormatted: `${formatTBC(item.amount, 2)} TBC`,
      amountNanocoins: item.amount,
      relativeTime: formatRelativeTime(item.timestamp),
      timestamp: item.timestamp,
      status: item.status,
      txHash: item.txHash,
    }));
  }
}
