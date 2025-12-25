# Tonbankcard Protocol Governance & Development Flow

## Overview

This document defines the governance model, protocol principles, and development workflow for the Tonbankcard Protocol. It serves as the authoritative reference for all contributors, including human developers and AI assistants.

## Protocol Principles

### 1. Non-Custodial Architecture (MANDATORY)

The protocol **MUST** maintain complete non-custodial operation at all times.

**Requirements**:
- ✅ Users own their private keys
- ✅ Users control all fund movements
- ✅ On-chain balances are user-owned
- ✅ Transactions require user signatures

**Prohibitions**:
- ❌ No protocol custody of user funds
- ❌ No admin withdrawal capabilities
- ❌ No forced transfers
- ❌ No balance manipulation by operators
- ❌ No private key storage in backend/frontend

**Rationale**: User sovereignty is the foundation of the protocol. Any violation of non-custodial principles fundamentally breaks the trust model.

### 2. NFT as Account Abstraction

Each NFT card represents a unique account within the Tonbankcard ecosystem.

**Design Principles**:
- NFT ownership = account authority
- One NFT = one account identifier (card number)
- Balances are **separate** from NFT (stored in TBC token contract)
- NFTs may be soulbound (non-transferable) or transferable depending on card type

**What NFT Controls**:
- ✅ Account identity
- ✅ Access to account operations
- ✅ Ownership verification

**What NFT Does NOT Control**:
- ❌ Direct balance storage (delegated to TBC jetton)
- ❌ Transfer logic (delegated to TBC jetton)
- ❌ Global protocol rules

### 3. TBC Token as Settlement Layer

TBC is the internal settlement token for the protocol.

**Design Principles**:
- Standard TON jetton (fungible token)
- Internal transfers between cards have **zero protocol fees**
- External swaps use DEX (TONCO) for price discovery
- No protocol-owned TBC reserves required

**Economic Rules**:
- TBC supply is managed by jetton contract
- Price is determined by free market (TONCO DEX)
- No protocol price pegs or stability mechanisms
- No minting/burning by protocol operators

### 4. On-Chain as Source of Truth

The blockchain is the **single source of truth** for all protocol state.

**Hierarchy of Truth**:
1. **Smart Contracts**: Authoritative state (balances, ownership, transfers)
2. **Indexer/Backend**: Read-only cache for performance
3. **Frontend**: Presentation layer only

**Rules**:
- Backend **MAY** cache blockchain data for speed
- Backend **MUST** treat blockchain as authoritative on conflicts
- Backend **CANNOT** execute transactions without user signature
- Frontend **MUST** use TON Connect or similar for wallet integration

### 5. Immutable Contracts

Core protocol smart contracts are **immutable** after deployment.

**Rationale**:
- Prevents rug pulls and admin takeovers
- Enables trustless operation
- Simplifies security audits
- Aligns with non-custodial philosophy

**Implications**:
- No upgradeable proxies for core contracts (TBC, NFT cards)
- Bug fixes require new deployments and migration
- High testing standards before deployment
- Consider future extensibility during initial design

**Exceptions**:
- Peripheral contracts (e.g., merchant API adapters) MAY be upgradeable
- Upgrade keys MUST be multi-sig or DAO-controlled
- Upgrades MUST NOT affect user fund custody

### 6. TON as Collateral (Not TBC)

For any lending or credit features, **TON** is the collateral asset, not TBC.

**Rationale**:
- TON has established market liquidity
- TBC is settlement layer, not investment asset
- Avoids circular collateral dependencies
- Reduces protocol-specific risk

**Design Constraint**:
- Lending contracts accept TON deposits
- Collateral valuations use TON/USD or TON/TBC prices
- TBC is borrowed/lent, TON is collateral

### 7. Privacy by Default

User balances and transaction histories should be private by default where possible.

**Current State**:
- TON blockchain is public (all transactions visible)
- Privacy is limited by L1 constraints

**Future Considerations**:
- Zero-knowledge proofs for balance privacy
- Private payment channels
- Opt-in disclosure for merchant payments

