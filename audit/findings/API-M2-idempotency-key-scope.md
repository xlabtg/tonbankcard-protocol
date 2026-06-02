---
title: "[API-M2] Idempotency key omits expires_at and is not scoped to the API key"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","priority:medium","stage:3-medium"]
---

## Summary

The idempotency key for invoice creation hashes only a subset of inputs and excludes `expires_at`, so two otherwise-identical creates with different expiries collide. The second returns the first invoice with the old expiry, silently dropping the requested value. The key is also not scoped to the API key / merchant identity.

## Severity & Category

- Severity: Medium
- Category: Idempotency Correctness

## Affected Code

- `api/src/utils/helpers.ts:35-45` (hashes only `merchant_nft`, `amount_tbc`, `currency`, `metadata`)
- `api/src/services/InvoiceService.ts:149,152-158,170` (idempotency usage)

## Description

The idempotency hash (`helpers.ts:35-45`) is computed from `merchant_nft`, `amount_tbc`, `currency`, and `metadata` only. It omits `expires_at`. As a result, two create requests that are identical except for `expires_at` produce the same key. The second request (`InvoiceService.ts:149,152-158,170`) returns the previously created invoice with its original expiry, silently discarding the new requested expiry.

The key is also not bound to the requesting `key_id`, so it is not scoped to a single merchant identity.

## Impact

- A merchant requesting a new invoice with a different expiry silently receives a stale invoice with the wrong expiry.
- Lack of key scoping means idempotency is not bound to the authenticated identity.

## Suggested Fix

- Include `expires_at` (or, preferably, an explicit client-supplied idempotency key) in the hash.
- Scope the idempotency key to the merchant identity (`key_id` / `merchant_nft`).

## Acceptance Criteria

- [ ] Two creates differing only in `expires_at` produce distinct results (no silent reuse).
- [ ] The idempotency key is scoped to the authenticated merchant identity.
- [ ] Regression test: identical payloads with differing `expires_at` yield invoices with their respective expiries.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#270](https://github.com/xlabtg/tonbankcard-protocol/issues/270)
