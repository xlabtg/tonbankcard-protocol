// Express server for Payment Status Indexer API

import express from 'express';
import { createRouter } from './routes';
import { IndexerDatabase } from '../db/database';
import { IndexerService } from '../services/indexer-service';
import { IndexerConfig } from '../types/config';
import { IndexerErrorCode } from '../types/errors';
import { requestIdMiddleware } from './requestId';
import pino from 'pino';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterAbstract,
  RateLimiterRes,
} from 'rate-limiter-flexible';
import Redis from 'ioredis';

export interface ClientIpOptions {
  trustProxy: boolean;
  trustedProxyCount: number;
}

function splitForwardedFor(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap((raw) => raw.split(','))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Extract the client IP used for rate-limit keying.
 *
 * When proxy headers are trusted, derive the key from the rightmost untrusted
 * hop in the `X-Forwarded-For` chain plus the socket peer. This ignores
 * spoofable leftmost entries a client can prepend and avoids treating
 * single-value headers such as `CF-Connecting-IP` as proof of identity.
 */
export function getClientIp(
  req: express.Request,
  options: ClientIpOptions
): string {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';

  if (!options.trustProxy) {
    return remoteAddress;
  }

  const trustedProxyCount = Math.max(
    0,
    Math.floor(options.trustedProxyCount)
  );
  const chain = [
    ...splitForwardedFor(req.headers['x-forwarded-for']),
    remoteAddress,
  ];

  const clientIndex = chain.length - trustedProxyCount - 1;
  if (clientIndex >= 0) {
    return chain[clientIndex];
  }

  return remoteAddress;
}

export class ApiServer {
  private app: express.Application;
  private server?: any;
  private logger: pino.Logger;
  private config: IndexerConfig;
  private rateLimiter!: RateLimiterAbstract;
  private redisClient?: Redis;

  constructor(
    db: IndexerDatabase,
    indexer: IndexerService,
    config: IndexerConfig,
    logger: pino.Logger
  ) {
    this.config = config;
    this.logger = logger.child({ service: 'api' });
    this.app = express();

    this.setupRateLimiter();
    this.setupMiddleware();
    this.setupRoutes(db, indexer);
    this.setupErrorHandling();
  }

  /**
   * Build a rate limiter backed by Redis (distributed, multi-instance safe)
   * when Redis is configured, or fall back to an in-process memory limiter for
   * single-instance / development deployments.
   */
  private setupRateLimiter(): void {
    const { windowMs, maxRequests } = this.config.api.rateLimit;
    // rate-limiter-flexible uses "points" (requests) per "duration" (seconds).
    const durationSec = Math.ceil(windowMs / 1000);

    if (this.config.redis) {
      const { host, port, password, db } = this.config.redis;
      this.redisClient = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        // Don't let a Redis outage take the API down – queue commands instead.
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn({ err }, 'Redis error – rate limiting may degrade');
      });

      this.rateLimiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: 'rl_indexer',
        points: maxRequests,
        duration: durationSec,
      });

      this.logger.info(
        { host, port },
        'Rate limiter using Redis (distributed mode)'
      );
    } else {
      this.rateLimiter = new RateLimiterMemory({
        points: maxRequests,
        duration: durationSec,
      });

      this.logger.warn(
        'Rate limiter using in-process memory (single-instance only). ' +
          'Set REDIS_HOST to enable distributed rate limiting.'
      );
    }
  }

  private setupMiddleware(): void {
    // JSON parsing
    this.app.use(express.json());

    // Stamp every request with a stable identifier before anything else,
    // so even rate-limited responses are correlatable in the log.
    this.app.use(requestIdMiddleware);

    // CORS - allow all origins for read-only API
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Request logging at debug to keep the default `info` floor quiet
    // (see `docs/error-codes.md` §3.3 on the 20% log-volume cap).
    this.app.use((req, res, next) => {
      this.logger.debug(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          query: req.query,
        },
        'Incoming request'
      );
      next();
    });

    // Distributed-safe rate limiting with proper IP extraction and headers
    const { maxRequests, windowMs } = this.config.api.rateLimit;
    const trustProxy = this.config.api.trustProxy;
    const trustedProxyCount = this.config.api.trustedProxyCount;

    this.app.use(async (req, res, next) => {
      const ip = getClientIp(req, { trustProxy, trustedProxyCount });

      try {
        const rateLimiterRes: RateLimiterRes =
          await this.rateLimiter.consume(ip);

        const remaining = Math.max(0, rateLimiterRes.remainingPoints);
        const resetEpochMs = Date.now() + rateLimiterRes.msBeforeNext;

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetEpochMs / 1000));
        res.setHeader(
          'X-RateLimit-Window',
          Math.ceil(windowMs / 1000)
        );

        next();
      } catch (rateLimiterRes: unknown) {
        const rlRes = rateLimiterRes as RateLimiterRes;
        const secsToReset = Math.ceil((rlRes.msBeforeNext ?? windowMs) / 1000);

        res.setHeader('Retry-After', secsToReset);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader(
          'X-RateLimit-Reset',
          Math.ceil((Date.now() + (rlRes.msBeforeNext ?? windowMs)) / 1000)
        );

        // Single warn entry per blocked request — counted against the 20%
        // log-volume cap. Aggregators can alert on `errorCode`.
        this.logger.warn(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_RATE_LIMIT_EXCEEDED,
            ip,
            path: req.path,
          },
          'Rate limit exceeded'
        );

        res.status(429).json({
          error: {
            code: IndexerErrorCode.API_RATE_LIMIT_EXCEEDED,
            message: 'Too many requests',
          },
        });
      }
    });
  }

  private setupRoutes(db: IndexerDatabase, indexer: IndexerService): void {
    // API routes
    const router = createRouter(db, indexer, this.config, this.logger);
    this.app.use('/api/v1', router);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Tonbankcard Payment Status Indexer',
        version: '1.0.0',
        description: 'Read-only payment status indexer for Tonbankcard Protocol',
        endpoints: {
          health: '/api/v1/health',
          payment: '/api/v1/payments/:invoice_id',
          paymentEvents: '/api/v1/payments/:invoice_id/events',
          accountHistory: '/api/v1/accounts/:nft_id/history',
          blockInfo: '/api/v1/blocks/:block_number',
          transparencyMetrics: '/api/v1/transparency/metrics',
        },
        documentation: 'https://github.com/xlabtg/tonbankcard-protocol',
        advisory:
          'All responses are advisory. Always verify payment status on-chain.',
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler. We log at `warn` (operator signal, not an outage) with
    // the canonical `API_NOT_FOUND` errorCode so dashboards stay clean.
    this.app.use((req, res) => {
      this.logger.warn(
        {
          requestId: req.requestId,
          errorCode: IndexerErrorCode.API_NOT_FOUND,
          method: req.method,
          path: req.originalUrl ?? req.path,
        },
        'Route not found'
      );
      res.status(404).json({
        error: {
          code: IndexerErrorCode.API_NOT_FOUND,
          message: 'Endpoint not found',
        },
      });
    });

    // Error handler. Includes `errorCode` so the log entry can be joined
    // against the response envelope by operators triaging an incident.
    this.app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        this.logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            method: req.method,
            path: req.originalUrl ?? req.path,
            err: { name: err.name, message: err.message },
          },
          'Unhandled API error'
        );
        res.status(500).json({
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Internal server error',
          },
        });
      }
    );
  }

  async start(): Promise<void> {
    const { host, port } = this.config.api;

    // Connect to Redis lazily now that the server is starting
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
      } catch (err) {
        this.logger.warn({ err }, 'Could not connect to Redis on startup');
      }
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(port, host, () => {
        this.logger.info({ host, port }, 'API server started');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // ignore
      }
    }

    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err: Error) => {
        if (err) {
          this.logger.error({ error: err }, 'Error stopping API server');
          reject(err);
        } else {
          this.logger.info('API server stopped');
          resolve();
        }
      });
    });
  }
}
