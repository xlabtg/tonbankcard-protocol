/**
 * Standalone reproduction of PC-05 / #374 — PaymentWidget deep-link query injection.
 *
 * `before` column: a faithful copy of the pre-fix `generatePaymentLink`, which
 * interpolated `merchantNft` and `amount` straight into the URL with no
 * validation and no percent-encoding. A crafted value (e.g.
 * `amountTbc = "10&bin=evil"`) therefore injects an extra query parameter into
 * the `ton://transfer/...` link the payer's wallet receives.
 *
 * `after` column: the REAL, fixed `TonbankcardPaymentWidget` imported from
 * `sdk/src/widget/PaymentWidget.ts`, so the contrast is against live code —
 * exactly like the PC-03 / PC-04 reproductions drive their real modules.
 *
 * | Crafted `amountTbc = "10&bin=evil"`         |                                        |
 * | ---                                          | ---                                    |
 * | **Before the fix** (raw interpolation)      | **INJECTS** `bin=evil` ❌              |
 * | **After the fix** (validate + encode)       | throws `Invalid amount`, no `bin=evil` ✅ |
 */

import { describe, it, expect } from '@jest/globals';
import { TonbankcardPaymentWidget } from '../../sdk/src/widget/PaymentWidget';

interface PreFixConfig {
  merchantNft: string;
  amountTbc: string;
  orderId?: string;
  description?: string;
  returnUrl?: string;
}

/** Faithful copy of the PRE-FIX implementation (the bug under test). */
function oldGeneratePaymentLink(config: PreFixConfig): string {
  const amount = config.amountTbc;
  const parts = [
    `TONBANKCARD Payment`,
    config.orderId ? `Order: ${config.orderId}` : '',
    config.description || '',
  ]
    .filter(Boolean)
    .join(' | ');

  const text = encodeURIComponent(parts);
  // merchantNft and amount are interpolated raw — no validation, no encoding.
  let link = `ton://transfer/${config.merchantNft}?amount=${amount}&text=${text}`;

  if (config.returnUrl) {
    link += `&return=${encodeURIComponent(config.returnUrl)}`;
  }

  return link;
}

const validMerchant = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const rawMerchant =
  '0:0000000000000000000000000000000000000000000000000000000000000000';
const containerId = 'pay-container';

describe('PC-05 — before the fix (raw interpolation injects query params)', () => {
  it('INJECTS: a crafted amountTbc appends an attacker-controlled parameter', () => {
    const link = oldGeneratePaymentLink({
      merchantNft: validMerchant,
      amountTbc: '10&bin=evil',
    });

    // The "&bin=evil" breaks out of the amount field and becomes a standalone
    // query parameter the wallet would parse.
    expect(link).toContain('bin=evil');
    expect(link).toMatch(/[?&]bin=evil/);
  });

  it('INJECTS: a crafted merchantNft overrides the amount parameter', () => {
    const link = oldGeneratePaymentLink({
      merchantNft: 'EQabc?amount=1&bin=evil',
      amountTbc: '1000000000',
    });

    // Two `amount=` parameters now exist; the attacker's comes first.
    expect(link.match(/[?&]amount=/g)?.length).toBe(2);
    expect(link).toContain('bin=evil');
  });

  it('INJECTS: a raw-form address leaves its ":" unencoded in the path', () => {
    const link = oldGeneratePaymentLink({
      merchantNft: rawMerchant,
      amountTbc: '1000000000',
    });

    expect(link).toContain(`ton://transfer/${rawMerchant}?`);
  });
});

describe('PC-05 — after the fix (real widget validates and encodes)', () => {
  it('rejects the crafted amountTbc instead of injecting a parameter', () => {
    const widget = new TonbankcardPaymentWidget({
      containerId,
      merchantNft: validMerchant,
      amountTbc: '10&bin=evil',
    });

    expect(() => widget.generatePaymentLink()).toThrow(/Invalid amount/);

    let link = '';
    try {
      link = widget.generatePaymentLink();
    } catch {
      link = '';
    }
    expect(link).not.toContain('bin=evil');
  });

  it('rejects the crafted merchantNft instead of overriding amount', () => {
    const widget = new TonbankcardPaymentWidget({
      containerId,
      merchantNft: 'EQabc?amount=1&bin=evil',
      amountTbc: '1000000000',
    });

    expect(() => widget.generatePaymentLink()).toThrow(
      /Invalid merchant NFT address/
    );
  });

  it('percent-encodes the raw-form address in the path', () => {
    const widget = new TonbankcardPaymentWidget({
      containerId,
      merchantNft: rawMerchant,
      amountTbc: '1000000000',
    });
    const link = widget.generatePaymentLink();

    expect(link).toContain(`ton://transfer/${encodeURIComponent(rawMerchant)}?`);
    expect(link).not.toContain(`ton://transfer/${rawMerchant}?`);
  });

  it('encodes reserved characters from orderId inside text, keeping one amount param', () => {
    const widget = new TonbankcardPaymentWidget({
      containerId,
      merchantNft: validMerchant,
      amountTbc: '1000000000',
      orderId: '1&amount=999',
    });
    const link = widget.generatePaymentLink();

    expect(link.match(/[?&]amount=/g)?.length).toBe(1);
    expect(link).toContain(encodeURIComponent('Order: 1&amount=999'));
  });
});
