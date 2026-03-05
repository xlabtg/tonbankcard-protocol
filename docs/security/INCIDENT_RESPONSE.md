# TONBANKCARD Protocol — Security Incident Response

**Document Type:** Security Documentation
**Issue Reference:** [#62 — Issue 10.5 Security Documentation Structure](https://github.com/xlabtg/tonbankcard-protocol/issues/62)
**Full Governance Incident Response:** [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md)
**Status:** Active
**Last Updated:** 2026-03-05

---

## Overview

This document provides the security-focused view of incident response for the TONBANKCARD protocol. It covers security-specific incident types, response procedures for key compromise and contract vulnerabilities, and escalation paths.

For the complete incident response framework including governance response, communication, and post-mortem requirements, see [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md).

---

## Core Principles

No incident, regardless of severity, may cause the protocol to violate its invariants. Emergency powers do not exist in the protocol layer.

**Permanently forbidden** in all incident response scenarios:

- Admin withdrawal from any account
- Account seizure
- Forced fund transfers
- Silent contract mutation
- Retroactive settlement changes
- Transaction censorship
- Bypassing protocol invariants I1–I7

---

## Incident Classification

| Severity | Description | Examples |
|----------|-------------|---------|
| **CRITICAL** | Active exploit, confirmed fund risk, or systemic protocol failure | Confirmed lock bypass, active contract exploit, governance NFT mass compromise |
| **HIGH** | Potential economic or protocol risk, possible exploit vector identified | Unconfirmed vulnerability report, partial adapter compromise, key material suspected compromised |
| **MEDIUM** | Operational degradation, no direct fund risk | Adapter downtime, governance UI failure, off-chain sync delay |
| **LOW** | Limited impact, no funds at risk | Indexer lag, minor API errors, documentation errors |

---

## Security Incident Types

### 1. Smart Contract Vulnerabilities

Incidents originating within deployed contract logic:

- Logic flaws in Payment Hub or account state machine
- Signature validation errors
- Lock bypass vulnerabilities
- Replay attack vectors
- NFT resolver manipulation

**Response:** See [docs/governance/INCIDENT_RESPONSE.md §2.1](../governance/INCIDENT_RESPONSE.md).

**Key constraint:** Deployed contracts are immutable. Response options are limited to:
- Communication and user guidance
- Protocol pause (via admin key, if applicable)
- Deployment of a new contract version (requires governance process)

### 2. Key Compromise

See [docs/security/KEY_MANAGEMENT.md §6](./KEY_MANAGEMENT.md) for detailed compromise scenarios by key class.

#### Admin Key Compromise

**Blast radius:** Protocol can be paused; accounts can be flagged. User funds **cannot** be moved.

**Immediate actions:**
1. Rotate admin key via governance process
2. Issue public communication if protocol is paused
3. Review all recent admin actions for unauthorized use
4. Conduct post-mortem within 1 week

**Notification timeline:** Internal: immediate; community: within 2 hours if protocol is paused; public disclosure: within 72 hours.

#### Risk Authority Key Compromise

**Blast radius:** Arbitrary fraud locks can be set or cleared. User funds **cannot** be seized.

**Immediate actions:**
1. Rotate risk authority key immediately
2. Review all lock changes after estimated compromise time
3. Re-evaluate cleared locks for potential fraud risk

**Notification timeline:** Internal: immediate; affected users: within 4 hours; lending partners: within 2 hours.

#### CI/CD Secret Compromise

**Blast radius:** NPM package poisoning (supply chain — HIGH RISK); test environment disruption; docker image tampering.

**Immediate actions:**
1. Revoke all CI/CD secrets immediately
2. Rotate NPM publish token
3. If NPM package published under compromised token: pull package, issue security advisory
4. Audit recent CI runs

#### Backend Infrastructure Compromise

**Blast radius:** Indexed data may be tampered; API responses may be manipulated. User funds **cannot** be moved (backend holds no signing keys).

**Immediate actions:**
1. Isolate compromised system
2. Audit all API responses served since estimated compromise
3. Notify users of potential data integrity issues

### 3. External Integration Failures

Incidents from off-chain or third-party components:

- Payment provider compromise (ChangeNOW, NOWPayments, CoinRabbit)
- Lending adapter manipulation
- External API exploitation

**Key constraint:** External adapters have no direct protocol access. All fund movements require user-signed on-chain transactions. Adapter compromise cannot result in fund loss.

---

## Reporting a Security Vulnerability

To report a security vulnerability in TONBANKCARD:

**Do not use public GitHub issues.**

See the [Responsible Disclosure Policy](/SECURITY.md) at the repository root for contact methods, expected response timeline, and scope of vulnerability reporting.

---

## Escalation Path

```
Discovery (any team member)
    ↓
Incident declared (severity assigned)
    ↓
CRITICAL / HIGH: Immediate team notification + response initiation
MEDIUM / LOW:    Tracked in governance registry; addressed in next cycle
    ↓
Containment actions (per key class or incident type above)
    ↓
Public communication (per severity and governance framework)
    ↓
Post-mortem (mandatory for CRITICAL and HIGH)
```

For full escalation procedures, communication templates, and post-mortem requirements, see [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md).

---

## References

| Document | Location | Purpose |
|----------|----------|---------|
| Full Incident Response | [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md) | Complete framework including governance response |
| Key Management | [docs/security/KEY_MANAGEMENT.md](./KEY_MANAGEMENT.md) | Key compromise scenarios and rotation procedures |
| Threat Model | [docs/security/THREAT_MODEL.md](./THREAT_MODEL.md) | Security architecture and threat-to-mitigation mapping |
| Responsible Disclosure | [/SECURITY.md](../../SECURITY.md) | Vulnerability reporting policy |
| Security Index | [docs/security/SECURITY.md](./SECURITY.md) | Security documentation hub |

---

**TONBANKCARD: Non-Custodial. Auditable. Security-First.**
