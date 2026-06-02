---
title: "[SDK-H1] verifySettlement never checks the payment against the invoice (matchesInvoice hardcoded true)"
severity: high
area: sdk
priority: high
stage: 2
labels: ["bug","audit","type:sdk","type:security","priority:high","stage:2-high"]
---

## Summary

`verifySettlement` is documented as the authoritative on-chain verification method, but it sets `matchesInvoice: true` unconditionally without ever comparing the on-chain payment (recipient/merchant NFT, amount, payload/invoice hash) to the invoice. A payment sent to the wrong merchant or for the wrong amount is reported as a valid settlement.

## Severity & Category

- Severity: High
- Category: Security (settlement integrity) and logic correctness

## Affected Code

- `sdk/src/sdk.ts:255-260` (within `verifySettlement`, `sdk/src/sdk.ts:214-270`)

## Description

The verification result hardcodes `matchesInvoice`:

```ts
// sdk/src/sdk.ts:255-260
return {
  isValid,
  txHash,
  confirmations,
  matchesInvoice: true, // Additional verification can be added
};
```

The method only inspects transaction success (`tx.description.type === 'generic' && !tx.description.aborted`) and never receives the invoice as an argument, so it cannot and does not compare the on-chain payment's merchant NFT, `amount_tbc`, or payload/invoice hash against the expected invoice. The comment "Additional verification can be added" confirms the check is a placeholder.

## Impact

- Any successful transaction at the payment hub is reported as matching the invoice, including payments to a different merchant, for a different amount, or for a different order.
- Merchants relying on `matchesInvoice` may fulfil orders for payments that never satisfied the invoice, enabling under/mis-payment and cross-invoice confusion.

## Suggested Fix

- Accept the target invoice (or its canonical fields) as input to `verifySettlement`.
- Extract the on-chain payment fields (merchant/recipient NFT, `amount_tbc`, payload/invoice hash) from the transaction data.
- Set `matchesInvoice: true` only when the merchant NFT, amount, and payload/invoice hash all match the invoice; otherwise return `false`.

## Acceptance Criteria

- [ ] `verifySettlement` compares merchant NFT, amount, and payload/invoice hash from chain data against the invoice.
- [ ] `matchesInvoice` is `true` only when all compared fields match; mismatch returns `false`.
- [ ] A regression test asserts that a payment to a different merchant and a payment with the wrong amount both yield `matchesInvoice: false`, while a correct payment yields `true`.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#266](https://github.com/xlabtg/tonbankcard-protocol/issues/266)
