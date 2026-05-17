# Multi-Sig Card — Monitoring & Alerting

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document defines the alert catalogue, pager routing, and
disaster-recovery drills specific to the multi-sig surface. It is
the F5 addendum to the protocol monitoring spec in
[`docs/production/MONITORING.md`](../production/MONITORING.md) and is
referenced from the B3 engagement
([`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md))
as the multi-sig alert source.

The contract is **non-custodial (I1)** and **signer-authorised (I2,
I3)**. Monitoring at the multi-sig layer therefore has a narrow
load-bearing purpose: detect signer-key compromise (mass-rejected
approvals from a specific signer), composite-key collision attempts,
guardian-recovery takeover attempts, settlement gaps, and indexer
lag fast enough that the wallet UI's pending-approvals screen never
desyncs from chain.

---

## 2. Acceptance criterion this artifact satisfies

Issue #140 §3 _"pending approvals screen"_ depends on monitoring
observability so that ops can catch indexer lag before the screen
desyncs from chain. AC-6 _"guardian recovery flow"_ depends on
recovery-attempt pager alerts so that the legitimate owner can abort
within the 72 h cooldown. Indirectly informs AC-7 / AC-8 by providing
the alert surface the testnet rollout in
[`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) exercises.

---

## 3. Alert catalogue

Each alert has a unique ID (`MS-Mxx`), a trigger condition, a paging
rule, and a cross-reference to the document where the underlying
threshold lives (so the values stay consistent with the rest of F5).

### 3.1 Multi-sig lifecycle alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| MS-M01 | `ConfigureMultiSig` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §3.1](./SPECIFICATION.md) |
| MS-M02 | `RemoveMultiSig` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §6.2](./SPECIFICATION.md) |
| MS-M03 | `SubmitPaymentProposal` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §5.1](./SPECIFICATION.md) |
| MS-M04 | `PaymentProposalExecuted` event observed | P3 (info) | Indexer log only | [`SPECIFICATION.md` §3.4](./SPECIFICATION.md) |

