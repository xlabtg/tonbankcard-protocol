/**
 * TONBANKCARD Mobile Core - Sync Service
 *
 * SECURITY NOTICE:
 * This service is READ-ONLY and NON-CUSTODIAL by design.
 * It NEVER signs transactions, stores private keys, or acts as a payment authority.
 * The blockchain is the single source of truth.
 */

import { MobileConfig, SyncStatus } from '../types';

/**
 * Sync Service
 *
 * Provides read-only access to indexer sync status.
 *
 * CRITICAL: This service NEVER modifies blockchain state.
 */
export class SyncService {
  private config: MobileConfig;

  /**
   * Create a SyncService instance
   *
   * @param config - Mobile SDK configuration
   */
  constructor(config: MobileConfig) {
    this.config = config;
  }

  /**
   * Get current sync status from the indexer
   *
   * READ-ONLY: Queries the indexer API for current sync state.
   *
   * @returns Sync status information
   */
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.config.apiEndpoint) {
      return {
        lastBlock: 0,
        lastSyncedAt: 0,
        isSyncing: false,
      };
    }

    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/sync/status`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: Record<string, unknown> = await response.json() as Record<string, unknown>;
      return {
        lastBlock: Number(data.lastBlock),
        lastSyncedAt: Number(data.lastSyncedAt),
        isSyncing: Boolean(data.isSyncing),
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch sync status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the last known block number from the indexer
   *
   * READ-ONLY: Convenience method that returns just the block number.
   *
   * @returns Last indexed block number
   */
  async getLastKnownBlock(): Promise<number> {
    const status = await this.getSyncStatus();
    return status.lastBlock;
  }
}
