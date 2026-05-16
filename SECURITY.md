# TONBANKCARD Protocol — Responsible Disclosure & Vulnerability Reporting Policy

**Document Type:** Security Policy
**Issue Reference:** [#66 — Issue 10.7 — Responsible Disclosure & Vulnerability Reporting Policy](https://github.com/xlabtg/tonbankcard-protocol/issues/66)
**Status:** Active
**Last Updated:** 2026-05-16

---

## Table of Contents

1. [Reporting Channels](#1-reporting-channels)
2. [Encryption Requirements](#2-encryption-requirements)
3. [Scope](#3-scope)
4. [Response Timeline](#4-response-timeline)
5. [Disclosure Policy](#5-disclosure-policy)
6. [Safe Harbor Statement](#6-safe-harbor-statement)
7. [Bug Bounty Program](#7-bug-bounty-program)

---

## Supported Versions

| Version | Status | Security Support |
|---------|--------|-----------------|
| v1.0.x | Active | Supported |

Earlier versions and pre-release deployments are not covered by this policy.

---

## 1. Reporting Channels

**DO NOT** disclose security vulnerabilities publicly. Public disclosure before a patch is available puts all users at risk.

> **Once the A5 bug bounty program is launched**, the bounty platform is the preferred channel for in-scope components and is the **only** channel eligible for monetary rewards. See [Section 7 — Bug Bounty Program](#7-bug-bounty-program). The channels below remain available for out-of-scope reports and as a fallback if the platform is unavailable.

The preferred channel is GitHub's private security advisory feature:

1. Go to the [Security tab](https://github.com/xlabtg/tonbankcard-protocol/security) of this repository
2. Click **"Report a vulnerability"**
3. Provide a detailed description of the issue

If you are unable to use GitHub's private advisory feature, report via email:

- **Email:** security@tonbankcard.com
- **Subject line format:** `[SECURITY] <brief description>`
- Include a detailed description of the issue, reproduction steps, and potential impact

If you do not receive an acknowledgement within 72 hours, send a follow-up referencing your original report.

### What to Include

A useful vulnerability report includes:

- Description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected contract(s) or component(s)
- Proof of concept or test case, if available
- Suggested severity (Critical, High, Medium, Low)

---

## 2. Encryption Requirements

For sensitive vulnerability reports, encrypted submission is strongly preferred.

- **PGP:** Encrypt your report to the TONBANKCARD security team PGP key (key details to be published at `security@tonbankcard.com` upon request)
- **Plain email** is accepted for low-severity or non-sensitive reports
- Do not include full exploit code or credential material in unencrypted email

Encryption key details will be provided upon initial contact if not yet published.

---

## 3. Scope

### In Scope

The following components are in scope for vulnerability reports:

- **Smart contracts:** `PaymentHub`, `MerchantNFT`, and related on-chain contracts in this repository (`contracts/`)
- **Backend API:** REST endpoints handling invoice creation, settlement verification, and merchant registry (`api/`)
- **Merchant SDK:** JavaScript/TypeScript SDK published under `@tonbankcard/sdk` (`sdk/`)
- **Authentication and access control logic:** Key management, role-based access, admin operations
- **Protocol-level logic:** Settlement finality, reorg handling, invariant violations

### Priority Focus Areas

The most security-critical areas of this protocol:

- **Fund safety:** any path that could result in unauthorized fund movement
- **NFT ownership enforcement:** any bypass of the ownership check
- **Lock bypass:** any path to transfer from a locked account
- **Admin key misuse:** any undocumented admin capability

### Out of Scope

The following are not in scope:

- Already-deployed and frozen external contracts (TBC Token Jetton, NFT Collections, TBC Diamonds, TONCO DEX) — these are immutable and separately governed
- Third-party services (ChangeNOW, NOWPayments, CoinRabbit, TONCO) — report vulnerabilities directly to those providers
- Vulnerabilities in third-party dependencies unless directly exploitable through TONBANKCARD code
- TON blockchain infrastructure, validator nodes, or core protocol
- Reports requiring physical access to infrastructure
- Social engineering attacks against team members or users
- Denial-of-service attacks without demonstrated exploit impact
- Issues in test environments or non-production deployments with no production impact
- Theoretical vulnerabilities with no demonstrated impact

---

## 4. Response Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement of receipt | Within 72 hours |
| Initial severity assessment | Within 7 days |
| Status update to reporter | Every 14 days until resolved |
| Patch for critical severity | Within 30 days |
| Patch for high severity | Within 60 days |
| Patch for medium/low severity | Within 90 days |

### Fix Timeline by Severity

| Severity | Target Fix Timeline |
|----------|---------------------|
| Critical | Within 72 hours for containment; patch within 30 days |
| High | Within 60 days |
| Medium | Within 90 days |
| Low | Next planned release |

These are target timelines. Complex issues involving on-chain contracts may require additional time due to audit and deployment constraints. Reporters will be kept informed of any delays.

---

## 5. Disclosure Policy

TONBANKCARD follows a **coordinated disclosure** model:

1. Reporter submits vulnerability via the channel in Section 1
2. TONBANKCARD acknowledges receipt and opens a private investigation
3. TONBANKCARD and reporter agree on a disclosure timeline (default: 90 days from acknowledgement)
4. A patch or mitigation is developed and deployed
5. Reporter is given a preview of the disclosure and credited (if desired)
6. A public disclosure is issued after the fix is available

**Early disclosure may occur** if:

- The vulnerability is already being actively exploited
- A partial fix is available that significantly reduces risk

**Extension of the 90-day timeline** may be requested by either party in writing. Extensions are granted on a case-by-case basis.

If TONBANKCARD does not respond within the timelines defined in Section 4, reporters may proceed with disclosure at their discretion, having acted in good faith.

---

## 6. Safe Harbor Statement

TONBANKCARD supports responsible security research. If you report a vulnerability in good faith and in accordance with this policy, we will not pursue legal action against you for that research.

Good faith research means:

- You do not access, modify, or exfiltrate data beyond what is necessary to demonstrate the vulnerability
- You do not disrupt service availability or degrade performance for other users
- You do not use social engineering techniques against team members or users
- You report the issue to us before public disclosure
- You allow reasonable time for a fix before disclosing publicly

This safe harbor applies to research conducted under these terms. It does not extend to:

- Exploitation of vulnerabilities for personal gain
- Access to or exfiltration of user data
- Any activity that violates applicable law

This statement is not legal advice and does not constitute a legal agreement. Researchers are responsible for understanding and complying with all applicable laws.

---

## 7. Bug Bounty Program

TONBANKCARD operates a public bug bounty program (engagement **A5**) on a third-party platform. The program is the **only** channel eligible for monetary rewards.

- **Engagement plan:** [`docs/security/audits/A5-bug-bounty/ENGAGEMENT.md`](docs/security/audits/A5-bug-bounty/ENGAGEMENT.md)
- **Program brief (canonical source for the platform-published terms):** [`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
- **Severity rubric:** [`docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md`](docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
- **Engagement status (live):** [`docs/security/audits/A5-bug-bounty/STATUS.md`](docs/security/audits/A5-bug-bounty/STATUS.md)
- **Quarterly transparency reports:** [`docs/security/audits/A5-bug-bounty/reports/`](docs/security/audits/A5-bug-bounty/) (published every calendar quarter while the program is active)

Reward tiers, scope, SLAs, safe-harbor terms, and the duplicate / out-of-scope policy are all defined in the program brief. The brief in this repository is the canonical source — if the platform listing diverges from the repository version, the discrepancy is treated as a documentation bug and the repository version applies.

**Launch gate:** the program goes public only after both [A1 — Core Contracts Audit](docs/security/audits/A1-core-contracts/) and [A2 — External Adapters Audit](docs/security/audits/A2-external-adapters/) are closed with a passing gating decision and after the internal dry-run defined in [`DRY_RUN.md`](docs/security/audits/A5-bug-bounty/DRY_RUN.md) completes successfully. Until launch, the program page is private / unlisted and submissions should continue to use the channels in [Section 1](#1-reporting-channels).

---

## Non-Custodial Architecture

TONBANKCARD is a **non-custodial protocol**. The architecture enforces that:

- No admin or operator can move user funds
- No emergency mechanism exists that transfers or seizes funds
- Account locks restrict outgoing transfers but do not confiscate balances

For more on the security model, see [docs/security/SECURITY.md](docs/security/SECURITY.md).

---

## Security Documentation

For the full security framework, see:

- [docs/security/SECURITY.md](docs/security/SECURITY.md) — Security documentation index and unified framework
- [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) — Threat model and security architecture
- [docs/security/KEY_MANAGEMENT.md](docs/security/KEY_MANAGEMENT.md) — Key management and operational security
- [docs/security/INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md) — Incident response procedures
- [docs/security/AUDIT_READINESS.md](docs/security/AUDIT_READINESS.md) — Audit readiness status

---

**Security Contact:** security@tonbankcard.com
