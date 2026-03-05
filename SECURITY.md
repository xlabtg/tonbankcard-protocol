# Security Policy — TONBANKCARD Protocol

This document describes the responsible disclosure policy for the TONBANKCARD protocol.

---

## Supported Versions

| Version | Status | Security Support |
|---------|--------|-----------------|
| v1.0.x | Active | Supported |

Earlier versions and pre-release deployments are not covered by this policy.

---

## Reporting a Vulnerability

**Do not report security vulnerabilities via public GitHub issues.** Public disclosure before a fix is available puts users at risk.

### Contact

Report security vulnerabilities by opening a **private security advisory** on GitHub:

1. Go to the [Security tab](https://github.com/xlabtg/tonbankcard-protocol/security) of this repository
2. Click **"Report a vulnerability"**
3. Provide a detailed description of the issue

If you are unable to use GitHub's private advisory feature, contact the maintainers directly via the contact information listed in the repository's [README.md](README.md).

### What to Include

A useful vulnerability report includes:

- Description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected contract(s) or component(s)
- Proof of concept or test case, if available
- Suggested severity (Critical, High, Medium, Low)

---

## Response Timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement of report | Within 48 hours |
| Severity assessment | Within 5 business days |
| Status update | Every 7 days until resolved |
| Fix or mitigation | Depends on severity — see below |
| Public disclosure | Coordinated with reporter |

### Fix Timeline by Severity

| Severity | Target Fix Timeline |
|----------|---------------------|
| Critical | Within 72 hours for containment; patch as soon as feasible |
| High | Within 7 days |
| Medium | Within 30 days |
| Low | Next planned release |

We aim to coordinate public disclosure with the reporter. We will not disclose without notifying you first, and we will credit you in the disclosure if you wish.

---

## Scope

### In Scope

The following are within scope for this policy:

- Smart contracts in `contracts/` (Payment Hub, Account Locks, NFT Resolver, Account State Machine)
- SDK in `sdk/`
- Merchant API in `api/`

### Out of Scope

The following are explicitly out of scope:

- Already-deployed and frozen external contracts (TBC Token Jetton, NFT Collections, TBC Diamonds, TONCO DEX) — these are immutable and separately governed
- Third-party services (ChangeNOW, NOWPayments, CoinRabbit, TONCO) — report vulnerabilities directly to those providers
- Frontend UI issues that require physical access to a user's device
- Denial-of-service attacks via normal blockchain congestion
- Theoretical vulnerabilities with no demonstrated impact

### Priority Focus Areas

The most security-critical areas of this protocol:

- Fund safety: any path that could result in unauthorized fund movement
- NFT ownership enforcement: any bypass of the ownership check
- Lock bypass: any path to transfer from a locked account
- Admin key misuse: any undocumented admin capability

---

## Non-Custodial Architecture

TONBANKCARD is a **non-custodial protocol**. The architecture enforces that:

- No admin or operator can move user funds
- No emergency mechanism exists that transfers or seizes funds
- Account locks restrict outgoing transfers but do not confiscate balances

For more on the security model, see [docs/security/SECURITY.md](docs/security/SECURITY.md).

---

## Disclosure Policy

We follow a coordinated disclosure approach:

1. Reporter submits vulnerability privately
2. TONBANKCARD team assesses and works on a fix
3. Fix is prepared and tested
4. Reporter is given a preview of the disclosure and credited (if desired)
5. Fix is deployed
6. Public disclosure is made after fix is live

We will not take legal action against researchers who report vulnerabilities in good faith and follow this policy.

---

## Security Documentation

For the full security framework, see:

- [docs/security/SECURITY.md](docs/security/SECURITY.md) — Security documentation index
- [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) — Threat model and security architecture
- [docs/security/KEY_MANAGEMENT.md](docs/security/KEY_MANAGEMENT.md) — Key management and operational security
- [docs/security/INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md) — Incident response procedures
- [docs/security/AUDIT_READINESS.md](docs/security/AUDIT_READINESS.md) — Audit readiness status
