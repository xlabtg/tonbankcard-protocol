-- Rollback for migration 001_initial (SQLite dialect)
-- Drops every object created by up.sqlite.sql, in reverse FK order.
--
-- Indexes attached to a table are dropped automatically when the table
-- is dropped, so this script only lists DROP TABLE statements.

DROP TABLE IF EXISTS invoice_mappings;
DROP TABLE IF EXISTS account_snapshots;
DROP TABLE IF EXISTS nft_ownership_changes;
DROP TABLE IF EXISTS account_state_changes;
DROP TABLE IF EXISTS merchant_payments;
DROP TABLE IF EXISTS internal_transfers;
DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS indexer_state;
