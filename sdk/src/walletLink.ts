import { Address, beginCell, Cell } from '@ton/core';
import { Invoice, TonbankcardConfig, WalletLinkParams } from './types';
import { isValidTonAddress } from './utils';

export const MERCHANT_PAYMENT_REQUEST_OP = 0x16b56831;
export const DEFAULT_WALLET_LINK_NATIVE_AMOUNT = 50_000_000n;

const INVOICE_ID_PAYLOAD_TYPE = 2;

function assertAddress(address: Address, fieldName: string): void {
  try {
    if (address == null || typeof address.toString !== 'function') {
      throw new Error('missing address');
    }
    if (!isValidTonAddress(address.toString())) {
      throw new Error('invalid address');
    }
  } catch {
    throw new Error(`Invalid ${fieldName} address`);
  }
}

function buildDefaultInvoicePayload(invoice: Invoice): Cell {
  return beginCell()
    .storeUint(INVOICE_ID_PAYLOAD_TYPE, 8)
    .storeStringTail(invoice.id)
    .endCell();
}

function encodeCellBase64Url(cell: Cell): string {
  return Buffer.from(cell.toBoc({ idx: false })).toString('base64url');
}

export function buildMerchantPaymentRequestBody(
  invoice: Invoice,
  payerNft: Address,
  payload?: Cell
): Cell {
  return beginCell()
    .storeUint(MERCHANT_PAYMENT_REQUEST_OP, 32)
    .storeAddress(payerNft)
    .storeAddress(invoice.merchantNft)
    .storeCoins(invoice.amountTbc)
    .storeMaybeRef(payload ?? buildDefaultInvoicePayload(invoice))
    .endCell();
}

export function buildWalletLink(
  config: TonbankcardConfig,
  params: WalletLinkParams
): string {
  const {
    invoice,
    payerNft,
    returnUrl,
    nativeAmountNanoTon = DEFAULT_WALLET_LINK_NATIVE_AMOUNT,
    payload,
  } = params;

  if (invoice.amountTbc <= 0n) {
    throw new Error('Invalid invoice amount');
  }
  assertAddress(invoice.merchantNft, 'merchant NFT');
  assertAddress(payerNft, 'payer NFT');
  assertAddress(config.paymentHubAddress, 'payment hub');
  if (typeof nativeAmountNanoTon !== 'bigint' || nativeAmountNanoTon <= 0n) {
    throw new Error('Native TON amount must be a positive bigint');
  }

  const body = buildMerchantPaymentRequestBody(invoice, payerNft, payload);
  const memo = `TONBANKCARD Payment: ${invoice.id}${
    invoice.description ? ` - ${invoice.description}` : ''
  }`;

  const query = new URLSearchParams();
  query.set('amount', nativeAmountNanoTon.toString());
  query.set('bin', encodeCellBase64Url(body));
  query.set('text', memo);
  if (returnUrl) {
    query.set('return', returnUrl);
  }

  return `ton://transfer/${config.paymentHubAddress.toString()}?${query.toString()}`;
}
