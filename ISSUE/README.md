# Tonbankcard Protocol — Development Issues

This folder contains detailed, ready-to-implement issue specifications for the next phases of Tonbankcard Protocol development. All issues are derived from the [Development Roadmap](../TEMP/DEVELOPMENT_ROADMAP.md).

Each issue follows the project's [ISSUE_TEMPLATE](../ISSUE_TEMPLATE/) conventions.

---

## Issue Index

### Track A — Security & Audit ⚠️ Critical Priority

> Must be completed before any mainnet deployment.

| Issue | Title | Priority |
|-------|-------|----------|
| [A1](./A1-formal-security-audit-core-contracts.md) | Formal Security Audit — Core Contracts | 🔴 Critical |
| [A2](./A2-formal-security-audit-phase4-contracts.md) | Formal Security Audit — Phase 4 Contracts | 🔴 Critical |
| [A3](./A3-formal-verification-protocol-invariants.md) | Formal Verification of Protocol Invariants | 🟠 High |
| [A4](./A4-penetration-testing-offchain-services.md) | Penetration Testing — Off-Chain Services | 🟠 High |
| [A5](./A5-bug-bounty-program.md) | Bug Bounty Program | 🟡 Medium |

---

### Track B — Production Deployment & Operations

| Issue | Title | Priority |
|-------|-------|----------|
| [B1](./B1-testnet-deployment-and-validation.md) | Testnet Deployment & Validation | 🟠 High |
| [B2](./B2-mainnet-deployment-plan.md) | Mainnet Deployment Plan | 🟠 High |
| [B3](./B3-production-monitoring-and-alerting.md) | Production Monitoring & Alerting | 🟡 Medium |
| [B4](./B4-infrastructure-as-code.md) | Infrastructure as Code | 🟡 Medium |
| [B5](./B5-database-migration-strategy.md) | Database Migration Strategy | 🟡 Medium |

---

### Track C — Ecosystem & Developer Experience

| Issue | Title | Priority |
|-------|-------|----------|
| [C1](./C1-public-documentation-site.md) | Public Documentation Site | 🟡 Medium |
| [C2](./C2-sdk-developer-experience.md) | SDK Developer Experience Improvements | 🟡 Medium |
| [C3](./C3-test-sandbox-environment.md) | Test Sandbox Environment | 🟡 Medium |
| [C4](./C4-developer-quickstart-improvements.md) | Developer Quickstart Improvements | 🟢 Low |
| [C5](./C5-sdk-client-libraries-other-languages.md) | SDK Client Libraries for Other Languages | 🟢 Low |

---

### Track D — Protocol Maturity & Hardening

| Issue | Title | Priority |
|-------|-------|----------|
| [D1](./D1-test-coverage-improvements.md) | Test Coverage Improvements | 🟠 High |
| [D2](./D2-contract-gas-optimization.md) | Contract Gas Optimization | 🟡 Medium |
| [D3](./D3-error-handling-standardization.md) | Error Handling Standardization | 🟡 Medium |
| [D4](./D4-rate-limiting-ddos-protection.md) | Rate Limiting & DDoS Protection | 🟠 High |
| [D5](./D5-dependency-audit-and-updates.md) | Dependency Audit and Updates | 🟠 High |

---

### Track E — Governance & Decentralization

> Pursue after Tracks A–C are substantially complete.

| Issue | Title | Priority |
|-------|-------|----------|
| [E1](./E1-dao-governance-activation.md) | DAO Governance Activation | 🟡 Medium |
| [E2](./E2-protocol-parameter-governance.md) | Protocol Parameter Governance | 🟡 Medium |
| [E3](./E3-risk-authority-decentralization.md) | Risk Authority Decentralization | 🟡 Medium |
| [E4](./E4-onchain-transparency-reporting.md) | On-Chain Transparency Reporting | 🟢 Low |

---

### Track F — Advanced Features & Expansion

> Pursue only after Tracks A–D are substantially complete and the protocol is in production.

| Issue | Title | Priority |
|-------|-------|----------|
| [F1](./F1-ton-connect-deep-integration.md) | TON Connect Deep Integration | 🟢 Low |
| [F2](./F2-mobile-app-wrapper.md) | Mobile App Wrapper | 🟢 Low |
| [F3](./F3-crosschain-bridge-production-readiness.md) | Cross-Chain Bridge Production Readiness | 🟢 Low |
| [F4](./F4-recurring-payments-activation.md) | Recurring Payments Activation | 🟢 Low |
| [F5](./F5-multisig-card-activation.md) | Multi-Sig Card Activation | 🟢 Low |
| [F6](./F6-additional-dex-integrations.md) | Additional DEX Integrations | 🟢 Low |
| [F7](./F7-analytics-and-reporting.md) | Analytics & Reporting | 🟢 Low |

---

## Recommended Execution Order

```
Phase 5 — Production Readiness (Immediate)
├── A1. Audit — Core Contracts
├── B1. Testnet Deployment
├── D1. Test Coverage
├── D5. Dependency Audit
└── B4. Infrastructure as Code

Phase 6 — Ecosystem Growth (3–6 months post-audit)
├── A2. Audit — Phase 4 Contracts
├── B2. Mainnet Deployment
├── C1. Documentation Site
├── C2. SDK Developer Experience
├── B3. Production Monitoring
└── D4. Rate Limiting & Auth

Phase 7 — Governance Activation (6–12 months post-mainnet)
├── E1. DAO Governance Activation
├── E2. Protocol Parameter Governance
├── E3. Risk Authority Decentralization
├── A5. Bug Bounty Program
└── A3. Formal Verification

Phase 8 — Expansion (12+ months)
├── F1. TON Connect Deep Integration
├── F3. Cross-Chain Bridge Production
├── F4. Recurring Payments Activation
├── F5. Multi-Sig Card Activation
└── F2. Mobile App Wrapper
```

---

## Contributing

All issues in this folder follow the contribution workflow defined in [CONTRIBUTING.md](../CONTRIBUTING.md):

1. Open a GitHub Issue referencing the relevant file in this folder
2. Implement on a feature branch (`issue-{N}-{description}`)
3. Submit a PR with all CI checks passing

All contributions must maintain the **non-custodial guarantee** — no admin fund controls, no private key storage, no forced transfers.
