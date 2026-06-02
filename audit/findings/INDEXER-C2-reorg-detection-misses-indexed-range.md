---
title: "[INDEXER-C2] Reorg detection never fires for already-indexed blocks"
severity: critical
area: backend
priority: critical
stage: 1
labels: ["bug","audit","type:backend","type:security","priority:critical","stage:1-critical"]
---

## Summary

Reorg detection only runs for blocks the indexer is about to process for the first time, and returns "no reorg" whenever there is no stored block. Because the cursor only ever moves forward, already-indexed blocks are never revisited, so a reorg that rewrites a block already in the database is never detected and never rolled back.

## Severity & Category

- Severity: Critical
- Category: Reorg correctness / data integrity (security-relevant)

The blockchain is the single source of truth; indexed state must mirror on-chain truth. This finding describes a class of reorgs the indexer cannot detect.

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:118-148` (sync loop / range selection)
- `backend/indexer/src/services/indexer-service.ts:186-220` (`detectAndHandleReorg`)

## Description

The sync loop processes only up to a confirmed tip:

```ts
// backend/indexer/src/services/indexer-service.ts:126
const endBlock = latestBlock.seqno - confirmationBlocks;
```

and starts from just past the last indexed block:

```ts
// backend/indexer/src/services/indexer-service.ts:119
const startBlock = latestIndexed + 1;
```

`detectAndHandleReorg` is only invoked while syncing forward, and it returns `false` when there is no stored block for the height being examined:

```ts
// backend/indexer/src/services/indexer-service.ts:186-220 (detectAndHandleReorg)
// if (!storedBlock) return false;  // treats "unseen" as "no reorg"
```

Since `startBlock` is always `latestIndexed + 1`, the indexer never re-examines a block it has already stored. A reorg that replaces the contents/hash of an already-indexed block produces no mismatch check at all, so `handleReorg` is never triggered for it.

## Impact

- Reorgs affecting already-indexed blocks silently persist as canonical in the index.
- Events from orphaned blocks remain; events from the replacement blocks may never be indexed.
- The index permanently diverges from on-chain truth with no error surfaced.

## Suggested Fix

- On each poll, before advancing the cursor, re-validate the last `K` stored block hashes against the chain, where `K >= confirmationBlocks`.
- On the first mismatch (stored hash != chain hash at that height), trigger `handleReorg` from that height.
- Only advance the cursor after the trailing window has been confirmed consistent.

## Acceptance Criteria

- [ ] Each poll re-validates at least the last `confirmationBlocks` stored block hashes against the chain.
- [ ] A detected mismatch within the indexed range triggers `handleReorg` from the first divergent height.
- [ ] A regression test indexes blocks, mutates a stored block hash to simulate a reorg inside the indexed range, and asserts detection plus rollback occur on the next poll.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#246](https://github.com/xlabtg/tonbankcard-protocol/issues/246)
