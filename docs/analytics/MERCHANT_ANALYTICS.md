# Merchant Analytics — Authenticated Endpoint

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17

This document specifies the `GET /v1/analytics/merchant` endpoint
surface, IDOR posture, and metric semantics. It is the source of truth
the merchant aggregator implementation in
`backend/analytics/merchantAggregator.ts` (lands post-B3 verdict
`READY`) MUST honour. Drift is a CI-blocking defect — see
`scripts/analytics/check-analytics-readiness.ts`.

Spec-anchor: [`SPECIFICATION.md`](SPECIFICATION.md) §3.1.

---

## 1. Acceptance criterion

Issue #142 §8 — _"Analytics API endpoints implemented"_ (**AC-2**) and
_"Merchant analytics section added to `dashboard/`"_ (**AC-4** —
satisfied by the data contract this document freezes).

---

## 2. Endpoint surface

```
GET /v1/analytics/merchant
Authorization: Bearer <merchant JWT>
Query:
  range = 7d | 30d | 90d | 365d   (default: 30d)
```

The response envelope is:

```ts
interface MerchantAnalytics {
    merchantId: string;             // hex; equal to session.sub
    range: '7d' | '30d' | '90d' | '365d';
    paymentVolumeTbc: bigint;       // total TBC received
    paymentCount: number;           // successful payments
    averagePaymentTbc: bigint;      // paymentVolumeTbc / paymentCount
    invoicesCreated: number;
    invoicesSettled: number;
    conversionRate: number;         // invoicesSettled / invoicesCreated, 0..1
    chargebackCount: number;        // invoices with associated FRAUD_LOCK events
    chargebackRate: number;         // chargebackCount / invoicesSettled, 0..1
    topCustomers: TopCustomer[];    // ≤ 10 entries
    revenueTrend: TrendBucket[];    // daily bucket within range
    computedAt: number;             // Unix seconds
    nextRefreshAt: number;          // Unix seconds
}

interface TopCustomer {
    truncatedHash: string;          // sha256(nft_address) first4/last4
    paymentCount: number;
    paymentVolumeTbc: bigint;
}

interface TrendBucket {
    bucketStart: number;            // Unix seconds (UTC day start)
    paymentVolumeTbc: bigint;
    paymentCount: number;
}
```

`merchantId` MUST equal the token's `sub` claim. Any mismatch returns
`ERROR_AN_FORBIDDEN_SCOPE` (closes T-AN-1; see SPECIFICATION.md §7.3
and `ENDPOINT_HARDENING.md` §3 / AN-AH-1).

---

## 3. IDOR posture

The aggregator binds `merchantId` from the bearer token's `sub` claim
**only**. Defense-in-depth rules:

1. Reject the request if any `merchantId` appears in the path, query
   string, or body — including when it matches the principal
   (`ERROR_AN_FORBIDDEN_SCOPE`).
2. The cache key is derived from `(session.sub, range)`; never from a
   user-supplied value.
3. Audit log emits a redacted scope record on every request:
   `analytics.merchant.access { sub, range, hashedSub }`.

IDOR drills are covered in
[`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) §5.3 (test bars 6
distinct IDOR cases) and in
[`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 / AN-AH-1.

---

## 4. Privacy and aggregation

The merchant endpoint is authenticated; merchants legitimately see
their own raw payment counts. However, `topCustomers` entries MUST be
hashed (sha256 of NFT address) and truncated (first-4/last-4 of the
hex) before emission. If `topCustomers.length < K_ANONYMITY_FLOOR = 5`,
the array is returned empty rather than partially populated
(`ERROR_AN_PRIVACY_THRESHOLD` is **not** raised on the merchant
endpoint; empty array is the privacy-safe fallback). See
[`PRIVACY.md`](PRIVACY.md) §3.

---

## 5. Performance budget

Aligned with [`SPECIFICATION.md`](SPECIFICATION.md) §5:

| Percentile | Budget |
|---|---:|
| P50 | 200 ms |
| P95 | 1000 ms |
| P99 | 2000 ms |

Latency drift above P95 fires `AN-M02` (`docs/analytics/MONITORING.md`).
The endpoint MUST surface `ERROR_AN_TIMEOUT` if the read-replica fails
to answer within `QUERY_TIMEOUT_MS = 5000 ms`.

---

## 6. Error mapping

| HTTP | Body code | Meaning |
|---|---|---|
| 200 | `ERROR_AN_NONE` | Success. |
| 400 | `ERROR_AN_INVALID_RANGE` | `range` is not one of `7d / 30d / 90d / 365d`. |
| 401 | `ERROR_AN_UNAUTHORIZED` | Missing / invalid bearer token. |
| 403 | `ERROR_AN_FORBIDDEN_SCOPE` | `merchantId` mismatch or supplied as query parameter (T-AN-1 closure). |
| 429 | `ERROR_AN_RATE_LIMITED` | Per-merchant rate limit exceeded. |
| 503 | `ERROR_AN_TIMEOUT` | Read-replica timed out. |
| 503 | `ERROR_AN_INDEXER_LAG` | Replica lag exceeds `REPLICA_LAG_BUDGET_SECONDS = 60 s`. |
| 503 | `ERROR_AN_BACKEND_DOWN` | Read-replica unreachable. |

---

## 7. Dashboard integration

`dashboard/` consumes the endpoint and renders the merchant analytics
section with these widgets (matching `MerchantAnalytics` fields):

- **Volume card** — `paymentVolumeTbc`, `paymentCount`, `averagePaymentTbc`
- **Conversion card** — `invoicesCreated`, `invoicesSettled`, `conversionRate`
- **Chargeback card** — `chargebackCount`, `chargebackRate`
- **Top customers list** — `topCustomers` (truncated hashes)
- **Revenue trend chart** — `revenueTrend` (daily bars)
- **Freshness banner** — `computedAt` / `nextRefreshAt`, with a degraded
  banner when `nextRefreshAt < now - INDEXER_DISCONNECT_GRACE_SECONDS = 180 s`.

`SPECIFICATION.md` §3.1 owns the data contract; `dashboard/` is the
consumer.

---

## 8. Cross-references

- [`SPECIFICATION.md`](SPECIFICATION.md) §3.1 — `AnalyticsAdapter.getMerchantAnalytics`
- [`PRIVACY.md`](PRIVACY.md) §3 — k-anonymity floor on `topCustomers`
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 — AN-AH-1 (scope binding)
- [`MONITORING.md`](MONITORING.md) §3 — AN-M02, AN-M03 (IDOR attempts)
- [`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) §5.3 — IDOR test bar (AC-7)
