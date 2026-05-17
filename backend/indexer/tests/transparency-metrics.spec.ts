// Tests for the E4 transparency database operations + the
// /api/v1/transparency/metrics route handler (Issue #135).

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

import { IndexerDatabase } from '../src/db/database';
import { createRouter } from '../src/api/routes';
import { IndexerConfig } from '../src/types/config';

const TEST_DB = path.join(__dirname, 'test-transparency.db');
const NULL_LOGGER = pino({ level: 'silent' });

function cleanupDb(): void {
  for (const ext of ['', '-wal', '-shm']) {
    const p = TEST_DB + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function fakeIndexer(): any {
  return {
    getStatus: () => ({
      latestBlockIndexed: 0,
      chainLatestBlock: 0,
      isRunning: true,
    }),
  };
}

function fakeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'http://localhost',
    contracts: {
      paymentHub: '',
      merchantPaymentHub: '',
      nftCollections: [],
      transparencyRegistry: '',
    },
    database: { path: TEST_DB },
    indexer: {
      startBlock: 0,
      pollIntervalMs: 1000,
      batchSize: 10,
      confirmationBlocks: 1,
    },
    api: {
      port: 0,
      host: '127.0.0.1',
      trustProxy: false,
      rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    logging: { level: 'silent' as any, pretty: false },
  };
}

function buildApp(db: IndexerDatabase): express.Application {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.requestId = 'test-req';
    next();
  });
  app.use('/api/v1', createRouter(db, fakeIndexer(), fakeConfig(), NULL_LOGGER));
  return app;
}

function request(
  server: http.Server,
  path: string
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    http
      .get(
        { hostname: '127.0.0.1', port: addr.port, path, method: 'GET' },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: data ? JSON.parse(data) : null,
            });
          });
        }
      )
      .on('error', reject);
  });
}

describe('IndexerDatabase – E4 transparency aggregates', () => {
  let db: IndexerDatabase;

  beforeEach(() => {
    cleanupDb();
    db = new IndexerDatabase(TEST_DB);
    db.insertBlock(100, 'h100', 'h099', 1_700_000_000, 1);
    db.insertBlock(200, 'h200', 'h199', 1_702_000_000, 1);
  });

  afterEach(() => {
    db.close();
    cleanupDb();
  });

  it('inserts and reads back a protocol-metrics row', () => {
    db.insertTransparencyProtocolMetrics({
      blockNumber: 100,
      transactionHash: 'tx-pm-1',
      logIndex: 0,
      timestamp: 1_700_000_000,
      periodStart: 1_690_000_000,
      periodEnd: 1_700_000_000,
      activeAccounts: 1234,
      tbcVolumeTransferred: '987654321000000',
      transferCount: 4567,
    });

    const latest = db.getLatestTransparencyProtocolMetrics();
    expect(latest).not.toBeNull();
    expect(latest!.active_accounts).toBe(1234);
    expect(latest!.tbc_volume_transferred).toBe('987654321000000');
    expect(latest!.transfer_count).toBe(4567);
    expect(latest!.block_number).toBe(100);

    const counts = db.getTransparencyCounts();
    expect(counts.metric_periods).toBe(1);
  });

  it('orders history newest-first across multiple periods', () => {
    db.insertTransparencyProtocolMetrics({
      blockNumber: 100,
      transactionHash: 'tx-pm-old',
      logIndex: 0,
      timestamp: 1_700_000_000,
      periodStart: 1_690_000_000,
      periodEnd: 1_700_000_000,
      activeAccounts: 1000,
      tbcVolumeTransferred: '1000',
      transferCount: 10,
    });
    db.insertTransparencyProtocolMetrics({
      blockNumber: 200,
      transactionHash: 'tx-pm-new',
      logIndex: 0,
      timestamp: 1_702_000_000,
      periodStart: 1_700_000_000,
      periodEnd: 1_702_000_000,
      activeAccounts: 2000,
      tbcVolumeTransferred: '2000',
      transferCount: 20,
    });

    const history = db.listTransparencyProtocolMetrics(10);
    expect(history.map((r) => r.transaction_hash)).toEqual([
      'tx-pm-new',
      'tx-pm-old',
    ]);
    expect(db.getLatestTransparencyProtocolMetrics()!.transaction_hash).toBe(
      'tx-pm-new'
    );
  });

  it('ignores duplicate (transaction_hash, log_index) inserts', () => {
    const row = {
      blockNumber: 100,
      transactionHash: 'tx-dup',
      logIndex: 7,
      timestamp: 1_700_000_000,
      periodStart: 1_690_000_000,
      periodEnd: 1_700_000_000,
      activeAccounts: 1,
      tbcVolumeTransferred: '1',
      transferCount: 1,
    };
    db.insertTransparencyProtocolMetrics(row);
    db.insertTransparencyProtocolMetrics(row);

    expect(db.getTransparencyCounts().metric_periods).toBe(1);
  });

  it('inserts and reads back a lock-activity row', () => {
    db.insertTransparencyLockActivity({
      blockNumber: 200,
      transactionHash: 'tx-la-1',
      logIndex: 0,
      timestamp: 1_702_000_000,
      periodStart: 1_700_000_000,
      periodEnd: 1_702_000_000,
      locksSet: 12,
      locksCleared: 4,
      locksActive: 8,
      appealsFiled: 5,
      appealsOverturned: 2,
      appealsUpheld: 3,
    });

    const latest = db.getLatestTransparencyLockActivity();
    expect(latest).not.toBeNull();
    expect(latest!.locks_set).toBe(12);
    expect(latest!.appeals_overturned).toBe(2);
    expect(db.getTransparencyCounts().lock_periods).toBe(1);
  });

  it('inserts a parameter-change row with nullable governance_proposal_id', () => {
    db.insertTransparencyParameterChange({
      blockNumber: 100,
      transactionHash: 'tx-pc-1',
      logIndex: 0,
      timestamp: 1_700_000_000,
      parameterId: 'PP-13.fee.bps',
      oldValueHash: 'a'.repeat(64),
      newValueHash: 'b'.repeat(64),
      effectiveBlock: 110,
      governanceProposalId: 42,
    });
    db.insertTransparencyParameterChange({
      blockNumber: 200,
      transactionHash: 'tx-pc-2',
      logIndex: 0,
      timestamp: 1_702_000_000,
      parameterId: 'PP-13.fee.bps',
      oldValueHash: 'b'.repeat(64),
      newValueHash: 'c'.repeat(64),
      effectiveBlock: 220,
      governanceProposalId: null,
    });

    const rows = db.listTransparencyParameterChanges(10);
    expect(rows).toHaveLength(2);
    // Newest first: effective_block 220 then 110
    expect(rows[0].effective_block).toBe(220);
    expect(rows[0].governance_proposal_id).toBeNull();
    expect(rows[1].governance_proposal_id).toBe(42);

    expect(db.getTransparencyCounts().parameter_changes).toBe(2);
  });
});

