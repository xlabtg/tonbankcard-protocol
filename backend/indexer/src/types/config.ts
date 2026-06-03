// Configuration types for the indexer

export interface IndexerConfig {
  // Network configuration
  network: 'mainnet' | 'testnet';
  tonApiEndpoint: string;
  tonApiKey?: string;

  // Contract addresses
  contracts: {
    paymentHub: string;
    merchantPaymentHub: string;
    nftCollections: string[];
    /**
     * TransparencyRegistry (E4, Issue #135). Empty string disables transparency
     * indexing — the API still serves cached aggregates if present.
     */
    transparencyRegistry: string;
  };

  // Database configuration
  database: {
    path: string;
  };

  // Indexer behavior
  indexer: {
    startBlock: number;
    pollIntervalMs: number;
    batchSize: number;
    confirmationBlocks: number;
  };

  // Redis configuration (optional – enables distributed rate limiting)
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  // API configuration
  api: {
    port: number;
    host: string;
    /** Trust X-Forwarded-For / CF-Connecting-IP headers from a reverse proxy */
    trustProxy: boolean;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };

  // Logging
  logging: {
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    pretty: boolean;
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): IndexerConfig {
  const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || defaultValue!;
  };

  const getEnvNumber = (
    key: string,
    defaultValue: number,
    options?: { min?: number; max?: number },
  ): number => {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (!isFinite(parsed)) {
      throw new Error(
        `Invalid value for ${key}: "${value}" is not a finite integer`,
      );
    }
    if (options?.min !== undefined && parsed < options.min) {
      throw new Error(
        `Invalid value for ${key}: ${parsed} is below minimum ${options.min}`,
      );
    }
    if (options?.max !== undefined && parsed > options.max) {
      throw new Error(
        `Invalid value for ${key}: ${parsed} is above maximum ${options.max}`,
      );
    }
    return parsed;
  };

  const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
    const value = process.env[key];
    return value ? value.toLowerCase() === 'true' : defaultValue;
  };

  return {
    network: (getEnv('TON_NETWORK', 'testnet') as 'mainnet' | 'testnet'),
    tonApiEndpoint: getEnv(
      'TON_API_ENDPOINT',
      'https://testnet.toncenter.com/api/v2'
    ),
    tonApiKey: process.env.TON_API_KEY,

    contracts: {
      paymentHub: getEnv('PAYMENT_HUB_ADDRESS', ''),
      merchantPaymentHub: getEnv('MERCHANT_PAYMENT_HUB_ADDRESS', ''),
      nftCollections: [
        getEnv('NFT_COLLECTION_7777_ADDRESS', ''),
        getEnv('NFT_COLLECTION_8888_ADDRESS', ''),
      ].filter((addr) => addr !== ''),
      transparencyRegistry: getEnv('TRANSPARENCY_REGISTRY_ADDRESS', ''),
    },

    database: {
      path: getEnv('DB_PATH', './data/indexer.db'),
    },

    indexer: {
      startBlock: getEnvNumber('INDEXER_START_BLOCK', 0, { min: 0 }),
      pollIntervalMs: getEnvNumber('INDEXER_POLL_INTERVAL_MS', 5000, { min: 1 }),
      batchSize: getEnvNumber('INDEXER_BATCH_SIZE', 100, { min: 1 }),
      confirmationBlocks: getEnvNumber('INDEXER_CONFIRMATION_BLOCKS', 10, { min: 0 }),
    },

    redis: process.env.REDIS_HOST
      ? {
          host: getEnv('REDIS_HOST', '127.0.0.1'),
          port: getEnvNumber('REDIS_PORT', 6379),
          password: process.env.REDIS_PASSWORD,
          db: getEnvNumber('REDIS_DB', 0),
        }
      : undefined,

    api: {
      port: getEnvNumber('PORT', 3000),
      host: getEnv('HOST', '0.0.0.0'),
      trustProxy: getEnvBoolean('API_TRUST_PROXY', false),
      rateLimit: {
        windowMs: getEnvNumber('API_RATE_LIMIT_WINDOW_MS', 60000),
        maxRequests: getEnvNumber('API_RATE_LIMIT_MAX_REQUESTS', 100),
      },
    },

    logging: {
      level: (getEnv('LOG_LEVEL', 'info') as IndexerConfig['logging']['level']),
      pretty: getEnvBoolean('LOG_PRETTY', true),
    },
  };
}
