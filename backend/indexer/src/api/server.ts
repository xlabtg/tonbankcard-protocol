// Express server for Payment Status Indexer API

import express from 'express';
import { createRouter } from './routes';
import { IndexerDatabase } from '../db/database';
import { IndexerService } from '../services/indexer-service';
import { IndexerConfig } from '../types/config';
import pino from 'pino';

export class ApiServer {
  private app: express.Application;
  private server?: any;
  private logger: pino.Logger;
  private config: IndexerConfig;

  constructor(
    db: IndexerDatabase,
    indexer: IndexerService,
    config: IndexerConfig,
    logger: pino.Logger
  ) {
    this.config = config;
    this.logger = logger.child({ service: 'api' });
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes(db, indexer);
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // JSON parsing
    this.app.use(express.json());

    // CORS - allow all origins for read-only API
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(
        {
          method: req.method,
          path: req.path,
          query: req.query,
        },
        'Incoming request'
      );
      next();
    });

    // Simple rate limiting (in production, use proper rate limiter)
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    this.app.use((req, res, next) => {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      const windowMs = this.config.api.rateLimit.windowMs;
      const maxRequests = this.config.api.rateLimit.maxRequests;

      const record = requestCounts.get(ip);
      if (!record || now > record.resetTime) {
        requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
        next();
      } else if (record.count < maxRequests) {
        record.count++;
        next();
      } else {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
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
        },
        documentation: 'https://github.com/xlabtg/tonbankcard-protocol',
        advisory:
          'All responses are advisory. Always verify payment status on-chain.',
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });

    // Error handler
    this.app.use(
      (
        err: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        this.logger.error({ error: err }, 'Unhandled error');
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        });
      }
    );
  }

  async start(): Promise<void> {
    const { host, port } = this.config.api;

    return new Promise((resolve) => {
      this.server = this.app.listen(port, host, () => {
        this.logger.info({ host, port }, 'API server started');
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
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
