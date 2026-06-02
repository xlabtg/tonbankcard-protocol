---
title: "[INDEXER-M4] invalidateHistoryCache prefix match is ambiguous across addresses"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","priority:medium","stage:3-medium"]
---

## Summary

Cache invalidation uses a string prefix match on the cache key, which can over- or under-match when address representations are non-canonical or share prefixes, leaving stale entries or evicting unrelated ones.

## Severity & Category

- Severity: Medium
- Category: Cache invalidation correctness

## Affected Code

- `backend/indexer/src/db/database.ts:444-449` (`invalidateHistoryCache`)

## Description

Cache keys are `${nftAddress}:${limit}:${offset}:${beforeTimestamp}`, and invalidation matches by prefix:

```ts
// backend/indexer/src/db/database.ts:444-449
key.startsWith(`${nftAddress}:`)
```

If addresses are stored in multiple forms (raw vs. friendly, bounceable vs. non-bounceable, differing case), the same logical NFT can be cached under different keys, and a prefix match against one form will miss the others (under-match) or, with similar string prefixes, match unintended keys (over-match).

## Impact

- Stale history served because the matching invalidation key form differs from the cached form.
- Potential eviction of unrelated entries.

## Suggested Fix

- Normalize addresses to a single canonical form before using them as cache keys.
- Match on the exact normalized `nftAddress` component rather than relying on raw string prefixing.

## Acceptance Criteria

- [ ] All cache keys use a canonical address representation.
- [ ] Invalidation reliably clears all entries for the target NFT and no others.
- [ ] A regression test invalidates using a different address representation and asserts the correct entries are cleared.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#276](https://github.com/xlabtg/tonbankcard-protocol/issues/276)
