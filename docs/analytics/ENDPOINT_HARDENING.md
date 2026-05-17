# Analytics Endpoint Hardening Track (post-B3)

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Engagement Prerequisite:** [B3 Production Monitoring & Alerting](../production/MONITORING.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **no aggregator code shipped until B3 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document collects every off-chain aggregator / endpoint change
planned for the analytics layer as part of production hardening.
The changes are intentionally **deferred** past the B3 monitoring
baseline — landing any of them before B3 returns verdict `READY`
would invalidate the audit scope and reset the engagement clock.

The pattern mirrors the F3 PR #206 (cross-chain bridge, issue #138),
F4 PR #207 (recurring payments, issue #139), F5 PR #208 (multi-sig
card, issue #140), and F6 PR #209 (DEX integrations, issue #141)
approaches: governance documents, off-chain validators, and tests
land now under issue #142; aggregator code lands later, in a
follow-up PR that explicitly cites this document and the B3 verdict.

Every other analytics production-readiness document
([`SPECIFICATION.md`](./SPECIFICATION.md),
[`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md),
[`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md),
[`PUBLIC_DASHBOARD.md`](./PUBLIC_DASHBOARD.md),
[`PRIVACY.md`](./PRIVACY.md),
[`MONITORING.md`](./MONITORING.md),
[`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md),
[`BUG_BOUNTY.md`](./BUG_BOUNTY.md)) references **AN-AH-N** items by
ID from §3 below — this is the single source of truth for the
aggregator changes the analytics production launch depends on.

---

## 2. Why deferred (not "future-work")

Issue #142 §7 names the off-chain security model as a **hard
prerequisite** for production rollout:

> _"Merchant analytics MUST NOT leak across merchants (IDOR), and
> public analytics MUST NOT re-identify individual users."_

The B3 engagement covers the off-chain surface (`api/`,
`backend/analytics/`, indexer read-replica) that the analytics
aggregators extend. B3 §6 covers the alerting envelope and the
endpoint-hardening review covers the IDOR / privacy edges.

Changing any line of `backend/analytics/merchantAggregator.ts`,
`backend/analytics/protocolAggregator.ts`, or
`backend/analytics/types.ts` ahead of the B3 audit:

1. Invalidates the auditor's review of the off-chain bundle hash.
2. Resets the clock on the threat-catalogue review (T-AN-1..T-AN-7
   from [`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).
3. Disqualifies the deployment manifest from the staging ceremony
   documented in [`TESTNET_INTEGRATION.md` §3](./TESTNET_INTEGRATION.md).

Therefore each AN-AH-N item below is **designed but not landed**
under issue #142. Landing happens in a follow-up issue referencing
this document, gated by the conditions in §4.

---

## 3. Hardening Backlog

Each row below has the same shape: the threat it closes, the
aggregator / endpoint diff in shape (not in literal code), and the
cross-document references that flip from "operationally mitigated"
to "closed in the aggregator" once the change ships.

### AN-AH-1 — Scope-binding middleware

**Closes threat:** T-AN-1 cross-merchant IDOR
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| `api/middleware/analytics-scope.ts` (new) | Extracts `merchantId` from `session.sub` **only**. If the request includes a `merchantId` in path, query, or body, reject with `ERROR_AN_FORBIDDEN_SCOPE = 3` (even when it matches the principal — defense-in-depth). |
| `backend/analytics/merchantAggregator.ts` contract | Aggregator signature requires `merchantId` as a typed parameter; the type is `Branded<string, 'PrincipalBoundMerchantId'>`. The branded type is constructible only from the scope-binding middleware. |
| Audit log | Every request emits `analytics.merchant.access { sub, range, hashedSub }`. |
| CI gate | `R-AN-AH-1` asserts no other code path constructs `PrincipalBoundMerchantId`. |

**Migration:** None — aggregator code lands only after the follow-up PR.

**Tests required at landing:** request with `?merchantId=<self>` rejected;
request with `?merchantId=<other>` rejected; request without `merchantId`
parameter resolves the principal's analytics; audit log line emitted.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-1](./SPECIFICATION.md) flips from
"operationally mitigated" to "closed in middleware";
[`MERCHANT_ANALYTICS.md` §3](./MERCHANT_ANALYTICS.md) cites this
middleware as the enforcement layer.

### AN-AH-2 — `K_ANONYMITY_FLOOR = 5` enforcement

**Closes threat:** T-AN-2 re-identification through low-k aggregates
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| `backend/analytics/protocolAggregator.ts` | `SELECT` clauses for `activeAccounts`, `invoicesCreated`, `invoicesSettled` carry a `HAVING COUNT(DISTINCT nft_address) >= 5` filter. When the filter excludes the bucket, the field is substituted with `null`. |
| `backend/analytics/merchantAggregator.ts` | `topCustomers` array is returned **empty** if fewer than 5 distinct customers contribute; partial population (e.g. 4 customers) is forbidden. |
| Privacy floor constant | `K_ANONYMITY_FLOOR = 5` (anchored in [`PRIVACY.md` §2](./PRIVACY.md)). |
| Alerting | An aggregate suppressed by the floor emits `AN-M08` informational alert. |
| CI gate | `R-AN-AH-2` greps both aggregators for the constant and the `HAVING` filter shape. |

**Migration:** None — first call after the follow-up PR enforces the floor.

**Tests required at landing:** a range with 4 distinct accounts yields
`activeAccounts: null`, `invoicesCreated: null`, etc. (entire envelope
nullified per [`PROTOCOL_ANALYTICS.md` §4](./PROTOCOL_ANALYTICS.md));
a range with exactly 5 distinct accounts yields populated fields;
`fraudLockEvents` / `collateralLockEvents` remain populated even when
the floor suppresses other fields (per [`PROTOCOL_ANALYTICS.md` §4](./PROTOCOL_ANALYTICS.md)).

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-2](./SPECIFICATION.md) flips to "closed in aggregator";
[`PRIVACY.md` §2.2](./PRIVACY.md) lists `protocolAggregator.ts` and
`merchantAggregator.ts` as enforcement points.

### AN-AH-3 — Query timeout + circuit breaker

**Closes threat:** T-AN-3 denial-of-service via expensive queries
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Aggregator query wrapper | Every `SELECT` runs with `statement_timeout = QUERY_TIMEOUT_MS = 5000 ms` set on the read-replica session. |
| Circuit breaker | After three consecutive timeouts within 60 s the aggregator opens the breaker for 30 s, returning `ERROR_AN_TIMEOUT = 1` immediately rather than queueing further queries. |
| Rate limit | Per-merchant and per-IP rate limit `RATE_LIMIT_REQUESTS_PER_MINUTE = 60`; excess returns `ERROR_AN_RATE_LIMITED = 6`. |
| Alerting | Circuit-breaker open emits `AN-M11`; rate-limit hit storm emits `AN-M09`. |
| CI gate | `R-AN-AH-3` asserts the `statement_timeout` and rate-limit constants match the anchor in `SPECIFICATION.md`. |

**Migration:** None.

**Tests required at landing:** a 6 s synthetic query returns `ERROR_AN_TIMEOUT`;
three consecutive timeouts open the breaker; the 61st request from a single
IP within 60 s receives `ERROR_AN_RATE_LIMITED` + `Retry-After`.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-3](./SPECIFICATION.md) flips to "closed in aggregator";
[`MONITORING.md` §3.4](./MONITORING.md) lists the breaker as the AN-M11 trigger source.

