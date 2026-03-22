# Tonbankcard Protocol — Repository Analysis

**Date**: 2026-03-22
**Branch analyzed**: `main` (as of commit `0c54950`)
**Purpose**: Comprehensive analysis of the existing repository to support strategic planning and further development.

---

## 1. Project Summary

**Tonbankcard Protocol** is an open-source, non-custodial virtual bank protocol built on the **TON blockchain**. It enables decentralized financial infrastructure via:

- **NFT-based Account Abstraction** — Each NFT card is a unique account within the protocol
- **TBC Token Settlement** — Internal zero-fee transfers denominated in TBC (a standard TON Jetton)
- **DEX Integration** — TBC/TON liquidity via TONCO DEX
- **External Gateways** — On/off ramp integrations (ChangeNOW, NOWPayments, CoinRabbit)
- **Non-Custodial Guarantee** — Users retain full ownership and control of funds at all times

The protocol is **not** a bank, custodian, or credit issuer. It is a payment orchestration and account abstraction layer on TON.

---

## 2. Repository Structure

```
tonbankcard-protocol/
├── contracts/              # Smart contracts (Tact + FunC)
│   ├── payment-hub/        # Core Payment Hub (Tact)
│   ├── payments/           # Payment Hub (Tact + FunC) and Account Locks
│   ├── nft-resolver/       # NFT ownership resolver (Tact + FunC)
│   ├── collateral-lookup/  # Collateral signal read interface (Tact)
│   ├── governance/         # DAO contracts (ProposalRegistry, SnapshotVerifier, TransparencyRegistry)
│   ├── interfaces/         # Shared Tact interfaces (IAccountStateMachine, IAccountLocks, etc.)
│   ├── types/              # Shared type definitions
│   ├── CollateralSignal.tact
│   ├── CrossChainBridge.tact        # Phase 4
│   ├── LendingProtocolCoordinator.tact  # Phase 4
│   ├── MerchantPaymentHub.tact
│   ├── MultiSigCard.tact            # Phase 4
│   └── RecurringPayments.tact       # Phase 4
│
├── sdk/                    # @tonbankcard/merchant-sdk (v1.0.0)
│   ├── src/                # sdk.ts, types.ts, utils.ts, mock.ts, widget/
│   └── README.md
│
├── api/                    # @tonbankcard/merchant-api (v1.0.0)
│   └── src/                # Express REST API (routes/, services/, types/, utils/)
│
├── backend/
│   ├── indexer/            # @tonbankcard/payment-indexer (v1.0.0)
│   │   └── src/            # Blockchain indexer (api/, db/, parsers/, services/, types/)
│   └── adapters/           # Gateway adapters (ChangeNOW, NOWPayments, CoinRabbit, etc.)
│
├── wallet-ui/              # @tonbankcard/wallet-ui (v1.0.0)
├── mobile/                 # @tonbankcard/mobile-core (v1.0.0)
├── dashboard/              # @tonbankcard/merchant-dashboard (v1.0.0)
│
├── docs/                   # 50+ documentation files
│   ├── architecture.md     # System architecture
│   ├── invariants.md       # Protocol invariants
│   ├── security/           # Threat model, key management, incident response
│   ├── compliance/         # Regulatory and legal analysis
│   ├── economics/          # Token economics and simulations
│   ├── governance/         # DAO governance framework
│   ├── whitepaper/         # Whitepaper v1
│   ├── litepaper/          # Litepaper v1
│   └── production/         # SLA and monitoring docs
│
├── tests/                  # Integration and contract tests (12 subdirectories)
├── scripts/                # Deployment and governance scripts
├── schemas/                # JSON data schemas
├── examples/               # Example integrations
└── experiments/            # Experimental adapters
```

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | **Tact** (v1.4.4), **FunC** |
| Blockchain | **TON** (The Open Network) |
| Backend | **Node.js** (>=18), **TypeScript** (5.3.3), **Express.js** (4.18.2) |
| Database | **better-sqlite3** (local), **PostgreSQL** (optional) |
| Logging | **pino** (8.17.2) |
| Testing | **Jest** (29.7.0), **ts-jest**, **@ton/sandbox** |
| Build Tools | **tsup** (8.0.1) |
| Code Quality | **ESLint** (8.56.0), **Prettier** (3.1.1) |
| CI/CD | **GitHub Actions** |
| Deployment | **Vercel** (preview), **TON mainnet/testnet** |
| Package Manager | **npm** |

---

## 4. Development Phase Status

### Phase 1: Protocol Foundation ✅ Complete
- [x] TBC token deployed (TON Jetton standard)
- [x] NFT card collections deployed (multiple series: 7777, 8888, etc.)
- [x] TBC/TON liquidity pool on TONCO DEX
- [x] Architecture documentation established

