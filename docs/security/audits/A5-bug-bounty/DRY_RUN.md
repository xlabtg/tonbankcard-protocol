# A5 Bug Bounty — Dry-Run Plan

**Document Type:** Internal Dry-Run / Soft-Launch Plan
**Engagement:** [A5](./ENGAGEMENT.md) · [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Status:** Active (executed before public launch)
**Last Updated:** 2026-05-16

---

## 1. Purpose

The dry-run validates the **submission, triage, payout, and disclosure pipeline** before the program goes public. It satisfies acceptance criterion #6 of [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116): *"Dry-run submission tested through the platform."*

The dry-run is an **end-to-end rehearsal**, not a real bug report. Its goal is to exercise every SLA clock, every reporting field, every payout-disbursement step, and every public-disclosure artifact at least once on real infrastructure, with no public exposure of the program.

The dry-run must complete with no `Critical` or `High` open issues against itself, and the platform program page must remain in `private` / `unlisted` mode throughout (per [`STATUS.md`](./STATUS.md) §3 checklist row "Dry-run executed").

---

## 2. Preconditions

The dry-run cannot start until **all** of the following are true. The check is recorded in [`STATUS.md`](./STATUS.md) §3.

| Precondition | Source of truth | Required state |
|--------------|-----------------|----------------|
| A1 audit closed | [`audits/A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) | `Gating Decision: pass` |
| A2 audit closed | [`audits/A2-external-adapters/STATUS.md`](../A2-external-adapters/STATUS.md) | `Gating Decision: pass` |
| Platform vendor selected | [`STATUS.md`](./STATUS.md) §4 | `decided` |
| Platform account created (private) | [`STATUS.md`](./STATUS.md) §3 | `done` |
| [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) uploaded to platform draft | [`STATUS.md`](./STATUS.md) §9 | `done` (with SHA-256) |
| [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) referenced in platform brief | [`STATUS.md`](./STATUS.md) §9 | `done` |
| Triage owner assigned (24/7 escalation contact) | [`STATUS.md`](./STATUS.md) §1 | `name + paging method` |
| Payout treasury funded with at least 1× Critical (smart contract) reward | [`STATUS.md`](./STATUS.md) §11 | `funded` |
| KYC / sanctions screening flow tested with at least one mock researcher identity | [`STATUS.md`](./STATUS.md) §11 | `tested` |
| Webhook receiver for platform → internal ticket system online | [`STATUS.md`](./STATUS.md) §3 | `online` |
| `reports/` directory exists with [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) committed | this repo | `done` |

If any row is not `done`, the dry-run is **blocked** and a row is added to [`STATUS.md`](./STATUS.md) §12 (open questions) describing the blocker.

---

## 3. Roles for the Rehearsal

The dry-run is staffed exclusively by internal participants. No external researcher is involved.

| Role | Responsibility | Performed by |
|------|----------------|--------------|
| Synthetic researcher | Files the rehearsal report on the platform under a dedicated test account; never uses a real-world handle | Security maintainer (rotates per quarter) |
| Triage owner | Receives the platform notification, acknowledges within the §5.3 SLA, classifies severity | Triage owner of record ([`STATUS.md`](./STATUS.md) §1) |
| Reviewer | Validates the proposed severity, signs off on payout amount | Second maintainer |
| Treasury | Disburses the rehearsal payout to a wallet controlled by the security team | Treasury operator ([`STATUS.md`](./STATUS.md) §1) |
| Observer | Records timing, evidence, and findings against the rehearsal itself | Engineering manager |

The synthetic researcher and the triage owner **must** be different people, so the SLA clock and the platform notification path are exercised end-to-end.

---

## 4. Scenarios

Four scenarios are required for a passing dry-run. Each scenario exercises a different code path. All four can run in parallel on the platform after the first acknowledgement clock is verified.

### 4.1 Scenario S1 — Valid Critical (smart contract)

- **Synthetic finding:** a pre-staged invariant break in a private test branch (never merged) that maps to `I5` Ledger Conservation. The PoC is a transaction trace on local sandbox; no testnet deployment.
- **Expected severity:** 🔴 Critical (smart contract).
- **Expected payout band:** $10,000 baseline, no uplift.
- **Validates:** Critical acknowledgement SLA, Critical severity floor in [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) §3.1, treasury disbursement of the largest baseline reward, coordinated-disclosure window calculation.

### 4.2 Scenario S2 — Valid High (off-chain)

- **Synthetic finding:** a fabricated cross-merchant IDOR PoC against a staging copy of `api/` that exposes one merchant's invoice list to another merchant's API key.
- **Expected severity:** 🟠 High (off-chain).
- **Expected payout band:** $2,500.
- **Validates:** off-chain severity classification, post-D4 webhook-replay reasoning if applicable, payout in non-Critical band.

### 4.3 Scenario S3 — Duplicate

- **Synthetic finding:** the same `I5` PoC from S1 filed by the synthetic researcher under a second platform account, after S1 has been triaged but before it is publicly disclosed.
- **Expected outcome:** marked `Duplicate` per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.5; not eligible for payout; counted under §4 of [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) "Duplicate".
- **Validates:** duplicate-detection policy, researcher-facing communication template, counter reconciliation in the quarterly report.

### 4.4 Scenario S4 — Out-of-scope

- **Synthetic finding:** a volumetric DoS against the public health endpoint, filed with no invariant impact and no fund-loss path.
- **Expected outcome:** marked `Out-of-scope` per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3.4; not eligible for payout; counted under §4 of [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) "Out-of-scope".
- **Validates:** out-of-scope rejection template, researcher-facing tone (no penalty for filing in good faith), counter reconciliation.

### 4.5 Optional Scenario S5 — Researcher-team severity disagreement

If time and people allow, run a fifth scenario where the synthetic researcher proposes 🔴 Critical for a finding the team rates 🟠 High. This exercises the `team's decision is final but accompanied by written rationale` clause in [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) §3. Skipping S5 is acceptable; it must then be verified in the first real submission post-launch.

---

## 5. Timeline

The dry-run is designed to complete in **two business weeks** end-to-end. Day numbering starts when the first synthetic report is filed.

| Day | Activity | Owner | Output |
|-----|----------|-------|--------|
| D-3 | Final go/no-go review against §2 preconditions | Triage owner | Row updated in [`STATUS.md`](./STATUS.md) §3 |
| D0 morning | Synthetic researcher files S1 | Synthetic researcher | Platform submission ID logged |
| D0 evening | Triage owner acknowledges S1 | Triage owner | Acknowledge timestamp logged |
| D1 | Triage owner files S2, S4 in parallel | Synthetic researcher / triage owner | Two more submission IDs logged |
| D2 | Severity classification for S1 published to platform | Triage owner + reviewer | Severity decision recorded per [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) §3 |
| D3 | S3 (duplicate) filed | Synthetic researcher | Duplicate detection exercised |
| D4 | Severity decisions for S2, S3, S4 published | Triage owner + reviewer | All four severity decisions on record |
| D5–D7 | Internal "fix" simulated (the synthetic findings target staging only — no real code change is merged) | Engineering | Fix simulated and recorded |
| D8 | Payout disbursement for S1 and S2 to security-team-controlled wallet | Treasury | On-chain payout tx hashes recorded |
| D9 | Coordinated-disclosure timing verified (90-day clock would start; for the dry-run, we explicitly do not publish) | Triage owner | Disclosure clock test recorded |
| D10 | Dry-run quarterly-report draft produced from [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) using S1–S4 data | Report author | Draft committed to `reports/dry-run-<YYYY-MM-DD>.md` |
| D11–D12 | Post-mortem against §6 exit criteria | All roles | Decision logged in [`STATUS.md`](./STATUS.md) §3 |

If the dry-run cannot complete within two weeks because of a blocker found mid-rehearsal, **pause** the dry-run, fix the blocker, and restart from D0. Do not extend the timeline silently — a row must be added to [`STATUS.md`](./STATUS.md) §12.

---

## 6. Exit Criteria

The dry-run is `pass` only when **all** of the following hold:

- All four required scenarios (S1–S4) ran end-to-end with no manual workaround outside the documented process.
- Every SLA in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.3 was met for S1 and S2 (acknowledgement, severity classification, payout).
- The treasury disbursement for S1 and S2 settled on-chain within the SLA window and was reconciled against the platform's payout log.
- The quarterly-report draft produced on D10 reconciles row-for-row against [`STATUS.md`](./STATUS.md) §6 (findings ledger) and §7 (SLA tracker).
- No finding against the dry-run **itself** is rated 🔴 Critical or 🟠 High in the post-mortem.
- The platform program page remained `private` / `unlisted` throughout. No external researcher viewed it.

Any failure on a single criterion blocks the public launch. The remediation is recorded in [`STATUS.md`](./STATUS.md) §12 (open questions) with a target re-run date.

---

## 7. Cleanup

Within five business days after exit criteria are met:

- Close all four synthetic platform submissions as `dry-run, no real impact`. Do not delete them — the platform's audit log of the rehearsal is the durable evidence.
- Return the dry-run payout balances from the security-team-controlled wallet to the program treasury. Record on-chain reversal tx hashes in [`STATUS.md`](./STATUS.md) §3.
- Commit the dry-run quarterly-report draft to `reports/dry-run-<YYYY-MM-DD>.md` for historical reference. The first **public** quarterly report (per [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md)) is produced separately at the end of the first calendar quarter post-launch.
- File a `docs(security): A5 dry-run report <date>` PR linking: the four platform submission IDs, the post-mortem notes, and the row update in [`STATUS.md`](./STATUS.md) §3 checklist.
- Schedule the public launch per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7 only after this PR is merged.

---

## 8. Post-Launch Re-Run Triggers

A dry-run is repeated (in whole or in part) whenever any of the following occur after the public launch:

- The triage owner of record in [`STATUS.md`](./STATUS.md) §1 changes.
- A new component is added to scope per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3 (run S2 against the new component).
- The platform vendor changes (full dry-run).
- A reward band changes by more than 25 % in either direction (run S1 to validate the new Critical disbursement path).
- An SLA in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.3 changes.
- An audit at A1 or A2 produces a re-issued [`STATUS.md`](./STATUS.md) `Gating Decision`.

Each re-run is recorded in [`STATUS.md`](./STATUS.md) §13 (change log).

---

## 9. References

- [Engagement plan](./ENGAGEMENT.md) (§7 timeline, §9 acceptance)
- [Engagement status](./STATUS.md) (§1 parties, §3 launch checklist, §9 artifacts, §11 compliance, §12 open questions, §13 change log)
- [Program brief](./PROGRAM_BRIEF.md) (§3 scope, §5.3 SLAs, §5.4 disclosure, §5.5 duplicates)
- [Severity rubric](./SEVERITY_RUBRIC.md)
- [Quarterly report template](./QUARTERLY_REPORT_TEMPLATE.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [A1 audit status](../A1-core-contracts/STATUS.md)
- [A2 audit status](../A2-external-adapters/STATUS.md)
- [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
