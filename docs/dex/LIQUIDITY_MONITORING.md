# Liquidity & Aggregator Monitoring

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Status:** Draft — frozen at engagement kickoff; **alert rules registered with B3**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the alert catalogue for the DEX integration layer.
It maps every venue / aggregator failure mode to a `DEX-Mxx` alert
ID, a pager severity tier, a data source, and the disaster-recovery
drill that exercises it. The catalogue is wired into
[B3 production monitoring](../production/B3-monitoring/ENGAGEMENT.md)
so the on-call rotation paged for indexer / API issues is the same
rotation paged for DEX issues.

## 2. Acceptance criterion this artifact satisfies

Issue #141 §8 — _"Liquidity monitoring alerts configured"_
(**AC-6**), Issue #141 §3 _"Add liquidity depth monitoring to indexer"_,
and the non-functional budget _"Liquidity monitoring must not
increase indexer resource usage by > 10%"_ (Issue #141 §6).

---

## 3. Alert catalogue

The DEX integration layer publishes 18 alerts, numbered
`DEX-M01`..`DEX-M18`. Each alert has exactly one catalogue row in
§§3.1–3.5 and exactly one row in the roll-up severity matrix §3.6.

### 3.1 Aggregator lifecycle alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **DEX-M01** | `Promise.allSettled` yields zero survivors (every venue timed out / errored) | 1-of-1 (instantaneous) | Aggregator runtime metrics |
| **DEX-M02** | Aggregator emits `ERROR_DEX_FLOOR_REJECT` (every venue worse than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS`) | 5-minute rate ≥ 3 | Aggregator runtime metrics |
| **DEX-M03** | A venue is demoted to `DEGRADED` after 3 consecutive failed health probes | 1-of-1 | Health probe stream |
| **DEX-M04** | A previously demoted venue returns to `HEALTHY` after 120 s of clean probes | 1-of-1 | Health probe stream |
| **DEX-M05** | Aggregator P95 latency exceeds `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms` ceiling | 5-minute window | Aggregator runtime metrics |

### 3.2 Pool-depth & liquidity alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **DEX-M06** | TONCO TBC/TON pool depth drops below `MIN_POOL_DEPTH_TON = 50_000 TON` | 5-minute rolling average | Indexer `dex_pool_depth` table |
| **DEX-M07** | DeDust TBC/TON pool depth drops below `MIN_POOL_DEPTH_TON` | 5-minute rolling average | Indexer `dex_pool_depth` table |
| **DEX-M08** | TONCO pool depth drops more than 25 % over 24 h | 24 h | Indexer `dex_pool_depth` table |
| **DEX-M09** | DeDust pool depth drops more than 25 % over 24 h | 24 h | Indexer `dex_pool_depth` table |
| **DEX-M10** | Aggregator rejects swap with `ERROR_DEX_INSUFFICIENT_LIQUIDITY` (every venue below floor) | 1-of-1 | Aggregator runtime metrics |

### 3.3 Slippage & user-impact alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **DEX-M11** | Slippage-revert rate over 5 min exceeds `SLIPPAGE_REVERT_RATE_THRESHOLD = 10 %` | 5-minute window | Indexer `dex_swap_log` |
| **DEX-M12** | Average realised slippage exceeds 2 % over 1 h | 1 h | Indexer `dex_swap_log` |
| **DEX-M13** | Single-trade slippage exceeds `MAX_SLIPPAGE_BPS = 500` (user override caught at execution) | 1-of-1 | Indexer `dex_swap_log` |

### 3.4 Replay & idempotency alerts

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **DEX-M14** | Quote replay attempt (`ERROR_DEX_QUOTE_EXPIRED`) over 10 / minute | 1-minute window | Aggregator runtime metrics |
| **DEX-M15** | Duplicate `requestId` within `IDEMPOTENCY_WINDOW_SECONDS = 600 s` | 1-of-1 | Aggregator runtime metrics |

### 3.5 Notifications & auto-trigger

| ID | Trigger | Window | Source |
|----|---------|--------|--------|
| **DEX-M16** | Notification delivery failure rate over 5 min ≥ 20 % | 5-minute window | Indexer `notification_log` |
| **DEX-M17** | `DEX-N01` (`venue_degraded`) emitted | 1-of-1 (informational) | Notification dispatcher |
| **DEX-M18** | `RC-LIQUIDITY-DRAIN` auto-pause reason code is recorded (closure pre-DEX-AH-6) | 1-of-1 | Merchant Payment Hub pause log |

### 3.6 Roll-up — pager severity matrix

The matrix below is the **single source of truth** for which alerts
page on-call versus which ones land in the daily digest. Each alert
in §§3.1–3.5 appears here exactly once.

| Severity | Alerts | Routing |
|----------|--------|---------|
| **P0** — wake on-call | `DEX-M01`, `DEX-M06`, `DEX-M07`, `DEX-M10`, `DEX-M18` | Page primary; escalate to secondary after 5 min |
| **P1** — page within 30 min | `DEX-M02`, `DEX-M03`, `DEX-M05`, `DEX-M08`, `DEX-M09` | Page primary; no automatic secondary escalation |
| **P2** — channel ping during business hours | `DEX-M11`, `DEX-M12`, `DEX-M16` | Slack #protocol-monitoring |
| **P3** — daily digest | `DEX-M04`, `DEX-M13`, `DEX-M14`, `DEX-M15`, `DEX-M17` | Email roll-up |

---

## 4. Data sources

| ID | Source | Frequency | Retention |
|----|--------|-----------|-----------|
| **DS-1** | Aggregator runtime metrics (Prometheus / OTLP) | Live | 30 days |
| **DS-2** | Indexer `dex_swap_log` table | Per-swap | 365 days |
| **DS-3** | Indexer `dex_pool_depth` table | 60 s poll per venue | 365 days |
| **DS-4** | Health probe stream (in-process) | 60 s per venue | 7 days |

All four sources feed the existing B3 dashboards described in
[`docs/production/B3-monitoring/ENGAGEMENT.md`](../production/B3-monitoring/ENGAGEMENT.md).
No new dashboards are introduced — the DEX alerts share the
`offchain-services` dashboard with `ChangeNOW`, `NOWPayments`, and
`CoinRabbit`.

---

## 5. Disaster-recovery drills

Quarterly DR drills exercise the alert catalogue against
representative failure modes. Each drill produces an artefact in
`audit/dex-drill-{DR-N}-{YYYY-MM}.log` so the auditor can confirm
the alert fired in practice.

| ID | Scenario | Expected alerts | Owner |
|----|----------|-----------------|-------|
| **DR-1** | Kill TONCO adapter mid-quote | `DEX-M03` (TONCO demoted), `DEX-M04` after restoration | Backend on-call |
| **DR-2** | Kill DeDust adapter mid-execute (fallback path) | `DEX-M03` (DeDust demoted) and successful TONCO fallback | Backend on-call |
| **DR-3** | Simulate 30 % TONCO pool drain | `DEX-M08` (24 h drop) and `DEX-M06` if depth crosses floor | Backend on-call |
| **DR-4** | Replay an expired quote | `DEX-M14` (replay attempt) | Security on-call |
| **DR-5** | Push every venue's price 6 % off mid (manipulate quote source in staging) | `DEX-M02` (floor reject) | Security on-call |

---

## 6. CI wiring

The readiness validator (`scripts/dex/check-dex-readiness.ts`)
inspects this document for:

- 18 alert rows `DEX-M01..DEX-M18` (§§3.1–3.5);
- Each alert appearing **exactly once** in §3.6;
- Severity tiers P0..P3 declared in §3.6;
- Data sources DS-1..DS-4 in §4;
- DR drills DR-1..DR-5 in §5.

Drift produces a CI-blocking failure and an explicit `XR.sev.{alert}`
checkpoint in the validator output.

---

## 7. References

- [`docs/dex/SPECIFICATION.md`](./SPECIFICATION.md) §6 (monitoring overview)
- [`docs/dex/PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) §6 (performance budget)
- [`docs/dex/NOTIFICATIONS.md`](./NOTIFICATIONS.md) (DEX-N01..DEX-N08 catalogue, cross-referenced by DEX-M16 / DEX-M17)
- [`docs/dex/ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) (DEX-AH-6 auto-pause)
- [`docs/production/B3-monitoring/ENGAGEMENT.md`](../production/B3-monitoring/ENGAGEMENT.md)
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
