# Engagement A5 — Status

**Engagement ID:** `A5`
**Issue:** [#116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Program brief:** [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md)
**Severity rubric:** [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md)
**Dry-run:** [`DRY_RUN.md`](./DRY_RUN.md)
**Quarterly report template:** [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md)
**Workflow:** [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md)
**Phase:** Engagement preparation — awaiting A1 + A2 completion and platform selection
**Gating verdict:** ⏳ Pending — A1 and A2 must reach `READY`
**Public submissions:** ❌ Closed until launch
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (program owner) | `@konard` | GitHub issues + platform admin account |
| Triage owner (Critical / High) | `@konard` | Platform messaging + private email TBD |
| Triage backup (Medium / Low) | TBD | Platform messaging |
| Reward decision authority | `@konard` | Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5 — discretionary uplift requires maintainer sign-off |
| Platform account holder | TBD (entity) | TBD |
| KYC / sanctions liaison | TBD | TBD (per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §3 row 5) |
| Disclosure coordinator | `@konard` | Public channels per [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §3.6 |

Add additional rows as required when the platform contract is signed.

---

## 2. Upstream gates

Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §3 — A5 does not open until all hard gates are green.

| # | Gate | Source | Status |
|---|------|--------|--------|
| 1 | A1 engagement verdict = `READY` (or `READY WITH ACCEPTED RISKS`) | [A1 STATUS](../A1-core-contracts/STATUS.md) | ⏳ Pending — A1 in engagement preparation |
| 2 | A2 engagement verdict = `READY` (or `READY WITH ACCEPTED RISKS`) | [A2 STATUS](../A2-phase4-contracts/STATUS.md) | ⏳ Pending — A2 in engagement preparation, gated by A1 |
| 3 | A1 + A2 remediation merged into `main` | Audit remediation PRs | ⏳ Pending — A1/A2 not started |
| 4 | Funding envelope confirmed (≥ 12 months bounties) | §4 below | ⏳ Pending |
| 5 | KYC / sanctions procedure documented | §11 below | ⏳ Pending |
| 6 | `SECURITY.md` link to bug bounty page prepared | [`../../../../SECURITY.md`](../../../../SECURITY.md) | 🟡 Forward-link added pre-launch; live URL TBD at launch |
| 7 | Quarterly transparency report template adopted | [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) | ✅ Template committed (this engagement) |
| 8 | Dry-run submission executed | [`DRY_RUN.md`](./DRY_RUN.md) | ⏳ Pending — plan committed, execution scheduled at T+5w |

Soft gate (documented, non-blocking):

| Item | Source | Status |
|------|--------|--------|
| A4 off-chain pentest verdict | [A4 STATUS](../A4-offchain-services/STATUS.md) | ⏳ Pending — gated by D4; absence at launch recorded as known limitation, see §11 |

---

## 3. Launch checklist

Mirror of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §9. All items must be checked to flip the program to public submissions.

- [ ] §2 row 1 — A1 `READY`
- [ ] §2 row 2 — A2 `READY`
- [ ] §2 row 3 — A1+A2 remediation merged
- [ ] §2 row 4 — Funding envelope confirmed
- [ ] §2 row 5 — KYC / sanctions procedure documented
- [ ] §2 row 6 — `SECURITY.md` link live
- [ ] §2 row 7 — Quarterly transparency template adopted
- [ ] §2 row 8 — Dry-run end-to-end completed without SLA breach
- [ ] Platform brief matches [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) verbatim (modulo platform markup)
- [ ] Disclosure entry prepared for `CHANGELOG.md`
- [ ] Quarterly report cadence committed in calendar (Q1 report scheduled at T+18w)

---

## 4. Platform selection

| Field | Value |
|-------|-------|
| Decision | TBD — default recommendation: **Immunefi** per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6 |
| Selected platform | TBD |
| Account holder (legal entity) | TBD |
| Account verified date | TBD |
| Platform program page URL | TBD — populated at launch and propagated to [`../../../../SECURITY.md`](../../../../SECURITY.md) and quarterly reports |
| Bounty pool size (USDC equivalent) | TBD — must cover ≥ 12 months at projected payout rate |
| Bounty pool custody | TBD (escrow vs. on-demand) |
| KYC threshold (per platform) | TBD — captured in due-diligence answers §4.1 |
| Sanctions screening list set | TBD |
| Disclosure default (public vs. private) | TBD |
| Platform read-only API for reports | TBD — required for quarterly transparency automation |

### 4.1 Platform due-diligence answers

For each candidate platform, fill in answers to the questionnaire in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1. Answers must be received in writing.

| Question | Immunefi answer | HackenProof answer |
|----------|------------------|----------------------|
| 1. KYC threshold and scope | _pending_ | _pending_ |
| 2. Sanctions list set + false-positive process | _pending_ | _pending_ |
| 3. Escrow vs. on-demand reward pool | _pending_ | _pending_ |
| 4. Default disclosure posture | _pending_ | _pending_ |
| 5. Triager COI policy (TBC holdings, NFT holdings) | _pending_ | _pending_ |
| 6. Read-only API for transparency reports | _pending_ | _pending_ |
| 7. Off-boarding policy (paused / migrated programs) | _pending_ | _pending_ |
| 8. TON-specialist triagers (Tact / FunC) | _pending_ | _pending_ |

### 4.2 Conflict-of-interest disclosures

| Subject | Discloses TBC / NFT holdings? | Prior engagement? | Vendor financial interest? | Other COI | Status |
|---------|--------------------------------|---------------------|------------------------------|-----------|--------|
| Platform (Immunefi) — assigned triagers | — | — | — | — | Pending |
| Platform (HackenProof) — assigned triagers | — | — | — | — | Pending |
| Maintainer | `@konard` discloses per protocol policy | — | — | — | Standing |

---

## 5. Scope versioning

Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §2 the scope is split into three severity bands tied to specific repository paths. Every scope change is published on the platform **and** in this table — the two must never diverge.

| Scope version | Effective date | Highest-severity items | Medium items | Low items | Notes |
|---------------|-----------------|-------------------------|---------------|-------------|-------|
| v0 (pre-launch) | — | Pending: PaymentHub, MerchantPaymentHub, account-locks, nft-resolver, PublicCollateralLookup, CollateralSignal · Deferred (post-A2): CrossChainBridge, MultiSigCard | `api/`, `backend/indexer/`, `sdk/` | `wallet-ui/`, `dashboard/` | Mirrors [`ENGAGEMENT.md`](./ENGAGEMENT.md) §2 |
| v1 (launch) | TBD | — | — | — | Populated at launch; commit hash recorded |

Each scope change is mirrored in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3 and noted in §13 Change log.

---

## 6. Findings ledger

Populated as platform submissions are triaged. Severity values follow [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md). Per-finding files live under `findings/<finding-id>.md` (created on intake — directory not pre-created).

| Finding ID | Platform link | Severity | Title | Component | Threat ref | GitHub issue | PR | Status | Payout (USDC) | Notes |
|------------|----------------|----------|-------|------------|------------|---------------|----|--------|----------------|-------|
| _no findings yet — program not launched_ | — | — | — | — | — | — | — | — | — | — |

Status values per [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §4.1: `triage`, `in-progress`, `merged`, `re-verified`, `accepted`, `wont-fix-with-rationale`, plus A5-specific `duplicate` (per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4.5) and `out-of-scope`.

### 6.1 Submission counters (auto-updated quarterly)

| Quarter | Submissions received | Out-of-scope / duplicate | Confirmed valid | Critical / High | Medium / Low | Total payouts (USDC) | Report |
|---------|----------------------|--------------------------|------------------|------------------|---------------|-----------------------|--------|
| Pre-launch | 0 | 0 | 0 | 0 | 0 | 0 | — |
| YYYY-Qn | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | `reports/YYYY-Qn.md` |

The counters feed [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) §3 and the public-facing transparency report.

---

## 7. SLA tracker

Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4.2.

| Finding ID | Severity | Submitted (UTC) | Acknowledged (target ≤3 bd) | Classified (target ≤7 bd) | Fix deployed | Payment issued (target ≤30 d) | Days over | Notes |
|------------|----------|------------------|------------------------------|----------------------------|---------------|----------------------------------|------------|-------|
| _no submissions yet_ | — | — | — | — | — | — | — | — |

`bd` = business days (Mon–Fri UTC, excluding listed public holidays in the maintainer's jurisdiction, captured in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.3).

SLA breaches must be reported in the next quarterly transparency report and reviewed in §10 below.

---

## 8. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 0. A1 verdict = READY (upstream gate) | A1 engagement | T-A1 | ⏳ Pending |
| 0. A2 verdict = READY (upstream gate) | A2 engagement | T-A2 | ⏳ Pending |
| 1. Prepare A5 engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Platform shortlist + due-diligence questionnaire | `@konard` | T+1w | ⏳ Pending |
| 3. Platform proposals evaluated | `@konard` | T+1w | ⏳ Pending |
| 4. Platform selected + account creation + KYC | `@konard` | T+2w | ⏳ Pending |
| 5. Program brief drafted on platform staging | `@konard` | T+3w | ⏳ Pending |
| 6. Internal review of staging brief vs. `PROGRAM_BRIEF.md` | `@konard` | T+4w | ⏳ Pending |
| 7. `SECURITY.md` updated with platform program-page link (held until launch) | `@konard` | T+4w | ⏳ Pending |
| 8. Dry-run submission executed | `@konard` | T+5w | ⏳ Pending |
| 9. Public launch + `CHANGELOG.md` disclosure | `@konard` | T+6w | ⏳ Pending |
| 10. Q1 transparency report | `@konard` | T+18w | ⏳ Pending |
| 11. Q2 transparency report | `@konard` | T+30w | ⏳ Pending |

`T` is the A5 kickoff date (after A1 + A2 reach `READY`). `T-A1` / `T-A2` are upstream and outside A5's control.

---

## 9. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| Program brief (canonical) | [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) | — | Mirrors platform brief |
| Severity rubric | [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) | — | Per-tier definitions |
| Dry-run plan | [`DRY_RUN.md`](./DRY_RUN.md) | — | Acceptance criterion #6 |
| Quarterly report template | [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) | — | Acceptance criterion #5 |
| Platform brief snapshot (PDF) | _pending launch_ | — | Save as `platform-brief-v0.pdf` once published |
| Funding-envelope statement | _pending_ | — | Save as `funding-envelope-v0.md` |
| KYC / sanctions procedure | _pending_ | — | Save as `kyc-sanctions-v0.md` |
| Dry-run evidence | _pending_ | — | Save as `dry-run-v0.md` |
| Q1 transparency report | _pending_ | — | Save as `reports/2026-Q3.md` (or applicable quarter) |
| Findings (one per submission) | _pending_ | — | Save as `findings/<finding-id>.md` |

The SHA-256 column is filled in immediately after intake per [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §3.1.

---

## 10. Discretionary reward sign-offs

The "$10,000+" Critical-tier uplift requires maintainer sign-off recorded here per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5. SLA breach reviews are also captured in this section.

| Date | Finding ID | Action | Amount above base (USDC) | Rationale | Sign-off |
|------|------------|--------|---------------------------|-----------|----------|
| _none yet_ | — | — | — | — | — |

---

## 11. KYC, sanctions, and payout compliance

| Field | Value |
|-------|-------|
| Custody of bounty pool | TBD (escrow with platform vs. on-demand) |
| Currency | USDC (default per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5); alternates allowed per researcher request subject to sanctions clearance |
| KYC threshold | TBD — must be ≤ Critical-tier base for the program to be credible |
| Sanctions screening | TBD — list set, false-positive workflow |
| Tax handling | TBD — 1099 / W-8BEN / equivalent for jurisdiction |
| Sanctioned-jurisdiction policy | Submissions accepted; payouts blocked if researcher is in a sanctioned jurisdiction; finding remains credited in the transparency report |
| Private-key submission policy | Reject and rewrite-history per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §6 |

### 11.1 Known limitations at launch

| Limitation | Severity | Description |
|------------|----------|-------------|
| A4 off-chain pentest not yet complete | Medium | Off-chain (`api/`, `backend/indexer/`, `sdk/`) scope opens before independent pentest if A4 has not landed; documented in program brief and re-evaluated each quarter |
| Phase 4 contracts gated by A2 | Medium | `CrossChainBridge` and `MultiSigCard` shown as `Pending A2` until A2 verdict = `READY` |

---

## 12. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | Funding envelope size for 12-month bounty pool (USDC) | `@konard` | Open |
| Q-2 | Legal entity that holds the platform account (impacts KYC / tax) | `@konard` | Open |
| Q-3 | Final platform choice (Immunefi vs. HackenProof) | `@konard` | Open |
| Q-4 | Whether to open off-chain scope at launch or hold until A4 completes | `@konard` | Open |
| Q-5 | Discretionary-uplift authority for Critical >$10,000 — single maintainer or multi-sig of contributors | `@konard` | Open |
| Q-6 | Currency support for payouts (USDC only, USDC + TON, USDC + USDT) | `@konard` | Open |
| Q-7 | Whether dashboards and wallet-ui ship the production build before A5 launch (affects realism of low-tier reports) | `@konard` | Open |
| Q-8 | Cadence and authoring owner for quarterly transparency reports if `@konard` is unavailable | `@konard` | Open |
| Q-9 | Whether internal contributors (employees, named contributors) are eligible to submit reports | `@konard` | Open — default proposal: **ineligible**, mirrored in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §6 |
| Q-10 | Whether the program lists "duplicate of an A1/A2/A3/A4 finding" as a separate published statistic or rolls it into "out of scope" | `@konard` | Open |

Add new rows as blockers are discovered. Close rows by linking the resolving issue / commit / PR.

---

## 13. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial A5 engagement preparation committed (`ENGAGEMENT.md`, `STATUS.md`, `PROGRAM_BRIEF.md`, `SEVERITY_RUBRIC.md`, `DRY_RUN.md`, `QUARTERLY_REPORT_TEMPLATE.md`); indices updated (`../README.md`, `../../AUDIT_READINESS.md`); forward-link added to `../../../../SECURITY.md` | `@konard` |
