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

## Resolution

**RESOLVED ✅ (Issue #372 / PC-03)** — PR
[#386](https://github.com/xlabtg/tonbankcard-protocol/pull/386), branch
`issue-372-5a6681e97163`.

`calculateHMAC` now computes a **real HMAC-SHA512** keyed by the configured IPN
secret instead of a length-only placeholder
(`backend/adapters/nowpayments.ts:371-373`):

```ts
private calculateHMAC(data: string, secret: string): string {
    return createHmac('sha512', secret).update(data, 'utf8').digest('hex');
}
```

`verifyCallback` (`backend/adapters/nowpayments.ts:150-174`) first reproduces the
**exact canonical body NOWPayments signed** — `canonicalizePayload`
(`:333`) + `sortObjectKeys` (`:344`) recursively key-sort the JSON, so a genuine
callback whose key order differs from a naïve `JSON.stringify` is no longer
wrongly rejected — then compares the `x-nowpayments-sig` header against the
recomputed digest in **constant time** (`constantTimeCompare`, `:384-393`):

```ts
const bufferA = Buffer.from(a, 'utf8');
const bufferB = Buffer.from(b, 'utf8');
if (bufferA.length !== bufferB.length) {
    return false;          // length mismatch alone is non-secret
}
return timingSafeEqual(bufferA, bufferB);
```

A missing/empty signature short-circuits to `false` and any unexpected error
(e.g. malformed JSON) is caught and treated as unverified, so verification fails
closed. Because the digest now depends on the secret's bytes, a forged
`payment_status: "finished"` IPN no longer authenticates — closing the
fulfilment/credit path that previously trusted `verifyCallback === true`.

**Regression coverage:**

- CI-enforced suite (`tests/nowpayments-adapter/nowpayments-hmac.spec.ts`,
  wired into `.github/workflows/ci.yml` as job *Test (NOWPayments IPN HMAC)*) —
  14 tests pinning all four criteria against a hard-coded golden vector
  (`secret = "test_ipn_secret_key"` → `1cd29b09…65feb0b`): real HMAC-SHA512 shape,
  accept-genuine/reject-forged (placeholder, wrong-secret, tampered, empty,
  scrambled key order), and constant-time behaviour (one-byte diff at either end,
  wrong-length rejected rather than throwing).
- Standalone behavioural reproduction:
  `experiments/issue-372-nowpayments-hmac/hmac-forgery.repro.spec.ts` (9 tests)
  demonstrates the *before* forgery (a faithful copy of the placeholder
  `verifyCallback` accepts an attacker-forged IPN) and the *after* fix
  (the real adapter rejects it).

## Acceptance Criteria

- [x] `calculateHMAC` produces a real HMAC-SHA512 digest.
- [x] A callback with an invalid signature is rejected; a correctly-signed callback is accepted.
- [x] Comparison is constant-time.
- [x] Regression test with a fixed payload/secret/expected-signature vector.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- NOWPayments IPN signature documentation
