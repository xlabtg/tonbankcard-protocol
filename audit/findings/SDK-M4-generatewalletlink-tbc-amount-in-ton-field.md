---
title: "[SDK-M4] generateWalletLink places the TBC token amount into the TON native-amount field"
severity: medium
area: sdk
priority: medium
stage: 3
labels: ["bug","audit","type:sdk","type:security","priority:medium","stage:3-medium"]
---

## Summary

`generateWalletLink` builds a `ton://transfer` deep link and puts the TBC token amount into the link's `amount` field. Wallets interpret that field as the native TON (nanoton) value of the message, so the wallet would prompt the user for the wrong native amount rather than the intended TBC token transfer.

## Severity & Category

- Severity: Medium
- Category: Logic correctness / user-facing payment safety

## Affected Code

- `sdk/src/sdk.ts:189-202` (within `generateWalletLink`)

## Description

```ts
// sdk/src/sdk.ts:189-196
// Build TON Connect link
// Format: ton://transfer/<address>?amount=<nanotons>&text=<memo>
const amount = invoice.amountTbc.toString();
const text = encodeURIComponent(
  `TONBANKCARD Payment: ${invoice.id}${invoice.description ? ` - ${invoice.description}` : ''}`
);

let link = `ton://transfer/${invoice.merchantNft.toString()}?amount=${amount}&text=${text}`;
```

The `amount` query parameter in a `ton://transfer` link denotes the native TON/nanoton value of the message (used for gas/value), as the comment itself notes (`amount=<nanotons>`). Assigning `invoice.amountTbc` to it conflates the TBC token amount with the native TON value.

## Impact

- The wallet prompts the user to send the TBC amount as native TON, which is the wrong value (and a different asset).
- Depending on balance and wallet behaviour, the transfer either fails or sends an incorrect native amount, and the actual TBC token transfer is not encoded where the wallet expects it.

## Suggested Fix

- Separate the native TON message value from the TBC token amount.
- Set the link's native `amount` field to the appropriate TON value (e.g. the gas/forward value), and encode the TBC token amount inside the message payload rather than the native amount field.

## Acceptance Criteria

- [ ] The deep link's native `amount` field carries the intended TON value, not the TBC token amount.
- [ ] The TBC token amount is encoded in the message payload.
- [ ] A regression test asserts the generated link's native `amount` is not the raw `amountTbc` and that the payload carries the TBC amount.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#294](https://github.com/xlabtg/tonbankcard-protocol/issues/294)
