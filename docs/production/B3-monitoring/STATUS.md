# Engagement B3 — Status

**Engagement ID:** `B3`
**Issue:** [#119](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Implementation runbook:** [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md)
**Phase:** Engagement preparation
**Gating verdict:** ⏳ Pending — monitoring stack not yet deployed
**Public announcement:** ❌ Blocked until verdict = `MONITORING-LIVE` and the 24-hour soak window has elapsed
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues |
| Monitoring operator | TBD | On-call channel (see §4) |
| Primary on-call | TBD | PagerDuty / OpsGenie + Slack |
| Secondary on-call | TBD | PagerDuty / OpsGenie + Slack |
| Security lead | TBD | Signal + GitHub |
| Drill facilitator | TBD | Records drill outcomes under [`drills/`](./drills/) |
| Communications lead | TBD | Owns public status updates if a Critical alert escalates |

On-call rotation, escalation, and contact channels are documented in [`../on-call.md`](../on-call.md). Identities are filled in there once the rotation is provisioned.

---

## 2. Upstream gates

Mirror of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4. The engagement may not be flipped to `MONITORING-LIVE` until every row below is ✅.

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G-1 | B2 verdict = `MAINNET-LIVE` | ⏳ Pending | [`../../deployments/B2-mainnet/STATUS.md`](../../deployments/B2-mainnet/STATUS.md) §1 |
| G-2 | Indexer + API export `/metrics` | ⏳ Pending | [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §3 |
| G-3 | Monitoring stack vendor selected | ⏳ Pending | [`STACK_SELECTION.md`](./STACK_SELECTION.md) §4 |
| G-4 | Alert channels provisioned with access controls | ⏳ Pending | See §4 below |
| G-5 | Monitoring credentials in secret store (no plaintext anywhere) | ⏳ Pending | See §5 below |
| G-6 | On-call rotation populated (≥ 2 engineers) | ⏳ Pending | [`../on-call.md`](../on-call.md) §2 |
| G-7 | Staging environment ready to fire test alerts | ⏳ Pending | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §2 |
| G-8 | Bridge alerts inert until A2 `READY` + bridge address recorded | ⏳ Pending | [`../../existing-contracts.md`](../../existing-contracts.md) |

---

## 3. Freeze commit & monitoring stack metadata

| Field | Value |
|-------|-------|
| Drill commit hash | TBD at kickoff (must equal the commit on which G-7 was run) |
| Monitoring vendor | TBD — recorded in [`STACK_SELECTION.md`](./STACK_SELECTION.md) §4 |
| Prometheus version (if applicable) | TBD |
| Grafana version (if applicable) | TBD |
| Alertmanager version (if applicable) | TBD |
| Datadog account ID (if applicable) | TBD — recorded only as opaque identifier |
| Indexer `/metrics` endpoint URL | `${INDEXER_BASE_URL}/metrics` — concrete URL recorded only in the operator's secret store |
| API `/metrics` endpoint URL | `${API_BASE_URL}/metrics` |
| Scrape interval | 30s (Prometheus) / 60s (Datadog) — see [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §3 |

The freeze commit gates the staging drill: any code change after that commit invalidates the drill and the next attempt must rebuild against the new commit.

---

## 4. Alert channels & access controls

| Channel | Purpose | Access policy | Status |
|---------|---------|---------------|--------|
| Slack `#tonbankcard-oncall` (private) | Critical + warning alerts | Invite-only via SSO group `oncall-engineers` | ⏳ TBD |
| Slack `#tonbankcard-security` (private) | Fraud-lock + bridge alerts | Invite-only via SSO group `security` | ⏳ TBD |
| Email `oncall@tonbankcard.example` | Backup for Slack failure | Distribution list, members synced with SSO group | ⏳ TBD |
| PagerDuty / OpsGenie service `tonbankcard-protocol` | Paging path for Critical alerts | SSO-gated; on-call schedule mirrored from [`../on-call.md`](../on-call.md) | ⏳ TBD |
| Grafana org `tonbankcard` | Dashboard hosting | SSO-gated; role: Viewer for team, Editor for operator | ⏳ TBD |

Public Slack channels and personal email addresses are forbidden alert sinks.

---

## 5. Secret-store policy

| Secret | Storage | Repo / CI exposure |
|--------|---------|--------------------|
| PagerDuty integration key | Operator secret manager (e.g., 1Password, Doppler, Vault) | ❌ MUST NOT appear in repo, `.env`, or GitHub Actions |
| Grafana admin password | Operator secret manager | ❌ |
| Slack webhook URLs | Operator secret manager | ❌ |
| Datadog API + APP keys | Operator secret manager | ❌ |
| SMTP credentials | Operator secret manager | ❌ |
| Indexer scrape token (if added) | Operator secret manager | ❌ |
| API scrape token (if added) | Operator secret manager | ❌ |

The repository contains only references (e.g., `${PAGERDUTY_INTEGRATION_KEY}`) — never values. The `.gitignore` blocks `.env*` and `secrets/` paths by convention; spot-check before pushing any provisioning change.

---

## 6. Drill ledger

Each drill is recorded as an independent report under [`drills/`](./drills/) with timestamp, scenario, outcome, and any playbook updates. Drills are append-only.

| # | Drill | Scenario reference | Date | Outcome | Report |
|---|-------|--------------------|------|---------|--------|
| 1 | Indexer-lag injection | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3.1 | TBD | ⏳ Pending | [`drills/0000-template.md`](./drills/0000-template.md) |
| 2 | Fraud-lock burst | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3.2 | TBD | ⏳ Pending | — |
| 3 | API 5xx burst | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3.3 | TBD | ⏳ Pending | — |

A drill `PASS` requires:

- Notification reached the on-call channel within 120 seconds.
- The on-call engineer acknowledged within the SLA defined in [`../SLA.md`](../SLA.md) §5.1.
- The post-mortem updates [`../../security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md) if a procedure gap was identified.

---

## 7. Alert-rule ledger

Mirror of [`ALERT_RULES.md`](./ALERT_RULES.md) §3. Rule identifiers are stable across this engagement and the Prometheus rules file.

| ID | Rule | Severity | Status | Last fired (staging) | Last fired (prod) |
|----|------|----------|--------|----------------------|-------------------|
| R-001 | `IndexerDown` | critical | ⏳ Pending | — | — |
| R-002 | `ChainSyncStopped` | critical | ⏳ Pending | — | — |
| R-003 | `IndexerLagHigh` | warning | ⏳ Pending | — | — |
| R-004 | `APIDown` | critical | ⏳ Pending | — | — |
| R-005 | `APIErrorRateHigh` | warning | ⏳ Pending | — | — |
| R-006 | `APIErrorRateCritical` | critical | ⏳ Pending | — | — |
| R-007 | `APILatencyP99High` | warning | ⏳ Pending | — | — |
| R-008 | `LargeOutgoingTransfer` | critical | ⏳ Pending | — | — |
| R-009 | `FraudLockBurst` | critical | ⏳ Pending | — | — |
| R-010 | `AnyFraudLockEvent` | critical | ⏳ Pending | — | — |
| R-011 | `CollateralLockBurst` | warning | ⏳ Pending | — | — |
| R-012 | `UnusualTBCVolume` | critical | ⏳ Pending | — | — |
| R-013 | `BridgeEventDetected` | critical (inert until A2 + bridge deploy) | ⏳ Inert | — | — |
| R-014 | `GovernanceProposalCreated` | info | ⏳ Pending | — | — |
| R-015 | `BlockTimeStalled` | warning | ⏳ Pending | — | — |
| R-016 | `ReorgDetected` | warning | ⏳ Pending | — | — |
| R-017 | `AdapterUnreachable` | warning | ⏳ Pending | — | — |
| R-018 | `AllAdaptersUnreachable` | critical | ⏳ Pending | — | — |
| R-019 | `DBWriteErrors` | warning | ⏳ Pending | — | — |

Each rule's exact PromQL expression and rationale live in [`ALERT_RULES.md`](./ALERT_RULES.md). The status column flips to ✅ only after the rule has been verified to fire in staging (drill or synthetic test).

---

## 8. Dashboard ledger

| ID | Dashboard | Provisioning file | Audience | Status |
|----|-----------|-------------------|----------|--------|
| D-1 | Operational | `provisioning/grafana/operational-dashboard.json` | On-call engineers | ⏳ Pending |
| D-2 | Security | `provisioning/grafana/security-dashboard.json` | Security + maintainer | ⏳ Pending |
| D-3 | Adapter status | `provisioning/grafana/adapter-dashboard.json` (optional, B3 stretch goal) | Operations + support | ⏳ Deferred |

Dashboard URLs are recorded only in the operator's runbook — not in this file — to avoid leaking internal infrastructure.

---

## 9. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| Stack selection | [`STACK_SELECTION.md`](./STACK_SELECTION.md) | — | |
| Alert rules (markdown) | [`ALERT_RULES.md`](./ALERT_RULES.md) | — | |
| Alert rules (Prometheus) | [`provisioning/prometheus/alerts.yml`](./provisioning/prometheus/alerts.yml) | — | Source of truth for thresholds |
| Recording rules (Prometheus) | [`provisioning/prometheus/recording.yml`](./provisioning/prometheus/recording.yml) | — | |
| Alertmanager routing | [`provisioning/alertmanager/routes.yml`](./provisioning/alertmanager/routes.yml) | — | |
| Operational dashboard | [`provisioning/grafana/operational-dashboard.json`](./provisioning/grafana/operational-dashboard.json) | — | |
| Security dashboard | [`provisioning/grafana/security-dashboard.json`](./provisioning/grafana/security-dashboard.json) | — | |
| Dashboards plan | [`DASHBOARDS.md`](./DASHBOARDS.md) | — | |
| Instrumentation contract | [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) | — | |
| Implementation runbook | [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) | — | |
| Incident drill brief | [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) | — | |
| Drill template | [`drills/0000-template.md`](./drills/0000-template.md) | — | |

SHA-256 columns are filled at intake of each artifact (post-merge).

---

## 10. Acceptance criteria progress

Mirror of issue #119 §8:

- [ ] At least one monitoring system deployed (Grafana or Datadog) — vendor pending in [`STACK_SELECTION.md`](./STACK_SELECTION.md)
- [ ] All alert rules defined and tested in a staging environment — rules defined in [`ALERT_RULES.md`](./ALERT_RULES.md) + `provisioning/prometheus/alerts.yml`; staging verification pending
- [ ] On-call rotation documented in `docs/production/on-call.md` — file created; rotation roster pending
- [ ] Incident response drill completed and playbook updated — drill template ready under [`drills/0000-template.md`](./drills/0000-template.md); drills pending
- [ ] All alerts verified to fire correctly in a test scenario — see §7 (status column pending)
- [ ] Dashboard accessible to all team members — provisioning files prepared; SSO wiring pending

---

## 11. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | Monitoring vendor — Grafana stack vs Datadog (cost / hosting / team familiarity) | `@konard` | Open — recorded in [`STACK_SELECTION.md`](./STACK_SELECTION.md) §4 |
| Q-2 | Concrete USD-equivalent threshold for `LargeOutgoingTransfer` (issue §5.1 says $10K) | `@konard` | Open — placeholder `LARGE_TRANSFER_TBC_THRESHOLD` |
| Q-3 | Definition of "unusual TBC volume" — fixed 2× 24-hour average, or adaptive baseline? | `@konard` | Open — `UNUSUAL_VOLUME_MULTIPLIER` placeholder = 2 |
| Q-4 | On-call rotation — two engineers vs three (sustainability) | `@konard` | Open |
| Q-5 | Bridge alert wiring — when does it move from `inert: true` to active? | `@konard` | Tied to A2 verdict |
| Q-6 | Drill cadence — quarterly after the initial kickoff? | `@konard` | Open |
| Q-7 | Status page (public) — out of scope of B3 or stretch goal? | `@konard` | Deferred to F7 unless explicitly requested |

Add rows as blockers surface; close rows by linking the resolving issue / commit.

---

## 12. Accepted deferrals

If any acceptance row cannot close before the 24-hour soak completes, the deferral is recorded here with an explicit operational-impact statement. A deferral involving a Critical-severity rule blocks `MONITORING-LIVE`.

| Item | Reason | Compensating control | Operational impact | Sign-off | Date |
|------|--------|----------------------|--------------------|----------|------|
| _none yet_ | — | — | — | — | — |

---

## 13. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this directory) | `@konard` |
