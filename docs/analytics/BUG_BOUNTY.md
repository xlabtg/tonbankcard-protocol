# Analytics — Bug-Bounty Category

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Engagement Prerequisite:** [B3 Production Monitoring & Alerting](../production/MONITORING.md) — verdict `READY`
**Program Brief:** [A5 Bug Bounty](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
**Status:** Draft — frozen at engagement kickoff; **activation gated on B3 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the analytics-specific addendum to the protocol
bug bounty program
([A5 PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)).
It enumerates the **analytics-specific scope, severity uplifts, and
out-of-scope clarifications** that the aggregator / endpoint /
public-dashboard surface needs in addition to the protocol-wide
rules.

The [A5 program brief](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§3.1 lists `backend/analytics/{merchantAggregator,protocolAggregator}.ts`
as **Pending B3** — bounty submissions against them are rerouted to
the B3 intake until B3 returns verdict `READY`. This document
defines what the analytics category **will activate as** once B3
unblocks it; it does **not** activate the category prematurely.

---

## 2. Acceptance criterion this artifact satisfies

Issue #142 §8 — _"AC-2: Merchant analytics endpoint implemented"_,
_"AC-3: Protocol analytics endpoint implemented"_, and _"AC-7: IDOR
protection tested"_ rely on the bounty surface being articulated
even before activation, so that researchers studying the staging
integration artefact know which bands are in flight; full activation
arrives only after B3.

Activation is **conditional**: the analytics category is satisfied
when (a) this document exists, (b) B3 reaches `READY`, (c)
[`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md)
records the category transition from `Pending B3` to `Active`, and
(d) the analytics readiness CI check
([`scripts/analytics/check-analytics-readiness.ts`](../../scripts/analytics/check-analytics-readiness.ts))
asserts (a)–(c) every PR.

---

## 3. In-scope assets

| Asset | Severity ceiling | Notes |
|-------|------------------|-------|
| `backend/analytics/merchantAggregator.ts` *(planned per [`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md))* | **Critical** (per [A5 SEVERITY_RUBRIC.md §2.1](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)) — Critical reward band, eligible for the open-ended uplift per [A5 STATUS.md §10](../security/audits/A5-bug-bounty/STATUS.md). | Direct findings on IDOR (scope binding), privacy-floor enforcement (`topCustomers`), audit-log redaction. |
| `backend/analytics/protocolAggregator.ts` *(planned per [`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md))* | **Critical** (off-chain) | Privacy-floor enforcement, indexer provenance, cache-key derivation. |
| `backend/analytics/types.ts` *(planned)* | **High** (off-chain) | Shared `AnalyticsAdapter` interface — a flaw in the typed boundary lets either aggregator ship a non-compliant return. |
| `backend/analytics/replica-pool.ts` *(planned post-AN-AH-4)* | **High** (off-chain) | Read-replica isolation boundary — a flaw here lets analytics reach into the main indexer pool. |
| `api/middleware/analytics-scope.ts` *(planned post-AN-AH-1)* | **Critical** (off-chain) | Scope-binding middleware — the IDOR primitive. |
| `dashboard/` (merchant analytics surface) | **High** (off-chain) | Misrendering of `topCustomers`, leakage of foreign merchant data, conversion-rate spoof. |
| `dashboard/public/` (public dashboard surface — `stats.tonbankcard.com`) | **High** (off-chain) | Privacy-floor bypass via UI, cache poisoning at the edge. |
| `scripts/analytics/check-analytics-readiness.ts` *(this PR)* | **Medium** | CI gate that prevents misconfigured releases. |
| Indexer subset feeding the aggregators (`MerchantPayment`, `InvoiceCreated`, `InvoiceSettled`, `AccountLocked`, `SwapExecuted`, `InternalTransferEvent`) | **High** (off-chain) | Materialisation drift that changes the aggregate numbers. |

All analytics findings live in the **off-chain** reward column of
the A5 program brief — Issue #142 introduces no on-chain contracts.
The two aggregators are granted a **Critical** ceiling (unusual for
off-chain code) because a flaw in scope binding or privacy
enforcement maps 1:1 onto user-data exposure or merchant-data
cross-contamination.

---

## 4. Analytics-specific severity uplifts

The protocol-wide rubric in
[`SEVERITY_RUBRIC.md` §2](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
maps to the analytics surface as follows. Where the rubric is generic
across invariants, the table below names the analytics-specific
realisation so triage stays unambiguous.

### 4.1 Critical — cross-tenant data leak / re-identification

| Trigger | Realisation on analytics | Reward band |
|---------|--------------------------|-------------|
| IDOR — foreign merchant data returned (T-AN-1 break) | Any path through `merchantAggregator.ts` that returns the analytics envelope of merchant `B` to a session bound to merchant `A` ([`MERCHANT_ANALYTICS.md` §3](./MERCHANT_ANALYTICS.md)). | Off-chain Critical (open-ended) |
| Re-identification at K < 5 (T-AN-2 break) | A PoC that re-identifies an individual user from a public aggregate published under `K_ANONYMITY_FLOOR = 5` ([`PRIVACY.md` §2](./PRIVACY.md)). | Off-chain Critical |
| Privacy-floor bypass via differential range queries | A PoC that combines `7d`, `30d`, `90d` queries to triangulate the individual contributors below the floor. | Off-chain Critical |
| Raw PII leakage in public response (T-AN-6 break) | A PoC where the `/v1/analytics/protocol` response carries an unhashed `nft_address`, `sub`, `wallet`, or `email` (AN-AH-5 break). | Off-chain Critical |
| Trust-anchor corruption — read-replica role escalation | A PoC where the analytics replica role gains `pg_write_*` permissions or reaches another database (AN-AH-4 break). | Off-chain Critical (data-loss equivalent) |
| Auth-bypass — endpoint serves merchant data without a valid token | A PoC where `/v1/analytics/merchant` returns data with a missing or forged `Authorization` header. | Off-chain Critical |

### 4.2 High — replay, freshness, monitoring

| Trigger | Realisation on analytics | Reward band |
|---------|--------------------------|-------------|
| Cache poisoning via crafted `Vary` (T-AN-7) | A PoC that poisons the cached response for one merchant by injecting a `Vary: Cookie` header from another (AN-AH-6 break). Pre-AN-AH-6 this earns High; post-AN-AH-6 a PoC against the cache-key primitive earns Critical (§4.1). | High (pre-AN-AH-6) → Critical |
| Stale data accepted past `INDEXER_DISCONNECT_GRACE_SECONDS = 180 s` (T-AN-4) | A PoC where the dashboard shows non-degraded data while the indexer has been disconnected for > 180 s ([`PUBLIC_DASHBOARD.md` §4](./PUBLIC_DASHBOARD.md)). | Off-chain High |
| Replica-lag bypass | A PoC where the endpoint returns 200 while `pg_stat_replication` reports lag > `REPLICA_LAG_BUDGET_SECONDS = 60 s` and `AN-M10` never fires. | Off-chain High |
| Rate-limit bypass (T-AN-3 escalation) | A PoC that sustains > 60 req/min from a single IP / merchant against the public / merchant endpoint without triggering `ERROR_AN_RATE_LIMITED`. | Off-chain High |
| Query-timeout bypass (T-AN-3) | A PoC where an attacker forces an aggregator query > `QUERY_TIMEOUT_MS = 5000 ms` and the endpoint hangs the request instead of returning `ERROR_AN_TIMEOUT`. | Off-chain High |
| Indexer mis-derivation of an aggregate row | An indexer bug where `MerchantPayment.amount` or `SwapExecuted.amountOut` is recorded with the wrong sign / scale, causing the public aggregate to drift ([`PROTOCOL_ANALYTICS.md` §3](./PROTOCOL_ANALYTICS.md)). | Off-chain High |
| Conversion-rate spoof in `dashboard/` | A wallet-ui PoC where the merchant dashboard renders `conversionRate` materially different from the value returned by the endpoint, influencing a business decision. | Off-chain High |

### 4.3 High — merchant-dashboard surface

| Trigger | Realisation on analytics | Reward band |
|---------|--------------------------|-------------|
| `topCustomers` reveals raw NFT address | A PoC where the dashboard renders an un-truncated hash or the raw address ([`PRIVACY.md` §3](./PRIVACY.md)). | Off-chain High |
| Foreign merchant's `topCustomers` rendered | A wallet-ui PoC where the merchant dashboard renders entries from another merchant's session (UI-layer IDOR). | Off-chain Critical (I1-equivalent: violates merchant-isolation invariant). |
| Freshness banner suppression | A PoC where the merchant dashboard hides the degraded banner even when `nextRefreshAt < now - 180 s`. | Off-chain High (influences a business decision based on stale data). |
| Auto-submit of a destructive admin action without consent | Direct merchant-dashboard issue against the user-consent invariant. | Off-chain Critical (escalated above the off-chain High default). |

### 4.4 Medium — monitoring gaps, status divergence

| Trigger | Realisation on analytics | Reward band |
|---------|--------------------------|-------------|
| AN-Mxx alert ([`MONITORING.md` §3](./MONITORING.md)) fails to fire under a deterministic trigger | Alerting gap. | Off-chain Medium |
| Audit-log materialisation misses a request (`analytics.*.access` row absent for an observed call) | Audit-log gap per [`PRIVACY.md` §6](./PRIVACY.md). | Off-chain Medium |
| `Vary` header drift on the public endpoint | A PoC where the response carries a `Vary` value other than `Accept-Encoding` (AN-AH-6 hardening drift). | Off-chain Medium |
| Cache-Control downgrade | A PoC where the public endpoint returns `Cache-Control: private` or omits `stale-while-revalidate`. | Off-chain Medium |
| ETag drift — body changes without ETag change | A PoC where two distinct response bodies share the same ETag for the same range. | Off-chain Medium |

### 4.5 Low — informational findings

| Trigger | Realisation on analytics | Reward band |
|---------|--------------------------|-------------|
| Documentation drift between spec constants and aggregator constants | A PR opening on the README without code change. | Low (acknowledgement only) |
| `AN-M08` informational alert misformatted | Cosmetic alerting issue. | Low |

---

## 5. Out-of-scope

The following are explicitly **out of scope** for this category and
either belong to a different bounty bucket or are not bounty-eligible:

- **Account abuse via legitimate merchant tokens.** A merchant
  scraping their own analytics legitimately is not a security
  vulnerability — it is governed by the rate limit
  `RATE_LIMIT_REQUESTS_PER_MINUTE = 60`.
- **CDN-layer DDoS.** Volumetric attacks against the public dashboard
  CDN belong to the [D4 Rate Limiting & DDoS Protection](../merchant-api-security.md)
  bounty category.
- **Indexer correctness against on-chain state.** Indexer derivation
  bugs that affect the analytics aggregates are in scope for this
  category **only insofar as they map onto a privacy or
  cross-tenant invariant**; pure correctness bugs route to the
  indexer's own bounty.
- **Browser-specific rendering bugs that do not influence data
  decisions.** Cosmetic UI issues on `stats.tonbankcard.com` route
  to the general wallet-ui bounty.
- **Submissions against the analytics layer pre-B3.** Until B3
  returns `READY` the analytics category remains `Pending B3` and
  every submission is rerouted to the B3 intake.

---

## 6. Reporting & disclosure

Analytics-category submissions follow the protocol-wide intake
process documented in
[`A5 PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§4. Triage owner: the on-call backend lead for the analytics
rotation; escalation to the security lead per the existing rubric.

Coordinated disclosure window: 90 days from triage decision (matching
the protocol-wide A5 default).

---

## 7. Cross-references

- [`SPECIFICATION.md`](./SPECIFICATION.md) §7 — threat catalogue + error registry
- [`MERCHANT_ANALYTICS.md`](./MERCHANT_ANALYTICS.md) §3 — IDOR posture
- [`PROTOCOL_ANALYTICS.md`](./PROTOCOL_ANALYTICS.md) §4 — privacy floor enforcement
- [`PUBLIC_DASHBOARD.md`](./PUBLIC_DASHBOARD.md) §4, §7 — freshness banner / cache headers
- [`PRIVACY.md`](./PRIVACY.md) §2, §3 — k-anonymity rationale, address truncation
- [`MONITORING.md`](./MONITORING.md) §3 — alerting envelope
- [`ENDPOINT_HARDENING.md`](./ENDPOINT_HARDENING.md) §3 — AN-AH-1..AN-AH-7 hardening items
- [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) §5.3, §5.4 — IDOR + privacy-floor drills
- [A5 PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md) — program-wide rules
- [A5 SEVERITY_RUBRIC.md](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md) — severity mapping
- [A5 STATUS.md](../security/audits/A5-bug-bounty/STATUS.md) — category activation log
