# Tonbankcard Protocol Architecture

## Overview

Tonbankcard is a **non-custodial virtual bank protocol** built on the TON blockchain. It provides account abstraction through NFTs, internal settlement using the TBC token, and seamless integration with external payment gateways and DEX liquidity.

## Core Principles

1. **Non-Custodial by Design**: User funds remain under user control at all times
2. **NFT as Account**: Each NFT card represents a unique account within the protocol
3. **On-Chain Truth**: The blockchain is the single source of truth
4. **Maximum Decentralization**: No admin controls over user funds
5. **Immutable Contracts**: Core protocol logic cannot be upgraded

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TON Blockchain                            │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  NFT Cards   │    │  TBC Token   │    │ TBC/TON Pool │      │
│  │  (Account    │◄───┤  (Jetton)    │◄───┤   (TONCO)    │      │
│  │   Layer)     │    │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    │             │
│         └────────────────────┴────────────────────┘             │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐          ┌────────▼──────┐
        │    Backend      │          │   Frontend    │
        │                 │          │               │
        │  ┌───────────┐  │          │ ┌───────────┐ │
        │  │ Indexer   │  │          │ │  Merchant │ │
        │  │           │  │          │ │   Widget  │ │
        │  └───────────┘  │          │ └───────────┘ │
        │  ┌───────────┐  │          │ ┌───────────┐ │
        │  │   API     │  │          │ │   Wallet  │ │
        │  │           │  │          │ │    UI     │ │
        │  └───────────┘  │          │ └───────────┘ │
        └─────────────────┘          └───────────────┘
                │                            │
                └────────────┬───────────────┘
                             │
        ┌────────────────────▼─────────────────────┐
        │      External Integrations               │
        │                                          │
        │  • ChangeNOW (Swap)                      │
        │  • NOWPayments (Payments)                │
        │  • CoinRabbit (Lending/Collateral)       │
        │  • TONCO DEX (Liquidity)                 │
        └──────────────────────────────────────────┘
