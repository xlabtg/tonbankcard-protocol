// Unit tests for IndexerService.fetchWithRetry
// Tests timeout, exponential backoff, and retry logic for fetch failures

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerConfig } from '../src/types/config';

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeConfig(tonApiKey = ''): IndexerConfig {
  return {
    network: 'testnet',
    tonApiEndpoint: 'https://toncenter.example.com/api/v2',
    tonApiKey,
    contracts: {
      paymentHub: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
      merchantPaymentHub: '',
      nftCollections: [],
      transparencyRegistry: '',
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

const stubDb: any = {
  getLatestBlockIndexed: () => 0,
  getBlock: () => null,
  insertBlock: () => {},
  updateLatestBlock: () => {},
  markBlocksConfirmed: () => {},
  handleReorg: () => {},
};

const silentLogger = pino({ level: 'silent' });

// ---------------------------------------------------------------------------
// Helper to create service with access to private methods via casting
// ---------------------------------------------------------------------------

function makeService() {
  return new IndexerService(makeConfig(), stubDb, silentLogger) as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexerService.fetchWithRetry', () => {
  let service: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    service = makeService();
    originalFetch = global.fetch;
    // Use fake timers so delay() calls resolve instantly
    jest.useFakeTimers();
    // Stub out the delay method so retries happen synchronously
    service.delay = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  it('returns parsed JSON on a successful response', async () => {
    const payload = { ok: true, result: [{ id: 1 }] };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await service.fetchWithRetry('https://example.com/test');
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('throws immediately on 4xx (non-retryable) error', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchWithRetry('https://example.com/test', 3, 10000)
    ).rejects.toThrow('HTTP 404: Not Found');

    // Must NOT retry on 4xx
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('retries on 5xx errors and succeeds on later attempt', async () => {
    const payload = { ok: true, result: [] };
    let callCount = 0;

    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        } as Response;
      }
      return {
        ok: true,
        json: async () => payload,
      } as Response;
    });

    const result = await service.fetchWithRetry('https://example.com/test', 3, 10000);
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    // delay should have been called for the two failed attempts
    expect(service.delay).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('throws after exhausting all retries on persistent 5xx', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchWithRetry('https://example.com/test', 3, 10000)
    ).rejects.toThrow('HTTP 500: Internal Server Error');

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  it('retries on network error and succeeds on later attempt', async () => {
    const payload = { ok: true, result: [{ id: 42 }] };
    let callCount = 0;

    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        json: async () => payload,
      } as Response;
    });

    const result = await service.fetchWithRetry('https://example.com/test', 3, 10000);
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(service.delay).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('throws after exhausting all retries on persistent network errors', async () => {
    const networkError = new TypeError('Failed to fetch');
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(networkError);

    await expect(
      service.fetchWithRetry('https://example.com/test', 3, 10000)
    ).rejects.toThrow('Failed to fetch');

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  it('aborts and retries when the request times out', async () => {
    const payload = { ok: true, result: [] };
    let callCount = 0;

    global.fetch = jest.fn<typeof fetch>().mockImplementation(
      (_url, options) => {
        callCount++;
        if (callCount === 1) {
          // Simulate a slow request that respects AbortSignal
          return new Promise<Response>((_resolve, reject) => {
            const signal = (options as RequestInit | undefined)?.signal as AbortSignal | undefined;
            if (signal) {
              signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              });
            }
            // Never resolves on its own — relies on the abort signal
          });
        }
        // Second attempt succeeds immediately
        return Promise.resolve({
          ok: true,
          json: async () => payload,
        } as Response);
      }
    );

    // Use a very short timeout (1ms) so AbortController fires quickly with fake timers
    const fetchPromise = service.fetchWithRetry('https://example.com/test', 3, 1);

    // Fire the AbortController timeout
    jest.runAllTimers();

    const result = await fetchPromise;
    expect(result).toEqual(payload);
    // First attempt timed out, second succeeded
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('respects maxRetries parameter', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchWithRetry('https://example.com/test', 2, 10000)
    ).rejects.toThrow('HTTP 502');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('uses exponential backoff delays between retries', async () => {
    // Restore real delay to verify the math
    service.delay = jest.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    } as Response);

    await expect(
      service.fetchWithRetry('https://example.com/test', 3, 10000)
    ).rejects.toThrow('HTTP 503');

    // attempt=1 -> delay(2^1*1000=2000), attempt=2 -> delay(2^2*1000=4000)
    expect(service.delay).toHaveBeenNthCalledWith(1, 2000);
    expect(service.delay).toHaveBeenNthCalledWith(2, 4000);
  });

  // -------------------------------------------------------------------------
  it('redacts api_key query parameters in retry logs', async () => {
    const warn = jest.fn();
    service.logger = { warn };

    global.fetch = jest
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

    await service.fetchWithRetry(
      'https://example.com/test?api_key=secret-token&seqno=1',
      2,
      10000
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const meta = warn.mock.calls[0][0] as { url?: string };
    expect(meta.url).toContain('api_key=REDACTED');
    expect(meta.url).not.toContain('secret-token');
  });

  // -------------------------------------------------------------------------
  it('fetches block lookup/header through fetchWithRetry with X-API-Key header', async () => {
    service = new IndexerService(
      makeConfig('secret-token'),
      stubDb,
      silentLogger
    ) as any;

    const fetchSpy = jest
      .spyOn(service, 'fetchWithRetry')
      .mockImplementation(async (...args: unknown[]) => {
        const url = args[0] as string;
        const options = args[1] as { init?: { headers?: Record<string, string> } };

        expect(url).not.toContain('api_key=');
        expect(options.init?.headers?.['X-API-Key']).toBe('secret-token');

        if (url.includes('/lookupBlock')) {
          return {
            ok: true,
            result: {
              workchain: -1,
              shard: '-9223372036854775808',
              seqno: 42,
              root_hash: 'lookup-root',
            },
          };
        }

        if (url.includes('/getBlockHeader')) {
          return {
            ok: true,
            result: {
              id: { root_hash: 'header-root' },
              prev_blocks: [{ root_hash: 'prev-root' }],
              gen_utime: 123456,
            },
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

    const block = await service.getBlockByNumber(42);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(block).toEqual({
      seqno: 42,
      id: {
        root_hash: 'header-root',
        prev_root_hash: 'prev-root',
      },
      now: 123456,
    });
  });
});
