// Regression tests for /api/v1/accounts/:nft_id/history pagination bounds.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import pino from 'pino';

import { requestIdMiddleware } from '../src/api/requestId';
import { createRouter } from '../src/api/routes';
import { IndexerDatabase } from '../src/db/database';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerConfig } from '../src/types/config';

const TEST_DB = path.join(__dirname, 'test-account-history.db');
const NULL_LOGGER = pino({ level: 'silent' });
const NFT_ADDRESS = 'EQA-history';

interface AccountHistoryTestBody {
  events?: unknown[];
  totalCount?: number;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
}

function cleanupDb(): void {
  for (const ext of ['', '-wal', '-shm']) {
    const p = TEST_DB + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function fakeIndexer(): IndexerService {
  return {
    getSyncStatus: () => ({
      latestBlockIndexed: 0,
      isRunning: true
    })
  } as IndexerService;
}

function fakeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'http://localhost',
    contracts: {
      paymentHub: '',
      merchantPaymentHub: '',
      nftCollections: [],
      transparencyRegistry: ''
    },
    database: { path: TEST_DB },
    indexer: {
      startBlock: 0,
      pollIntervalMs: 1000,
      batchSize: 10,
      confirmationBlocks: 1
    },
    api: {
      port: 0,
      host: '127.0.0.1',
      trustProxy: false,
      rateLimit: { windowMs: 60000, maxRequests: 100 }
    },
    logging: { level: 'fatal', pretty: false }
  };
}

function buildApp(db: IndexerDatabase): express.Application {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use('/api/v1', createRouter(db, fakeIndexer(), fakeConfig(), NULL_LOGGER));
  return app;
}

function request(
  server: http.Server,
  route: string
): Promise<{
  status: number;
  body: AccountHistoryTestBody | null;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    http
      .get({ hostname: '127.0.0.1', port: addr.port, path: route, method: 'GET' }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            body: data ? (JSON.parse(data) as AccountHistoryTestBody) : null
          });
        });
      })
      .on('error', reject);
  });
}

function seedAccountHistory(db: IndexerDatabase, count: number): void {
  for (let i = 1; i <= count; i++) {
    db.insertBlock(i, `hash${i}`, `hash${i - 1}`, i * 1000, 1);
    db.insertInternalTransfer({
      blockNumber: i,
      transactionHash: `tx_history_${i}`,
      logIndex: 0,
      timestamp: i * 1000,
      fromNft: NFT_ADDRESS,
      toNft: 'EQB-history',
      amountTbc: '100',
      payloadHash: `0xhistory${i}`
    });
  }
}

function seedSameTimestampAccountHistory(db: IndexerDatabase, count: number): void {
  for (let i = 1; i <= count; i++) {
    db.insertBlock(i, `hash_same_${i}`, `hash_same_${i - 1}`, 1000, 1);
    db.insertInternalTransfer({
      blockNumber: i,
      transactionHash: `tx_route_same_${i}`,
      logIndex: 0,
      timestamp: 1000,
      fromNft: NFT_ADDRESS,
      toNft: 'EQB-history',
      amountTbc: '100',
      payloadHash: `0xroutesame${i}`
    });
  }
}

describe('GET /api/v1/accounts/:nft_id/history', () => {
  let db: IndexerDatabase;
  let server: http.Server;

  beforeEach((done) => {
    cleanupDb();
    db = new IndexerDatabase(TEST_DB);
    const app = buildApp(db);
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => {
    server.close(() => {
      db.close();
      cleanupDb();
      done();
    });
  });

  it('clamps an oversized limit to the account history maximum', async () => {
    seedAccountHistory(db, 501);

    const res = await request(server, `/api/v1/accounts/${NFT_ADDRESS}/history?limit=100000000`);

    expect(res.status).toBe(200);
    expect(res.body?.events).toHaveLength(500);
    expect(res.body?.totalCount).toBe(501);
    expect(res.body?.pagination).toMatchObject({
      limit: 500,
      offset: 0,
      hasMore: true
    });
  });

  it('clamps a zero limit to the account history minimum', async () => {
    seedAccountHistory(db, 3);

    const res = await request(server, `/api/v1/accounts/${NFT_ADDRESS}/history?limit=0`);

    expect(res.status).toBe(200);
    expect(res.body?.events).toHaveLength(1);
    expect(res.body?.pagination).toMatchObject({
      limit: 1,
      offset: 0,
      hasMore: true
    });
  });

  it('rejects a negative limit instead of passing it through to SQLite', async () => {
    seedAccountHistory(db, 3);

    const res = await request(server, `/api/v1/accounts/${NFT_ADDRESS}/history?limit=-5`);

    expect(res.status).toBe(400);
    expect(res.body?.error).toMatchObject({
      code: 'API_INVALID_PARAMETER',
      message: 'Invalid pagination parameters'
    });
  });

  it('rejects a negative offset', async () => {
    seedAccountHistory(db, 3);

    const res = await request(server, `/api/v1/accounts/${NFT_ADDRESS}/history?offset=-1`);

    expect(res.status).toBe(400);
    expect(res.body?.error).toMatchObject({
      code: 'API_INVALID_PARAMETER',
      message: 'Invalid pagination parameters'
    });
  });

  it('uses a stable keyset cursor for rows sharing a timestamp', async () => {
    seedSameTimestampAccountHistory(db, 4);

    const firstPage = await request(server, `/api/v1/accounts/${NFT_ADDRESS}/history?limit=2`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body?.events).toHaveLength(2);
    expect(firstPage.body?.totalCount).toBe(4);
    expect(firstPage.body?.pagination?.hasMore).toBe(true);
    expect(firstPage.body?.pagination?.nextCursor).toEqual(expect.any(String));

    const cursor = firstPage.body?.pagination?.nextCursor;
    const secondPage = await request(
      server,
      `/api/v1/accounts/${NFT_ADDRESS}/history?limit=2&cursor=${encodeURIComponent(cursor!)}`
    );

    expect(secondPage.status).toBe(200);
    expect(secondPage.body?.events).toHaveLength(2);
    expect(secondPage.body?.totalCount).toBe(4);
    expect(secondPage.body?.pagination).toMatchObject({
      limit: 2,
      offset: 0,
      hasMore: false,
      nextCursor: null
    });

    const hashes = [...(firstPage.body?.events ?? []), ...(secondPage.body?.events ?? [])].map(
      (event) => (event as { transactionHash: string }).transactionHash
    );

    expect(hashes).toEqual([
      'tx_route_same_1',
      'tx_route_same_2',
      'tx_route_same_3',
      'tx_route_same_4'
    ]);
    expect(new Set(hashes).size).toBe(4);
  });
});
