# Documentation Index

This index provides navigation across all Tonbankcard Protocol documentation.

---

## Getting Started

| Document | Description |
|----------|-------------|
| [README](../README.md) | Project overview, structure, and quick start |
| [CONTRIBUTING](../CONTRIBUTING.md) | Contribution guidelines and principles |
| [SECURITY](../SECURITY.md) | Security policy and responsible disclosure |

---

## Protocol Overview

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System architecture and component relationships |
| [Whitepaper v1](whitepaper/whitepaper-v1.md) | Full technical whitepaper |
| [Litepaper v1](litepaper/litepaper-v1.md) | Concise protocol overview |
| [Invariants](invariants.md) | Protocol invariants and guarantees |
| [Existing Contracts](existing-contracts.md) | Deployed TBC token and NFT card addresses |
| [Versioning Policy](versioning-policy.md) | How versions are managed and released |

---

## Smart Contracts

| Document | Description |
|----------|-------------|
| [NFT Account Resolver](contracts/nft-account-resolver.md) | NFT-based account abstraction |
| [Payment Hub](contracts/payment-hub.md) | Core payment processing contract |
| [Collateral Signal](collateral-signal.md) | Collateral lookup and signaling |
| [Public Collateral Lookup](public-collateral-lookup.md) | On-chain collateral read interface |
| [Lending Adapter](lending-adapter.md) | External lending integration |
| [Merchant Payments](merchant-payments.md) | Merchant-facing payment flows |

---

## Merchant Integration

| Document | Description |
|----------|-------------|
| [Merchant API Spec](merchant-api-spec.md) | Full REST API specification |
| [Merchant API Security](merchant-api-security.md) | API security requirements |
| [Merchant Onboarding Guide](merchants/onboarding-guide.md) | Step-by-step merchant integration guide |

---

## Security

| Document | Description |
|----------|-------------|
| [Threat Model](security/THREAT_MODEL.md) | Full threat analysis |
| [Security Policy](security/SECURITY.md) | Internal security standards |
| [Audit Readiness](security/AUDIT_READINESS.md) | Checklist for external audits |
| [Testing Strategy](security/TESTING_STRATEGY.md) | Security testing approach |
| [Key Management](security/KEY_MANAGEMENT.md) | Key hierarchy and management procedures |
| [Incident Response](security/INCIDENT_RESPONSE.md) | Security incident response plan |
| [Attack Surface Diagram](attack-surface-diagram.md) | Visual attack surface overview |
| [Audit Architecture Diagrams](audit-architecture-diagrams.md) | Architecture for auditors |
| [Audit Scope](audit-scope.md) | What is in/out of audit scope |
| [Audit Notes](audit-notes.md) | Known limitations and accepted risks |
| [Full System Audit](audit/FULL_SYSTEM_AUDIT.md) | Comprehensive audit documentation |
| [External Audit Intro](audit/external-audit-intro.md) | Guidance for external auditors |

---

## Governance

| Document | Description |
|----------|-------------|
| [DAO Governance](dao-governance.md) | TBC Diamonds DAO governance framework |
| [Governance Process](governance-process.md) | Proposal and voting process |
| [Governance Transparency](governance-transparency.md) | Transparency commitments |
| [Governance Transparency Privacy](governance-transparency-privacy.md) | Privacy within transparency |
| [Governance Transparency Verification](governance-transparency-verification.md) | Verification mechanisms |
| [Governance Release Notes](governance-release-notes.md) | Governance decisions history |
| [Governance Incident Response](governance/INCIDENT_RESPONSE.md) | Governance-level incident handling |
| [Governance Release Notes v1](governance/release-notes-v1.md) | Protocol v1 governance release notes |

---

## Compliance

| Document | Description |
|----------|-------------|
| [Regulatory Map](compliance/REGULATORY_MAP.md) | Regulatory landscape overview |
| [Legal Risk Model](compliance/LEGAL_RISK_MODEL.md) | Legal risk analysis |
| [Merchant Compliance Guide](compliance/MERCHANT_COMPLIANCE_GUIDE.md) | Compliance guidance for merchants |

---

## Economics

| Document | Description |
|----------|-------------|
| [Economic Simulations](economics/SIMULATIONS.md) | Token economics and flow simulations |

---

## Operations & Production

| Document | Description |
|----------|-------------|
| [SLA](production/SLA.md) | Service level agreement |
| [Monitoring](production/MONITORING.md) | Monitoring and alerting setup |
| [B3 — Monitoring engagement](production/B3-monitoring/ENGAGEMENT.md) | Production monitoring rollout (alert rules, dashboards, drill brief) |
| [On-call rotation](production/on-call.md) | Primary/secondary roster, escalation, secondary contact path |
| [Network Matrix](deployments/network-matrix.md) | Deployment network configuration |
| [Protocol Registry](registry/protocol-registry.md) | On-chain protocol registry entries |

---

## Cross-Chain Bridge (F3)

| Document | Description |
|----------|-------------|
| [Supported Chains](bridge/SUPPORTED_CHAINS.md) | Priority chains (Ethereum, BSC, Polygon), constants and rollout plan |
| [Validators](bridge/VALIDATORS.md) | 5-of-9 validator set, BLS aggregation, governance handover |
| [Replay Protection](bridge/REPLAY_PROTECTION.md) | Canonical hash, intent state machine, anti-replay guarantees (T-RP-1..T-RP-5) |
| [Circuit Breakers](bridge/CIRCUIT_BREAKERS.md) | TVL/outflow caps, auto-pause rules (AP-1..AP-5), DR drills |
| [Contract Hardening](bridge/CONTRACT_HARDENING.md) | Hardening backlog (CH-1..CH-7) and CI guardrails (R-CH-1..R-CH-5) |
| [Bridge Monitoring](bridge/MONITORING.md) | Alert catalogue BR-M01..BR-M20 and B3 integration |
| [Bridge Bug Bounty](bridge/BUG_BOUNTY.md) | Bridge-specific bounty tiers and A5 integration |

---

## Integrations

| Document | Description |
|----------|-------------|
| [External Guarantees](integrations/external-guarantees.md) | External service integration guarantees |
| [Wallet Compatibility](wallet-compatibility.md) | Supported TON Connect wallets and connection methods |

---

## Releases

| Document | Description |
|----------|-------------|
| [Protocol v1.0 Release](releases/protocol-v1.0.md) | Protocol v1.0 release documentation |
