/**
 * Thin facade around @tonbankcard/mobile-core's SyncService.
 *
 * Exposes read-only sync metrics to UI surfaces.
 */

import { SyncService, type SyncStatus, formatRelativeTime } from '@tonbankcard/mobile-core';

import type { AppConfig } from '../config';

export interface SyncSnapshot extends SyncStatus {
  readonly lastSyncedRelative: string;
}

export class SyncFacade {
  private readonly service: SyncService;

  constructor(config: AppConfig, service?: SyncService) {
    this.service = service ?? new SyncService(config);
  }

  async getSnapshot(): Promise<SyncSnapshot> {
    const status = await this.service.getSyncStatus();
    return {
      ...status,
      lastSyncedRelative:
        status.lastSyncedAt > 0 ? formatRelativeTime(status.lastSyncedAt) : 'never',
    };
  }
}