### 3.2 Composite-key & signature replay alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| MS-M05 | Off-chain L1 detection: two distinct `(nft_address, proposal_id)` tuples hash to the same `proposalKey` (pre-MS-CH-1 defence in depth) | P0 | Pager fan-out — composite-key collision suspect | [`CONTRACT_HARDENING.md` MS-CH-1](./CONTRACT_HARDENING.md) |
| MS-M06 | `ApprovePaymentProposal` returns `ERROR_MS_ALREADY_APPROVED = 5` rate exceeds 1 % of approvals in 24 h | P2 | Bridge on-call within 15 min — wallet-ui likely surfacing stale state | [`SPECIFICATION.md` §5.2](./SPECIFICATION.md) |
| MS-M07 | A non-signer address attempts `ApprovePaymentProposal` (yields `ERROR_MS_NOT_SIGNER = 2`) ≥ 10 events in 1 h from the same address | P1 | Bridge on-call + security on-call within 5 min | [`SPECIFICATION.md` §7.4](./SPECIFICATION.md) |
| MS-M08 | `ERROR_MS_NOT_SIGNER` ≥ 50 events in 1 h aggregated across all addresses | P0 | Pager fan-out — potential systematic scan / signer-set leak | [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |

### 3.3 Settlement & recovery alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| MS-M09 | Proposal status flips to `PROPOSAL_APPROVED` but no `PaymentExecuted` callback observed within 5 min | P1 | Bridge on-call within 5 min — settlement-boundary gap | [`SPECIFICATION.md` §3.4](./SPECIFICATION.md), [`CONTRACT_HARDENING.md` MS-CH-3](./CONTRACT_HARDENING.md) |
| MS-M10 | `PaymentProposalExecuted` event count diverges from `PROPOSAL_APPROVED` transitions by > 1 % over 24 h | P2 | Bridge on-call within 15 min — indexer or Payment Hub anomaly | [`SPECIFICATION.md` §3.4](./SPECIFICATION.md) |
| MS-M11 | Proposal still `PENDING` and `now() - created_at > 6 d 12 h` (within 12 h of off-chain TTL) | P3 (info) | Wallet-ui surfaces a "near-expiry" badge | [`SPECIFICATION.md` §5.4](./SPECIFICATION.md), [`CONTRACT_HARDENING.md` MS-CH-5](./CONTRACT_HARDENING.md) |
| MS-M12 | `RecoveryInitiated` observed (off-chain alert until MS-CH-6; on-chain event after) | P1 | Bridge on-call + named NFT owner + all signers within 5 min | [`GUARDIAN_RECOVERY.md` §4](./GUARDIAN_RECOVERY.md) |
| MS-M13 | `RecoveryExecuted` observed | P1 | Bridge on-call + governance multi-sig within 5 min | [`GUARDIAN_RECOVERY.md` §6](./GUARDIAN_RECOVERY.md) |
| MS-M14 | Recovery cooldown bypass attempt: off-chain detection of `ExecuteRecovery` arriving before `created_at + MS_RECOVERY_COOLDOWN_SECONDS` (pre-MS-CH-6 defence in depth) | P0 | Pager fan-out — guardian collusion suspect | [`CONTRACT_HARDENING.md` MS-CH-6](./CONTRACT_HARDENING.md) |
| MS-M15 | `MultiSigConfigUpdated` event with a signer-set delta > 2 signers (i.e. wholesale signer-set rotation) | P1 | Bridge on-call + governance multi-sig within 5 min | [`SPECIFICATION.md` §6.1](./SPECIFICATION.md), [`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md) |

### 3.4 Notification system alerts

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| MS-M16 | Multi-sig notification scheduler missed a 5-min tick by > 2 ticks | P2 | Bridge on-call within 15 min | [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md) |
| MS-M17 | MS-N01 (signer-approval-needed) delivery success rate < 95 % over 24 h | P1 | Bridge on-call within 5 min — pending-approvals screen will desync from chain | [`NOTIFICATIONS.md` §3.1](./NOTIFICATIONS.md) |

### 3.5 Auto-pause auto-trigger (post-MS-CH-2)

| ID      | Trigger | Severity | Page | Cross-ref |
|---------|---------|---------:|------|-----------|
| MS-M18 | MS-M08 fires twice within 1 h **or** MS-M14 fires once | P0 | Pager fan-out + governance multi-sig dispatches `PauseMultiSig` (post-MS-CH-2 add-on; the pause path lands together with the `UpdateMultiSigConfig` plumbing) | [`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md) |

**Until MS-CH-2 ships, MS-M18 still pages** but the pause is
manual: the governance multi-sig signs an off-chain "halt multi-sig
approvals on card X" advisory that the wallet-ui CDN deploy
respects via a feature flag.

### 3.6 Roll-up — pager severity matrix

| Severity | Examples | First-page SLA | Channels (per `INCIDENT_RESPONSE.md` §3) |
|----------|----------|----------------|------------------------------------------|
| **P0** | MS-M05, MS-M08, MS-M14, MS-M18 | 1 min | Bridge on-call + security on-call + governance multi-sig members |
| **P1** | MS-M07, MS-M09, MS-M12, MS-M13, MS-M15, MS-M17 | 5 min | Bridge on-call |
| **P2** | MS-M06, MS-M10, MS-M16 | 15 min | Bridge on-call (asynchronous channel) |
| **P3** | MS-M01, MS-M02, MS-M03, MS-M04, MS-M11 | n/a | Log-only |

---

## 4. Data sources

| Source ID | Description | Owner | Latency |
|-----------|-------------|-------|---------|
| **DS-1** | TON indexer stream (`backend/indexer/`) — emits multi-sig events (`ConfigureMultiSig`, `SubmitPaymentProposal`, `PaymentProposalApproved`, `PaymentProposalExecuted`, `PaymentProposalRejected`, `MultiSigRemoved`) | Indexer team | < 30 s from chain |
| **DS-2** | Wallet-ui telemetry — per-approval result with `error_code` (subset of [`docs/error-codes.md`](../error-codes.md)) | Wallet-ui team | < 60 s |
| **DS-3** | Multi-sig notification scheduler logs (`backend/services/multisig-notification-scheduler.ts`, planned) — per-tick stats | Bridge team | < 60 s |
| **DS-4** | Off-chain composite-key collision watchdog (pre-MS-CH-1 defence in depth) — replays observed `proposalKey` and `approvalKey` values to detect duplicates | Security team | < 5 min |

---

## 5. Disaster-recovery drills

Each drill below runs **once per quarter** unless otherwise noted.
Drills are recorded in
`docs/security/audits/A2-phase4-contracts/STATUS.md` §"DR drill log"
under the multi-sig addendum.

| Drill | Frequency | Owner | Pass criteria |
|-------|-----------|-------|----------------|
| **DR-1** Signer key rotation simulation | quarterly | each multi-sig owner individually | New signer onboarded via the (post-MS-CH-2) `UpdateMultiSigConfig` flow; subsequent approval succeeds with `ERROR_MS_NONE`. |
| **DR-2** Indexer outage | quarterly | Indexer team | Pending-approvals screen surfaces a "stale data" banner within 60 s; on-call acknowledges within SLA. |
| **DR-3** Notification scheduler outage | quarterly | Bridge team | MS-M16 fires within 60 min; backfill MS-N01 events delivered after recovery within 2 h. |
| **DR-4** Guardian recovery drill (synthetic recovery proposal, cooldown not elapsed) | per release | Security team | MS-M12 paged within 5 min; MS-M14 triggered if cooldown is bypassed; recovery cancelled before execution. |
| **DR-5** Governance pause drill (post-MS-CH-2) | quarterly | governance multi-sig | Pause arms within 30 min of trigger; resume requires the incident-report flow. |

A missed drill blocks the next quarter's transparency report.

---

## 6. CI wiring

The alert catalogue's consistency is enforced by
[`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
(planned, see [`CONTRACT_HARDENING.md` §5](./CONTRACT_HARDENING.md)).
Specific checks:

1. **Catalogue uniqueness.** Every `MS-Mxx` ID appears exactly once
   in §3.
2. **Cross-ref resolvability.** Every cross-ref column entry must
   resolve to a heading in the named file.
3. **Severity matrix consistency.** Every MS-Mxx ID listed in §3
   must appear in exactly one row of §3.6.
4. **Hardening coupling.** MS-M18 must remain linked to
   [`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md);
   MS-M05 to MS-CH-1; MS-M09 to MS-CH-3; MS-M14 to MS-CH-6; MS-M15
   to MS-CH-2. Removing any of these links is a CI-blocking diff.

The validator runs in the F5 readiness CI job, gated on every PR
touching `docs/multisig/*.md`.

---

## 7. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §3.5 MS-M18 is gated on MS-CH-2 which itself gates on A2 verdict `READY`. |
| AC-4 | Multi-sig approval flow UX | §3.4 MS-M17 watches the notification scheduler that drives the wallet pending-approvals screen. |
| AC-5 | Pending approvals screen | MS-M11 surfaces the near-expiry badge; MS-M16/M17 keep the screen in sync. |
| AC-6 | Guardian recovery flow | §3.3 MS-M12..M14 page on every recovery attempt. |
| AC-7 | End-to-end testnet flow | §5 DR-1..DR-4 form the alert-rehearsal lattice exercised in [`TESTNET_DEPLOYMENT.md` §5](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Tests pass | §6 CI checks ride with the validator suite asserted in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| F4 monitoring pattern  | [`docs/recurring-payments/MONITORING.md`](../recurring-payments/MONITORING.md) |
| Production monitoring  | [`docs/production/MONITORING.md`](../production/MONITORING.md) |
| Incident response      | [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) |
| B3 monitoring engagement | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
