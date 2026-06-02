---
title: "[INDEXER-C3] processBlock is non-atomic; events can be silently lost"
severity: critical
area: backend
priority: critical
stage: 1
labels: ["bug","audit","type:backend","type:security","priority:critical","stage:1-critical"]
---

## Summary

`processBlock` writes the block row, each event, and the cursor as separate, unguarded operations with no enclosing transaction, and per-event insert errors are swallowed. A crash mid-block or a failed event insert can leave the block recorded and the cursor advanced while events are lost; on restart the indexer skips the block.

## Severity & Category

- Severity: Critical
- Category: Durability / atomicity / data integrity (security-relevant)

The blockchain is the single source of truth; indexed state must mirror on-chain truth. A non-atomic write path lets the index permanently drop events relative to on-chain truth.

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:229-264` (`processBlock`)
- `backend/indexer/src/services/indexer-service.ts:551-561` (`storeEvent` error swallowing)
- `backend/indexer/src/db/database.ts:82-96` (`insertBlock`)
- `backend/indexer/src/db/database.ts:68-77` (`updateLatestBlock`)

## Description

`processBlock` performs three independent writes with no transaction boundary:

```ts
// backend/indexer/src/services/indexer-service.ts:245   insertBlock(blockNumber, ...)
// backend/indexer/src/services/indexer-service.ts:254-256 for (...) storeEvent(...)
// backend/indexer/src/services/indexer-service.ts:259   updateLatestBlock(...)
```

`storeEvent` swallows its errors instead of failing the block:

```ts
// backend/indexer/src/services/indexer-service.ts:551-561 (storeEvent)
// try { insert event } catch (e) { log and continue }  // event silently dropped
```

Because the block row is inserted and the cursor (`updateLatestBlock`) may be advanced regardless of whether all events committed, a crash between writes or a swallowed event-insert failure leaves a recorded block whose events are incomplete. On restart, `startBlock = latestIndexed + 1` skips the block entirely, so the missing events are never re-fetched.

## Impact

- Events can be permanently lost while the block appears successfully indexed.
- The cursor can advance past incompletely-indexed blocks, preventing recovery.
- Snapshots and history derived from these events are silently incomplete.

## Suggested Fix

- Wrap `insertBlock`, all `storeEvent` calls, and `updateLatestBlock` for a block in a single `better-sqlite3` transaction (all-or-nothing).
- Do not advance the cursor unless every event for the block committed.
- Stop swallowing per-event insert errors; let them abort and roll back the block transaction so the block is retried.

## Acceptance Criteria

- [ ] Block, events, and cursor update for a block commit within one transaction.
- [ ] A failed event insert rolls back the entire block (no partial block, cursor not advanced).
- [ ] Per-event errors propagate to fail the block rather than being swallowed.
- [ ] A regression test injects a failing event insert mid-block and asserts the block row, events, and cursor are all rolled back.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#247](https://github.com/xlabtg/tonbankcard-protocol/issues/247)
