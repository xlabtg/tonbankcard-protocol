// Regression tests for INDEXER-C2: reorg detection within the already-indexed
// range. The forward sync loop only inspects blocks it is about to index for
// the first time, so a reorg that rewrites a block already stored must be
// caught by re-validating the trailing window of stored hashes on each poll.

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerDatabase } from '../src/db/database';
import { IndexerConfig } from '../src/types/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'https://toncenter.example.com/api/v2',
    tonApiKey: '',
    contracts: {
      // All empty so fetchContractTransactions performs no network I/O.
      paymentHub: '',
      merchantPaymentHub: '',
      nftCollections: [],
      transparencyRegistry: '',
    },
    database: { path: ':memory:' },
    indexer: {
      startBlock: 1,
      pollIntervalMs: 5000,
      batchSize: 10,
      confirmationBlocks: 3,
    },
    api: {
      port: 3000,
      host: 'localhost',
      trustProxy: false,
      trustedProxyCount: 0,
      rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    logging: { level: 'silent', pretty: false },
  } as unknown as IndexerConfig;
}

const silentLogger = pino({ level: 'silent' });

/** Shape a chain-block response the way the real getBlockByNumber returns it. */
function chainBlock(seqno: number, rootHash: string, prevHash: string) {
  return {
    seqno,
    id: { root_hash: rootHash, prev_root_hash: prevHash },
    now: seqno * 1000,
    transactions: [],
  };
}

describe('IndexerService reorg detection within indexed range (INDEXER-C2)', () => {
  let db: IndexerDatabase;
  const testDbPath = path.join(__dirname, 'test-reorg-indexer.db');

  const cleanup = () => {
    for (const suffix of ['', '-wal', '-shm']) {
      const p = testDbPath + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  };

  beforeEach(() => {
    cleanup();
    db = new IndexerDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    cleanup();
    jest.restoreAllMocks();
  });

  it('detects a reorg that rewrites an already-indexed block and rolls back', async () => {
    // Index blocks 1..5 with stable hashes; cursor at 5.
    const storedHashes: Record<number, string> = {
      1: 'h1',
      2: 'h2',
      3: 'h3',
      4: 'h4a', // <- this block will be rewritten on-chain
      5: 'h5a',
    };
    for (let n = 1; n <= 5; n++) {
      db.insertBlock(n, storedHashes[n], storedHashes[n - 1] ?? '', n * 1000, 0);
      db.updateLatestBlock(n, n * 1000);
    }
    expect(db.getLatestBlockIndexed()).toBe(5);

    // Canonical chain after the reorg: blocks 4 and 5 have new hashes.
    const chainHashes: Record<number, string> = {
      1: 'h1',
      2: 'h2',
      3: 'h3',
      4: 'h4b', // diverges from stored 'h4a'
      5: 'h5b',
    };

    const service = new IndexerService(makeConfig(), db, silentLogger) as any;

    // Chain tip high enough that endBlock (tip - confirmationBlocks) >= 5, so
    // the forward sync re-indexes the canonical replacements in the same poll.
    jest
      .spyOn(service, 'getLatestBlock')
      .mockResolvedValue({ seqno: 8 } as never);

    jest
      .spyOn(service, 'getBlockByNumber')
      .mockImplementation((...args: unknown[]) => {
        const n = args[0] as number;
        return Promise.resolve(
          chainBlock(n, chainHashes[n] ?? `h${n}`, chainHashes[n - 1] ?? '')
        ) as never;
      });

    const handleReorgSpy = jest.spyOn(db, 'handleReorg');

    await service.syncBlocks();

    // Rollback was triggered from the first divergent height (block 4).
    expect(handleReorgSpy).toHaveBeenCalledWith(4);

    // After rollback + resync the stored hashes mirror the canonical chain.
    expect(db.getBlock(4)?.block_hash).toBe('h4b');
    expect(db.getBlock(5)?.block_hash).toBe('h5b');
    // Untouched blocks below the divergence point are preserved.
    expect(db.getBlock(3)?.block_hash).toBe('h3');
    expect(db.getLatestBlockIndexed()).toBe(5);
  });

  it('does not trigger a reorg when stored hashes still match the chain', async () => {
    for (let n = 1; n <= 5; n++) {
      db.insertBlock(n, `h${n}`, n > 1 ? `h${n - 1}` : '', n * 1000, 0);
      db.updateLatestBlock(n, n * 1000);
    }

    const service = new IndexerService(makeConfig(), db, silentLogger) as any;

    // No new confirmed blocks to advance into (tip - confirmationBlocks < 6).
    jest
      .spyOn(service, 'getLatestBlock')
      .mockResolvedValue({ seqno: 7 } as never);

    jest
      .spyOn(service, 'getBlockByNumber')
      .mockImplementation((...args: unknown[]) => {
        const n = args[0] as number;
        return Promise.resolve(
          chainBlock(n, `h${n}`, n > 1 ? `h${n - 1}` : '')
        ) as never;
      });

    const handleReorgSpy = jest.spyOn(db, 'handleReorg');

    await service.syncBlocks();

    expect(handleReorgSpy).not.toHaveBeenCalled();
    expect(db.getLatestBlockIndexed()).toBe(5);
  });
});
