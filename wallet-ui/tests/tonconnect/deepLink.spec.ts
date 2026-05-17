/**
 * Unit tests for TON deep link / TON Connect request URL builders.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildTonTransferLink,
  buildWalletConnectLink,
  buildWalletTransferLink,
  encodeTonConnectRequest,
  resolveTonLinks,
} from '../../src/tonconnect/deepLink';
import { KNOWN_WALLETS, getWalletById } from '../../src/tonconnect/wallets';

const ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const MANIFEST = 'https://tonbankcard.com/tonconnect-manifest.json';

describe('buildTonTransferLink', () => {
  it('builds a bare transfer link', () => {
    expect(buildTonTransferLink({ address: ADDRESS })).toBe(
      `ton://transfer/${ADDRESS}`
    );
  });

  it('encodes amount and text', () => {
    const link = buildTonTransferLink({
      address: ADDRESS,
      amount: '1000000000',
      text: 'Order #42',
    });
    expect(link).toContain(`ton://transfer/${ADDRESS}?`);
    expect(link).toContain('amount=1000000000');
    expect(link).toContain('text=Order+%2342');
  });

  it('rejects non-integer amount', () => {
    expect(() =>
      buildTonTransferLink({ address: ADDRESS, amount: '1.5' })
    ).toThrow(/amount/);
  });

  it('rejects malformed addresses', () => {
    expect(() => buildTonTransferLink({ address: '' })).toThrow(/address/);
    expect(() => buildTonTransferLink({ address: 'not-a-ton-addr' })).toThrow(
      /invalid TON address/
    );
  });
});

describe('encodeTonConnectRequest', () => {
  it('produces a payload with v=2, id and JSON r=', () => {
    const payload = encodeTonConnectRequest({
      v: 2,
      manifestUrl: MANIFEST,
      items: [{ name: 'ton_addr' }],
    });
    expect(payload).toMatch(/^v=2&id=[0-9a-f]+&r=/);
    const r = decodeURIComponent(payload.split('r=')[1]);
    const parsed = JSON.parse(r);
    expect(parsed.v).toBe(2);
    expect(parsed.manifestUrl).toBe(MANIFEST);
    expect(parsed.items[0].name).toBe('ton_addr');
  });

  it('requires ton_proof payload', () => {
    expect(() =>
      encodeTonConnectRequest({
        v: 2,
        manifestUrl: MANIFEST,
        items: [{ name: 'ton_proof' }],
      })
    ).toThrow(/ton_proof/);
  });

  it('rejects unknown item names', () => {
    expect(() =>
      encodeTonConnectRequest({
        v: 2,
        manifestUrl: MANIFEST,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [{ name: 'ton_foo' as any }],
      })
    ).toThrow(/unknown TON Connect item/);
  });
});

describe('buildWalletConnectLink', () => {
  it('prefers universal link for Tonkeeper', () => {
    const tonkeeper = getWalletById('tonkeeper')!;
    const link = buildWalletConnectLink(tonkeeper, MANIFEST);
    expect(link?.startsWith('https://app.tonkeeper.com/ton-connect?v=2')).toBe(
      true
    );
  });

  it('falls back to deep link when requested', () => {
    const tonkeeper = getWalletById('tonkeeper')!;
    const link = buildWalletConnectLink(tonkeeper, MANIFEST, {
      preferDeepLink: true,
    });
    expect(link?.startsWith('tonkeeper-tc://?v=2')).toBe(true);
  });

  it('returns null for extension-only wallets without links', () => {
    const openmask = getWalletById('openmask')!;
    expect(buildWalletConnectLink(openmask, MANIFEST)).toBeNull();
  });
});

describe('buildWalletTransferLink', () => {
  it('rewrites the universal link base to /transfer/<address>', () => {
    const tonkeeper = getWalletById('tonkeeper')!;
    const link = buildWalletTransferLink(tonkeeper, {
      address: ADDRESS,
      amount: '500000000',
    });
    expect(link?.startsWith('https://app.tonkeeper.com/transfer/')).toBe(true);
    expect(link).toContain(ADDRESS);
    expect(link).toContain('amount=500000000');
  });

  it('returns null for wallets without a universal link', () => {
    const openmask = getWalletById('openmask')!;
    expect(buildWalletTransferLink(openmask, { address: ADDRESS })).toBeNull();
  });
});

describe('resolveTonLinks', () => {
  it('returns primary + fallback for Tonkeeper', () => {
    const tonkeeper = KNOWN_WALLETS.find(w => w.id === 'tonkeeper')!;
    const { primary, fallback } = resolveTonLinks(tonkeeper, MANIFEST);
    expect(primary?.startsWith('https://')).toBe(true);
    expect(fallback?.startsWith('tonkeeper-tc://')).toBe(true);
  });
});
