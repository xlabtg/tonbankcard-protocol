# Engagement A1 — Status

**Engagement ID:** `A1`
**Issue:** [#112](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Workflow:** [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md)
**Phase:** Engagement preparation
**Gating verdict:** ⏳ Pending — firm not yet selected
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

Add additional rows as required when the contract is signed.

---

## 2. Audited commit

| Field | Value |
|-------|-------|
| Audited commit hash | TBD at kickoff |
| Audited tag | TBD |
| Tact version | TBD |
| FunC version | TBD |
| Blueprint version | TBD |
| Freeze metadata | [`audit/FREEZE_METADATA.md`](../../../../audit/FREEZE_METADATA.md) |

The audited commit is frozen at kickoff and cannot be modified retroactively. Any change to in-scope contracts after that point invalidates the engagement.

---

## 3. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 1. Prepare engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Long-list candidate firms | `@konard` | T+1w | ⏳ In progress (see §6) |
| 3. RFP & shortlist (≤3 firms) | `@konard` | T+1w | ⏳ Pending |
| 4. Proposal evaluation | `@konard` | T+3w | ⏳ Pending |
| 5. Contract signed & kickoff | `@konard` | T+4w | ⏳ Pending |
| 6. Audit execution | Auditor | T+10w | ⏳ Pending |
| 7. Draft report received | Auditor | T+10w | ⏳ Pending |
| 8. Remediation PRs | `@konard` | T+13w | ⏳ Pending |
| 9. Re-verification | Auditor | T+14w | ⏳ Pending |
| 10. Final report published | `@konard` | T+14w | ⏳ Pending |
| 11. Disclosure (CHANGELOG, public channels) | `@konard` | T+15w | ⏳ Pending |

`T` is the engagement kickoff date and will be filled in once the contract is signed.

---

## 4. Firm long list

The following firms are candidates. Scores will be populated once RFPs return.

| Firm | TON depth | Methodology | References | Re-audit policy | Cost / timeline | Communication | Weighted score | Decision |
|------|-----------|-------------|------------|------------------|------------------|----------------|-----------------|----------|
| Trail of Bits | — | — | — | — | — | — | — | Pending RFP |
| OtterSec | — | — | — | — | — | — | — | Pending RFP |
| Halborn | — | — | — | — | — | — | — | Pending RFP |
| CertiK (TON desk) | — | — | — | — | — | — | — | Pending RFP |
| Quantstamp | — | — | — | — | — | — | — | Pending RFP |
| Veridise | — | — | — | — | — | — | — | Pending RFP |
| Scalebit | — | — | — | — | — | — | — | Pending RFP |
| TonGuard | — | — | — | — | — | — | — | Pending RFP |

Weights and scoring rubric are defined in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1.

### 4.1 Conflict-of-interest disclosures

| Firm | Discloses TBC / NFT holdings? | Prior engagement? | Other COI | Status |
|------|-------------------------------|---------------------|-----------|--------|
| — | — | — | — | Pending RFP |

---

## 5. Findings ledger

Populated after the auditor's draft report is received. Severity values follow [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §2.

| Finding ID | Severity | Title | GitHub issue | PR | Status | Notes |
|------------|----------|-------|--------------|----|--------|-------|
| _no findings yet — audit not started_ | — | — | — | — | — | — |

---

## 6. Accepted risks

Populated only when High / Medium findings are not remediated. Each row requires maintainer sign-off plus one independent reviewer for High severity.

| Finding ID | Severity | Rationale | Compensating control | Sign-off | Date |
|------------|----------|-----------|----------------------|----------|------|
| _none_ | — | — | — | — | — |

Any entry here must be mirrored in [`docs/audit-notes.md`](../../../audit-notes.md) per workflow §3.4.

---

## 7. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| Draft report | _pending_ | — | Save as `report-v0-draft.pdf` |
| Final report | _pending_ | — | Save as `report-v1-final.pdf` |
| Re-verification letter | _pending_ | — | Save as `reverification-v1.pdf` |

The SHA-256 column is filled in immediately after intake per workflow §3.1.

---

## 8. Acceptance criteria progress

Mirrors issue #112 §7.

- [ ] Audit firm engaged and audit scope agreed upon
- [ ] Audit package prepared: contracts + documentation + `docs/security/AUDIT_READINESS.md` (preparation **done**; hand-off pending firm selection)
- [ ] All Critical findings remediated
- [ ] All High findings remediated or formally accepted
- [ ] All Medium findings addressed
- [ ] Audit report published in `docs/security/audits/A1-core-contracts/`
- [ ] Remediation PR merged and re-verified by auditor
- [ ] `docs/security/AUDIT_READINESS.md` updated with audit completion status

---

## 9. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | Final selection of audit firm | `@konard` | Open |
| Q-2 | Budget envelope and funding source | `@konard` | Open |
| Q-3 | Calendar window for audit (T+4w → T+14w) | `@konard` | Open |
| Q-4 | Whether multi-sig migration (HIGH risk in `AUDIT_READINESS.md`) lands before kickoff or is documented as known limitation | `@konard` | Open |

Add new rows as blockers are discovered. Close rows by linking the resolving issue / commit.

---

## 10. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this file) | `@konard` |
