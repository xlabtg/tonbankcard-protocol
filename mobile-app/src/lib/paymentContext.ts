import { isValidTonAddress } from '@tonbankcard/mobile-core';
import { AppConfig, validateAppConfig } from './config';
export interface PaymentContext { config: AppConfig; accountNft: string; requestPayerNft?: string; }
let context: PaymentContext | undefined;
/** Host supplies verified deployment config and selected NFT account; no demo addresses. */
export function configurePaymentContext(value: PaymentContext): void {
  validateAppConfig(value.config);
  if (!isValidTonAddress(value.config.paymentHubAddress) || !isValidTonAddress(value.accountNft)) throw new Error('Invalid hub/account address');
  if (value.requestPayerNft && !isValidTonAddress(value.requestPayerNft)) throw new Error('Invalid payer NFT');
  context = value;
}
export function getPaymentContext(): PaymentContext {
  if (!context) throw new Error('Configure payment hub and NFT account before opening the wallet');
  return context;
}
