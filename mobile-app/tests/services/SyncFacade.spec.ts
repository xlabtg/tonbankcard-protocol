import { describe, it, expect } from '@jest/globals';
import { SyncService, type SyncStatus } from '@tonbankcard/mobile-core';

import { SyncFacade } from '../../src/lib/services/SyncFacade';
import { DEFAULT_MAINNET_CONFIG, type AppConfig } from '../../src/lib/config';

const VALID_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

function makeConfig(): AppConfig {
  return { ...DEFAULT_MAINNET_CONFIG, paymentHubAddress: VALID_HUB };
}

class StubSyncService extends SyncService {
  constructor(private readonly status: SyncStatus) {
    super({ network: 'testnet', paymentHubAddress: VALID_HUB });
  }
  override async getSyncStatus(): Promise<SyncStatus> {
    return this.status;
  }
}

describe('SyncFacade', () => {
  it('returns a relative timestamp when synced', async () => {
    const facade = new SyncFacade(
      makeConfig(),
      new StubSyncService({
        lastBlock: 42,
        lastSyncedAt: Math.floor(Date.now() / 1000) - 30,
        isSyncing: false,
      }),
    );
    const snapshot = await facade.getSnapshot();
    expect(snapshot.lastBlock).toBe(42);
    expect(snapshot.isSyncing).toBe(false);
    expect(snapshot.lastSyncedRelative).toMatch(/ago$/);
  });

  it('reports "never" when there is no sync history', async () => {
    const facade = new SyncFacade(
      makeConfig(),
      new StubSyncService({ lastBlock: 0, lastSyncedAt: 0, isSyncing: false }),
    );
    const snapshot = await facade.getSnapshot();
    expect(snapshot.lastSyncedRelative).toBe('never');
  });

  it('preserves the isSyncing flag from the core', async () => {
    const facade = new SyncFacade(
      makeConfig(),
      new StubSyncService({ lastBlock: 10, lastSyncedAt: 1, isSyncing: true }),
    );
    const snapshot = await facade.getSnapshot();
    expect(snapshot.isSyncing).toBe(true);
  });
});
