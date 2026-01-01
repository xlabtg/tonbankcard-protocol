# Governance Process & Proposal Registry

## Overview

This document defines the **formal, transparent, non-executable governance process** and **public proposal registry** for the Tonbankcard Protocol. The governance system uses **TBC Diamonds NFT** (222 total supply) as the governance asset.

> **Core Principle**: Governance may **signal**, but never **act**.

## Advisory Nature (IMPORTANT DISCLAIMER)

This governance system is **purely advisory**. It:

- **DOES** record governance intent
- **DOES** enable verifiable voting
- **DOES** preserve immutable voting outcomes
- **DOES NOT** trigger contract calls
- **DOES NOT** execute changes
- **DOES NOT** enforce outcomes
- **DOES NOT** control protocol operations

Voting outcomes are informational signals to the community and core team. They carry no automatic enforcement mechanism.

## Governance Asset

### TBC Diamonds NFT

- **Total Supply**: 222 NFTs
- **Voting Power**: 1 NFT = 1 vote
- **No Delegation**: Votes cannot be delegated by default
- **No Fractionalization**: Each NFT represents exactly 1 vote
- **Ownership**: Resolved on-chain at snapshot time

## Proposal Categories (Fixed Enum)

The registry supports exactly **6 proposal categories**. No custom categories are allowed.

| Category | Code | Description |
|----------|------|-------------|
| ROADMAP_SIGNAL | 0 | Signal preferences for protocol development direction |
| INTEGRATION_RECOMMENDATION | 1 | Recommend integrations with external services or protocols |
| DOCUMENTATION_UPDATE | 2 | Propose documentation changes or improvements |
| RISK_DISCLOSURE | 3 | Flag potential risks or security concerns |
| DEPRECATION_NOTICE | 4 | Signal intent to deprecate features or contracts |
| ECOSYSTEM_GRANT_SIGNAL | 5 | Signal support for ecosystem grants (off-chain execution) |

## Proposal Lifecycle

### Phase 1: Draft (Off-Chain)

- **Location**: Off-chain forums, Discord, GitHub Discussions
- **Duration**: Community-determined
- **Requirements**: None (informal discussion)
- **Protocol Involvement**: None

During this phase, community members discuss ideas informally before submitting them for on-chain voting.

### Phase 2: Submission

- **Action**: Proposal hash registered on-chain
- **Requirement**: Author must own at least 1 TBC Diamond NFT
- **Recorded Data**:
  - Proposal hash (SHA-256)
  - Author Diamond NFT ID
  - Proposal category (fixed enum)
  - Voting window start/end
  - Proposal metadata hash (IPFS or similar)

### Phase 3: Voting

- **Voting Power**: 1 Diamond NFT = 1 vote
- **Snapshot**: Ownership snapshot taken at voting start
- **Duration**: Fixed voting window (e.g., 7 days)
- **Options**: FOR, AGAINST, ABSTAIN
- **Quorum**: Configurable minimum participation threshold

### Phase 4: Finalization

- **Action**: Voting outcome published on-chain
- **Final States**:
  - `ACCEPTED` - Majority voted FOR and quorum met
  - `REJECTED` - Majority voted AGAINST or quorum met with negative result
  - `NO_QUORUM` - Quorum threshold not met
- **Immutability**: Final outcome cannot be changed

## Registry Scope

### What the Registry RECORDS

| Data | Stored | Notes |
|------|--------|-------|
| Proposal metadata hash | ✅ | Hash of off-chain proposal content |
| Author NFT ID | ✅ | Diamond NFT ID (not wallet address) |
| Category | ✅ | Fixed enum (0-5) |
| Voting window | ✅ | Start and end timestamps |
| Final outcome | ✅ | ACCEPTED/REJECTED/NO_QUORUM |
| Vote counts | ✅ | Aggregated totals only |

### What the Registry DOES NOT Record

| Data | Reason |
|------|--------|
| Voter identities | Privacy preservation |
| Wallet addresses | NFT ID is sufficient |
| Voting timestamps | Privacy preservation |
| Execution instructions | Non-executable by design |
| Individual vote records | Privacy preservation |

## Security Constraints

The registry enforces the following security invariants:

1. **Append-Only**: New proposals can be added, but existing proposals cannot be modified
2. **No Deletion**: Proposals cannot be removed from the registry
3. **No Admin Override**: No privileged role can alter proposal outcomes
4. **No Mutation After Finalization**: Once finalized, proposal state is immutable
5. **No Execution Engine**: Registry has no ability to execute any contract calls

