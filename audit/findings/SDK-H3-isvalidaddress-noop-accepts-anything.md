---
title: "[SDK-H3] isValidAddress is a no-op that accepts any address"
severity: high
area: sdk
priority: high
stage: 2
labels: ["bug","audit","type:sdk","type:security","priority:high","stage:2-high"]
---

## Summary

The private `isValidAddress` helper used by `createInvoice` performs only a trivial non-empty check on `address.toString()` and otherwise returns `true`. It does not validate TON address structure or checksum, so callers receive no protection against malformed or mistyped addresses.

## Severity & Category

- Severity: High
- Category: Security (input validation) and logic correctness

## Affected Code

- `sdk/src/sdk.ts:355-362` (`isValidAddress`), used at `sdk/src/sdk.ts:70`

## Description

```ts
// sdk/src/sdk.ts:355-362
private isValidAddress(address: Address): boolean {
  try {
    // Check if address is valid
    return address.toString().length > 0;
  } catch {
    return false;
  }
}
```

The method's only meaningful condition is that `toString()` returns a non-empty string, which is true for essentially any value. No CRC16 checksum verification or structural parsing is performed. A correct standalone validator (`isValidTonAddress` in `sdk/src/utils.ts:94-101`) already exists and uses `Address.parse`, but `createInvoice` does not use it.

## Impact

- `createInvoice` accepts invalid or typo'd merchant NFT addresses without error, so invoices and downstream deep links can reference an address that can never receive the payment.
- The illusory validation gives integrators false confidence that addresses are checked.

## Suggested Fix

- Validate via `@ton/core` `Address.parse`, accepting raw and friendly (base64 / base64url) forms, and verify the CRC16 checksum.
- Reuse the existing `isValidTonAddress` utility (or consolidate on a single validator) and return `false` on any parse failure.

## Acceptance Criteria

- [ ] `isValidAddress` (or its replacement) rejects malformed addresses and addresses with an invalid CRC16 checksum.
- [ ] Both friendly base64/base64url and raw address forms are accepted when valid.
- [ ] A regression test asserts that a malformed address and a checksum-corrupted address are rejected, while valid addresses pass, and that `createInvoice` throws on an invalid merchant NFT.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#268](https://github.com/xlabtg/tonbankcard-protocol/issues/268)
