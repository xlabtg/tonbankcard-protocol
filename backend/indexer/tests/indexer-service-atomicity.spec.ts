// Regression tests for INDEXER-C3: processBlock must be atomic.
//
// A block's row, its events, and the cursor advance must all commit inside a
// single SQLite transaction. If any event insert fails mid-block, the whole
// block must roll back (no partial block row, no cursor advance) so the block
// is re-fetched and retried instead of being silently skipped with missing
// events.

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerDatabase } from '../src/db/database';
import { IndexerConfig } from '../src/types/config';
import { IndexedEvent, AccountState } from '../src/types/events';

const PAYMENT_HUB = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
const BLOCK_NUMBER = 42;
const TIMESTAMP = 1_700_000_000;

function makeConfig(): IndexerConfig {
  return {
    tonApiEndpoint: 'https://toncenter.example.com/api/v2',
    tonApiKey: '',
    contracts: {
      paymentHub: PAYMENT_HUB,
      merchantPaymentHub: '',
      transparencyRegistry: '',
      nftCollections: [],
    },
    indexer: {
      pollIntervalMs: 5000,
      startBlock: 1,
      batchSize: 10,
      confirmationBlocks: 3,
    },
    database: {
      path: ':memory:',
    },
    server: {
      port: 3000,
      host: 'localhost',
    },
  } as unknown as IndexerConfig;
}

const silentLogger = pino({ level: 'silent' });

// A transfer event that inserts cleanly.
const goodTransfer: IndexedEvent = {
  eventType: 'InternalTransfer',
  blockNumber: BLOCK_NUMBER,
  transactionHash: 'tx-hash',
  timestamp: TIMESTAMP,
  logIndex: 0,
  fromNft: 'EQfrom',
  toNft: 'EQto',
  amountTbc: 1000n,
  payloadHash: 'payload-hash',
};

// A state-change event we will force to fail at insert time.
const failingStateChange: IndexedEvent = {
  eventType: 'AccountStateChanged',
  blockNumber: BLOCK_NUMBER,
  transactionHash: 'tx-hash',
  timestamp: TIMESTAMP,
  logIndex: 1,
  nftAddress: 'EQnft',
  oldState: AccountState.ACTIVE,
  newState: AccountState.FROZEN,
};

/**
 * Wire a service whose only blockchain interaction is stubbed: a real
 * in-memory database, a fixed block header, and a parser that yields the
 * provided events for the single tracked transaction in the block.
 */
function makeService(db: IndexerDatabase, events: IndexedEvent[]) {
  const service = new IndexerService(makeConfig(), db, silentLogger) as any;

  service.getBlockByNumber = async () => ({
    seqno: BLOCK_NUMBER,
    id: { root_hash: 'block-hash', prev_root_hash: 'parent-hash' },
    now: TIMESTAMP,
    transactions: [],
  });

  // INDEXER-H2 renamed the (now block-scoped) fetch to fetchBlockTransactions.
  // Routing keys off the real on-chain account (in_msg.destination), not a
  // synthesized field (INDEXER-H4), so the stubbed transaction mirrors the real
  // toncenter shape. These atomicity tests only need a single tracked
  // transaction injected.
  service.fetchBlockTransactions = async () => [
    { in_msg: { destination: PAYMENT_HUB }, hash: 'tx-hash' },
  ];

  service.parser.parseTransaction = () => events;

  return service;
}

describe('IndexerService.processBlock atomicity (INDEXER-C3)', () => {
  let db: IndexerDatabase;

  beforeEach(() => {
    db = new IndexerDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('commits block, events, and cursor together on success', async () => {
    const service = makeService(db, [goodTransfer]);

    await service.processBlock(BLOCK_NUMBER);

    expect(db.getBlock(BLOCK_NUMBER)).not.toBeNull();
    expect(db.getLatestBlockIndexed()).toBe(BLOCK_NUMBER);
    expect(db.getEventCount()).toBe(1);
  });

  it('rolls back the entire block when an event insert fails mid-block', async () => {
    const service = makeService(db, [goodTransfer, failingStateChange]);

    // Force the second event's insert to fail after the first has been written
    // inside the transaction.
    const boom = new Error('simulated event insert failure');
    jest
      .spyOn(db, 'insertAccountStateChange')
      .mockImplementation(() => {
        throw boom;
      });

    await expect(service.processBlock(BLOCK_NUMBER)).rejects.toThrow(boom);

    // Block row must NOT be persisted.
    expect(db.getBlock(BLOCK_NUMBER)).toBeNull();
    // Cursor must NOT advance past the un-indexed block.
    expect(db.getLatestBlockIndexed()).toBe(0);
    // The first (successful) event must be rolled back too — no partial block.
    expect(db.getEventCount()).toBe(0);
  });

  it('re-indexes the block successfully on retry after a transient failure', async () => {
    // First attempt fails on the state-change insert.
    const spy = jest
      .spyOn(db, 'insertAccountStateChange')
      .mockImplementationOnce(() => {
        throw new Error('transient failure');
      });

    const failing = makeService(db, [goodTransfer, failingStateChange]);
    await expect(failing.processBlock(BLOCK_NUMBER)).rejects.toThrow(
      'transient failure'
    );

    expect(db.getBlock(BLOCK_NUMBER)).toBeNull();
    expect(db.getLatestBlockIndexed()).toBe(0);

    // Retry: the spy now falls through to the real implementation.
    spy.mockRestore();
    const retry = makeService(db, [goodTransfer, failingStateChange]);
    await retry.processBlock(BLOCK_NUMBER);

    expect(db.getBlock(BLOCK_NUMBER)).not.toBeNull();
    expect(db.getLatestBlockIndexed()).toBe(BLOCK_NUMBER);
    expect(db.getEventCount()).toBe(2);
  });
});
