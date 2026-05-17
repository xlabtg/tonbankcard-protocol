/**
 * Unit tests for the TonConnectConnector session manager.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  TonConnectConnector,
  type ConnectorStorage,
  type ConnectorEvent,
} from '../../src/tonconnect/connector';

const MANIFEST_URL = 'https://tonbankcard.com/tonconnect-manifest.json';

function memoryStorage(): ConnectorStorage {
  const m = new Map<string, string>();
  return {
    get: k => m.get(k) ?? null,
    set: (k, v) => {
      m.set(k, v);
    },
    remove: k => {
      m.delete(k);
    },
  };
}

describe('TonConnectConnector', () => {
  let storage: ConnectorStorage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('requires manifestUrl', () => {
    expect(() => new TonConnectConnector({ manifestUrl: '' })).toThrow(
      /manifestUrl/
    );
  });

  it('rejects an inline manifest with HTTP URLs', () => {
    expect(
      () =>
        new TonConnectConnector({
          manifestUrl: MANIFEST_URL,
          manifest: {
            url: 'http://insecure',
            name: 'x',
            iconUrl: 'http://insecure/icon.png',
          },
        })
    ).toThrow(/Invalid TON Connect manifest/);
  });

  it('starts in disconnected state', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    expect(c.getState().status).toBe('disconnected');
  });

  it('connect() moves the session to pending and returns a URL', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    const url = c.connect('tonkeeper');
    expect(url.startsWith('https://app.tonkeeper.com/ton-connect?v=2')).toBe(
      true
    );
    expect(c.getState().status).toBe('pending');
    expect(c.getState().walletId).toBe('tonkeeper');
  });

  it('connect() rejects unknown wallets', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    expect(() => c.connect('not-real')).toThrow(/unknown wallet/);
  });

  it('connect() rejects wallets with no connection link', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    expect(() => c.connect('openmask')).toThrow(/connection link/);
  });

  it('applyReply() transitions pending -> connected', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    c.connect('tonkeeper');
    c.applyReply({ address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' });
    const state = c.getState();
    expect(state.status).toBe('connected');
    expect(state.walletId).toBe('tonkeeper');
    expect(state.address).toBe(
      'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
    );
  });

  it('applyReply() requires pending state', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    expect(() => c.applyReply({ address: 'EQ...' })).toThrow(
      /not waiting/
    );
  });

  it('persists state to storage and reloads it', () => {
    const c1 = new TonConnectConnector({
      manifestUrl: MANIFEST_URL,
      storage,
    });
    c1.connect('tonkeeper');
    c1.applyReply({ address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' });

    const c2 = new TonConnectConnector({
      manifestUrl: MANIFEST_URL,
      storage,
    });
    expect(c2.getState().status).toBe('connected');
    expect(c2.getState().walletId).toBe('tonkeeper');
  });

  it('disconnect() clears state and emits an event', () => {
    const events: ConnectorEvent[] = [];
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    c.on(e => events.push(e));
    c.connect('tonkeeper');
    c.applyReply({ address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' });
    c.disconnect();

    expect(c.getState().status).toBe('disconnected');
    expect(events.some(e => e.type === 'disconnected')).toBe(true);
  });

  it('cancel() reverts a pending session without emitting disconnected', () => {
    const events: ConnectorEvent[] = [];
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    c.on(e => events.push(e));
    c.connect('tonkeeper');
    c.cancel();

    expect(c.getState().status).toBe('disconnected');
    expect(events.some(e => e.type === 'disconnected')).toBe(false);
  });

  it('on() returns an unsubscribe that stops further events', () => {
    const events: ConnectorEvent[] = [];
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    const off = c.on(e => events.push(e));
    c.connect('tonkeeper');
    off();
    c.cancel();
    expect(events.length).toBe(1);
  });

  it('buildTransferLink() requires a connected wallet', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    expect(() =>
      c.buildTransferLink({
        address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
      })
    ).toThrow(/no wallet connected/);
  });

  it('buildTransferLink() returns a universal HTTPS link for Tonkeeper', () => {
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    c.connect('tonkeeper');
    c.applyReply({ address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' });
    const link = c.buildTransferLink({
      address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
      amount: '1000000000',
    });
    expect(link.startsWith('https://app.tonkeeper.com/transfer/')).toBe(true);
    expect(link).toContain('amount=1000000000');
  });

  it('emits statusChange + connected events on a successful flow', () => {
    const events: ConnectorEvent[] = [];
    const c = new TonConnectConnector({ manifestUrl: MANIFEST_URL, storage });
    c.on(e => events.push(e));
    c.connect('tonkeeper');
    c.applyReply({ address: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le' });

    const types = events.map(e => e.type);
    expect(types).toContain('statusChange');
    expect(types).toContain('connected');
  });
});
