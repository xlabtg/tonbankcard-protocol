---
title: "[INDEXER-H2] fetchContractTransactions ignores block number; events mis-attributed"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

`fetchContractTransactions` ignores the block-number argument and always returns the last 50 transactions per address. `processBlock` then attributes those transactions to whatever block it is currently iterating, so events receive a wrong `block_number`, the same transactions are re-attributed for every block, and transactions outside the 50-item window are missed during fast sync.

## Severity & Category

- Severity: High
- Category: Data integrity / reorg correctness (security-relevant)

The blockchain is the single source of truth; indexed state must mirror on-chain truth. Mis-attributed block numbers break the reorg cascade and corrupt block-scoped data.

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:360-408` (`fetchContractTransactions`)
- `backend/indexer/src/services/indexer-service.ts:242` (call site)
- `backend/indexer/src/services/indexer-service.ts:245-255` (`insertBlock` / `processTransaction`)

## Description

The function takes a block number but never uses it, always fetching a fixed window:

```ts
// backend/indexer/src/services/indexer-service.ts:360-408
fetchContractTransactions(_blockNumber) {
  // always fetches last 50 txs per address (limit = 50), ignores _blockNumber
}
```

`processBlock` attributes the returned transactions to the current loop block:

```ts
// backend/indexer/src/services/indexer-service.ts:245   insertBlock(blockNumber, ..., transactions.length)
// backend/indexer/src/services/indexer-service.ts:254-255 processTransaction(tx, blockNumber, timestamp)
```

Consequences:

- The same 50 transactions are re-fetched and re-attributed for every block, making `transaction_count` and `block_number` meaningless.
- Events are stored with a wrong `block_number`, so the reorg FK cascade (which deletes by block) deletes the wrong events.
- Transactions older than the 50-item window are skipped during fast sync.

`UNIQUE(transaction_hash, log_index)` prevents duplicate rows, but the first (wrong) `block_number` wins.

## Impact

- Block-scoped fields (`block_number`, `transaction_count`) are unreliable.
- Reorg rollback deletes the wrong events, corrupting the index.
- Events can be permanently missed during catch-up/fast sync.

## Suggested Fix

- Fetch transactions scoped to the target block (or use `lt`/`hash` cursors with `to_lt`) and index only transactions that belong to `blockNumber`.
- Paginate beyond the 50-item window so no transactions are dropped during fast sync.

## Acceptance Criteria

- [ ] Transactions are fetched/filtered so each is attributed to its actual block.
- [ ] `block_number` and `transaction_count` reflect the correct block.
- [ ] Pagination retrieves all transactions for a block, not just the latest 50.
- [ ] A regression test indexes a range with more than 50 transactions and asserts each event's `block_number` matches its on-chain block and none are dropped.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#255](https://github.com/xlabtg/tonbankcard-protocol/issues/255)
