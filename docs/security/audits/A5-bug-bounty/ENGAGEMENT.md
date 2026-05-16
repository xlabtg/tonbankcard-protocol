# Engagement A5 — Public Bug Bounty Program

**Engagement ID:** `A5`
**Issue:** [#116 — A5 Bug Bounty Program](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Roadmap track:** A — Security & Audit
**Status:** Engagement preparation complete — awaiting A1 + A2 completion and platform selection
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Objective

Launch a **public bug bounty program** on a recognised vulnerability-disclosure platform (Immunefi preferred, HackenProof as the qualified alternative) so the external research community can responsibly disclose previously-unknown vulnerabilities against a frozen public scope and a published reward schedule.

A5 extends — it does **not** replace — the existing responsible disclosure framework in [`../../../../SECURITY.md`](../../../../SECURITY.md). The differences are:

| Property | `SECURITY.md` (existing) | A5 bug bounty (this engagement) |
|----------|--------------------------|----------------------------------|
| Scope formality | Component list | Frozen per-tier scope (see §2), tied to commit |
| Submission channel | GitHub private advisory + email | Platform-mediated submission (no email) |
| Reward | Coordinated disclosure credit only | USD bounties per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §4 |
| Triage SLA | 72h ack / 7d severity | 3 business days ack / 7 business days severity ([§4](#4-program-rules--slas)) |
| Public transparency | Per-incident disclosure | Quarterly aggregated stats ([`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md)) |
| Researcher safe harbour | Yes (`SECURITY.md` §6) | Reinforced and platform-enforced ([`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §7) |
| Mainnet exploitation | Implicitly disallowed | Explicitly prohibited as eligibility condition ([§4.3](#43-rules-of-engagement)) |

Per issue #116 §2, the program **must launch only after A1 (core contracts) and A2 (Phase 4 contracts) are complete and known issues are remediated**. Otherwise the program will pay researchers for findings the team is already aware of from those audits.

Success criteria (mirror of issue #116 §8 acceptance criteria):

- [ ] A1 and A2 audits completed and remediation merged (prerequisite — see [§3](#3-upstream-gates))
- [ ] Bug bounty platform account created and verified ([`STATUS.md`](./STATUS.md) §4)
- [ ] Program brief published on platform with full scope and reward tiers ([`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md))
- [ ] [`../../../../SECURITY.md`](../../../../SECURITY.md) updated with link to bug bounty program page
- [ ] First quarterly transparency report published, including bounty program statistics ([`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md))
- [ ] At least one dry-run internal submission tested end-to-end through the platform ([`DRY_RUN.md`](./DRY_RUN.md))

---

## 2. In-Scope Components (Bounty Surface)

The scope is partitioned into three severity bands per issue #116 §3. The same scope is published verbatim in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3 so the platform copy and the internal copy never diverge.

### 2.1 Highest Severity — Smart Contracts (on-chain)

Vulnerabilities here can directly violate non-custodial invariants ([`I1`–`I7`](../../../../audit/INVARIANTS.md)) and/or move user funds without authorisation. Pays the **smart-contract** column of the reward table ([§5](#5-reward-tiers)).

| # | Contract | File | Activation gate |
|---|----------|------|------------------|
| 1 | PaymentHub | [`contracts/payments/PaymentHub.tact`](../../../../contracts/payments/PaymentHub.tact) | At A5 launch (post-A1) |
| 2 | MerchantPaymentHub | [`contracts/MerchantPaymentHub.tact`](../../../../contracts/MerchantPaymentHub.tact) | At A5 launch (post-A1) |
| 3 | Account Locks | [`contracts/payments/account-locks.fc`](../../../../contracts/payments/account-locks.fc) | At A5 launch (post-A1) |
| 4 | NFT Account Resolver | [`contracts/nft-resolver/`](../../../../contracts/nft-resolver/) | At A5 launch (post-A1) |
| 5 | Public Collateral Lookup | [`contracts/collateral-lookup/PublicCollateralLookup.tact`](../../../../contracts/collateral-lookup/PublicCollateralLookup.tact) | At A5 launch (post-A1) |
| 6 | Collateral Signal | [`contracts/CollateralSignal.tact`](../../../../contracts/CollateralSignal.tact) | At A5 launch (post-A1) |
| 7 | CrossChainBridge | [`contracts/CrossChainBridge.tact`](../../../../contracts/CrossChainBridge.tact) | After A2 audit (per issue #116 §3) |
| 8 | MultiSigCard | [`contracts/MultiSigCard.tact`](../../../../contracts/MultiSigCard.tact) | After A2 audit (per issue #116 §3) |

Phase 4 contracts (`CrossChainBridge`, `MultiSigCard`) ship into scope **only after A2 sign-off**; until then they are flagged as `Pending A2` in the program brief and reports against them are deferred or rerouted to the A2 engagement intake.

### 2.2 Medium Severity — Off-Chain Services

Pays the **off-chain** column of the reward table.

| # | Component | Location | Notes |
|---|-----------|----------|-------|
| 1 | Merchant API | [`api/`](../../../../api/) | `@tonbankcard/merchant-api` — REST endpoints, auth, webhooks |
| 2 | Payment Status Indexer | [`backend/indexer/`](../../../../backend/indexer/) | `@tonbankcard/payment-indexer` — blockchain ingestion + read API |
| 3 | Merchant SDK | [`sdk/`](../../../../sdk/) | `@tonbankcard/merchant-sdk` — npm package + browser widget |

Off-chain components are also under engagement [A4](../A4-offchain-services/ENGAGEMENT.md). A5 covers **previously-unknown** findings against the same surface after A4 remediation merges. Findings that duplicate A4 issues already on file (per [`../A4-offchain-services/STATUS.md`](../A4-offchain-services/STATUS.md) §6 Findings ledger) are out-of-band per [§4.5](#45-duplicate-handling).

### 2.3 Lower Severity — Frontend

Pays a flat low-tier reward (see [§5](#5-reward-tiers)).

| # | Component | Location | Notes |
|---|-----------|----------|-------|
| 1 | Wallet UI | [`wallet-ui/`](../../../../wallet-ui/) | `@tonbankcard/wallet-ui` |
| 2 | Merchant Dashboard | [`dashboard/`](../../../../dashboard/) | `@tonbankcard/merchant-dashboard` |

---

## 3. Upstream Gates

The program does not open submissions until **all** of the following are true. The state of each gate is mirrored in [`STATUS.md`](./STATUS.md) §2.

| # | Gate | Source | Why |
|---|------|--------|-----|
| 1 | A1 engagement verdict = `READY` (or `READY WITH ACCEPTED RISKS`) | [A1 STATUS](../A1-core-contracts/STATUS.md) | Prevents paying researchers for findings already in A1 |
| 2 | A2 engagement verdict = `READY` (or `READY WITH ACCEPTED RISKS`) | [A2 STATUS](../A2-phase4-contracts/STATUS.md) | Prevents paying researchers for findings already in A2; required for Phase 4 contracts ([§2.1](#21-highest-severity--smart-contracts-on-chain) rows 7–8) |
| 3 | A1/A2 remediation merged into `main` | Audit remediation PRs | Researchers attack the post-remediation surface, not the audited-but-unfixed surface |
| 4 | Funding envelope confirmed for at least 12 months of bounties | [`STATUS.md`](./STATUS.md) §4 | Critical-tier payouts ($10,000+) must be funded before publication, per Immunefi onboarding requirement |
| 5 | KYC / sanctions screening procedure documented for payouts | [`STATUS.md`](./STATUS.md) §11 | Both Immunefi and HackenProof require the project to confirm payout compliance |
| 6 | `SECURITY.md` link to platform program page prepared | [`../../../../SECURITY.md`](../../../../SECURITY.md) | Acceptance criterion #4 |
| 7 | Quarterly transparency report template adopted | [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md) | Acceptance criterion #5 |
| 8 | Dry-run submission executed | [`DRY_RUN.md`](./DRY_RUN.md) | Acceptance criterion #6 |

A4 (off-chain pentest) is a **soft** gate, not a hard one: the off-chain section of A5 (§2.2) can be activated independently of A4 because [A4](../A4-offchain-services/ENGAGEMENT.md) itself is gated on D4 hardening. If A4 has not completed by A5 launch, this is recorded as a known limitation in [`STATUS.md`](./STATUS.md) §11 and reflected in the program brief.

---

## 4. Program Rules & SLAs

The platform-published version of these rules lives in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md). The numbers below are the contractual ceiling — the brief may be stricter (e.g. shorter triage time) but never looser.

### 4.1 Submission

- All submissions are handled **on the platform**. Issue #116 §6 explicitly disallows email submissions for the bounty program; existing `security@tonbankcard.com` and GitHub Security Advisory remain available for non-bounty disclosures under [`../../../../SECURITY.md`](../../../../SECURITY.md).
- Reports must include: vulnerability description, impact, reproduction steps, suggested severity, and a **proof-of-concept** (per issue #116 §4 — theoretical vulnerabilities without PoC are out of scope).
- Submissions must **not** include private keys, mnemonic seeds, or wallet credentials. Any submission that does is rejected and the platform is informed per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §6.

### 4.2 Response SLAs

Per issue #116 §5.4:

| Milestone | Target | Hard ceiling |
|-----------|--------|--------------|
| Initial acknowledgement / triage | **3 business days** | 5 business days |
| Severity classification | **7 business days** | 10 business days |
| Fix deployment for Critical / High | 30 days (Critical) / 60 days (High) | 90 days (mandatory disclosure window per issue #116 §5.3) |
| Bounty payment | Within **30 days** of fix deployment | 45 days |
| Researcher communication frequency | Every 14 days while finding is open | 21 days |

SLA breaches are logged in [`STATUS.md`](./STATUS.md) §10 and surfaced in the quarterly transparency report.

### 4.3 Rules of Engagement

Per issue #116 §5.3 and §7:

- **No mainnet exploitation.** All proof-of-concept work must run on TON testnet or a project-provided staging environment. Mainnet exploitation disqualifies the report **and** the researcher from future participation.
- **No social engineering** against TONBANKCARD team members, contributors, or merchant operators.
- **No physical attacks** against people or infrastructure.
- **No denial-of-service via flooding** (per issue #116 §4) — accepted only if it directly causes fund loss or non-custodial-invariant violation, and only via controlled PoC.
- **No data exfiltration** beyond what is required to demonstrate the vulnerability.
- **No public disclosure** before the 90-day fix window expires or the team authorises early disclosure.

### 4.4 Coordinated Disclosure Timeline

- **Critical / High:** 90-day fix window from severity classification before researcher may disclose. Extension up to 180 days available on written agreement.
- **Medium / Low:** 90-day window applies but extension is automatic if remediation is in flight.
- **Already-exploited or wormable vulnerabilities** trigger an emergency disclosure path per [`../../INCIDENT_RESPONSE.md`](../../INCIDENT_RESPONSE.md); the 90-day default does not apply.

### 4.5 Duplicate Handling

A finding is a **duplicate** and ineligible for reward when any of the following are true:

1. The same root cause is recorded in any of:
   - [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) (internal pre-audit)
   - [`docs/audit-notes.md`](../../../audit-notes.md) (known accepted risks)
   - Any open or closed finding row in `STATUS.md` of engagements A1, A2, A3, A4
   - An open GitHub issue labelled `type:security` filed before submission
2. The platform records an earlier submission with the same root cause within the same submission window.

When two submissions land within a 24-hour window for the same vulnerability, the **earlier** submission (platform timestamp) takes the bounty; the later submission receives credit in the quarterly report but no payout.

### 4.6 Out-of-Scope (Bounty)

Per issue #116 §4 — submissions matching these patterns are closed as **out of scope** without payout:

- Theoretical vulnerabilities without a proof-of-concept
- Issues in third-party dependencies (ChangeNOW, NOWPayments, CoinRabbit, TONCO, TON public HTTP API) — report to those vendors
- Social engineering against team members or merchants
- Physical security against people or infrastructure
- Volumetric denial-of-service that does **not** cause fund loss or invariant violation
- Already-fixed / already-known issues per [§4.5](#45-duplicate-handling)
- Reports requiring root access to systems the researcher does not own
- Self-XSS or attacks requiring full control of the victim's browser
- Missing security headers without demonstrated impact
- Vulnerabilities affecting only outdated browsers / wallets that are not in the documented support matrix

The full out-of-scope list is duplicated verbatim in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3.4 so the platform copy is the canonical published version.

---

## 5. Reward Tiers

Per issue #116 §5.2. The dollar values below are the **public commitment** — the team can increase a tier but cannot decrease it without a 30-day notice on the platform and in [`STATUS.md`](./STATUS.md) §13 change log.

| Severity | Smart Contract (on-chain) | Off-Chain Service | Frontend |
|----------|---------------------------|-------------------|----------|
| 🔴 **Critical** | **$10,000+** | $5,000 | Treated as off-chain per impact |
| 🟠 **High** | $5,000 | $2,500 | Treated as off-chain per impact |
| 🟡 **Medium** | $1,000 | $500 | $500 |
| 🟢 **Low** | $100 | $100 | $100 |

The "$10,000+" Critical tier is open-ended: extraordinary findings (e.g. catastrophic fund loss, full break of `I1` Non-Custodial or `I3` No Admin Fund Control) are scored on the Immunefi/HackenProof economic-impact rubric and may be paid above the base figure. The discretionary uplift requires maintainer sign-off recorded in [`STATUS.md`](./STATUS.md) §10.

Severity is assigned by the protocol team using the rubric in [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md), which maps each band to the protocol's invariants and to the Immunefi Vulnerability Severity Classification System v2.3 categories. Researchers may propose a severity in the submission; the platform-published terms make clear that final assignment is the team's responsibility.

---

## 6. Platform Selection — Candidate Comparison

The two candidate platforms named in issue #116 §5.1 are evaluated below. The final decision is recorded in [`STATUS.md`](./STATUS.md) §4 (Platform selection).

| Criterion | Weight | Immunefi (preferred for DeFi) | HackenProof | Notes |
|-----------|--------|-------------------------------|-------------|-------|
| **DeFi / smart-contract pedigree** | **20%** | Mature: most large DeFi protocols use Immunefi | Strong web3 coverage, more web-app oriented | A5's largest-payout band is on-chain |
| **TON ecosystem coverage** | **15%** | Growing — already hosts TON projects | Hosts TON projects as well | Verify in §6.1 due-diligence |
| **Triage workflow & escalation** | **10%** | Built-in triage staff + project triage | Project-led triage with platform support | Both acceptable |
| **Researcher community size** | **10%** | Largest web3 researcher pool | Sizeable but smaller than Immunefi for smart contracts | Affects time-to-first-report |
| **Severity rubric maturity** | **10%** | Immunefi Vulnerability Severity Classification v2.3 | HackenProof severity guide | Both are auditable |
| **Payout flexibility** | **10%** | USDC + token + multi-chain payouts | USDC + multi-chain | Required to pay $10,000+ tier without friction |
| **KYC / sanctions tooling** | **10%** | Platform-managed | Platform-managed | Per upstream gate §3 row 5 |
| **Public transparency tooling** | **5%** | Public program page + leaderboard | Public program page | Acceptance criterion #5 leans on this |
| **Cost / take rate** | **5%** | Higher take rate, more service | Lower take rate, less service | Compare against funding envelope §3 row 4 |
| **Migration / off-boarding** | **5%** | Documented offboarding path | Documented offboarding path | Avoid lock-in |

Default recommendation per issue #116 §5.1: **Immunefi**, due to DeFi pedigree and largest researcher community for the on-chain band. Recommendation is overridden in [`STATUS.md`](./STATUS.md) §4 only if a documented criterion fails.

### 6.1 Due-diligence Items per Platform

Before signing, each candidate platform must answer in writing:

1. **KYC stance:** is KYC mandatory for payouts at every tier or only above a threshold? (Affects researcher participation.)
2. **Sanctions screening:** which list set is checked (OFAC SDN, EU consolidated, UK HMT)? Who pays for false-positive review?
3. **Reward escrow:** does the platform hold the bounty pool in escrow, or does the project pay on demand?
4. **Confidentiality:** what is the default disclosure posture (public unless redacted, vs. private unless authorised)?
5. **Conflict-of-interest:** can a platform-employed triager hold TBC tokens / TBC Diamonds / Series 7777/8888 NFTs while triaging A5 reports?
6. **Programmatic API:** does the platform expose a read-only API for ingesting submission counts and statuses into our quarterly report?
7. **Off-boarding:** if the program is paused or moved, what happens to in-flight submissions and to historical records?
8. **TON support:** does the platform have TON-specialist triagers (Tact, FunC, message-passing semantics)?

Answers are recorded in [`STATUS.md`](./STATUS.md) §4.

---

## 7. Engagement Process

```
T-A1  A1 verdict = READY                                                  (hard gate)
T-A2  A2 verdict = READY                                                  (hard gate)
T-0   A5 issue published                                                  ✅
T+0   Platform shortlist + due-diligence questionnaire sent               ⏳
T+1w  Platform proposals received, comparison matrix populated
T+2w  Platform selected, account creation + KYC
T+3w  Program brief drafted on platform staging
T+4w  Internal review of staging brief (cross-check vs. PROGRAM_BRIEF.md)
T+4w  SECURITY.md updated with platform program-page link (held until launch)
T+5w  Dry-run submission executed end-to-end (DRY_RUN.md)
T+6w  Public launch on the platform
T+6w  SECURITY.md update merged
T+6w  CHANGELOG.md disclosure entry
T+18w Q1 transparency report published (QUARTERLY_REPORT_TEMPLATE.md)
T+30w Q2 transparency report published
```

All dates are anchored to the A5 kickoff (`T`). `T-A1` and `T-A2` are not under A5's control; they are upstream completion gates per [§3](#3-upstream-gates).

The launch phase is intentionally short (6 weeks) because the program brief reuses scope material already produced for A1, A2, and A4 — A5 does not re-derive scope, it bundles the existing scope into a researcher-facing format.

The remediation phase, once submissions start arriving, follows [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) verbatim with two amendments:

1. The finding intake step (§3.1) is performed on the bounty platform first; the report PDF / JSON is committed to `docs/security/audits/A5-bug-bounty/findings/<finding-id>.md` only after triage.
2. Payment after re-verification follows the SLA in [§4.2](#42-response-slas) and is recorded in the quarterly transparency report.

---

## 8. Deliverables

The engagement produces the following durable artifacts (all live in this directory unless noted):

1. **Platform program page** — live URL recorded in [`STATUS.md`](./STATUS.md) §4 and linked from [`../../../../SECURITY.md`](../../../../SECURITY.md).
2. **[`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md)** — canonical source for the program brief published on the platform. Any divergence between the brief on the platform and this file is a documentation bug.
3. **[`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md)** — severity classification rubric with worked examples per band, mapped to invariants `I1`–`I7`.
4. **[`DRY_RUN.md`](./DRY_RUN.md)** — internal dry-run plan and evidence template (acceptance criterion #6).
5. **[`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md)** — template used for quarterly transparency reports (acceptance criterion #5).
6. **Per-finding files** (`findings/<finding-id>.md`) — created on intake; mirror the platform record into the repository for tamper evidence and remediation linkage.
7. **Quarterly transparency reports** (`reports/YYYY-Qn.md`) — published every quarter, linked from `STATUS.md` §9 Artifacts.
8. **Re-test evidence** — recorded against the remediation commit hash for every Critical / High finding.

The platform-published brief and the in-repo files are kept in sync with a manual diff check at every platform-side edit, recorded in [`STATUS.md`](./STATUS.md) §13.

---

## 9. Acceptance / Gating Decision

The engagement is **launched** when:

- All eight upstream gates in [§3](#3-upstream-gates) are green.
- The dry-run submission ([`DRY_RUN.md`](./DRY_RUN.md)) completes end-to-end without SLA breach.
- The platform brief mirrors [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) verbatim except for platform-specific markup.

The engagement is **ongoing** thereafter; unlike A1/A2/A4 it has no fixed end-date. Quarterly transparency reports (`reports/YYYY-Qn.md`) are the recurring deliverable.

The engagement enters **PAUSED** state when:

- Funding envelope drops below the 12-month projection (per [§3](#3-upstream-gates) row 4).
- A material scope change is in flight and the program brief cannot reflect the in-flight state without confusing researchers.
- A platform incident (KYC, sanctions tooling) blocks payouts.

A pause is recorded in [`STATUS.md`](./STATUS.md) §13 within 24 hours of the triggering event, and the platform program page is set to "paused — not accepting new submissions" until the pause is resolved.

---

## 10. References

- [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
- [Issue #112 (A1)](https://github.com/xlabtg/tonbankcard-protocol/issues/112) · [A1 engagement](../A1-core-contracts/ENGAGEMENT.md)
- [Issue #113 (A2)](https://github.com/xlabtg/tonbankcard-protocol/issues/113) · [A2 engagement](../A2-phase4-contracts/ENGAGEMENT.md)
- [Issue #115 (A4)](https://github.com/xlabtg/tonbankcard-protocol/issues/115) · [A4 engagement](../A4-offchain-services/ENGAGEMENT.md)
- [Audits index](../README.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Report template](../REPORT_TEMPLATE.md)
- [Engagement status (A5)](./STATUS.md)
- [Program brief (A5)](./PROGRAM_BRIEF.md)
- [Severity rubric (A5)](./SEVERITY_RUBRIC.md)
- [Dry-run plan (A5)](./DRY_RUN.md)
- [Quarterly report template (A5)](./QUARTERLY_REPORT_TEMPLATE.md)
- [Audit Readiness](../../AUDIT_READINESS.md)
- [Security Policy](../../../../SECURITY.md)
- [Incident Response](../../INCIDENT_RESPONSE.md)
- [Formal Invariants](../../../../audit/INVARIANTS.md)
- [Threat Model](../../../../audit/THREAT_MODEL.md)
- [Audit notes — known limitations](../../../audit-notes.md)
- [Development Roadmap — Track A, A5](../../../../TEMP/DEVELOPMENT_ROADMAP.md)
- Immunefi — https://immunefi.com
- Immunefi Vulnerability Severity Classification System v2.3 — https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/
- HackenProof — https://hackenproof.com
- OWASP Top 10:2021 — https://owasp.org/Top10/
