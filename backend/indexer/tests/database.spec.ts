// Database tests for Payment Status Indexer

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { IndexerDatabase } from '../src/db/database';
import { AccountState } from '../src/types/events';

describe('IndexerDatabase', () => {
  let db: IndexerDatabase;
  const testDbPath = path.join(__dirname, 'test-indexer.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }

    db = new IndexerDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = testDbPath + '-wal';
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const latestBlock = db.getLatestBlockIndexed();
      expect(latestBlock).toBe(0);
    });

    it('should create schema tables', () => {
      // Try inserting a block - should not throw
      expect(() => {
        db.insertBlock(1, 'hash1', 'hash0', 1000, 5);
      }).not.toThrow();
    });
  });

  describe('Block Operations', () => {
    it('should insert and retrieve blocks', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 5);

      const block = db.getBlock(1);
      expect(block).toBeDefined();
      expect(block?.block_number).toBe(1);
      expect(block?.block_hash).toBe('hash1');
      expect(block?.parent_hash).toBe('hash0');
      expect(block?.timestamp).toBe(1000);
      expect(block?.transaction_count).toBe(5);
      expect(block?.confirmed).toBe(false);
    });

    it('should update latest block indexed', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 5);
      db.updateLatestBlock(1, 1000);

      const latestBlock = db.getLatestBlockIndexed();
      expect(latestBlock).toBe(1);
    });

    it('should mark blocks as confirmed', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 5);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 3);
      db.insertBlock(3, 'hash3', 'hash2', 3000, 2);

      db.markBlocksConfirmed(2);

      const block1 = db.getBlock(1);
      const block2 = db.getBlock(2);
      const block3 = db.getBlock(3);

      expect(block1?.confirmed).toBe(true);
      expect(block2?.confirmed).toBe(true);
      expect(block3?.confirmed).toBe(false);
    });

    it('should detect reorg', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 5);

      const isReorg = db.detectReorg(1, 'different_hash');
      expect(isReorg).toBe(true);

      const notReorg = db.detectReorg(1, 'hash1');
      expect(notReorg).toBe(false);
    });

    it('should handle reorg', () => {
      // Insert blocks 1-5
      for (let i = 1; i <= 5; i++) {
        db.insertBlock(i, `hash${i}`, `hash${i - 1}`, i * 1000, 1);
      }
      db.updateLatestBlock(5, 5000);

      // Handle reorg from block 3
      db.handleReorg(3);

      // Blocks 3-5 should be deleted
      expect(db.getBlock(1)).toBeDefined();
      expect(db.getBlock(2)).toBeDefined();
      expect(db.getBlock(3)).toBeNull();
      expect(db.getBlock(4)).toBeNull();
      expect(db.getBlock(5)).toBeNull();

      // Latest block should be rolled back
      const latestBlock = db.getLatestBlockIndexed();
      expect(latestBlock).toBe(2);
    });
  });

  describe('Event Operations', () => {
    beforeEach(() => {
      // Insert a test block
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
    });

    it('should insert internal transfer', () => {
      expect(() => {
        db.insertInternalTransfer({
          blockNumber: 1,
          transactionHash: 'tx1',
          logIndex: 0,
          timestamp: 1000,
          fromNft: 'EQA...',
          toNft: 'EQB...',
          amountTbc: '1000000000',
          payloadHash: '0x123',
        });
      }).not.toThrow();
    });

    it('should insert merchant payment', () => {
      expect(() => {
        db.insertMerchantPayment({
          blockNumber: 1,
          transactionHash: 'tx1',
          logIndex: 0,
          timestamp: 1000,
          payerNft: 'EQA...',
          merchantNft: 'EQB...',
          amountTbc: '1000000000',
          payloadHash: '0x123',
        });
      }).not.toThrow();
    });

    it('should insert account state change', () => {
      expect(() => {
        db.insertAccountStateChange({
          blockNumber: 1,
          transactionHash: 'tx1',
          logIndex: 0,
          timestamp: 1000,
          nftAddress: 'EQA...',
          oldState: AccountState.ACTIVE,
          newState: AccountState.FROZEN,
        });
      }).not.toThrow();
    });

    it('should insert NFT ownership change', () => {
      expect(() => {
        db.insertNFTOwnershipChange({
          blockNumber: 1,
          transactionHash: 'tx1',
          logIndex: 0,
          timestamp: 1000,
          nftAddress: 'EQA...',
          collectionAddress: 'EQC...',
          oldOwner: null,
          newOwner: 'EQD...',
        });
      }).not.toThrow();
    });

    it('should prevent duplicate events', () => {
      const event = {
        blockNumber: 1,
        transactionHash: 'tx1',
        logIndex: 0,
        timestamp: 1000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '1000000000',
        payloadHash: '0x123',
      };

      db.insertInternalTransfer(event);
      db.insertInternalTransfer(event); // Should be ignored (OR IGNORE)

      const eventCount = db.getEventCount();
      expect(eventCount).toBe(1); // Only one event stored
    });

    it('should cascade delete events when block is deleted', () => {
      db.insertInternalTransfer({
        blockNumber: 1,
        transactionHash: 'tx1',
        logIndex: 0,
        timestamp: 1000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '1000000000',
        payloadHash: '0x123',
      });

      expect(db.getEventCount()).toBe(1);

      // Delete the block
      db.handleReorg(1);

      // Event should be deleted
      expect(db.getEventCount()).toBe(0);
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 1);

      // Insert test events
      db.insertInternalTransfer({
        blockNumber: 1,
        transactionHash: 'tx1',
        logIndex: 0,
        timestamp: 1000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '1000000000',
        payloadHash: '0x123',
      });

      db.insertMerchantPayment({
        blockNumber: 2,
        transactionHash: 'tx2',
        logIndex: 0,
        timestamp: 2000,
        payerNft: 'EQA...',
        merchantNft: 'EQC...',
        amountTbc: '500000000',
        payloadHash: '0x456',
      });
    });

    it('should get account history', () => {
      const history = db.getAccountHistory('EQA...', 10, 0);

      expect(history.events.length).toBeGreaterThan(0);
      expect(history.totalCount).toBeGreaterThan(0);
    });

    it('should get payment by payload hash', () => {
      const payment = db.getPaymentByPayloadHash('0x456');

      expect(payment).toBeDefined();
      expect(payment.payer_nft).toBe('EQA...');
      expect(payment.merchant_nft).toBe('EQC...');
      expect(payment.amount_tbc).toBe('500000000');
    });

    it('should get account snapshot', () => {
      // Insert ownership change to create snapshot
      db.insertNFTOwnershipChange({
        blockNumber: 1,
        transactionHash: 'tx1',
        logIndex: 1,
        timestamp: 1000,
        nftAddress: 'EQA...',
        collectionAddress: 'EQC...',
        oldOwner: null,
        newOwner: 'EQD...',
      });

      const snapshot = db.getAccountSnapshot('EQA...');

      expect(snapshot).toBeDefined();
      expect(snapshot?.nft_address).toBe('EQA...');
      expect(snapshot?.current_owner).toBe('EQD...');
    });

    it('should get event count', () => {
      const count = db.getEventCount();
      expect(count).toBe(2); // 1 transfer + 1 payment
    });
  });
});
