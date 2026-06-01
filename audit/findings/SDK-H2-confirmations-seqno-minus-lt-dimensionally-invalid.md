---
title: "[SDK-H2] Confirmations computed as latestSeqno minus transaction lt is dimensionally invalid"
severity: high
area: sdk
priority: high
stage: 2
labels: ["bug","audit","type:sdk","priority:high","stage:2-high"]
---

## Summary

`verifySettlement` derives confirmations by subtracting a transaction logical time (`lt`, a counter on the order of 10^19) from a masterchain block seqno (a block height). The two quantities are dimensionally incompatible, so the result is a meaningless, hugely negative number and any confirmation-based gating is nonsensical.

## Severity & Category

- Severity: High
- Category: Logic correctness

## Affected Code

- `sdk/src/sdk.ts:249-250` (within `verifySettlement`)

## Description

```ts
// sdk/src/sdk.ts:249-250
const masterchain = await this.client.getMasterchainInfo();
const confirmations = masterchain.latestSeqno - Number(tx.lt);
```

`latestSeqno` is a masterchain block height, while `tx.lt` is the transaction's logical time — an unrelated monotonic counter that is many orders of magnitude larger. Subtracting one from the other produces a value with no physical meaning (typically a large negative number), and `Number(tx.lt)` additionally risks precision loss for `lt` values above 2^53.

## Impact

- `confirmations` is garbage, so any consumer using it to gate settlement finality (e.g. "wait for N confirmations") makes decisions on a meaningless value.
- Combined with SDK-H1, the verification result conveys neither correct confirmation depth nor invoice matching.

## Suggested Fix

- Resolve the block seqno in which the transaction was included.
- Compute `confirmations = latestSeqno - txBlockSeqno` (block-height difference), guarding against negative results.
- Avoid `Number()` on `lt`/seqno values that may exceed 2^53; use BigInt where appropriate.

## Acceptance Criteria

- [ ] Confirmations are derived from a block-seqno difference (transaction block seqno vs latest seqno), not from `lt`.
- [ ] No precision-losing `Number()` conversion is applied to values that may exceed 2^53.
- [ ] A regression test asserts that a transaction N blocks deep reports `confirmations === N` (and never a negative or nonsensical value).

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#267](https://github.com/xlabtg/tonbankcard-protocol/issues/267)
