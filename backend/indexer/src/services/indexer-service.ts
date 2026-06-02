// Indexer Service - Observes blockchain and indexes events
// Handles reorgs and maintains read-only event database

import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import { IndexerDatabase } from '../db/database';
import { EventParser } from '../parsers/event-parser';
import { IndexerConfig } from '../types/config';
import { IndexedEvent } from '../types/events';
import { IndexerErrorCode, makeEventId } from '../types/errors';
import pino from 'pino';

/** Coerce an unknown thrown value into a safe `{name, message}` log field. */
function toErrInfo(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'Unknown', message: String(error) };
}

/** Max transaction descriptors requested per `getBlockTransactions` page. */
const BLOCK_TX_PAGE_SIZE = 256;
/** Safety cap on `getBlockTransactions` pages per shard block (anti-runaway). */
const MAX_BLOCK_TX_PAGES = 1000;

/**
 * Extract the latest masterchain seqno from a `getMasterchainInfo()` response.
 *
 * The `@ton/ton` `TonClient` wrapper flattens the tip onto `latestSeqno`, while
 * the raw toncenter HTTP API (and other clients) nest it under `last.seqno`
 * (INDEXER-H3). Reading only one shape lets a wrapper/version swap silently
 * yield `undefined`, which would propagate to `NaN` sync bounds and stall the
 * loop without an error. We accept both shapes and let the caller validate the
 * result is a finite number.
 */
/**
 * Normalise a TON address to its canonical string form for comparison.
 *
 * Routing decisions compare the message's real on-chain account (e.g.
 * `in_msg.destination`) against the configured contract addresses (INDEXER-H4).
 * Those two sources can be encoded differently — raw `0:<hex>` vs.
 * user-friendly `EQ…`/`UQ…`, or with different bounceable/test-only flags — so a
 * naive string compare would spuriously reject a genuine match. We parse both
 * sides to the canonical representation before comparing. Unparseable input
 * (empty string, malformed value) is returned verbatim so the caller still gets
 * a deterministic, non-throwing key.
 */
function normalizeAddress(addr: string): string {
  if (!addr) {
    return '';
  }
  try {
    return Address.parse(addr).toString();
  } catch {
    return addr;
  }
}

function extractLatestSeqno(info: unknown): number {
  if (info && typeof info === 'object') {
    const obj = info as { latestSeqno?: unknown; last?: { seqno?: unknown } };
    if (typeof obj.latestSeqno === 'number') {
      return obj.latestSeqno;
    }
    if (obj.last && typeof obj.last.seqno === 'number') {
      return obj.last.seqno;
    }
  }
  return NaN;
}

export class IndexerService {
  private client: TonClient;
  private db: IndexerDatabase;
  private parser: EventParser;
  private config: IndexerConfig;
  private logger: pino.Logger;
  private isRunning: boolean = false;
  private pollInterval?: NodeJS.Timeout;

  constructor(
    config: IndexerConfig,
    db: IndexerDatabase,
    logger: pino.Logger
  ) {
    this.config = config;
    this.db = db;
    this.parser = new EventParser();
    this.logger = logger.child({ service: 'indexer' });

    this.client = new TonClient({
      endpoint: config.tonApiEndpoint,
      apiKey: config.tonApiKey,
    });
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Indexer already running');
      return;
    }

    this.logger.info('Starting indexer service');
    this.isRunning = true;

    // Initial sync
    await this.syncBlocks();

