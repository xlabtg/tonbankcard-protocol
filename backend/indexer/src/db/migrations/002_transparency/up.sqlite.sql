-- Migration 002_transparency (SQLite dialect)
-- Adds tables that mirror the three E4 monthly aggregate events emitted by
-- TransparencyRegistry.tact (ProtocolMetricsRecorded, LockActivityRecorded,
-- ParameterChangeRecorded). See docs/governance/TRANSPARENCY_REPORTING.md §3.1.
--
-- All DDL is idempotent. Schema mirrors on-chain aggregate structs and is
-- privacy-preserving by construction: cohort counters only, no addresses,
-- no per-account state.

-- Monthly protocol-metrics checkpoints.
CREATE TABLE IF NOT EXISTS transparency_protocol_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  active_accounts INTEGER NOT NULL,
  tbc_volume_transferred TEXT NOT NULL,
  transfer_count INTEGER NOT NULL,
  UNIQUE(transaction_hash, log_index),
  UNIQUE(period_start, period_end),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transparency_metrics_period_end
  ON transparency_protocol_metrics(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_transparency_metrics_block
  ON transparency_protocol_metrics(block_number);

-- Monthly lock-activity checkpoints.
CREATE TABLE IF NOT EXISTS transparency_lock_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  locks_set INTEGER NOT NULL,
  locks_cleared INTEGER NOT NULL,
  locks_active INTEGER NOT NULL,
  appeals_filed INTEGER NOT NULL,
  appeals_overturned INTEGER NOT NULL,
  appeals_upheld INTEGER NOT NULL,
  UNIQUE(transaction_hash, log_index),
  UNIQUE(period_start, period_end),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transparency_lock_period_end
  ON transparency_lock_activity(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_transparency_lock_block
  ON transparency_lock_activity(block_number);

-- Append-only parameter-change audit trail.
CREATE TABLE IF NOT EXISTS transparency_parameter_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  parameter_id TEXT NOT NULL,
  old_value_hash TEXT NOT NULL,
  new_value_hash TEXT NOT NULL,
  effective_block INTEGER NOT NULL,
  governance_proposal_id INTEGER,
  UNIQUE(transaction_hash, log_index),
  FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transparency_param_effective_block
  ON transparency_parameter_changes(effective_block DESC);
CREATE INDEX IF NOT EXISTS idx_transparency_param_id
  ON transparency_parameter_changes(parameter_id);
CREATE INDEX IF NOT EXISTS idx_transparency_param_proposal
  ON transparency_parameter_changes(governance_proposal_id);
