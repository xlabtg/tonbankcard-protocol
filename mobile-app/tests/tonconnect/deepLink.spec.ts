import { describe, it, expect } from '@jest/globals';
import { PaymentService } from '@tonbankcard/mobile-core';

import {
  buildPaymentDeepLink,
  parseTonLink,
} from '../../src/lib/tonconnect/deepLink';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const MERCHANT = 'EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7';

function service(): PaymentService {
  return new PaymentService({ network: 'testnet', paymentHubAddress: VALID_HUB });
}

describe('buildPaymentDeepLink', () => {
  it('defaults to a universal ton:// link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { merchantNft: MERCHANT, amountTbc: '1000000000' },
    });
    expect(bundle.scheme).toBe('universal');
    expect(bundle.tonLink.startsWith('ton://transfer/')).toBe(true);
    expect(bundle.walletLink).toBe(bundle.tonLink);
  });

  it('builds a Tonkeeper universal HTTPS link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { merchantNft: MERCHANT, amountTbc: '1000000000' },
      scheme: 'tonkeeper',
    });
    expect(bundle.scheme).toBe('tonkeeper');
    expect(bundle.walletLink.startsWith('https://app.tonkeeper.com/transfer/')).toBe(true);
    expect(bundle.walletLink).toContain(MERCHANT);
    expect(bundle.walletLink).toContain('amount=1000000000');
  });

  it('builds a Tonhub HTTPS link', () => {
    const bundle = buildPaymentDeepLink(service(), {
      request: { merchantNft: MERCHANT, amountTbc: '500000000' },
      scheme: 'tonhub',
    });
    expect(bundle.walletLink.startsWith('https://tonhub.com/transfer/')).toBe(true);
    expect(bundle.walletLink).toContain('amount=500000000');
  });

  it('rejects invalid merchant addresses', () => {
    expect(() =>
      buildPaymentDeepLink(service(), {
        request: { merchantNft: 'garbage', amountTbc: '1000' },
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

  it('tolerates a missing optional text field', () => {
    const link = `ton://transfer/${MERCHANT}?amount=42`;
    const parsed = parseTonLink(link);
    expect(parsed?.amount).toBe('42');
    expect(parsed?.text).toBeUndefined();
    expect(parsed?.returnUrl).toBeUndefined();
  });
});