### Phase 2: Payment Infrastructure ✅ Complete
- [x] Payment Hub smart contract (Tact + FunC, with NFT whitelist verification)
- [x] Merchant Payment Hub (with deployer access control)
- [x] Merchant API service (Express REST, invoice creation and tracking)
- [x] Payment Widget SDK (`@tonbankcard/merchant-sdk` v1.0.0)
- [x] Backend indexer (TON HTTP API, PostgreSQL/SQLite)
- [x] Integration tests (end-to-end payment flow)

### Phase 3: User Experience ✅ Complete
- [x] Wallet UI (`@tonbankcard/wallet-ui` — vanilla DOM, light/dark theme, 28 tests)
- [x] Mobile Core (`@tonbankcard/mobile-core` — platform-agnostic, 57 tests)
- [x] Merchant Dashboard (`@tonbankcard/merchant-dashboard` — 47 tests)

### Phase 4: Advanced Features ✅ Complete (Code-Only)
- [x] Lending Protocol Coordinator (`LendingProtocolCoordinator.tact`)
- [x] Multi-Signature Cards (`MultiSigCard.tact`)
- [x] Recurring Payments (`RecurringPayments.tact`)
- [x] Cross-Chain Bridge (`CrossChainBridge.tact`)
- [x] Gateway adapters in `backend/adapters/`

> **Note**: Phase 4 contracts exist in the repository but are **not yet audited or deployed** to mainnet. The code represents the implementation baseline pending security review.

---

## 5. Smart Contracts Inventory

| Contract | File | Status | Purpose |
|----------|------|--------|---------|
| PaymentHub | `contracts/payments/PaymentHub.tact` | Phase 2 | Core payment routing, NFT account abstraction |
| MerchantPaymentHub | `contracts/MerchantPaymentHub.tact` | Phase 2 | Merchant-facing payment processing |
| Account Locks | `contracts/payments/account-locks.fc` | Phase 2 | FRAUD_LOCK and COLLATERAL_LOCK flags |
| NFT Account Resolver | `contracts/nft-resolver/` | Phase 2 | On-chain NFT ownership verification |
| Collateral Lookup | `contracts/collateral-lookup/PublicCollateralLookup.tact` | Phase 2 | Public read for collateral signals |
| Collateral Signal | `contracts/CollateralSignal.tact` | Phase 2 | Collateral signal emission |
| Proposal Registry | `contracts/governance/ProposalRegistry.tact` | Phase 2 | DAO proposal management |
| Snapshot Verifier | `contracts/governance/SnapshotVerifier.tact` | Phase 2 | Voter eligibility verification |
| Transparency Registry | `contracts/governance/TransparencyRegistry.tact` | Phase 2 | On-chain governance transparency |
| Lending Coordinator | `contracts/LendingProtocolCoordinator.tact` | Phase 4 | External lending coordination |
| MultiSig Card | `contracts/MultiSigCard.tact` | Phase 4 | Multi-party account control |
| Recurring Payments | `contracts/RecurringPayments.tact` | Phase 4 | Subscription/recurring payment flows |
| Cross-Chain Bridge | `contracts/CrossChainBridge.tact` | Phase 4 | Cross-chain asset transfers |

---

## 6. Off-Chain Services Inventory

| Service | Package | Purpose |
|---------|---------|---------|
| Merchant SDK | `@tonbankcard/merchant-sdk` | TypeScript SDK for merchant integrations |
| Merchant API | `@tonbankcard/merchant-api` | REST API for invoice management |
| Payment Indexer | `@tonbankcard/payment-indexer` | Blockchain event monitor and cache |
| Wallet UI | `@tonbankcard/wallet-ui` | User-facing wallet interface |
| Mobile Core | `@tonbankcard/mobile-core` | Platform-agnostic mobile business logic |
| Merchant Dashboard | `@tonbankcard/merchant-dashboard` | Merchant portal interface |

---

## 7. Core Protocol Invariants

The protocol enforces the following guarantees (defined in `docs/invariants.md`):

| ID | Invariant |
|----|-----------|
| I1 | **Non-Custodial**: Only the NFT owner can initiate transfers |
| I2 | **NFT Authority**: NFT ownership is the sole account authority |
| I3 | **No Admin Control**: The deployer cannot move user funds |
| I4 | **Atomic Transfers**: All fund operations are all-or-nothing |
| I5 | **Ledger Conservation**: No fees for internal TBC transfers |
| I6 | **State Integrity**: Account state transitions follow valid state machine rules |
| I7 | **Lock Enforcement**: Locked accounts cannot initiate sends |

---

## 8. Account State Model

**Account States**:

| State | Can Send | Can Receive | Description |
|-------|----------|-------------|-------------|
| `ACTIVE` (0) | ✅ | ✅ | Normal operational state |
| `FROZEN` (1) | ❌ | ✅ | Temporarily restricted |
| `COLLATERAL_LOCKED` (2) | ❌ | ✅ | Pledged as lending collateral |
| `CLOSED` (3) | ❌ | ❌ | Account permanently closed |

**Lock Types** (orthogonal to states):

| Lock | Effect | Set By |
|------|--------|--------|
| `FRAUD_LOCK` | Cannot send | Risk Authority |
| `COLLATERAL_LOCK` | Cannot send | Lending Adapter |

