# TONBANKCARD Protocol — Security Framework Index

**Document Type:** Security Framework Index (Hub)
**Issue Reference:** [#62 — Issue 10.5 Security Documentation Structure](https://github.com/xlabtg/tonbankcard-protocol/issues/62)
**Status:** Formal Specification
**Last Updated:** 2026-03-05

---

## Overview

This document is the canonical entry point for all security documentation in the TONBANKCARD protocol. It links to each security component and provides a brief orientation for each document.

TONBANKCARD is a **non-custodial protocol**. Its security model is built on the principle that no party — including the protocol operators — can seize, move, or control user funds. Security documentation reflects this foundational constraint.

---

## Security Documents

### 1. Threat Model

**File:** [THREAT_MODEL.md](./THREAT_MODEL.md)

Defines the formal security architecture, adversary model, attack surface classification, trust boundaries, and threat-to-mitigation mappings for the protocol. This is the primary reference for understanding what TONBANKCARD defends against and why.

Topics covered:
- Security philosophy and design principles
- System components in scope
- Adversary model (capabilities and assumptions)
- Attack surface classification
- Trust boundaries
- Threat mitigations
- Finality and reorg model
- Key compromise scenarios

### 2. Key Management & Operational Security

**File:** [KEY_MANAGEMENT.md](./KEY_MANAGEMENT.md)

Specifies operational security requirements for all cryptographic key classes used by the protocol. Covers storage requirements, role separation, rotation schedules, and compromise response procedures.

Topics covered:
- Key classification (on-chain authority, governance, infrastructure, CI/CD)
- Hardware storage requirements
- Role separation rules
- Rotation policy and schedule
- Compromise scenarios and blast radius
- Multi-sig and MPC requirements
- Backup and recovery
- Supply chain security

### 3. Audit Readiness

**File:** [AUDIT_READINESS.md](./AUDIT_READINESS.md)

Documents the audit preparation state of the protocol: contract inventory, invariant coverage, audit scope definition, open risks, and expected auditor entry points. This is the primary reference for external auditors preparing to engage with TONBANKCARD.

Topics covered:
- Audit scope and contract inventory
- Invariant coverage and test coverage
- Known risks and residual issues
- Auditor access and verification procedures
- Expected deliverables

### 4. Incident Response

**File:** [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)

Defines the protocol's incident classification, escalation, communication, and post-mortem requirements. Covers all incident types: smart contract vulnerabilities, external integration failures, infrastructure failures, governance incidents, and network-level events.

Topics covered:
- Incident severity classification
- Detection and reporting procedures
- Governance response model
- Allowed and forbidden emergency actions
- Communication framework
- Post-mortem requirements

### 5. Key Management & Operational Security (see above)

Already listed at item 2.

---

## Related Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Architecture** | [docs/architecture.md](../architecture.md) | System design and component relationships |
| **Invariants** | [docs/invariants.md](../invariants.md) | Formal protocol guarantees |
| **Threat Model (full)** | [docs/threat-model.md](../threat-model.md) | Comprehensive threat analysis |
| **Audit Package** | [audit/](../../audit/) | Frozen auditor-facing artifacts |
| **Audit Threat Model** | [audit/THREAT_MODEL.md](../../audit/THREAT_MODEL.md) | Auditor-facing threat summary |
| **SDK Security** | [sdk/SECURITY.md](../../sdk/SECURITY.md) | Security guarantees for SDK consumers |
| **Governance Incident Response** | [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md) | Governance-layer incident procedures |
| **Protocol Registry** | [docs/registry/protocol-registry.md](../registry/protocol-registry.md) | Canonical protocol state |
| **Responsible Disclosure** | [/SECURITY.md](../../SECURITY.md) | Vulnerability reporting and disclosure policy |

---

## Reporting Security Issues

To report a security vulnerability, see the [Responsible Disclosure Policy](/SECURITY.md) at the repository root.

**Do not report security vulnerabilities via public GitHub issues.**

---

## Non-Goals

This document does not:
- Replace individual security documents (it links to them)
- Define protocol invariants (see [docs/invariants.md](../invariants.md))
- Serve as a marketing or whitepaper document
- Duplicate content from linked documents

---

**TONBANKCARD: Non-Custodial. Auditable. Security-First.**