### AN-AH-4 — Read-replica isolation

**Closes threat:** T-AN-5 indexer compromise propagation
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Connection pool | `backend/analytics/replica-pool.ts` (new) — separate pool, separate credentials, separate Postgres role with `pg_read_all_data` only. |
| Network policy | Egress firewall rule limits the analytics pool to the replica host only; the main API pool cannot reach the replica and vice versa. |
| Aggregator contract | `backend/analytics/types.ts` exports `AnalyticsReplicaClient` distinct from `IndexerClient`; the aggregators cannot accept the latter. |
| Failure surfacing | A replica outage surfaces `ERROR_AN_BACKEND_DOWN = 9` rather than `ERROR_AN_TIMEOUT`. |
| CI gate | `R-AN-AH-4` greps aggregator code for `IndexerClient` references — any direct reference is a CI failure. |

**Migration:** None.

**Tests required at landing:** aggregator initialised with an `IndexerClient`
fails the TypeScript compile; the replica role rejects writes (verified in
an integration test); a replica outage surfaces `ERROR_AN_BACKEND_DOWN`.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-5](./SPECIFICATION.md) flips to "closed in aggregator";
[`SPECIFICATION.md` §4.2](./SPECIFICATION.md) read-replica isolation cited.

### AN-AH-5 — Privacy-preserving aggregation gate

