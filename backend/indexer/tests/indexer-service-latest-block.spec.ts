// Regression tests for INDEXER-H3: getLatestBlock must read the masterchain
// tip robustly. The audit observed that reading `info.latestSeqno` while the
// raw HTTP API exposes `info.last.seqno` yields `undefined`, which propagates
// to `NaN` sync bounds and silently stalls the loop. getLatestBlock now accepts
// both shapes and rejects a non-finite seqno with a clear error instead of
// computing NaN ranges.

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerConfig } from '../src/types/config';
import { IndexerErrorCode } from '../src/types/errors';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeConfig(): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'https://toncenter.example.com/api/v2',
    tonApiKey: '',
    contracts: {
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
      rateLimit: { windowMs: 60000, maxRequests: 100 },
    },
    logging: { level: 'silent', pretty: false },
  } as unknown as IndexerConfig;
}

const silentLogger = pino({ level: 'silent' });

/** Stub DB that tracks the cursor so we can observe whether sync advanced. */
function makeStubDb() {
  let cursor = 0;
  const inserted: number[] = [];
  return {
    inserted,
    getLatestBlockIndexed: () => cursor,
    getBlock: () => null,
    insertBlock: (n: number) => {
      inserted.push(n);
    },
    updateLatestBlock: (n: number) => {
      cursor = n;
    },
    markBlocksConfirmed: () => {},
    handleReorg: () => {},
  };
}

function makeService(db: any) {
  return new IndexerService(makeConfig(), db, silentLogger) as any;
}

describe('IndexerService.getLatestBlock (INDEXER-H3)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the tip from the raw HTTP shape { last: { seqno } }', async () => {
    const service = makeService(makeStubDb());
    jest
      .spyOn(service.client, 'getMasterchainInfo')
      .mockResolvedValue({ last: { seqno: 1234 } } as never);

    const result = await service.getLatestBlock();
    expect(result).toEqual({ seqno: 1234 });
  });

  it('reads the tip from the TonClient shape { latestSeqno }', async () => {
    const service = makeService(makeStubDb());
    jest
      .spyOn(service.client, 'getMasterchainInfo')
      .mockResolvedValue({ latestSeqno: 4321 } as never);

    const result = await service.getLatestBlock();
    expect(result).toEqual({ seqno: 4321 });
  });

  it('rejects a non-finite seqno with a clear error instead of returning NaN', async () => {
    const db = makeStubDb();
    const service = makeService(db);
    // Neither known field present -> seqno is undefined -> non-finite.
    jest
      .spyOn(service.client, 'getMasterchainInfo')
      .mockResolvedValue({} as never);

    const errorSpy = jest.spyOn(service.logger, 'error');

    const result = await service.getLatestBlock();
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: IndexerErrorCode.LATEST_BLOCK_UNAVAILABLE,
      }),
      expect.any(String)
    );
  });
});

describe('IndexerService.syncBlocks range with { last: { seqno } } (INDEXER-H3)', () => {
  let db: ReturnType<typeof makeStubDb>;
  let service: any;

  beforeEach(() => {
    db = makeStubDb();
    service = makeService(db);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('computes a finite range and drives the sync loop', async () => {
    // Tip at seqno 8, confirmationBlocks=3 -> endBlock=5, startBlock=1.
    jest
      .spyOn(service.client, 'getMasterchainInfo')
      .mockResolvedValue({ last: { seqno: 8 } } as never);

    // No reorg revalidation work needed (empty indexed range).
    jest.spyOn(service, 'revalidateIndexedRange').mockResolvedValue(null as never);

    const ranges: Array<[number, number]> = [];
    jest
      .spyOn(service, 'syncBlockRange')
      .mockImplementation((...args: unknown[]) => {
        ranges.push([args[0] as number, args[1] as number]);
        return Promise.resolve() as never;
      });

    await service.syncBlocks();

    // batchSize=10 covers the whole confirmed range in one call: [1..5].
    expect(ranges).toEqual([[1, 5]]);
  });

  it('does not advance when getMasterchainInfo returns no usable seqno', async () => {
    jest
      .spyOn(service.client, 'getMasterchainInfo')
      .mockResolvedValue({} as never);

    const rangeSpy = jest.spyOn(service, 'syncBlockRange');

    await service.syncBlocks();

    // No NaN-bounded iteration; the poll skips cleanly without touching blocks.
    expect(rangeSpy).not.toHaveBeenCalled();
    expect(db.getLatestBlockIndexed()).toBe(0);
  });
});
