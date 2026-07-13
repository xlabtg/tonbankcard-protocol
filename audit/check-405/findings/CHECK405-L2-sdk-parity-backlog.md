---
title: "TS SDK parity backlog: case-sensitive hex webhook signature compare and missing amount validation in invoice hashing"
severity: Low
area: sdk
priority: low
stage: 4-low
labels:
  - bug
  - audit
  - type:sdk
  - priority:low
  - stage:4-low
  - package:sdk
  - track:C
---

## Summary

Two low-severity cross-SDK parity gaps in the TypeScript SDK.

1. **Case-sensitive hex webhook signature comparison.** `verifyWebhook`
   compares the provided signature against the computed HMAC digest with
   `constantTimeEqual`, which does a byte-for-byte UTF-8 compare of the two hex
   strings. The computed digest is lowercase hex, so an **uppercase** `v1=`
   signature is rejected by the TS SDK. The Go and Python SDKs compare hex
   signatures case-insensitively (decode/lowercase first), so the same
   uppercase-hex webhook is accepted there and rejected here.
2. **No amount validation in `generateInvoiceId` / `createPayloadHash`.** The Go
   SDK (`ValidateAmount`) and Python SDK (`validate_amount`) reject out-of-range
   amounts before hashing; the TS SDK hashes whatever it is given
   (`amountTbc.toString()`), so an out-of-contract amount (e.g. negative or
   over-max) is hashed in TS but rejected elsewhere, yielding an id no other SDK
   or the chain will reproduce.

## Severity & Category

- Severity: Low
- Category: Cross-SDK behavioural parity

## Affected Code

1. `sdk/src/webhook.ts:95-98` (`constantTimeEqual` — UTF-8 byte compare);
   `sdk/src/webhook.ts:165-172` (`verifyWebhook` — compares `provided` vs the
   lowercase `expected` digest). Cross-language references: Go/Python webhook
   verification comparing decoded/lowercased hex.
2. `sdk/src/utils.ts:132-161` (`canonicalInvoiceIdPayload` / `generateInvoiceId`
   — no amount validation), `169-173` (`createPayloadHash`). Cross-language
   references: Go `ValidateAmount`, Python `validate_amount`.

## Description

1. `computeWebhookSignature` returns a lowercase hex digest; `verifyWebhook`
   feeds `provided` and `expected` straight into `constantTimeEqual`, which
   fails on any case difference (and, because it length-checks first, is safe but
   strict). A sender that emits uppercase hex (valid per most HMAC hex
   conventions and accepted by the sibling SDKs) is rejected only by TS —
   an interoperability bug that manifests as spurious `signature_mismatch`.
2. Without an amount check, `generateInvoiceId({ amountTbc: -1n, ... })` happily
   produces an id in TS. Go/Python reject the same input, so the ecosystems
   disagree on whether the invoice even exists.

## Impact

- Low: (1) causes spurious webhook rejections only when a counterparty uses
  uppercase hex signatures; (2) lets TS mint ids for amounts the rest of the
  protocol rejects. Neither affects funds or custody.

## Suggested Fix

1. Normalise both hex strings to lowercase (or decode to bytes) before the
   constant-time compare, matching Go/Python. Keep the length check and the
   `timingSafeEqual` call.
2. Validate the amount in `canonicalInvoiceIdPayload`/`generateInvoiceId`
   (and document `createPayloadHash` expectations), mirroring Go `ValidateAmount`
   / Python `validate_amount` (positive, `<= 2^120 - 1`).

## Resolution (this PR)

1. **Case-insensitive hex webhook compare.** `verifyWebhook` now lowercases the
   provided signature (`provided.toLowerCase()`) before the constant-time
   `constantTimeEqual` against the already-lowercase computed digest. The length
   check and `crypto.timingSafeEqual` call are unchanged, so the compare stays
   constant-time. This matches the Go SDK (decodes both hex sides to bytes before
   `hmac.Equal`) and the Python SDK (lowercases both before `compare_digest`),
   so an uppercase-hex `v1=` signature is now accepted by all three SDKs while a
   same-length wrong signature is still rejected.
2. **Amount validated before hashing.** `canonicalInvoiceIdPayload` (and thus
   `generateInvoiceId`) now calls a new `validateInvoiceAmount(amountTbc)` guard
   that rejects non-`bigint`, non-positive (`<= 0`), and over-max
   (`> 2^120 - 1`, i.e. `MAX_TBC_NANOCOINS`) amounts, mirroring Go
   `ValidateAmount` / Python `validate_amount`. Because `amountTbc` is already a
   `bigint`, `toString()` is inherently canonical decimal, so only the range is
   checked. The TS SDK can no longer mint an id for an amount the rest of the
   protocol would refuse.

Regression tests: `sdk/tests/webhook.spec.ts` (uppercase-hex `v1=` accepted;
wrong same-length uppercase-hex still rejected), `sdk/tests/utils.spec.ts`
(non-positive and over-max amounts rejected; boundary `2^120 - 1` accepted).
Full SDK suite: 187 tests pass; build + lint clean (pre-existing warnings only).

`createPayloadHash` is intentionally left unguarded: it hashes an arbitrary
caller-supplied payload object (order id / memo), not a protocol amount, so a
range check does not apply. Its expectation (canonical-JSON-serialisable input)
is documented by `canonicalJson`'s own type checks.

## Acceptance Criteria

- [x] An uppercase-hex `v1=` signature that Go/Python accept is accepted by TS.
- [x] `generateInvoiceId` rejects non-positive / over-max amounts, matching
      Go/Python.
- [x] Regression tests cover both.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- Go/Python SDK webhook + amount validation for parity.

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/413
