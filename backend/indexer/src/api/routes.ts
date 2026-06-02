// API routes for Payment Status Indexer
// All endpoints are read-only and advisory

import express, { Request, Response } from 'express';
import { IndexerDatabase } from '../db/database';
import { IndexerService } from '../services/indexer-service';
import { IndexerConfig } from '../types/config';
import {
  PaymentStatusResponse,
  PaymentEventsResponse,
  AccountHistoryResponse,
  PaymentStatus,
  ErrorResponse,
  HealthCheckResponse,
  BlockInfoResponse,
  TransparencyMetricsResponse,
  TransparencyProtocolMetricsRow,
  TransparencyLockActivityRow,
  TransparencyParameterChangeRow,
} from '../types/api';
import { accountStateToString } from '../types/events';
import { confirmationDepth, isBlockConfirmed } from '../services/confirmations';
import { IndexerErrorCode } from '../types/errors';
import pino from 'pino';

const ACCOUNT_HISTORY_DEFAULT_LIMIT = 100;
const ACCOUNT_HISTORY_MIN_LIMIT = 1;
const ACCOUNT_HISTORY_MAX_LIMIT = 500;

function parseQueryNumber(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAccountHistoryPagination(
  query: Request['query']
): { limit: number; offset: number } | null {
  const parsedLimit = parseQueryNumber(query.limit);
  const parsedOffset = parseQueryNumber(query.offset);

  if (
    (parsedLimit !== undefined && parsedLimit < 0) ||
    (parsedOffset !== undefined && parsedOffset < 0)
  ) {
    return null;
  }

  const rawLimit = Number.isInteger(parsedLimit) ? parsedLimit : undefined;
  const rawOffset = Number.isInteger(parsedOffset) ? parsedOffset : undefined;
  const limit = Math.min(
    Math.max(rawLimit ?? ACCOUNT_HISTORY_DEFAULT_LIMIT, ACCOUNT_HISTORY_MIN_LIMIT),
    ACCOUNT_HISTORY_MAX_LIMIT
  );
  const offset = rawOffset ?? 0;

  return { limit, offset };
}

export function createRouter(
  db: IndexerDatabase,
  indexer: IndexerService,
  config: IndexerConfig,
  logger: pino.Logger
): express.Router {
  const router = express.Router();

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const syncStatus = indexer.getSyncStatus();
      const eventCount = db.getEventCount();

      // Latest masterchain head the indexer has observed (persisted each sync).
      // Falls back to the indexed cursor before the first sync records a head.
      const chainLatestBlock =
        db.getLatestChainSeqno() || syncStatus.latestBlockIndexed;

      const response: HealthCheckResponse = {
        status: syncStatus.isRunning ? 'healthy' : 'degraded',
        version: '1.0.0',
        indexer: {
          latestBlockIndexed: syncStatus.latestBlockIndexed,
          chainLatestBlock,
          blocksBehind: chainLatestBlock - syncStatus.latestBlockIndexed,
          lastUpdateTime: Math.floor(Date.now() / 1000),
        },
        database: {
          connected: true,
          eventCount,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error(
        {
          requestId: req.requestId,
          errorCode: IndexerErrorCode.API_REQUEST_FAILED,
          path: req.originalUrl ?? req.path,
          err: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Unknown', message: String(error) },
        },
        'Health check failed'
      );
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  /**
   * GET /payments/:invoice_id
   * Get payment status by invoice ID
   * ADVISORY ONLY - always verify on-chain
   */
  router.get(
    '/payments/:invoice_id',
    async (req: Request, res: Response) => {
      try {
        const { invoice_id } = req.params;

        // In production, would hash invoice_id to get payload_hash
        // For now, treat invoice_id as payload_hash
        const payloadHash = invoice_id;

        const payment = db.getPaymentByPayloadHash(payloadHash);

        if (!payment) {
          const response: PaymentStatusResponse = {
            invoiceId: invoice_id,
            status: PaymentStatus.NOT_FOUND,
            payerNft: null,
            merchantNft: null,
            amountTbc: '0',
            createdAt: null,
            confirmedAt: null,
            blockNumber: null,
            transactionHash: null,
            confirmationBlocks: 0,
            metadata: {
              payloadHash: null,
            },
          };
          return res.json(response);
        }

        // Check confirmation count using the canonical definition shared with
        // the indexer (INDEXER-H1): confirmations = chainHead - block_number,
        // confirmed once that depth reaches the configured threshold. Reading
        // the persisted chain head (not the indexed cursor, which lags it by
        // `confirmationBlocks`) keeps this in lock-step with the
        // `blocks.confirmed` flag the indexer sets.
        const chainHeadSeqno = db.getLatestChainSeqno();
        const confirmationBlocks = confirmationDepth(
          chainHeadSeqno,
          payment.block_number
        );
        const isConfirmed = isBlockConfirmed(
          chainHeadSeqno,
          payment.block_number,
          config.indexer.confirmationBlocks
        );

        const response: PaymentStatusResponse = {
          invoiceId: invoice_id,
          status: isConfirmed
            ? PaymentStatus.CONFIRMED
            : PaymentStatus.PENDING,
          payerNft: payment.payer_nft,
          merchantNft: payment.merchant_nft,
          amountTbc: payment.amount_tbc,
          createdAt: payment.timestamp,
          confirmedAt: isConfirmed ? payment.timestamp : null,
          blockNumber: payment.block_number,
          transactionHash: payment.transaction_hash,
          confirmationBlocks,
          metadata: {
            payloadHash: payment.payload_hash,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            invoiceId: req.params.invoice_id,
            path: req.originalUrl ?? req.path,
            err: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Unknown', message: String(error) },
          },
          'Error fetching payment status'
        );
        const errorResponse: ErrorResponse = {
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Failed to fetch payment status',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  /**
   * GET /payments/:invoice_id/events
   * Get all events related to a payment
   * ADVISORY ONLY
   */
  router.get(
    '/payments/:invoice_id/events',
    async (req: Request, res: Response) => {
      try {
        const { invoice_id } = req.params;
        const payloadHash = invoice_id;

        const payment = db.getPaymentByPayloadHash(payloadHash);

        if (!payment) {
          const response: PaymentEventsResponse = {
            invoiceId: invoice_id,
            events: [],
            totalCount: 0,
          };
          return res.json(response);
        }

        const response: PaymentEventsResponse = {
          invoiceId: invoice_id,
          events: [
            {
              eventType: 'MerchantPayment',
              timestamp: payment.timestamp,
              blockNumber: payment.block_number,
              transactionHash: payment.transaction_hash,
              details: {
                payerNft: payment.payer_nft,
                merchantNft: payment.merchant_nft,
                amountTbc: payment.amount_tbc,
                payloadHash: payment.payload_hash,
              },
            },
          ],
          totalCount: 1,
        };

        res.json(response);
      } catch (error) {
        logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            invoiceId: req.params.invoice_id,
            path: req.originalUrl ?? req.path,
            err: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Unknown', message: String(error) },
          },
          'Error fetching payment events'
        );
        const errorResponse: ErrorResponse = {
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Failed to fetch payment events',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  /**
   * GET /accounts/:nft_id/history
   * Get account transaction history
   * ADVISORY ONLY - always verify on-chain
   */
  router.get(
    '/accounts/:nft_id/history',
    async (req: Request, res: Response) => {
      try {
        const { nft_id } = req.params;
        const pagination = parseAccountHistoryPagination(req.query);

        if (!pagination) {
          logger.warn(
            {
              requestId: req.requestId,
              errorCode: IndexerErrorCode.API_INVALID_PARAMETER,
              nftAddress: nft_id,
              path: req.originalUrl ?? req.path,
              rawLimit: req.query.limit,
              rawOffset: req.query.offset,
            },
            'Invalid account history pagination parameters'
          );
          const errorResponse: ErrorResponse = {
            error: {
              code: IndexerErrorCode.API_INVALID_PARAMETER,
              message: 'Invalid pagination parameters',
            },
          };
          return res.status(400).json(errorResponse);
        }

        const { limit, offset } = pagination;

        const nftAddress = nft_id; // In production, validate address format

        // Get account snapshot
        const snapshot = db.getAccountSnapshot(nftAddress);

        // Get history
        const history = db.getAccountHistory(nftAddress, limit, offset);

        const response: AccountHistoryResponse = {
          nftAddress,
          currentState: snapshot
            ? accountStateToString(snapshot.current_state)
            : 'UNKNOWN',
          currentBalance: '0', // Would need to calculate from events
          owner: snapshot?.current_owner || null,
          events: history.events,
          totalCount: history.totalCount,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < history.totalCount,
          },
        };

        res.json(response);
      } catch (error) {
        logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            nftAddress: req.params.nft_id,
            path: req.originalUrl ?? req.path,
            err: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Unknown', message: String(error) },
          },
          'Error fetching account history'
        );
        const errorResponse: ErrorResponse = {
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Failed to fetch account history',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  /**
   * GET /blocks/:block_number
   * Get block information
   * For transparency - exposes block numbers and hashes
   */
  router.get(
    '/blocks/:block_number',
    async (req: Request, res: Response) => {
      try {
        const blockNumber = parseInt(req.params.block_number);

        if (isNaN(blockNumber)) {
          logger.warn(
            {
              requestId: req.requestId,
              errorCode: IndexerErrorCode.API_INVALID_PARAMETER,
              path: req.originalUrl ?? req.path,
              rawBlockNumber: req.params.block_number,
            },
            'Invalid block number'
          );
          const errorResponse: ErrorResponse = {
            error: {
              code: IndexerErrorCode.API_INVALID_PARAMETER,
              message: 'Invalid block number',
            },
          };
          return res.status(400).json(errorResponse);
        }

        const block = db.getBlock(blockNumber);

        if (!block) {
          logger.warn(
            {
              requestId: req.requestId,
              errorCode: IndexerErrorCode.API_NOT_FOUND,
              path: req.originalUrl ?? req.path,
              blockNumber,
            },
            'Block not found'
          );
          const errorResponse: ErrorResponse = {
            error: {
              code: IndexerErrorCode.API_NOT_FOUND,
              message: 'Block not found',
            },
          };
          return res.status(404).json(errorResponse);
        }

        const response: BlockInfoResponse = {
          blockNumber: block.block_number,
          blockHash: block.block_hash,
          timestamp: block.timestamp,
          transactionCount: block.transaction_count,
          indexed: true,
        };

        res.json(response);
      } catch (error) {
        logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            blockNumber: req.params.block_number,
            path: req.originalUrl ?? req.path,
            err: error instanceof Error ? { name: error.name, message: error.message } : { name: 'Unknown', message: String(error) },
          },
          'Error fetching block info'
        );
        const errorResponse: ErrorResponse = {
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Failed to fetch block information',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  /**
   * GET /transparency/metrics
   * E4 (Issue #135) - On-Chain Transparency Reporting.
   *
   * Aggregated, privacy-preserving snapshot of the latest monthly
   * checksums anchored on-chain by TransparencyRegistry plus a bounded
   * history series. Schema is documented in
   * docs/governance/TRANSPARENCY_REPORTING.md §4.1.
   *
   * Query params:
   *   limit  - history rows per series (default 12, max 60)
   */
  router.get(
    '/transparency/metrics',
    async (req: Request, res: Response) => {
      try {
        const rawLimit = parseInt(req.query.limit as string, 10);
        const limit = Math.min(
          Math.max(Number.isFinite(rawLimit) ? rawLimit : 12, 1),
          60
        );

        const latestMetrics = db.getLatestTransparencyProtocolMetrics();
        const latestLockActivity = db.getLatestTransparencyLockActivity();
        const metricsHistory = db.listTransparencyProtocolMetrics(limit);
        const lockHistory = db.listTransparencyLockActivity(limit);
        const parameterChanges = db.listTransparencyParameterChanges(limit);
        const counts = db.getTransparencyCounts();

        const mapMetrics = (row: any): TransparencyProtocolMetricsRow => ({
          periodStart: row.period_start,
          periodEnd: row.period_end,
          activeAccounts: row.active_accounts,
          tbcVolumeTransferred: row.tbc_volume_transferred,
          transferCount: row.transfer_count,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
        });
        const mapLock = (row: any): TransparencyLockActivityRow => ({
          periodStart: row.period_start,
          periodEnd: row.period_end,
          locksSet: row.locks_set,
          locksCleared: row.locks_cleared,
          locksActive: row.locks_active,
          appealsFiled: row.appeals_filed,
          appealsOverturned: row.appeals_overturned,
          appealsUpheld: row.appeals_upheld,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
        });
        const mapParam = (row: any): TransparencyParameterChangeRow => ({
          parameterId: row.parameter_id,
          oldValueHash: row.old_value_hash,
          newValueHash: row.new_value_hash,
          effectiveBlock: row.effective_block,
          governanceProposalId: row.governance_proposal_id,
          blockNumber: row.block_number,
          transactionHash: row.transaction_hash,
          timestamp: row.timestamp,
        });

        const response: TransparencyMetricsResponse = {
          disclaimer:
            'This data is non-authoritative. Verify all data on-chain. ' +
            'Governance outcomes are advisory only.',
          snapshot: {
            indexedAt: Math.floor(Date.now() / 1000),
            latestBlockIndexed: db.getLatestBlockIndexed(),
          },
          protocolMetrics: {
            latest: latestMetrics ? mapMetrics(latestMetrics) : null,
            history: metricsHistory.map(mapMetrics),
            periodCount: counts.metric_periods,
          },
          lockActivity: {
            latest: latestLockActivity ? mapLock(latestLockActivity) : null,
            history: lockHistory.map(mapLock),
            periodCount: counts.lock_periods,
          },
          parameterChanges: {
            total: counts.parameter_changes,
            history: parameterChanges.map(mapParam),
          },
        };

        // Cache for 60s — the underlying aggregates change at most monthly.
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.json(response);
      } catch (error) {
        logger.error(
          {
            requestId: req.requestId,
            errorCode: IndexerErrorCode.API_REQUEST_FAILED,
            path: req.originalUrl ?? req.path,
            err:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: 'Unknown', message: String(error) },
          },
          'Error fetching transparency metrics'
        );
        const errorResponse: ErrorResponse = {
          error: {
            code: IndexerErrorCode.API_REQUEST_FAILED,
            message: 'Failed to fetch transparency metrics',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  return router;
}
