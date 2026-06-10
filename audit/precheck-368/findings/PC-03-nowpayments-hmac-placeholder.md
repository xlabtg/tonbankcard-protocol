---
title: NOWPayments adapter verifies callbacks with a placeholder HMAC, accepting forged IPN notifications
severity: High
area: backend/adapters
priority: high
stage: 1-critical
labels:
  - bug
  - type:security
  - type:backend
  - priority:high
  - audit
  - stage:1-critical
---

## Summary

`backend/adapters/nowpayments.ts` "verifies" IPN callback signatures with a function that returns a hard-coded placeholder string instead of computing a real HMAC. As a result any attacker who knows the (public) request shape can forge a payment-confirmation callback that passes verification.

## Severity & Category

- Severity: High
- Category: Authentication / Signature verification bypass

## Affected Code

- `backend/adapters/nowpayments.ts:315-319` (`calculateHMAC` returns a placeholder)
- `backend/adapters/nowpayments.ts:144-163` (`verifyCallback` compares attacker-supplied signature against the placeholder)
- `backend/adapters/index.ts:17` (exported as public API)
- `examples/adapters/nowpayments-example.ts:186` (wired into the example flow)

## Description

```ts
private calculateHMAC(data: string, secret: string): string {
    // placeholder implementation
    return `hmac_placeholder_${data.length}_${secret.length}`;
}
```

`verifyCallback` builds the "expected" signature from this placeholder and compares it against the `x-nowpayments-sig` header. Since the placeholder depends only on the lengths of `data` and `secret` — values an attacker can trivially reproduce — signature verification provides no authentication at all.

## Impact

- Forged IPN callbacks can mark invoices as paid without any real on-chain/off-chain settlement, enabling theft of goods/services.
- Any downstream state driven by `verifyCallback === true` (order fulfilment, balance credit) is attacker-controllable.

## Suggested Fix

- Replace the placeholder with a real HMAC using the NOWPayments-documented algorithm (HMAC-SHA512 over the sorted-key JSON body) and the configured IPN secret:

```ts
import { createHmac } from 'crypto';
const expected = createHmac('sha512', secret).update(data).digest('hex');
```

- Compare using a constant-time comparison (`crypto.timingSafeEqual`).
- Add a unit test with a known NOWPayments sample payload + signature.

## Acceptance Criteria

- [ ] `calculateHMAC` produces a real HMAC-SHA512 digest.
- [ ] A callback with an invalid signature is rejected; a correctly-signed callback is accepted.
- [ ] Comparison is constant-time.
- [ ] Regression test with a fixed payload/secret/expected-signature vector.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- NOWPayments IPN signature documentation
