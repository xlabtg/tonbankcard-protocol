# Engagement A2 — Status

**Engagement ID:** `A2`
**Issue:** [#113](https://github.com/xlabtg/tonbankcard-protocol/issues/113)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Workflow:** [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md)
**Phase:** Engagement preparation — awaiting A1 sign-off
**Gating verdict:** ⏳ Pending — A1 must complete and firm must be selected
**Mainnet deployment of in-scope contracts:** ❌ Blocked until verdict = READY (or READY WITH ACCEPTED RISKS)
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues + private email TBD at kickoff |
| Triage owner | `@konard` | GitHub issues |
| Auditor (firm) | — | TBD |
| Auditor (lead) | — | TBD |
| Bridge specialist (auditor side) | — | TBD — required per issue #113 §1 (cross-chain bridge dedicated review) |

Add additional rows as required when the contract is signed.

---

## 2. Upstream gate — A1 completion

Per issue #113 §2 and [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1, A2 may only kick off after A1 has reached verdict `READY` or `READY WITH ACCEPTED RISKS`.

| Item | Source | Status |
|------|--------|--------|
| A1 audit firm engaged | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) §1 | ⏳ Pending |
| A1 audited commit frozen | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) §2 | ⏳ Pending |
| A1 critical findings remediated | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) §5 | ⏳ Pending |
| A1 re-verification letter received | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) §7 | ⏳ Pending |
| A1 verdict = READY (or READY WITH ACCEPTED RISKS) | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md) header | ⏳ Pending |

This section is updated when each A1 milestone lands.

---

## 3. Audited commit

| Field | Value |
|-------|-------|
| Audited commit hash | TBD at kickoff |
| Audited tag | TBD |
| Tact version | TBD |
| FunC version | TBD (no FunC in scope, but the build environment is recorded for completeness) |
| Blueprint version | TBD |
| Freeze metadata | [`audit/FREEZE_METADATA.md`](../../../../audit/FREEZE_METADATA.md) |

The audited commit is frozen at kickoff and cannot be modified retroactively. Any change to in-scope contracts after that point invalidates the engagement.

The audited commit **should be at or after** the A1 remediation tag (`audit-A1-remediation-vN`) so that the auditor reviews Phase 4 contracts against an A1-cleared baseline.

---

## 4. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 0. A1 completion (upstream gate) | A1 engagement | T-A1 | ⏳ Pending — see §2 |
| 1. Prepare A2 engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Long-list candidate firms | `@konard` | T+1w | ⏳ Pending |
| 3. RFP & shortlist (≤3 firms) | `@konard` | T+1w | ⏳ Pending |
| 4. Proposal evaluation (with bridge-depth weighting) | `@konard` | T+3w | ⏳ Pending |
| 5. Contract signed & kickoff | `@konard` | T+4w | ⏳ Pending |
| 6. Audit execution (with dedicated bridge review) | Auditor | T+11w | ⏳ Pending |
| 7. Draft report received | Auditor | T+11w | ⏳ Pending |
| 8. Remediation PRs | `@konard` | T+15w | ⏳ Pending |
| 9. Re-verification | Auditor | T+16w | ⏳ Pending |
| 10. Final report published | `@konard` | T+16w | ⏳ Pending |
| 11. Disclosure (CHANGELOG, public channels) | `@konard` | T+17w | ⏳ Pending |

`T` is the A2 engagement kickoff date and will be filled in once the contract is signed. `T-A1` is the A1 completion date and is outside A2's control.

---

## 5. Firm long list

The following firms are candidates. The list intentionally overlaps with A1 §4 because most candidate firms are capable of both engagements; however, the scoring will favour bridge / multi-sig depth per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1.

Scores will be populated once RFPs return.

| Firm | TON depth | **Bridge / multi-sig depth** | Methodology | References | Re-audit policy | Cost / timeline | Communication | Weighted score | Decision |
|------|-----------|------------------------------|-------------|------------|------------------|------------------|----------------|-----------------|----------|
| Trail of Bits | — | — | — | — | — | — | — | — | Pending RFP |
| OtterSec | — | — | — | — | — | — | — | — | Pending RFP |
| Halborn | — | — | — | — | — | — | — | — | Pending RFP |
| CertiK (TON desk) | — | — | — | — | — | — | — | — | Pending RFP |
| Quantstamp | — | — | — | — | — | — | — | — | Pending RFP |
| Veridise | — | — | — | — | — | — | — | — | Pending RFP |
| Scalebit | — | — | — | — | — | — | — | — | Pending RFP |
| TonGuard | — | — | — | — | — | — | — | — | Pending RFP |
| Spearbit (cross-chain panel) | — | — | — | — | — | — | — | — | Pending RFP |
| Zellic (bridge experience) | — | — | — | — | — | — | — | — | Pending RFP |

