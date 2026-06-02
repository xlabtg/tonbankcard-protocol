---
title: "[INDEXER-M5] Transparency UNIQUE + INSERT OR IGNORE silently drops corrected periods"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","type:security","priority:medium","stage:3-medium"]
---

## Summary

Transparency metrics use `UNIQUE(period_start, period_end)` with `INSERT OR IGNORE`, so if the on-chain registry re-records a corrected metric for the same period (or a reorg replaces it), the new row is ignored and the stale value is kept.

## Severity & Category

- Severity: Medium
- Category: Data integrity / reorg correctness (security-relevant)

The blockchain is the single source of truth; corrected on-chain metrics must overwrite stale indexed values.

## Affected Code

- `backend/indexer/src/db/migrations/002_transparency/up.sqlite.sql:22-23` (UNIQUE constraint)
- `backend/indexer/src/db/migrations/002_transparency/up.sqlite.sql:47-48` (UNIQUE constraint)
- `backend/indexer/src/db/database.ts:510-527` (insert path)
- `backend/indexer/src/db/database.ts:544-565` (insert path)

## Description

```sql
-- backend/indexer/src/db/migrations/002_transparency/up.sqlite.sql:22-23,47-48
-- UNIQUE(period_start, period_end)
```

```ts
// backend/indexer/src/db/database.ts:510-527,544-565
// INSERT OR IGNORE ... -> a second row for the same period is dropped
```

When a corrected metric for an already-recorded period arrives, `INSERT OR IGNORE` discards it and the original (stale) value persists, contradicting the requirement to mirror on-chain truth.

## Impact

- Corrected or reorg-replaced transparency metrics are silently lost.
- Reported metrics can permanently diverge from the on-chain registry.

## Suggested Fix

- Use an UPSERT on `(period_start, period_end)` that takes the newest value (e.g. by block height/sequence), or
- Explicitly document periods as immutable and add a reorg reconciliation step that replaces affected periods.

## Acceptance Criteria

- [ ] A re-recorded/corrected metric for an existing period updates the stored value (newest-by-block wins), or the immutable policy is documented and enforced with reorg reconciliation.
- [ ] Reorg handling reconciles transparency periods affected by removed blocks.
- [ ] A regression test inserts a period, then a corrected value for the same period, and asserts the canonical value is stored.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#277](https://github.com/xlabtg/tonbankcard-protocol/issues/277)
