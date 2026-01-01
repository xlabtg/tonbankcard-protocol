// API routes for Payment Status Indexer
// All endpoints are read-only and advisory

import express, { Request, Response, NextFunction } from 'express';
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
} from '../types/api';
import { accountStateToString } from '../types/events';
import pino from 'pino';

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

      // In production, also fetch latest block from chain
      const chainLatestBlock = syncStatus.latestBlockIndexed; // Placeholder

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
      logger.error({ error }, 'Health check failed');
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

        // Check confirmation count
        const latestBlock = db.getLatestBlockIndexed();
        const confirmationBlocks = latestBlock - payment.block_number;
        const isConfirmed =
          confirmationBlocks >= config.indexer.confirmationBlocks;

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
        logger.error({ error }, 'Error fetching payment status');
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
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
        logger.error({ error }, 'Error fetching payment events');
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
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
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

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
        logger.error({ error }, 'Error fetching account history');
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
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
          const errorResponse: ErrorResponse = {
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Invalid block number',
            },
          };
          return res.status(400).json(errorResponse);
        }

        const block = db.getBlock(blockNumber);

        if (!block) {
          const errorResponse: ErrorResponse = {
            error: {
              code: 'NOT_FOUND',
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
        logger.error({ error }, 'Error fetching block info');
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch block information',
          },
        };
        res.status(500).json(errorResponse);
      }
    }
  );

  return router;
}
