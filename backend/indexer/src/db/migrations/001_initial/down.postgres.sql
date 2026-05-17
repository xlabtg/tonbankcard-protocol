-- Rollback for migration 001_initial (PostgreSQL dialect)
-- Drops every object created by up.postgres.sql, in reverse FK order.
--
-- DROP TABLE … CASCADE removes dependent FK constraints automatically.

DROP TABLE IF EXISTS invoice_mappings CASCADE;
DROP TABLE IF EXISTS account_snapshots CASCADE;
DROP TABLE IF EXISTS nft_ownership_changes CASCADE;
DROP TABLE IF EXISTS account_state_changes CASCADE;
DROP TABLE IF EXISTS merchant_payments CASCADE;
DROP TABLE IF EXISTS internal_transfers CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS indexer_state CASCADE;