**Principle**:
- Maximize privacy within TON's technical constraints
- Never add unnecessary public exposure
- Support future privacy upgrades

### 8. Deterministic and Auditable

All protocol operations must be deterministic and auditable.

**Requirements**:
- Smart contract code is open source
- Deployment addresses are public
- Transaction logic is reproducible
- No hidden parameters or admin functions

**Benefits**:
- Community can verify correctness
- AI can assist with development
- Security researchers can audit
- Reduces trust assumptions

## Governance Model

### Smart Contract Governance

**Phase 1: Foundation (Current)**
- Contracts deployed by core team
- Immutable after deployment
- No on-chain governance required

**Phase 2: Expansion (Future)**
- New contracts follow same immutability principle
- Multi-sig for deployment keys
- Community review before deployment

**Phase 3: Decentralization (Long-term)**
- DAO governance for protocol parameters
- Community-driven development
- Transparent proposal and voting system

### Off-Chain Governance

**Repository Management**:
- GitHub as primary collaboration platform
- Issue-driven development
- PR-based code review
- Maintainer approval required for merges

**Decision Making**:
- Technical decisions: Core team + community input
- Security decisions: Security council (if formed)
- Economic parameters: Community discussion + core team

## Development Workflow

### Issue → PR Flow

**All development MUST follow this workflow**:

```
1. Issue Created
   ↓
2. Discussion & Clarification
   ↓
3. Approval to Proceed
   ↓
4. Implementation on Feature Branch
   ↓
5. Pull Request Submitted
   ↓
6. Code Review
   ↓
7. CI Checks Pass
   ↓
8. Approval & Merge
```

### Issue Requirements

Each Issue **MUST** include:

1. **Goal**: What problem is being solved
2. **Context**: Why this is needed
3. **Scope**: What is included (In Scope)
4. **Out of Scope**: What is NOT included
5. **Acceptance Criteria**: How to verify completion
6. **References**: Links to related issues, docs, contracts

**Issue Template**: See `.github/ISSUE_TEMPLATE/`

### Pull Request Requirements

Each PR **MUST**:

1. Reference an Issue (link with `Fixes #123`)
2. Follow PR template (`.github/pull_request_template.md`)
3. Include tests (for smart contracts) or justification for absence
4. Update documentation if needed
5. Pass CI checks
6. Receive at least one approving review

**PR Template**: See `.github/pull_request_template.md`

### Branch Strategy

**Main Branch**:
- Name: `main`
- Protected: Direct pushes prohibited
- Represents production-ready code
- Deploys are tagged from `main`

**Feature Branches**:
- Naming: `issue-{number}-{short-description}` or `feature/{name}`
- Created from `main`
- Merged back to `main` via PR
- Deleted after merge

**Release Tags**:
- Format: `v{major}.{minor}.{patch}` (e.g., `v1.0.0`)
- Tagged from `main` branch
- Immutable after creation

### Code Review Standards

**All PRs are reviewed for**:

1. **Architectural Alignment**:
   - Does it follow protocol principles?
   - Does it fit the documented architecture?
   - Is it necessary for the Issue goal?

2. **Security**:
   - No custody violations
   - No admin fund controls
   - Proper access control
   - Reentrancy protection (smart contracts)
   - Input validation

3. **Scope Compliance**:
   - Only implements what Issue specified
   - No "helpful" additions
   - No economic changes without explicit approval
   - No breaking changes without discussion

4. **Code Quality**:
   - Clear, readable code
   - Appropriate comments
   - Tests for critical logic
   - Documentation updates

### AI-Bot Specific Rules

AI contributors (including automated bots) **MUST**:

1. **Strictly Follow Issue Scope**:
   - Implement only what is explicitly specified
   - Do not infer or add "helpful" features
   - Ask for clarification rather than assume

2. **Include Full Documentation**:
   - Comment non-obvious logic
   - Update README/docs as needed
   - Provide reasoning in PR description

3. **Security First**:
   - Never introduce custody
   - Never add admin controls
   - Never change economic rules without explicit permission

