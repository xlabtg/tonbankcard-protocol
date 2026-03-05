# TONBANKCARD Protocol — Responsible Disclosure & Vulnerability Reporting Policy

**Document Type:** Security Policy
**Issue Reference:** [#66 — Issue 10.7 — Responsible Disclosure & Vulnerability Reporting Policy](https://github.com/xlabtg/tonbankcard-protocol/issues/66)
**Status:** Proposed
**Last Updated:** 2026-03-05

---

## Table of Contents

1. [Reporting Channels](#1-reporting-channels)
2. [Encryption Requirements](#2-encryption-requirements)
3. [Scope](#3-scope)
4. [Response Timeline](#4-response-timeline)
5. [Disclosure Policy](#5-disclosure-policy)
6. [Safe Harbor Statement](#6-safe-harbor-statement)

---

## 1. Reporting Channels

**DO NOT** disclose security vulnerabilities publicly. Public disclosure before a patch is available puts all users at risk.

To report a vulnerability:

- **Email:** security@tonbankcard.com
- **Subject line format:** `[SECURITY] <brief description>`
- Include a detailed description of the issue, reproduction steps, and potential impact

If you do not receive an acknowledgement within 72 hours, send a follow-up to the same address referencing your original report.

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

- **Smart contracts:** `PaymentHub`, `MerchantNFT`, and related on-chain contracts in this repository
- **Backend API:** REST endpoints handling invoice creation, settlement verification, and merchant registry
- **Merchant SDK:** JavaScript/TypeScript SDK published under `@tonbankcard/sdk`
- **Authentication and access control logic:** Key management, role-based access, admin operations
- **Protocol-level logic:** Settlement finality, reorg handling, invariant violations

### Out of Scope

The following are not in scope:

- Vulnerabilities in third-party dependencies unless directly exploitable through TONBANKCARD code
- TON blockchain infrastructure, validator nodes, or core protocol
- Reports requiring physical access to infrastructure
- Social engineering attacks against team members
- Denial-of-service attacks without demonstrated exploit impact
- Issues in test environments or non-production deployments with no production impact
- Self-XSS or self-inflicted issues with no realistic attack path

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

These are target timelines. Complex issues involving on-chain contracts may require additional time due to audit and deployment constraints. Reporters will be kept informed of any delays.

---

## 5. Disclosure Policy

TONBANKCARD follows a **coordinated disclosure** model:

1. Reporter submits vulnerability via the channel in Section 1
2. TONBANKCARD acknowledges receipt and opens a private investigation
3. TONBANKCARD and reporter agree on a disclosure timeline (default: 90 days from acknowledgement)
4. A patch or mitigation is developed and deployed
5. A public disclosure is issued after the fix is available

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

**Security Contact:** security@tonbankcard.com
