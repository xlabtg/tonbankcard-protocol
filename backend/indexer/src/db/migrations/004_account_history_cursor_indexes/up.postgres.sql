-- Migration 004_account_history_cursor_indexes (PostgreSQL dialect)
-- Adds account-history indexes matching the stable keyset sort:
-- timestamp DESC, transaction_hash ASC, log_index ASC.

CREATE INDEX IF NOT EXISTS idx_internal_transfers_from_history_cursor
  ON internal_transfers(from_nft, timestamp DESC, transaction_hash ASC, log_index ASC);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_to_history_cursor
  ON internal_transfers(to_nft, timestamp DESC, transaction_hash ASC, log_index ASC);

CREATE INDEX IF NOT EXISTS idx_merchant_payments_payer_history_cursor
  ON merchant_payments(payer_nft, timestamp DESC, transaction_hash ASC, log_index ASC);
CREATE INDEX IF NOT EXISTS idx_merchant_payments_merchant_history_cursor
  ON merchant_payments(merchant_nft, timestamp DESC, transaction_hash ASC, log_index ASC);

CREATE INDEX IF NOT EXISTS idx_account_state_changes_history_cursor
  ON account_state_changes(nft_address, timestamp DESC, transaction_hash ASC, log_index ASC);
