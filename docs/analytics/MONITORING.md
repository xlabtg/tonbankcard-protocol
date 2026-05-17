# Analytics Monitoring — Alert Catalogue

**Document Type:** Analytics Production Readiness Artifact
**Issue Reference:** [#142 — F7 Analytics & Reporting](https://github.com/xlabtg/tonbankcard-protocol/issues/142)
**Status:** Draft — frozen at engagement kickoff; **alert rules registered with B3**
**Last Updated:** 2026-05-17

This document is the alert catalogue for the analytics layer. It
maps every aggregator / endpoint / dashboard failure mode to an
`AN-Mxx` alert ID, a pager severity tier, a data source, and the
disaster-recovery drill that exercises it. The catalogue is wired
into [B3 production monitoring](../production/MONITORING.md) so the
on-call rotation paged for indexer / API issues is the same rotation
paged for analytics issues.

Spec-anchor: [`SPECIFICATION.md`](SPECIFICATION.md) §3.3, §3.4.

---

## 1. Acceptance criterion

Issue #142 §8 — _"Analytics API endpoints implemented"_ (**AC-2**,
**AC-3**) and Issue #142 §6 _"Analytics queries shall not affect main
API performance; analytics query response time SHOULD be < 2 s P95"_
(non-functional budget enforced by alerts AN-M02, AN-M07, AN-M11).

---

## 2. Catalogue layout

The analytics layer publishes 12 alerts, numbered
`AN-M01`..`AN-M12`. Each alert appears exactly once in §§3.1–3.4 and
exactly once in the roll-up severity matrix §3.5.

---

## 3. Alert catalogue

### 3.1 Aggregator lifecycle alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **AN-M01** | `DASHBOARD_REFRESH_FAILED` event emitted (refresh cycle returned an error) | 1-of-1 | Aggregator runtime metrics |
| **AN-M02** | Merchant endpoint P95 latency exceeds `ANALYTICS_QUERY_P95_BUDGET_MS = 2000 ms` | 5-minute window | API gateway metrics |
| **AN-M03** | `ERROR_AN_FORBIDDEN_SCOPE` returned (potential IDOR attempt) | 1-of-1 | API gateway metrics |
| **AN-M04** | Indexer disconnect persists ≥ `INDEXER_DISCONNECT_GRACE_SECONDS = 180 s` (dashboard surfaces degraded banner) | rolling 180 s | Health probe stream |

### 3.2 Cache & performance alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **AN-M05** | Cache hit ratio falls below 80 % on either endpoint | 5-minute window | CDN access log |
| **AN-M06** | Refresh cadence drifts > `ANALYTICS_REFRESH_INTERVAL_SECONDS = 600 s` past schedule | 1-of-1 | Aggregator runtime metrics |
| **AN-M07** | Public dashboard load (P95) exceeds `DASHBOARD_LOAD_BUDGET_MS = 2000 ms` | 5-minute window | Real-user monitoring |

### 3.3 Privacy & abuse alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **AN-M08** | An aggregate is suppressed because contributors < `K_ANONYMITY_FLOOR = 5` | 1-of-1 (informational) | Aggregator runtime metrics |
| **AN-M09** | Rate limit triggered ≥ `RATE_LIMIT_REQUESTS_PER_MINUTE = 60` for the same IP for 5 consecutive minutes | 5-minute window | API gateway metrics |

