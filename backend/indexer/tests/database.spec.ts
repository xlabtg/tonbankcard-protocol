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

    it('should return events sorted by timestamp descending', () => {
      const history = db.getAccountHistory('EQA...', 10, 0);

      for (let i = 1; i < history.events.length; i++) {
        expect(history.events[i - 1].timestamp).toBeGreaterThanOrEqual(history.events[i].timestamp);
      }
    });

    it('should return correct event types', () => {
      const history = db.getAccountHistory('EQA...', 10, 0);

      const eventTypes = history.events.map((e) => e.eventType);
      expect(eventTypes).toContain('transfer');
      expect(eventTypes).toContain('payment');
    });

    it('should respect limit parameter', () => {
      // Insert 5 more events to ensure we have more than 1
      for (let i = 3; i <= 7; i++) {
        db.insertBlock(i, `hash${i}`, `hash${i - 1}`, i * 1000, 1);
        db.insertInternalTransfer({
          blockNumber: i,
          transactionHash: `tx_limit_${i}`,
          logIndex: 0,
          timestamp: i * 1000,
          fromNft: 'EQA...',
          toNft: 'EQZ...',
          amountTbc: '100',
          payloadHash: `0xabc${i}`,
        });
      }

      const history = db.getAccountHistory('EQA...', 3, 0);
      expect(history.events.length).toBe(3);
    });

    it('should support offset-based pagination', () => {
      for (let i = 3; i <= 7; i++) {
        db.insertBlock(i, `hash${i}`, `hash${i - 1}`, i * 1000, 1);
        db.insertInternalTransfer({
          blockNumber: i,
          transactionHash: `tx_page_${i}`,
          logIndex: 0,
          timestamp: i * 1000,
          fromNft: 'EQA...',
          toNft: 'EQZ...',
          amountTbc: '100',
          payloadHash: `0xpag${i}`,
        });
      }

      const page1 = db.getAccountHistory('EQA...', 3, 0);
      const page2 = db.getAccountHistory('EQA...', 3, 3);

      // Pages should not overlap
      const page1Hashes = page1.events.map((e) => e.transactionHash);
      const page2Hashes = page2.events.map((e) => e.transactionHash);
      const overlap = page1Hashes.filter((h) => page2Hashes.includes(h));
      expect(overlap.length).toBe(0);
    });

    it('should support keyset pagination with beforeTimestamp', () => {
      for (let i = 3; i <= 7; i++) {
        db.insertBlock(i, `hash${i}`, `hash${i - 1}`, i * 1000, 1);
        db.insertInternalTransfer({
          blockNumber: i,
          transactionHash: `tx_keyset_${i}`,
          logIndex: 0,
          timestamp: i * 1000,
          fromNft: 'EQA...',
          toNft: 'EQZ...',
          amountTbc: '100',
          payloadHash: `0xkey${i}`,
        });
      }

      const allEvents = db.getAccountHistory('EQA...', 100, 0);
      expect(allEvents.events.length).toBeGreaterThan(0);

      // Get the last event from the first page
      const firstPage = db.getAccountHistory('EQA...', 3, 0);
      const lastTimestamp = firstPage.events[firstPage.events.length - 1].timestamp;

      // Keyset page should start after that timestamp
      const nextPage = db.getAccountHistory('EQA...', 10, 0, lastTimestamp);
      for (const event of nextPage.events) {
        expect(event.timestamp).toBeLessThan(lastTimestamp);
      }
    });

    it('should return correct totalCount', () => {
      const history = db.getAccountHistory('EQA...', 1, 0);
      // totalCount should reflect all matching events, not just the page
      expect(history.totalCount).toBeGreaterThanOrEqual(history.events.length);
      expect(history.totalCount).toBe(2); // 1 transfer + 1 payment for EQA...
    });

    it('should return empty result for unknown account', () => {
      const history = db.getAccountHistory('UNKNOWN_NFT', 10, 0);
      expect(history.events.length).toBe(0);
      expect(history.totalCount).toBe(0);
    });

    it('should include state_change events', () => {
      db.insertAccountStateChange({
        blockNumber: 1,
        transactionHash: 'tx_state',
        logIndex: 5,
        timestamp: 1500,
        nftAddress: 'EQA...',
        oldState: AccountState.ACTIVE,
        newState: AccountState.FROZEN,
      });

      const history = db.getAccountHistory('EQA...', 10, 0);
      const stateChangeEvents = history.events.filter((e) => e.eventType === 'state_change');
      expect(stateChangeEvents.length).toBeGreaterThan(0);
      expect(stateChangeEvents[0].details.oldState).toBe(AccountState.ACTIVE);
      expect(stateChangeEvents[0].details.newState).toBe(AccountState.FROZEN);
    });

    it('should cache repeated queries and return same result', () => {
      const first = db.getAccountHistory('EQA...', 10, 0);
      const second = db.getAccountHistory('EQA...', 10, 0);
      expect(second).toBe(first); // same object reference from cache
    });

    it('should invalidate cache after new event insertion', () => {
      const before = db.getAccountHistory('EQA...', 10, 0);

      db.insertBlock(3, 'hash3', 'hash2', 3000, 1);
      db.insertInternalTransfer({
        blockNumber: 3,
        transactionHash: 'tx_new',
        logIndex: 0,
        timestamp: 3000,
        fromNft: 'EQA...',
        toNft: 'EQZ...',
        amountTbc: '999',
        payloadHash: '0xnew',
      });

      const after = db.getAccountHistory('EQA...', 10, 0);
      expect(after).not.toBe(before); // different object - cache was invalidated
      expect(after.totalCount).toBeGreaterThan(before.totalCount);
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

  // Regression coverage for INDEXER-C1: a reorg rollback must reconcile
  // account_snapshots, never leave them reflecting reverted (deleted) events.
  describe('Reorg snapshot reconciliation (INDEXER-C1)', () => {
    it('should revert state_change snapshot to canonical state after reorg', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 1);

      // Block 1: account becomes FROZEN (canonical).
      db.insertAccountStateChange({
        blockNumber: 1,
        transactionHash: 'tx_freeze',
        logIndex: 0,
        timestamp: 1000,
        nftAddress: 'EQA...',
        oldState: AccountState.ACTIVE,
        newState: AccountState.FROZEN,
      });

      // Block 2: account becomes ACTIVE again (gets reverted by the reorg).
      db.insertAccountStateChange({
        blockNumber: 2,
        transactionHash: 'tx_unfreeze',
        logIndex: 0,
        timestamp: 2000,
        nftAddress: 'EQA...',
        oldState: AccountState.FROZEN,
        newState: AccountState.ACTIVE,
      });

      // Before reorg the snapshot reflects block 2.
      expect(db.getAccountSnapshot('EQA...')?.current_state).toBe(AccountState.ACTIVE);
      expect(db.getAccountSnapshot('EQA...')?.last_state_change_block).toBe(2);

      // Reorg drops block 2.
      db.handleReorg(2);

      // Snapshot must now reflect the surviving canonical state (block 1, FROZEN).
      const snapshot = db.getAccountSnapshot('EQA...');
      expect(snapshot?.current_state).toBe(AccountState.FROZEN);
      expect(snapshot?.last_state_change_block).toBe(1);
    });

    it('should revert ownership snapshot to canonical owner after reorg', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 1);

      db.insertNFTOwnershipChange({
        blockNumber: 1,
        transactionHash: 'tx_own1',
        logIndex: 0,
        timestamp: 1000,
        nftAddress: 'EQA...',
        collectionAddress: 'EQC...',
        oldOwner: null,
        newOwner: 'OWNER_1',
      });

      db.insertNFTOwnershipChange({
        blockNumber: 2,
        transactionHash: 'tx_own2',
        logIndex: 0,
        timestamp: 2000,
        nftAddress: 'EQA...',
        collectionAddress: 'EQC...',
        oldOwner: 'OWNER_1',
        newOwner: 'OWNER_2',
      });

      expect(db.getAccountSnapshot('EQA...')?.current_owner).toBe('OWNER_2');

      db.handleReorg(2);

      expect(db.getAccountSnapshot('EQA...')?.current_owner).toBe('OWNER_1');
    });

    it('should roll back last_transfer_block after reorg', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 1);

      db.insertInternalTransfer({
        blockNumber: 1,
        transactionHash: 'tx_t1',
        logIndex: 0,
        timestamp: 1000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '100',
        payloadHash: '0x1',
      });

      db.insertInternalTransfer({
        blockNumber: 2,
        transactionHash: 'tx_t2',
        logIndex: 0,
        timestamp: 2000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '200',
        payloadHash: '0x2',
      });

      expect(db.getAccountSnapshot('EQA...')?.last_transfer_block).toBe(2);

      db.handleReorg(2);

      expect(db.getAccountSnapshot('EQA...')?.last_transfer_block).toBe(1);
    });

    it('should clear snapshots for NFTs with no surviving events', () => {
      db.insertBlock(5, 'hash5', 'hash4', 5000, 1);

      db.insertNFTOwnershipChange({
        blockNumber: 5,
        transactionHash: 'tx_only',
        logIndex: 0,
        timestamp: 5000,
        nftAddress: 'EQA...',
        collectionAddress: 'EQC...',
        oldOwner: null,
        newOwner: 'OWNER_1',
      });
      db.insertAccountStateChange({
        blockNumber: 5,
        transactionHash: 'tx_only_state',
        logIndex: 1,
        timestamp: 5000,
        nftAddress: 'EQA...',
        oldState: AccountState.ACTIVE,
        newState: AccountState.FROZEN,
      });

      expect(db.getAccountSnapshot('EQA...')).toBeDefined();

      // Reorg removes the only block holding this NFT's events.
      db.handleReorg(5);

      // Snapshot must be cleared, not left reflecting reverted state.
      expect(db.getAccountSnapshot('EQA...')).toBeUndefined();
    });

    it('should serve post-reorg canonical state via getAccountHistory and snapshot', () => {
      db.insertBlock(1, 'hash1', 'hash0', 1000, 1);
      db.insertBlock(2, 'hash2', 'hash1', 2000, 1);
      db.insertBlock(3, 'hash3', 'hash2', 3000, 1);

      // Canonical (survives): freeze at block 1.
      db.insertAccountStateChange({
        blockNumber: 1,
        transactionHash: 'tx_a',
        logIndex: 0,
        timestamp: 1000,
        nftAddress: 'EQA...',
        oldState: AccountState.ACTIVE,
        newState: AccountState.FROZEN,
      });
      // Reverted: unfreeze + transfer in blocks 2-3.
      db.insertAccountStateChange({
        blockNumber: 2,
        transactionHash: 'tx_b',
        logIndex: 0,
        timestamp: 2000,
        nftAddress: 'EQA...',
        oldState: AccountState.FROZEN,
        newState: AccountState.ACTIVE,
      });
      db.insertInternalTransfer({
        blockNumber: 3,
        transactionHash: 'tx_c',
        logIndex: 0,
        timestamp: 3000,
        fromNft: 'EQA...',
        toNft: 'EQB...',
        amountTbc: '100',
        payloadHash: '0x9',
      });

      db.handleReorg(2);

      // Snapshot reflects canonical state.
      const snapshot = db.getAccountSnapshot('EQA...');
      expect(snapshot?.current_state).toBe(AccountState.FROZEN);
      expect(snapshot?.last_transfer_block).toBeNull();
      expect(snapshot?.last_state_change_block).toBe(1);

      // History only contains the surviving event.
      const history = db.getAccountHistory('EQA...', 100, 0);
      expect(history.totalCount).toBe(1);
      expect(history.events[0].eventType).toBe('state_change');
      expect(history.events[0].blockNumber).toBe(1);
    });
  });
});
