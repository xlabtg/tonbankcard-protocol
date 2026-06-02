---
title: "[INDEXER-M3] History cache is unbounded and not invalidated on reorg or NFT changes"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","type:security","priority:medium","stage:3-medium"]
---

## Summary

The history cache grows without bound (one entry per `nftAddress:limit:offset:beforeTimestamp`), so attacker-controlled `limit`/`offset` can exhaust memory. It is also not cleared on reorg and not invalidated when ownership changes are written, so it can serve reorged-out or stale history.

## Severity & Category

- Severity: Medium
- Category: Resource management / cache invalidation (security-relevant)

The blockchain is the single source of truth; cached reads must not outlive a reorg that invalidated them.

## Affected Code

- `backend/indexer/src/db/database.ts:29` (`historyCache: Map`)
- `backend/indexer/src/db/database.ts:346-357` (cache keying/read)
- `backend/indexer/src/db/database.ts:436` (cache write)
- `backend/indexer/src/db/database.ts:444-450` (`invalidateHistoryCache`)
- `backend/indexer/src/db/database.ts:280-316` (`insertNFTOwnershipChange`, no invalidation)

## Description

```ts
// backend/indexer/src/db/database.ts:29   private historyCache: Map<...>
// keyed by `${nftAddress}:${limit}:${offset}:${beforeTimestamp}` -> unbounded
```

Combined with the unclamped `limit`/`offset` (see M1), an attacker can mint unbounded distinct cache keys, exhausting memory. `handleReorg` does not clear the cache, so reorged-out history can be served for the cache TTL (~5s). `insertNFTOwnershipChange` does not invalidate the affected NFT's cached history either.

## Impact

- Unbounded memory growth / DoS.
- Stale or reorged-out history served from cache.

## Suggested Fix

- Bound the cache (LRU with a fixed capacity) or key it only on `nftAddress` (not on `limit`/`offset`/`beforeTimestamp`).
- Clear/invalidate the cache in `handleReorg`.
- Invalidate the affected NFT's cache in `insertNFTOwnershipChange`.

## Acceptance Criteria

- [ ] Cache memory is bounded regardless of client-supplied parameters.
- [ ] `handleReorg` invalidates affected (or all) history cache entries.
- [ ] Writing an ownership change invalidates that NFT's cached history.
- [ ] A regression test asserts post-reorg/post-change reads do not return stale cached history.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#275](https://github.com/xlabtg/tonbankcard-protocol/issues/275)
