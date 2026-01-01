# Governance Contracts

## Overview

This directory contains the **non-executable governance** contracts for the Tonbankcard Protocol. These contracts implement a public proposal registry, snapshot verification, and helper utilities for the TBC Diamonds NFT governance system.

> **CRITICAL**: These contracts provide **information only**. They have **NO execution capability**, **NO fund custody**, and **NO protocol control**.

## Core Principle

```
Governance may SIGNAL, but never ACT.
```

All governance contracts follow these principles:

1. **Advisory Only**: No binding execution
2. **Non-Custodial**: No fund custody
3. **Read-Only State Impact**: No changes to protocol state
4. **Transparent**: All logic is open source
5. **Minimal**: Simplest possible implementation

## Contracts

### ProposalRegistry.tact

The main governance contract that manages proposals and voting.

**Purpose**: Public proposal registry for recording governance intent and voting outcomes.

**Features:**
- Submit proposals (requires TBC Diamond NFT ownership)
- Cast votes (1 NFT = 1 vote)
- Finalize proposals after voting window
- Query proposal status and vote counts

**Public Functions:**

| Function | Description |
|----------|-------------|
| `SubmitProposal` | Register a new governance proposal |
| `CastVote` | Cast a vote on an active proposal |
| `FinalizeProposal` | Finalize a proposal after voting ends |

**Get Methods:**

| Method | Description |
|--------|-------------|
| `getProposal(id)` | Get proposal by ID |
| `getProposalCount()` | Get total number of proposals |
| `hasVoted(proposal_id, nft_id)` | Check if NFT has voted |
| `getProposalStatus(id)` | Get proposal status |
| `getVoteCounts(id)` | Get FOR/AGAINST/ABSTAIN counts |
| `isVotingOpen(id)` | Check if voting is open |

### SnapshotVerifier.tact

Verifies NFT ownership at snapshot time for voting eligibility.

**Purpose**: Snapshot-based eligibility verification for fair voting.

**Features:**
- Register ownership snapshots at voting start
- Verify voter eligibility
- Query snapshot metadata

**Get Methods:**

| Method | Description |
|--------|-------------|
| `isEligible(proposal_id, nft_id)` | Check if NFT was eligible at snapshot |
| `getSnapshot(proposal_id)` | Get snapshot metadata |
| `hasSnapshot(proposal_id)` | Check if snapshot exists |
| `getEligibleCount(proposal_id)` | Get number of eligible voters |

### diamond_resolver.fc

**Purpose**: Read-only helper for TBC Diamonds NFT ownership resolution and vote counting.

**Type**: Stateless, informational contract

**Functions**:
- Query TBC Diamonds collection metadata
- Validate Diamond NFT indices
- Calculate quorum requirements
- Compute voting outcomes
- Provide governance helper methods

**What It DOES**:
- Validates Diamond NFT indices (0-221)
- Calculates quorum and vote tallies
- Returns governance metadata
- Performs read-only computations

**What It DOES NOT Do**:
- Execute governance decisions
- Control protocol contracts
- Custody funds or NFTs
- Transfer assets
- Modify protocol state
- Enforce voting outcomes

## Security Properties

| Property | Status |
|----------|--------|
| Fund Custody | None |
| Execution Capability | None |
| Protocol Control | None |
| State Modification | None |
| Admin Keys | None |
| Upgrade Proxies | None |

**Risk Level**: **MINIMAL** (read-only, stateless, non-custodial)

## Proposal Categories

The registry supports exactly 6 fixed categories:

| Code | Category | Description |
|------|----------|-------------|
| 0 | ROADMAP_SIGNAL | Protocol development direction |
| 1 | INTEGRATION_RECOMMENDATION | Recommend external integrations |
| 2 | DOCUMENTATION_UPDATE | Documentation changes |
| 3 | RISK_DISCLOSURE | Flag risks or security concerns |
| 4 | DEPRECATION_NOTICE | Signal deprecation intent |
| 5 | ECOSYSTEM_GRANT_SIGNAL | Support for ecosystem grants |

**No custom categories are allowed.**

## Proposal Lifecycle

```
1. DRAFT (Off-Chain)
   └── Community discussion

2. SUBMISSION
   └── Author owns Diamond NFT
   └── Proposal hash registered
   └── Voting window set

3. VOTING
   └── 1 NFT = 1 vote
   └── Snapshot-based eligibility
   └── Fixed voting window

4. FINALIZATION
   └── ACCEPTED / REJECTED / NO_QUORUM
   └── Outcome is immutable
```

## Proposal States

| Status | Code | Description |
|--------|------|-------------|
| ACTIVE | 0 | Voting is open |
| ACCEPTED | 1 | Majority FOR, quorum met |
| REJECTED | 2 | Majority AGAINST, quorum met |
| NO_QUORUM | 3 | Quorum not met |

## Vote Types

| Vote | Code | Description |
|------|------|-------------|
| FOR | 0 | Support the proposal |
| AGAINST | 1 | Oppose the proposal |
| ABSTAIN | 2 | Neither support nor oppose |

