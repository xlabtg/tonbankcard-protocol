/**
 * Unit tests for the TON Connect wallet registry.
 */

import { describe, it, expect } from '@jest/globals';
import {
  KNOWN_WALLETS,
  getWalletById,
  detectPlatform,
  walletsForPlatform,
} from '../../src/tonconnect/wallets';

describe('KNOWN_WALLETS', () => {
  it('includes the four reference wallets', () => {
    const ids = KNOWN_WALLETS.map(w => w.id).sort();
    expect(ids).toEqual(['mytonwallet', 'openmask', 'tonhub', 'tonkeeper']);
  });

  it('every wallet exposes a bridge and at least one platform', () => {
    for (const wallet of KNOWN_WALLETS) {
      expect(wallet.bridge.length).toBeGreaterThan(0);
      expect(wallet.platforms.length).toBeGreaterThan(0);
      expect(wallet.aboutUrl.startsWith('https://')).toBe(true);
      expect(wallet.imageUrl.startsWith('https://')).toBe(true);
    }
  });

  it('Tonkeeper exposes universal + deep + sse + js bridge', () => {
    const tonkeeper = KNOWN_WALLETS.find(w => w.id === 'tonkeeper');
    expect(tonkeeper).toBeDefined();
    expect(tonkeeper?.universalLink).toContain('https://app.tonkeeper.com');
    expect(tonkeeper?.deepLink).toContain('tonkeeper-tc://');
    expect(tonkeeper?.bridge.some(b => b.type === 'sse')).toBe(true);
    expect(tonkeeper?.bridge.some(b => b.type === 'js')).toBe(true);
  });
});

describe('getWalletById', () => {
  it('matches case-insensitively', () => {
    expect(getWalletById('Tonkeeper')?.id).toBe('tonkeeper');
    expect(getWalletById('TONHUB')?.id).toBe('tonhub');
  });

  it('returns undefined for unknown wallets', () => {
    expect(getWalletById('not-real')).toBeUndefined();
    expect(getWalletById('')).toBeUndefined();
  });
});

describe('detectPlatform', () => {
  it('detects iOS from iPhone UA', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)')).toBe(
      'ios'
    );
  });

  it('detects Android', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
  });

  it('detects macOS / Windows / Linux', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)')).toBe(
      'macos'
    );
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('windows');
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
  });

  it('returns unknown for empty UA', () => {
    expect(detectPlatform('')).toBe('unknown');
  });
});

describe('walletsForPlatform', () => {
  it('returns all wallets for unknown platform', () => {
    expect(walletsForPlatform('unknown')).toEqual([...KNOWN_WALLETS]);
  });

  it('returns wallets that support iOS', () => {
    const wallets = walletsForPlatform('ios');
    expect(wallets.length).toBeGreaterThan(0);
    for (const w of wallets) expect(w.platforms).toContain('ios');
  });

  it('returns only browser-extension wallets for browser-extension', () => {
    const wallets = walletsForPlatform('browser-extension');
    expect(wallets.map(w => w.id)).toContain('openmask');
  });
});
