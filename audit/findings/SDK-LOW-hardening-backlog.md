---
title: "[SDK-LOW] SDK hardening backlog (Low / Info findings)"
severity: low
area: sdk
priority: low
stage: 4
labels: ["bug","audit","type:sdk","type:security","priority:low","stage:4-low"]
---

## Summary

This file consolidates the Low and Info severity findings from the SDK audit (TypeScript, Go, Python). Each subsection is an independently actionable hardening item. None is individually critical, but together they reduce surprising mutation behaviour, fix boundary handling, and close consistency gaps between the three SDKs and the server.

## Severity & Category

- Severity: Low / Info
- Category: Hardening, boundary correctness, cross-SDK consistency

## Affected Code

- `sdk/src/sdk.ts` (invoice construction / metadata handling)
- `sdk/src/utils.ts` (`isExpired` and helpers)
- `sdk-go/models.go`
- `sdk-python/src/tonbankcard_merchant/models.py`

## Description

The detailed findings, impact, and fixes are captured per subsection below.

### L-1: Metadata object is mutated in place rather than copied

- Affected: `sdk/src/sdk.ts` (invoice construction in `createInvoice`, around `sdk/src/sdk.ts:84-95`)
- Description: The caller-supplied `metadata` object is assigned by reference onto the invoice instead of being copied, so subsequent SDK or caller mutations of one are visible in the other.
- Impact: A caller that reuses or later mutates its metadata object can unexpectedly alter the stored invoice (and vice versa), producing hard-to-trace bugs.
- Suggested fix: Deep-copy `metadata` when constructing the invoice so the invoice holds an independent snapshot.
- Acceptance: Mutating the caller's metadata after `createInvoice` does not change the invoice's metadata; regression test covers this.

### L-2: isExpired mishandles the zero / last-second expiry boundary

- Affected: `sdk/src/utils.ts:124-129` (`isExpired`); related read at `sdk/src/sdk.ts:155`
- Description: `isExpired` treats a falsy `expiresAt` (including `0`) as "never expires" via `if (!expiresAt) return false`, and uses a strict `<` comparison against `Date.now() / 1000`, so the exact expiry second is treated inconsistently with the server and with an `expiresAt` of `0`.
- Impact: Edge-case invoices (expiry at epoch 0, or evaluated exactly on the expiry second) are classified inconsistently across the SDK and server.
- Suggested fix: Distinguish "no expiry" (e.g. `undefined`) from an explicit `0`, and define a single boundary convention (inclusive vs exclusive of the expiry second) consistent with the server, applying it everywhere expiry is evaluated.
- Acceptance: `isExpired` handles `expiresAt === 0` and the exact-second boundary per the documented convention; regression tests cover both edges.

### L-3: Status enum values diverge between TS, Go, Python, and the server

- Affected: `sdk-python/src/tonbankcard_merchant/models.py:28-33` (`InvoiceStatus`); `sdk-go/models.go` (`InvoiceStatus`); TS `PaymentStatus` in `sdk/src/types.ts`
- Description: The invoice/payment status enumerations are defined independently per SDK and are not guaranteed to use identical string values as the server, risking mismatched comparisons.
- Impact: A status emitted by the server may not equal the SDK's enum value, causing status checks to silently fail or misclassify invoices.
- Suggested fix: Define a single shared, documented status enum (canonical string values) and have all three SDKs and the server reference it.
- Acceptance: All SDKs use identical status string values matching the server; a regression test asserts each server status maps to the SDK enum.

### L-4: Inconsistent error types across SDKs

- Affected: `sdk/src/sdk.ts`, `sdk-go/webhooks.go`, `sdk-python/src/tonbankcard_merchant/models.py`
- Description: Errors are raised inconsistently (e.g. generic `Error` strings in TS vs typed sentinel errors in Go/Python), making programmatic error handling differ by language.
- Impact: Integrators cannot rely on a uniform, catchable error taxonomy across SDKs.
- Suggested fix: Align on a consistent error taxonomy per language idiom (typed/wrapped errors), with equivalent categories across SDKs.
- Acceptance: Each SDK exposes catchable, categorized error types for the same failure classes; regression tests assert error categories.

### L-5: Missing input trimming / normalization

- Affected: `sdk-go/models.go`, `sdk-python/src/tonbankcard_merchant/models.py`, `sdk/src/sdk.ts`
- Description: Address and amount inputs are validated without first trimming surrounding whitespace or normalizing form, so a value with stray whitespace is rejected even when otherwise valid.
- Impact: Cosmetically-imperfect but valid inputs are rejected, harming usability.
- Suggested fix: Trim and normalize inputs (whitespace, case where applicable) before validation, consistently across SDKs.
- Acceptance: Inputs with surrounding whitespace validate after normalization; regression tests cover trimmed inputs.

### I-1: Documentation and example drift

- Affected: SDK README/examples and inline docs referencing the webhook scheme and helpers (e.g. `sdk-go/webhooks.go:13-33`, `sdk-python/src/tonbankcard_merchant/webhooks.py:1-17`)
- Description: SDK docs/examples describe a body-only `sha256=`-prefixed signature scheme that does not match the server's `t=<ts>,v1=<...>` scheme (see SDK-C1), and other examples may drift from current APIs.
- Impact: Integrators follow incorrect guidance, reinforcing the broken verification path and other stale usage.
- Suggested fix: Update SDK documentation and examples to the canonical webhook scheme and current APIs once SDK-C1 is fixed.
- Acceptance: Docs/examples describe the `t=<ts>,v1=<HMAC-SHA256(secret,"${ts}.${rawBody}")>` scheme and current APIs; an example is exercised by a test or lint check.

## Impact

Individually low, these items reduce surprising side effects (in-place mutation), fix boundary inconsistencies (expiry), and remove divergence between the three SDKs and the server (status enums, error types, input handling, documentation). Addressing them improves cross-SDK consistency and integrator experience.

## Suggested Fix

Apply the per-subsection fixes above. Prioritize L-3 (shared status enum) and I-1 (documentation alignment with the webhook scheme) as they most directly affect cross-SDK and SDK-vs-server consistency.

## Acceptance Criteria

- [ ] L-1: Invoice metadata is deep-copied; caller mutations do not affect the invoice (regression test).
- [ ] L-2: `isExpired` handles the `0` and exact-second boundaries per a single documented convention (regression test).
- [ ] L-3: All SDKs and the server share identical status enum string values (regression test).
- [ ] L-4: Each SDK exposes a consistent, catchable error taxonomy (regression test).
- [ ] L-5: Inputs are trimmed/normalized before validation across SDKs (regression test).
- [ ] I-1: SDK docs/examples are updated to the canonical webhook scheme and current APIs.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/INVARIANTS.md`
- `api/src/utils/webhookSignature.ts`

---

**Tracking issue:** [#301](https://github.com/xlabtg/tonbankcard-protocol/issues/301)
