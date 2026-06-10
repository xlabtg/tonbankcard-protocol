# Changelog

All notable changes to the Tonbankcard Protocol repository are documented here.

This project follows [Semantic Versioning](https://semver.org/).

For SDK-specific changes, see [sdk/CHANGELOG.md](sdk/CHANGELOG.md).

---

## [Unreleased]

### Changed — Security hardening: integrate ownership, Account Locks, and balance mutations into the FunC payment-hub reference (Issue #367)
- **Real NFT ownership verification (audit C-PHF-C1)** in `contracts/payments/payment-hub.fc`: the `get_nft_data_raw` placeholder that pretended to read NFT data synchronously is **removed**. Because synchronous cross-contract reads are impossible on TON, ownership is now resolved from a **resolver-gated, write-once `nft_owners` registry** — bindings are accepted only via `op::resolve_nft_owner` from the immutable `nft_resolver`, and `verify_nft_account()` rejects empty/`addr_none` owners with `owner.slice_bits() >= 267` so a placeholder owner can never satisfy an ownership check (mirrors the `nft_account_resolver.fc` hardening from #320). Preserves invariant **I2 (NFT Authority)**.
- **Account Locks integration (audit C-PHF-C2)**: the hub stores an immutable `account_locks_contract` and mirrors lock state pushed **only** by that address via `op::apply_account_lock` (the ApplyAccountLock push pattern introduced for MerchantPaymentHub in #363). `handle_internal_transfer()` and `handle_merchant_payment()` now call `can_send()` and throw `account_locked` (107) when the sender is locked, while `handle_payment_received()` stays unguarded so a locked account can always still RECEIVE — preserving invariant **I6 (Lock ≠ Confiscation)**.
- **Balance mutations (audit C-PHF-H1)**: both transfer handlers now atomically debit the sender and credit the recipient against an internal TBC ledger (`get_balance`/`set_balance` + `save_data`) and check `insufficient_balance` (103) **before** sending, instead of only emitting an event — preserving invariants **I4 (Atomic Transfers)** and **I1 (Non-Custodial)**. This also closes the `save_data`-omission fragility noted as C-PHF-H2 for the transfer paths.
- **The deploy blocker is deliberately retained as defence-in-depth.** `recv_internal` still throws `DEPLOY_BLOCKER_NOT_PRODUCTION_READY` (0xDEAD) as its first statement: `payment-hub.fc` is a **permanently non-deployable audit reference** and the production payment hub is `PaymentHub.tact` (CONTRACTS-H3 / #260). The issue's "remove the blocker" criterion is intentionally **not** applied; the three findings are resolved at the reference level so the file models the correct logic, and the blocker remains as a guardrail against accidental deployment.

### Added — FunC payment-hub reference tests and a blocker-coupled CI gate (Issue #367)
- **FunC reference test suite** (`contracts/payments/tests/payment-hub.spec.fc`): 10 unit/integration tests covering C-PHF-C1 (unregistered/placeholder owner rejected, resolver-gated registration, non-owner mismatch), C-PHF-C2 (`can_send` reflects the lock mirror, `apply_account_lock` is gated to `account_locks_contract`, a locked account can still RECEIVE), and C-PHF-H1 (internal-transfer and merchant-payment balance moves, the insufficient-balance precondition, and conservation of total supply). Like `account-locks.spec.fc`, it is a reference harness run with the FunC toolchain (there is no FunC compiler in CI).
- **Blocker-coupled CI gate** (`contracts/payment-hub/non-production-stubs.spec.ts`): the static regression guard now asserts the C-PHF-C1/C2/H1 hardening is present (resolver-gated ownership with the `slice_bits() >= 267` guard, the `account_locks_contract`-gated `apply_account_lock` with `can_send()` gating both transfer handlers, and the atomic debit/credit balance mutations), **and** that the file stays a non-deployable stub — the 0xDEAD constant is present, the file is listed in `NON_PRODUCTION_STUBS`, and the FunC reference suite exists and references C-PHF-C1/C2/H1. Per the reviewer's request on #367, this couples removing the deploy blocker to the integration coverage: the blocker cannot be dropped without the C-PHF-C1/C2/H1 tests being in place, or CI fails.
- **Documentation**: `audit/SMART_CONTRACTS_SECURITY_AUDIT.md` (C-PHF-C1/C2/H1 marked RESOLVED at reference level; remediation-status table and C-PHF-H2 updated) and `docs/security/THREAT_MODEL.md` (§2.1.1 status + integration note, §4.3.2 locked-account-bypass resolved, the threat/mitigation summary, the threat-to-invariant matrix, and the auditor checklist) updated to record that the reference now integrates ownership, Account Locks, and balance mutations while remaining non-deployable.

### Changed — Security hardening: resolver-gate NFT ownership in CollateralSignal before mainnet (Issue #364)
- **Removed the test-only `RegisterNFTOwner` backdoor from the deployable contract** (`contracts/CollateralSignal.tact`): the receive handler — gated only by the `deployer` recorded at `init()` and flagged by audit finding **X-1** (cross-cutting `RegisterNFTOwner*` test backdoors, the CollateralSignal instance of F-CRIT-2) — no longer exists in the production source. The `deployer` storage field that gated it is removed as well, so the deployer can no longer unilaterally seed the NFT authorisation map (invariant **I3 — No Admin Control**).
- **NFT ownership is now bound only by the trusted on-chain NFT Account Resolver**: the contract stores an immutable `nft_resolver` address (set once at `init(nft_resolver)`), and ownership is registered exclusively through the new `ResolveNFTOwner` receive handler, which requires `sender() == self.nft_resolver` (`"Unauthorized: only NFT resolver"`). This mirrors how Issue #363 replaced MerchantPaymentHub's admin `SetAccountLock` with the Account-Locks-contract-gated `ApplyAccountLock`.
- **The owner binding stays write-once (CONTRACTS-M1 / #279)**: `require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered")` — even the resolver cannot overwrite an existing binding.
- **Deployment dependency**: `CollateralSignal` now depends on `NFTAccountResolver` (its `init()` takes the resolver address); the deployment order in `scripts/deploy/README.md` and `scripts/deploy/deploy.ts` already places the resolver first.

### Added — CollateralSignal on-chain test suite and resolver-gating regression guard (Issue #364)
- **On-chain Jest suite** (`contracts/collateral-signal/collateral-signal.spec.ts`): 10 `@ton/sandbox` tests covering deploy wiring (immutable `nft_resolver`), resolver-gated registration (resolver succeeds; deployer and an arbitrary attacker are rejected — invariant I3), the write-once binding surviving a rejected overwrite (CONTRACTS-M1), and NFT-owner-only signal / update / release (a non-owner and an unregistered NFT cannot change signal state — invariants I1/I2).
- **Programmatic Tact build** (`contracts/collateral-signal/build.js`): compiles the production contract with the VFS rooted at `contracts/`.
- **Regression guard** (`contracts/payment-hub/non-production-stubs.spec.ts`): asserts the production source contains **no** `receive(msg: RegisterNFTOwner)`, no `self.deployer`, and no `(test-only)` marker, that ownership is registered only via the `nft_resolver`-gated `ResolveNFTOwner`, and that the write-once guard is intact — so a deployer-gated ownership path reintroduced into the mainnet contract fails CI.
- **CI wiring** (`.github/workflows/ci.yml`): the `Test (Contracts)` job now installs, builds, and runs the collateral-signal suite.
- **Documentation**: `audit/SMART_CONTRACTS_SECURITY_AUDIT.md` (X-1 CollateralSignal instance marked RESOLVED), `docs/security/THREAT_MODEL.md`, `docs/security/SECURITY.md`, `docs/audit/FULL_SYSTEM_AUDIT.md`, `docs/governance/PARAMETERS.md` (PP-36 resolved), `docs/error-codes.md`, and the deployment plans updated to match the hardened contract.

### Changed — Security hardening: remove test-only handlers from MerchantPaymentHub before mainnet (Issue #363)
- **Removed admin-mint backdoors from the deployable contract** (`contracts/MerchantPaymentHub.tact`): the `SetAccountState` and `SetAccountBalance` receive handlers — flagged by audit findings **C-MPH-C1** (admin-mint via `SetAccountBalance`) and **C-MPH-H1** (unsynced `nft_owners`) and violating invariants I1/I3/I5 — no longer exist in the production source. In production, account state and balance change **only** through the NFT-owner-authorised `MerchantPaymentRequest` flow (atomic debit/credit), with no admin write path.
- **Replaced `SetAccountLock` with an Account-Locks-gated `ApplyAccountLock`**: lock state is now accepted **only** from the configured `account_locks_contract` (set at `init`), never from the admin — preserving invariant **I3 (No Admin Fund Control)** and **I6 (Lock ≠ Confiscation)**. The admin can neither lock nor unlock balances directly.
- **`WhitelistMerchantCollection` is now behind a two-phase timelock**: `ProposeWhitelistCollection` → (7-day `MERCHANT_WHITELIST_TIMELOCK_DELAY`) → `ExecuteWhitelistCollection`, with `CancelWhitelistCollection`, all admin-gated — mirroring the existing two-phase admin-transfer pattern.
- **Shared logic kept single-source via a plain trait** (`MerchantPaymentHubBase`): the production `MerchantPaymentHub` and the test-only `MerchantPaymentHubHarness` both mix in the same trait, so they cannot drift. The harness (`contracts/merchant-hub/test/MerchantPaymentHubHarness.tact`) re-adds `SetAccountState` / `SetAccountBalance` (admin-gated, `(test-only)` message) solely to seed deterministic Jest scenarios and is listed in `NON_PRODUCTION_STUBS` so it can never be deployed.

### Added — MerchantPaymentHub on-chain test suite and build-fails-on-test-handlers guard (Issue #363)
- **On-chain Jest suite** (`contracts/merchant-hub/merchant-payment-hub.spec.ts`): 14 `@ton/sandbox` tests covering deploy wiring, harness bootstrap authorisation, NFT-owner-authorised merchant payments (atomic debit/credit; non-owner rejection leaves balances untouched), Account-Locks-gated lock application (admin rejected — I3; locked payer cannot send but funds are untouched — I6; unlock restores), the 7-day collection-whitelist timelock, and the 7-day two-phase admin transfer.
- **Programmatic Tact build** (`contracts/merchant-hub/build.js`): compiles both the production contract and the harness with the VFS rooted at `contracts/`.
- **Regression guard** (`contracts/payment-hub/non-production-stubs.spec.ts` + `scripts/deploy/deployable-contracts.ts`): asserts the deployable manifest keeps `MerchantPaymentHub` and excludes the harness, that the production source contains **none** of `SetAccountState` / `SetAccountBalance` / `SetAccountLock` (nor any `(test-only)` marker), and that the bootstrap handlers live exclusively in the non-deployable harness — so a test-only handler reintroduced into the mainnet set fails CI.
- **CI wiring** (`.github/workflows/ci.yml`): the `Test (Contracts)` job now installs, builds, and runs the merchant-hub suite.
- **Documentation**: `audit/SMART_CONTRACTS_SECURITY_AUDIT.md` (C-MPH-C1 marked RESOLVED), `docs/security/THREAT_MODEL.md`, `docs/governance/PARAMETERS.md` (PP-17 timelocked; PP-18/PP-19 removed from production; PP-20 Account-Locks-gated), and `docs/error-codes.md` updated to match the hardened contract.

### Added — F2 Mobile App Wrapper (Issue #137)
- **React Native scaffold** (`mobile-app/`): TypeScript-strict React Native wrapper around `@tonbankcard/mobile-core`. Package `@tonbankcard/mobile-app` v0.1.0, bundle identifier `app.tonbankcard.mobile`, iOS 14+ and Android SDK 26+
- **Platform-agnostic facade layer** (`mobile-app/src/lib/`): `AccountFacade`, `PaymentFacade`, `SyncFacade` wrap the read-only mobile-core services and never sign on the user's behalf. `MobileTonConnectConnector` runs the TON Connect session lifecycle (`disconnected → pending → connected`) over a pluggable `SecureKeyValueStore` and persists only public information (wallet id, public address, platform)
- **Mobile screens** (`mobile-app/src/screens/`): Home, Send, Receive, Transaction History, Account Settings — implemented with React Native primitives so platform-specific dependencies remain peer-optional. Wired through a single `AppNavigator` root stack
- **TON Connect deep-link support**: `buildPaymentDeepLink()` emits `ton://` links and universal HTTPS fallbacks for Tonkeeper, Tonhub, MyTonWallet, OpenMask. `parseTonLink()` and `parseScannedPayment()` validate scanned QR payloads (address parse + numeric amount) before handing them to the wallet
- **Network hardening** (`HttpsClient` + `validateAppConfig`): HTTPS-only fetch wrapper with optional certificate-pinning validator hook, mandatory HTTPS for every configured endpoint (`apiEndpoint`, `rpcEndpoint`, `tonConnectManifestUrl`, `appUrl`), TON Connect manifest validation
- **iOS native stub** (`mobile-app/ios/`): `Info.plist` with `NSCameraUsageDescription`, `NSFaceIDUsageDescription`, `LSApplicationQueriesSchemes` for tonkeeper/tonhub/mytonwallet/openmask/ton, `tonbankcard` URL scheme, `NSAllowsArbitraryLoads=false`; `Podfile` pinned to iOS 14 with Hermes enabled
- **Android native stub** (`mobile-app/android/`): `minSdk=26`, `targetSdk=34`, `applicationId=app.tonbankcard.mobile`, `INTERNET`/`CAMERA`/`USE_BIOMETRIC`/`USE_FINGERPRINT` permissions, deep-link intent filter for the `tonbankcard` scheme with `autoVerify=true`, `usesCleartextTraffic=false`, release signing reads from `gradle.properties` (no keystores committed)
- **Test coverage**: 65 Jest unit tests across config validation, facade services, TON Connect link/manifest/connector, secure store, HTTPS client, format helpers, and QR payload parsing — all node-only, no native binaries required
- **CI integration** (`.github/workflows/ci.yml`): new `build-mobile-app` job plus mobile-app steps in `lint`, `test`, and `typecheck` jobs, each gated on a fresh `mobile/` build so the consumed typings stay in sync

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