Weights and scoring rubric are defined in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1.

### 5.1 Conflict-of-interest disclosures

| Firm | Discloses TBC / NFT holdings? | Prior engagement? | ChangeNOW / bridge-relayer financial interest? | Other COI | Status |
|------|-------------------------------|---------------------|------------------------------------------------|-----------|--------|
| — | — | — | — | — | Pending RFP |

If the same firm performed A1, an additional disclosure line must record whether A2 findings were re-derived independently or reused from the A1 review (per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.2).

---

## 6. Findings ledger

Populated after the auditor's draft report is received. Severity values follow [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §2. The "Threat ref" column links each finding back to the threat IDs in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4 (CCB-, MSC-, RP-, LPC-, X-).

| Finding ID | Severity | Title | Contract | Threat ref | GitHub issue | PR | Status | Notes |
|------------|----------|-------|----------|------------|--------------|----|--------|-------|
| _no findings yet — audit not started_ | — | — | — | — | — | — | — | — |

---

## 7. Accepted risks

Populated only when High / Medium findings are not remediated. Each row requires maintainer sign-off plus one independent reviewer for High severity.

| Finding ID | Severity | Rationale | Compensating control | Sign-off | Date |
|------------|----------|-----------|----------------------|----------|------|
| _none_ | — | — | — | — | — |

Any entry here must be mirrored in [`docs/audit-notes.md`](../../../audit-notes.md) per workflow §3.4.

---

## 8. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| A1 final report (reference) | _pending A1 completion_ | — | Required input per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5 |
| A1 re-verification letter (reference) | _pending A1 completion_ | — | Required input per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5 |
| Draft report | _pending_ | — | Save as `report-v0-draft.pdf` |
| Final report | _pending_ | — | Save as `report-v1-final.pdf` |
| Re-verification letter | _pending_ | — | Save as `reverification-v1.pdf` |
| Bridge review supplement | _pending_ | — | If the firm delivers a separate cross-chain bridge memo, save as `bridge-review-v1.pdf` |

The SHA-256 column is filled in immediately after intake per workflow §3.1.

---

## 9. Acceptance criteria progress

Mirrors issue #113 §7.

- [ ] A1 audit completed and core contracts cleared before this audit begins
- [ ] Separate audit engagement from core contract audit (not bundled with A1)
- [ ] Cross-chain bridge receives dedicated review with replay and validator scenarios
- [ ] Audit firm engaged and audit scope agreed upon
- [ ] Audit package prepared: contracts + documentation + `docs/security/AUDIT_READINESS.md` (preparation **done**; hand-off pending firm selection and A1 completion)
- [ ] All Critical findings remediated
- [ ] All High findings remediated or formally accepted
- [ ] All Medium findings addressed
- [ ] Audit report published in `docs/security/audits/A2-phase4-contracts/`
- [ ] Remediation PR merged and re-verified by auditor
- [ ] `docs/security/AUDIT_READINESS.md` updated with audit completion status

---

## 10. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | A1 completion timeline (hard gate per §2) | `@konard` | Open |
| Q-2 | Whether the A1 firm is the right fit for A2, or whether a bridge-specialist firm should be engaged separately | `@konard` | Open |
| Q-3 | Final selection of audit firm (after A1 outcome is known) | `@konard` | Open |
| Q-4 | Budget envelope and funding source for A2 (typically higher than A1 due to bridge focus) | `@konard` | Open |
| Q-5 | Calendar window for audit (T+4w → T+16w) | `@konard` | Open |
| Q-6 | Whether `MultiSigCard.tact` will be removed (per internal pre-audit C-MSC-H1) before A2 kickoff, narrowing the scope to three contracts | `@konard` | Open |
| Q-7 | Whether `LendingProtocolCoordinator` dead-code `RegisterNFTOwnerLending` (C-LPC-H1) is cleaned up before the freeze | `@konard` | Closed by #432: removed from production and retained only in a non-deployable harness |
| Q-8 | Whether bridge validator infrastructure (ChangeNOW or other relayers) must be selected before kickoff so that trust assumptions are explicit | `@konard` | Open |

Add new rows as blockers are discovered. Close rows by linking the resolving issue / commit.

---

## 11. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this file) | `@konard` |
