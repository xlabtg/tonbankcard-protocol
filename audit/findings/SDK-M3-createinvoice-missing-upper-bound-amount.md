---
title: "[SDK-M3] TypeScript createInvoice does not enforce the documented 2^120-1 upper bound on amount"
severity: medium
area: sdk
priority: medium
stage: 3
labels: ["bug","audit","type:sdk","priority:medium","stage:3-medium"]
---

## Summary

`createInvoice` validates only that the amount is positive. It omits the documented upper bound of 2^120-1, so out-of-range amounts pass client-side validation in the TypeScript SDK (the Go and Python SDKs already define this bound).

## Severity & Category

- Severity: Medium
- Category: Input validation correctness

## Affected Code

- `sdk/src/sdk.ts:64-67` (within `createInvoice`)
- Reference bounds already present: `sdk-go/models.go:81` (`maxAmount`), `sdk-python/src/tonbankcard_merchant/models.py:25` (`_TBC_MAX_AMOUNT`)

## Description

```ts
// sdk/src/sdk.ts:64-67
// Validate amount is positive
if (params.amountTbc <= 0n) {
  throw new Error('Invoice amount must be positive');
}
```

Only the lower bound (`> 0`) is checked. The protocol documents a maximum of `2^120 - 1`, which the Go and Python SDKs encode (`(1 << 120) - 1`), but the TypeScript SDK does not, so an amount exceeding the on-chain representable range is accepted client-side.

## Impact

- Invoices with out-of-range amounts are created by the TS SDK and only fail later (on-chain or server-side), producing inconsistent cross-SDK behaviour.
- Integrators relying on the SDK for validation get no early rejection of impossible amounts.

## Suggested Fix

- Enforce `0n < params.amountTbc <= (2n ** 120n) - 1n` using BigInt.
- Share the constant with the Go/Python bound for cross-SDK consistency.

## Acceptance Criteria

- [ ] `createInvoice` rejects amounts `<= 0` and amounts `> 2^120 - 1`.
- [ ] A regression test asserts that `2^120 - 1` is accepted and `2^120` is rejected.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#293](https://github.com/xlabtg/tonbankcard-protocol/issues/293)
