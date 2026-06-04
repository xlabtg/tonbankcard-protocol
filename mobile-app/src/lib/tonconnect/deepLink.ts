/**
 * Mobile-specific TON Connect deep link helpers.
 *
 * SECURITY:
 * - The mobile flow ALWAYS hands the payment intent to the user's wallet.
 * - This module emits parseable URLs only; it never signs or authenticates.
 * - Universal HTTPS links are preferred for App Review compatibility.
 */

import {
  PaymentService,
  type PaymentRequest,
  isAllowedReturnUrl,
  isValidTonAddress,
} from '@tonbankcard/mobile-core';

export type WalletScheme = 'tonkeeper' | 'tonhub' | 'mytonwallet' | 'openmask' | 'universal';

export interface BuildDeepLinkOptions {
  readonly request: PaymentRequest;
  readonly scheme?: WalletScheme;
}

export interface DeepLinkBundle {
  readonly tonLink: string;
  readonly walletLink: string;
  readonly scheme: WalletScheme;
}

const UNIVERSAL_HOST: Record<Exclude<WalletScheme, 'universal'>, string> = {
  tonkeeper: 'https://app.tonkeeper.com/transfer/',
  tonhub: 'https://tonhub.com/transfer/',
  mytonwallet: 'https://connect.mytonwallet.org/transfer/',
  openmask: 'https://wallet.openmask.app/transfer/',
};

export function buildPaymentDeepLink(
  paymentService: PaymentService,
  options: BuildDeepLinkOptions,
): DeepLinkBundle {
  if (!isValidTonAddress(options.request.merchantNft)) {
    throw new Error(`Invalid merchant NFT address: ${options.request.merchantNft}`);
  }
  const tonLink = paymentService.generatePaymentLink(options.request);
  const scheme = options.scheme ?? 'universal';

  if (scheme === 'universal') {
    return { tonLink, walletLink: tonLink, scheme };
  }

  const base = UNIVERSAL_HOST[scheme];
  const search = tonLink.includes('?') ? tonLink.slice(tonLink.indexOf('?')) : '';
  return {
    tonLink,
    walletLink: `${base}${encodeURIComponent(options.request.merchantNft)}${search}`,
    scheme,
  };
}

const TON_LINK_RE = /^ton:\/\/transfer\/([^?]+)\?(.+)$/;

export interface ParseTonLinkOptions {
  readonly allowedReturnUrlHosts?: readonly string[];
}

export interface ParsedTonLink {
  readonly recipient: string;
  readonly amount?: string;
  readonly text?: string;
  readonly returnUrl?: string;
}

export function parseTonLink(
  link: string,
  options: ParseTonLinkOptions = {},
): ParsedTonLink | null {
  const match = TON_LINK_RE.exec(link);
  if (!match) {
    return null;
  }
  const [, encodedRecipient, query] = match;
  let recipient: string;
  try {
    recipient = decodeURIComponent(encodedRecipient);
  } catch {
    return null;
  }
  if (!isValidTonAddress(recipient)) {
    return null;
  }
  const params = new URLSearchParams(query);
  const amount = params.get('amount') ?? undefined;
  const text = params.get('text') ?? undefined;
  const returnUrl = params.get('return') ?? undefined;
  if (
    returnUrl &&
    !isAllowedReturnUrl(returnUrl, { allowedHosts: options.allowedReturnUrlHosts })
  ) {
    return null;
  }
  return {
    recipient,
    amount,
    text: text && text.length > 0 ? text : undefined,
    returnUrl,
  };
}
