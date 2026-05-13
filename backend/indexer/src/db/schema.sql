-- Tonbankcard Payment Indexer Database Schema
-- Read-only indexer for on-chain events
-- All data is derived from blockchain state - this is NOT the source of truth

-- Indexer metadata and reorg handling
CREATE TABLE IF NOT EXISTS indexer_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table
  latest_block_indexed INTEGER NOT NULL DEFAULT 0,
  latest_block_timestamp INTEGER NOT NULL DEFAULT 0,
  last_update_time INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '1.0.0'
);

-- Blocks table for reorg detection
CREATE TABLE IF NOT EXISTS blocks (
  block_number INTEGER PRIMARY KEY,
  block_hash TEXT NOT NULL UNIQUE,
  parent_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  indexed_at INTEGER NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT 0 -- Confirmed after N blocks
);

CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_blocks_confirmed ON blocks(confirmed);

-- Internal transfer events from PaymentHub
CREATE TABLE IF NOT EXISTS internal_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  from_nft TEXT NOT NULL,
  to_nft TEXT NOT NULL,
  amount_tbc TEXT NOT NULL, -- Store as string to avoid bigint issues
  payload_hash TEXT NOT NULL,
  UNIQUE(transaction_hash, log_index),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_internal_transfers_from ON internal_transfers(from_nft);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_to ON internal_transfers(to_nft);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_timestamp ON internal_transfers(timestamp);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_payload_hash ON internal_transfers(payload_hash);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_from_ts ON internal_transfers(from_nft, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_to_ts ON internal_transfers(to_nft, timestamp DESC);

-- Merchant payment events from MerchantPaymentHub
CREATE TABLE IF NOT EXISTS merchant_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  payer_nft TEXT NOT NULL,
  merchant_nft TEXT NOT NULL,
  amount_tbc TEXT NOT NULL, -- Store as string
  payload_hash TEXT NOT NULL,
  UNIQUE(transaction_hash, log_index),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_merchant_payments_payer ON merchant_payments(payer_nft);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_merchant ON merchant_payments(merchant_nft);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_timestamp ON merchant_payments(timestamp);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_payload_hash ON merchant_payments(payload_hash);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_payer_ts ON merchant_payments(payer_nft, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_merchant_ts ON merchant_payments(merchant_nft, timestamp DESC);

-- Account state change events
CREATE TABLE IF NOT EXISTS account_state_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  nft_address TEXT NOT NULL,
  old_state INTEGER NOT NULL, -- 0=ACTIVE, 1=FROZEN, 2=COLLATERAL_LOCKED, 3=CLOSED
  new_state INTEGER NOT NULL,
  UNIQUE(transaction_hash, log_index),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_state_changes_nft ON account_state_changes(nft_address);
CREATE INDEX IF NOT EXISTS idx_account_state_changes_timestamp ON account_state_changes(timestamp);
CREATE INDEX IF NOT EXISTS idx_account_state_changes_nft_ts ON account_state_changes(nft_address, timestamp DESC);

-- NFT ownership changes
CREATE TABLE IF NOT EXISTS nft_ownership_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  nft_address TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  old_owner TEXT, -- NULL for minting
  new_owner TEXT NOT NULL,
  UNIQUE(transaction_hash, log_index),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nft_ownership_nft ON nft_ownership_changes(nft_address);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_new_owner ON nft_ownership_changes(new_owner);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_timestamp ON nft_ownership_changes(timestamp);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_collection ON nft_ownership_changes(collection_address);

-- Current account snapshots (materialized view for fast queries)
-- This is updated as events are processed
CREATE TABLE IF NOT EXISTS account_snapshots (
  nft_address TEXT PRIMARY KEY,
  current_owner TEXT,
  current_state INTEGER NOT NULL DEFAULT 0, -- ACTIVE by default
  last_transfer_block INTEGER,
  last_state_change_block INTEGER,
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_owner ON account_snapshots(current_owner);
CREATE INDEX IF NOT EXISTS idx_account_snapshots_state ON account_snapshots(current_state);

-- Invoice ID to payment hash mapping (for invoice lookups)
-- This maps invoice IDs from payload hashes to transactions
CREATE TABLE IF NOT EXISTS invoice_mappings (
  invoice_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_mappings_payload_hash ON invoice_mappings(payload_hash);
CREATE INDEX IF NOT EXISTS idx_invoice_mappings_tx_hash ON invoice_mappings(transaction_hash);

-- Initialize indexer_state if empty
INSERT OR IGNORE INTO indexer_state (id, latest_block_indexed, latest_block_timestamp, last_update_time, version)
VALUES (1, 0, 0, 0, '1.0.0');
