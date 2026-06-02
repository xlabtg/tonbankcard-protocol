-- Migration 003_chain_seqno (SQLite dialect)
-- Persists the latest observed masterchain head seqno alongside the resume
-- cursor so confirmation depth can be derived from one canonical value
-- (`latest_chain_seqno - block_number`) by both the indexer and the API.
-- See INDEXER-H1 (issue #254) and docs/REORG_HANDLING.md §3.

ALTER TABLE indexer_state ADD COLUMN latest_chain_seqno INTEGER NOT NULL DEFAULT 0;
