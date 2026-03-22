# Tonbankcard Protocol — Development Roadmap

**Date**: 2026-03-22
**Based on**: Repository analysis at commit `0c54950`
**Related to**: Issue #86

---

## Executive Summary

The Tonbankcard Protocol has successfully completed all four planned development phases. The codebase is feature-complete at the implementation level. The next logical development steps focus on **production readiness, ecosystem maturity, and long-term sustainability** — moving the protocol from a well-built codebase to a production-grade, battle-tested, and adopted financial infrastructure.

The roadmap is organized into six tracks:

1. **Track A — Security & Audit** (highest priority)
2. **Track B — Production Deployment & Operations**
3. **Track C — Ecosystem & Developer Experience**
4. **Track D — Protocol Maturity & Hardening**
5. **Track E — Governance & Decentralization**
6. **Track F — Advanced Features & Expansion**

---

## Track A — Security & Audit ⚠️ Critical Priority

All Phase 4 contracts and the core Phase 2 contracts require formal security review before production use. This track must be completed before any mainnet deployments.

### A1. Formal Security Audit — Core Contracts
**Scope**: `contracts/payments/PaymentHub.tact`, `contracts/MerchantPaymentHub.tact`, `contracts/payments/account-locks.fc`, `contracts/nft-resolver/`

**Actions**:
- Engage a TON-specialist audit firm (e.g., Trail of Bits, CertiK, or TON-ecosystem-specific auditors)
- Prepare audit package: contracts + documentation + `docs/security/AUDIT_READINESS.md`
- Address all findings (Critical/High mandatory, Medium recommended)
- Publish audit reports publicly

**Deliverables**: Audit report, remediation PR, public disclosure

---

### A2. Formal Security Audit — Phase 4 Contracts
**Scope**: `CrossChainBridge.tact`, `MultiSigCard.tact`, `RecurringPayments.tact`, `LendingProtocolCoordinator.tact`

**Actions**:
- Phase 4 contracts are higher risk (cross-chain bridge, multi-sig flows)
- Separate audit engagement from core contracts
- Cross-chain bridge requires special attention to message replay and bridge validator compromise scenarios

**Deliverables**: Separate audit report for Phase 4, remediation PRs

---

### A3. Formal Verification of Protocol Invariants
**Scope**: Critical invariants I1–I7 defined in `docs/invariants.md`

**Actions**:
- Explore TLA+ or Lean 4 formal proofs for key invariants
- At minimum, machine-verified property tests for I4 (atomicity) and I7 (lock enforcement)
- Integrate formal verification tooling into CI (e.g., `@ton/blueprint` property-based tests)

**Deliverables**: Formal verification report or property test suite

---

### A4. Penetration Testing — Off-Chain Services
**Scope**: `api/`, `backend/indexer/`, `sdk/`

**Actions**:
- API security review: OWASP Top 10, rate limiting, CORS, authentication
- Indexer: replay attack prevention, data integrity validation
- SDK: supply chain security (npm audit), dependency pinning

**Deliverables**: Pentest report, remediation PRs

---

### A5. Bug Bounty Program
**Actions**:
- Set up Immunefi or HackenProof bug bounty program
- Define scope (smart contracts as highest severity, APIs as medium)
- Set reward tiers aligned with severity (Critical: $10K+, High: $5K, Medium: $1K)
- Reference `SECURITY.md` for initial framework

**Deliverables**: Live bug bounty program, updated `SECURITY.md`

---

## Track B — Production Deployment & Operations

### B1. Testnet Deployment & Validation
**Actions**:
- Deploy all Phase 2 and Phase 4 contracts to TON testnet
- Run end-to-end integration tests against deployed testnet contracts
- Validate all adapters (`backend/adapters/`) against testnet gateway sandboxes
- Update `docs/existing-contracts.md` with testnet addresses

**Deliverables**: Deployed testnet contracts, updated contract address registry

---

