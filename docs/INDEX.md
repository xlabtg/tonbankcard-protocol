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

## Recurring Payments (F4)

| Document | Description |
|----------|-------------|
| [Specification](recurring-payments/SPECIFICATION.md) | Mandate state machine, billing periods, error registry, threat catalogue T-RP-1..T-RP-6, hardening backlog RP-CH-1..RP-CH-5 |
| [Dashboard Integration](recurring-payments/DASHBOARD_INTEGRATION.md) | Merchant subscription console, subscriber statuses, MRR/ARR computation (AC-4) |
| [Wallet UX](recurring-payments/WALLET_UX.md) | Wallet subscribe/cancel/pause flow, user-facing error mapping (AC-5) |
| [Notifications](recurring-payments/NOTIFICATIONS.md) | RP-N01..RP-N08 notification catalogue, T-3d scheduler (AC-6) |
| [Monitoring](recurring-payments/MONITORING.md) | Alert catalogue SUB-M01..SUB-M18, severity matrix, DR drills DR-1..DR-5 |
| [Contract Hardening](recurring-payments/CONTRACT_HARDENING.md) | Hardening backlog RP-CH-1..RP-CH-5 and CI guardrails R-RP-CH-1..R-RP-CH-5 (A2-gated) |
| [Testnet Deployment](recurring-payments/TESTNET_DEPLOYMENT.md) | Deployment plan, error-path coverage, AC-8 test bars (47 dashboard + 28 wallet-ui) |
| [Bug Bounty](recurring-payments/BUG_BOUNTY.md) | Subscription-specific bounty tiers and A5 integration |

---

## Multi-Sig Cards (F5)

| Document | Description |
|----------|-------------|
| [Specification](multisig/SPECIFICATION.md) | M-of-N threshold models (2-of-3 personal, 3-of-5 corporate, custom ≤10), signing ceremony, signer add/remove, threat catalogue T-MSC-1..T-MSC-7, hardening backlog MS-CH-1..MS-CH-6 |
| [Wallet UX](multisig/WALLET_UX.md) | Create flow, pending approvals screen, one-tap sign/reject, signer management, guardian recovery and notifications hooks (AC-4 / AC-5) |
| [Guardian Recovery](multisig/GUARDIAN_RECOVERY.md) | Guardian set composition (2-of-3 default), recovery state machine, 72 h cooldown (259200 s), off-chain enforcement, MS-CH-6 on-chain deferral (AC-6) |
| [Notifications](multisig/NOTIFICATIONS.md) | MS-N01..MS-N08 notification catalogue, channels, scheduling, opt-in, privacy posture |
| [Monitoring](multisig/MONITORING.md) | Alert catalogue MS-M01..MS-M18, pager severity matrix, data sources DS-1..DS-4, DR drills DR-1..DR-5 |
| [Contract Hardening](multisig/CONTRACT_HARDENING.md) | Hardening backlog MS-CH-1..MS-CH-6 and CI guardrails R-MS-CH-1..R-MS-CH-5 (A2-gated) |
| [Testnet Deployment](multisig/TESTNET_DEPLOYMENT.md) | Deployment plan, end-to-end multi-sig flow, error-path coverage for codes 1..9, AC-8 wallet-ui test bar (28) |
| [Bug Bounty](multisig/BUG_BOUNTY.md) | Multi-sig-specific bounty tiers, severity uplifts, RC-BOUNTY-CRITICAL pause, A2-READY activation gate |

---

## Additional DEX Integrations (F6)

