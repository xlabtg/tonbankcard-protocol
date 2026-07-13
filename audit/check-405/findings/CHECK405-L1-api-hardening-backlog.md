---
title: "API hardening backlog: unthrottled auth path, non-canonical amount strings, and metadata invoice_id shadowing"
severity: Low
area: api
priority: low
stage: 4-low
labels:
  - bug
  - audit
  - type:backend
  - priority:low
  - stage:4-low
  - package:api
  - track:D
---

## Summary

Three low-severity API correctness/hardening defects, grouped for step-by-step
remediation.

1. **Unthrottled authentication path.** Protected invoice routes place the
   per-key rate limiter **after** `authenticateWithPermission`, and there is no
   per-IP limiter in front of auth. Because `authenticateWithPermission` responds
   directly and never calls `next()` on failure, a failed request never reaches
   any limiter — the API-key validation path is un-rate-limited.
2. **Non-canonical amount strings accepted and stored verbatim.**
   `validateAmount` parses with `BigInt(amountTbc)`, which accepts hex (`0x10`),
   octal (`0o17`), binary (`0b101`), surrounding whitespace, a leading `+`, and
   leading zeros. The original string is stored verbatim and later compared
   **exactly** against the on-chain event amount, so such an invoice can never
   settle.
3. **Metadata key `invoice_id` shadows the canonical id in the payload hash.**
   `hashMetadata({ invoice_id: invoice.invoice_id, ...invoice.metadata })` spreads
   metadata **after** `invoice_id`, so a metadata key literally named
   `invoice_id` overrides the canonical invoice id in the hashed object.
   `validateMetadata`'s key regex `/^[a-zA-Z0-9_]+$/` allows the key.

## Severity & Category

- Severity: Low
- Category: Rate-limiting / input canonicalisation / hashing hygiene

## Affected Code

1. `api/src/routes/invoiceRoutes.ts:264-291` (limiters mounted after auth on
   protected routes; only the public GET has `publicIpRateLimiter`);
   `api/src/routes/invoiceRoutes.ts:171-205` (`authenticateWithPermission`
   returns via `sendErrorResponse` without `next()` on failure);
   `api/src/middleware/rateLimiter.ts` docstring describing the intended layering.
2. `api/src/utils/validation.ts:112-156` (`validateAmount` — `BigInt(amountTbc)`);
   `api/src/services/InvoiceService.ts:283` (stores `request.amount_tbc`
   verbatim); `api/src/services/InvoiceService.ts:657-660` (exact string compare
   `invoice.amount_tbc !== event.amount_tbc`).
3. `api/src/utils/helpers.ts:141-144` (`hashMetadata`);
   `api/src/services/InvoiceService.ts:663-666` (spread order);
   `api/src/utils/validation.ts:192` (key regex allows `invoice_id`).

## Description

1. An attacker can hammer `POST /v1/invoice/create` (or `/status`, `/detail`)
   with invalid keys without ever hitting a limiter, since the limiter middleware
   sits downstream of the auth middleware that short-circuits on failure. This
   contradicts the layering documented in `rateLimiter.ts` and gives an
   unbounded API-key brute-force / CPU-burn surface (each attempt does a key
   hash lookup).
2. `BigInt('0x10')` is `16`, `BigInt(' 16 ')` is `16`, `BigInt('007')` is `7` —
   all pass `validateAmount`, but the raw string (`"0x10"`, `" 16 "`, `"007"`)
   is what gets stored and later exact-string-compared to the settlement event's
   decimal amount, so the invoice is permanently un-settleable.
3. If metadata contains `{"invoice_id":"attacker-chosen"}`, the object hashed by
   `hashMetadata` uses the attacker's value instead of the real invoice id,
   decoupling the on-chain payload hash from the canonical id.

## Impact

- Low individually: (1) is a DoS/brute-force hardening gap, (2) and (3) are
  correctness footguns that make specific invoices un-settleable or weaken the
  id↔payload-hash binding. None breaches funds or the non-custodial guarantee.

## Suggested Fix

1. Add a per-IP limiter in front of `authenticateWithPermission` on protected
   routes (or have failed auth fall through to a limiter), so auth attempts are
   throttled regardless of outcome.
2. In `validateAmount`, require a canonical decimal form (`/^[1-9][0-9]*$/`, or
   `0` handled explicitly) before the `BigInt` parse, or store the normalised
   `amount.toString()`. Apply consistently with the settlement compare.
3. Build the hashed object as `{ ...invoice.metadata, invoice_id: invoice.invoice_id }`
   (canonical id wins) and/or reject a metadata key named `invoice_id` in
   `validateMetadata`.

## Resolution (this PR)

1. **Auth path throttled.** Added `authFailureRateLimiter` (per-IP, configurable
   via `RATE_LIMIT_AUTH_FAIL_PER_MIN`, default 10) mounted *in front of*
   `authenticateWithPermission` on all three protected routes. It uses
   `skipSuccessfulRequests: true`, so only error responses accrue against the
   per-IP budget — failed-auth brute-force is capped while legitimate
   high-volume authenticated traffic (which flows at the far higher per-key
   rates) is never penalised.
2. **Canonical amounts enforced.** `validateAmount` now rejects any value that
   is not `^[1-9][0-9]*$` (after the existing parse/positivity/max checks, so
   `0`/`abc` keep their friendlier messages). `0x10`/`0o17`/`0b101`/`" 16 "`/
   `+16`/`007` are rejected, guaranteeing the stored string equals the plain
   decimal the settlement path compares against.
3. **`invoice_id` metadata key reserved.** `validateMetadata` rejects a metadata
   key literally named `invoice_id`, and the settlement hash is built as
   `{ ...invoice.metadata, invoice_id: invoice.invoice_id }` so the canonical id
   always wins even for legacy data (defense-in-depth). Existing golden-vector
   hashes are unchanged because `canonicalize` sorts keys.

Regression tests: `api/tests/validation.test.ts` (canonical amounts + reserved
key), `api/tests/rateLimiter.test.ts` (failures throttled, successes skipped).
Full API suite: 313 tests pass.

## Acceptance Criteria

- [x] Repeated failed-auth requests are rate-limited.
- [x] `validateAmount` rejects `0x10`/`0o17`/`" 16 "`/`007` (or the stored value
      is normalised to decimal), and settlement matching still works.
- [x] A metadata `invoice_id` key cannot override the canonical id in the hash.
- [x] Regression tests cover all three.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- `api/src/middleware/rateLimiter.ts`, `audit/THREAT_MODEL.md`.

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/412