### B2. Mainnet Deployment Plan
**Actions**:
- Define deployment order (dependencies: NFT resolver → Payment Hub → Merchant Hub)
- Create deployment runbook (`scripts/deploy/`)
- Multi-sig deployment: deployer keys should be multi-sig wallet, not a single key
- Deployment verification: on-chain state checks post-deployment
- Immutability verification: confirm no upgrade paths were introduced

**Deliverables**: Deployment runbook, multi-sig setup guide

---

### B3. Production Monitoring & Alerting
**Scope**: `docs/production/`

**Actions**:
- Implement blockchain event monitoring (block time, transaction failures, unusual volume)
- Set up alerting for: large outgoing transfers, account lock activity, bridge contract events
- Dashboard: Grafana or Datadog for indexer service metrics
- On-call rotation and incident response drill (using `docs/security/INCIDENT_RESPONSE.md`)

**Deliverables**: Monitoring setup, alerting runbook, on-call schedule

---

### B4. Infrastructure as Code
**Actions**:
- Containerize backend services (`api/`, `backend/indexer/`) with Docker
- Create `docker-compose.yml` for local development environment
- Helm charts or Terraform configs for production deployment
- Environment variable management (`schemas/` can define config schemas)

**Deliverables**: Dockerfile per service, docker-compose, IaC configs

---

### B5. Database Migration Strategy
**Actions**:
- `backend/indexer` uses both SQLite and PostgreSQL — formalize the migration strategy
- Create database schema documentation
- Add schema versioning and migration tooling (`npm run db:migrate` exists but needs docs)
- Backup and recovery procedures

**Deliverables**: DB migration guide, schema docs, backup runbook

---

## Track C — Ecosystem & Developer Experience

### C1. Public Documentation Site
**Actions**:
- Convert `docs/` markdown files into a hosted documentation site (e.g., Docusaurus, GitBook)
- Publish at `docs.tonbankcard.com` or equivalent
- Include: architecture guide, merchant integration guide, SDK reference, API reference
- Auto-generate API docs from TypeScript types in `sdk/src/types.ts`

**Deliverables**: Hosted documentation site, auto-generated SDK/API docs

---

### C2. SDK Developer Experience Improvements
**Scope**: `sdk/`

**Actions**:
- Publish `@tonbankcard/merchant-sdk` to npm registry (currently v1.0.0 but requires actual publishing)
- Add interactive examples in `examples/` directory (currently exists but may be sparse)
- Add SDK changelog (`sdk/CHANGELOG.md` referenced but may need updates)
- Provide React, Vue, and plain HTML integration examples
- Add Postman collection for the Merchant API

**Deliverables**: npm publish workflow, example integrations, Postman collection

---

### C3. Test Sandbox Environment
**Actions**:
- Create a public testnet sandbox that merchants can use for integration testing
- Provide test TBC tokens via a faucet
- Mock gateway endpoints (ChangeNOW, NOWPayments sandbox modes)
- Reference environment variables in SDK documentation

**Deliverables**: Public testnet sandbox, faucet script, sandbox documentation

---

### C4. Developer Quickstart Improvements
**Actions**:
- Create a `make` or `npm run setup` script that installs all 6 packages with one command
- Add `devcontainer.json` for GitHub Codespaces support
- Add example merchant integration app (`examples/merchant-demo/`)
- Video walkthrough of local development setup

**Deliverables**: One-command setup script, devcontainer, demo app

---

### C5. SDK Client Libraries for Other Languages
**Actions** (medium-term):
- Python SDK (`@tonbankcard/merchant-sdk` equivalent) for backend merchants
- Go SDK for high-performance integrations
- Auto-generate from OpenAPI spec if Merchant API has one (check `docs/merchant-api-spec.md`)

**Deliverables**: OpenAPI spec, Python SDK (priority), Go SDK

---

## Track D — Protocol Maturity & Hardening

### D1. Test Coverage Improvements
**Current state**: 70-80% threshold set but actual coverage unknown.