4. **Testing**:
   - Smart contracts MUST have tests
   - Backend code SHOULD have tests
   - Frontend code tests optional but encouraged

**Violations**: PRs that violate these rules will be rejected immediately.

## Component Responsibilities

### Smart Contracts

**Allowed**:
- Execute user-signed transactions
- Maintain on-chain state
- Enforce protocol rules
- Emit events for indexing

**Prohibited**:
- Admin withdrawal of user funds
- Forced transfers
- Balance manipulation
- Arbitrary logic upgrades

### Backend Services

**Allowed**:
- Index blockchain events
- Cache data for performance
- Provide API endpoints
- Orchestrate multi-step flows
- Communicate with external services

**Prohibited**:
- Store private keys
- Execute transactions without user signature
- Act as source of truth over blockchain
- Custody user funds

### Frontend Applications

**Allowed**:
- Display user interfaces
- Request wallet signatures (TON Connect)
- Call backend APIs
- Show balance/transaction data

**Prohibited**:
- Store private keys
- Sign transactions server-side
- Execute transfers without user approval
- Bypass wallet signature flow

## External Integration Principles

### Third-Party Services (ChangeNOW, NOWPayments, CoinRabbit)

**Integration Rules**:
- Protocol does NOT custody funds on behalf of third parties
- Users interact directly with third-party APIs when needed
- Backend MAY orchestrate flows but NOT hold funds
- All transactions are user-initiated

**Trust Model**:
- Third parties are NOT trusted with protocol security
- Users opt-in to third-party services
- Protocol remains functional without third parties

### DEX Integration (TONCO)

**Integration Rules**:
- Protocol does NOT own liquidity
- Users/LPs provide liquidity independently
- Price discovery is decentralized
- No protocol-owned trading bots

## Security Disclosure Policy

### Reporting Vulnerabilities

**DO NOT** open public GitHub issues for security vulnerabilities.

**Process**:
1. Contact core team via private channel (TBD)
2. Provide detailed vulnerability description
3. Wait for acknowledgment (target: 48 hours)
4. Coordinate on fix and disclosure timeline

### Severity Levels

**Critical**:
- User fund loss possible
- Smart contract exploit
- Private key exposure

**High**:
- Incorrect balance display
- Transaction processing errors
- Authorization bypass

**Medium**:
- Information disclosure
- DoS on backend
- UX issues affecting security

**Low**:
- Minor bugs
- Performance issues
- Documentation errors

### Bounty Program

Bounty program details will be announced in future updates.

## Development Phases

### Phase 1: Foundation (Current)

**Goals**:
- [x] Deploy core contracts (TBC, NFT cards)
- [x] Establish liquidity (TONCO)
- [x] Document architecture
- [x] Define governance

**Status**: Complete (this Issue #2)

### Phase 2: Payment Infrastructure

**Goals**:
- [ ] Payment hub smart contract
- [ ] Merchant API backend
- [ ] Payment widget frontend
- [ ] Indexer service
- [ ] Comprehensive testing

**Status**: Not started

### Phase 3: User Experience

**Goals**:
- [ ] Wallet UI
- [ ] Mobile app
- [ ] Enhanced merchant dashboard
- [ ] Analytics and reporting

**Status**: Not started

### Phase 4: Advanced Features

**Goals**:
- [ ] Lending protocol adapters
- [ ] Multi-sig card contracts
- [ ] Recurring payment contracts
- [ ] Cross-chain bridge integration

**Status**: Not started

## Contribution Guidelines Summary

For detailed contribution guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md).

**Key Points**:
1. All changes via Issues and PRs
2. No direct `main` branch commits
3. Follow non-custodial principles strictly
4. Security review for all smart contracts
5. Tests required for critical logic
6. Documentation updated with code

## References

- [Architecture Documentation](./architecture.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Existing Contracts](./existing-contracts.md)
- [PR Template](../.github/pull_request_template.md)

---

**Document Status**: Initial governance baseline (Issue #2)
**Last Updated**: 2024
**Maintainers**: Tonbankcard Protocol Team
