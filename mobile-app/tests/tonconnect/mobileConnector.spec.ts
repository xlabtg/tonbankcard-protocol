import { describe, it, expect } from '@jest/globals';
import {
  MobileTonConnectConnector,
  type ConnectorEvent,
} from '../../src/lib/tonconnect/mobileConnector';
import { InMemorySecureStore } from '../../src/lib/secure/secureStore';
import type { TonConnectManifest } from '../../src/lib/tonconnect/manifest';

const VALID_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

const manifest: TonConnectManifest = {
  url: 'https://tonbankcard.app',
  name: 'TONBANKCARD',
  iconUrl: 'https://tonbankcard.app/icon.png',
};

function makeConnector() {
  const storage = new InMemorySecureStore();
  const connector = new MobileTonConnectConnector({
    manifest,
    storage,
    now: () => 1700000000,
  });
  return { connector, storage };
}

describe('MobileTonConnectConnector', () => {
  it('rejects invalid manifests at construction', () => {
    expect(
      () =>
        new MobileTonConnectConnector({
          manifest: {
            url: 'http://insecure',
            name: 'App',
            iconUrl: 'http://insecure/icon.png',
          },
          storage: new InMemorySecureStore(),
        }),
    ).toThrow(/Invalid TON Connect manifest/);
  });

  it('starts disconnected', () => {
    const { connector } = makeConnector();
    expect(connector.getSession().status).toBe('disconnected');
  });

  it('progresses through pending → connected and persists session', async () => {
    const { connector, storage } = makeConnector();
    const events: ConnectorEvent[] = [];
    connector.subscribe((e) => events.push(e));

    connector.beginConnect();
    expect(connector.getSession().status).toBe('pending');

    const session = await connector.finishConnect({
      walletId: 'tonkeeper',
      address: VALID_ADDRESS,
      platform: 'ios',
    });

    expect(session.status).toBe('connected');
    expect(session.walletId).toBe('tonkeeper');
    expect(session.address).toBe(VALID_ADDRESS);
    expect(session.platform).toBe('ios');
    expect(session.establishedAt).toBe(1700000000);

    expect(events.map((e) => e.type)).toEqual([
      'status_changed',
      'status_changed',
      'connected',
    ]);

    const persisted = await storage.get('tonbankcard.tonconnect.session.v1');
    expect(persisted).not.toBeNull();
    const decoded = JSON.parse(persisted!);
    expect(decoded.address).toBe(VALID_ADDRESS);
    expect(decoded.status).toBe('connected');
    expect(decoded).not.toHaveProperty('privateKey');
  });

  it('rejects invalid TON addresses on finishConnect', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.finishConnect({
        walletId: 'tonkeeper',
        address: 'definitely-not-an-address',
        platform: 'ios',
      }),
    ).rejects.toThrow(/Invalid TON address/);
  });

  it('restore() rehydrates a stored connected session', async () => {
    const { storage } = makeConnector();
    await storage.set(
      'tonbankcard.tonconnect.session.v1',
      JSON.stringify({
        status: 'connected',
        walletId: 'tonhub',
        address: VALID_ADDRESS,
        platform: 'android',
        establishedAt: 1699999999,
      }),
    );
    const connector = new MobileTonConnectConnector({ manifest, storage });
    const restored = await connector.restore();
    expect(restored.status).toBe('connected');
    expect(restored.walletId).toBe('tonhub');
    expect(restored.address).toBe(VALID_ADDRESS);
  });

  it('restore() ignores corrupt entries and clears them', async () => {
    const { storage } = makeConnector();
    await storage.set('tonbankcard.tonconnect.session.v1', '{not json');
    const connector = new MobileTonConnectConnector({ manifest, storage });
    const restored = await connector.restore();
    expect(restored.status).toBe('disconnected');
    expect(await storage.get('tonbankcard.tonconnect.session.v1')).toBeNull();
  });

  it('disconnect() clears state and emits an event', async () => {
    const { connector, storage } = makeConnector();
    await connector.finishConnect({
      walletId: 'tonkeeper',
      address: VALID_ADDRESS,
      platform: 'ios',
    });

    const events: ConnectorEvent[] = [];
    connector.subscribe((e) => events.push(e));

    await connector.disconnect();

    expect(connector.getSession().status).toBe('disconnected');
    expect(await storage.get('tonbankcard.tonconnect.session.v1')).toBeNull();
    expect(events.some((e) => e.type === 'disconnected')).toBe(true);
  });

  it('listener errors do not break the connector', async () => {
    const { connector } = makeConnector();
    connector.subscribe(() => {
      throw new Error('boom');
    });
    await expect(
      connector.finishConnect({
        walletId: 'tonkeeper',
        address: VALID_ADDRESS,
        platform: 'ios',
      }),
    ).resolves.toBeDefined();
  });
});
