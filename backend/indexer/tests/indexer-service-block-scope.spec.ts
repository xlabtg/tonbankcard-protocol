// Regression tests for INDEXER-H2: fetchContractTransactions ignored the block
// number and always returned the last 50 transactions per address, so events
// were mis-attributed to whatever block the loop was on, the same window was
// re-attributed to every block, and transactions beyond the 50-item window were
// dropped during fast sync.
//
// The fix scopes transactions to the block that confirmed them
// (`/shards` -> `/getBlockTransactions` -> `/getTransactions`) and paginates
// past the per-request window. These tests drive a multi-block range where one
// block carries far more than 50 transactions across several pages and assert
// that every event lands in its actual block and none are dropped.

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { beginCell, Address } from '@ton/core';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerDatabase } from '../src/db/database';
import { IndexerConfig } from '../src/types/config';
import { OP_CODES } from '../src/parsers/event-parser';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Two valid, distinct testnet addresses used as the tracked contract and the
// counterparty inside the emitted InternalTransferEvent.
const PAY = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
// Distinct counterparty, built from a raw hash so the checksum is always valid.
const OTHER = new Address(0, Buffer.alloc(32, 0x11)).toString();

// Raw form of the tracked address, as `/getBlockTransactions` returns accounts.
const PAY_RAW = Address.parse(PAY).toRawString();

const SHARD = '-9223372036854775808'; // full basechain shard id (workchain 0)
const PAGE = 25; // descriptors returned per mocked getBlockTransactions page

function makeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'https://toncenter.example.com/api/v2',
    tonApiKey: '',
    contracts: {
      paymentHub: PAY,
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

/** Build an InternalTransferEvent transaction (TON HTTP API v2 shape). */
function makeTransferTx(
  lt: string,
  hash: string,
  utime: number,
  payloadHash: bigint
): any {
  const body = beginCell()
    .storeUint(OP_CODES.INTERNAL_TRANSFER_EVENT, 32)
    .storeAddress(Address.parse(PAY))
    .storeAddress(Address.parse(OTHER))
    .storeCoins(1000n)
    .storeUint(payloadHash, 256)
    .storeUint(0, 32) // event timestamp (ignored; tx/block time is used)
    .endCell()
    .toBoc()
    .toString('base64');

  return {
    transaction_id: { lt, hash },
    utime,
    // Inbound message that triggered the transaction. A real toncenter
    // transaction always carries one, and its destination is the executing
    // account — routing keys off this genuine on-chain value (INDEXER-H4),
    // not a field synthesized by the fetch layer.
    in_msg: { source: OTHER, destination: PAY, msg_data: { body: '' } },
    // External-out message carrying the emit() event.
    out_msgs: [{ source: PAY, destination: '', msg_data: { body } }],
  };
}

/**
 * Per-block transaction descriptors plus a lt -> full-transaction lookup,
 * mirroring how `/getBlockTransactions` and `/getTransactions` relate on chain.
 */
function buildChain(perBlockCounts: Record<number, number>) {
  const descriptorsByBlock = new Map<
    number,
    Array<{ account: string; lt: string; hash: string }>
  >();
  const txByLt = new Map<string, any>();

  for (const [blockStr, count] of Object.entries(perBlockCounts)) {
    const blockNumber = Number(blockStr);
    const descriptors: Array<{ account: string; lt: string; hash: string }> = [];
    for (let i = 0; i < count; i++) {
      const lt = `${blockNumber}${String(i).padStart(6, '0')}`;
      const hash = `hash-${blockNumber}-${i}`;
      descriptors.push({ account: PAY_RAW, lt, hash });
      txByLt.set(
        lt,
        makeTransferTx(
          lt,
          hash,
          blockNumber * 1000,
          BigInt(blockNumber * 1_000_000 + i + 1)
        )
      );
    }
    descriptorsByBlock.set(blockNumber, descriptors);
  }

  return { descriptorsByBlock, txByLt };
}

/**
 * Route a TON HTTP API v2 URL to a canned response, paginating
 * getBlockTransactions in pages of PAGE so the production code must follow the
 * `incomplete`/`after_lt` cursor to retrieve every transaction.
 */
function makeRouter(chain: ReturnType<typeof buildChain>) {
  return async (url: string): Promise<any> => {
    const query = new URLSearchParams(url.split('?')[1] ?? '');

    if (url.includes('/shards')) {
      const seqno = Number(query.get('seqno'));
      return {
        ok: true,
        result: { shards: [{ workchain: 0, shard: SHARD, seqno }] },
      };
    }

    if (url.includes('/getBlockTransactions')) {
      const seqno = Number(query.get('seqno'));
      const all = chain.descriptorsByBlock.get(seqno) ?? [];
      const afterLt = query.get('after_lt');
      let start = 0;
      if (afterLt) {
        const idx = all.findIndex((d) => d.lt === afterLt);
        start = idx >= 0 ? idx + 1 : all.length;
      }
      const slice = all.slice(start, start + PAGE);
      const incomplete = start + PAGE < all.length;
      return { ok: true, result: { incomplete, transactions: slice } };
    }

    if (url.includes('/getTransactions')) {
      const lt = query.get('lt') ?? '';
      const tx = chain.txByLt.get(lt);
      return { ok: true, result: tx ? [tx] : [] };
    }

    throw new Error(`Unexpected URL in test router: ${url}`);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexerService block-scoped transaction fetch (INDEXER-H2)', () => {
  let db: IndexerDatabase;
  const testDbPath = path.join(__dirname, 'test-block-scope-indexer.db');

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

  it('attributes every event to its real block and drops none across a >50-tx range', async () => {
    // Block 1 carries 130 txs (>50, multiple pages), block 2 is empty, block 3
    // carries 70 txs.
    const perBlock = { 1: 130, 2: 0, 3: 70 };
    const chain = buildChain(perBlock);

    const service = new IndexerService(makeConfig(), db, silentLogger) as any;

    // getBlockByNumber only supplies header data for reorg/insert bookkeeping.
    jest
      .spyOn(service, 'getBlockByNumber')
      .mockImplementation((...args: unknown[]) => {
        const n = args[0] as number;
        return Promise.resolve({
          seqno: n,
          id: { root_hash: `h${n}`, prev_root_hash: `h${n - 1}` },
          now: n * 1000,
          transactions: [],
        }) as never;
      });

    // All chain I/O flows through fetchWithRetry; route it to the fixture.
    jest
      .spyOn(service, 'fetchWithRetry')
      .mockImplementation((...args: unknown[]) =>
        makeRouter(chain)(args[0] as string) as never
      );

    for (const blockNumber of [1, 2, 3]) {
      await service.processBlock(blockNumber);
    }

    // Every transaction produced exactly one InternalTransfer event.
    const rows = (db as any).db
      .prepare(
        'SELECT block_number, COUNT(*) AS cnt FROM internal_transfers GROUP BY block_number ORDER BY block_number'
      )
      .all() as Array<{ block_number: number; cnt: number }>;

    const countByBlock = new Map(rows.map((r) => [r.block_number, r.cnt]));

    // Each event lands in its actual block — no mis-attribution, no spill-over.
    expect(countByBlock.get(1)).toBe(130);
    expect(countByBlock.get(2)).toBeUndefined(); // empty block, no events
    expect(countByBlock.get(3)).toBe(70);

    // No events attributed to any block outside the indexed range.
    for (const r of rows) {
      expect([1, 3]).toContain(r.block_number);
    }

    // None dropped: total equals the sum of on-chain transactions.
    const total = (db as any).db
      .prepare('SELECT COUNT(*) AS cnt FROM internal_transfers')
      .get() as { cnt: number };
    expect(total.cnt).toBe(200);

    // transaction_count reflects the real per-block transaction count.
    expect(db.getBlock(1)?.transaction_count).toBe(130);
    expect(db.getBlock(2)?.transaction_count).toBe(0);
    expect(db.getBlock(3)?.transaction_count).toBe(70);
  });

  it('does not re-attribute the same transactions to consecutive blocks', async () => {
    // Distinct, non-overlapping transactions per block. The old code returned
    // the same fixed window for every block; the fix must keep them separate.
    const perBlock = { 10: 3, 11: 4 };
    const chain = buildChain(perBlock);

    const service = new IndexerService(makeConfig(), db, silentLogger) as any;

    jest
      .spyOn(service, 'getBlockByNumber')
      .mockImplementation((...args: unknown[]) => {
        const n = args[0] as number;
        return Promise.resolve({
          seqno: n,
          id: { root_hash: `h${n}`, prev_root_hash: `h${n - 1}` },
          now: n * 1000,
          transactions: [],
        }) as never;
      });

    jest
      .spyOn(service, 'fetchWithRetry')
      .mockImplementation((...args: unknown[]) =>
        makeRouter(chain)(args[0] as string) as never
      );

    await service.processBlock(10);
    await service.processBlock(11);

    const hashesByBlock = (db as any).db
      .prepare(
        'SELECT block_number, transaction_hash FROM internal_transfers ORDER BY block_number'
      )
      .all() as Array<{ block_number: number; transaction_hash: string }>;

    const block10 = hashesByBlock.filter((r) => r.block_number === 10);
    const block11 = hashesByBlock.filter((r) => r.block_number === 11);

    expect(block10).toHaveLength(3);
    expect(block11).toHaveLength(4);

    // No transaction hash appears under more than one block.
    const set10 = new Set(block10.map((r) => r.transaction_hash));
    for (const r of block11) {
      expect(set10.has(r.transaction_hash)).toBe(false);
    }
  });
});