### 3.4 Replica & infrastructure alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **AN-M10** | Replica lag exceeds `REPLICA_LAG_BUDGET_SECONDS = 60 s` | 1-of-1 | Read-replica metrics |
| **AN-M11** | Replica unreachable / `ERROR_AN_BACKEND_DOWN` returned | 1-of-1 | Read-replica metrics |
| **AN-M12** | `HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive analytics health probes fail (layer auto-pauses) | rolling 3 probes | Health probe stream |

### 3.5 Roll-up — pager severity matrix

The matrix below is the **single source of truth** for which alerts
page on-call versus which ones land in the daily digest. Each alert
in §§3.1–3.4 appears here exactly once.

| Severity | Alerts | Routing |
|----------|--------|---------|
| **P0** — wake on-call | `AN-M11`, `AN-M12` | Page primary; escalate to secondary after 5 min |
| **P1** — page within 30 min | `AN-M01`, `AN-M03`, `AN-M04`, `AN-M10` | Page primary; no automatic secondary escalation |
| **P2** — channel ping during business hours | `AN-M02`, `AN-M05`, `AN-M06`, `AN-M07`, `AN-M09` | Slack `#protocol-monitoring` |
| **P3** — daily digest | `AN-M08` | Email roll-up |

---

## 4. Data sources

| ID | Source | Frequency | Retention |
|----|--------|-----------|-----------|
| **DS-1** | Aggregator runtime metrics (Prometheus / OTLP) | Live | 30 days |
| **DS-2** | API gateway metrics (`analytics.merchant.*`, `analytics.protocol.*`) | Live | 30 days |
| **DS-3** | CDN access log | Live | 30 days |
| **DS-4** | Read-replica metrics (`pg_stat_replication`, query latency) | Live | 30 days |
| **DS-5** | Health probe stream (in-process) | `HEALTH_PROBE_INTERVAL_SECONDS = 60 s` | 7 days |
| **DS-6** | Real-user monitoring (`stats.tonbankcard.com`) | Per-pageview | 30 days |

All six sources feed the existing B3 dashboards. No new dashboards
are introduced — the analytics alerts share the `offchain-services`
dashboard with the F6 DEX integration set.

---

## 5. Disaster-recovery drills

Quarterly DR drills exercise the alert catalogue against
representative failure modes. Each drill produces an artefact in
`audit/analytics-drill-{DR-N}-{YYYY-MM}.log` so the auditor can
confirm the alert fired in practice.

| ID | Scenario | Expected alerts | Owner |
|----|----------|-----------------|-------|
| **DR-1** | Disconnect the indexer read-replica | `AN-M11`, `AN-M12`, `AN-M04` | Backend on-call |
| **DR-2** | Inject 5 s artificial latency on the merchant endpoint | `AN-M02` | Backend on-call |
| **DR-3** | Replay a foreign `merchantId` in a query string | `AN-M03` | Security on-call |
| **DR-4** | Replay 70 req/min from a single IP against the public endpoint | `AN-M09` | Security on-call |
| **DR-5** | Run a 7-day range against a merchant with 4 distinct payers | `AN-M08` (empty `topCustomers`) | Backend on-call |
| **DR-6** | Block aggregator refresh for 12 minutes | `AN-M01`, `AN-M06` | Backend on-call |

---

## 6. Reporting

Each drill produces:

1. A timestamped log capturing the trigger and the alert firing.
2. The downstream pager-routing trace from B3.
3. An attestation that the runbook step closed the alert.

Quarterly the on-call lead aggregates the six drills into
`audit/analytics-drill-summary-{YYYY-Qn}.md` for B3 review.

---

## 7. Cross-references

- [`SPECIFICATION.md`](SPECIFICATION.md) §3.3, §3.4 — refresh / healthCheck contract
- [`MERCHANT_ANALYTICS.md`](MERCHANT_ANALYTICS.md) §5 — performance budget anchor
- [`PROTOCOL_ANALYTICS.md`](PROTOCOL_ANALYTICS.md) §6 — performance budget anchor
- [`PUBLIC_DASHBOARD.md`](PUBLIC_DASHBOARD.md) §6 — dashboard load budget
- [`PRIVACY.md`](PRIVACY.md) §2 — AN-M08 (privacy-floor trigger)
- [`ENDPOINT_HARDENING.md`](ENDPOINT_HARDENING.md) §3 — AN-AH-3, AN-AH-4, AN-AH-7
- [`TESTNET_INTEGRATION.md`](TESTNET_INTEGRATION.md) §5 — DR-N test bars
