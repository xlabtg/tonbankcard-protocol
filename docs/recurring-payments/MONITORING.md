# Recurring Payments — Monitoring & Alerting

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document defines the alert catalogue, pager routing, and
disaster-recovery drills specific to the recurring-payments surface.
It is the F4 addendum to the protocol monitoring spec in
[`docs/production/MONITORING.md`](../production/MONITORING.md) and is
referenced from the B3 engagement
([`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md))
as the recurring-payments alert source.

The contract is **non-custodial (I1)** and **owner-authorised (I2,
I3)**. Monitoring at the recurring-payments layer therefore has a
narrow load-bearing purpose: detect merchant misbehaviour
(over-execution, premature execution attempts), executor-key
compromise, indexer lag, and grace-period lapses fast enough that
manual intervention (the user signs `CancelMandate`) is feasible.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §6 NFR _"Subscription cancellation effective before next
billing cycle"_ depends on monitoring observability so that ops can
catch executor mis-fires before the next period. Indirectly informs
AC-7 / AC-8 by providing the alert surface the testnet rollout in
[`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) exercises.

---

## 3. Alert catalogue

Each alert has a unique ID (`SUB-Mxx`), a trigger condition, a paging
rule, and a cross-reference to the document where the underlying
threshold lives (so the values stay consistent with the rest of F4).

### 3.1 Mandate lifecycle alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M01 | `MandateCreated` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §3](./SPECIFICATION.md) |
| SUB-M02 | `RecurringPaymentExecuted` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §5.2](./SPECIFICATION.md) |
| SUB-M03 | `MandateCancelled` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §6.2](./SPECIFICATION.md) |
| SUB-M04 | Mandate transitions to `MANDATE_COMPLETED` (post-max-executions) | P3 (info) | Indexer log only | [`SPECIFICATION.md` §5.3](./SPECIFICATION.md) |

### 3.2 Replay / over-execution alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M05 | A merchant executor dispatches `ExecuteRecurringPayment` and receives `ERROR_RP_TOO_EARLY` (6) | P2 | Bridge on-call within 15 min | [`DASHBOARD_INTEGRATION.md` §5.1](./DASHBOARD_INTEGRATION.md) |
| SUB-M06 | Same merchant produces `ERROR_RP_TOO_EARLY` ≥ 3 times in 1 h | P1 | Bridge on-call within 5 min — merchant executor likely mis-configured | [`DASHBOARD_INTEGRATION.md` §5.1](./DASHBOARD_INTEGRATION.md) |
| SUB-M07 | A non-merchant, non-owner address attempts `ExecuteRecurringPayment` (yields `ERROR_RP_NOT_AUTHORIZED` (9)) | P1 | Bridge on-call + security on-call within 5 min | [`SPECIFICATION.md` §5.1](./SPECIFICATION.md) |
| SUB-M08 | `ERROR_RP_NOT_AUTHORIZED` ≥ 10 events in 1 h originating from the same address | P0 | Pager fan-out — potential systematic abuse | [`SPECIFICATION.md` §7](./SPECIFICATION.md) |

### 3.3 Grace-period & lapsed alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M09 | A mandate enters `lapsed` state (`now() - last_executed_at > period_seconds + grace_seconds`) | P3 (info) | Dashboard event log | [`SPECIFICATION.md` §6](./SPECIFICATION.md) |
| SUB-M10 | Lapse rate exceeds 5 % of active mandates in 24 h | P2 | Bridge on-call within 15 min — likely executor outage | [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md) |
| SUB-M11 | Lapse rate exceeds 25 % of active mandates in 24 h | P1 | Bridge on-call within 5 min — protocol-wide executor incident | [`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md) |

### 3.4 Notification-system alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M12 | Notification scheduler missed a 30-min tick by > 2 ticks | P2 | Bridge on-call within 15 min | [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md) |
| SUB-M13 | RP-N01 (T-3d) delivery success rate < 95 % over 24 h | P2 | Bridge on-call within 15 min | [`NOTIFICATIONS.md` §5.2](./NOTIFICATIONS.md) |
| SUB-M14 | RP-N08 (grace-lapse) delivery success rate < 99 % over 24 h | P1 | Bridge on-call within 5 min — user-facing failure mode | [`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md) |

