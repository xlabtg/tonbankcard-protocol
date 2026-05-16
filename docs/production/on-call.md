# On-Call Rotation

**Owner:** `@konard`
**Source-of-truth document:** this file (Markdown). Vendor schedules (PagerDuty / OpsGenie) **mirror** this file — never the other way around.
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document is the single source of truth for who is on call for the TONBANKCARD protocol, how alerts reach them, and what they are authorised to do once an alert fires. It serves two engagements directly:

- **B3 — Production Monitoring & Alerting** ([`B3-monitoring/ENGAGEMENT.md`](./B3-monitoring/ENGAGEMENT.md)) — referenced by gate G-6, the drill brief, and the implementation runbook.
- **Security incident response** ([`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md)) — the on-call engineer is the first responder for any Critical-severity alert.

Public access to the actual rotation roster (names, time zones, contact channels) is forbidden — see §6 below. This file carries the structure; concrete identities live in the operator's secret store until the engagement closes.

---

## 2. Rotation roster

The rotation requires **at least two engineers** at all times — primary + secondary — per [`B3-monitoring/ENGAGEMENT.md`](./B3-monitoring/ENGAGEMENT.md) §4 G-6 and issue #119 §6 (NFR: "No single point of failure"). A single-engineer rotation is forbidden because it both burns out the engineer and breaks the escalation path in §3.

| Slot | Role | Identity | Time zone | Channels | Authorised actions |
|------|------|----------|-----------|----------|--------------------|
| 1 | Primary on-call (this week) | TBD | TBD | PagerDuty + Slack `#tonbankcard-oncall` | Acknowledge, triage, communicate, page secondary |
| 2 | Secondary on-call (this week) | TBD | TBD | PagerDuty + Slack `#tonbankcard-oncall` | Same as primary; replaces primary if unresponsive in 15m |
| 3 | Maintainer / coordinator | `@konard` | UTC+3 | GitHub + Slack `#tonbankcard-oncall` | Owns escalation, approves rule changes |
| 4 | Security lead | TBD | TBD | Signal + Slack `#tonbankcard-security` | Owns security-classified alerts (R-008, R-009, R-010, R-012, R-013) |
| 5 | Communications lead | TBD | TBD | Slack `#tonbankcard-status` | Drafts and posts public communications if §3 escalates beyond an internal incident |

Identities are stored in the operator's secret store and surfaced into PagerDuty / OpsGenie. The values above stay as `TBD` in the public repository — the engagement gate G-6 closes when the operator confirms (via [`B3-monitoring/STATUS.md`](./B3-monitoring/STATUS.md) §1) that slots 1–4 are populated with real names.

A weekly rotation cycle is the default; pairs swap every Monday 09:00 UTC. Hand-offs happen in `#tonbankcard-oncall` with a one-line summary of any open incident.

---

## 3. Escalation path

Triggered by any Critical-severity alert (per [`B3-monitoring/ALERT_RULES.md`](./B3-monitoring/ALERT_RULES.md) §2) or by manual escalation:

```
[Alert fires]
    │
    ▼
T+0      PagerDuty / OpsGenie pages the primary on-call
    │   + Slack mention in #tonbankcard-oncall
    │
    ▼
T+15m    If primary has not acknowledged → page secondary on-call
    │   (SLA from docs/production/SLA.md §5.1)
    │
    ▼
T+30m    If neither has acknowledged → page maintainer (@konard)
    │   + post in #tonbankcard-oncall: "Escalation: no ack at T+30m"
    │
    ▼
T+45m    Maintainer evaluates — invoke secondary contact path (§4) if
    │   PagerDuty itself appears compromised or unreachable.
    │
    ▼
T+60m    For security-classified alerts (category=security label):
    │   security lead joins regardless of ack status.
    │
    ▼
T+ ad-hoc  Communications lead drafts public update if the incident
           breaches the SLA window in docs/production/SLA.md §5.2.
```

Escalation is **cumulative** — the secondary does not replace the primary, they pair. Maintainer joining does not remove the primary / secondary; they retain ownership unless they explicitly hand off.

---

## 4. Secondary contact path

The primary channel is PagerDuty / OpsGenie. If that channel is unavailable (vendor outage, mass credential rotation, accidental on-call deletion), the fall-back is:

1. **Slack** `#tonbankcard-oncall` — `@here` mention.
2. **Email** `oncall@tonbankcard.example` — distribution list synced with the SSO group `oncall-engineers`.
3. **Signal group** "TONBANKCARD Ops" — invite-only; maintained by `@konard`. Used only when Slack itself is the vendor outage.

The contact-path order is intentional: PagerDuty has the strictest SLA, Slack is fastest in the typical workday, email survives both, and Signal survives Slack. Personal phone numbers are **not** an alert sink — escalation to a phone happens only via PagerDuty's voice-call mode.

If even Signal is unreachable, the maintainer's last-resort fall-back is a direct GitHub issue on `xlabtg/tonbankcard-protocol` tagged `incident-escalation` — visible to all maintainers and the security lead. This path is **always** the documented retreat option; do not add another below it.

---

## 5. Hand-off checklist

On hand-off (weekly, or ad-hoc when the roster changes), the outgoing primary posts the following in `#tonbankcard-oncall`:

- [ ] PagerDuty schedule confirms the new primary + secondary for the coming week.
- [ ] Any open alerts (firing or silenced) listed with their R-NNN ID, age, and last action.
- [ ] Any active Alertmanager silences listed with expiry and reason.
- [ ] Any pending follow-up issues from the previous week's alerts linked.
- [ ] Reminder of the active drill ([`B3-monitoring/INCIDENT_DRILL.md`](./B3-monitoring/INCIDENT_DRILL.md) §7 cadence) if one is scheduled.

The incoming primary acknowledges with `:wave:` in the same thread. No further sign-off is required; the hand-off is logged in Slack history.

---

## 6. Privacy & access

- The concrete names, time zones, and contact handles in §2 live only in the operator's secret store and in vendor consoles (PagerDuty / OpsGenie / Slack). They are **never** committed to this repository.
- The Slack channels `#tonbankcard-oncall` and `#tonbankcard-security` are SSO-gated and invite-only. Public Slack channels are forbidden alert sinks per [`B3-monitoring/STATUS.md`](./B3-monitoring/STATUS.md) §4.
- Dashboard URLs are shared via the on-call channel, not via this document — leaking a dashboard URL into the public repo is a minor incident in its own right (cost: one rotation of dashboard access tokens).
- The on-call schedule export from PagerDuty / OpsGenie must redact email addresses before being attached to any GitHub issue or PR.

---

## 7. Authorised actions for the on-call engineer

The on-call engineer **may**:

- Acknowledge, triage, and communicate any alert.
- Apply an Alertmanager silence of ≤ 1 hour for a Critical-severity rule (longer silences require a follow-up issue; see [`B3-monitoring/ALERT_RULES.md`](./B3-monitoring/ALERT_RULES.md) §5).
- Restart the indexer or Merchant API service if no crash-loop pattern is observed.
- Page the secondary on-call, the maintainer, the security lead, or the communications lead.
- Open an incident issue tagged `incident` on `xlabtg/tonbankcard-protocol`.

The on-call engineer **may not**:

- Sign any transaction touching mainnet state.
- Rotate admin or risk-authority keys without the maintainer present.
- Edit a signed drill report under [`B3-monitoring/drills/`](./B3-monitoring/drills/) (append a new one instead).
- Disable on-call paging itself — only individual noisy rules. If on-call paging is the problem, switch to the secondary contact path in §4.
- Bypass any protocol invariant (per [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) "Core Principles").

This separation is non-negotiable. The monitoring stack is read-only by design; the on-call engineer is the human signal, not the actuator.

---

## 8. References

- [B3 engagement plan](./B3-monitoring/ENGAGEMENT.md)
- [B3 engagement status](./B3-monitoring/STATUS.md) — §1 records the populated rotation
- [B3 alert rules](./B3-monitoring/ALERT_RULES.md) — §4 acknowledgement path
- [B3 incident drill](./B3-monitoring/INCIDENT_DRILL.md) — drill cadence + post-mortem template
- [B3 implementation runbook](./B3-monitoring/IMPLEMENTATION_RUNBOOK.md) — §5 routing, §8 kill-switch
- [SLA](./SLA.md) — §5.1 acknowledgement SLAs
- [Existing monitoring catalogue](./MONITORING.md) — higher-level monitoring strategy
- [Security incident response](../security/INCIDENT_RESPONSE.md) — first-responder procedures
- [Key management](../security/KEY_MANAGEMENT.md) — admin / risk-authority key custody
