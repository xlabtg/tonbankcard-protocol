// Database layer for the Payment Status Indexer
// Read-only perspective - all data is derived from blockchain

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { applySqliteMigrationsSync, locateMigrationsDir } from './sync-migrate';

interface AccountHistoryResult {
  events: Array<{
    eventType: 'transfer' | 'payment' | 'state_change';
    timestamp: number;
    blockNumber: number;
    transactionHash: string;
    details: any;
  }>;
  totalCount: number;
}

interface AccountHistoryCache {
  result: AccountHistoryResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 5000; // 5 seconds

export class IndexerDatabase {
  private db: Database.Database;
  private historyCache: Map<string, AccountHistoryCache> = new Map();

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.initialize();
  }

  private initialize(): void {
    // Schema is owned by the migrator (`src/db/migrations/`). Apply every
    // pending SQLite migration synchronously so the database is ready
    // before any query is issued. Migration files double as the SQL the
    // async `db:migrate` CLI runs, so the two paths can never drift.
    const migrationsDir = locateMigrationsDir(__dirname);
    applySqliteMigrationsSync(this.db, migrationsDir);
  }

  /**
   * Run `fn` inside a single SQLite transaction (all-or-nothing).
   *
   * `better-sqlite3` transactions are synchronous: every write issued inside
   * `fn` commits together, and any thrown error rolls the whole batch back.
   * The indexer uses this to make a block's row, its events, and the cursor
   * advance commit atomically — see INDEXER-C3.
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Get latest indexed block number
   */
  getLatestBlockIndexed(): number {
    const row = this.db
      .prepare('SELECT latest_block_indexed FROM indexer_state WHERE id = 1')
      .get() as { latest_block_indexed: number } | undefined;
    return row?.latest_block_indexed || 0;
  }