**Actions**:
- Run coverage reports for all packages and identify gaps
- Priority targets: `sdk/src/sdk.ts`, `api/src/services/InvoiceService.ts`, `backend/indexer/src/`
- Add adversarial test cases in `tests/adversarial/` (replay attacks, race conditions, double-spend attempts)
- Add fuzz testing for critical contract functions

**Deliverables**: Coverage report, test gap analysis, new test files

---

### D2. Contract Gas Optimization
**Actions**:
- Profile gas usage for common operations (internal transfer, lock set/unset, NFT resolution)
- Optimize high-frequency paths in `PaymentHub.tact`
- Document gas costs in contract README files
- Set gas cost budget targets per operation

**Deliverables**: Gas usage report, optimization PRs, gas cost documentation

---

### D3. Error Handling Standardization
**Actions**:
- Audit all error codes in Tact contracts (exit codes should be documented)
- Standardize error response format in `api/src/`
- Add structured error logging in `backend/indexer/` (pino already used, ensure consistency)
- Create error code reference in `docs/`

**Deliverables**: Error code registry, standardized error handling PRs

---

### D4. Rate Limiting & DDoS Protection
**Scope**: `api/`, `backend/indexer/`

**Actions**:
- Add request rate limiting to Merchant API (e.g., `express-rate-limit`)
- Add API key authentication for merchant endpoints
- Implement webhook signature verification (HMAC-SHA256)
- Document authentication requirements in `docs/merchant-api-spec.md`

**Deliverables**: Rate limiting implementation, API auth system, webhook verification

---

### D5. Dependency Audit and Updates
**Actions**:
- Run `npm audit` across all 6 packages
- Pin critical dependency versions (prevent supply-chain attacks)
- Set up Dependabot or Renovate for automated dependency PRs
- Review and update Node.js version constraints (currently >=18.0.0)

**Deliverables**: Dependency audit report, `.github/dependabot.yml`, update PRs

---

## Track E — Governance & Decentralization

### E1. DAO Governance Activation
**Scope**: `contracts/governance/` (ProposalRegistry, SnapshotVerifier, TransparencyRegistry)

**Actions**:
- Deploy governance contracts to testnet after audit
- Define initial governance parameters: quorum, voting period, proposal threshold
- Create voter snapshot methodology (NFT-weighted or TBC-weighted)
- Publish governance activation proposal per `docs/governance-process.md`

**Deliverables**: Deployed governance contracts, governance activation proposal

---

### E2. Protocol Parameter Governance
**Actions**:
- Identify protocol parameters that should be governed (e.g., whitelisted NFT collections in PaymentHub)
- Create governance proposal for parameter change process
- Ensure no single key can change parameters without governance vote
- Document parameters in `docs/governance/`

**Deliverables**: Governable parameters list, parameter governance proposal

---

### E3. Risk Authority Decentralization
**Current state**: FRAUD_LOCK is set by a "Risk Authority" (implementation detail)

**Actions**:
- Define the Risk Authority governance structure
- Transition from single Risk Authority key to multi-sig or DAO-controlled
- Document the fraud detection criteria and lock appeal process
- Publish transparency reports via TransparencyRegistry

**Deliverables**: Risk Authority governance proposal, transparency report template

---

### E4. On-Chain Transparency Reporting
**Scope**: `contracts/governance/TransparencyRegistry.tact`

**Actions**:
- Implement regular on-chain transparency reports via TransparencyRegistry
- Track: total active accounts, total TBC transferred, lock activity, governance votes
- Build transparency dashboard using existing indexer infrastructure
- Quarterly public transparency reports

**Deliverables**: Transparency reporting schedule, dashboard, first quarterly report

---

## Track F — Advanced Features & Expansion

> These features should only be pursued after Tracks A–C are substantially complete and the core protocol is in production.

### F1. TON Connect Deep Integration
**Actions**:
- Full TON Connect v2 integration in `wallet-ui/`
- Support for all major TON wallets (Tonkeeper, Tonhub, OpenMask)
- Deep link generation for mobile wallet signing
- QR code payment flow for point-of-sale use cases