    // Start polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.syncBlocks();
      } catch (error) {
        this.logger.error(
          {
            errorCode: IndexerErrorCode.SYNC_FAILED,
            err: toErrInfo(error),
          },
          'Error during sync'
        );
      }
    }, this.config.indexer.pollIntervalMs);

    this.logger.info('Indexer service started');
  }

  /**
   * Stop the indexer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping indexer service');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }

    this.logger.info('Indexer service stopped');
  }

  /**
   * Sync blocks from blockchain
   */
  private async syncBlocks(): Promise<void> {
    try {
      // Get latest indexed block
      const latestIndexed = this.db.getLatestBlockIndexed();

      // Get latest block from chain
      const latestBlock = await this.getLatestBlock();

      if (!latestBlock) {
        this.logger.warn('Could not fetch latest block');
        return;
      }

      // Persist the chain head so confirmation depth is derived from one
      // canonical value everywhere (INDEXER-H1). The API reads the same seqno
      // when reporting payment status.
      this.db.setLatestChainSeqno(latestBlock.seqno);

      this.logger.debug(
        { latestIndexed, latestChain: latestBlock.seqno },
        'Sync status'
      );

      // Re-validate the trailing window of already-indexed blocks against the
      // chain before advancing the cursor. Because the cursor only moves
      // forward, a reorg that rewrites a block we already stored would never be
      // revisited by the forward sync below and would silently persist
      // (INDEXER-C2). On the first mismatch `handleReorg` rolls back from the
      // divergent height; the forward sync then re-indexes the canonical
      // replacement blocks in the same poll.
      const reorgFrom = await this.revalidateIndexedRange(latestIndexed);
      if (reorgFrom !== null) {
        this.logger.warn(
          { reorgFrom },
          'Reorg detected within indexed range; rolled back and resyncing'
        );
      }

      // Re-read the cursor: a rollback above moves `latest_block_indexed` back.
      const cursor = this.db.getLatestBlockIndexed();

      // Determine start block
      const startBlock = Math.max(
        cursor + 1,
        this.config.indexer.startBlock
      );

      // Don't sync blocks that aren't confirmed yet
      const confirmationBlocks = this.config.indexer.confirmationBlocks;
      const endBlock = latestBlock.seqno - confirmationBlocks;

      if (startBlock > endBlock) {
        this.logger.trace('No new confirmed blocks to sync');
        return;
      }

      // Sync in batches
      const batchSize = this.config.indexer.batchSize;
      for (
        let currentBlock = startBlock;
        currentBlock <= endBlock;
        currentBlock += batchSize
      ) {
        const batchEnd = Math.min(currentBlock + batchSize - 1, endBlock);
        await this.syncBlockRange(currentBlock, batchEnd);
      }

      // Mark confirmed blocks. `endBlock` is already `chainHead -
      // confirmationBlocks`, i.e. the highest block at the required
      // confirmation depth, so it IS the confirmation cutoff. Subtracting the
      // depth again here (the previous behaviour) left a band of width
      // `confirmationBlocks` of genuinely confirmed blocks flagged unconfirmed
      // (INDEXER-H1). The cutoff matches `isBlockConfirmed(chainHead, b, K)`
      // used by the API: b <= chainHead - K  <=>  chainHead - b >= K.
      const confirmUpTo = endBlock;
      if (confirmUpTo > 0) {
        this.db.markBlocksConfirmed(confirmUpTo);
      }
    } catch (error) {
      this.logger.error(
        {
          errorCode: IndexerErrorCode.SYNC_FAILED,
          err: toErrInfo(error),
        },
        'Error syncing blocks'
      );
      throw error;
    }
  }

  /**
   * Sync a range of blocks
   */
  private async syncBlockRange(
    startBlock: number,
    endBlock: number
  ): Promise<void> {
    this.logger.info({ startBlock, endBlock }, 'Syncing block range');

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      // Check for reorg before processing
      const reorgDetected = await this.detectAndHandleReorg(blockNum);
      if (reorgDetected) {
        this.logger.warn({ blockNum }, 'Reorg detected, resetting sync');
        return; // Will retry on next poll
      }

      // Fetch and process block
      await this.processBlock(blockNum);
    }
  }

  /**
   * Re-validate the trailing window of already-indexed blocks against the chain.
   *
   * The forward sync loop only examines blocks it is about to index for the
   * first time, so a reorg that rewrites a block already stored is never
   * detected by it (INDEXER-C2). On each poll we therefore re-check the last
   * `confirmationBlocks` stored block hashes against the chain, walking from the
   * oldest height in the window forward. `detectAndHandleReorg` triggers
   * `handleReorg` on the first divergent height; we return that height so the
   * caller can log it and resync.
   *
   * @param latestIndexed - the current `latest_block_indexed` cursor
   * @returns the first divergent height when a reorg was rolled back, else null
   */
  private async revalidateIndexedRange(
    latestIndexed: number
  ): Promise<number | null> {
    if (latestIndexed <= 0) {
      return null; // Nothing indexed yet — no stored blocks to re-validate.
    }

    // Re-validate at least `confirmationBlocks` trailing blocks (>= K per spec).
    const window = Math.max(1, this.config.indexer.confirmationBlocks);
    const from = Math.max(1, latestIndexed - window + 1);

    for (let blockNum = from; blockNum <= latestIndexed; blockNum++) {
      const reorgDetected = await this.detectAndHandleReorg(blockNum);
      if (reorgDetected) {
        // handleReorg already rolled back from this divergent height. Stop here:
        // everything above it was deleted, so there is nothing left to check.
        return blockNum;
      }
    }

    return null;
  }

  /**
   * Detect and handle blockchain reorganization
   */
  private async detectAndHandleReorg(blockNumber: number): Promise<boolean> {
    // Get stored block if exists
    const storedBlock = this.db.getBlock(blockNumber);
    if (!storedBlock) {
      return false; // No stored block, no reorg
    }

    // Fetch current block from chain
    const chainBlock = await this.getBlockByNumber(blockNumber);
    if (!chainBlock) {
      this.logger.warn({ blockNumber }, 'Could not fetch block from chain');
      return false;
    }

    // Compare hashes
    const chainHash = this.getBlockHash(chainBlock);
    if (storedBlock.block_hash !== chainHash) {
      this.logger.warn(
        {
          errorCode: IndexerErrorCode.REORG_DETECTED,
          eventId: makeEventId(blockNumber),
          blockNumber,
          storedHash: storedBlock.block_hash,
          chainHash,
        },
        'Reorg detected - block hash mismatch'
      );

      // Handle reorg - delete from divergence point
      this.db.handleReorg(blockNumber);
      return true;
    }

    return false;
  }

  /**
   * Process a single block
   *
   * In TON, transactions belong to individual accounts. We fetch block
   * header data for reorg detection, then query transactions for each
   * tracked contract address within that block's time window.
   */
  private async processBlock(blockNumber: number): Promise<void> {
    try {
      const block = await this.getBlockByNumber(blockNumber);
      if (!block) {
        this.logger.warn({ blockNumber }, 'Block not found');
        return;
      }

      const blockHash = this.getBlockHash(block);
      const parentHash = this.getParentHash(block);
      const timestamp = this.getBlockTimestamp(block);

      // Fetch transactions that this block confirmed for tracked contracts.
      // Each transaction is scoped to `blockNumber` (see fetchBlockTransactions),
      // so attributing it to the current block below is correct (INDEXER-H2).
      const transactions = await this.fetchBlockTransactions(blockNumber);

      // Parse all events up-front (no DB writes) so the write phase below is a
      // purely synchronous, all-or-nothing transaction. Parsing must happen
      // outside the transaction because `better-sqlite3` transactions cannot
      // span `await` boundaries.
      const pendingEvents = this.collectBlockEvents(
        transactions,
        blockNumber,
        timestamp
      );

      // Atomically commit the block row, every event, and the cursor advance.
      // If any event insert throws, the whole transaction rolls back: the block
      // row is not persisted and the cursor is not advanced, so the block is
      // re-fetched and retried on the next poll instead of being silently
      // skipped with missing events (INDEXER-C3).
      this.db.transaction(() => {
        this.db.insertBlock(
          blockNumber,
          blockHash,
          parentHash,
          timestamp,
          transactions.length
        );

        for (const pending of pendingEvents) {
          this.storeEvent(
            pending.event,
            blockNumber,
            pending.txHash,
            pending.logIndex,
            timestamp
          );
        }

        this.db.updateLatestBlock(blockNumber, timestamp);
      });

      this.logger.debug(
        {
          blockNumber,
          txCount: transactions.length,
          eventCount: pendingEvents.length,
        },
        'Block processed'
      );
    } catch (error) {
      this.logger.error(
        {
          errorCode: IndexerErrorCode.BLOCK_PROCESSING_FAILED,
          eventId: makeEventId(blockNumber),
          blockNumber,
          err: toErrInfo(error),
        },
        'Error processing block'
      );
      throw error;
    }
  }

  /**
   * Fetch a URL with timeout and exponential backoff retry.
   *
   * Retries on network errors and 5xx responses up to maxRetries times.
   * Uses AbortController to enforce a per-attempt timeout.
   *
   * @param url - The URL to fetch
   * @param maxRetries - Maximum number of attempts (default 3)
   * @param timeoutMs - Per-attempt timeout in milliseconds (default 10000)
   */
  private async fetchWithRetry(
    url: string,
    maxRetries: number = 3,
    timeoutMs: number = 10000
  ): Promise<any> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let resp: Response;
      try {
        resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          { url, attempt, error },
          'Fetch failed, retrying...'
        );
        await this.delay(2 ** attempt * 1000);
        continue;
      }

      if (!resp.ok) {
        const httpError = new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        // Do not retry on client errors (4xx)
        if (resp.status < 500) {
          throw httpError;
        }

        // Retry on 5xx errors with exponential backoff
        if (attempt === maxRetries) {
          throw httpError;
        }

        this.logger.warn(
          { url, attempt, status: resp.status },
          'Fetch failed with 5xx, retrying...'
        );
        await this.delay(2 ** attempt * 1000);
        continue;
      }

      return await resp.json();
    }

    throw lastError;
  }

  /**
   * Delay execution for a given number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch every transaction confirmed by a masterchain block that touches a
   * tracked contract, attributed to that exact block.
   *
   * TON has no monolithic "block N contains these transactions" view: account
   * transactions live in basechain shard blocks that a masterchain block
   * references. The previous implementation ignored the block number and always
   * pulled the last 50 transactions per address, so the same window was
   * re-attributed to every block and anything older was dropped during fast
   * sync (INDEXER-H2). To bound transactions to `blockNumber` we instead:
   *   1. resolve the basechain shard blocks the masterchain seqno confirms
   *      (`/shards`),
   *   2. enumerate every transaction descriptor `(account, lt, hash)` in those
   *      shard blocks via `/getBlockTransactions`, paginating past the
   *      per-request window so no transaction is dropped,
   *   3. keep only descriptors whose account is a tracked contract, and
   *   4. resolve each matching transaction's full body by its `(lt, hash)`
   *      cursor so the event parser has the in/out messages it needs.
   *
   * Because the descriptors come from the block itself, every returned
   * transaction provably belongs to `blockNumber`.
   */
  private async fetchBlockTransactions(blockNumber: number): Promise<any[]> {
    const trackedAddresses = [
      this.config.contracts.paymentHub,
      this.config.contracts.merchantPaymentHub,
      this.config.contracts.transparencyRegistry,
      ...this.config.contracts.nftCollections,
    ].filter((addr) => addr !== '');

    // No tracked contracts → nothing to fetch. Also keeps reorg-only polls
    // (which re-validate stored hashes but index no events) free of I/O.
    if (trackedAddresses.length === 0) {
      return [];
    }

    // Map normalized (raw) address → configured address so block descriptors
    // can be matched regardless of friendly/raw formatting and re-tagged with
    // the exact string `processTransaction` expects.
    const trackedByRaw = new Map<string, string>();
    for (const addr of trackedAddresses) {
      const raw = this.toRawAddress(addr);
      if (raw) trackedByRaw.set(raw, addr);
    }

    const shardBlocks = await this.getBlockShards(blockNumber);

    const allTransactions: any[] = [];
    for (const shard of shardBlocks) {
      const descriptors = await this.fetchBlockTransactionDescriptors(shard);
      for (const descriptor of descriptors) {
        const raw = this.toRawAddress(descriptor.account);
        const configAddress = raw ? trackedByRaw.get(raw) : undefined;
        if (!configAddress) {
          continue; // Not a tracked contract.
        }

        const tx = await this.fetchTransactionByCursor(
          configAddress,
          descriptor.lt,
          descriptor.hash
        );
        if (tx) {
          allTransactions.push({
            ...tx,
            destination: configAddress,
            hash: tx.transaction_id?.hash || descriptor.hash,
          });
        }
      }
    }

    return allTransactions;
  }

  /**
   * Resolve the basechain shard blocks confirmed by a masterchain seqno.
   *
   * Tracked protocol contracts live in the basechain (workchain 0), so we only
   * enumerate the shard blocks the masterchain block references; the
   * masterchain block's own transactions never touch tracked contracts.
   */
  private async getBlockShards(
    blockNumber: number
  ): Promise<Array<{ workchain: number; shard: string; seqno: number }>> {
    const baseUrl = this.config.tonApiEndpoint;
    const apiKeyParam = this.config.tonApiKey
      ? `&api_key=${this.config.tonApiKey}`
      : '';

    const url = `${baseUrl}/shards?seqno=${blockNumber}${apiKeyParam}`;

    try {
      const data = (await this.fetchWithRetry(url)) as {
        ok?: boolean;
        result?: {
          shards?: Array<{ workchain: number; shard: string; seqno: number }>;
        };
      };
      if (data.ok && data.result?.shards) {
        return data.result.shards.map((s) => ({
          workchain: s.workchain,
          shard: s.shard,
          seqno: s.seqno,
        }));
      }
    } catch (error) {
      this.logger.warn(
        {
          errorCode: IndexerErrorCode.TX_FETCH_FAILED,
          eventId: makeEventId(blockNumber),
          blockNumber,
          err: toErrInfo(error),
        },
        'Error fetching shard blocks'
      );
    }
    return [];
  }

  /**
   * Enumerate every transaction descriptor `(account, lt, hash)` in a shard
   * block, following `incomplete`/`after_lt` pagination so transactions beyond
   * the per-request window are not dropped (the INDEXER-H2 fast-sync gap).
   */
  private async fetchBlockTransactionDescriptors(shard: {
    workchain: number;
    shard: string;
    seqno: number;
  }): Promise<Array<{ account: string; lt: string; hash: string }>> {
    const baseUrl = this.config.tonApiEndpoint;
    const apiKeyParam = this.config.tonApiKey
      ? `&api_key=${this.config.tonApiKey}`
      : '';

    const descriptors: Array<{ account: string; lt: string; hash: string }> = [];
    let afterLt: string | undefined;
    let afterHash: string | undefined;

    for (let page = 0; page < MAX_BLOCK_TX_PAGES; page++) {
      let url =
        `${baseUrl}/getBlockTransactions?workchain=${shard.workchain}` +
        `&shard=${encodeURIComponent(shard.shard)}&seqno=${shard.seqno}` +
        `&count=${BLOCK_TX_PAGE_SIZE}${apiKeyParam}`;
      if (afterLt && afterHash) {
        url +=
          `&after_lt=${afterLt}&after_hash=${encodeURIComponent(afterHash)}`;
      }

      let data: {
        ok?: boolean;
        result?: {
          incomplete?: boolean;
          transactions?: Array<{ account: string; lt: string; hash: string }>;
        };
      };
      try {
        data = await this.fetchWithRetry(url);
      } catch (error) {
        this.logger.warn(
          {
            errorCode: IndexerErrorCode.TX_FETCH_FAILED,
            shard: shard.shard,
            seqno: shard.seqno,
            err: toErrInfo(error),
          },
          'Error fetching block transactions'
        );
        break;
      }

      const txs =
        data.ok && data.result?.transactions ? data.result.transactions : [];
      for (const tx of txs) {
        descriptors.push({ account: tx.account, lt: tx.lt, hash: tx.hash });
      }

      // Stop once the API reports the block is fully enumerated (or a page came
      // back empty, which guards against a stuck cursor).
      const incomplete = data.ok ? data.result?.incomplete === true : false;
      if (!incomplete || txs.length === 0) {
        break;
      }

      const last = txs[txs.length - 1];
      afterLt = last.lt;
      afterHash = last.hash;
    }

    return descriptors;
  }

  /**
   * Resolve a single transaction's full body by its `(lt, hash)` cursor.
   *
   * `getBlockTransactions` only returns lightweight descriptors; the event
   * parser needs the full transaction (in/out messages), so each one is
   * resolved with a `getTransactions` lookup anchored at its logical time.
   */
  private async fetchTransactionByCursor(
    address: string,
    lt: string,
    hash: string
  ): Promise<any | null> {
    const baseUrl = this.config.tonApiEndpoint;
    const apiKeyParam = this.config.tonApiKey
      ? `&api_key=${this.config.tonApiKey}`
      : '';

    const url =
      `${baseUrl}/getTransactions?address=${encodeURIComponent(address)}` +
      `&lt=${lt}&hash=${encodeURIComponent(hash)}&limit=1${apiKeyParam}`;

    try {
      const data = (await this.fetchWithRetry(url)) as {
        ok?: boolean;
        result?: any[];
      };
      if (data.ok && data.result && data.result.length > 0) {
        return data.result[0];
      }
    } catch (error) {
      this.logger.warn(
        {
          errorCode: IndexerErrorCode.TX_FETCH_FAILED,
          contractAddress: address,
          err: toErrInfo(error),
        },
        'Error fetching transaction by cursor'
      );
    }
    return null;
  }

  /**
   * Normalize a TON address (friendly or raw) to its canonical raw
   * `workchain:hex` form for equality comparison, or null when unparseable.
   */
  private toRawAddress(addr: string): string | null {
    try {
      return Address.parse(addr).toRawString();
    } catch (_) {
      return null;
    }
  }

  /**
   * Parse every tracked transaction in a block into the events to persist.
   *
   * This is intentionally side-effect free (no DB writes): the caller commits
   * the returned events inside a single transaction so the block is indexed
   * atomically. Parsing is synchronous, which lets the write phase run as a
   * `better-sqlite3` transaction (those cannot span `await`).
   */
  private collectBlockEvents(
    transactions: any[],
    blockNumber: number,
    timestamp: number
  ): Array<{ event: IndexedEvent; txHash: string; logIndex: number }> {
    // Canonicalise the tracked contract set once so the per-transaction
    // relevance check is a robust, format-agnostic comparison (INDEXER-H4).
    const relevantContracts = new Set(
      [
        this.config.contracts.paymentHub,
        this.config.contracts.merchantPaymentHub,
        this.config.contracts.transparencyRegistry,
        ...this.config.contracts.nftCollections,
      ]
        .filter((addr) => addr !== '')
        .map(normalizeAddress)
    );

    const pending: Array<{
      event: IndexedEvent;
      txHash: string;
      logIndex: number;
    }> = [];

    for (const transaction of transactions) {
      // Route on the real on-chain account (in_msg.destination), which equals
      // the source of every outbound message the transaction emits. Skipping
      // transactions whose actual account is not tracked makes routing a
      // genuine verification rather than the previous circular self-check.
      const txDestination = this.getTransactionDestination(transaction);
      if (!relevantContracts.has(normalizeAddress(txDestination))) {
        continue; // Not relevant
      }

      const txHash = this.getTransactionHash(transaction);
      // Attribute events to the canonical block being processed and stamp them
      // with the single reconciled block timestamp — the same values the write
      // phase persists — so there is one authoritative source, not two.
      const events = this.parser.parseTransaction(
        transaction,
        txDestination,
        blockNumber,
        timestamp
      );

      for (let i = 0; i < events.length; i++) {
        pending.push({ event: events[i], txHash, logIndex: i });
      }
    }

    return pending;
  }

  /**
   * Store a single parsed event in the database.
   *
   * Errors are NOT swallowed: a failed insert must propagate so the enclosing
   * block transaction (see `processBlock`) rolls back and the block is retried
   * rather than recorded with missing events (INDEXER-C3). The error is logged
   * with context before being re-thrown.
   */
  private storeEvent(
    event: IndexedEvent,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): void {
    try {
      switch (event.eventType) {
        case 'InternalTransfer':
          this.db.insertInternalTransfer({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            fromNft: event.fromNft,
            toNft: event.toNft,
            amountTbc: event.amountTbc.toString(),
            payloadHash: event.payloadHash,
          });
          break;

        case 'AccountStateChanged':
          this.db.insertAccountStateChange({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            nftAddress: event.nftAddress,
            oldState: event.oldState,
            newState: event.newState,
          });
          break;

        case 'MerchantPayment':
          this.db.insertMerchantPayment({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            payerNft: event.payerNft,
            merchantNft: event.merchantNft,
            amountTbc: event.amountTbc.toString(),
            payloadHash: event.payloadHash,
          });
          break;

        case 'NFTOwnershipChange':
          this.db.insertNFTOwnershipChange({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            nftAddress: event.nftAddress,
            collectionAddress: event.collectionAddress,
            oldOwner: event.oldOwner,
            newOwner: event.newOwner,
          });
          break;

        case 'TransparencyProtocolMetrics':
          this.db.insertTransparencyProtocolMetrics({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            activeAccounts: event.activeAccounts,
            tbcVolumeTransferred: event.tbcVolumeTransferred.toString(),
            transferCount: event.transferCount,
          });
          break;

        case 'TransparencyLockActivity':
          this.db.insertTransparencyLockActivity({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            locksSet: event.locksSet,
            locksCleared: event.locksCleared,
            locksActive: event.locksActive,
            appealsFiled: event.appealsFiled,
            appealsOverturned: event.appealsOverturned,
            appealsUpheld: event.appealsUpheld,
          });
          break;

        case 'TransparencyParameterChange':
          this.db.insertTransparencyParameterChange({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            parameterId: event.parameterId,
            oldValueHash: event.oldValueHash,
            newValueHash: event.newValueHash,
            effectiveBlock: event.effectiveBlock,
            governanceProposalId: event.governanceProposalId,
          });
          break;
      }
    } catch (error) {
      this.logger.error(
        {
          errorCode: IndexerErrorCode.EVENT_STORE_FAILED,
          eventId: makeEventId(blockNumber, txHash, logIndex),
          eventType: event.eventType,
          err: toErrInfo(error),
        },
        'Error storing event'
      );
      // Re-throw so the enclosing block transaction rolls back. Swallowing here
      // would let the cursor advance past a block with missing events.
      throw error;
    }
  }

  /**
   * Get latest block from chain
   *
   * Returns masterchain info with the latest seqno. Uses TonClient
   * which wraps the /getMasterchainInfo endpoint. The tip is read from
   * either `latestSeqno` (TonClient shape) or `last.seqno` (raw HTTP shape)
   * so a client/version swap cannot silently produce `undefined` (INDEXER-H3).
   *
   * A non-finite seqno is rejected with a clear error and returns `null`,
   * which makes `syncBlocks` skip the poll rather than computing `NaN` bounds
   * that would silently stall the loop.
   */
  private async getLatestBlock(): Promise<{ seqno: number } | null> {
    try {
      const info = await this.client.getMasterchainInfo();
      const seqno = extractLatestSeqno(info);
      if (!Number.isFinite(seqno)) {
        this.logger.error(
          {
            errorCode: IndexerErrorCode.LATEST_BLOCK_UNAVAILABLE,
            info,
          },
          'getMasterchainInfo returned a non-finite seqno'
        );
        return null;
      }
      return { seqno };
    } catch (error) {
      this.logger.error(
        {
          errorCode: IndexerErrorCode.LATEST_BLOCK_UNAVAILABLE,
          err: toErrInfo(error),
        },
        'Error fetching latest block'
      );
      return null;
    }
  }

  /**
   * Get block by seqno using TON HTTP API
   *
   * TON's masterchain blocks are identified by seqno. We fetch block
   * header data via the HTTP API v2 /lookupBlock + /getBlockHeader endpoints.
   * If the TON API key is configured, it is sent as a query parameter.
   */
  private async getBlockByNumber(blockNumber: number): Promise<any> {
    try {
      const baseUrl = this.config.tonApiEndpoint;
      const apiKeyParam = this.config.tonApiKey
        ? `&api_key=${this.config.tonApiKey}`
        : '';

      // Step 1: Lookup block ID by masterchain seqno
      // workchain -1 = masterchain, shard = -9223372036854775808 (full shard)
      const lookupUrl =
        `${baseUrl}/lookupBlock?workchain=-1&shard=-9223372036854775808&seqno=${blockNumber}${apiKeyParam}`;

      const lookupResp = await fetch(lookupUrl);
      if (!lookupResp.ok) {
        this.logger.warn(
          { blockNumber, status: lookupResp.status },
          'Block lookup failed'
        );
        return null;
      }

      const lookupData = (await lookupResp.json()) as { ok?: boolean; result?: any };
      if (!lookupData.ok || !lookupData.result) {
        return null;
      }

      const blockId = lookupData.result;

      // Step 2: Get block header for hash and timestamp
      const headerUrl =
        `${baseUrl}/getBlockHeader?workchain=${blockId.workchain}&shard=${blockId.shard}&seqno=${blockId.seqno}${apiKeyParam}`;

      const headerResp = await fetch(headerUrl);
      if (!headerResp.ok) {
        return null;
      }

      const headerData = (await headerResp.json()) as { ok?: boolean; result?: any };
      if (!headerData.ok || !headerData.result) {
        return null;
      }

      const header = headerData.result;

      return {
        seqno: blockNumber,
        id: {
          root_hash: header.id?.root_hash || blockId.root_hash || '',
          prev_root_hash: header.prev_blocks?.[0]?.root_hash || '',
        },
        now: header.gen_utime || 0,
        transactions: [], // Transactions are fetched per-account, not per-block
      };
    } catch (error) {
      this.logger.error(
        {
          errorCode: IndexerErrorCode.BLOCK_FETCH_FAILED,
          eventId: makeEventId(blockNumber),
          blockNumber,
          err: toErrInfo(error),
        },
        'Error fetching block'
      );
      return null;
    }
  }

  // Helper methods to extract block data
  // These depend on actual TON block structure

  private getBlockHash(block: any): string {
    return block.id?.root_hash || '';
  }

  private getParentHash(block: any): string {
    return block.id?.prev_root_hash || '';
  }

  private getBlockTimestamp(block: any): number {
    return block.now || 0;
  }

  private getTransactionHash(transaction: any): string {
    return transaction.hash || '';
  }

  /**
   * The account a transaction belongs to is the destination of its inbound
   * message (`in_msg.destination`). In TON a transaction executes on exactly
   * one account, and every outbound message it produces carries that same
   * account as its `source`, so this value is the genuine on-chain routing key
   * (INDEXER-H4). Previously this read a `destination` field the fetch layer
   * synthesized to the queried contract, making the downstream relevance check
   * tautological.
   */
  private getTransactionDestination(transaction: any): string {
    return transaction.in_msg?.destination || '';
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    latestBlockIndexed: number;
    isRunning: boolean;
  } {
    return {
      latestBlockIndexed: this.db.getLatestBlockIndexed(),
      isRunning: this.isRunning,
    };
  }
}
