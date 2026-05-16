# B3 — Incident-Response Drill Brief

**Engagement:** [B3](./ENGAGEMENT.md)
**Issue reference:** [#119 §3 — Incident response, §8 — Acceptance criteria](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Drill ledger:** [`STATUS.md`](./STATUS.md) §6
**Drill reports directory:** [`drills/`](./drills/)
**Last Updated:** 2026-05-16

---

## 1. Purpose

A monitoring stack is only as useful as the human reflex it triggers. This document defines the **three drills** that must complete with a `PASS` verdict before the engagement can flip to `MONITORING-LIVE`, and the template every drill report follows.

Drills are **read-only**: they exercise the detection, paging, and acknowledgement path without touching mainnet contracts. Synthetic load is generated against the staging indexer + staging Merchant API. The protocol never receives the synthetic events.

Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7 #6 the drill log under [`drills/`](./drills/) is append-only — corrections are added as new reports referencing the original.

---

## 2. Staging environment requirements

Before any drill begins, confirm the following:

| Requirement | Verification |
|-------------|--------------|
| Staging indexer running with `/metrics` exposed | `curl -fsS https://indexer-staging.example/metrics -H "Authorization: Bearer …" \| head` returns Prometheus output |
| Staging Merchant API running with `/metrics` exposed | Same as above on the API URL |
| Prometheus scraping both targets with `env: staging` label | Prometheus targets page shows `UP` for both |
| Alertmanager wired to the synthetic `#tonbankcard-oncall-drill` Slack channel | `amtool alert add` produces a Slack message |
| PagerDuty / OpsGenie integration in **test mode** (no real page to the on-call carrier) | Vendor dashboard shows integration in test mode |
| `env=staging` route in [`provisioning/alertmanager/routes.yml`](./provisioning/alertmanager/routes.yml) confirmed to **suppress real PagerDuty** | Inspect the rendered Alertmanager config |
| Wall-clock NTP within ±2s on the host running the drill harness | `chronyc tracking` or equivalent |
| Drill facilitator and primary on-call both online and in the synthetic Slack channel | Slack roll-call before T-0 |

If any row is unmet, the drill is aborted and STATUS.md §6 records `BLOCKED` with the blocker.

---

## 3. Drill scenarios

Three independent scenarios. Each exercises a different rule family and a different paging path. Drills can run on the same day but **must** be separated by at least 15 minutes so signals do not interleave.

The notification SLA across all drills: **≤ 120 seconds** from threshold breach to Slack delivery, per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7 #4 (NFR-2).

### 3.1 Drill #1 — Indexer-lag injection

**Exercises:** R-002 (`ChainSyncStopped`, critical), R-003 (`IndexerLagHigh`, warning), R-015 (`BlockTimeStalled`, warning).

**Hypothesis:** A stalled indexer is detected and paged within the 120s SLA.

**Procedure:**

1. T-0: Facilitator records the staging Prometheus query value for `indexer_sync_lag_seconds`.
2. T+0: Facilitator pauses the staging indexer's chain-poll loop (feature flag `INDEXER_POLL_PAUSED=true`) — the indexer continues serving `/metrics` but the lag gauge climbs.
3. T+5m: R-003 (warning) fires; expected Slack delivery in `#tonbankcard-oncall-drill`.
4. T+~25m (≈500 blocks × 5s @ 5s/block): R-002 (critical) fires; expected PagerDuty test-page + Slack.
5. Primary on-call acknowledges in PagerDuty (test mode) and Slack.
6. Facilitator clears the feature flag — lag drops to baseline. Alerts auto-resolve.
7. Facilitator records timestamps for every transition in the drill report.

**Pass criteria:**

- R-003 fires within 5 minutes ± 30s of the lag crossing the threshold.
- R-002 fires within 5 minutes ± 30s of the lag crossing the threshold.
- Slack delivery ≤ 120s after rule transitions to `firing`.
- PagerDuty test-page received within the same 120s window.
- Primary on-call acknowledges R-002 within the SLA window from [`../SLA.md`](../SLA.md) §5.1 (15 min for critical).
- Both alerts auto-resolve within 10 minutes of the feature flag clearing.

**Rollback (if drill misbehaves):**

1. Clear `INDEXER_POLL_PAUSED` immediately.
2. Add a 1-hour Alertmanager silence for `IndexerDown|ChainSyncStopped|IndexerLagHigh` (drill annotation in description).
3. File a follow-up issue in the repository describing the misbehaviour.

### 3.2 Drill #2 — Fraud-lock burst

**Exercises:** R-009 (`FraudLockBurst`, critical), R-010 (`AnyFraudLockEvent`, critical).

**Hypothesis:** A burst of fraud-lock events is detected and reaches `#tonbankcard-security` within the 120s SLA, and the security lead acknowledges.

**Procedure:**

1. T-0: Facilitator confirms no real fraud-lock events are flowing in staging (`indexer_fraud_lock_events_total` baseline recorded).
2. T+0: Facilitator runs the synthetic-event injector (`scripts/drills/inject-fraud-locks.ts`, drill-only — never run against mainnet) that writes 12 synthetic `AccountLocks.SetLock` events with `category=FRAUD_LOCK` into the **staging indexer database** directly. The contract is **not** invoked.
3. Drill harness asserts that `tonbankcard_fraud_lock_events_total` and `tonbankcard_fraud_locks_active` reflect the injection within one scrape cycle (≤ 30s).
4. R-010 fires on the first synthetic event; expected Slack delivery to `#tonbankcard-security-drill`.
5. R-009 fires once the 1-hour increase counter crosses 10; the drill harness fast-forwards by injecting the events within a 1-minute window.
6. Security lead acknowledges in PagerDuty (test mode) and Slack.
7. Facilitator clears the synthetic events from the staging DB (`scripts/drills/clear-fraud-locks.ts`). Alerts auto-resolve within 1 hour as the increase window rolls over.

**Pass criteria:**

- Both R-010 and R-009 fire as described.
- Slack delivery to `#tonbankcard-security-drill` ≤ 120s after each rule fires.
- Security lead acknowledges R-009 within SLA.
- No mainnet contract was invoked — confirmed by the absence of any signed transaction from the drill harness host (audit log review).
- No PII or wallet-seed material appeared in the alert payloads — confirmed by reading the Slack message bodies against the metric-label allow-list in [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §4 #3.

**Rollback (if drill misbehaves):**

1. Stop the injector; clear the synthetic rows from staging DB.
2. Add a 1-hour Alertmanager silence with `category=fraud-lock-drill`.
3. File a follow-up issue.

### 3.3 Drill #3 — API 5xx burst

**Exercises:** R-005 (`APIErrorRateHigh`, warning), R-006 (`APIErrorRateCritical`, critical), R-007 (`APILatencyP99High`, warning).

**Hypothesis:** A sustained 5xx surge from the Merchant API is detected and paged within the 120s SLA, and the operational dashboard surfaces the offending route.

**Procedure:**

1. T-0: Facilitator records baseline `api_request_total` rate and P99 latency for the staging API.
2. T+0: Drill harness (`scripts/drills/api-5xx-storm.ts`) sends 200 req/s to a staging-only route `/__drill__/explode` that returns a 503 with a 2-second artificial sleep. The route is **only** mounted when `NODE_ENV=staging` and `DRILL_ROUTES_ENABLED=true`.
3. T+5m: R-005 (warning) fires once the 5-minute window's 5xx ratio exceeds 5%.
4. T+~5m: R-007 (warning) fires once P99 latency exceeds 2s for 5 minutes.
5. T+5m: R-006 (critical) fires once the 5xx ratio exceeds 20%; PagerDuty test-page expected.
6. Primary on-call acknowledges in PagerDuty (test mode) and Slack, opens the operational dashboard, and identifies `/__drill__/explode` as the dominant 5xx source within 5 minutes of acknowledgement.
7. Facilitator stops the harness; alerts auto-resolve within 5 minutes.

**Pass criteria:**

- R-005, R-006, R-007 all fire as described.
- PagerDuty test-page received for R-006 within 120s of firing.
- Primary on-call identifies the drill route from the dashboard within 5 minutes of acknowledgement.
- No real merchant traffic is affected — the staging API is dedicated to drills and synthetic load.
- Alerts auto-resolve once the harness stops.

**Rollback (if drill misbehaves):**

1. Stop the harness immediately.
2. Disable `DRILL_ROUTES_ENABLED` to unmount `/__drill__/*`.
3. Add a 1-hour Alertmanager silence for `APIErrorRate*|APILatencyP99High`.
4. File a follow-up issue.

---

## 4. Drill execution checklist

For every drill, the facilitator completes the following inline in the drill report:

- [ ] All §2 staging-environment requirements verified.
- [ ] Drill scenario reference (§3.1 / §3.2 / §3.3).
- [ ] Start timestamp (UTC).
- [ ] Threshold-breach timestamp (UTC) recorded for each rule.
- [ ] Slack delivery timestamp (UTC) recorded for each rule.
- [ ] PagerDuty test-page timestamp (UTC) recorded (drill #1 and #3).
- [ ] On-call acknowledgement timestamp (UTC) and engineer identity recorded.
- [ ] Rollback executed cleanly (or escalation initiated).
- [ ] End timestamp (UTC).
- [ ] Pass criteria evaluated against §3.x and verdict recorded (`PASS` / `FAIL` / `BLOCKED`).
- [ ] Post-mortem written per §5 — including any playbook updates merged into `docs/security/INCIDENT_RESPONSE.md` or `provisioning/prometheus/alerts.yml`.
- [ ] Drill report committed under [`drills/`](./drills/) with filename `YYYYMMDD-HHMM-<scenario>.md`.
- [ ] [`STATUS.md`](./STATUS.md) §6 row updated with the report link and outcome.

---

## 5. Post-mortem template

Every drill produces a post-mortem section in its drill report. Use the structure below verbatim so successive reports are comparable.

```markdown
## Post-mortem

### Timeline (UTC)

| Time | Event |
|------|-------|
| T-0  | Drill start |
| T+0  | Threshold breach |
| T+   | Rule fired |
| T+   | Slack delivery |
| T+   | Page delivery |
| T+   | On-call ack |
| T+   | Rollback |
| T+   | Drill end |

### Observations

- What went well
- What went wrong
- What surprised the facilitator

### Action items

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | … | @… | Open |

Action items that change a Prometheus rule or an Alertmanager route MUST land in a follow-up PR before the next drill.

### Playbook updates

List any edits to:

- `docs/security/INCIDENT_RESPONSE.md`
- `provisioning/prometheus/alerts.yml`
- `provisioning/alertmanager/routes.yml`
- `docs/production/on-call.md`

Each edit gets a one-line summary + the commit SHA once merged.
```

---

## 6. Idempotency & retries

Drills are **idempotent**: each rollback returns staging to its pre-drill state. A `FAIL` or `BLOCKED` outcome does not contaminate subsequent runs — the next attempt re-runs from the start of the scenario.

A `FAIL` verdict pauses the engagement until the action items are resolved. The next attempt requires a new drill report under [`drills/`](./drills/) (append-only); the original `FAIL` report is preserved.

Three consecutive `FAIL` verdicts on the same scenario triggers a B3.x follow-up engagement to redesign the rule or the harness; the on-call rotation continues to run from `docs/production/on-call.md` while the redesign is in flight.

---

## 7. Drill cadence after kickoff

| Cadence | Trigger |
|---------|---------|
| Initial run | T+2d of the engagement timeline ([`ENGAGEMENT.md`](./ENGAGEMENT.md) §6) |
| Quarterly | Rotate among scenarios + introduce one new scenario informed by real incidents |
| After a real incident | Re-run the scenario most related to the incident within 30 days |
| After any rule-threshold change | Re-run the scenario that exercises the changed rule |

Cadence policy is owned by the maintainer (`@konard`) per [`STATUS.md`](./STATUS.md) §11 Q-6.

---

## 8. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Alert rules](./ALERT_RULES.md)
- [Dashboards](./DASHBOARDS.md)
- [Metrics instrumentation](./METRICS_INSTRUMENTATION.md)
- [Implementation runbook](./IMPLEMENTATION_RUNBOOK.md)
- [On-call rotation](../on-call.md)
- [Incident response (security)](../../security/INCIDENT_RESPONSE.md)
- [SLA](../SLA.md)
- [Drill reports directory](./drills/)
- [Drill report template](./drills/0000-template.md)
