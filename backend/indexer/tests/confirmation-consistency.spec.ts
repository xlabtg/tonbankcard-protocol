// Regression tests for INDEXER-H1: a single canonical confirmation-depth
// definition shared by the indexer and the API.
//
// Previously `markBlocksConfirmed` subtracted the confirmation depth a second
// time (`endBlock - confirmationBlocks`), so a band of width
// `confirmationBlocks` of genuinely confirmed blocks was perpetually flagged
// unconfirmed, and the API derived confirmations a third way
// (`latestBlockIndexed - block_number`). These tests assert that a block at
// depth `>= confirmationBlocks` is reported confirmed by BOTH the indexer's
// `blocks.confirmed` flag and the API, with no off-by-`confirmationBlocks` gap.

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerDatabase } from '../src/db/database';
import { IndexerConfig } from '../src/types/config';
import { createRouter } from '../src/api/routes';
import {
  confirmationDepth,
  isBlockConfirmed,
} from '../src/services/confirmations';

const CONFIRMATION_BLOCKS = 3;
const CHAIN_HEAD = 10; // masterchain tip seqno during the test sync

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
      confirmationBlocks: CONFIRMATION_BLOCKS,
    },
    api: {
      port: 3000,
      host: 'localhost',
      trustProxy: false,
      rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    logging: { level: 'silent', pretty: false },
  } as unknown as IndexerConfig;
}

const silentLogger = pino({ level: 'silent' });

function chainBlock(seqno: number, rootHash: string, prevHash: string) {
  return {
    seqno,
    id: { root_hash: rootHash, prev_root_hash: prevHash },
    now: seqno * 1000,
    transactions: [],
  };
}

function startServer(app: express.Application): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function getJson(server: http.Server, urlPath: string): Promise<any> {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return new Promise((resolve, reject) => {
    http
      .get(
        { host: '127.0.0.1', port, path: urlPath },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on('error', reject);
  });
}

describe('confirmation depth helper (INDEXER-H1)', () => {
  it('counts confirmations as chainHead - blockNumber, clamped at 0', () => {
    expect(confirmationDepth(10, 7)).toBe(3);
    expect(confirmationDepth(10, 10)).toBe(0);
    expect(confirmationDepth(10, 12)).toBe(0); // never negative
  });

  it('treats a block at depth exactly confirmationBlocks as confirmed', () => {
    expect(isBlockConfirmed(10, 7, 3)).toBe(true); // depth 3 >= 3
    expect(isBlockConfirmed(10, 8, 3)).toBe(false); // depth 2 < 3
  });
});

describe('IndexerService + API agree on confirmation depth (INDEXER-H1)', () => {
  let db: IndexerDatabase;
  let server: http.Server | undefined;
  const testDbPath = path.join(__dirname, 'test-confirm-indexer.db');

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

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    db.close();
    cleanup();
    jest.restoreAllMocks();
  });

  it('marks the full confirmed band and reports it confirmed via the API', async () => {
    const service = new IndexerService(makeConfig(), db, silentLogger) as any;

    jest
      .spyOn(service, 'getLatestBlock')
      .mockResolvedValue({ seqno: CHAIN_HEAD } as never);
    jest
      .spyOn(service, 'getBlockByNumber')
      .mockImplementation((...args: unknown[]) => {
        const n = args[0] as number;
        return Promise.resolve(chainBlock(n, `h${n}`, `h${n - 1}`)) as never;
      });

    await service.syncBlocks();

    // endBlock = CHAIN_HEAD - confirmationBlocks = 7. Blocks 1..7 are indexed.
    const endBlock = CHAIN_HEAD - CONFIRMATION_BLOCKS;
    expect(db.getLatestBlockIndexed()).toBe(endBlock);
    // The chain head is persisted so the API can derive the same depth.
    expect(db.getLatestChainSeqno()).toBe(CHAIN_HEAD);

    // Block 7 sits at depth exactly confirmationBlocks (10 - 7 = 3). The old
    // double-subtract cutoff (endBlock - confirmationBlocks = 4) would have
    // left blocks 5, 6 and 7 flagged unconfirmed. They must now be confirmed.
    for (let b = 1; b <= endBlock; b++) {
      expect(db.getBlock(b)?.confirmed).toBe(true);
    }

    // A merchant payment sitting in the confirmed band (block 7, depth 3).
    db.insertMerchantPayment({
      blockNumber: endBlock,
      transactionHash: 'tx-confirmed',
      logIndex: 0,
      timestamp: endBlock * 1000,
      payerNft: 'payer',
      merchantNft: 'merchant',
      amountTbc: '100',
      payloadHash: 'inv-confirmed',
    });

    // A pending payment just below the threshold (block 9, depth 1 < 3).
    db.insertBlock(9, 'h9', 'h8', 9000, 0);
    db.insertMerchantPayment({
      blockNumber: 9,
      transactionHash: 'tx-pending',
      logIndex: 0,
      timestamp: 9000,
      payerNft: 'payer',
      merchantNft: 'merchant',
      amountTbc: '100',
      payloadHash: 'inv-pending',
    });

    const app = express();
    app.use('/', createRouter(db, service, makeConfig(), silentLogger));
    server = await startServer(app);

    const confirmed = await getJson(server, '/payments/inv-confirmed');
    expect(confirmed.status).toBe('confirmed');
    // Confirmations are counted from the chain head, not the indexed cursor:
    // 10 - 7 = 3, matching the indexer's confirmed flag. The old API formula
    // (latestBlockIndexed - block = 7 - 7 = 0) wrongly reported it pending.
    expect(confirmed.confirmationBlocks).toBe(CONFIRMATION_BLOCKS);
    expect(confirmed.confirmedAt).not.toBeNull();

    const pending = await getJson(server, '/payments/inv-pending');
    expect(pending.status).toBe('pending');
    expect(pending.confirmationBlocks).toBe(CHAIN_HEAD - 9); // depth 1
    expect(pending.confirmedAt).toBeNull();
  });
});
