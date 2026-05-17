# Analytics & Reporting — Production Specification

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Engagement Prerequisite:** [B3 Production Monitoring & Alerting](../production/MONITORING.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **endpoint rollout gated on B3 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the production
behaviour of the off-chain analytics layer that surfaces merchant-scoped
and protocol-wide statistics derived from the payment indexer
(`backend/indexer/`). The layer comprises three modules:

- the **shared `AnalyticsAdapter` interface** every aggregator consumer
  implements,
- the **merchant analytics endpoint** (`GET /v1/analytics/merchant`,
  authenticated, IDOR-scoped),
- the **protocol analytics endpoint** (`GET /v1/analytics/protocol`,
  public, privacy-preserving aggregates),
- the **public dashboard** (`stats.tonbankcard.com`) that consumes the
  protocol endpoint via CDN-cached fetch,
- the **privacy posture** (k-anonymity floor, address truncation,
  opt-out) every aggregate must satisfy before publication.

The on-chain TBC token, NFT collections, and Merchant Payment Hub are
**not modified** by Issue #142 — analytics is a read-only side-car that
ingests indexed events. Issue #142 only introduces *off-chain* aggregator
modules, the two API endpoints, and the public dashboard.

> **Why a specification first.** Issue #142 §7 requires that merchant
> analytics never leaks across tenants (IDOR), that public aggregates
> never re-identify individual users, and that the dashboard refreshes
> at least every 10 minutes without degrading the main API performance.
> Those properties are easier to audit against a written specification
> than against drifting TypeScript. This document therefore freezes the
> contract the aggregator and endpoints must honour while the B3 review
> is in progress.

---

## 2. Acceptance criterion this artifact satisfies

Issue #142 §8 — _"`docs/analytics/SPECIFICATION.md` written"_ (**AC-1**) and
_"merchant + protocol analytics endpoints implemented"_ (**AC-2**, **AC-3**
landing prerequisite).

The specification additionally provides the interface anchor that the
merchant analytics (AC-2), protocol analytics (AC-3), dashboard
integration (AC-4), public dashboard deployment (AC-5), indexer
provenance (AC-6), and IDOR-protection (AC-7) acceptance criteria refer
to. Drift between this document and the aggregator sources is itself a
CI-blocking defect — `scripts/analytics/check-analytics-readiness.ts`
asserts the binding.

---

## 3. Shared `AnalyticsAdapter` interface

Every aggregator consumer MUST implement the four methods below. The
interface lives in `backend/analytics/types.ts` next to the existing
`PaymentProviderAdapter`, `LendingAdapter`, and `DexAdapter` interfaces
and is exported from `backend/analytics/index.ts`.

### 3.1 `getMerchantAnalytics(merchantId, range)` — authenticated merchant view

Returns the merchant-scoped analytics envelope for the requested
`range` (one of `7d`, `30d`, `90d`, `365d`). The adapter MUST refuse to
return data for any `merchantId` other than the one bound in the
authenticated session and MUST surface `ERROR_AN_FORBIDDEN_SCOPE`
instead. Stale data (last indexer event older than
`INDEXER_DISCONNECT_GRACE_SECONDS = 180 s`) MUST surface
`ERROR_AN_INDEXER_LAG`.

### 3.2 `getProtocolAnalytics(range)` — public protocol view

Returns a `ProtocolAnalytics` envelope carrying:

| Field | Type | Meaning |
|-------|------|---------|
| `range` | `'7d' \| '30d' \| 'all-time'` | The window the aggregates describe |
| `totalValueTransferred` | `bigint` | Sum of `MerchantPayment.amount` plus `InternalTransferEvent.amount` over the range, in TBC smallest unit |
| `activeAccounts` | `number` | Distinct `nft_address` count with at least one transaction in the range |
| `fraudLockEvents` | `number` | Count of `AccountLocked{reason=FRAUD_LOCK}` events |
| `collateralLockEvents` | `number` | Count of `AccountLocked{reason=COLLATERAL_LOCK}` events |
| `invoicesCreated` | `number` | Count of `InvoiceCreated` events |
| `invoicesSettled` | `number` | Count of `InvoiceSettled` events |
| `dexSwapVolume` | `bigint` | Sum of `SwapExecuted.amountOut` (post-fee) over the range, in TBC smallest unit |
| `computedAt` | `number` | Aggregation sampling time (Unix seconds) |
| `nextRefreshAt` | `number` | Earliest next refresh time (Unix seconds) |

Aggregates are **idempotent**: invoking `getProtocolAnalytics` MUST NOT
mutate any indexer state. The adapter MUST honour
`QUERY_TIMEOUT_MS = 5000 ms` per Issue #142 §6 and surface
`ERROR_AN_TIMEOUT` if the read-replica does not answer within that
window.

### 3.3 `refresh()` — recompute aggregates

Recomputes the merchant and protocol aggregates from the indexer
read-replica. The adapter MUST:

1. Honour `ANALYTICS_REFRESH_INTERVAL_SECONDS = 600 s` between
   refreshes (Issue #142 §5.4); manual `refresh()` calls SHOULD be
   debounced to no more than one per 60 s.
2. Compute aggregates in a single transaction against the read-replica
   and write the result to the analytics cache.
3. Surface `ERROR_AN_BACKEND_DOWN` if the read-replica is unreachable
   after three retries with exponential backoff.
4. Emit a `DASHBOARD_REFRESH` event on the metrics bus on success;
   `DASHBOARD_REFRESH_FAILED` on failure (alerts `AN-M01` /
   `AN-M06`, `docs/analytics/MONITORING.md` §3).

### 3.4 `healthCheck()` — operational probe

Returns `'healthy' | 'degraded' | 'down'` based on
`HEALTH_PROBE_INTERVAL_SECONDS = 60` cadence and a failure threshold of
`HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive failures before the
analytics layer auto-pauses.

---

## 4. Routing and caching plane

### 4.1 Cache strategy

Both endpoints sit behind a cache layer with TTL =
`CACHE_TTL_SECONDS = 600 s` and a stale-while-revalidate window of
`CACHE_STALE_WHILE_REVALIDATE_SECONDS = 120 s`. Cache hit ratio must
stay above 80 % (alert `AN-M05`).

### 4.2 Read-replica isolation

Analytics queries hit a dedicated read-replica per
`docs/analytics/ENDPOINT_HARDENING.md` §3 (AN-AH-4). The main
merchant API MUST NOT share connections with the analytics replica.
Replica lag is bounded by
`REPLICA_LAG_BUDGET_SECONDS = 60 s` (alert `AN-M10`).

### 4.3 Rate limiting

Per merchant: `RATE_LIMIT_REQUESTS_PER_MINUTE = 60`. Public protocol
endpoint: same ceiling per source IP. Rate limit follows
[D4 Rate Limiting & DDoS Protection](../merchant-api-security.md).

### 4.4 Privacy floor

No public aggregate is published until `K_ANONYMITY_FLOOR = 5`
distinct underlying entities contribute. Aggregates below the floor
surface as `null` (and emit alert `AN-M08`).

### 4.5 Retention

Analytics aggregates are retained for `ANALYTICS_RETENTION_YEARS = 3`
years per Issue #142 §6.

---

## 5. Performance budget

| Surface | P50 | P95 | P99 | Anchor |
|---|---:|---:|---:|---|
| Merchant endpoint | 200 ms | 1000 ms | 2000 ms | Issue #142 §6 |
| Protocol endpoint | 100 ms | 500 ms | 1000 ms | Issue #142 §6 |
| Public dashboard load | 800 ms | 2000 ms | 3000 ms | Issue #142 §6 |
| Analytics query P95 | — | `ANALYTICS_QUERY_P95_BUDGET_MS = 2000 ms` | — | Issue #142 §6 |
| Indexer overhead | — | ≤ 10 % CPU added to indexer host | — | Issue #142 §6 |

Latency drifts above the P95 budget fire `AN-M02` (merchant) /
`AN-M07` (dashboard). `DASHBOARD_LOAD_BUDGET_MS = 2000 ms` is the
public commitment from Issue #142 §6.

---

## 6. Refresh cadence and freshness

| Property | Value | Anchor |
|---|---|---|
| `ANALYTICS_REFRESH_INTERVAL_SECONDS` | `600` | Issue #142 §5.4 |
| Drift before alert | > 600 s of staleness | `AN-M01` |
| `INDEXER_DISCONNECT_GRACE_SECONDS` | `180` | Auto-pause threshold |
| Auto-pause | After `HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive failures | AN-AH-7 |

Manual `refresh()` is permitted but debounced to one call per 60 s; it
does **not** reset the cadence timer.

---

## 7. Security model

### 7.1 Threat catalogue

The analytics layer enumerates seven canonical threats. Each maps to a
hardening item in §8 and a CI guardrail in
[`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §5.

- **T-AN-1** — Cross-merchant data leak via IDOR (`merchantId` query
  parameter spoof). Closed by AN-AH-1 (scope binding from session
  token only).
- **T-AN-2** — Re-identification through low-k aggregates (single-buyer
  merchants). Closed by AN-AH-2 (`K_ANONYMITY_FLOOR = 5`).
- **T-AN-3** — Denial-of-service via expensive queries (range expansion
  to all-time, no cache key). Closed by AN-AH-3 (`QUERY_TIMEOUT_MS = 5000`
  + per-merchant rate limit).
- **T-AN-4** — Stale data leading to misleading dashboards. Closed by
  AN-AH-7 (auto-pause on indexer disconnect, banner on dashboard).
- **T-AN-5** — Indexer compromise propagating to analytics. Closed by
  AN-AH-4 (read-replica isolation, separate credentials).
- **T-AN-6** — Public dashboard PII exposure (raw addresses). Closed by
  AN-AH-5 (privacy-preserving aggregation gate; no per-address rows
  in public endpoint).
- **T-AN-7** — Cache poisoning via crafted Vary headers. Closed by
  AN-AH-6 (cache key derived from authenticated principal +
  validated range).

### 7.2 Error registry

| Code | Name | When raised |
|---:|---|---|
| `0` | `ERROR_AN_NONE` | Successful path. |
| `1` | `ERROR_AN_TIMEOUT` | Read-replica failed to respond within `QUERY_TIMEOUT_MS = 5000 ms`. |
| `2` | `ERROR_AN_UNAUTHORIZED` | Authentication missing or invalid for `GET /v1/analytics/merchant`. |
| `3` | `ERROR_AN_FORBIDDEN_SCOPE` | `merchantId` in path / query does not match session-bound principal (T-AN-1 closure). |
| `4` | `ERROR_AN_INVALID_RANGE` | `range` is not one of the supported windows. |
| `5` | `ERROR_AN_INDEXER_LAG` | Replica lag exceeds `REPLICA_LAG_BUDGET_SECONDS = 60 s`. |
| `6` | `ERROR_AN_RATE_LIMITED` | Per-merchant or per-IP rate limit exceeded. |
| `7` | `ERROR_AN_CACHE_MISS_STORM` | Cache hit ratio fell below 80 % within rolling window; query rejected to protect replica. |
| `8` | `ERROR_AN_PRIVACY_THRESHOLD` | Requested aggregate below `K_ANONYMITY_FLOOR = 5` (T-AN-2 closure). |
| `9` | `ERROR_AN_BACKEND_DOWN` | Read-replica unreachable after retries. |

### 7.3 Authentication binding

`GET /v1/analytics/merchant` MUST derive `merchantId` from the bearer
token's `sub` claim only. Query parameters or path variables carrying
a `merchantId` SHALL be rejected with `ERROR_AN_FORBIDDEN_SCOPE` even
if they match the principal (defense-in-depth; see AN-AH-1 and
[`MERCHANT_ANALYTICS.md`](MERCHANT_ANALYTICS.md) §3).

### 7.4 Replay & idempotency

Aggregate reads are idempotent and do not require nonces. POST-like
refresh probes (operator-only, off the public surface) use a deduplication
key with idempotency window
`IDEMPOTENCY_WINDOW_SECONDS = 600`.

### 7.5 PII posture

The public protocol endpoint never emits raw NFT addresses, wallet
identifiers, or merchant names. Merchant analytics may return
**hashed and truncated** top-customer identifiers (first 4 / last 4 of
the SHA-256 hash of the NFT address) only after the count of distinct
customers contributing to that bucket meets
`K_ANONYMITY_FLOOR = 5`.

---

## 8. Hardening backlog

The hardening backlog is enumerated below and tracked in
[`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 with CI guardrails
`R-AN-AH-1`..`R-AN-AH-5`. Each item is gated on B3 verdict `READY`
(see [`ADAPTER_HARDENING.md`](ENDPOINT_HARDENING.md) §5).

- **AN-AH-1** — Scope-binding middleware (T-AN-1 closure)
- **AN-AH-2** — `K_ANONYMITY_FLOOR = 5` enforcement (T-AN-2 closure)
- **AN-AH-3** — Query timeout + circuit breaker (T-AN-3 closure)
- **AN-AH-4** — Read-replica isolation (T-AN-5 closure)
- **AN-AH-5** — Privacy-preserving aggregation gate (T-AN-6 closure)
- **AN-AH-6** — Cache key derivation + Vary header pinning (T-AN-7 closure)
- **AN-AH-7** — Auto-pause on indexer disconnect (T-AN-4 closure)

---

## 9. Cross-references

- [`MERCHANT_ANALYTICS.md`](MERCHANT_ANALYTICS.md) — authenticated endpoint surface
- [`PROTOCOL_ANALYTICS.md`](PROTOCOL_ANALYTICS.md) — public aggregate surface
- [`PUBLIC_DASHBOARD.md`](PUBLIC_DASHBOARD.md) — `stats.tonbankcard.com` deployment
- [`PRIVACY.md`](PRIVACY.md) — privacy posture and k-anonymity rationale
- [`MONITORING.md`](MONITORING.md) — alert catalogue `AN-M01..AN-M12`
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) — hardening backlog + CI guardrails
- [`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) — deployment manifest + test bars
- [`BUG_BOUNTY.md`](BUG_BOUNTY.md) — bounty scope and A5 wiring