**Closes threat:** T-AN-6 public dashboard PII exposure
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Output schema validator | The `/v1/analytics/protocol` response is validated against the `ProtocolAnalytics` JSON schema before serialisation; the schema forbids any field whose name matches `/address|sub|email|wallet|did/i`. Any matching field aborts the response with a `503 ERROR_AN_BACKEND_DOWN` and an incident. |
| Aggregator output linter | `backend/analytics/protocolAggregator.ts` compile-time check rejects any return path that includes a non-aggregated identifier column. |
| Audit-log redaction | The aggregator query logs hash any incidentally captured `nft_address` before persistence. |
| CI gate | `R-AN-AH-5` parses the `ProtocolAnalytics` schema and asserts no PII-bearing field name slipped in. |

**Migration:** None.

**Tests required at landing:** a synthetic regression that injects an
`nft_address` field into the response is rejected at schema-validate;
the corresponding incident is filed with the redacted offending field name.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-6](./SPECIFICATION.md) flips to "closed in aggregator";
[`PROTOCOL_ANALYTICS.md` §2](./PROTOCOL_ANALYTICS.md) cites the schema validator.

### AN-AH-6 — Cache key derivation + Vary header pinning

**Closes threat:** T-AN-7 cache poisoning via crafted Vary headers
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Cache key (merchant) | `sha256("merchant" || session.sub || range)` — derived **only** from authenticated principal + validated range. Never from user-supplied headers or query parameters other than the validated `range`. |
| Cache key (protocol) | `sha256("protocol" || range)` — derived only from the validated range. |
| `Vary` header | Hard-coded to `Accept-Encoding` only; the CDN strips any other `Vary` header from upstream before caching. |
| ETag | `sha256(range + computedAt + serialisedAggregate)` matches the body byte-for-byte. |
| CI gate | `R-AN-AH-5` (covers PII) and an additional response-header lint in the same gate assert the `Vary` value. |

**Migration:** None.

**Tests required at landing:** a request with `Vary: Cookie` injected at
the edge does NOT poison the cached entry; two requests with identical
range share the cached response; ETag matches the body hash.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-7](./SPECIFICATION.md) flips to "closed in aggregator";
[`PROTOCOL_ANALYTICS.md` §5](./PROTOCOL_ANALYTICS.md) cites the cache-key shape.

### AN-AH-7 — Auto-pause on indexer disconnect

