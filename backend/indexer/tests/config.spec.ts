/**
 * Regression tests for INDEXER-M6: config numeric parsing validation.
 *
 * Verifies that `loadConfig` rejects non-finite values and out-of-range
 * inputs with a descriptive error at startup instead of silently stalling.
 *
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/278
 */

import { describe, it, expect } from '@jest/globals';
import { loadConfig } from '../src/types/config';

const REQUIRED_ENV: Record<string, string> = {
  TON_NETWORK: 'testnet',
  TON_API_ENDPOINT: 'https://testnet.toncenter.com/api/v2',
  PAYMENT_HUB_ADDRESS: 'EQA1',
  MERCHANT_PAYMENT_HUB_ADDRESS: 'EQA2',
  DB_PATH: './data/test.db',
};

function withEnv(overrides: Record<string, string>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  const allKeys = [...Object.keys(REQUIRED_ENV), ...Object.keys(overrides)];
  for (const key of allKeys) {
    saved[key] = process.env[key];
  }
  for (const [k, v] of Object.entries(REQUIRED_ENV)) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

describe('loadConfig — numeric validation (INDEXER-M6)', () => {
  describe('INDEXER_CONFIRMATION_BLOCKS', () => {
    it('rejects a non-numeric value with a descriptive error', () => {
      withEnv({ INDEXER_CONFIRMATION_BLOCKS: 'foo' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_CONFIRMATION_BLOCKS/);
        expect(() => loadConfig()).toThrow(/not a finite integer/);
      });
    });

    it('rejects a negative value', () => {
      withEnv({ INDEXER_CONFIRMATION_BLOCKS: '-1' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_CONFIRMATION_BLOCKS/);
        expect(() => loadConfig()).toThrow(/below minimum/);
      });
    });

    it('accepts zero (no confirmation delay is valid)', () => {
      withEnv({ INDEXER_CONFIRMATION_BLOCKS: '0' }, () => {
        expect(() => loadConfig()).not.toThrow();
        expect(loadConfig().indexer.confirmationBlocks).toBe(0);
      });
    });

    it('accepts a positive value', () => {
      withEnv({ INDEXER_CONFIRMATION_BLOCKS: '5' }, () => {
        expect(loadConfig().indexer.confirmationBlocks).toBe(5);
      });
    });
  });

  describe('INDEXER_BATCH_SIZE', () => {
    it('rejects a non-numeric value', () => {
      withEnv({ INDEXER_BATCH_SIZE: 'abc' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_BATCH_SIZE/);
        expect(() => loadConfig()).toThrow(/not a finite integer/);
      });
    });

    it('rejects zero (would cause no-progress loop)', () => {
      withEnv({ INDEXER_BATCH_SIZE: '0' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_BATCH_SIZE/);
        expect(() => loadConfig()).toThrow(/below minimum/);
      });
    });

    it('rejects a negative value', () => {
      withEnv({ INDEXER_BATCH_SIZE: '-1' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_BATCH_SIZE/);
        expect(() => loadConfig()).toThrow(/below minimum/);
      });
    });

    it('accepts a positive value', () => {
      withEnv({ INDEXER_BATCH_SIZE: '50' }, () => {
        expect(loadConfig().indexer.batchSize).toBe(50);
      });
    });
  });

  describe('INDEXER_START_BLOCK', () => {
    it('rejects a non-numeric value', () => {
      withEnv({ INDEXER_START_BLOCK: 'not-a-number' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_START_BLOCK/);
      });
    });

    it('rejects a negative value', () => {
      withEnv({ INDEXER_START_BLOCK: '-5' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_START_BLOCK/);
      });
    });

    it('accepts zero', () => {
      withEnv({ INDEXER_START_BLOCK: '0' }, () => {
        expect(loadConfig().indexer.startBlock).toBe(0);
      });
    });
  });

  describe('INDEXER_POLL_INTERVAL_MS', () => {
    it('rejects a non-numeric value', () => {
      withEnv({ INDEXER_POLL_INTERVAL_MS: 'fast' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_POLL_INTERVAL_MS/);
      });
    });

    it('rejects zero', () => {
      withEnv({ INDEXER_POLL_INTERVAL_MS: '0' }, () => {
        expect(() => loadConfig()).toThrow(/INDEXER_POLL_INTERVAL_MS/);
      });
    });

    it('accepts a positive value', () => {
      withEnv({ INDEXER_POLL_INTERVAL_MS: '1000' }, () => {
        expect(loadConfig().indexer.pollIntervalMs).toBe(1000);
      });
    });
  });

  describe('API_TRUSTED_PROXY_COUNT', () => {
    it('defaults to zero when proxy headers are not trusted', () => {
      withEnv({ API_TRUST_PROXY: 'false' }, () => {
        expect(loadConfig().api.trustedProxyCount).toBe(0);
      });
    });

    it('defaults to one trusted hop when API_TRUST_PROXY=true', () => {
      withEnv({ API_TRUST_PROXY: 'true' }, () => {
        expect(loadConfig().api.trustedProxyCount).toBe(1);
      });
    });

    it('accepts an explicit trusted proxy count', () => {
      withEnv({ API_TRUST_PROXY: 'true', API_TRUSTED_PROXY_COUNT: '2' }, () => {
        expect(loadConfig().api.trustedProxyCount).toBe(2);
      });
    });

    it('rejects a negative trusted proxy count', () => {
      withEnv({ API_TRUSTED_PROXY_COUNT: '-1' }, () => {
        expect(() => loadConfig()).toThrow(/API_TRUSTED_PROXY_COUNT/);
      });
    });
  });

  describe('defaults (no env overrides)', () => {
    it('loads successfully with only required env variables set', () => {
      withEnv({}, () => {
        const cfg = loadConfig();
        expect(cfg.indexer.batchSize).toBe(100);
        expect(cfg.indexer.confirmationBlocks).toBe(10);
        expect(cfg.indexer.startBlock).toBe(0);
        expect(cfg.indexer.pollIntervalMs).toBe(5000);
      });
    });
  });
});
