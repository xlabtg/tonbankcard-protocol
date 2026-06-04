import { describe, it, expect } from '@jest/globals';
import { parseScannedPayment } from '../../src/lib/utils/qrPayload';

const VALID_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

describe('parseScannedPayment', () => {
  it('returns null for random text', () => {
    expect(parseScannedPayment('hello')).toBeNull();
    expect(parseScannedPayment('')).toBeNull();
  });

  it('parses a raw valid TON address as a recipient-only payment', () => {
    const result = parseScannedPayment(VALID_ADDRESS);
    expect(result).toEqual({ recipient: VALID_ADDRESS });
  });

  it('trims whitespace around raw addresses', () => {
    const result = parseScannedPayment(`  ${VALID_ADDRESS}  `);
    expect(result?.recipient).toBe(VALID_ADDRESS);
  });

  it('parses a full ton:// link with amount, memo, and return URL', () => {
    const link =
      `ton://transfer/${VALID_ADDRESS}?amount=1000000000` +
      `&text=${encodeURIComponent('Coffee')}` +
      `&return=${encodeURIComponent('https://shop.example.com/done')}`;
    const result = parseScannedPayment(link);
    expect(result).toEqual({
      recipient: VALID_ADDRESS,
      amountNanocoins: '1000000000',
      memo: 'Coffee',
      returnUrl: 'https://shop.example.com/done',
    });
  });

  it('rejects ton:// links with an unsafe return URL', () => {
    const link =
      `ton://transfer/${VALID_ADDRESS}?amount=1000000000` +
      `&return=${encodeURIComponent('javascript:alert(1)')}`;

    expect(parseScannedPayment(link)).toBeNull();
  });

  it('rejects ton:// links with an invalid recipient address', () => {
    const link = 'ton://transfer/garbage?amount=1000';
    expect(parseScannedPayment(link)).toBeNull();
  });

  it('rejects ton:// links with a non-numeric amount', () => {
    const link = `ton://transfer/${VALID_ADDRESS}?amount=lots`;
    expect(parseScannedPayment(link)).toBeNull();
  });
});