**Closes threat:** T-AN-4 stale data leading to misleading dashboards
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Health probe | Aggregator polls the replica every `HEALTH_PROBE_INTERVAL_SECONDS = 60 s`. After `HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive failures the layer auto-pauses. |
| Pause behaviour | While paused, the aggregator returns the last-known good `computedAt` with `nextRefreshAt = computedAt` (no future refresh promised). The dashboard surfaces the degraded banner per [`PUBLIC_DASHBOARD.md` §4](./PUBLIC_DASHBOARD.md). |
| Resume | When the probe returns healthy for 2 minutes, the aggregator resumes the refresh schedule. |
| Alerting | Pause fires `AN-M12`; resume fires an informational rollup. |
| CI gate | `R-AN-AH-3` asserts the threshold and interval anchors match across `SPECIFICATION.md`, `MONITORING.md`, and the implementation file. |

**Migration:** None.

**Tests required at landing:** three consecutive probe failures pause the
layer; the dashboard surfaces the degraded banner within 180 s; after the
probe heals, resume occurs after 2 minutes of healthy probes.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-AN-4](./SPECIFICATION.md) flips to "closed in aggregator";
[`PUBLIC_DASHBOARD.md` §4](./PUBLIC_DASHBOARD.md) cites the pause behaviour.

---

## 4. Sign-off Gating

AN-AH-N items may only land in a follow-up PR after **all** of the
following conditions hold:

1. **B3 verdict.** B3 production monitoring engagement returns
   verdict `READY` and the corresponding `STATUS.md` is updated.
2. **No critical/high outstanding.** B3 final report lists zero open
   critical or high findings against the analytics sub-scope.
3. **Staging ceremony complete.** The deployment manifest from
   [`TESTNET_INTEGRATION.md` §3](./TESTNET_INTEGRATION.md) is
   committed and the end-to-end flow log captures both happy-path
   and error-path coverage (IDOR drills, privacy-floor drill).
4. **Analytics readiness validator green.**
   [`scripts/analytics/check-analytics-readiness.ts`](../../scripts/analytics/check-analytics-readiness.ts)
   reports `OK` on the proposed PR's branch.
5. **PR scope.** The follow-up PR contains **only** the AN-AH-N
   changes listed in this document (no new features). Each AN-AH-N
   is a separate commit; the PR body references the AN-AH-N IDs in
   1:1 correspondence with commits.

A PR that touches `backend/analytics/merchantAggregator.ts`,
`backend/analytics/protocolAggregator.ts`, or
`backend/analytics/types.ts` without satisfying all five conditions
must be rejected by the CI guardrail in §5.

---

## 5. CI Guardrail

The CI check at
[`scripts/analytics/check-analytics-readiness.ts`](../../scripts/analytics/check-analytics-readiness.ts)
(planned — issue #142, this PR) implements the following rules:

| Rule | Applies to | Action on violation |
|------|-----------|---------------------|
| **R-AN-AH-1** | Any PR touching `backend/analytics/merchantAggregator.ts` or `backend/analytics/protocolAggregator.ts` | Verify `docs/production/B3-monitoring/STATUS.md` shows `verdict: READY` and the audited commit matches the PR base. Fail otherwise. Verify the aggregator obtains `merchantId` only from a `PrincipalBoundMerchantId` constructed by the scope-binding middleware. |
| **R-AN-AH-2** | Any PR touching `docs/analytics/*.md` | Verify every `AN-AH-N` reference resolves to a §3 row here; verify `K_ANONYMITY_FLOOR = 5` is anchored consistently across `SPECIFICATION.md`, `PRIVACY.md`, `MERCHANT_ANALYTICS.md`, and `PROTOCOL_ANALYTICS.md`. Fail on dangling refs or drift. |
| **R-AN-AH-3** | Any PR touching `backend/analytics/*` or `docs/analytics/MONITORING.md` | Verify the numeric anchors (`ANALYTICS_REFRESH_INTERVAL_SECONDS`, `QUERY_TIMEOUT_MS`, `REPLICA_LAG_BUDGET_SECONDS`, `CACHE_TTL_SECONDS`, `HEALTH_PROBE_INTERVAL_SECONDS`, `HEALTH_PROBE_FAILURE_THRESHOLD`, `INDEXER_DISCONNECT_GRACE_SECONDS`, `RATE_LIMIT_REQUESTS_PER_MINUTE`, `DASHBOARD_LOAD_BUDGET_MS`, `ANALYTICS_QUERY_P95_BUDGET_MS`, `ANALYTICS_RETENTION_YEARS`, `IDEMPOTENCY_WINDOW_SECONDS`) match across `SPECIFICATION.md`, the aggregator source files, and `MONITORING.md`. |
| **R-AN-AH-4** | Any PR touching `backend/analytics/*` | Verify aggregator code never imports `IndexerClient` directly (only `AnalyticsReplicaClient`); verify aggregator query logs do not include raw `nft_address` / `sub` columns. |
| **R-AN-AH-5** | Release-tag workflow | Verify `/v1/analytics/protocol` response schema forbids any field name matching `/address\|sub\|email\|wallet\|did/i`; verify `Vary` header pinning to `Accept-Encoding` only. |

The validator is the analogue of
[`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts)
(F6),
[`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
(F5),
[`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
(F4), and
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(F3); it runs on every PR touching the analytics surface.

---

## 6. Cross-reference summary

| AN-AH-N | Closes | Where it is referenced |
|---------|--------|------------------------|
| **AN-AH-1** | T-AN-1 | [`SPECIFICATION.md` §7.3, §8](./SPECIFICATION.md), [`MERCHANT_ANALYTICS.md` §3](./MERCHANT_ANALYTICS.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **AN-AH-2** | T-AN-2 | [`SPECIFICATION.md` §4.4, §8](./SPECIFICATION.md), [`PRIVACY.md` §2](./PRIVACY.md), [`PROTOCOL_ANALYTICS.md` §4](./PROTOCOL_ANALYTICS.md), [`MERCHANT_ANALYTICS.md` §4](./MERCHANT_ANALYTICS.md) |
| **AN-AH-3** | T-AN-3 | [`SPECIFICATION.md` §4.3, §8](./SPECIFICATION.md), [`MONITORING.md` §3.4](./MONITORING.md) |
| **AN-AH-4** | T-AN-5 | [`SPECIFICATION.md` §4.2, §8](./SPECIFICATION.md) |
| **AN-AH-5** | T-AN-6 | [`SPECIFICATION.md` §7.5, §8](./SPECIFICATION.md), [`PROTOCOL_ANALYTICS.md` §2](./PROTOCOL_ANALYTICS.md) |
| **AN-AH-6** | T-AN-7 | [`SPECIFICATION.md` §4.1, §8](./SPECIFICATION.md), [`PROTOCOL_ANALYTICS.md` §5](./PROTOCOL_ANALYTICS.md) |
| **AN-AH-7** | T-AN-4 | [`SPECIFICATION.md` §6, §8](./SPECIFICATION.md), [`PUBLIC_DASHBOARD.md` §4](./PUBLIC_DASHBOARD.md), [`MONITORING.md` §3.4](./MONITORING.md) |

---

## 7. Acceptance criteria mapping (Issue #142 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | `docs/analytics/SPECIFICATION.md` written | §2, §4 — gates every AN-AH-N on B3 `verdict: READY`. |
| AC-2 | Merchant analytics endpoint implemented | AN-AH-1 hardens the scope binding the endpoint depends on. |
| AC-3 | Protocol analytics endpoint implemented | AN-AH-2, AN-AH-5, AN-AH-6 harden the privacy / cache envelope. |
| AC-4 | Merchant analytics section added to `dashboard/` | AN-AH-1, AN-AH-2 close the IDOR / k-anonymity invariants the dashboard relies on. |
| AC-5 | Public dashboard at `stats.tonbankcard.com` | AN-AH-6, AN-AH-7 close the cache / freshness invariants the public dashboard relies on. |
| AC-6 | All analytics sourced from indexer | AN-AH-4 enforces the read-replica isolation that operationalises AC-6. |
| AC-7 | IDOR protection tested | AN-AH-1 closes the IDOR primitive; testnet drill in [`TESTNET_INTEGRATION.md` §5.3](./TESTNET_INTEGRATION.md) exercises it. |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification           | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Merchant analytics      | [`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md) |
| Protocol analytics      | [`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md) |
| Public dashboard        | [`PUBLIC_DASHBOARD.md`](./PUBLIC_DASHBOARD.md) |
| Privacy posture         | [`PRIVACY.md`](./PRIVACY.md) |
| Monitoring catalogue    | [`MONITORING.md`](./MONITORING.md) |
| Testnet integration     | [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) |
| Bug bounty              | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| B3 monitoring engagement | [`docs/production/MONITORING.md`](../production/MONITORING.md) |
| Error code registry     | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned)  | [`scripts/analytics/check-analytics-readiness.ts`](../../scripts/analytics/check-analytics-readiness.ts) |
| Pattern: F6 validator   | [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts) |
| Pattern: F5 validator   | [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #142 (F7). |
