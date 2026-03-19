# Changelog

All notable changes to the Tonbankcard Protocol repository are documented here.

This project follows [Semantic Versioning](https://semver.org/).

For SDK-specific changes, see [sdk/CHANGELOG.md](sdk/CHANGELOG.md).

---

## [Unreleased]

### Added
- `LICENSE` file (MIT) at repository root
- `docs/INDEX.md` — central navigation index for all documentation
- `CODE_OF_CONDUCT.md` — community standards and contributor expectations
- `.github/PULL_REQUEST_TEMPLATE.md` — standardized pull request template
- `tests/future/` directory for planned adversarial test scenarios

### Changed
- Standardized security contact email to `security@tonbankcard.com` across all docs
- Updated license references from "TBD" to MIT in all contract and doc READMEs
- Updated `README.md` license badge and section to reference `LICENSE` file
- Resolved "coming soon" placeholder in `sdk/SECURITY.md`
- Resolved `(TBD)` placeholders in `docs/dao-governance.md` governance channels

---

## [1.0.0] — 2026-03-19

### Protocol v1.0 — Initial Public Release

This release represents the first public version of the Tonbankcard Protocol repository, establishing the foundational architecture, documentation, and tooling.

#### Contracts

- **Payment Hub** (`contracts/payments/PaymentHub.tact`) — Core payment processing with NFT-based account abstraction, account state machine (ACTIVE/LOCKED/FRAUD_LOCK/FROZEN), internal TBC transfers, and merchant payment flows
- **NFT Account Resolver** (`contracts/nft-resolver/`) — On-chain NFT ownership resolution for account abstraction
- **Collateral Lookup** (`contracts/collateral-lookup/`) — Public read interface for collateral signaling to external lending protocols
- **Governance Contracts** (`contracts/governance/`) — Snapshot verifier, proposal registry, and transparency registry for DAO coordination
- **Contract Interfaces** (`contracts/interfaces/`) — Tact interfaces: `IAccountStateMachine`, `IAccountLocks`, `ICollateralSignal`, `INFTResolver`, `IPublicCollateralLookup`, `IVersionMetadata`

#### Backend

- **Blockchain Indexer** (`backend/indexer/`) — TON blockchain event indexer with TypeScript, Express API, PostgreSQL persistence, and payment state tracking
- **Adapters** (`backend/adapters/`) — Integration adapters for ChangeNOW, NOWPayments, and CoinRabbit gateways

#### SDK

- **Merchant SDK** (`sdk/`) — TypeScript SDK for merchant integration, invoice creation, payment status checking, and on-chain settlement verification (v1.0.0, published to npm)

#### API

- **Reference API** (`api/`) — Reference implementation of the Merchant REST API

#### Documentation

- Whitepaper v1 and Litepaper v1
- Full security documentation: threat model, key management, incident response, audit readiness
- Merchant API specification and onboarding guide
- DAO governance framework
- Compliance and regulatory guidance
- Economic simulations
- Production operations: SLA and monitoring documentation

#### Testing

- Comprehensive test suite covering: payment hub, merchant payments, collateral signal, governance, NFT resolver, account locks, lending adapter, versioning, and adversarial scenarios
- Payment hub acceptance criteria tests
- Collateral lookup acceptance criteria tests

#### CI/CD

- GitHub Actions workflow with build, lint, typecheck, and test jobs
- SDK and backend/indexer validation in CI

---

## Prior Work

Earlier protocol development occurred via issues and pull requests tracked at
[github.com/xlabtg/tonbankcard-protocol](https://github.com/xlabtg/tonbankcard-protocol).

For a full history, see [git log](https://github.com/xlabtg/tonbankcard-protocol/commits/main).
