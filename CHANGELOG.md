# Changelog

All notable changes to the Tonbankcard Protocol repository are documented here.

This project follows [Semantic Versioning](https://semver.org/).

For SDK-specific changes, see [sdk/CHANGELOG.md](sdk/CHANGELOG.md).

---

## [Unreleased]

### Added — E1 DAO Governance Activation (Issue #132)
- **Initial governance parameters** (`docs/governance/PARAMETERS.md`): 13-row parameter table P-1 … P-13 ratifying voting period = 7 days (604 800 s), quorum = 22 votes (~10% of 222 NFTs), proposal threshold = 1 NFT, decision rule = simple majority on non-abstain, off-chain implementation cooldown ≥ 48 h, with a cross-walk to `ProposalRegistry.tact` constants enforced by `scripts/governance/verify-parameters.ts`
- **Voter snapshot methodology** (`docs/governance/SNAPSHOT.md`): NFT-only eligibility model with TEP-62 `get_nft_data()` owner resolution, 24-hour Phase-1 cool-down between proposal draft and snapshot block, deterministic eligibility map pseudocode, exclusion list (burn / collection / custodial DEX wallets), and the `SnapshotVerifier.RegisterSnapshot` → `ProposalRegistry.SubmitProposal` ordering rule that neutralises the contract's permissive `isEligible` fallback
- **Engagement package** (`docs/governance/E1-activation/`): `ENGAGEMENT.md`, `STATUS.md`, `RUNBOOK.md`, `TESTNET_VALIDATION.md`, `ACTIVATION_PROPOSAL.md`, `MANIFEST_TEMPLATE.json` — mirrors the B1/B2/B3 pattern with upstream gates G-1 … G-10, a six-phase plan, and an `ACTIVATED-LIVE` verdict that requires both a clean testnet round-trip (`E1-PROP-000-testnet`) and `ACCEPTED` first mainnet proposal (`E1-PROP-001`)
- **Mainnet activation runbook** (`docs/governance/E1-activation/RUNBOOK.md`): pre-flight checks, staging dry-run, anti-foot-gun rules AF-E1-1 … AF-E1-10, multi-sig `set_registry` ceremony reusing the B2 signers, atomic `network-matrix.md` flip, first proposal submission protocol, 48-hour off-chain implementation cooldown gate, and CRITICAL/HIGH/MEDIUM/LOW failure-mode response table
- **Activation manifest schema** (`docs/governance/E1-activation/MANIFEST_TEMPLATE.json`): append-only JSON Schema for `docs/governance/E1-activation/activations/<timestamp>.json` recording G-1 … G-10 evidence, the single mainnet `set_registry` transaction (with sender/recipient/value/body anti-foot-gun constraints), indexer activation state, post-binding verification, reviewer attestation, and the matching `network-matrix.md` before/after diff
- **First governance proposal text** (`docs/governance/E1-activation/ACTIVATION_PROPOSAL.md`): `E1-PROP-001` canonical wording — category `0` (ROADMAP_SIGNAL), 7-day voting window, 22-vote quorum, simple-majority decision rule, FOR/AGAINST/ABSTAIN options, IPFS metadata pin, post-finalisation operational note (14-day report, 48-h cooldown, no rollback primitive)
- **Testnet round-trip validation plan** (`docs/governance/E1-activation/TESTNET_VALIDATION.md`): 12-step propose → snapshot → vote → finalise → mirror exercise on TON testnet with three holder wallets, privacy assertions (no `voter_nft_id` in `VoteCast` payloads), audit-script verdict, and the `min(22, testnet_supply)` quorum override that lets the round-trip actually finalise as `ACCEPTED`

### Added — B3 Production Monitoring & Alerting (Issue #119)
- **Engagement package** (`docs/production/B3-monitoring/`): `ENGAGEMENT.md`, `STATUS.md`, `STACK_SELECTION.md`, `ALERT_RULES.md`, `DASHBOARDS.md`, `METRICS_INSTRUMENTATION.md`, `IMPLEMENTATION_RUNBOOK.md`, `INCIDENT_DRILL.md` — mirrors the B1/B2 pattern with upstream gates G-1 … G-8 and a `MONITORING-LIVE` verdict gated on a 24-hour soak window
- **Alert-rule catalogue** (`docs/production/B3-monitoring/ALERT_RULES.md` + `provisioning/prometheus/alerts.yml`): R-001 … R-019 covering indexer health, Merchant API health, funds-risk signals (large transfers, fraud-lock bursts, unusual TBC volume), governance events, gateway-adapter reachability, and the bridge alert that stays inert until A2 verdict + mainnet bridge deployment
- **Recording rules** (`provisioning/prometheus/recording.yml`): 24h transfer-volume baseline for R-012, API quantiles for the dashboard, bounded-cardinality top-N of outgoing transfers per `METRICS_INSTRUMENTATION.md` §4
- **Alertmanager routing** (`provisioning/alertmanager/routes.yml`): severity-based routes (critical / warning / info), security-classified additional fanout to `#tonbankcard-security`, staging mute, and inhibition rules that prevent sub-rule noise when a parent service is down
- **Grafana dashboards** (`provisioning/grafana/operational-dashboard.json`, `security-dashboard.json`): operational view for the on-call rotation and security audit-trail view; bridge panel ships inert until A2
- **Metrics instrumentation contract** (`docs/production/B3-monitoring/METRICS_INSTRUMENTATION.md`): code-level contract for `/metrics` exporters in `backend/indexer/` and `api/`, with hard invariants (no contract calls, no private keys, bounded cardinality, authenticated `/metrics`)
- **Incident-response drill brief** (`docs/production/B3-monitoring/INCIDENT_DRILL.md` + `drills/0000-template.md`): three drill scenarios — indexer-lag injection, fraud-lock burst, API 5xx burst — with a 120-second notification SLA, idempotent rollback, and a post-mortem template that feeds back into `docs/security/INCIDENT_RESPONSE.md`
- **On-call rotation** (`docs/production/on-call.md`): minimum two-engineer rotation, escalation path with 15/30/45-minute thresholds, secondary contact path (Slack → email → Signal), and explicit list of authorised vs forbidden on-call actions

### Added — B2 Mainnet Deployment Plan (Issue #118)
- **Mainnet runbook** (`scripts/deploy/MAINNET_RUNBOOK.md`): step-by-step deployment ceremony with multi-sig discipline, env-var contract, dry-run gating, post-deploy verification, atomic doc-update PR, and roll-back semantics
- **Engagement package** (`docs/deployments/B2-mainnet/`): `ENGAGEMENT.md`, `STATUS.md`, `DEPLOYMENT_PLAN.md`, `MULTISIG_CEREMONY.md`, `VERIFICATION_PLAN.md`, `IMMUTABILITY_VERIFICATION.md`, `ROLLBACK_PROCEDURES.md`, `MANIFEST_TEMPLATE.json` — mirrors the B1-testnet pattern with mainnet-specific upstream gates G-1 … G-10
- **Three-layer immutability scanner** (`scripts/deploy/check-immutability.ts`): source-level forbidden-pattern scan, compiled-cell `SETCODE` opcode scan, and persistent-state schema check across all 10 in-scope Phase 2 + governance contracts
- **Extended `verifyInvariants` coverage** (`scripts/deploy/verify.ts`): the source-level scan now reaches `AccountStateMachine`, `CollateralSignal`, `PublicCollateralLookup`, `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` (previously only 4 of 10 contracts were scanned)
- **Placeholder mainnet protocol-contracts sections**: `docs/existing-contracts.md`, `docs/deployments/network-matrix.md`, and `README.md` carry `TBD` rows for each in-scope contract until the multi-sig ceremony completes; manifests remain append-only per `ROLLBACK_PROCEDURES.md` §3

### Added — Phase 3: User Experience (Issue #80)
- **Wallet UI** (`wallet-ui/`): Non-custodial wallet interface with balance view, transaction history, and account settings. Vanilla DOM rendering with light/dark theme support. Package: `@tonbankcard/wallet-ui` v1.0.0
- **Mobile App Core** (`mobile/`): Platform-agnostic TypeScript business logic layer for mobile apps. Includes AccountService, PaymentService, and SyncService. No DOM dependencies. Package: `@tonbankcard/mobile-core` v1.0.0
- **Merchant Dashboard** (`dashboard/`): Merchant portal with payment history, invoice link generation, statistics overview, and webhook management. Vanilla DOM with light/dark themes. Package: `@tonbankcard/merchant-dashboard` v1.0.0
- CI workflow updated with build, lint, test, and typecheck jobs for all three new packages
- Comprehensive test suites: 28 wallet-ui tests, 57 mobile-core tests, 47 dashboard tests

### Changed — Phase 3
- README: updated repository structure to include Phase 3 packages, Phase 3 checklist marked as complete

### Added — Phase 2: Payment Infrastructure (Issue #78)
- **Payment Hub contracts**: NFT collection whitelist verification, deployer access control for setup functions
- **Merchant API**: `package.json`, `tsconfig.json`, Express app entry point (`api/src/index.ts`)
- **Payment Widget**: Embeddable `TonbankcardPaymentWidget` with button and inline modes, light/dark themes
- **Backend Indexer**: TON HTTP API integration for block fetching (`/lookupBlock`, `/getBlockHeader`) and per-contract transaction syncing
- Integration tests for end-to-end payment flow (invoice creation, settlement, status verification)
- Widget unit tests covering mount/unmount, payment link generation, theming

### Changed
- `MerchantPaymentHub.tact`: deployer access control on all setup functions, removed unprotected `setup_account` handler
- `PaymentHub.tact`: `isValidAccountNFT()` now checks whitelisted collections instead of returning `true` unconditionally
- `InvoiceService.ts`: fixed duplicate `expiresAt` variable declaration
- README Phase 2 checklist marked as complete

### Previously Added
- `LICENSE` file (MIT) at repository root
- `docs/INDEX.md` — central navigation index for all documentation
- `CODE_OF_CONDUCT.md` — community standards and contributor expectations
- `.github/PULL_REQUEST_TEMPLATE.md` — standardized pull request template
- `tests/future/` directory for planned adversarial test scenarios

### Previously Changed
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
