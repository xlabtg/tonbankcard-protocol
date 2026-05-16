# TONBANKCARD — Public Bug Bounty Program Brief

**Document Type:** Public Bug Bounty Program Brief (canonical source for platform publication)
**Engagement:** [A5](./ENGAGEMENT.md) · [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Platform:** Immunefi (preferred) / HackenProof — selection recorded in [`STATUS.md`](./STATUS.md) §4
**Status:** Draft — awaiting upstream gates per [`STATUS.md`](./STATUS.md) §2
**Last Updated:** 2026-05-16

---

## 0. How to Read This Document

This file is the **canonical source** for the program brief that will be published on the chosen bug bounty platform. Once the platform brief is live, any change must land here first and be propagated to the platform within 24 hours.

If the platform's web form does not support a section below verbatim (e.g. nested tables), the section is rewritten on the platform with a reference back to this file and the divergence is logged in [`STATUS.md`](./STATUS.md) §13.

---

## 1. Program Overview

**Project:** TONBANKCARD — a non-custodial payment protocol on the TON blockchain.

The protocol pairs an NFT-based account abstraction with a merchant-facing payment hub. Settlement is final on-chain; the protocol holds no user funds and exposes no admin path that could move them. Full architecture and invariants are public:

- Repository: https://github.com/xlabtg/tonbankcard-protocol
- Security policy: [`SECURITY.md`](../../../../SECURITY.md)
- Formal invariants `I1`–`I7`: [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md)
- Threat model: [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md)
- Audit readiness: [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md)

**Goal of the program:** continuous, financially-incentivised vulnerability disclosure to extend the coverage of point-in-time engagements [A1](../A1-core-contracts/ENGAGEMENT.md), [A2](../A2-phase4-contracts/ENGAGEMENT.md), [A3](https://github.com/xlabtg/tonbankcard-protocol/pull/146), and [A4](../A4-offchain-services/ENGAGEMENT.md).

**What this program is not:**

- Not a replacement for `SECURITY.md` — researchers who prefer email or GitHub Security Advisories may continue using those channels, but **only platform-submitted reports are eligible for rewards**.
- Not a vehicle for general-purpose feature requests or bugs without security impact.
- Not a way to test against TONBANKCARD mainnet — see §5.2 Rules of Engagement.

---

## 2. Rewards

### 2.1 Reward Tiers

| Severity | Smart Contract (on-chain) | Off-Chain Service (`api/`, `backend/indexer/`, `sdk/`) | Frontend (`wallet-ui/`, `dashboard/`) |
|----------|---------------------------|---------------------------------------------------------|----------------------------------------|
| 🔴 **Critical** | **$10,000+** | $5,000 | n/a — escalated to Off-Chain or Smart Contract per impact |
| 🟠 **High** | $5,000 | $2,500 | n/a — escalated to Off-Chain per impact |
| 🟡 **Medium** | $1,000 | $500 | $500 |
| 🟢 **Low** | $100 | $100 | $100 |

Payouts are in **USDC** (default). Alternative currencies are negotiable subject to platform support and sanctions screening per §6.

The "$10,000+" Critical tier is open-ended: extraordinary findings — full breaks of `I1` (Non-Custodial) or `I3` (No Admin Fund Control), provable theft of merchant funds at scale, or compromise of the protocol's account-abstraction primitive — are scored on economic impact and may be paid above the base figure. The discretionary uplift requires maintainer sign-off recorded in [`STATUS.md`](./STATUS.md) §10.

### 2.2 What Determines Severity

Severity is determined by the protocol team using [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md), which maps each band to the protocol's invariants and to the Immunefi Vulnerability Severity Classification System v2.3 categories. Researchers may propose a severity in the submission; the platform-published rubric makes clear that final assignment is the team's responsibility.

### 2.3 Payment Timing

Per [§5.3 Response SLAs](#53-response-slas):

- Bounty is paid **within 30 days of fix deployment**.
- If the fix requires a coordinated mainnet deployment that takes longer, an interim "intent-to-pay" letter is issued within 30 days and the actual payment follows the deployment.

---

## 3. Scope

The frozen scope is mirrored from [`ENGAGEMENT.md`](./ENGAGEMENT.md) §2. The platform-published brief lists exact file paths and commit hash; researchers test against the head of `main` at the recorded commit unless an asset is explicitly tagged.

### 3.1 Smart Contracts — Highest Severity (on-chain)

Pays the **smart-contract** column of §2.1.

| Asset | Path |
|-------|------|
| PaymentHub | [`contracts/payments/PaymentHub.tact`](../../../../contracts/payments/PaymentHub.tact) |
| MerchantPaymentHub | [`contracts/MerchantPaymentHub.tact`](../../../../contracts/MerchantPaymentHub.tact) |
| Account Locks | [`contracts/payments/account-locks.fc`](../../../../contracts/payments/account-locks.fc) |
| NFT Account Resolver (FunC) | [`contracts/nft-resolver/nft_account_resolver.fc`](../../../../contracts/nft-resolver/nft_account_resolver.fc) |
| NFT Account Resolver (Tact) | [`contracts/nft-resolver/nft_account_resolver.tact`](../../../../contracts/nft-resolver/nft_account_resolver.tact) |
| Public Collateral Lookup | [`contracts/collateral-lookup/PublicCollateralLookup.tact`](../../../../contracts/collateral-lookup/PublicCollateralLookup.tact) |
| Collateral Signal | [`contracts/CollateralSignal.tact`](../../../../contracts/CollateralSignal.tact) |
| CrossChainBridge (post-A2 only) | [`contracts/CrossChainBridge.tact`](../../../../contracts/CrossChainBridge.tact) |
| MultiSigCard (post-A2 only) | [`contracts/MultiSigCard.tact`](../../../../contracts/MultiSigCard.tact) |

Until the [A2 engagement](../A2-phase4-contracts/ENGAGEMENT.md) verdict reaches `READY`, `CrossChainBridge.tact` and `MultiSigCard.tact` are listed as **Pending A2** and bounty submissions against them are rerouted to the A2 intake.

### 3.2 Off-Chain Services — Medium Severity

Pays the **off-chain** column of §2.1.

| Asset | Path |
|-------|------|
| `@tonbankcard/merchant-api` | [`api/`](../../../../api/) |
| `@tonbankcard/payment-indexer` | [`backend/indexer/`](../../../../backend/indexer/) |
| `@tonbankcard/merchant-sdk` | [`sdk/`](../../../../sdk/) |

### 3.3 Frontend — Lower Severity

Pays the **frontend** column of §2.1.

| Asset | Path |
|-------|------|
| `@tonbankcard/wallet-ui` | [`wallet-ui/`](../../../../wallet-ui/) |
| `@tonbankcard/merchant-dashboard` | [`dashboard/`](../../../../dashboard/) |

### 3.4 Out of Scope (Bounty)

The following are explicitly **not** eligible for bounty (per issue #116 §4):

- Theoretical vulnerabilities without a working proof-of-concept against TON testnet or a project-provided staging environment.
- Issues in third-party dependencies and integrated services — report to the vendor:
  - ChangeNOW · NOWPayments · CoinRabbit · TONCO DEX
  - TON public HTTP API and validator infrastructure
  - Embedded npm transitive packages, except where TONBANKCARD's pinning or usage pattern is the exploit vector
- Social engineering against TONBANKCARD team members, contributors, or merchant operators.
- Physical security against people or facilities.
- Volumetric denial-of-service that does **not** cause fund loss or violation of invariants `I1`–`I7`.
- Findings already disclosed in any of:
  - [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) (internal pre-audit)
  - [`docs/audit-notes.md`](../../../audit-notes.md) (known accepted risks)
  - Engagements A1, A2, A3, A4 — see each engagement's `STATUS.md` Findings ledger
  - An open or closed GitHub issue labelled `type:security`
- Self-XSS or attacks requiring full prior control of the victim's browser / wallet.
- Missing security headers without a demonstrated impact.
- Vulnerabilities affecting only browsers or wallets outside the documented support matrix.
- Reports that require root access on systems the researcher does not own.
- Mainnet exploitation — see §5.2.

The full duplicate-handling rule is in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4.5.

---

## 4. Threat Areas We Pay Most For

The reward decision is driven primarily by impact on invariants `I1`–`I7` ([`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md)) and the threat classes in the protocol-wide threat model ([`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md) — T1 reentrancy, T2 NFT ownership spoofing, T3 lock bypass, T4 admin key abuse, T5 atomicity failure, T6 integer overflow / underflow, T7 replay attacks, T8 gas griefing).

Highest-priority threat areas:

1. **Fund movement without on-chain NFT ownership** (`I1` Non-Custodial, `I2` NFT = Account Authority) — any path that drains, freezes, or redirects user funds without the current NFT owner authorising the transaction.
2. **Admin-driven fund control** (`I3` No Admin Fund Control) — any path where `risk_authority`, `lending_adapter`, deployer, or another privileged role can move funds.
3. **Atomicity break** (`I4` Atomic Transfers, `I5` Ledger Conservation) — partial transfer states, ledger imbalances, double-credit / double-debit, replay double-spend on-chain.
4. **Lock-induced confiscation** (`I6` Lock ≠ Confiscation) — locks that move balances or reduce the recoverable amount.
5. **External adapter escape** (`I7` External Adapter Isolation) — lending adapter, bridge adapter, or other external integrator invoking protected operations directly.
6. **Off-chain auth break** — IDOR across merchants, webhook replay, API-key derivation / brute force.
7. **Supply chain** — npm package, browser widget, or build chain replacement that ships unsigned code to merchants.

The [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) walks through worked examples per band.

---

## 5. How the Program Works

### 5.1 How to Submit

1. Create a report on the platform program page (URL recorded in [`STATUS.md`](./STATUS.md) §4 at launch).
2. Include:
   - Vulnerability description and impact
   - Reproduction steps against testnet or staging
   - **Working proof-of-concept** (curl, Postman, scripts, transcript of a testnet transaction) — required per issue #116 §4
   - Affected asset(s) and file paths
   - Suggested severity per [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md)
3. **Do not** include private keys, mnemonic seeds, or wallet credentials.
4. Submit through the platform — email submissions are not eligible for bounties (per issue #116 §6) although `security@tonbankcard.com` and GitHub Security Advisories remain available for non-bounty disclosures.

### 5.2 Rules of Engagement

Per issue #116 §5.3 and §7:

- **Testnet / staging only.** TON testnet endpoints and the project-provided staging environment are the **only** acceptable PoC targets.
- **No mainnet exploitation.** Mainnet testing disqualifies the submission and the researcher from future participation.
- **No social engineering** against the team, contributors, or merchants.
- **No physical attacks** against people or infrastructure.
- **No volumetric denial-of-service** unless it directly causes fund loss or invariant violation, demonstrated via a minimal PoC.
- **No data exfiltration** beyond what is needed to demonstrate the vulnerability.
- **No public disclosure** before the 90-day fix window expires or the team authorises early disclosure ([§5.4](#54-coordinated-disclosure)).

Violation of these rules voids the bounty, may result in researcher suspension from the program, and — for mainnet exploitation specifically — strips the researcher of the safe-harbor in §7.

### 5.3 Response SLAs

| Milestone | Target | Hard ceiling |
|-----------|--------|--------------|
| Acknowledge submission / open triage | **3 business days** | 5 business days |
| Severity classification | **7 business days** | 10 business days |
| Researcher communication | every 14 days while finding is open | 21 days |
| Fix deployment (Critical) | 30 days | 90 days |
| Fix deployment (High) | 60 days | 90 days |
| Fix deployment (Medium) | 90 days | 180 days |
| Fix deployment (Low) | Best effort / next planned release | — |
| Bounty payment after fix deployment | **30 days** | 45 days |

`bd` = business days, Mon–Fri UTC, excluding listed maintainer holidays (TBD list maintained in [`STATUS.md`](./STATUS.md) §7).

SLA breaches are recorded in the next quarterly transparency report (see [§8](#8-public-transparency)).

### 5.4 Coordinated Disclosure

- **Critical / High:** 90-day fix window from severity classification before researcher may disclose publicly. Extension up to 180 days available on written agreement.
- **Medium / Low:** 90-day window applies; extension is automatic if remediation is in flight.
- **Already-exploited or wormable vulnerabilities:** emergency disclosure path per [`../../INCIDENT_RESPONSE.md`](../../INCIDENT_RESPONSE.md); the 90-day default does not apply and the researcher receives priority triage.

### 5.5 Duplicate Handling

Findings duplicating any of the items listed in [§3.4 Out of Scope](#34-out-of-scope-bounty) are closed as **duplicate** without payout. The earlier of two valid submissions for the same root cause (by platform timestamp) takes the bounty; the later submission receives quarterly-report credit.

---

## 6. Submission Hygiene & Eligibility

- **No private keys** in submission bodies. If a submission includes a key, the team rotates / revokes the key immediately, redacts the submission, and informs the researcher. Repeat offenders are suspended.
- **No live merchant credentials.** Use staging API keys provisioned by the team via the platform.
- **No exfiltrated user data.** Demonstrate impact with minimal data — for example, an invoice ID, not a full invoice list.
- **Internal contributors ineligible (proposed).** Current and recent (≤6 months) TONBANKCARD contributors, maintainers, and contractors are not eligible to submit. Final eligibility list is in [`STATUS.md`](./STATUS.md) §12 Q-9.
- **Sanctioned-jurisdiction researchers.** Submissions are accepted and credited in the transparency report; payouts are blocked where required by sanctions law. The team works with the platform to clear false positives.
- **Tax & KYC.** Per the platform's policy. Captured in [`STATUS.md`](./STATUS.md) §11.
- **Right to publish.** By accepting a bounty the researcher grants the project the right to publish the finding in the quarterly transparency report and `CHANGELOG.md`, redacted as needed.

---

## 7. Safe Harbor

Researchers acting in good faith under this brief and under the project [`SECURITY.md`](../../../../SECURITY.md) Safe Harbor section will not face legal action from TONBANKCARD. The safe harbor applies when **all** of the following are true:

- Research is conducted on TON testnet or the project-provided staging environment only.
- No real user data is accessed, modified, or exfiltrated beyond what is necessary to demonstrate the vulnerability.
- No service availability is materially degraded for other users.
- No social engineering against team members, contributors, or merchants.
- Disclosure timeline in [§5.4](#54-coordinated-disclosure) is respected.
- Submission complies with [§6](#6-submission-hygiene--eligibility).

Safe harbor does not extend to exploitation for personal gain, access to or exfiltration of user data, or any activity that violates applicable law.

This brief is not legal advice and does not constitute a legal agreement. Researchers remain responsible for understanding and complying with all applicable laws.

---

## 8. Public Transparency

Per issue #116 §6:

- Aggregated program statistics — submissions received, accepted, paid — are published **quarterly** following [`QUARTERLY_REPORT_TEMPLATE.md`](./QUARTERLY_REPORT_TEMPLATE.md).
- Reports are committed under `docs/security/audits/A5-bug-bounty/reports/YYYY-Qn.md` and linked from [`../../AUDIT_READINESS.md`](../../AUDIT_READINESS.md).
- Each Critical / High finding gets a public summary entry in `CHANGELOG.md` once the fix is deployed and the 90-day window has elapsed (or the researcher consents to earlier disclosure).
- SLA breaches are disclosed in the same quarterly report.

---

## 9. Contact

| Channel | Use case |
|---------|----------|
| Platform program page (URL in [`STATUS.md`](./STATUS.md) §4) | All bounty submissions — **mandatory** for reward eligibility |
| `security@tonbankcard.com` | Non-bounty disclosures, sensitive cases the researcher prefers off-platform (not eligible for bounty) |
| GitHub Security Advisory | Equivalent private channel for non-bounty disclosures |
| `@konard` on GitHub | Program owner; first triage line |

---

## 10. References

- [Issue #116 — A5 Bug Bounty Program](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
- [A5 Engagement plan](./ENGAGEMENT.md) · [A5 Status](./STATUS.md) · [A5 Severity rubric](./SEVERITY_RUBRIC.md) · [A5 Dry-run](./DRY_RUN.md) · [A5 Quarterly report template](./QUARTERLY_REPORT_TEMPLATE.md)
- [A1 — Core contracts audit](../A1-core-contracts/ENGAGEMENT.md) · [A2 — Phase 4 contracts audit](../A2-phase4-contracts/ENGAGEMENT.md) · [A4 — Off-chain pentest](../A4-offchain-services/ENGAGEMENT.md)
- [Audits index](../README.md) · [Audit readiness](../../AUDIT_READINESS.md)
- [Security policy](../../../../SECURITY.md) · [Incident response](../../INCIDENT_RESPONSE.md)
- [Formal invariants `I1`–`I7`](../../../../audit/INVARIANTS.md) · [Threat model](../../../../audit/THREAT_MODEL.md)
- Immunefi — https://immunefi.com
- Immunefi Vulnerability Severity Classification System v2.3 — https://immunefi.com/immunefi-vulnerability-severity-classification-system-v2-3/
- HackenProof — https://hackenproof.com
- OWASP Top 10:2021 — https://owasp.org/Top10/
