---
title: "[INDEXER-M1] Account history limit is unbounded and abusable"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","type:security","priority:medium","stage:3-medium"]
---

## Summary

The `/accounts/:nft_id/history` endpoint passes a client-supplied `limit` directly into the SQL `LIMIT` clause with no maximum clamp, unlike other endpoints. Large values force expensive queries, and a negative value causes SQLite to return all rows.

## Severity & Category

- Severity: Medium
- Category: Input validation / denial of service (security-relevant)

## Affected Code

- `backend/indexer/src/api/routes.ts:236-245`
- `backend/indexer/src/db/database.ts:346-392` (`getAccountHistory`)

## Description

```ts
// backend/indexer/src/api/routes.ts:236-245
const limit = parseInt(req.query.limit) || 100; // no upper clamp
// passed to LIMIT ? in getAccountHistory
```

By contrast `/transparency/metrics` clamps its limit:

```ts
// backend/indexer/src/api/routes.ts:385-388  (limit clamped to 60)
```

So `?limit=100000000` forces a large `UNION ALL` plus sort, `offset` is unbounded, and `?limit=-5` is treated by SQLite as "no limit," returning every row.

## Impact

- Resource exhaustion / DoS via huge limit and offset.
- Negative limit bypasses pagination and dumps the full dataset.

## Suggested Fix

- Clamp `limit` to a sane range (e.g. `1..500`).
- Reject negative `offset` (and negative `limit`) with a 400.

## Acceptance Criteria

- [ ] `limit` is clamped to `1..500` for the account history endpoint.
- [ ] Negative `offset`/`limit` are rejected or normalized to safe defaults.
- [ ] A regression test asserts `?limit=100000000` and `?limit=-5` return at most the clamped maximum.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#273](https://github.com/xlabtg/tonbankcard-protocol/issues/273)
