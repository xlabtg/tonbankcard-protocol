# Tonbankcard Protocol

**A non-custodial virtual bank protocol built on TON blockchain**

[![TON](https://img.shields.io/badge/TON-Blockchain-0088cc)](https://ton.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/xlabtg/tonbankcard-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/xlabtg/tonbankcard-protocol/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-index-informational)](docs/INDEX.md)
[![Docs Site](https://img.shields.io/badge/docs--site-Docusaurus-2c5bb4)](docs-site/README.md)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/xlabtg/tonbankcard-protocol)

## Quickstart (< 5 minutes)

> Want a working merchant checkout against TON testnet without reading the
> rest of this README? Pick one:

* **GitHub Codespaces** — click the badge above. The
  [`.devcontainer/`](.devcontainer/) recipe runs `scripts/setup.sh` on
  creation, so you land in a terminal with all six packages installed and
  built. Then run `npm run demo` and open the forwarded `:8080` port.
* **Local clone** —
  ```bash
  git clone https://github.com/xlabtg/tonbankcard-protocol.git
  cd tonbankcard-protocol
  npm run setup        # install + build + smoke-test all six packages
  npm run demo         # http://localhost:8080
  ```
* **Just the merchant demo** —
  ```bash
  cd examples/merchant-demo
  npm install && npm start
  ```

The reference merchant lives at
[`examples/merchant-demo/`](examples/merchant-demo/README.md): a
non-custodial Express.js storefront that creates a sandbox invoice, embeds
the `@tonbankcard/merchant-sdk` payment widget, and receives webhooks —
the canonical entry point for integrators (Issue
[#125](https://github.com/xlabtg/tonbankcard-protocol/issues/125)).

![Merchant demo screenshot](docs/screenshots/merchant-demo.png)

> 📖 **Public documentation site:** the markdown sources in [`docs/`](docs/) are
> also published as a browsable site via Docusaurus. Build it locally with
> `cd docs-site && npm install && npm run start`, or read the build/deployment
> notes in [`docs-site/README.md`](docs-site/README.md). When deployed, the
> hosted site lives at <https://docs.tonbankcard.com>.

## Overview

Tonbankcard is a decentralized financial infrastructure protocol that provides:

- 🎴 **NFT-based Account Abstraction**: Each NFT card represents a unique account
- 💎 **TBC Token Settlement**: Internal transfers with zero fees
- 🔄 **DEX Integration**: Seamless liquidity via TONCO
- 🌐 **External Gateways**: Integration with ChangeNOW, NOWPayments, CoinRabbit
- 🔒 **Non-Custodial**: Users maintain full control of their assets

## What is Tonbankcard?

Tonbankcard is **NOT** a traditional bank. It's a protocol that enables:

- Account abstraction using NFTs as account identifiers
- Internal settlement using the TBC token
- Payment orchestration without custody
- Collateral signaling for external lending

### Core Principles

1. **User Sovereignty**: No admin controls over user funds
2. **On-Chain Truth**: Blockchain as single source of truth
3. **Maximum Decentralization**: Immutable smart contracts
4. **Transparency**: All operations auditable on-chain

## Repository Structure

```
tonbankcard-protocol/
├── contracts/                        # Smart contracts
│   ├── payment-hub/                 # Payment Hub (Phase 2)
│   ├── payments/                    # Payment logic
│   ├── nft-resolver/                # NFT account abstraction
│   ├── collateral-lookup/           # Collateral signaling
│   ├── governance/                  # DAO governance
│   ├── LendingProtocolCoordinator.tact  # Lending coordination (Phase 4)
│   ├── MultiSigCard.tact            # Multi-signature cards (Phase 4)
│   ├── RecurringPayments.tact       # Recurring payments (Phase 4)
│   └── CrossChainBridge.tact        # Cross-chain bridge (Phase 4)
│
├── sdk/                # Merchant SDK & Payment Widget (Phase 2)
│                       # Package: @tonbankcard/merchant-sdk
├── api/                # Merchant API (Phase 2)
│                       # Package: @tonbankcard/merchant-api
│
├── backend/            # Off-chain services
│   ├── indexer/       # Payment status indexer (Phase 2)
│   │                  # Package: @tonbankcard/payment-indexer
│   └── adapters/      # Gateway adapters (ChangeNOW, NOWPayments,
│                      #   CoinRabbit, MultiSig, Recurring, Bridge)
│
├── wallet-ui/          # Wallet UI (Phase 3)
│                       # Package: @tonbankcard/wallet-ui
├── mobile/             # Mobile app core logic (Phase 3)
│                       # Package: @tonbankcard/mobile-core
├── mobile-app/         # React Native wrapper for mobile-core (Track F2)
│                       # Package: @tonbankcard/mobile-app
├── dashboard/          # Merchant dashboard (Phase 3)
│                       # Package: @tonbankcard/merchant-dashboard
│
├── docs/              # Documentation
│   ├── architecture.md     # System architecture
│   ├── INDEX.md            # Documentation navigation
│   └── existing-contracts.md  # Deployed contracts reference
│
├── tests/             # Integration & contract tests
├── CONTRIBUTING.md    # Development guidelines
└── README.md         # This file
```

## Key Components

### NFT Cards (Deployed)
- Multiple collections (7777, 8888 series)
- Each NFT = unique account within Tonbankcard
- Ownership determines account control
- View on [TONViewer](https://tonviewer.com/)

### TBC Token (Deployed)
- Internal settlement token
- Zero-fee internal transfers
- Tradable on [TONCO DEX](https://app.tonco.io/)
- Full contract details in [docs/existing-contracts.md](docs/existing-contracts.md)

### Liquidity (Active)
- TBC/TON pool on TONCO
- Decentralized price discovery
- Enables external on/off ramps

### Payment-Block Contracts (Awaiting B2 Mainnet Ceremony)

The Phase 2 protocol contracts (`AccountLocks`, `NFTAccountResolver`, `AccountStateMachine`, `PaymentHub`, `MerchantPaymentHub`, `CollateralSignal`, `PublicCollateralLookup`) plus the governance group are scheduled for mainnet deployment under engagement **[B2-mainnet](docs/deployments/B2-mainnet/ENGAGEMENT.md)**.

- **Runbook:** [`scripts/deploy/MAINNET_RUNBOOK.md`](scripts/deploy/MAINNET_RUNBOOK.md) — step-by-step deploy ceremony
- **Multi-sig discipline:** [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) — ≥ 2-of-3 hardware-wallet signers, distinct from B1 testnet
- **Verification:** [`docs/deployments/B2-mainnet/VERIFICATION_PLAN.md`](docs/deployments/B2-mainnet/VERIFICATION_PLAN.md) — code-hash, initial-state, and end-to-end tx checks
- **Immutability:** [`docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md`](docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md) — three-layer scan (source / compiled cell / state)
- **Roll-back posture:** [`docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md`](docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md) — manifests are append-only; "roll-back" means pause + supersede, never delete-and-redeploy

Addresses populate `docs/existing-contracts.md` and `docs/deployments/network-matrix.md` **atomically** once the ceremony completes.

## Architecture

For detailed architecture documentation, see [docs/architecture.md](docs/architecture.md).

### High-Level Flow

```
User NFT Card ←→ TBC Token ←→ TBC/TON Pool ←→ External Gateways
      ↓              ↓              ↓
  Account       Settlement    Liquidity
```

### Integration Points

- **TON Connect**: Wallet integration
- **TONCO DEX**: Primary liquidity provider
- **ChangeNOW**: Crypto swap gateway
- **NOWPayments**: Payment processing
- **CoinRabbit**: Collateral-based lending

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Merchant SDK

For merchants integrating TONBANKCARD payments into websites or applications:

```bash
npm install @tonbankcard/merchant-sdk
```

```typescript
import { TonbankcardSDK, TESTNET_CONFIG, parseTBC } from '@tonbankcard/merchant-sdk';
import { Address } from '@ton/core';

const sdk = new TonbankcardSDK({
  ...TESTNET_CONFIG,
  paymentHubAddress: Address.parse('EQ...YourPaymentHub'),
});
```

See the full [SDK documentation](sdk/README.md) for usage examples and API reference.

### Merchant API

To run the off-chain Merchant API service:

```bash
cd api
npm install
npm run build
npm start
```

See [docs/merchant-api-spec.md](docs/merchant-api-spec.md) for the full REST API specification.

### Payment Indexer

To run the read-only blockchain indexer:

```bash
cd backend/indexer
npm install
npm run db:migrate
npm start
```

### Wallet UI

```bash
npm install @tonbankcard/wallet-ui
```

### Mobile Core

```bash
npm install @tonbankcard/mobile-core
```

### Merchant Dashboard

```bash
npm install @tonbankcard/merchant-dashboard
```

### Development Setup (all packages)

Use the one-command quickstart introduced in Issue
[#125](https://github.com/xlabtg/tonbankcard-protocol/issues/125):

```bash
git clone https://github.com/xlabtg/tonbankcard-protocol.git
cd tonbankcard-protocol
npm run setup            # install + build + smoke-test all six packages
```

`scripts/setup.sh` is idempotent, runs no remote shell scripts, and
completes in well under five minutes on a Node.js LTS install. Flags:

| Command | Behaviour |
|---------|-----------|
| `npm run setup` | Install + build + smoke test (full quickstart). |
| `npm run setup:install` | Install dependencies only, skip build. |
| `npm run setup:check` | Verify prerequisites only (`node --version` etc.). |
| `bash scripts/setup.sh --skip mobile,dashboard` | Skip selected packages. |
| `bash scripts/setup.sh --no-smoke` | Install + build, skip smoke test. |

If you prefer the per-package flow, every package retains a standalone
`npm install` / `npm run build` / `npm test`:

```bash
cd sdk && npm install && npm run build         # @tonbankcard/merchant-sdk
cd api && npm install && npm run build         # @tonbankcard/merchant-api
cd backend/indexer && npm install              # @tonbankcard/payment-indexer
cd wallet-ui && npm install && npm run build   # @tonbankcard/wallet-ui
cd mobile && npm install && npm run build      # @tonbankcard/mobile-core
cd dashboard && npm install && npm run build   # @tonbankcard/merchant-dashboard
```

### Running Tests

```bash
npm test                # runs every package's test suite via scripts/test-all.sh
```

Each package still works in isolation:

```bash
cd sdk && npm test
cd api && npm test
cd backend/indexer && npm test
cd wallet-ui && npm test
cd mobile && npm test
cd dashboard && npm test

# Run with coverage
npm run test:coverage
```

### Merchant demo

The reference Express.js merchant integration lives at
[`examples/merchant-demo/`](examples/merchant-demo/README.md). It uses the
public C3 sandbox by default — no environment variables required — and is
the canonical quickstart reference for new integrators (per Issue #125 §3
and §8).

```bash
npm run demo            # equivalent to: npm --prefix examples/merchant-demo start
```

Then open <http://localhost:8080>.

---

## Getting Started

### For Developers

1. Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
2. Browse the [Documentation Index](docs/INDEX.md) for full navigation
3. Review the [architecture documentation](docs/architecture.md)
4. Check [existing contracts](docs/existing-contracts.md)
5. Create an Issue for your proposed changes
6. Submit a PR following the template

### For Users

- **NFT Cards**: Available on TON marketplaces
- **TBC Token**: Trade on [TONCO](https://app.tonco.io/)
- **Wallet**: Coming soon

## Development Workflow

All development follows a strict **Issue → PR** workflow:

1. **Create Issue**: Describe the problem or feature
2. **Discussion**: Clarify requirements and approach
3. **Implementation**: Develop solution on feature branch
4. **Pull Request**: Submit PR with tests and documentation
5. **Review**: Security and architecture review
6. **Merge**: After approval and CI checks

**Direct pushes to `main` are prohibited.**

## Security

### Security Framework

TONBANKCARD implements a formally specified security architecture:

- **Threat Model**: [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) — Full adversary model, attack surface classification, trust boundaries, and mitigation mapping
- **Key Management**: [docs/security/KEY_MANAGEMENT.md](docs/security/KEY_MANAGEMENT.md) — Operational security, key classification, rotation policy, and compromise recovery procedures

### Non-Custodial Guarantees

✅ **Protocol DOES**:
- Maintain user ownership of funds
- Execute only user-signed transactions
- Operate transparently on-chain

❌ **Protocol DOES NOT**:
- Store private keys
- Have admin withdrawal rights
- Custody user funds
- Include upgradeability proxies

### Security Architecture Principles

1. **Non-Custodial**: Protocol never takes custody of user funds
2. **Immutable-First**: No upgrade proxies, no `set_code()`, no admin migration paths
3. **Explicit Trust Boundaries**: Five formally defined trust levels
4. **Minimal Admin Power**: No admin withdrawal, no emergency drain, no privileged transfer functions
5. **Deterministic Settlement**: All fund operations are atomic, on-chain, and user-initiated

### Security Documentation

- [docs/security/SECURITY.md](docs/security/SECURITY.md) — Security framework index
- [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) — Threat model and security architecture
- [docs/security/KEY_MANAGEMENT.md](docs/security/KEY_MANAGEMENT.md) — Key management and operational security
- [docs/security/INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md) — Incident response procedures
- [docs/security/AUDIT_READINESS.md](docs/security/AUDIT_READINESS.md) — Audit readiness status

### Reporting Security Issues

Please report security vulnerabilities privately. See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

**DO NOT** disclose security issues publicly via GitHub issues.

## Protocol Economics

| Operation | Fee | Notes |
|-----------|-----|-------|
| Internal TBC Transfer | **Zero** | Between NFT cards |
| DEX Swap (TBC/TON) | ~0.3% | TONCO pool fee |
| External Deposit | Gateway fee | ChangeNOW/NOWPayments |
| External Withdrawal | Gateway fee + slippage | Via DEX and gateways |

## Links

- **Protocol Docs**: [docs/architecture.md](docs/architecture.md)
- **Documentation Index**: [docs/INDEX.md](docs/INDEX.md)
- **Existing Contracts**: [docs/existing-contracts.md](docs/existing-contracts.md)
- **Protocol Registry**: [docs/registry/protocol-registry.md](docs/registry/protocol-registry.md)
- **Merchant SDK**: [sdk/README.md](sdk/README.md)
- **Merchant API Spec**: [docs/merchant-api-spec.md](docs/merchant-api-spec.md)
- **Phase 4 Advanced Features**: [docs/phase4-advanced-features.md](docs/phase4-advanced-features.md)
- **Security Threat Model**: [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md)
- **Key Management**: [docs/security/KEY_MANAGEMENT.md](docs/security/KEY_MANAGEMENT.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **TON Documentation**: [docs.ton.org](https://docs.ton.org/)
- **TONCO DEX**: [app.tonco.io](https://app.tonco.io/)

## Roadmap

### Phase 1: Protocol Foundation ✅
- [x] TBC token deployment
- [x] NFT card collections
- [x] TONCO liquidity pool
- [x] Architecture documentation

### Phase 2: Payment Infrastructure ✅
- [x] Payment hub smart contract
- [x] Merchant API
- [x] Payment widget/SDK
- [x] Backend indexer

### Phase 3: User Experience ✅
- [x] Wallet UI
- [x] Mobile app
- [x] Merchant dashboard

### Phase 4: Advanced Features ✅
- [x] Lending protocol integration
- [x] Multi-signature cards
- [x] Recurring payments
- [x] Cross-chain bridges

## Contributing

We welcome contributions that align with our non-custodial, decentralized principles.

**Before contributing**:
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) carefully
2. Understand the protocol architecture
3. Create an Issue for discussion
4. Follow the PR template

**AI Bot Contributions**: Strictly follow Issue specifications. No inferred additions.

## License

Copyright (c) 2025 Anton Poroshin. All rights reserved. (LICENSE).

## Contact

- **Issues**: [GitHub Issues](https://github.com/xlabtg/tonbankcard-protocol/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xlabtg/tonbankcard-protocol/discussions)

---

**Built on TON. Owned by users.**
