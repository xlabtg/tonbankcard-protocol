-- Rollback for migration 003_chain_seqno (SQLite dialect)
-- Drops the masterchain head seqno column added by up.sqlite.sql.
-- DROP COLUMN requires SQLite >= 3.35.0 (bundled with better-sqlite3).

ALTER TABLE indexer_state DROP COLUMN latest_chain_seqno;
