-- Migration 003_chain_seqno (PostgreSQL dialect)
-- Persists the latest observed masterchain head seqno alongside the resume
-- cursor so confirmation depth can be derived from one canonical value
-- (`latest_chain_seqno - block_number`) by both the indexer and the API.
-- See INDEXER-H1 (issue #254) and docs/REORG_HANDLING.md §3.

ALTER TABLE indexer_state ADD COLUMN IF NOT EXISTS latest_chain_seqno BIGINT NOT NULL DEFAULT 0;
