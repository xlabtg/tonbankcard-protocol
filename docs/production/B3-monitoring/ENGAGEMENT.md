# Engagement B3 — Production Monitoring & Alerting

**Engagement ID:** `B3`
**Issue:** [#119 — B3 Production Monitoring & Alerting](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Roadmap track:** B — Production Deployment & Operations
**Status:** Engagement preparation complete — awaiting B2 `MAINNET-LIVE` verdict + monitoring vendor selection
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

> ⚠️ **Monitoring is read-only.** Every artifact in this engagement is written under the invariant that no monitoring component may take an action that touches user funds. Alerts trigger human review only. Automated remediation is permanently forbidden in the protocol layer per `docs/security/INCIDENT_RESPONSE.md`.

---

## 1. Objective

Operationalise production-grade observability for the deployed TONBANKCARD protocol so that the operator team can detect abnormal on-chain activity, off-chain service degradation, and suspicious patterns within the SLA windows defined in [`../SLA.md`](../SLA.md). The engagement publishes:

- An [alert catalogue](./ALERT_RULES.md) — concrete Prometheus-compatible alert rules grouped by severity, with per-rule rationale and acknowledgement path.
- A [dashboard catalogue](./DASHBOARDS.md) — operational and security dashboards with Grafana provisioning JSON committed under `provisioning/grafana/`.
- A [stack selection record](./STACK_SELECTION.md) — Grafana-stack vs Datadog evaluation, decision rationale, and rollback plan.
- An [instrumentation contract](./METRICS_INSTRUMENTATION.md) — explicit metric names, types, labels, and the indexer/API code locations that must export them.
- An [implementation runbook](./IMPLEMENTATION_RUNBOOK.md) — staged rollout from staging to production with a hard kill-switch.
- An [incident-response drill brief](./INCIDENT_DRILL.md) — drill scenario, success criteria, and the post-mortem template that updates `docs/security/INCIDENT_RESPONSE.md`.
- An [on-call rotation](../on-call.md) — at least two engineers with documented escalation paths.

The engagement is the **third activity** of roadmap track **B** and assumes B2 has reached `MAINNET-LIVE`. Bridge alerts (`CrossChainBridge`) are explicitly scoped behind the Phase 4 audit gate (A2) and only activate once mainnet bridge deployment is recorded in `docs/existing-contracts.md`.

Success criteria mirror the acceptance criteria in issue #119 §8:

- [ ] At least one monitoring system deployed (Grafana stack or Datadog) — see [`STACK_SELECTION.md`](./STACK_SELECTION.md)
- [ ] All alert rules defined and tested in a staging environment — see [`ALERT_RULES.md`](./ALERT_RULES.md) and [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3
- [ ] On-call rotation documented in [`docs/production/on-call.md`](../on-call.md)
- [ ] Incident response drill completed and playbook updated — see [`drills/`](./drills/) and [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §5
- [ ] All alerts verified to fire correctly in a test scenario — recorded in [`STATUS.md`](./STATUS.md) §6
- [ ] Dashboard accessible to all team members — access controls recorded in [`STATUS.md`](./STATUS.md) §4

---

## 2. In-Scope Components

Exactly the components enumerated in issue #119 §3.

### 2.1 Blockchain monitoring (on-chain, read-only)

| # | Concern | Source | Notes |
|---|---------|--------|-------|
| BC-1 | Block-time monitoring | TON HTTP API (`/getBlock` head) | Detect chain outages or congestion |
| BC-2 | Transaction-failure rate on `PaymentHub` | Indexer event stream | Failed transitions vs successful ones |
| BC-3 | Large outgoing-transfer alerts | Indexer `PaymentHub.Transfer` events | Threshold > $10K-equivalent in TBC (operator-tuned per [`ALERT_RULES.md`](./ALERT_RULES.md) §3.3) |
| BC-4 | Account-lock activity | Indexer `AccountLocks` events (`FRAUD_LOCK`, `COLLATERAL_LOCK`) | Any `FRAUD_LOCK` → immediate notification |
| BC-5 | `CrossChainBridge` events | Phase 4 contract — **gated on A2** | Until A2 `READY` and bridge deployed: alert is inert |
| BC-6 | Governance events | `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` | Proposals, votes, transparency-report writes |

All blockchain signals are sourced from the indexer's read-only event stream. **No monitoring component issues contract calls.** This is enforced by [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §4.

### 2.2 Off-chain service monitoring

| # | Concern | Source | Notes |
|---|---------|--------|-------|
| OS-1 | Indexer health (uptime, sync lag) | `/metrics` endpoint on indexer | Lag thresholds per [`ALERT_RULES.md`](./ALERT_RULES.md) §3.1 |
| OS-2 | Merchant API response time + error rate | `/metrics` endpoint on API | Hist + counter on every route |
| OS-3 | Database health | Indexer connection pool + query timings | SQLite/PostgreSQL backed |
| OS-4 | Gateway-adapter reachability | Adapter health probes (ChangeNOW, NOWPayments, CoinRabbit) | Best-effort, no SLA on third-party uptime |

### 2.3 Dashboards

| # | Dashboard | Audience | Defined in |
|---|-----------|----------|-----------|
| D-1 | Operational | On-call engineers | [`DASHBOARDS.md`](./DASHBOARDS.md) §2 + `provisioning/grafana/operational-dashboard.json` |
| D-2 | Security | Security + maintainer | [`DASHBOARDS.md`](./DASHBOARDS.md) §3 + `provisioning/grafana/security-dashboard.json` |
| D-3 | Adapter status | Operations + support | [`DASHBOARDS.md`](./DASHBOARDS.md) §4 (optional, lower priority) |

---

## 3. Out of Scope

Explicitly **not** part of B3 (issue #119 §4):

- **Building new blockchain infrastructure.** The engagement consumes the existing TON HTTP API and the indexer; it does not stand up a TON node.
- **Alerting for third-party gateway SLAs.** ChangeNOW, NOWPayments, and CoinRabbit are external services and their uptime is **not** TONBANKCARD's responsibility. The dashboard surfaces their reachability for operator awareness only — there is no SLA commitment.
- **User-facing analytics.** Covered by roadmap engagement F7.
- **Active mitigation.** Monitoring may detect and notify; it may **not** pause contracts, set locks, or alter state. Pause / lock decisions follow `docs/security/KEY_MANAGEMENT.md` and require human action.
- **Phase 4 contracts (`MultiSigCard`, `RecurringPayments`, `LendingProtocolCoordinator`)** — out of scope until A2 verdict + mainnet deploy. Only the `CrossChainBridge` row is pre-wired in `ALERT_RULES.md` §3.6 with an `inert: true` flag, because bridge events have a non-negotiable immediate-notification requirement.

---

## 4. Upstream Gates

The engagement may begin once all rows below are ✅. The live state of each gate is mirrored in [`STATUS.md`](./STATUS.md) §2.

| # | Gate | Owner | Evidence |
|---|------|-------|----------|
| G-1 | B2 verdict = `MAINNET-LIVE` | `@konard` | [`docs/deployments/B2-mainnet/STATUS.md`](../../deployments/B2-mainnet/STATUS.md) §1 |
| G-2 | Indexer + Merchant API export Prometheus metrics on `/metrics` | `@konard` | [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §3, code references in `backend/indexer/src/api/routes.ts` and `api/src/` |
| G-3 | Monitoring stack vendor selected (Grafana stack vs Datadog) | `@konard` | [`STACK_SELECTION.md`](./STACK_SELECTION.md) §4 — decision recorded |
| G-4 | Alert channels provisioned (Slack, email, PagerDuty/OpsGenie) with access controls | `@konard` | [`STATUS.md`](./STATUS.md) §4 |
| G-5 | Monitoring credentials live in secret store (not in repo, not in CI) | `@konard` | [`STATUS.md`](./STATUS.md) §5 — secret-store reference recorded; no plaintext anywhere |
| G-6 | On-call rotation populated (≥ 2 engineers, no single-point-of-failure) | `@konard` | [`docs/production/on-call.md`](../on-call.md) §2 |
| G-7 | Staging environment ready to fire test alerts (synthetic indexer + API) | `@konard` | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §2 |
| G-8 | Bridge alerts (BC-5) stay inert until A2 `READY` and bridge mainnet address recorded | `@konard` | [`docs/existing-contracts.md`](../../existing-contracts.md) — bridge row remains `TBD` |

If any gate is ❌ at kickoff the engagement is paused and the unmet gate is owned in [`STATUS.md`](./STATUS.md) §11 ("Open questions / blockers"). **Partial enablement is permitted** for non-critical alert rows (e.g., adapter dashboards may be deferred) but the critical-severity rules in [`ALERT_RULES.md`](./ALERT_RULES.md) §3.1–§3.4 must be live before flipping `STATUS.md` to `MONITORING-LIVE`.

---

## 5. Engagement Package

The operator team receives the following frozen package at kickoff. SHA-256 hashes and locations are tracked in [`STATUS.md`](./STATUS.md) §9.

| Artifact | Location | Purpose |
|----------|----------|---------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | This document |
| Engagement status | [`STATUS.md`](./STATUS.md) | Live tracker |
| Stack selection | [`STACK_SELECTION.md`](./STACK_SELECTION.md) | Vendor decision + rationale |
| Alert rules | [`ALERT_RULES.md`](./ALERT_RULES.md) + `provisioning/prometheus/alerts.yml` | Per-rule definitions, thresholds, severity, paging path |
| Dashboards | [`DASHBOARDS.md`](./DASHBOARDS.md) + `provisioning/grafana/*.json` | Operational + security dashboards |
| Metrics instrumentation | [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) | Code-level contract for exported metrics |
| Implementation runbook | [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) | Staged rollout, kill-switch |
| Incident drill brief | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) | Drill scenario, success criteria, post-mortem template |
| Drill artefacts | [`drills/`](./drills/) | Drill reports + playbook updates |
| Alertmanager routing | `provisioning/alertmanager/routes.yml` | Severity-based routing + silence template |
| On-call rotation | [`../on-call.md`](../on-call.md) | Schedule, primary/secondary, escalation |
| Monitoring catalogue (existing) | [`../MONITORING.md`](../MONITORING.md) | Higher-level monitoring strategy — predates B3 and remains authoritative for architecture |
| SLA targets | [`../SLA.md`](../SLA.md) | Drives threshold values in `ALERT_RULES.md` |
| Incident response | [`../../security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md) | Triggered by alerts |

The freeze commit is recorded in [`STATUS.md`](./STATUS.md) §3 and must equal the commit on which the staging drill (G-7) was executed.

---

## 6. Engagement Process

```
T-0   Engagement plan committed                                              ✅ (this directory)
T+0   All upstream gates G-1 … G-8 closed                                    ⏳
T+0d  Stack selection finalised in STACK_SELECTION.md                        ⏳
T+0d  Metrics endpoints live in staging (indexer + API)                      ⏳
T+1d  Prometheus / Datadog scraping the staging targets                      ⏳
T+1d  Dashboards provisioned in staging                                      ⏳
T+1d  Alertmanager routing wired with synthetic Slack channel                ⏳
T+2d  Drill #1 — synthetic indexer-lag injection (INCIDENT_DRILL.md §3.1)    ⏳
T+2d  Drill #2 — synthetic fraud-lock burst (INCIDENT_DRILL.md §3.2)         ⏳
T+2d  Drill #3 — synthetic API 5xx burst (INCIDENT_DRILL.md §3.3)            ⏳
T+3d  Drill post-mortem written; playbook updates merged                     ⏳
T+3d  Production cutover: scrape mainnet indexer + API                       ⏳
T+3d  On-call rotation activated (≥ 2 engineers)                             ⏳
T+4d  24-hour soak window — no Critical alerts firing falsely                ⏳
T+4d  STATUS.md verdict flipped to MONITORING-LIVE                           ⏳
T+11d Weekly alert-noise review (false-positive trimming)                    ♻️ recurring
```

`T` is the kickoff date — populated once all upstream gates close. The 24-hour soak window enforces a deliberate delay before the engagement is declared live so false-positive thresholds can be re-tuned.

A `BLOCKED` outcome at any drill pauses the engagement; the next attempt retries from the failed drill (idempotent re-run — see [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §6).

---

## 7. Security Requirements

The following constraints from issue #119 §7 are non-negotiable:

1. **Read-only monitoring.** No metric collection component issues a contract call. Indexer-derived metrics only. Enforced by [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §4.
2. **No private keys in monitoring infrastructure.** Monitoring credentials (PagerDuty / Grafana / Slack / Datadog API tokens) live in the operator's secret store, **never** in the repository, `.env` files, or GitHub Actions secrets shared with build CI. See [`STATUS.md`](./STATUS.md) §5.
3. **Access controls on alert channels.** Slack channels, email distribution lists, and dashboard access are gated by SSO. Public channels are forbidden for alert delivery. See [`STATUS.md`](./STATUS.md) §4.
4. **Two-minute notification SLA.** Critical alerts must be delivered to PagerDuty / OpsGenie within 120 seconds of threshold breach. Verified in [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3.
5. **Bridge events trigger a security review before manual intervention.** `CrossChainBridge` events fire an immediate notification but the runbook explicitly forbids any reactive on-chain action without a documented decision from the maintainer + security lead. Recorded in [`ALERT_RULES.md`](./ALERT_RULES.md) §3.6.
6. **Append-only drill log.** Drill reports under [`drills/`](./drills/) are never edited after the post-mortem is signed; corrections add a new dated report referencing the original.
7. **No PII / wallet seed in dashboards or logs.** Dashboard queries and log payloads are scrubbed per [`../MONITORING.md`](../MONITORING.md) §5.4.

---

## 8. Non-Functional Requirements

Mirror of issue #119 §6:

| # | Requirement | Where enforced |
|---|-------------|----------------|
| NFR-1 | Read-only indexer queries only — no contract calls from monitoring | [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §4 |
| NFR-2 | Notification delivery ≤ 2 minutes from threshold breach | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3 — measured in every drill |
| NFR-3 | Dashboards accessible without exposing sensitive infrastructure | [`STATUS.md`](./STATUS.md) §4 — SSO + role-based access |
| NFR-4 | Credentials never committed | [`STATUS.md`](./STATUS.md) §5 + `.gitignore` checks |
| NFR-5 | No private key access required | Architectural — backend holds no signing keys; reinforced by `CONTRIBUTING.md` §5 |
| NFR-6 | Monitoring stack survives indexer / API restarts | [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §6 — scrape job persistence policy |

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All six checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `MONITORING-LIVE` or `MONITORING-LIVE WITH ACCEPTED RISKS`.
- The three drills in [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3 are recorded under [`drills/`](./drills/) with `PASS` outcomes and signed post-mortems.
- [`docs/production/on-call.md`](../on-call.md) carries a populated rotation table with at least two engineers.
- [`CHANGELOG.md`](../../../CHANGELOG.md) carries a disclosure entry referencing the monitoring vendor, dashboards URLs (or access procedure), and the drill report filenames.
- The 24-hour soak window has elapsed with no Critical-severity false-positive alerts.

A verdict of `BLOCKED` or `PAUSED` keeps the engagement halted. Reverting to a prior monitoring posture is permitted via the kill-switch in [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §8.

---

## 10. References

- [Issue #119](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
- [Engagement status](./STATUS.md)
- [Stack selection](./STACK_SELECTION.md)
- [Alert rules](./ALERT_RULES.md)
- [Dashboards](./DASHBOARDS.md)
- [Metrics instrumentation](./METRICS_INSTRUMENTATION.md)
- [Implementation runbook](./IMPLEMENTATION_RUNBOOK.md)
- [Incident drill](./INCIDENT_DRILL.md)
- [Drill reports](./drills/)
- [Existing monitoring catalogue](../MONITORING.md)
- [SLA](../SLA.md)
- [On-call rotation](../on-call.md)
- [Incident response](../../security/INCIDENT_RESPONSE.md)
- [Key management](../../security/KEY_MANAGEMENT.md)
- [B2 mainnet engagement](../../deployments/B2-mainnet/ENGAGEMENT.md)
- [Development roadmap — Track B](../../../TEMP/DEVELOPMENT_ROADMAP.md)
