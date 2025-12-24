# Tonbankcard Protocol

**A non-custodial virtual bank protocol built on TON blockchain**

[![TON](https://img.shields.io/badge/TON-Blockchain-0088cc)](https://ton.org)
[![License](https://img.shields.io/badge/license-TBD-blue.svg)](LICENSE)

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
├── contracts/           # Smart contracts (future)
│   ├── token/          # TBC jetton (existing, deployed)
│   ├── nft-cards/      # NFT card collections (existing, deployed)
│   ├── payments/       # Payment hub / escrow (future)
│   └── lending/        # Collateral & lending adapters (future)
│
├── backend/            # Off-chain services (future)
│   ├── api/           # Merchant API, internal services
│   └── indexer/       # TON blockchain indexer / watchers
│
├── frontend/           # User interfaces (future)
│   ├── merchant/      # Payment widget / SDK
│   └── wallet/        # User wallet UI (future)
│
├── docs/              # Documentation
│   ├── architecture.md     # System architecture
│   ├── existing-contracts.md  # Deployed contracts reference
│   └── litepaper.md        # Protocol specification (future)
│
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

## Getting Started

### For Developers

1. Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
2. Review the [architecture documentation](docs/architecture.md)
3. Check [existing contracts](docs/existing-contracts.md)
4. Create an Issue for your proposed changes
5. Submit a PR following the template

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

### Reporting Security Issues

Please report security vulnerabilities via private channels (details coming soon).

**DO NOT** disclose security issues publicly.

## Protocol Economics

| Operation | Fee | Notes |
|-----------|-----|-------|
| Internal TBC Transfer | **Zero** | Between NFT cards |
| DEX Swap (TBC/TON) | ~0.3% | TONCO pool fee |
| External Deposit | Gateway fee | ChangeNOW/NOWPayments |
| External Withdrawal | Gateway fee + slippage | Via DEX and gateways |

## Links

- **Protocol Docs**: [docs/architecture.md](docs/architecture.md)
- **Existing Contracts**: [docs/existing-contracts.md](docs/existing-contracts.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **TON Documentation**: [docs.ton.org](https://docs.ton.org/)
- **TONCO DEX**: [app.tonco.io](https://app.tonco.io/)

## Roadmap

### Phase 1: Protocol Foundation ✅
- [x] TBC token deployment
- [x] NFT card collections
- [x] TONCO liquidity pool
- [x] Architecture documentation

### Phase 2: Payment Infrastructure (In Progress)
- [ ] Payment hub smart contract
- [ ] Merchant API
- [ ] Payment widget/SDK
- [ ] Backend indexer

### Phase 3: User Experience
- [ ] Wallet UI
- [ ] Mobile app
- [ ] Merchant dashboard

### Phase 4: Advanced Features
- [ ] Lending protocol integration
- [ ] Multi-signature cards
- [ ] Recurring payments
- [ ] Cross-chain bridges

## Contributing

We welcome contributions that align with our non-custodial, decentralized principles.

**Before contributing**:
1. Read [CONTRIBUTING.md](CONTRIBUTING.md) carefully
2. Understand the protocol architecture
3. Create an Issue for discussion
4. Follow the PR template

**AI Bot Contributions**: Strictly follow Issue specifications. No inferred additions.

## License

License information coming soon.

## Contact

- **Issues**: [GitHub Issues](https://github.com/xlabtg/tonbankcard-protocol/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xlabtg/tonbankcard-protocol/discussions)

---

**Built on TON. Owned by users.**