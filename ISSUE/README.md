# Tonbankcard Protocol — Development Issues

This folder contains detailed, ready-to-implement issue specifications for the next phases of Tonbankcard Protocol development. Most issues are derived from the [Development Roadmap](../TEMP/DEVELOPMENT_ROADMAP.md); D6 was added after reviewer feedback to evaluate Acton/Tolk tooling before standardizing future contract workflows.

Each issue follows the project's [ISSUE_TEMPLATE](../ISSUE_TEMPLATE/) conventions.

The GitHub issues were published from these specifications on 2026-05-13. The files in this folder remain the canonical implementation specs; the GitHub issues are the execution tracker.

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
| [D6](./D6-acton-toolchain-evaluation.md) | Acton Toolchain Evaluation | 🟡 Medium |

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

## Published GitHub Issues

| Track | Spec | GitHub Issue |
|-------|------|--------------|
| A | [A1](./A1-formal-security-audit-core-contracts.md) | [#112](https://github.com/xlabtg/tonbankcard-protocol/issues/112) |
| A | [A2](./A2-formal-security-audit-phase4-contracts.md) | [#113](https://github.com/xlabtg/tonbankcard-protocol/issues/113) |
| A | [A3](./A3-formal-verification-protocol-invariants.md) | [#114](https://github.com/xlabtg/tonbankcard-protocol/issues/114) |
| A | [A4](./A4-penetration-testing-offchain-services.md) | [#115](https://github.com/xlabtg/tonbankcard-protocol/issues/115) |
| A | [A5](./A5-bug-bounty-program.md) | [#116](https://github.com/xlabtg/tonbankcard-protocol/issues/116) |
| B | [B1](./B1-testnet-deployment-and-validation.md) | [#117](https://github.com/xlabtg/tonbankcard-protocol/issues/117) |
| B | [B2](./B2-mainnet-deployment-plan.md) | [#118](https://github.com/xlabtg/tonbankcard-protocol/issues/118) |
| B | [B3](./B3-production-monitoring-and-alerting.md) | [#119](https://github.com/xlabtg/tonbankcard-protocol/issues/119) |
| B | [B4](./B4-infrastructure-as-code.md) | [#120](https://github.com/xlabtg/tonbankcard-protocol/issues/120) |
| B | [B5](./B5-database-migration-strategy.md) | [#121](https://github.com/xlabtg/tonbankcard-protocol/issues/121) |
| C | [C1](./C1-public-documentation-site.md) | [#122](https://github.com/xlabtg/tonbankcard-protocol/issues/122) |
| C | [C2](./C2-sdk-developer-experience.md) | [#123](https://github.com/xlabtg/tonbankcard-protocol/issues/123) |
| C | [C3](./C3-test-sandbox-environment.md) | [#124](https://github.com/xlabtg/tonbankcard-protocol/issues/124) |
| C | [C4](./C4-developer-quickstart-improvements.md) | [#125](https://github.com/xlabtg/tonbankcard-protocol/issues/125) |
| C | [C5](./C5-sdk-client-libraries-other-languages.md) | [#126](https://github.com/xlabtg/tonbankcard-protocol/issues/126) |
| D | [D1](./D1-test-coverage-improvements.md) | [#127](https://github.com/xlabtg/tonbankcard-protocol/issues/127) |
| D | [D2](./D2-contract-gas-optimization.md) | [#128](https://github.com/xlabtg/tonbankcard-protocol/issues/128) |
| D | [D3](./D3-error-handling-standardization.md) | [#129](https://github.com/xlabtg/tonbankcard-protocol/issues/129) |
| D | [D4](./D4-rate-limiting-ddos-protection.md) | [#130](https://github.com/xlabtg/tonbankcard-protocol/issues/130) |
| D | [D5](./D5-dependency-audit-and-updates.md) | [#131](https://github.com/xlabtg/tonbankcard-protocol/issues/131) |
| D | [D6](./D6-acton-toolchain-evaluation.md) | [#143](https://github.com/xlabtg/tonbankcard-protocol/issues/143) |
| E | [E1](./E1-dao-governance-activation.md) | [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132) |
| E | [E2](./E2-protocol-parameter-governance.md) | [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) |
| E | [E3](./E3-risk-authority-decentralization.md) | [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) |
| E | [E4](./E4-onchain-transparency-reporting.md) | [#135](https://github.com/xlabtg/tonbankcard-protocol/issues/135) |
| F | [F1](./F1-ton-connect-deep-integration.md) | [#136](https://github.com/xlabtg/tonbankcard-protocol/issues/136) |
| F | [F2](./F2-mobile-app-wrapper.md) | [#137](https://github.com/xlabtg/tonbankcard-protocol/issues/137) |
| F | [F3](./F3-crosschain-bridge-production-readiness.md) | [#138](https://github.com/xlabtg/tonbankcard-protocol/issues/138) |
| F | [F4](./F4-recurring-payments-activation.md) | [#139](https://github.com/xlabtg/tonbankcard-protocol/issues/139) |
| F | [F5](./F5-multisig-card-activation.md) | [#140](https://github.com/xlabtg/tonbankcard-protocol/issues/140) |
| F | [F6](./F6-additional-dex-integrations.md) | [#141](https://github.com/xlabtg/tonbankcard-protocol/issues/141) |
| F | [F7](./F7-analytics-and-reporting.md) | [#142](https://github.com/xlabtg/tonbankcard-protocol/issues/142) |

---

## Recommended Execution Order

```
Phase 5 — Production Readiness (Immediate)
├── A1. Audit — Core Contracts
├── B1. Testnet Deployment
├── D1. Test Coverage
├── D5. Dependency Audit
├── B4. Infrastructure as Code
└── D6. Acton Toolchain Evaluation

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

## Tooling Note — Acton

Acton is a Tolk-first TON smart contract toolchain with native tests, fuzzing, mutation testing, coverage, gas snapshots, deployment, verification, and CI support. The current repository is primarily Tact/FunC with TypeScript tests and deployment scripts, so Acton must be evaluated before it becomes required project tooling.

Use [D6](./D6-acton-toolchain-evaluation.md) to decide whether Acton should remain experimental, be adopted for new Tolk modules only, support selected FunC migration work, or require a broader architecture decision. Until D6 is accepted, existing Tact/FunC + TypeScript workflows remain authoritative.

---

## Contributing

All issues in this folder follow the contribution workflow defined in [CONTRIBUTING.md](../CONTRIBUTING.md):

1. Pick one of the published GitHub issues above and use the corresponding file in this folder as the scope definition
2. Implement on a feature branch (`issue-{N}-{description}`)
3. Submit a PR with all CI checks passing

All contributions must maintain the **non-custodial guarantee** — no admin fund controls, no private key storage, no forced transfers.
