---
title: "[INDEXER-H3] getMasterchainInfo().latestSeqno is undefined; sync never advances"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","priority:high","stage:2-high"]
---

## Summary

The code reads `info.latestSeqno` from `getMasterchainInfo()`, but the `@ton/ton` API exposes the tip as `info.last.seqno`. `latestSeqno` is `undefined`, which propagates to `NaN` in the range computation and causes the sync loop to never execute, so nothing is indexed and no error is raised.

## Severity & Category

- Severity: High
- Category: Correctness / availability

## Affected Code

- `backend/indexer/src/services/indexer-service.ts:570-573` (`getLatestBlock`)

## Description

```ts
// backend/indexer/src/services/indexer-service.ts:570-573
const info = await client.getMasterchainInfo();
return { seqno: info.latestSeqno };  // latestSeqno does not exist on the @ton/ton shape
```

`@ton/ton` `getMasterchainInfo()` returns `{ last: { seqno } }`; there is no `latestSeqno`. Therefore `getLatestBlock` returns `{ seqno: undefined }`, and:

```ts
// endBlock = undefined - confirmationBlocks = NaN
// loop condition currentBlock <= NaN is always false -> no iterations
```

The indexer silently indexes nothing.

## Impact

- Sync never advances; the indexer is effectively dead while appearing healthy.
- Failure is silent (no thrown error), making it hard to detect operationally.

## Suggested Fix

- Read `info.last.seqno`.
- Guard against a non-finite seqno: if the value is not a finite number, throw/log and skip the poll rather than computing `NaN` bounds.

## Acceptance Criteria

- [ ] `getLatestBlock` returns the tip from `info.last.seqno`.
- [ ] A non-finite seqno is rejected with a clear error and does not silently halt the loop.
- [ ] A regression test mocks `getMasterchainInfo()` returning `{ last: { seqno } }` and asserts the sync range and loop advance.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#256](https://github.com/xlabtg/tonbankcard-protocol/issues/256)
