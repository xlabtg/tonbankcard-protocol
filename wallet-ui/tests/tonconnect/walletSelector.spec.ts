/**
 * Unit tests for the WalletSelector modal.
 *
 * Uses jsdom (already configured in jest.config.js) so we can mount the
 * modal in `document.body` and assert on the resulting DOM.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WalletSelector } from '../../src/tonconnect/walletSelector';

const MANIFEST_URL = 'https://tonbankcard.com/tonconnect-manifest.json';

describe('WalletSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('throws when manifestUrl is missing', () => {
    expect(
      () => new WalletSelector({ manifestUrl: '' })
    ).toThrow(/manifestUrl/);
  });

  it('throws when an inline manifest is invalid', () => {
    expect(
      () =>
        new WalletSelector({
          manifestUrl: MANIFEST_URL,
          manifest: {
            url: 'http://insecure',
            name: 'x',
            iconUrl: 'http://insecure/icon.png',
          },
        })
    ).toThrow(/Invalid TON Connect manifest/);
  });

  it('renders one row per wallet for the unknown platform', () => {
    const selector = new WalletSelector({
      manifestUrl: MANIFEST_URL,
      platform: 'unknown',
    });
    selector.show();
    const rows = document.querySelectorAll('[data-wallet-id]');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    selector.close();
  });

  it('filters wallets by platform (browser-extension)', () => {
    const selector = new WalletSelector({
      manifestUrl: MANIFEST_URL,
      platform: 'browser-extension',
    });
    selector.show();
    const ids = Array.from(
      document.querySelectorAll('[data-wallet-id]')
    ).map(el => el.getAttribute('data-wallet-id'));
    expect(ids).toContain('openmask');
    selector.close();
  });

  it('renders a QR code section when at least one universal wallet exists', () => {
    const selector = new WalletSelector({
      manifestUrl: MANIFEST_URL,
      platform: 'unknown',
    });
    selector.show();
    const qr = document.querySelector('[data-testid="tonconnect-qr"]');
    expect(qr).not.toBeNull();
    expect(qr?.innerHTML).toContain('<svg');
    selector.close();
  });

  it('isOpen() reflects mount state', () => {
    const selector = new WalletSelector({ manifestUrl: MANIFEST_URL });
    expect(selector.isOpen()).toBe(false);
    selector.show();
    expect(selector.isOpen()).toBe(true);
    selector.close();
    expect(selector.isOpen()).toBe(false);
  });

  it('fires onWalletSelected when a wallet row is clicked', () => {
    let picked = '';
    const selector = new WalletSelector({
      manifestUrl: MANIFEST_URL,
      platform: 'unknown',
      onWalletSelected: w => {
        picked = w.id;
      },
    });
    selector.show();
    const row = document.querySelector(
      '[data-wallet-id="tonkeeper"]'
    ) as HTMLElement;
    row.click();
    expect(picked).toBe('tonkeeper');
    selector.close();
  });

  it('Cancel button closes the modal and fires onClose', () => {
    let closed = false;
    const selector = new WalletSelector({
      manifestUrl: MANIFEST_URL,
      platform: 'unknown',
      onClose: () => {
        closed = true;
      },
    });
    selector.show();
    const cancel = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent === 'Cancel'
    ) as HTMLButtonElement;
    cancel.click();
    expect(closed).toBe(true);
    expect(selector.isOpen()).toBe(false);
  });
});
