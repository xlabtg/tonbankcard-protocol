// Tonbankcard Payment Status Indexer
// Main entry point

import dotenv from 'dotenv';
import pino from 'pino';
import { loadConfig } from './types/config';
import { IndexerDatabase } from './db/database';
import { IndexerService } from './services/indexer-service';
import { ApiServer } from './api/server';

// Load environment variables
dotenv.config();

// Create logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.LOG_PRETTY === 'true'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

// Main function
async function main() {
  logger.info('Starting Tonbankcard Payment Status Indexer');

  try {
    // Load configuration
    const config = loadConfig();
    logger.info({ config: { ...config, tonApiKey: '***' } }, 'Configuration loaded');

    // Initialize database
    logger.info('Initializing database');
    const db = new IndexerDatabase(config.database.path);

    // Initialize indexer service
    logger.info('Initializing indexer service');
    const indexer = new IndexerService(config, db, logger);

    // Initialize API server
    logger.info('Initializing API server');
    const apiServer = new ApiServer(db, indexer, config, logger);

    // Start services
    logger.info('Starting indexer');
    await indexer.start();

    logger.info('Starting API server');
    await apiServer.start();

    logger.info('Tonbankcard Payment Status Indexer is running');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      try {
        logger.info('Stopping API server');
        await apiServer.stop();

        logger.info('Stopping indexer');
        await indexer.stop();

        logger.info('Closing database');
        db.close();

        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Fatal error during startup');
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
