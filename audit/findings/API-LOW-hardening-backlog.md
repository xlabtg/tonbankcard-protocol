---
title: "[API-LOW] Hardening backlog (Low / Info findings)"
severity: low
area: backend
priority: low
stage: 4
labels: ["bug","audit","type:backend","type:security","priority:low","stage:4-low"]
---

## Summary

Consolidated backlog of Low and Informational findings from the API service security audit. Each subsection is independently actionable. None are individually severe, but addressing them improves correctness, hygiene, and production-readiness consistent with the non-custodial design (the API is informational; the blockchain remains the single source of truth).

## Severity & Category

- Severity: Low / Informational
- Category: Hardening / Hygiene / Consistency

## Affected Code

See each subsection below for repo-relative `file:line` references.

## Description

### L1. Sandbox API key violates the canonical key format and bypasses validation

Affected: `api/src/middleware/sandbox.ts:47`, `api/src/middleware/sandbox.ts:90-100`

The public sandbox key does not match the canonical key pattern, and it is registered while skipping format validation.

```ts
// sandbox.ts:47
PUBLIC_SANDBOX_API_KEY = 'tbck_sandbox_public_anonymous_key'
// does not match API_KEY_PATTERN tbc_(live|test)_[0-9a-f]{32}
// (prefix is 'tbck_' with an extra 'k')
```

`ensureSandboxKeyRegistered` (`sandbox.ts:90-100`) calls `registerApiKey` directly, bypassing `isValidApiKeyFormat`.

Impact: the sandbox key diverges from the canonical format and circumvents the validation path, masking format regressions.

Suggested fix: use a conformant `tbc_test_<32hex>` value and register it through the standard validation path.

Acceptance criteria:
- [ ] Sandbox key matches `tbc_(live|test)_[0-9a-f]{32}`.
- [ ] Sandbox key registration passes through `isValidApiKeyFormat`.
- [ ] Regression test: the configured sandbox key satisfies `isValidApiKeyFormat`.

### L2. Dead/unreachable authenticated read limiter and deprecated alias

Affected: `api/src/routes/invoiceRoutes.ts:226`, `api/src/routes/invoiceRoutes.ts:162-164`

```ts
// invoiceRoutes.ts:226
void invoiceReadRateLimiter; // never wired to a route
// invoiceRoutes.ts:162-164: authenticateApiKey deprecated alias, no callers
```

The `invoice:read` scope is never enforced because the limiter is unused, and a deprecated `authenticateApiKey` alias has no callers.

Impact: dead code and an unenforced scope create confusion and a false sense of coverage.

Suggested fix: wire an authenticated read route that uses the limiter and enforces `invoice:read`, or remove the unused limiter and deprecated alias.

Acceptance criteria:
- [ ] No unused rate limiter or deprecated alias remains, or both are wired into a real authenticated read route.
- [ ] `invoice:read` scope is either enforced or removed.
- [ ] Regression test: lint/coverage confirms no dead `void`-discarded limiter remains.

### L3. validateWhitelistedNFT echoes the full whitelist in error details

Affected: `api/src/utils/validation.ts:90-100`, `api/src/middleware/errorHandler.ts:37-47`

```ts
// validation.ts:90-100
// NFT_NOT_WHITELISTED error details include
// whitelistedCollections: WHITELISTED_NFT_COLLECTIONS
```

`sanitiseDetails` in `errorHandler.ts:37-47` does not strip this field, so the full accepted-collection set is disclosed to any caller.

Impact: information disclosure of the complete whitelisted-collection set to unauthenticated/arbitrary callers.

Suggested fix: do not include the whitelist in client-facing error details (omit it or strip it in `sanitiseDetails`).

Acceptance criteria:
- [ ] `NFT_NOT_WHITELISTED` responses do not include the full whitelist.
- [ ] Regression test: a not-whitelisted error response contains no `whitelistedCollections` field.

### I1. Auth cache freshness inconsistency

Affected: `api/src/services/ApiKeyService.ts:40-165`, `api/src/services/InvoiceService.ts:134`

`isAuthorizedMerchant` caches positive results for 60s, while `findAndValidateKey` is uncached, producing two freshness semantics for the same key. Acceptable for a reference implementation, but it should be documented and aligned before production, and all cache entries for a key should be flushed on revocation.

Impact: a revoked key could remain authorized for up to the cache TTL via the cached path.

Suggested fix: align the freshness semantics of the two paths; flush all cache entries for a key on revocation; document the chosen behavior.

Acceptance criteria:
- [ ] Cache invalidation on revocation removes all cached entries for the affected key.
- [ ] Freshness behavior is documented.
- [ ] Regression test: a key revoked while cached is rejected on the next authorization check.

### I2. In-memory storage: unbounded growth and non-atomic idempotency

Affected: `api/src/storage/InMemoryStorage.ts`, `api/src/storage/IStorage.ts:90-98`, `api/src/services/InvoiceService.ts:532`

The in-memory storage grows unbounded, and `IStorage.ts:90-98` documents a non-atomic check-and-set race that can produce duplicate invoices. The singleton `invoiceService` (`InvoiceService.ts:532`) defaults to this storage.

Impact: memory exhaustion over time and duplicate invoices under concurrent creates when no durable storage is configured.

Suggested fix: fail fast in production if durable storage is not configured; implement atomic set-if-absent for idempotency.

Acceptance criteria:
- [ ] Production boot fails fast when durable storage is not configured.
- [ ] Idempotent create uses an atomic set-if-absent operation.
- [ ] Regression test: concurrent identical creates produce exactly one invoice.

## Impact

Individually low; collectively these reduce correctness, leak minor information, and impede safe production deployment. They do not affect the non-custodial guarantee but should be resolved as part of production hardening.

## Suggested Fix

Address each subsection per its stated fix; track as a hardening backlog.

## Acceptance Criteria

- [ ] L1 resolved (sandbox key conformant and validated).
- [ ] L2 resolved (no dead limiter/alias; read scope enforced or removed).
- [ ] L3 resolved (whitelist not disclosed in errors).
- [ ] I1 resolved (cache freshness aligned; revocation flushes cache).
- [ ] I2 resolved (durable-storage guard; atomic idempotency).
- [ ] Regression tests added for each item as listed in its subsection.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/INVARIANTS.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#296](https://github.com/xlabtg/tonbankcard-protocol/issues/296)
