# Protocol Analytics — Public Aggregate Endpoint

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17

This document specifies the `GET /v1/analytics/protocol` endpoint
surface, the privacy-preserving aggregation envelope, and the cross-
references the public dashboard depends on. The aggregator
implementation in `backend/analytics/protocolAggregator.ts` (lands
post-B3 verdict `READY`) MUST honour the contract frozen here.

Spec-anchor: [`SPECIFICATION.md`](SPECIFICATION.md) §3.2.

---

## 1. Acceptance criterion

Issue #142 §8 — _"Analytics API endpoints implemented"_ (**AC-3**) and
_"Public dashboard shows accurate protocol stats"_ (**AC-5** — satisfied
by the data contract this document freezes).

---

## 2. Endpoint surface

```
GET /v1/analytics/protocol
Public — no Authorization header required.
Query:
  range = 7d | 30d | all-time   (default: 30d)
```

The response envelope is:

```ts
interface ProtocolAnalytics {
    range: '7d' | '30d' | 'all-time';
    totalValueTransferred: bigint;  // TBC smallest unit
    activeAccounts: number;         // distinct nft_address with ≥ 1 tx in range
    fraudLockEvents: number;        // AccountLocked{FRAUD_LOCK}
    collateralLockEvents: number;   // AccountLocked{COLLATERAL_LOCK}
    invoicesCreated: number;
    invoicesSettled: number;
    dexSwapVolume: bigint;          // SwapExecuted.amountOut sum
    computedAt: number;             // Unix seconds
    nextRefreshAt: number;          // Unix seconds
}
```

All counts are protocol-wide and aggregated; the endpoint NEVER returns
per-address or per-merchant breakdowns. Aggregates below the privacy
floor surface as `null` rather than zero — see §4 below.

---

## 3. Indexer provenance

Every field is derived **exclusively** from indexer events, closing
Issue #142 §8 AC-6 _"All analytics sourced from indexer (no direct RPC
calls to blockchain)"_. The mapping is:

| Field | Indexer event source |
|---|---|
| `totalValueTransferred` | `MerchantPayment.amount` + `InternalTransferEvent.amount` |
| `activeAccounts` | distinct `nft_address` across `MerchantPayment`, `InternalTransferEvent`, `AccountLocked` |
| `fraudLockEvents` | `AccountLocked{reason=FRAUD_LOCK}` |
| `collateralLockEvents` | `AccountLocked{reason=COLLATERAL_LOCK}` |
| `invoicesCreated` | `InvoiceCreated` |
| `invoicesSettled` | `InvoiceSettled` |
| `dexSwapVolume` | `SwapExecuted.amountOut` (post-fee, from F6 DEX adapters) |

The aggregator MUST NOT call any TON RPC method directly; it operates
exclusively over the indexer read-replica (AN-AH-4).

---

## 4. Privacy floor

Public aggregates only ship once
`K_ANONYMITY_FLOOR = 5` distinct underlying entities contribute. If a
range yields fewer than 5 distinct accounts, the corresponding field
returns `null` (and emits alert `AN-M08`); the dashboard renders
"insufficient data". Specifically:

- `activeAccounts < 5` → all counts in the envelope are `null`.
- `fraudLockEvents` and `collateralLockEvents` are exempt (they are
  protocol-level safety signals, not per-user behaviour) — they are
  always emitted, even if zero.

See [`PRIVACY.md`](PRIVACY.md) §2 for the rationale and
[`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 / AN-AH-5 for the
enforcement gate.

---

## 5. Cache strategy

The endpoint is **public-cacheable**:

| Header | Value |
|---|---|
| `Cache-Control` | `public, max-age=600, stale-while-revalidate=120` |
| `Vary` | `Accept-Encoding` (NEVER `Accept` or `Cookie`; T-AN-7 closure) |
| `ETag` | sha256(`range` + `computedAt` + serialisedAggregate) |

`CACHE_TTL_SECONDS = 600 s` aligns with the
`ANALYTICS_REFRESH_INTERVAL_SECONDS = 600 s` cadence. Stale entries
within `CACHE_STALE_WHILE_REVALIDATE_SECONDS = 120 s` are served from
edge while a background revalidation refreshes the cache. See
[`PUBLIC_DASHBOARD.md`](PUBLIC_DASHBOARD.md) §4 for the CDN config and
AN-AH-6 for the cache-key derivation guardrail.

---

## 6. Performance budget

Aligned with [`SPECIFICATION.md`](SPECIFICATION.md) §5:

| Percentile | Budget |
|---|---:|
| P50 | 100 ms |
| P95 | 500 ms |
| P99 | 1000 ms |

Latency drift above P95 fires `AN-M02`. The endpoint MUST surface
`ERROR_AN_TIMEOUT` if the read-replica fails to answer within
`QUERY_TIMEOUT_MS = 5000 ms`.

---

## 7. Error mapping

| HTTP | Body code | Meaning |
|---|---|---|
| 200 | `ERROR_AN_NONE` | Success. |
| 400 | `ERROR_AN_INVALID_RANGE` | `range` is not one of `7d / 30d / all-time`. |
| 429 | `ERROR_AN_RATE_LIMITED` | Per-IP rate limit exceeded (`RATE_LIMIT_REQUESTS_PER_MINUTE = 60`). |
| 503 | `ERROR_AN_TIMEOUT` | Read-replica timed out. |
| 503 | `ERROR_AN_INDEXER_LAG` | Replica lag exceeds `REPLICA_LAG_BUDGET_SECONDS = 60 s`. |
| 503 | `ERROR_AN_BACKEND_DOWN` | Read-replica unreachable. |

`ERROR_AN_PRIVACY_THRESHOLD` is **not** surfaced on this endpoint —
instead, individual fields return `null` and the response remains 200.

---

## 8. Cross-references

- [`SPECIFICATION.md`](SPECIFICATION.md) §3.2 — `AnalyticsAdapter.getProtocolAnalytics`
- [`PUBLIC_DASHBOARD.md`](PUBLIC_DASHBOARD.md) §4 — `stats.tonbankcard.com` CDN config
- [`PRIVACY.md`](PRIVACY.md) §2 — k-anonymity floor rationale
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 — AN-AH-5 (privacy gate), AN-AH-6 (cache key)
- [`MONITORING.md`](MONITORING.md) §3 — AN-M01, AN-M05, AN-M08
- [`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) §5.4 — public-stat verification bar (AC-5)
