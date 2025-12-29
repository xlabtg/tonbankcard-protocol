# Governance Contracts

This directory contains the governance-related smart contracts for the Tonbankcard Protocol.

## Overview

The governance layer provides a **non-executable, advisory-only** governance system for TONBANKCARD. Governance outcomes do not execute protocol changes - they serve as community signals only.

### Core Principle

> **Governance must be observable, not actionable.**

Transparency exists to **build trust**, not to **exercise power**.

## Contracts

### TransparencyRegistry (Issue #40)

**Status**: Implemented
**File**: `TransparencyRegistry.tact`
**Purpose**: Read-only transparency layer for governance activity

The TransparencyRegistry provides public, immutable, read-only access to governance data without exposing private information or granting any execution power.

**Features:**
- Proposal archive (ID, hash, category, window, outcome)
- Voting summaries (aggregated only, no individual votes)
- Governance asset snapshots (TBC Diamond NFT supply)
- Historical record keeping
- Event emission for off-chain indexing

**Privacy Guarantees:**
- No wallet addresses exposed
- No NFT holder identities exposed
- No vote timestamps exposed
- No individual vote choices exposed
- No delegation graphs exposed

**Security Properties:**
- Zero protocol authority
- No mutable state (append-only records)
- No admin functions
- Cannot influence voting or execute outcomes

## Directory Structure

```
contracts/governance/
├── README.md                              # This file
├── TransparencyRegistry.tact              # Main transparency contract
├── types/
│   └── TransparencyTypes.tact             # Data structures and constants
└── interfaces/
    └── ITransparencyRegistry.tact         # Read-only interface
```

## Data Structures

### ProposalSummary

Privacy-preserving proposal record:

```tact
struct ProposalSummary {
    proposal_id: Int as uint64;
    proposal_hash: Int as uint256;
    category: Int as uint8;
    voting_window_start: Int as uint32;
    voting_window_end: Int as uint32;
    outcome: Int as uint8;
}
```

### VotingSummary

Aggregated voting data (no individual voter information):

```tact
struct VotingSummary {
    proposal_id: Int as uint64;
    total_votes_cast: Int as uint16;
    quorum_threshold: Int as uint16;
    quorum_met: Bool;
    passed: Bool;
}
```

### AssetSnapshot

Governance asset snapshot:

```tact
struct AssetSnapshot {
    total_supply: Int as uint16;           // Fixed: 222
    snapshot_block_height: Int as uint64;
    snapshot_hash: Int as uint256;
}
```

## Constants

### Proposal Outcomes

| Constant | Value | Description |
|----------|-------|-------------|
| `OUTCOME_PENDING` | 0 | Voting in progress |
| `OUTCOME_ACCEPTED` | 1 | Proposal passed |
| `OUTCOME_REJECTED` | 2 | Proposal failed |
| `OUTCOME_NO_QUORUM` | 3 | Insufficient participation |

### Proposal Categories

| Constant | Value | Description |
|----------|-------|-------------|
| `CATEGORY_ROADMAP_SIGNAL` | 0 | Roadmap direction signals |
| `CATEGORY_INTEGRATION_RECOMMENDATION` | 1 | Integration suggestions |
| `CATEGORY_DOCUMENTATION_UPDATE` | 2 | Documentation changes |
| `CATEGORY_RISK_DISCLOSURE` | 3 | Risk notifications |
| `CATEGORY_DEPRECATION_NOTICE` | 4 | Deprecation announcements |
| `CATEGORY_ECOSYSTEM_GRANT_SIGNAL` | 5 | Grant recommendations |

## View Functions

### Proposal Archive

| Function | Returns | Description |
|----------|---------|-------------|
| `getProposalSummary(id)` | `ProposalSummary?` | Get proposal by ID |
| `getProposalCount()` | `Int` | Total proposals |
| `getProposalsByCategory(cat)` | `Int` | Count by category |
| `getProposalOutcome(id)` | `Int` | Outcome status |

### Voting Summary

| Function | Returns | Description |
|----------|---------|-------------|
| `getVotingSummary(id)` | `VotingSummary?` | Aggregated voting data |
| `getQuorumThreshold()` | `Int` | Minimum votes required |
| `getTotalVotesCast(id)` | `Int` | Vote count for proposal |

### Governance Assets

| Function | Returns | Description |
|----------|---------|-------------|
| `getGovernanceAssetSnapshot()` | `AssetSnapshot` | Current snapshot |
| `getTotalGovernanceSupply()` | `Int` | Fixed: 222 |
| `getLatestSnapshotBlock()` | `Int` | Snapshot block height |
| `getSnapshotHash()` | `Int` | Verification hash |

### Statistics

| Function | Returns | Description |
|----------|---------|-------------|
| `getGovernanceStats()` | `GovernanceStats` | Aggregate statistics |
| `getCategoryStats(cat)` | `CategoryStats` | Per-category stats |

## Events

| Event | Fields | Description |
|-------|--------|-------------|
| `ProposalRecorded` | id, category, timestamp | New proposal logged |
| `VotingResultRecorded` | id, outcome, votes, timestamp | Vote result logged |
| `SnapshotRecorded` | block, hash, timestamp | Snapshot updated |

## Security Considerations

### What This Contract Does NOT Do

- **Cannot execute proposals**: Outcomes are advisory only
- **Cannot modify protocol**: Zero protocol authority
- **Cannot move funds**: No fund access
- **Cannot identify voters**: Privacy preserved
- **Cannot censor proposals**: Append-only records

### Attack Surface

| Vector | Mitigation |
|--------|------------|
| Data tampering | Append-only, no updates |
| Privacy leak | Aggregated data only |
| Execution attack | No execution capability |
| Admin abuse | No admin functions |

## Testing

Tests are located in `tests/governance/`:

- `TransparencyRegistry.spec.ts` - Core functionality tests
- Privacy leakage tests
- Immutability guarantee tests
- No-write-path verification

## Usage Example

```typescript
// Query proposal data
const summary = await transparency.getProposalSummary(12n);
console.log(`Proposal #${summary.proposal_id}`);
console.log(`Category: ${summary.category}`);
console.log(`Outcome: ${summary.outcome}`);

// Query voting results (aggregated only)
const voting = await transparency.getVotingSummary(12n);
console.log(`Votes: ${voting.total_votes_cast} / 222`);
console.log(`Quorum met: ${voting.quorum_met}`);

// Query governance stats
const stats = await transparency.getGovernanceStats();
console.log(`Total proposals: ${stats.total_proposals}`);
console.log(`Accepted: ${stats.proposals_accepted}`);
```

## References

- [Issue #40 - Governance Transparency](https://github.com/xlabtg/tonbankcard-protocol/issues/40)
- [docs/governance-transparency.md](../../docs/governance-transparency.md)
- [docs/governance.md](../../docs/governance.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

**Document Status**: Implementation Draft
**Last Updated**: 2025-12-29
**Maintainers**: Tonbankcard Protocol Team
