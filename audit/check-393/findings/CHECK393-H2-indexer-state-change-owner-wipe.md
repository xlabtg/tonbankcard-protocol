---
title: insertAccountStateChange uses 4-column INSERT OR REPLACE and wipes current_owner / last_transfer_block to NULL on every state-change event
severity: High
area: backend
priority: high
stage: 2-high
labels:
  - bug
  - audit
  - type:backend
  - type:security
  - priority:high
  - stage:2-high
  - package:indexer
  - track:A
---

## Summary

In the indexer, `insertAccountStateChange` updates the `account_snapshots` row
for an NFT with a four-column `INSERT OR REPLACE`. In SQLite `INSERT OR REPLACE`
is *delete-then-insert*: the existing row is removed and a new one is created
with only the listed columns set, so every column **not** listed reverts to its
schema default. `account_snapshots.current_owner` and `last_transfer_block`
have no default (NULL), so each state-change event **wipes the account's owner
and last-transfer block to NULL**, destroying ownership state that
`insertNFTOwnershipChange` had previously recorded. The account-history /
snapshot API then reports `owner: null` for an account that demonstrably has an
owner on-chain.

## Severity & Category

- Severity: High
- Category: Data integrity / read-model corruption (security-relevant —
  ownership is the protocol's sole authority signal)

The blockchain is the single source of truth; indexed state must mirror it.
This bug makes the indexed owner durably diverge from on-chain truth on the
**normal ingestion path** (not only on reorg), for any account that receives a
state-change event after a transfer.

## Affected Code

- `backend/indexer/src/db/database.ts:458-465` (`insertAccountStateChange` —
  `INSERT OR REPLACE INTO account_snapshots (nft_address, current_state, last_state_change_block, last_updated)`)
- `backend/indexer/src/db/database.ts:506-514` (`insertNFTOwnershipChange` — the
  **correct** sibling using `ON CONFLICT(nft_address) DO UPDATE`)
- `backend/indexer/src/db/database.ts:523-540` (`updateAccountSnapshot` — also
  correct, `INSERT OR IGNORE` + `UPDATE`)
- `backend/indexer/src/db/migrations/001_initial/up.sqlite.sql:114-121` and
  `up.postgres.sql:114-121` (`account_snapshots`: `current_owner` /
  `last_transfer_block` have no default → NULL)
- `backend/indexer/src/api/routes.ts:408` (`owner: snapshot?.current_owner || null`
  surfaces the wiped value)

## Description

The three writers to `account_snapshots` are inconsistent. The ownership and
transfer-block writers preserve sibling columns:

```ts
// insertNFTOwnershipChange (correct): preserves current_state, last_state_change_block
INSERT OR REPLACE INTO account_snapshots (nft_address, current_owner, last_updated)
VALUES (?, ?, ?)
ON CONFLICT(nft_address) DO UPDATE SET current_owner = ?, last_updated = ?
```

but the state-change writer does not:

```ts
// insertAccountStateChange (buggy): delete-then-insert drops current_owner & last_transfer_block
INSERT OR REPLACE INTO account_snapshots
  (nft_address, current_state, last_state_change_block, last_updated)
VALUES (?, ?, ?, ?)
```

Event ordering makes this concrete: a transfer event sets `current_owner`; a
later state-change event for the same NFT replaces the row and `current_owner`
becomes NULL again. Because the bug is on the steady-state ingestion path, it
fires for ordinary on-chain activity, not just reorgs. This is **distinct**
from `INDEXER-C1` (reorg path — `handleReorg` never touching snapshots) and
`INDEXER-M5` (transparency `INSERT OR IGNORE`). The asymmetry between the three
sibling writers in the same file is what marks this as a defect rather than a
design choice.

A self-contained reproduction (better-sqlite3, in-memory) is included at
`experiments/repro-snapshot-owner-wipe.mjs`: it records an owner via the
ownership writer, then ingests one state-change event, and observes
`current_owner` and `last_transfer_block` reset to NULL.

## Impact

- The snapshot / account-history API returns `owner: null` for accounts that
  have a real on-chain owner, after any state-change following a transfer.
- Off-chain consumers that rely on the indexer to display or pre-check current
  ownership (dashboards, UIs, eligibility tooling) see corrupted data.
- No fund-safety impact (the indexer cannot move funds), but it is a durable,
  high-frequency correctness defect in a security-relevant read model.

## Suggested Fix

- Rewrite `insertAccountStateChange` to use the same column-preserving pattern
  as `insertNFTOwnershipChange`:
  `INSERT INTO account_snapshots (nft_address, current_state, last_state_change_block, last_updated) VALUES (?,?,?,?) ON CONFLICT(nft_address) DO UPDATE SET current_state = excluded.current_state, last_state_change_block = excluded.last_state_change_block, last_updated = excluded.last_updated`.
- Audit every `INSERT OR REPLACE` against tables whose rows are built up by
  multiple writers; prefer `ON CONFLICT ... DO UPDATE` with an explicit column
  list anywhere partial updates occur.

## Acceptance Criteria

- [ ] Ingesting a state-change event preserves a previously recorded
      `current_owner` and `last_transfer_block`.
- [ ] `insertAccountStateChange` no longer uses a column-truncating
      `INSERT OR REPLACE`.
- [ ] Regression test: record owner → ingest state change → assert owner and
      last_transfer_block are unchanged (mirrors
      `experiments/repro-snapshot-owner-wipe.mjs`).
- [ ] Fix verified on both the SQLite and PostgreSQL drivers.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/393
- Reproduction: `experiments/repro-snapshot-owner-wipe.mjs`
- Related but distinct: `audit/findings/INDEXER-C1-reorg-rollback-stale-account-snapshots.md`,
  `audit/findings/INDEXER-M5-transparency-insert-or-ignore-drops-corrections.md`
- `audit/INVARIANTS.md`

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/396
