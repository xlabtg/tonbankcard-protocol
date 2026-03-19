// Indexer Service - Observes blockchain and indexes events
// Handles reorgs and maintains read-only event database

import { TonClient } from '@ton/ton';
import { IndexerDatabase } from '../db/database';
import { EventParser } from '../parsers/event-parser';
import { IndexerConfig } from '../types/config';
import { IndexedEvent } from '../types/events';
import pino from 'pino';

export class IndexerService {
  private client: TonClient;
  private db: IndexerDatabase;
  private parser: EventParser;
  private config: IndexerConfig;
  private logger: pino.Logger;
  private isRunning: boolean = false;
  private pollInterval?: NodeJS.Timeout;

  constructor(
    config: IndexerConfig,
    db: IndexerDatabase,
    logger: pino.Logger
  ) {
    this.config = config;
    this.db = db;
    this.parser = new EventParser();
    this.logger = logger.child({ service: 'indexer' });

    this.client = new TonClient({
      endpoint: config.tonApiEndpoint,
      apiKey: config.tonApiKey,
    });
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Indexer already running');
      return;
    }

    this.logger.info('Starting indexer service');
    this.isRunning = true;

    // Initial sync
    await this.syncBlocks();

    // Start polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.syncBlocks();
      } catch (error) {
        this.logger.error({ error }, 'Error during sync');
      }
    }, this.config.indexer.pollIntervalMs);

    this.logger.info('Indexer service started');
  }

  /**
   * Stop the indexer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping indexer service');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }

    this.logger.info('Indexer service stopped');
  }

  /**
   * Sync blocks from blockchain
   */
  private async syncBlocks(): Promise<void> {
    try {
      // Get latest indexed block
      const latestIndexed = this.db.getLatestBlockIndexed();

      // Get latest block from chain
      const latestBlock = await this.getLatestBlock();

      if (!latestBlock) {
        this.logger.warn('Could not fetch latest block');
        return;
      }

      this.logger.debug(
        { latestIndexed, latestChain: latestBlock.seqno },
        'Sync status'
      );

      // Determine start block
      const startBlock = Math.max(
        latestIndexed + 1,
        this.config.indexer.startBlock
      );

      // Don't sync blocks that aren't confirmed yet
      const confirmationBlocks = this.config.indexer.confirmationBlocks;
      const endBlock = latestBlock.seqno - confirmationBlocks;

      if (startBlock > endBlock) {
        this.logger.trace('No new confirmed blocks to sync');
        return;
      }

      // Sync in batches
      const batchSize = this.config.indexer.batchSize;
      for (
        let currentBlock = startBlock;
        currentBlock <= endBlock;
        currentBlock += batchSize
      ) {
        const batchEnd = Math.min(currentBlock + batchSize - 1, endBlock);
        await this.syncBlockRange(currentBlock, batchEnd);
      }

      // Mark older blocks as confirmed
      const confirmUpTo = endBlock - confirmationBlocks;
      if (confirmUpTo > 0) {
        this.db.markBlocksConfirmed(confirmUpTo);
      }
    } catch (error) {
      this.logger.error({ error }, 'Error syncing blocks');
      throw error;
    }
  }

  /**
   * Sync a range of blocks
   */
  private async syncBlockRange(
    startBlock: number,
    endBlock: number
  ): Promise<void> {
    this.logger.info({ startBlock, endBlock }, 'Syncing block range');

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      // Check for reorg before processing
      const reorgDetected = await this.detectAndHandleReorg(blockNum);
      if (reorgDetected) {
        this.logger.warn({ blockNum }, 'Reorg detected, resetting sync');
        return; // Will retry on next poll
      }

      // Fetch and process block
      await this.processBlock(blockNum);
    }
  }

  /**
   * Detect and handle blockchain reorganization
   */
  private async detectAndHandleReorg(blockNumber: number): Promise<boolean> {
    // Get stored block if exists
    const storedBlock = this.db.getBlock(blockNumber);
    if (!storedBlock) {
      return false; // No stored block, no reorg
    }

    // Fetch current block from chain
    const chainBlock = await this.getBlockByNumber(blockNumber);
    if (!chainBlock) {
      this.logger.warn({ blockNumber }, 'Could not fetch block from chain');
      return false;
    }

    // Compare hashes
    const chainHash = this.getBlockHash(chainBlock);
    if (storedBlock.block_hash !== chainHash) {
      this.logger.warn(
        {
          blockNumber,
          storedHash: storedBlock.block_hash,
          chainHash,
        },
        'Reorg detected - block hash mismatch'
      );

      // Handle reorg - delete from divergence point
      this.db.handleReorg(blockNumber);
      return true;
    }

    return false;
  }

  /**
   * Process a single block
   */
  private async processBlock(blockNumber: number): Promise<void> {
    try {
      const block = await this.getBlockByNumber(blockNumber);
      if (!block) {
        this.logger.warn({ blockNumber }, 'Block not found');
        return;
      }

      const blockHash = this.getBlockHash(block);
      const parentHash = this.getParentHash(block);
      const timestamp = this.getBlockTimestamp(block);
      const transactions = this.getBlockTransactions(block);

      // Store block
      this.db.insertBlock(
        blockNumber,
        blockHash,
        parentHash,
        timestamp,
        transactions.length
      );

      // Process transactions
      for (const tx of transactions) {
        await this.processTransaction(tx, blockNumber, timestamp);
      }

      // Update latest indexed
      this.db.updateLatestBlock(blockNumber, timestamp);

      this.logger.debug(
        { blockNumber, txCount: transactions.length },
        'Block processed'
      );
    } catch (error) {
      this.logger.error({ error, blockNumber }, 'Error processing block');
      throw error;
    }
  }

  /**
   * Process a transaction and extract events
   */
  private async processTransaction(
    transaction: any,
    blockNumber: number,
    timestamp: number
  ): Promise<void> {
    const txHash = this.getTransactionHash(transaction);

    // Check if transaction involves our tracked contracts
    const relevantContracts = [
      this.config.contracts.paymentHub,
      this.config.contracts.merchantPaymentHub,
      ...this.config.contracts.nftCollections,
    ].filter((addr) => addr !== '');

    const txDestination = this.getTransactionDestination(transaction);
    if (!relevantContracts.includes(txDestination)) {
      return; // Not relevant
    }

    // Parse events from transaction
    const events = this.parser.parseTransaction(transaction, txDestination);

    // Store events
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      this.storeEvent(event, blockNumber, txHash, i, timestamp);
    }
  }

  /**
   * Store event in database
   */
  private storeEvent(
    event: IndexedEvent,
    blockNumber: number,
    txHash: string,
    logIndex: number,
    timestamp: number
  ): void {
    try {
      switch (event.eventType) {
        case 'InternalTransfer':
          this.db.insertInternalTransfer({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            fromNft: event.fromNft,
            toNft: event.toNft,
            amountTbc: event.amountTbc.toString(),
            payloadHash: event.payloadHash,
          });
          break;

        case 'AccountStateChanged':
          this.db.insertAccountStateChange({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            nftAddress: event.nftAddress,
            oldState: event.oldState,
            newState: event.newState,
          });
          break;

        case 'MerchantPayment':
          this.db.insertMerchantPayment({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            payerNft: event.payerNft,
            merchantNft: event.merchantNft,
            amountTbc: event.amountTbc.toString(),
            payloadHash: event.payloadHash,
          });
          break;

        case 'NFTOwnershipChange':
          this.db.insertNFTOwnershipChange({
            blockNumber,
            transactionHash: txHash,
            logIndex,
            timestamp,
            nftAddress: event.nftAddress,
            collectionAddress: event.collectionAddress,
            oldOwner: event.oldOwner,
            newOwner: event.newOwner,
          });
          break;
      }
    } catch (error) {
      this.logger.error({ error, event }, 'Error storing event');
    }
  }

  /**
   * Get latest block from chain
   */
  private async getLatestBlock(): Promise<any> {
    try {
      return await this.client.getMasterchainInfo();
    } catch (error) {
      this.logger.error({ error }, 'Error fetching latest block');
      throw error;
    }
  }

  /**
   * Get block by number
   */
  private async getBlockByNumber(blockNumber: number): Promise<any> {
    try {
      // TonClient doesn't have direct block-by-number API
      // In production, this would use appropriate TON API method
      // For now, return placeholder
      return null;
    } catch (error) {
      this.logger.error({ error, blockNumber }, 'Error fetching block');
      throw error;
    }
  }

  // Helper methods to extract block data
  // These depend on actual TON block structure

  private getBlockHash(block: any): string {
    return block.id?.root_hash || '';
  }

  private getParentHash(block: any): string {
    return block.id?.prev_root_hash || '';
  }

  private getBlockTimestamp(block: any): number {
    return block.now || 0;
  }

  private getBlockTransactions(block: any): any[] {
    return block.transactions || [];
  }

  private getTransactionHash(transaction: any): string {
    return transaction.hash || '';
  }

  private getTransactionDestination(transaction: any): string {
    return transaction.destination || '';
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    latestBlockIndexed: number;
    isRunning: boolean;
  } {
    return {
      latestBlockIndexed: this.db.getLatestBlockIndexed(),
      isRunning: this.isRunning,
    };
  }
}