```

## Core Components

### 1. NFT Card (Account Abstraction)

**Purpose**: Each NFT represents a unique account/card number within the Tonbankcard protocol.

**Characteristics**:
- Ownership determines account control
- Not always transferable (can be soulbound)
- Balances are private by default
- Multiple series (7777, 8888, etc.)

**Contract Status**: Deployed and immutable

**Responsibility Boundaries**:
- ✅ Account identification
- ✅ Ownership verification
- ❌ Balance storage (delegated to TBC token)
- ❌ Direct fund custody

### 2. TBC Token (Jetton)

**Purpose**: Internal settlement token for the Tonbankcard ecosystem.

**Characteristics**:
- Standard TON jetton (fungible token)
- Used for internal transfers and settlements
- Tradable on TONCO DEX against TON
- Internal transfers have zero fees

**Contract Status**: Deployed and immutable

**Responsibility Boundaries**:
- ✅ Balance tracking
- ✅ Transfer execution
- ✅ Supply management
- ❌ Account logic
- ❌ Access control beyond ownership

### 3. Payment Flow

**Internal Transfers** (TBC → TBC):
```
User A (NFT Card #7777001)
    ↓ [sign transaction]
TBC Transfer
    ↓ [on-chain execution]
User B (NFT Card #8888001)
```
- Zero fees for internal transfers
- Instant settlement
- Fully on-chain
- No intermediaries

**External Deposits** (Crypto → TBC):
```
External Wallet
    ↓ [ChangeNOW/NOWPayments]
TON/Other Crypto
    ↓ [TONCO DEX swap]
TBC
    ↓ [to user's card]
User NFT Card
```

**External Withdrawals** (TBC → Crypto):
```
User NFT Card
    ↓ [user initiates]
TBC
    ↓ [TONCO DEX swap]
TON/Other Crypto
    ↓ [ChangeNOW/NOWPayments]
External Wallet
```

### 4. Liquidity Flow

**TBC/TON Liquidity Pool (TONCO)**:
- Primary price discovery mechanism
- Enables TBC ↔ TON swaps
- Decentralized liquidity provision
- No protocol-owned liquidity

**Integration Points**:
- Backend monitors pool prices for exchange rates
- Frontend uses pool for swap quotes
- External gateways use pool for conversions

### 5. Lending & Collateral (Future)

**Design Principles**:
- **TON** is used as collateral, NOT TBC
- Lending logic in separate smart contracts
- NFT ownership signals credit worthiness
- No protocol-issued debt

## External Integrations

### ChangeNOW
- **Role**: External swap and payment gateway
- **Integration**: API-based
- **Trust Model**: Third-party service, non-custodial on protocol side
- **Use Case**: Crypto on/off ramps

### NOWPayments
- **Role**: Crypto payment processing
- **Integration**: API-based
- **Trust Model**: Third-party service
- **Use Case**: Merchant payments, card top-ups

### CoinRabbit
- **Role**: Collateral-based lending
- **Integration**: API-based
- **Trust Model**: Third-party service
- **Use Case**: External lending against crypto collateral

### TONCO DEX
- **Role**: Primary liquidity provider for TBC
- **Integration**: On-chain smart contract interaction
- **Trust Model**: Decentralized, non-custodial
- **Use Case**: TBC/TON swaps, price discovery

## Backend Responsibilities

### Indexer
- Monitor blockchain events
- Track NFT ownership changes
- Index TBC transfers
- Maintain off-chain cache for performance

**Boundaries**:
- ✅ Read blockchain state
- ✅ Provide query endpoints
- ❌ Initiate transactions on behalf of users
- ❌ Store private keys

### Merchant API
- Accept payment requests
- Generate payment links
- Track payment status
- Webhook notifications

**Boundaries**:
- ✅ Orchestrate payment flows
- ✅ Communicate with external gateways
- ❌ Control user funds
- ❌ Execute transfers without user signature

### Internal Services
- Exchange rate monitoring
- Transaction processing coordination
- Analytics and reporting

## Frontend Responsibilities

### Merchant Widget
- Embed payment forms
- Display payment status
- Handle user interactions
- Communicate with Merchant API

### Wallet UI (Future)
- View card balances
- Initiate transfers
- Manage NFT cards
- Connect via TON Connect

**Boundaries**:
- ✅ User interface and UX
- ✅ Transaction signing (user-controlled)
- ❌ Private key storage
- ❌ Server-side transaction execution

## Security Architecture

### Access Control Layers

1. **Smart Contract Level**:
   - NFT ownership = account authority
   - No admin roles for fund control
   - Immutable logic post-deployment

2. **Backend Level**:
   - Stateless operations
   - Read-only blockchain access
   - API authentication for merchants

3. **Frontend Level**:
   - TON Connect for wallet integration
   - Client-side transaction signing
   - No private key handling

### Trust Boundaries

```
High Trust (On-Chain)
├── NFT Ownership
├── TBC Balances
└── Smart Contract Logic

Medium Trust (Off-Chain)
├── Backend Indexer (read-only)
├── Merchant API (orchestration)
└── Frontend UI (presentation)

Low Trust (External)
├── ChangeNOW
├── NOWPayments
└── CoinRabbit
```

## Data Flow

### Read Path (Balance Query)
```
User → Frontend → Backend API → Indexer → Response
                       ↓
                 TON Blockchain (fallback)
```

### Write Path (Transfer)
```
User → Frontend → TON Connect → User Wallet → Sign Transaction
                                      ↓
                              TON Blockchain
                                      ↓
                              Smart Contract Execution
                                      ↓
                              Indexer (event capture)
                                      ↓
                              Backend API (notification)
                                      ↓
                              Frontend (update UI)
```

## Protocol Economics

### Fee Structure

| Operation | Fee | Recipient |
|-----------|-----|-----------|
| Internal TBC Transfer | Zero | N/A |
| External Deposit | External gateway fee | Gateway |
| External Withdrawal | External gateway fee + DEX slippage | Gateway + LP |
| DEX Swap | TONCO pool fee (typically 0.3%) | Liquidity Providers |

### Value Flows

- **TBC Token**: Internal settlement, price discovery via TONCO
- **TON Token**: Gas fees, collateral, liquidity pairing
- **External Crypto**: On/off ramp via gateways

## Scalability Considerations

### Current State
- NFT cards: Multiple collections deployed
- TBC token: Single jetton contract
- Liquidity: Single TBC/TON pool on TONCO

### Future Expansion Paths
- Additional NFT card series
- Multiple liquidity pools (different DEXs)
- Layer-2 payment channels (if needed)
- Sharded account contracts (TON native sharding)

## Governance Model

### Smart Contracts
- **Immutable**: No upgrades post-deployment
- **Transparent**: All code auditable on-chain
- **No Admin Keys**: Cannot change core logic

### Off-Chain Components
- **Open Development**: All changes via GitHub
- **Issue-Driven**: One Issue = One PR
- **AI-Compatible**: Clear specifications for automation
- **Review Required**: No direct main branch commits

## Development Workflow

See `CONTRIBUTING.md` for detailed development rules.

### Key Points
1. All changes start with an Issue
2. Each PR must reference an Issue
3. No custody or admin controls allowed
4. Security-first code review
5. Tests required for smart contracts
6. Documentation updated with code

## Future Architecture Components

### Not Yet Implemented

1. **Payment Hub Contract**: Escrow and payment routing
2. **Lending Adapters**: Interface to collateral systems
3. **Multi-Sig Cards**: Shared account NFTs
4. **Recurring Payments**: Subscription contract layer
5. **Merchant Dashboard**: Full-featured merchant portal

### Design Constraints for Future Work

- Must maintain non-custodial architecture
- Cannot introduce admin fund controls
- Must be compatible with existing contracts
- Should leverage TON's native features
- Prefer composability over monoliths

## References

- [TON Documentation](https://docs.ton.org/)
- [TON Connect](https://docs.ton.org/ecosystem/ton-connect/overview)
- [TONCO DEX](https://app.tonco.io/)
- [Existing Contracts](./existing-contracts.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Document Status**: Initial architecture baseline (Issue #2)
**Last Updated**: 2024
**Maintainers**: Tonbankcard Protocol Team
