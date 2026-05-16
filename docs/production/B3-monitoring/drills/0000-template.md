# Drill Report Template (`0000`)

**This file is a template.** Copy it to `YYYYMMDD-HHMM-<scenario>.md` and fill in the placeholders before committing. The template itself is never edited in place — it is the canonical starting shape for every new drill report.

> Drill reports are **append-only** per [`../ENGAGEMENT.md`](../ENGAGEMENT.md) §7 #6. Corrections add a new report referencing the original; never edit a signed report after the fact.

---

## Header

- **Drill ID:** `YYYYMMDD-HHMM-<scenario>` (e.g., `20260520-1400-indexer-lag`)
- **Scenario reference:** [`../INCIDENT_DRILL.md`](../INCIDENT_DRILL.md) §3.x
- **Facilitator:** `@<github-handle>`
- **Primary on-call (drill participant):** `@<github-handle>`
- **Secondary on-call (observer):** `@<github-handle>`
- **Security lead (drill #2 only):** `@<github-handle>`
- **Staging commit hash:** `<sha>`
- **Drill window:** `<start UTC>` → `<end UTC>`
- **Verdict:** ⏳ Pending / ✅ PASS / ❌ FAIL / ⛔ BLOCKED

---

## Pre-flight

Confirm each row before T-0. A `❌` blocks the drill.

- [ ] All [`../INCIDENT_DRILL.md`](../INCIDENT_DRILL.md) §2 requirements verified.
- [ ] Staging Prometheus is scraping both targets with `env: staging`.
- [ ] Alertmanager routing to the synthetic Slack channel verified (no real PagerDuty page reaches a non-drill carrier).
- [ ] Drill facilitator + primary on-call online in the synthetic Slack channel.
- [ ] Rollback procedure ([`../INCIDENT_DRILL.md`](../INCIDENT_DRILL.md) §3.x "Rollback") confirmed available.
- [ ] No mainnet traffic affected (drill harness host has no mainnet credentials).

---

## Execution checklist

Mirror of [`../INCIDENT_DRILL.md`](../INCIDENT_DRILL.md) §4. Tick each row inline with the timestamp.

- [ ] Drill scenario: `<§3.1 / §3.2 / §3.3>`
- [ ] Start: `<UTC>`
- [ ] Threshold breach: `<UTC>` for `<rule ID>`
- [ ] Slack delivery: `<UTC>` (delta from breach: `<seconds>` s — must be ≤ 120 s)
- [ ] PagerDuty test-page: `<UTC>` (delta from breach: `<seconds>` s — must be ≤ 120 s, drills #1 and #3 only)
- [ ] On-call ack: `<UTC>` by `@<handle>` (within SLA — see [`../../SLA.md`](../../SLA.md) §5.1)
- [ ] Rollback executed: `<UTC>` — `<one-line summary>`
- [ ] Alerts auto-resolved: `<UTC>`
- [ ] End: `<UTC>`

---

## Pass criteria evaluation

Reference: [`../INCIDENT_DRILL.md`](../INCIDENT_DRILL.md) §3.x "Pass criteria"

| # | Criterion | Result |
|---|-----------|--------|
| 1 | <criterion> | ✅ / ❌ |
| 2 | <criterion> | ✅ / ❌ |
| … | … | … |

**Verdict:** `<PASS / FAIL / BLOCKED>`

---

## Post-mortem

### Timeline (UTC)

| Time | Event |
|------|-------|
| T-0  | Drill start |
| T+0  | Threshold breach |
| T+   | Rule `<R-NNN>` fired |
| T+   | Slack delivery |
| T+   | Page delivery |
| T+   | On-call ack |
| T+   | Rollback |
| T+   | Drill end |

### Observations

- **What went well:**
  - _…_
- **What went wrong:**
  - _…_
- **What surprised the facilitator:**
  - _…_

### Action items

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | _…_ | `@…` | Open |

Action items that change a Prometheus rule or an Alertmanager route MUST land in a follow-up PR before the next drill on the same scenario.

### Playbook updates

List edits made (or `None` if none). Each edit gets a one-line summary + the commit SHA once merged.

- `docs/security/INCIDENT_RESPONSE.md` — `<edit summary>` — `<sha>`
- `docs/production/B3-monitoring/provisioning/prometheus/alerts.yml` — `<edit summary>` — `<sha>`
- `docs/production/B3-monitoring/provisioning/alertmanager/routes.yml` — `<edit summary>` — `<sha>`
- `docs/production/on-call.md` — `<edit summary>` — `<sha>`

---

## Sign-off

| Role | Identity | Date | Signature method |
|------|----------|------|------------------|
| Facilitator | `@…` | `<UTC>` | git-commit |
| Primary on-call | `@…` | `<UTC>` | git-commit |
| Maintainer | `@konard` | `<UTC>` | git-commit |

A signed drill report is one that has been merged into the default branch with all three rows completed. Reverts or corrections to a signed report require a new report referencing this one.

---

## References

- [Drill brief](../INCIDENT_DRILL.md)
- [Engagement status](../STATUS.md) §6 — drill ledger row updated after sign-off
- [Alert rules](../ALERT_RULES.md)
- [On-call rotation](../../on-call.md)
- [SLA](../../SLA.md)
- [Incident response](../../../security/INCIDENT_RESPONSE.md)