  /**
   * Update latest indexed block
   */
  updateLatestBlock(blockNumber: number, timestamp: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `UPDATE indexer_state
         SET latest_block_indexed = ?, latest_block_timestamp = ?, last_update_time = ?
         WHERE id = 1`
      )
      .run(blockNumber, timestamp, now);
  }

  /**
   * Insert a new block
   */
  insertBlock(
    blockNumber: number,
    blockHash: string,
    parentHash: string,
    timestamp: number,
    transactionCount: number
  ): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO blocks (block_number, block_hash, parent_hash, timestamp, transaction_count, indexed_at, confirmed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      )
      .run(blockNumber, blockHash, parentHash, timestamp, transactionCount, now);
  }

  /**
   * Mark blocks as confirmed after N confirmations
   */
  markBlocksConfirmed(upToBlock: number): void {
    this.db
      .prepare('UPDATE blocks SET confirmed = 1 WHERE block_number <= ? AND confirmed = 0')
      .run(upToBlock);
  }

  /**
   * Get block by number
   */
  getBlock(blockNumber: number): {
    block_number: number;
    block_hash: string;
    parent_hash: string;
    timestamp: number;
    transaction_count: number;
    confirmed: boolean;
  } | null {
    const row = this.db
      .prepare('SELECT * FROM blocks WHERE block_number = ?')
      .get(blockNumber) as any;
    if (!row) return null;
    return {
      block_number: row.block_number,
      block_hash: row.block_hash,
      parent_hash: row.parent_hash,
      timestamp: row.timestamp,
      transaction_count: row.transaction_count,
      confirmed: row.confirmed === 1,
    };
  }

  /**
   * Detect chain reorg by checking block hash continuity
   */
  detectReorg(blockNumber: number, expectedHash: string): boolean {
    const stored = this.getBlock(blockNumber);
    if (!stored) return false;
    return stored.block_hash !== expectedHash;
  }

  /**
   * Handle reorg by deleting blocks from divergence point onwards.
   *
   * `account_snapshots` is a materialised view with no FK to `blocks`, so the
   * CASCADE that removes reverted `events` rows leaves snapshots derived from
   * those now-deleted events. To keep indexed state mirroring on-chain truth we:
   *   1. collect every `nft_address` referenced by the events about to be removed,
   *   2. delete the reverted blocks (events cascade away),
   *   3. recompute each affected snapshot from the surviving canonical events.
   * The whole sequence runs in a single transaction so a failure cannot leave a
   * half-rolled-back database. See INDEXER-C1 / docs/REORG_HANDLING.md.
   */
  handleReorg(fromBlock: number): void {
    const runReorg = this.db.transaction((from: number) => {
      // 1. Identify NFTs whose snapshots may depend on the events being removed.
      //    UNION dedupes across all four event tables (both sides of transfers).
      const affectedRows = this.db
        .prepare(
          `SELECT addr FROM (
             SELECT from_nft AS addr FROM internal_transfers WHERE block_number >= ?
             UNION SELECT to_nft FROM internal_transfers WHERE block_number >= ?
             UNION SELECT payer_nft FROM merchant_payments WHERE block_number >= ?
             UNION SELECT merchant_nft FROM merchant_payments WHERE block_number >= ?
             UNION SELECT nft_address FROM account_state_changes WHERE block_number >= ?
             UNION SELECT nft_address FROM nft_ownership_changes WHERE block_number >= ?
           )`
        )
        .all(from, from, from, from, from, from) as Array<{ addr: string | null }>;
      const affected = affectedRows
        .map((r) => r.addr)
        .filter((addr): addr is string => addr !== null);

      // 2. Delete reverted blocks; events are CASCADE-deleted via FK.
      this.db.prepare('DELETE FROM blocks WHERE block_number >= ?').run(from);

      // 3. Rebuild each affected snapshot from the surviving canonical events.
      for (const nftAddress of affected) {
        this.rebuildAccountSnapshot(nftAddress);
        this.invalidateHistoryCache(nftAddress);
      }

      // Update indexer state to the last surviving block.
      const newLatest = from - 1;
      const block = this.getBlock(newLatest);
      if (block) {
        this.updateLatestBlock(newLatest, block.timestamp);
      } else {
        this.updateLatestBlock(0, 0);
      }
    });

    runReorg(fromBlock);
  }

  /**
   * Recompute a single account snapshot from the surviving (canonical) events.
   *
   * Used during reorg rollback to reconcile a snapshot after the events it was
   * derived from may have been deleted. The snapshot fields are independently
   * recomputed from the event tables, and a snapshot with no surviving events is
   * removed so stale, reverted state can never be served.
   */
  private rebuildAccountSnapshot(nftAddress: string): void {
    const now = Math.floor(Date.now() / 1000);

    // Latest surviving ownership change (chain order = block then log index).
    const owner = this.db
      .prepare(
        `SELECT new_owner FROM nft_ownership_changes
         WHERE nft_address = ?
         ORDER BY block_number DESC, log_index DESC
         LIMIT 1`
      )
      .get(nftAddress) as { new_owner: string } | undefined;

    // Latest surviving state change.
    const state = this.db
      .prepare(
        `SELECT new_state, block_number FROM account_state_changes
         WHERE nft_address = ?
         ORDER BY block_number DESC, log_index DESC
         LIMIT 1`
      )
      .get(nftAddress) as { new_state: number; block_number: number } | undefined;

    // Highest block in which this NFT was party to a transfer or payment.
    const transfer = this.db
      .prepare(
        `SELECT MAX(block_number) AS last_block FROM (
           SELECT block_number FROM internal_transfers WHERE from_nft = ? OR to_nft = ?
           UNION ALL
           SELECT block_number FROM merchant_payments WHERE payer_nft = ? OR merchant_nft = ?
         )`
      )
      .get(nftAddress, nftAddress, nftAddress, nftAddress) as { last_block: number | null };

    // No surviving events for this NFT — clear the snapshot entirely.
    if (!owner && !state && transfer.last_block === null) {
      this.db.prepare('DELETE FROM account_snapshots WHERE nft_address = ?').run(nftAddress);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO account_snapshots
           (nft_address, current_owner, current_state, last_transfer_block, last_state_change_block, last_updated)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(nft_address) DO UPDATE SET
           current_owner = excluded.current_owner,
           current_state = excluded.current_state,
           last_transfer_block = excluded.last_transfer_block,
           last_state_change_block = excluded.last_state_change_block,
           last_updated = excluded.last_updated`
      )
      .run(
        nftAddress,
        owner?.new_owner ?? null,
        state?.new_state ?? 0,
        transfer.last_block,
        state?.block_number ?? null,
        now
      );
  }

  /**
   * Insert internal transfer event
   */
  insertInternalTransfer(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    fromNft: string;
    toNft: string;
    amountTbc: string;
    payloadHash: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO internal_transfers
         (block_number, transaction_hash, log_index, timestamp, from_nft, to_nft, amount_tbc, payload_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.fromNft,
        event.toNft,
        event.amountTbc,
        event.payloadHash
      );

    // Update account snapshots
    this.updateAccountSnapshot(event.fromNft, event.blockNumber);
    this.updateAccountSnapshot(event.toNft, event.blockNumber);

    // Invalidate history cache for affected accounts
    this.invalidateHistoryCache(event.fromNft);
    this.invalidateHistoryCache(event.toNft);
  }

  /**
   * Insert merchant payment event
   */
  insertMerchantPayment(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    payerNft: string;
    merchantNft: string;
    amountTbc: string;
    payloadHash: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO merchant_payments
         (block_number, transaction_hash, log_index, timestamp, payer_nft, merchant_nft, amount_tbc, payload_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.payerNft,
        event.merchantNft,
        event.amountTbc,
        event.payloadHash
      );

    // Update account snapshots
    this.updateAccountSnapshot(event.payerNft, event.blockNumber);
    this.updateAccountSnapshot(event.merchantNft, event.blockNumber);

    // Invalidate history cache for affected accounts
    this.invalidateHistoryCache(event.payerNft);
    this.invalidateHistoryCache(event.merchantNft);
  }

  /**
   * Insert account state change event
   */
  insertAccountStateChange(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    nftAddress: string;
    oldState: number;
    newState: number;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO account_state_changes
         (block_number, transaction_hash, log_index, timestamp, nft_address, old_state, new_state)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.nftAddress,
        event.oldState,
        event.newState
      );

    // Update account snapshot with new state
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO account_snapshots (nft_address, current_state, last_state_change_block, last_updated)
         VALUES (?, ?, ?, ?)`
      )
      .run(event.nftAddress, event.newState, event.blockNumber, now);

    // Invalidate history cache for affected account
    this.invalidateHistoryCache(event.nftAddress);
  }

  /**
   * Insert NFT ownership change event
   */
  insertNFTOwnershipChange(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    nftAddress: string;
    collectionAddress: string;
    oldOwner: string | null;
    newOwner: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO nft_ownership_changes
         (block_number, transaction_hash, log_index, timestamp, nft_address, collection_address, old_owner, new_owner)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.nftAddress,
        event.collectionAddress,
        event.oldOwner,
        event.newOwner
      );

    // Update account snapshot with new owner
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO account_snapshots (nft_address, current_owner, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(nft_address) DO UPDATE SET current_owner = ?, last_updated = ?`
      )
      .run(event.nftAddress, event.newOwner, now, event.newOwner, now);
  }

  /**
   * Update account snapshot (internal helper)
   */
  private updateAccountSnapshot(nftAddress: string, blockNumber: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO account_snapshots (nft_address, last_transfer_block, last_updated)
         VALUES (?, ?, ?)`
      )
      .run(nftAddress, blockNumber, now);

    this.db
      .prepare(
        `UPDATE account_snapshots
         SET last_transfer_block = ?, last_updated = ?
         WHERE nft_address = ?`
      )
      .run(blockNumber, now, nftAddress);
  }

  /**
   * Get account history using UNION ALL for efficient single-pass query with keyset pagination.
   *
   * Supports two pagination modes:
   * - Offset-based: provide offset (legacy, slower for deep pages)
   * - Keyset-based: provide beforeTimestamp to page efficiently through large histories
   */
  getAccountHistory(
    nftAddress: string,
    limit: number = 100,
    offset: number = 0,
    beforeTimestamp?: number
  ): AccountHistoryResult {
    const cacheKey = `${nftAddress}:${limit}:${offset}:${beforeTimestamp ?? ''}`;
    const now = Date.now();
    const cached = this.historyCache.get(cacheKey);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.result;
    }

    // Build UNION ALL query: each sub-query selects from one table with a common shape.
    // Composite indexes on (nft_address/from_nft/to_nft, timestamp DESC) are used per sub-query.
    // The outer query sorts and paginates the unified result set in a single pass.
    const tsFilter = beforeTimestamp !== undefined ? 'AND timestamp < ?' : '';

    const unionSql = `
      SELECT 'transfer' AS event_type, block_number, transaction_hash, timestamp,
             from_nft, to_nft, amount_tbc, payload_hash, NULL AS old_state, NULL AS new_state
      FROM internal_transfers
      WHERE (from_nft = ? OR to_nft = ?) ${tsFilter}
      UNION ALL
      SELECT 'payment' AS event_type, block_number, transaction_hash, timestamp,
             payer_nft AS from_nft, merchant_nft AS to_nft, amount_tbc, payload_hash, NULL AS old_state, NULL AS new_state
      FROM merchant_payments
      WHERE (payer_nft = ? OR merchant_nft = ?) ${tsFilter}
      UNION ALL
      SELECT 'state_change' AS event_type, block_number, transaction_hash, timestamp,
             NULL AS from_nft, NULL AS to_nft, NULL AS amount_tbc, NULL AS payload_hash, old_state, new_state
      FROM account_state_changes
      WHERE nft_address = ? ${tsFilter}
    `;

    const countSql = `SELECT COUNT(*) AS cnt FROM (${unionSql})`;
    const pageSql = `${unionSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

    let bindArgs: any[];
    if (beforeTimestamp !== undefined) {
      bindArgs = [nftAddress, nftAddress, beforeTimestamp, nftAddress, nftAddress, beforeTimestamp, nftAddress, beforeTimestamp];
    } else {
      bindArgs = [nftAddress, nftAddress, nftAddress, nftAddress, nftAddress];
    }

    const totalCount = (this.db.prepare(countSql).get(...bindArgs) as any).cnt as number;
    const rows = this.db.prepare(pageSql).all(...bindArgs, limit, offset) as any[];

    const events = rows.map((row: any) => {
      if (row.event_type === 'transfer') {
        return {
          eventType: 'transfer' as const,
          timestamp: row.timestamp,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
          details: {
            from: row.from_nft,
            to: row.to_nft,
            amount: row.amount_tbc,
            payloadHash: row.payload_hash,
          },
        };
      } else if (row.event_type === 'payment') {
        return {
          eventType: 'payment' as const,
          timestamp: row.timestamp,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
          details: {
            payer: row.from_nft,
            merchant: row.to_nft,
            amount: row.amount_tbc,
            payloadHash: row.payload_hash,
          },
        };
      } else {
        return {
          eventType: 'state_change' as const,
          timestamp: row.timestamp,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
          details: {
            oldState: row.old_state,
            newState: row.new_state,
          },
        };
      }
    });

    const result: AccountHistoryResult = { events, totalCount };
    this.historyCache.set(cacheKey, { result, cachedAt: now });
    return result;
  }

  /**
   * Invalidate the history cache for a specific account.
   * Called internally when new events are inserted for that account.
   */
  private invalidateHistoryCache(nftAddress: string): void {
    for (const key of this.historyCache.keys()) {
      if (key.startsWith(`${nftAddress}:`)) {
        this.historyCache.delete(key);
      }
    }
  }

  /**
   * Get payment by payload hash (for invoice lookups)
   */
  getPaymentByPayloadHash(payloadHash: string): any {
    return this.db
      .prepare(
        `SELECT block_number, transaction_hash, timestamp, payer_nft, merchant_nft, amount_tbc, payload_hash
         FROM merchant_payments
         WHERE payload_hash = ?
         ORDER BY timestamp DESC
         LIMIT 1`
      )
      .get(payloadHash);
  }

  /**
   * Get account snapshot
   */
  getAccountSnapshot(nftAddress: string): {
    nft_address: string;
    current_owner: string | null;
    current_state: number;
    last_transfer_block: number | null;
    last_state_change_block: number | null;
  } | null {
    return this.db
      .prepare('SELECT * FROM account_snapshots WHERE nft_address = ?')
      .get(nftAddress) as any;
  }

  /**
   * Get event count (for health check)
   */
  getEventCount(): number {
    const transferCount = (this.db.prepare('SELECT COUNT(*) as count FROM internal_transfers').get() as any).count;
    const paymentCount = (this.db.prepare('SELECT COUNT(*) as count FROM merchant_payments').get() as any).count;
    const stateCount = (this.db.prepare('SELECT COUNT(*) as count FROM account_state_changes').get() as any).count;
    const nftCount = (this.db.prepare('SELECT COUNT(*) as count FROM nft_ownership_changes').get() as any).count;
    return transferCount + paymentCount + stateCount + nftCount;
  }

  // ============================================================
  // E4 transparency aggregates (Issue #135)
  // Mirrors TransparencyRegistry.tact RecordProtocolMetrics /
  // RecordLockActivity / RecordParameterChange handlers.
  // ============================================================

  insertTransparencyProtocolMetrics(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    periodStart: number;
    periodEnd: number;
    activeAccounts: number;
    tbcVolumeTransferred: string;
    transferCount: number;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO transparency_protocol_metrics
         (block_number, transaction_hash, log_index, timestamp,
          period_start, period_end, active_accounts, tbc_volume_transferred, transfer_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.periodStart,
        event.periodEnd,
        event.activeAccounts,
        event.tbcVolumeTransferred,
        event.transferCount
      );
  }

  insertTransparencyLockActivity(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    periodStart: number;
    periodEnd: number;
    locksSet: number;
    locksCleared: number;
    locksActive: number;
    appealsFiled: number;
    appealsOverturned: number;
    appealsUpheld: number;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO transparency_lock_activity
         (block_number, transaction_hash, log_index, timestamp,
          period_start, period_end, locks_set, locks_cleared, locks_active,
          appeals_filed, appeals_overturned, appeals_upheld)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.periodStart,
        event.periodEnd,
        event.locksSet,
        event.locksCleared,
        event.locksActive,
        event.appealsFiled,
        event.appealsOverturned,
        event.appealsUpheld
      );
  }

  insertTransparencyParameterChange(event: {
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    timestamp: number;
    parameterId: string;
    oldValueHash: string;
    newValueHash: string;
    effectiveBlock: number;
    governanceProposalId: number | null;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO transparency_parameter_changes
         (block_number, transaction_hash, log_index, timestamp,
          parameter_id, old_value_hash, new_value_hash, effective_block, governance_proposal_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.blockNumber,
        event.transactionHash,
        event.logIndex,
        event.timestamp,
        event.parameterId,
        event.oldValueHash,
        event.newValueHash,
        event.effectiveBlock,
        event.governanceProposalId
      );
  }

  /**
   * Latest indexed protocol-metrics period (or null when none recorded yet).
   */
  getLatestTransparencyProtocolMetrics(): {
    period_start: number;
    period_end: number;
    active_accounts: number;
    tbc_volume_transferred: string;
    transfer_count: number;
    block_number: number;
    transaction_hash: string;
  } | null {
    return this.db
      .prepare(
        `SELECT period_start, period_end, active_accounts, tbc_volume_transferred,
                transfer_count, block_number, transaction_hash
         FROM transparency_protocol_metrics
         ORDER BY period_end DESC
         LIMIT 1`
      )
      .get() as any || null;
  }

  /**
   * Latest indexed lock-activity period (or null when none recorded yet).
   */
  getLatestTransparencyLockActivity(): {
    period_start: number;
    period_end: number;
    locks_set: number;
    locks_cleared: number;
    locks_active: number;
    appeals_filed: number;
    appeals_overturned: number;
    appeals_upheld: number;
    block_number: number;
    transaction_hash: string;
  } | null {
    return this.db
      .prepare(
        `SELECT period_start, period_end, locks_set, locks_cleared, locks_active,
                appeals_filed, appeals_overturned, appeals_upheld,
                block_number, transaction_hash
         FROM transparency_lock_activity
         ORDER BY period_end DESC
         LIMIT 1`
      )
      .get() as any || null;
  }

  /**
   * Historical protocol-metrics series, newest first.
   */
  listTransparencyProtocolMetrics(limit: number = 24): Array<{
    period_start: number;
    period_end: number;
    active_accounts: number;
    tbc_volume_transferred: string;
    transfer_count: number;
    block_number: number;
    transaction_hash: string;
  }> {
    return this.db
      .prepare(
        `SELECT period_start, period_end, active_accounts, tbc_volume_transferred,
                transfer_count, block_number, transaction_hash
         FROM transparency_protocol_metrics
         ORDER BY period_end DESC
         LIMIT ?`
      )
      .all(limit) as any[];
  }

  /**
   * Historical lock-activity series, newest first.
   */
  listTransparencyLockActivity(limit: number = 24): Array<{
    period_start: number;
    period_end: number;
    locks_set: number;
    locks_cleared: number;
    locks_active: number;
    appeals_filed: number;
    appeals_overturned: number;
    appeals_upheld: number;
    block_number: number;
    transaction_hash: string;
  }> {
    return this.db
      .prepare(
        `SELECT period_start, period_end, locks_set, locks_cleared, locks_active,
                appeals_filed, appeals_overturned, appeals_upheld,
                block_number, transaction_hash
         FROM transparency_lock_activity
         ORDER BY period_end DESC
         LIMIT ?`
      )
      .all(limit) as any[];
  }

  /**
   * Full parameter-change audit trail, newest first.
   */
  listTransparencyParameterChanges(limit: number = 100): Array<{
    parameter_id: string;
    old_value_hash: string;
    new_value_hash: string;
    effective_block: number;
    governance_proposal_id: number | null;
    block_number: number;
    transaction_hash: string;
    timestamp: number;
  }> {
    return this.db
      .prepare(
        `SELECT parameter_id, old_value_hash, new_value_hash, effective_block,
                governance_proposal_id, block_number, transaction_hash, timestamp
         FROM transparency_parameter_changes
         ORDER BY effective_block DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as any[];
  }

  /**
   * Cumulative counts (mirror on-chain `get fun getMetricPeriodsCount` etc.).
   */
  getTransparencyCounts(): {
    metric_periods: number;
    lock_periods: number;
    parameter_changes: number;
  } {
    const metricPeriods = (this.db
      .prepare('SELECT COUNT(*) AS count FROM transparency_protocol_metrics')
      .get() as any).count as number;
    const lockPeriods = (this.db
      .prepare('SELECT COUNT(*) AS count FROM transparency_lock_activity')
      .get() as any).count as number;
    const parameterChanges = (this.db
      .prepare('SELECT COUNT(*) AS count FROM transparency_parameter_changes')
      .get() as any).count as number;
    return {
      metric_periods: metricPeriods,
      lock_periods: lockPeriods,
      parameter_changes: parameterChanges,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