## Identity Resolution

### Proposal Authors

- Authors are identified by their **Diamond NFT ID**, not wallet address
- Author must own the NFT at the time of submission
- Ownership verified via on-chain NFT state query

### Voters

- Voters resolved via ownership snapshot at voting start
- Each NFT ID can vote once per proposal
- NFT ownership changes after snapshot do not affect voting eligibility

## Technical Implementation

### Proposal Registry Contract

The proposal registry is implemented as a read-only index with append-only operations.

**Stored Data Structure**:
```
Proposal {
    id: uint64                    // Auto-incrementing proposal ID
    metadata_hash: uint256        // SHA-256 hash of off-chain content
    author_nft_id: uint64         // Diamond NFT ID
    category: uint8               // 0-5 (fixed enum)
    voting_start: uint64          // Unix timestamp
    voting_end: uint64            // Unix timestamp
    status: uint8                 // 0=ACTIVE, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
    votes_for: uint64             // Total FOR votes
    votes_against: uint64         // Total AGAINST votes
    votes_abstain: uint64         // Total ABSTAIN votes
    quorum_threshold: uint64      // Minimum votes required
}
```

### Snapshot Verifier

The snapshot verifier allows verification of NFT ownership at a specific point in time:

- Queries historical NFT ownership state
- Returns set of Diamond NFT IDs owned at snapshot
- Used to validate voter eligibility
- Read-only, no state modifications

## Governance Limitations (Explicit)

### What Governance CAN Do

1. Signal community preferences on protocol direction
2. Recommend (not enforce) integrations
3. Highlight risks for human review
4. Express intent for off-chain actions

### What Governance CANNOT Do

1. Modify smart contract code
2. Upgrade deployed contracts
3. Freeze or seize user accounts
4. Control user funds
5. Override protocol security
6. Force any on-chain action

## Attack Surface Awareness

The following attack vectors are **acknowledged but not mitigated on-chain**:

| Attack Vector | Description | Mitigation Approach |
|---------------|-------------|---------------------|
| Vote Buying | Paying NFT holders to vote a certain way | Social transparency |
| Temporary NFT Borrowing | Borrowing NFTs just for voting | Snapshot timing awareness |
| Off-Chain Coordination | Private vote coordination | Community vigilance |
| Flash Loan Attacks | N/A (snapshot-based) | Snapshot taken before voting |
| Sybil Attacks | Limited by fixed 222 NFT supply | Supply cap is protection |

**Important**: These attacks are mitigated through **social transparency**, not code enforcement.

## Integration with Protocol

### Read-Only Interface

The proposal registry provides the following read-only methods:

```
// Get proposal by ID
get_proposal(proposal_id: uint64) -> Proposal

// Get total proposal count
get_proposal_count() -> uint64

// Get proposals by category
get_proposals_by_category(category: uint8) -> Proposal[]

// Get proposals by status
get_proposals_by_status(status: uint8) -> Proposal[]

// Get proposals by author NFT ID
get_proposals_by_author(author_nft_id: uint64) -> Proposal[]

// Verify voter eligibility at snapshot
verify_voter_eligibility(proposal_id: uint64, nft_id: uint64) -> bool
```

### Event Emission

The registry emits events for indexing:

- `ProposalSubmitted`: New proposal registered
- `VotingStarted`: Voting window opened
- `VoteCast`: Vote registered (NFT ID obfuscated)
- `ProposalFinalized`: Final outcome recorded

## Compliance & Legal Notice

This governance system:

1. Does **NOT** create binding legal obligations
2. Does **NOT** constitute a DAO with legal personhood
3. Does **NOT** represent investment or financial advice
4. Is for **coordination purposes only**
5. Outcomes are **advisory signals**, not enforceable decisions

Users participating in governance should understand that outcomes are purely informational.

## Relation to Other Issues

This governance process depends on:

- **Issue 7.1**: Governance DAO (TBC Diamonds) - Defines the governance asset
- **Issues 4.x**: Security & Neutrality Baseline - Ensures non-executable design

## Document History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2025-12-28 | Initial governance process definition |

---

**Document Status**: Issue #38 Implementation
**Maintainers**: Tonbankcard Protocol Team