**Deliverables**: TON Connect integration, wallet compatibility matrix

---

### F2. Mobile App Wrapper
**Current state**: `mobile/` contains platform-agnostic core logic only.

**Actions**:
- Build React Native wrapper around `@tonbankcard/mobile-core`
- iOS and Android builds
- Integrate TON Connect mobile SDK
- App Store / Google Play submission

**Deliverables**: React Native app, App Store listing

---

### F3. Cross-Chain Bridge Production Readiness
**Scope**: `contracts/CrossChainBridge.tact`

**Actions** (requires A2 audit first):
- Define supported chains (ETH, BSC, Polygon priority)
- Bridge validator set design (multi-sig with rotating validators)
- Replay protection implementation and verification
- Bridge TVL monitoring and circuit breakers
- Bridge-specific bug bounty category

**Deliverables**: Bridge production specification, validator onboarding guide

---

### F4. Recurring Payments Activation
**Scope**: `contracts/RecurringPayments.tact`

**Actions** (requires A2 audit first):
- Define subscription tiers and payment schedule formats
- Merchant dashboard integration for subscription management
- User notification system for upcoming recurring payments
- Cancel/pause/resume subscription UX

**Deliverables**: Recurring payments production spec, subscription dashboard

---

### F5. Multi-Sig Card Activation
**Scope**: `contracts/MultiSigCard.tact`

**Actions** (requires A2 audit first):
- Define M-of-N threshold models (2-of-3, 3-of-5)
- Corporate account use case: multiple signers per card
- UX for multi-sig approval flows in `wallet-ui/`
- Guardian recovery mechanisms

**Deliverables**: Multi-sig production spec, multi-sig wallet UI

---

### F6. Additional DEX Integrations
**Current state**: TONCO DEX only.

**Actions**:
- Add DeDust DEX integration for additional TBC liquidity
- Multi-DEX price aggregation for best swap rates
- Slippage protection improvements
- Liquidity depth monitoring

**Deliverables**: DeDust adapter, price aggregator module

---

### F7. Analytics & Reporting
**Actions**:
- Build analytics layer on top of the indexer
- Merchant analytics: payment volume, conversion rates, chargeback rates
- Protocol-level analytics: total value transferred, active accounts, lock events
- Public analytics dashboard (non-custodial, privacy-preserving)

**Deliverables**: Analytics service, merchant analytics dashboard, public protocol stats

---

## Prioritized Execution Order

Based on risk, dependencies, and impact, the recommended execution sequence is:

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

## Key Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Smart contract vulnerability | Critical | Formal audit (Track A) |
| Bridge validator compromise | Critical | Multi-sig validator set, circuit breakers |
| Single Risk Authority key | High | Transition to multi-sig (Track E) |
| Off-chain service availability | Medium | Redundant indexer deployment, SLA targets |
| External gateway downtime | Medium | Fallback gateway routing, user notifications |
| Dependency supply chain attack | Medium | Dependency pinning, Dependabot (Track D) |
| Low developer adoption | Medium | Documentation site, SDK improvements (Track C) |
| Regulatory action | Low-Medium | Compliance framework in `docs/compliance/` |

---

## Contributing to the Roadmap

All roadmap items should follow the standard contribution workflow:

1. Open a GitHub Issue describing the specific work item
2. Reference this roadmap document in the Issue
3. Implement on a feature branch (`issue-{N}-{description}`)
4. Submit a PR following `CONTRIBUTING.md` guidelines
5. Ensure all CI checks pass

All changes must maintain the **non-custodial guarantee** — no admin fund controls, no private key storage, no forced transfers.

---

*This roadmap is a living document. It should be updated as the protocol evolves, audits complete, and the community provides feedback.*

*Generated for Issue #86 — See [REPOSITORY_ANALYSIS.md](REPOSITORY_ANALYSIS.md) for the full repository analysis.*
