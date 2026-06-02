-- Roll back account-history cursor indexes.

DROP INDEX IF EXISTS idx_account_state_changes_history_cursor;
DROP INDEX IF EXISTS idx_merchant_payments_merchant_history_cursor;
DROP INDEX IF EXISTS idx_merchant_payments_payer_history_cursor;
DROP INDEX IF EXISTS idx_internal_transfers_to_history_cursor;
DROP INDEX IF EXISTS idx_internal_transfers_from_history_cursor;