## Configuration

### Default Values

- **Voting Duration**: 7 days (604800 seconds)
- **Quorum Threshold**: 22 votes (10% of 222 NFTs)
- **Total Diamond Supply**: 222 NFTs

### TBC Diamonds

- **Total Supply**: 222 NFTs
- **Voting Power**: 1 NFT = 1 vote
- **No Delegation**: By design
- **No Fractionalization**: Each NFT = exactly 1 vote

## Security Constraints

The contracts enforce:

1. **Append-Only**: Proposals cannot be modified or deleted
2. **No Admin Override**: No privileged role can alter outcomes
3. **Immutable After Finalization**: Final status cannot change
4. **No Execution Engine**: Cannot trigger any contract calls
5. **Privacy-Preserving**: Voter NFT IDs not exposed in events

## What These Contracts CANNOT Do

- Execute protocol changes
- Modify smart contracts
- Control user funds
- Freeze accounts
- Override security measures
- Enforce voting outcomes

## Usage

### Off-Chain (Snapshot Scripts)

Primary usage is via off-chain snapshot utilities:

```bash
# Create voter snapshot
npm run governance:snapshot

# Verify snapshot
npm run governance:verify-snapshot snapshot_12345678.json
```

See `scripts/governance/` for snapshot utilities.

### On-Chain (Get Methods)

Read-only queries from other contracts or off-chain tools:

```func
;; Get governance metadata
(int total_supply, slice collection, int type) = resolver.get_governance_metadata();

;; Calculate quorum
int quorum = resolver.get_quorum_requirement(10);  ;; 10% quorum

;; Calculate vote outcome
(int quorum_met, int passed, int for_pct) = resolver.calculate_vote_outcome(
    votes_for,
    votes_against,
    votes_abstain,
    10  ;; 10% quorum requirement
);
```

## Integration

### Submitting a Proposal

```typescript
// Off-chain: Prepare proposal content and hash
const proposalContent = {
  title: "Proposal Title",
  description: "Detailed description...",
  category: "ROADMAP_SIGNAL"
};
const metadataHash = sha256(JSON.stringify(proposalContent));

// Submit to registry
await registry.send(
  sender,
  { value: toNano("0.05") },
  {
    $$type: "SubmitProposal",
    metadata_hash: metadataHash,
    author_nft_id: 42n, // Author's Diamond NFT ID
    category: 0n, // ROADMAP_SIGNAL
    voting_duration: 0n, // Use default (7 days)
    quorum_threshold: 0n // Use default (22 votes)
  }
);
```

### Casting a Vote

```typescript
await registry.send(
  sender,
  { value: toNano("0.05") },
  {
    $$type: "CastVote",
    proposal_id: 1n,
    voter_nft_id: 15n, // Voter's Diamond NFT ID
    vote: 0n // FOR
  }
);
```

### Finalizing a Proposal

```typescript
await registry.send(
  sender,
  { value: toNano("0.05") },
  {
    $$type: "FinalizeProposal",
    proposal_id: 1n
  }
);
```

## Events

### ProposalSubmitted
Emitted when a new proposal is registered.

### VoteCast
Emitted when a vote is cast (NFT ID not included for privacy).

### ProposalFinalized
Emitted when a proposal is finalized with final outcome.

## Testing

Tests are located in `tests/governance/`:

- `ProposalRegistry.spec.ts` - Proposal submission and management
- `SnapshotVerifier.spec.ts` - Snapshot verification
- `DiamondGovernance.spec.ts` - Diamond resolver tests

Run tests:
```bash
npx blueprint test tests/governance/
```

## Documentation

- [Governance Process](../../docs/governance-process.md) - Full governance documentation
- [DAO Governance](../../docs/dao-governance.md) - Complete DAO governance framework
- [Development Governance](../../docs/governance.md) - Development workflow
- [Issue #38](https://github.com/xlabtg/tonbankcard-protocol/issues/38) - Proposal Registry implementation
- [Issue #36](https://github.com/xlabtg/tonbankcard-protocol/issues/36) - TBC Diamonds DAO

## Contributing

All changes to governance contracts require:

1. **Issue Creation**: Describe proposed change
2. **Security Review**: Governance changes are security-sensitive
3. **Community Discussion**: Governance affects all stakeholders
4. **Tests**: Comprehensive test coverage required
5. **Documentation**: Update this README and governance docs

**Never Add**:
- Execution capabilities
- Fund custody
- Protocol control
- State modification
- Admin privileges

## Legal Disclaimer

This governance system:

1. Does **NOT** create binding legal obligations
2. Does **NOT** constitute a DAO with legal personhood
3. Does **NOT** represent investment or financial advice
4. Is for **coordination purposes only**
5. Outcomes are **advisory signals**, not enforceable decisions

---

**Remember**: If governance can break the protocol, the protocol is badly designed.

TONBANKCARD is designed so governance **cannot** break it.

---

**Status**: Issue #38 Implementation
**Maintainers**: Tonbankcard Protocol Team