| Document | Description |
|----------|-------------|
| [Specification](dex/SPECIFICATION.md) | Shared `DexAdapter` interface, error registry codes 1..9, threat catalogue T-DEX-1..T-DEX-7, hardening backlog DEX-AH-1..DEX-AH-7 (A4-gated, off-chain envelope) |
| [Price Aggregator](dex/PRICE_AGGREGATOR.md) | Parallel `Promise.allSettled` fan-out, tie-break order TONCO → DeDust, floor guard, fallback re-quote window (5 s), idempotency window (600 s) and P50/P95/P99 budgets |
| [Slippage Protection](dex/SLIPPAGE_PROTECTION.md) | User-tunable slippage slider [MIN=10, DEFAULT=50, MAX=500] bps, large-trade warnings, auto-revert ladder (DEX-M07) (AC-5) |
| [Liquidity Monitoring](dex/LIQUIDITY_MONITORING.md) | Alert catalogue DEX-M01..DEX-M18, §3.6 P0..P3 severity matrix, data sources DS-1..DS-4, DR drills DR-1..DR-5, B3 wiring (AC-6) |
| [Notifications](dex/NOTIFICATIONS.md) | DEX-N01..DEX-N08 notification catalogue, Push/Email/Webhook channels, sha256 dedup key, retry policy `MAX_WEBHOOK_RETRIES = 5`, privacy posture |
| [Wallet UX](dex/WALLET_UX.md) | Swap confirmation sheet, slippage slider, expires-in countdown, failure-mode toast catalogue (codes 1..9), large-trade modal, venue-status pill |
| [Adapter Hardening](dex/ADAPTER_HARDENING.md) | Hardening backlog DEX-AH-1..DEX-AH-7 with T-DEX-N closures, CI guardrails R-DEX-AH-1..R-DEX-AH-5 (A4-gated) |
| [Testnet Integration](dex/TESTNET_INTEGRATION.md) | Deployment manifest, end-to-end multi-DEX flow, fallback drill (AC-4), test bars **24** adapter unit + **12** aggregator integration (AC-7) |
| [Bug Bounty](dex/BUG_BOUNTY.md) | DEX-specific bounty tiers (Critical for the aggregator, High for adapters), RC-BOUNTY-CRITICAL pause, A5 PROGRAM_BRIEF.md wiring, A4-READY activation gate |

---

## Analytics & Reporting (F7)

| Document | Description |
|----------|-------------|
| [Specification](analytics/SPECIFICATION.md) | Off-chain analytics layer (indexer → read-replica → aggregator → API → CDN-cached dashboard), error registry `ERROR_AN_0..ERROR_AN_9`, threat catalogue T-AN-1..T-AN-7, hardening backlog AN-AH-1..AN-AH-7 (B3-gated) |
| [Merchant Analytics](analytics/MERCHANT_ANALYTICS.md) | `GET /v1/analytics/merchant` envelope, JWT `sub`-bound scope, `K_ANONYMITY_FLOOR = 5` top-customers gate, P95 < 2 s budget (AC-2, AC-4) |
| [Protocol Analytics](analytics/PROTOCOL_ANALYTICS.md) | `GET /v1/analytics/protocol` aggregate envelope, CDN cache directive (TTL=600 s + SWR=120 s + `Vary: Accept-Encoding`), AN-M02 budget anchor (AC-3, AC-6) |
| [Public Dashboard](analytics/PUBLIC_DASHBOARD.md) | `stats.tonbankcard.com` public dashboard, AN-M04 disconnect-grace banner, `DASHBOARD_LOAD_BUDGET_MS = 2000` real-user budget (AC-5) |
| [Privacy](analytics/PRIVACY.md) | K-anonymity floor (K=5) triple enforcement, first-4/last-4 truncated `hashedSub`, merchant opt-out (`NOT` publicly enumerable), `ANALYTICS_RETENTION_YEARS = 3` |
| [Monitoring](analytics/MONITORING.md) | Alert catalogue AN-M01..AN-M12, P0..P3 pager severity matrix, data sources DS-1..DS-6, DR drills DR-1..DR-6, B3 wiring |
| [Endpoint Hardening](analytics/ENDPOINT_HARDENING.md) | Hardening backlog AN-AH-1..AN-AH-7 with T-AN-N closures, CI guardrails R-AN-AH-1..R-AN-AH-5 (B3-gated) |
| [Testnet Integration](analytics/TESTNET_INTEGRATION.md) | Staging deployment manifest, IDOR drill (6 cases), AC-7 IDOR-protection bar, dashboard-load budget rehearsal (AC-2, AC-3, AC-4, AC-5, AC-7) |
| [Bug Bounty](analytics/BUG_BOUNTY.md) | Analytics-specific bounty tiers (Critical for aggregators), A5 PROGRAM_BRIEF.md wiring, B3-READY activation gate |

---

## Toolchain Evaluations (D6)

| Document | Description |
|----------|-------------|
| [Acton Toolchain Evaluation](tooling/ACTON_EVALUATION.md) | Explicit **NO ADOPTION** decision for the Acton TON toolchain (Tolk-first) with companion **EXPERIMENTS ONLY** posture under `experiments/acton/`. Pinned Acton release `v1.0.0` (2026-05-11), Tact + FunC + TypeScript stack remains authoritative, recommendations for D1/D2/A3/B1/B2 owners, 4 reconsideration triggers, cost estimates (~20–35 dev-days partial / 3–4 months full), companion sandbox `experiments/acton/` with toy Tolk harness modelling `contracts/payments/account-locks.fc` (Issue #143, AC-1..AC-7) |

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
