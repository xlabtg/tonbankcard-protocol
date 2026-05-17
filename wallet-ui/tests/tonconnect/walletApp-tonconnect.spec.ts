/**
 * Integration tests for the TonbankcardWalletUI <-> TON Connect wiring.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TonbankcardWalletUI } from '../../src/components/WalletApp';

const MANIFEST_URL = 'https://tonbankcard.com/tonconnect-manifest.json';

const baseConfig = {
  containerId: 'wallet-container',
  network: 'mainnet' as const,
  paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
};

describe('TonbankcardWalletUI + TON Connect', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="wallet-container"></div>';
  });

  it('does not initialise a connector when no manifest URL is provided', () => {
    const wallet = new TonbankcardWalletUI(baseConfig);
    expect(wallet.getConnector()).toBeNull();
    expect(wallet.getConnectionState()).toBeNull();
  });

  it('initialises a connector when manifest URL is provided', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    const connector = wallet.getConnector();
    expect(connector).not.toBeNull();
    expect(connector?.getState().status).toBe('disconnected');
  });

  it('validates inline manifest at construction time', () => {
    expect(
      () =>
        new TonbankcardWalletUI({
          ...baseConfig,
          tonConnectManifestUrl: MANIFEST_URL,
          tonConnectManifest: {
            url: 'http://insecure',
            name: 'x',
            iconUrl: 'http://insecure/icon.png',
          },
        })
    ).toThrow(/Invalid TON Connect manifest/);
  });

  it('renderPaymentQR() falls back to ton:// link when not connected', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    const svg = wallet.renderPaymentQR({ amount: '1000000000' });
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('buildPaymentLink() uses the connector universal link when connected', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    const connector = wallet.getConnector()!;
    connector.connect('tonkeeper');
    connector.applyReply({
      address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
    });
    const link = wallet.buildPaymentLink({ amount: '500000000' });
    expect(link.startsWith('https://app.tonkeeper.com/transfer/')).toBe(true);
  });

  it('mount() renders a connection status indicator when connector is configured', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    wallet.mount();
    const status = document.querySelector('[data-testid="tonconnect-status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('not connected');
  });

  it('openWalletSelector() mounts the modal exactly once', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    wallet.mount();
    const selector = wallet.openWalletSelector();
    expect(selector).not.toBeNull();
    expect(selector?.isOpen()).toBe(true);

    // Calling again should reuse the open selector
    const again = wallet.openWalletSelector();
    expect(again).toBe(selector);

    selector?.close();
  });

  it('disconnect() resets the connector state', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    const connector = wallet.getConnector()!;
    connector.connect('tonkeeper');
    connector.applyReply({
      address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
    });
    wallet.disconnect();
    expect(connector.getState().status).toBe('disconnected');
  });

  it('legacy generateConnectLink() still returns a ton:// transfer URL', () => {
    const wallet = new TonbankcardWalletUI(baseConfig);
    const link = wallet.generateConnectLink();
    expect(link.startsWith('ton://transfer/')).toBe(true);
  });

  it('unmount() cleans up the connector subscription and active selector', () => {
    const wallet = new TonbankcardWalletUI({
      ...baseConfig,
      tonConnectManifestUrl: MANIFEST_URL,
    });
    wallet.mount();
    const selector = wallet.openWalletSelector();
    expect(selector?.isOpen()).toBe(true);
    wallet.unmount();
    expect(selector?.isOpen()).toBe(false);
  });
});
