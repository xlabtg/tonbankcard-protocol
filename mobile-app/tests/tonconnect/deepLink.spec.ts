import { describe, it, expect } from '@jest/globals';
import { PaymentService } from '@tonbankcard/mobile-core';

import {
  buildPaymentDeepLink,
  parseTonLink,
} from '../../src/lib/tonconnect/deepLink';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const MERCHANT = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';
const RAW_MERCHANT =
  '0:0000000000000000000000000000000000000000000000000000000000000000';

function service(): PaymentService {
  return new PaymentService({ network: 'testnet', paymentHubAddress: VALID_HUB });
}

describe('buildPaymentDeepLink', () => {
  it('defaults to a universal ton:// link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { payerNft: MERCHANT, merchantNft: MERCHANT, amountTbc: '1000000000' },
    });
    expect(bundle.scheme).toBe('universal');
    expect(bundle.tonLink.startsWith('ton://transfer/')).toBe(true);
    expect(bundle.walletLink).toBe(bundle.tonLink);
  });

  it('builds a Tonkeeper universal HTTPS link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { payerNft: MERCHANT, merchantNft: MERCHANT, amountTbc: '1000000000' },
      scheme: 'tonkeeper',
    });
    expect(bundle.scheme).toBe('tonkeeper');
    expect(bundle.walletLink.startsWith('https://app.tonkeeper.com/transfer/')).toBe(true);
    expect(bundle.walletLink).toContain(VALID_HUB);
    expect(bundle.walletLink).toContain('amount=50000000');
  });

  it('encodes raw-form merchant addresses in wallet universal links', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { payerNft: MERCHANT, merchantNft: RAW_MERCHANT, amountTbc: '1000000000' },
      scheme: 'tonkeeper',
    });

    expect(bundle.walletLink).toContain(
      `/transfer/${VALID_HUB}?`
    );
  });

  it('builds a Tonhub HTTPS link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { payerNft: MERCHANT, merchantNft: MERCHANT, amountTbc: '500000000' },
      scheme: 'tonhub',
    });
    expect(bundle.walletLink.startsWith('https://tonhub.com/transfer/')).toBe(true);
    expect(bundle.walletLink).toContain('amount=50000000');
  });

  it('rejects invalid merchant addresses', () => {
    expect(() =>
      buildPaymentDeepLink(service(), {
        request: { payerNft: MERCHANT, merchantNft: 'garbage', amountTbc: '1000' },
      }),
    ).toThrow(/Invalid merchant NFT address/);
  });
});

describe('parseTonLink', () => {
  it('returns null for non ton:// inputs', () => {
    expect(parseTonLink('https://example.com/foo')).toBeNull();
    expect(parseTonLink('hello world')).toBeNull();
  });

  it('extracts recipient, amount, text, and return URL', () => {
    const link =
      `ton://transfer/${MERCHANT}?amount=1000000000` +
      `&text=${encodeURIComponent('Coffee')}` +
      `&return=${encodeURIComponent('https://shop.example.com/done')}`;
    const parsed = parseTonLink(link);
    expect(parsed).not.toBeNull();
    expect(parsed!.recipient).toBe(MERCHANT);
    expect(parsed!.amount).toBe('1000000000');
    expect(parsed!.text).toBe('Coffee');
    expect(parsed!.returnUrl).toBe('https://shop.example.com/done');
  });

  it('decodes text exactly once when parsing generated payment links', () => {
    const literalText = 'Literal percent sequences: %20 and %26';
    const link = service().generatePaymentLink({
      payerNft: MERCHANT, merchantNft: MERCHANT,
      amountTbc: '1000000000',
      description: literalText,
    });

    const parsed = parseTonLink(link);
    expect(parsed?.text).toBe(`TONBANKCARD Payment: mobile-payment - ${literalText}`);
  });

  it('rejects unsafe return URLs', () => {
    const link =
      `ton://transfer/${MERCHANT}?amount=1000000000` +
      `&return=${encodeURIComponent('javascript:alert(1)')}`;

    expect(parseTonLink(link)).toBeNull();
  });

  it('rejects return URLs outside the configured host allowlist', () => {
    const link =
      `ton://transfer/${MERCHANT}?amount=1000000000` +
      `&return=${encodeURIComponent('https://evil.example.com/done')}`;

    expect(parseTonLink(link, { allowedReturnUrlHosts: ['shop.example.com'] })).toBeNull();
  });

  it('parses generated raw-form recipient links', () => {
    const link = service().generatePaymentLink({
      payerNft: MERCHANT, merchantNft: RAW_MERCHANT,
      amountTbc: '1000000000',
    });

    const parsed = parseTonLink(link);
    expect(parsed?.recipient).toBe(VALID_HUB);
  });

  it('tolerates a missing optional text field', () => {
    const link = `ton://transfer/${MERCHANT}?amount=42`;
    const parsed = parseTonLink(link);
    expect(parsed?.amount).toBe('42');
    expect(parsed?.text).toBeUndefined();
    expect(parsed?.returnUrl).toBeUndefined();
  });
});