---

## 9. External Integration Map

| Partner | Type | Direction | Use Case |
|---------|------|-----------|---------|
| **TONCO DEX** | On-chain DEX | Bi-directional | TBC↔TON swaps, price discovery |
| **ChangeNOW** | API gateway | In/Out | Crypto on/off ramps |
| **NOWPayments** | API gateway | In | Merchant payment processing |
| **CoinRabbit** | API gateway | Bi-directional | Collateral-based lending |
| **TON Connect** | Wallet protocol | User-facing | Transaction signing |

---

## 10. Fee Structure

| Operation | Fee | Recipient |
|-----------|-----|-----------|
| Internal TBC Transfer | **Zero** | N/A |
| DEX Swap (TBC↔TON) | ~0.3% | TONCO liquidity providers |
| External Deposit | Gateway fee | ChangeNOW / NOWPayments |
| External Withdrawal | Gateway fee + DEX slippage | Gateway + LPs |
| TON gas | TON gas cost | TON validators |

---

## 11. Testing Infrastructure

| Area | Test Directory | Coverage |
|------|---------------|---------|
| Payment Hub | `tests/payments/` | Phase 2 |
| NFT Resolver | `tests/nft-resolver/` | Phase 2 |
| Collateral Lookup | `tests/collateral-lookup/` | Phase 2 |
| Governance | `tests/governance/` | Phase 2 |
| Lending Adapter | `tests/lending-adapter/` | Phase 4 |
| Multi-Signature | `tests/multisig/` | Phase 4 |
| Recurring Payments | `tests/recurring-payments/` | Phase 4 |
| Cross-Chain Bridge | `tests/cross-chain-bridge/` | Phase 4 |
| Invariants | `tests/invariants/` | Protocol-wide |
| Adversarial | `tests/adversarial/` | Security scenarios |
| Versioning | `tests/versioning/` | Compatibility |
| Future | `tests/future/` | Planned scenarios |

**Coverage requirements**: 70% (indexer), 80% (contract tests)

---

## 12. CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every PR and push to `main`:

| Job | Trigger | Purpose |
|-----|---------|---------|
| `build-runtime` | Always | Build backend indexer |
| `build-sdk` | Always | Build SDK with type declarations |
| `build-wallet-ui` | Always | Build wallet UI |
| `build-mobile-core` | Always | Build mobile core |
| `build-dashboard` | Always | Build merchant dashboard |
| `lint` | PR only | ESLint code quality |
| `test` | PR only | Unit test suite |
| `typecheck` | PR only | TypeScript type checking |
| `test-contracts` | PR only | Smart contract tests |
| `deploy` | PR only | Vercel preview deployment |

---

## 13. Security Architecture Summary

The protocol implements a **five-level trust boundary model**:

```
Level 1 — On-Chain (Highest Trust)
  └── NFT ownership, TBC balances, smart contract logic

Level 2 — User-Controlled
  └── TON Connect wallet, client-side transaction signing

Level 3 — Off-Chain Read-Only
  └── Backend indexer (read-only, no transaction signing)

Level 4 — Off-Chain Orchestration
  └── Merchant API (orchestrates user-initiated flows)

Level 5 — External Services (Lowest Trust)
  └── ChangeNOW, NOWPayments, CoinRabbit (third-party)
```

**Key security properties**:
- Immutable smart contracts (no upgrade proxies, no `set_code()`)
- No admin withdrawal rights
- No private key storage off-chain
- All fund operations require user signature
- Responsible disclosure at `security@tonbankcard.com`

---

## 14. Documentation Inventory

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture | `docs/architecture.md` | System design overview |
| Invariants | `docs/invariants.md` | Protocol correctness guarantees |
| Threat Model | `docs/security/THREAT_MODEL.md` | Adversary model (78 KB) |
| Key Management | `docs/security/KEY_MANAGEMENT.md` | Operational key security |
| Incident Response | `docs/security/INCIDENT_RESPONSE.md` | Security incident playbooks |
| Audit Readiness | `docs/security/AUDIT_READINESS.md` | Audit status and scope |
| DAO Governance | `docs/dao-governance.md` | Governance framework |
| Whitepaper | `docs/whitepaper/` | Technical whitepaper v1 |
| Litepaper | `docs/litepaper/` | Concise protocol overview |
| Merchant API Spec | `docs/merchant-api-spec.md` | REST API reference |
| Compliance | `docs/compliance/` | Regulatory guidance |
| Economics | `docs/economics/` | Token economics simulations |
| Production | `docs/production/` | SLA and monitoring |

---

## 15. Repository Metrics

| Metric | Value |
|--------|-------|
| Total source files | ~128 TypeScript/Tact/FunC files |
| NPM packages | 6 publishable packages |
| Smart contracts | 13+ Tact/FunC contracts |
| Test directories | 12 |
| Documentation files | 50+ |
| Repository size | ~4.9 MB |
| License | MIT |

---

*Analysis generated for Issue #86. See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for recommended next steps.*
