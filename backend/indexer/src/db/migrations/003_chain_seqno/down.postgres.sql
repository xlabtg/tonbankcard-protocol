-- Rollback for migration 003_chain_seqno (PostgreSQL dialect)
-- Drops the masterchain head seqno column added by up.postgres.sql.

ALTER TABLE indexer_state DROP COLUMN IF EXISTS latest_chain_seqno;
