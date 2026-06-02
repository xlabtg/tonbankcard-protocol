---
title: "[INDEXER-C1] Reorg rollback leaves account_snapshots permanently stale"
severity: critical
area: backend
priority: critical
stage: 1
labels: ["bug","audit","type:backend","type:security","priority:critical","stage:1-critical"]
---

## Summary

When a chain reorganization is handled, the indexer deletes reverted `blocks` rows (cascading to their `events`) but never updates the `account_snapshots` table. Snapshots therefore continue to reflect state derived from now-deleted events, and the discrepancy is only ever corrected if a brand-new event happens to arrive for that exact NFT. The account history endpoint can serve reverted, non-canonical state.

## Severity & Category

- Severity: Critical
- Category: Data integrity / reorg correctness (security-relevant)

The blockchain is the single source of truth; indexed state must mirror on-chain truth. This finding describes a path where indexed state durably diverges from on-chain truth after a reorg.

## Affected Code

- `backend/indexer/src/db/database.ts:144-156` (`handleReorg`)
- `backend/indexer/src/db/migrations/001_initial/up.sqlite.sql:114-121` (`account_snapshots` schema)

## Description

`handleReorg` removes blocks at or above the reorg point, relying on a foreign-key cascade to delete the associated `events` rows:

```ts
// backend/indexer/src/db/database.ts:144-156 (handleReorg)
// deletes blocks rows; events are CASCADE-deleted via FK.
// account_snapshots is NOT touched here.
```

The `account_snapshots` table is keyed only by the NFT address and has no foreign-key relationship to `blocks`:

```sql
-- backend/indexer/src/db/migrations/001_initial/up.sqlite.sql:114-121
-- account_snapshots ... PRIMARY KEY (nft_address)
-- columns include current_owner, current_state, last_transfer_block
```

Because the snapshot is never recomputed during `handleReorg`, fields such as `current_owner`, `current_state`, and `last_transfer_block` retain values derived from events that no longer exist. `getAccountSnapshot`, served at `/accounts/:nft_id/history`, then returns this reverted state. For example, a snapshot can show `ACTIVE` while the canonical chain has the account `FROZEN`, or report a stale owner. The only thing that fixes it is a future event for that same `nft_address`, which may never occur.

## Impact

- API consumers receive non-canonical account state (wrong owner, wrong state) indefinitely after a reorg.
- Downstream logic relying on snapshot state (e.g. freeze/active checks) operates on incorrect data.
- Silent and persistent: there is no error and no self-healing in the common case.

## Suggested Fix

- In `handleReorg`, recompute affected snapshots from the surviving events after the reorg deletion, or delete and lazily rebuild any snapshot whose latest event block is `>= fromBlock`.
- Identify affected `nft_address` values by the events being removed and rebuild each from the remaining canonical event history.
- Add a `last_state_change_block` guard so snapshot writes can be validated/ordered against block height and reconciled on rollback.

## Acceptance Criteria

- [ ] `handleReorg` recomputes or rebuilds every `account_snapshot` affected by the removed blocks/events.
- [ ] After a simulated reorg, `getAccountSnapshot` returns state consistent with the surviving (canonical) events, never reverted state.
- [ ] Snapshots for NFTs with no surviving events are cleared or correctly defaulted.
- [ ] A regression test simulates indexing events, a reorg deleting the latest block(s), and asserts the snapshot reflects the post-reorg canonical state.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#245](https://github.com/xlabtg/tonbankcard-protocol/issues/245)