### 3.5 Indexer & executor alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M15 | Indexer lag against TON head > 60 s | P1 | Bridge on-call within 5 min — affects executor and notifications | [`docs/production/MONITORING.md`](../production/MONITORING.md) |
| SUB-M16 | Merchant executor cron has not run for > 2 periods of its shortest mandate | P1 | Bridge on-call + named merchant operator within 5 min | [`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md) |
| SUB-M17 | More than 1 % of executor dispatches retried 3 times before success | P2 | Bridge on-call within 15 min | [`DASHBOARD_INTEGRATION.md` §5.1](./DASHBOARD_INTEGRATION.md) |

### 3.6 Auto-pause auto-trigger (post-RP-CH-3)

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| SUB-M18 | SUB-M08 fires twice within 1 h | P0 | Pager fan-out + governance multi-sig dispatches `PauseRecurringPayments` (post-RP-CH-3, see [`CONTRACT_HARDENING.md` §3 RP-CH-3](./CONTRACT_HARDENING.md)) | [`CONTRACT_HARDENING.md` RP-CH-3](./CONTRACT_HARDENING.md) |

**Until RP-CH-3 ships, SUB-M18 still pages** but the pause is
manual: the governance multi-sig signs an off-chain "halt executor"
advisory that all merchant operators MUST respect, and the dashboard
disables the new-plan form behind a feature flag.

### 3.7 Roll-up — pager severity matrix

| Severity | Examples | First-page SLA | Channels (per `INCIDENT_RESPONSE.md` §3) |
|----------|----------|----------------|------------------------------------------|
| **P0** | SUB-M08, SUB-M18 | 1 min | Bridge on-call + security on-call + governance multi-sig members |
| **P1** | SUB-M06, SUB-M07, SUB-M11, SUB-M14, SUB-M15, SUB-M16 | 5 min | Bridge on-call |
| **P2** | SUB-M05, SUB-M10, SUB-M12, SUB-M13, SUB-M17 | 15 min | Bridge on-call (asynchronous channel) |
| **P3** | SUB-M01, SUB-M02, SUB-M03, SUB-M04, SUB-M09 | n/a | Log-only |

---

## 4. Data sources

| Source ID | Description | Owner | Latency |
|-----------|-------------|-------|---------|
| **DS-1** | TON indexer stream (`backend/indexer/`) — emits `MandateCreated` / `RecurringPaymentExecuted` / `MandateCancelled` / `MandateCompleted` events | Indexer team | < 30 s from chain |
| **DS-2** | Dashboard executor logs (`backend/services/recurring-executor.ts`, planned) — per-dispatch result with `error_code` | Bridge team | < 60 s |
| **DS-3** | Notification scheduler logs (`backend/services/notification-scheduler.ts`, planned) — per-tick stats | Bridge team | < 60 s |
| **DS-4** | Merchant webhook delivery stats — existing notification service | Notification service | < 90 s |

---

## 5. Disaster-recovery drills

Each drill below runs **once per quarter** unless otherwise noted.
Drills are recorded in
`docs/security/audits/A2-phase4-contracts/STATUS.md` §"DR drill log"
under the recurring-payments addendum.

| Drill | Frequency | Owner | Pass criteria |
|-------|-----------|-------|----------------|
| **DR-1** Executor key rotation simulation | quarterly | each merchant individually | New executor key onboarded; subsequent dispatch succeeds with `ERROR_RP_NONE`. |
| **DR-2** Indexer outage | quarterly | Indexer team | SUB-M15 fires within 60 s; on-call acknowledges within SLA. |
| **DR-3** Notification scheduler outage | quarterly | Bridge team | SUB-M12 fires within 60 min; backfill RP-N01 events delivered after recovery within 2 h. |
| **DR-4** Grace-lapse drill (synthetic mandate, simulated executor outage) | per release | QA team | Dashboard transitions to `lapsed` within the configured grace window; RP-N08 delivered within 5 min of lapse. |
| **DR-5** Governance pause drill (post-RP-CH-3) | quarterly | governance multi-sig | Pause arms within 30 min of trigger; resume requires the incident-report flow. |

A missed drill blocks the next quarter's transparency report.

---

## 6. CI wiring

The alert catalogue's consistency is enforced by
[`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
(planned, see [`CONTRACT_HARDENING.md` §5](./CONTRACT_HARDENING.md)).
Specific checks:

1. **Catalogue uniqueness.** Every `SUB-Mxx` ID appears exactly once
   in §3.
2. **Cross-ref resolvability.** Every cross-ref column entry must
   resolve to a heading in the named file.
3. **Severity matrix consistency.** Every SUB-Mxx ID listed in §3
   must appear in exactly one row of §3.7.
4. **Hardening coupling.** SUB-M18 must remain linked to
   [`CONTRACT_HARDENING.md` §3 RP-CH-3](./CONTRACT_HARDENING.md);
   removing the link is a CI-blocking diff.

The validator runs in the F4 readiness CI job, gated on every PR
touching `docs/recurring-payments/*.md`.

---

## 7. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §3.6 SUB-M18 is gated on RP-CH-3 which itself gates on A2 verdict `READY`. |
| AC-4 | Merchant dashboard subscription section | §3.5 SUB-M16 watches the dashboard executor. |
| AC-6 | User notification system | §3.4 SUB-M12..M14 watch the notification scheduler. |
| AC-7 | End-to-end testnet flow | §5 DR-1..DR-4 form the alert-rehearsal lattice exercised in [`TESTNET_DEPLOYMENT.md` §5](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Tests pass | §6 CI checks ride with the validator suite asserted in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Production monitoring  | [`docs/production/MONITORING.md`](../production/MONITORING.md) |
| Incident response      | [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) |
| B3 monitoring engagement | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
