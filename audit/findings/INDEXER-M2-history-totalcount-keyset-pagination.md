---
title: "[INDEXER-M2] getAccountHistory totalCount and keyset pagination interact incorrectly"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","priority:medium","stage:3-medium"]
---

## Summary

The history `totalCount` is computed with the same `beforeTimestamp` filter as the page query, so it reports "rows before this timestamp" rather than the true total, and `hasMore` becomes unreliable. The sort uses only `timestamp` as a cursor with no tiebreaker, so rows sharing a timestamp can be skipped or duplicated across pages.

## Severity & Category

- Severity: Medium
- Category: Pagination correctness

## Affected Code

- `backend/indexer/src/db/database.ts:381-392` (`countSql` / page query)
- `backend/indexer/src/api/routes.ts:259` (`hasMore` computation)

## Description

```ts
// backend/indexer/src/db/database.ts:381-392
// countSql applies the same beforeTimestamp filter as the page query
// -> totalCount = rows before this timestamp, not total
```

```ts
// backend/indexer/src/api/routes.ts:259
// hasMore: offset + limit < totalCount  -- unreliable in keyset mode
```

Additionally the query orders by `timestamp DESC` with only `timestamp` as the cursor and no `id`/`log_index` tiebreaker, so rows with equal timestamps can be skipped or repeated across page boundaries.

## Impact

- `totalCount` and `hasMore` are misleading for paginated history.
- Rows sharing a timestamp can be dropped or duplicated when paging.

## Suggested Fix

- Use a composite sort key `(timestamp DESC, transaction_hash, log_index)` with a matching keyset predicate.
- Compute `totalCount` without the `beforeTimestamp` filter (or document and remove it if not meaningful in keyset mode).

## Acceptance Criteria

- [ ] Pagination uses a stable composite cursor with a deterministic tiebreaker.
- [ ] `totalCount` reflects the true total (independent of the page cursor).
- [ ] `hasMore` is accurate under keyset pagination.
- [ ] A regression test with multiple rows sharing a timestamp asserts no skipped/duplicated rows across pages.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#274](https://github.com/xlabtg/tonbankcard-protocol/issues/274)
