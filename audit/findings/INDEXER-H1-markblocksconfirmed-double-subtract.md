---
title: "[INDEXER-H1] markBlocksConfirmed double-subtracts the confirmation depth"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","priority:high","stage:2-high"]
---

## Summary

The confirmation cutoff is computed by subtracting the confirmation depth twice, so a band of blocks that are in fact confirmed is never flagged as confirmed. There are also three inconsistent definitions of "confirmed" across the codebase.

## Severity & Category

- Severity: High
- Category: Logic correctness / consistency

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:124-148` (`markBlocksConfirmed`)
- `backend/indexer/src/api/routes.ts:115-118` (a third confirmation definition)

## Description

`endBlock` is already the highest confirmed block:

```ts
// backend/indexer/src/services/indexer-service.ts:126
const endBlock = latestBlock.seqno - confirmationBlocks;
```

but `markBlocksConfirmed` subtracts the depth again:

```ts
// backend/indexer/src/services/indexer-service.ts:145
const confirmUpTo = endBlock - confirmationBlocks;
// marks blocks <= confirmUpTo as confirmed
```

So blocks between `confirmUpTo` and `endBlock` (a band of width `confirmationBlocks`) are never marked confirmed even though they meet the confirmation depth. Separately, the API derives confirmation a third way:

```ts
// backend/indexer/src/api/routes.ts:115-118
// confirmations = latestBlockIndexed - payment.block_number
```

Three different semantics for "confirmed" coexist.

## Impact

- A band of genuinely confirmed blocks is perpetually reported unconfirmed.
- Inconsistent confirmation semantics between the indexer and API produce contradictory results for the same block/payment.

## Suggested Fix

- Adopt a single canonical definition of confirmation depth and use it everywhere.
- Set `confirmUpTo = endBlock` (since `endBlock` already accounts for the depth), or remove the `confirmed` column and derive depth consistently from `latestSeqno - block_number` at read time.

## Acceptance Criteria

- [ ] Exactly one definition of confirmation depth is used across `indexer-service.ts` and `routes.ts`.
- [ ] Blocks that meet the confirmation depth are marked/reported confirmed (no off-by-`confirmationBlocks` gap).
- [ ] A regression test asserts that a block at depth `>= confirmationBlocks` is reported confirmed by both the indexer and the API.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#254](https://github.com/xlabtg/tonbankcard-protocol/issues/254)
