---
title: "[INDEXER-LOW] Indexer hardening backlog (L1-L7)"
severity: low
area: backend
priority: low
stage: 4
labels: ["bug","audit","type:backend","type:security","priority:low","stage:4-low"]
---

## Summary

A consolidated backlog of low-severity and informational hardening items found during the backend/indexer audit. Each subsection is independently actionable. The blockchain is the single source of truth; indexed/reported state should mirror on-chain truth and avoid leaking or fabricating data.

## Severity & Category

- Severity: Low / Informational
- Category: Hardening, hygiene, observability, and minor security (some items are security-relevant: L2, L4)

## Affected Code

See each subsection for repo-relative paths.

## Description

### L1. Payment `confirmedAt` is fabricated from the event timestamp

`backend/indexer/src/api/routes.ts:117-129` sets `confirmedAt: payment.timestamp`, which is the original payment time, not the time at which the required confirmation depth was reached.

```ts
// backend/indexer/src/api/routes.ts:117-129
// confirmedAt: payment.timestamp  // == original payment time, not confirmation time
```

Suggested fix: omit `confirmedAt`, or compute it from the confirming block's timestamp.

### L2. CORS allows all origins and getClientIp trusts client headers for rate-limit keying

`backend/indexer/src/api/server.ts:132-137` sets `Access-Control-Allow-Origin: *` (intentional for a public read API), but `backend/indexer/src/api/server.ts:29-47` derives the client IP in a spoofable way when `trustProxy` is enabled.

```ts
// backend/indexer/src/api/server.ts:38  leftmost X-Forwarded-For (spoofable)
// backend/indexer/src/api/server.ts:31  blindly trusts cf-connecting-ip
```

An attacker can rotate these headers to evade the per-IP rate limiter. Suggested fix: derive the client IP from the rightmost untrusted hop based on a configured trusted-proxy count.

### L3. getBlockByNumber uses bare fetch (no retry/timeout)

`backend/indexer/src/services/indexer-service.ts:605` and `:625` use bare `fetch`, whereas `fetchContractTransactions` uses `fetchWithRetry` (`:289-345`). A hung connection can block the sync loop indefinitely.

Suggested fix: route block lookups through `fetchWithRetry` (with timeout).

### L4. API key passed as a URL query parameter (leaks into logs)

The API key is sent as an `api_key` query parameter at `backend/indexer/src/services/indexer-service.ts:365-367`, `:379`, `:596-603`, `:622-623`, and the retry path logs the full URL including `api_key` at `:312-315`, even though `backend/indexer/src/index.ts:35` masks it in config logging.

Suggested fix: send the key via an HTTP header where supported, and redact `api_key` from any logged URLs.

### L5. Dead code / unused parser surface

`backend/indexer/src/parsers/event-parser.ts:673-683` (`identifyEventType` returns `null`, `parseCellData` returns `{}`) and `:556-642` (legacy `parse*` methods) are unused; `backend/indexer/src/services/indexer-service.ts:675-677` (`getBlockTransactions` never used; `getBlockByNumber` always sets `transactions: []`).

Suggested fix: remove the dead code, or wire the methods in if they are intended to be used.

### L6. Migration ordering relies on localeCompare

`backend/indexer/src/db/sync-migrate.ts:52` and `backend/indexer/src/db/migrator.ts:116` sort with `a.version.localeCompare(b.version, 'en')` over `\d{3,}` version strings, so `"100"` sorts before `"99"` lexicographically. Latent today (only `001`/`002` exist).

Suggested fix: sort numerically, or enforce fixed-width zero-padded version strings.

### L7. provider:'ChangeNOW' hardcoded in recurring adapter errors

`backend/adapters/recurring.ts:279-285` hardcodes `provider: 'ChangeNOW'` in `createError` for a recurring-payments adapter, producing misleading error metadata.

Suggested fix: use a provider-neutral value or the actual provider.

## Impact

- L2, L4: minor security exposure (rate-limit evasion; credential leakage into logs).
- L1, L7: misleading API/error metadata.
- L3: potential sync-loop stalls on hung connections.
- L5, L6: maintainability and latent correctness risk.

## Suggested Fix

Address each subsection as noted above. Items L2 and L4 should be prioritized within this backlog due to their security relevance.

## Acceptance Criteria

- [ ] L1: `confirmedAt` is removed or computed from the confirming block.
- [ ] L2: client IP for rate limiting is derived from the rightmost untrusted hop via configured trusted-proxy count.
- [ ] L3: block lookups use `fetchWithRetry` with a timeout.
- [ ] L4: API key sent via header where supported; `api_key` redacted from logged URLs.
- [ ] L5: dead parser/service methods removed or wired in.
- [ ] L6: migrations are ordered numerically (or versions are fixed-width zero-padded).
- [ ] L7: recurring adapter errors use a provider-neutral or correct provider value.
- [ ] A regression test covers the security-relevant items (L2 header spoofing, L4 redaction) and migration ordering (L6).

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#297](https://github.com/xlabtg/tonbankcard-protocol/issues/297)