describe('GET /api/v1/transparency/metrics', () => {
  let db: IndexerDatabase;
  let server: http.Server;

  beforeEach((done) => {
    cleanupDb();
    db = new IndexerDatabase(TEST_DB);
    db.insertBlock(100, 'h100', 'h099', 1_700_000_000, 1);

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

  it('returns an empty-state snapshot when no events are recorded', async () => {
    const res = await request(server, '/api/v1/transparency/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=60');
    expect(typeof res.body.disclaimer).toBe('string');
    expect(res.body.protocolMetrics.latest).toBeNull();
    expect(res.body.protocolMetrics.history).toEqual([]);
    expect(res.body.protocolMetrics.periodCount).toBe(0);
    expect(res.body.lockActivity.latest).toBeNull();
    expect(res.body.parameterChanges.total).toBe(0);
  });

  it('maps DB rows to the documented camelCase response shape', async () => {
    db.insertTransparencyProtocolMetrics({
      blockNumber: 100,
      transactionHash: 'tx-pm',
      logIndex: 0,
      timestamp: 1_700_000_000,
      periodStart: 1_690_000_000,
      periodEnd: 1_700_000_000,
      activeAccounts: 4242,
      tbcVolumeTransferred: '12345',
      transferCount: 9,
    });
    db.insertTransparencyLockActivity({
      blockNumber: 100,
      transactionHash: 'tx-la',
      logIndex: 0,
      timestamp: 1_700_000_000,
      periodStart: 1_690_000_000,
      periodEnd: 1_700_000_000,
      locksSet: 3,
      locksCleared: 1,
      locksActive: 2,
      appealsFiled: 1,
      appealsOverturned: 0,
      appealsUpheld: 1,
    });
    db.insertTransparencyParameterChange({
      blockNumber: 100,
      transactionHash: 'tx-pc',
      logIndex: 0,
      timestamp: 1_700_000_000,
      parameterId: 'PP-13.fee.bps',
      oldValueHash: 'aa',
      newValueHash: 'bb',
      effectiveBlock: 105,
      governanceProposalId: 7,
    });

    const res = await request(server, '/api/v1/transparency/metrics');

    expect(res.status).toBe(200);
    expect(res.body.protocolMetrics.latest).toMatchObject({
      activeAccounts: 4242,
      tbcVolumeTransferred: '12345',
      transferCount: 9,
      blockNumber: 100,
      transactionHash: 'tx-pm',
    });
    expect(res.body.lockActivity.latest).toMatchObject({
      locksSet: 3,
      locksCleared: 1,
      locksActive: 2,
      appealsFiled: 1,
      appealsOverturned: 0,
      appealsUpheld: 1,
    });
    expect(res.body.parameterChanges.history[0]).toMatchObject({
      parameterId: 'PP-13.fee.bps',
      effectiveBlock: 105,
      governanceProposalId: 7,
    });
  });

  it('clamps the limit query parameter to [1, 60]', async () => {
    // Seed 3 metric periods at different periodEnds
    for (let i = 0; i < 3; i++) {
      db.insertTransparencyProtocolMetrics({
        blockNumber: 100,
        transactionHash: `tx-pm-${i}`,
        logIndex: i,
        timestamp: 1_700_000_000 + i,
        periodStart: 1_690_000_000 + i,
        periodEnd: 1_700_000_000 + i,
        activeAccounts: i,
        tbcVolumeTransferred: String(i),
        transferCount: i,
      });
    }

    const lowRes = await request(
      server,
      '/api/v1/transparency/metrics?limit=0'
    );
    expect(lowRes.status).toBe(200);
    expect(lowRes.body.protocolMetrics.history.length).toBe(1);

    const highRes = await request(
      server,
      '/api/v1/transparency/metrics?limit=99999'
    );
    expect(highRes.status).toBe(200);
    expect(highRes.body.protocolMetrics.history.length).toBe(3);
    expect(highRes.body.protocolMetrics.periodCount).toBe(3);
  });
});
