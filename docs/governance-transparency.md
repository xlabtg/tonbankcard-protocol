# Governance Transparency & Public Records

**Issue Reference**: #40
**Type**: Governance Transparency Layer
**Status**: Implementation Draft
**Dependencies**: Issue 7.1 (Governance DAO), Issue 7.2 (Governance Process & Proposal Registry)

---

## Overview

This document defines the **public, immutable, read-only transparency layer** for TONBANKCARD governance. The transparency layer provides verifiability and historical accountability without granting any execution power, admin control, or protocol authority.

---

## Core Principle

> **Governance must be observable, not actionable.**

The transparency layer exists to **build trust**, not to **exercise power**. If public records can influence protocol execution, governance has exceeded its mandate.

---

## Architecture

### Design Philosophy

The TONBANKCARD transparency layer follows these fundamental principles:

1. **Read-Only Access**: All data exposed through view methods only
2. **No Mutable State**: Transparency contract stores no state that can be modified
3. **No Admin Functions**: Zero privileged operations
4. **Privacy by Design**: No wallet addresses or voter identities exposed
5. **On-Chain Truth**: All data mirrors immutable on-chain records

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSPARENCY LAYER                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              TransparencyRegistry Contract                 │  │
│  │                    (Read-Only)                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ Proposal Archive │  │ Voting Summary  │                │  │
│  │  │   - ID          │  │ - Total Votes   │                │  │
│  │  │   - Hash        │  │ - Quorum        │                │  │
│  │  │   - Category    │  │ - Result        │                │  │
│  │  │   - Window      │  │                 │                │  │
│  │  │   - Outcome     │  │                 │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │            Governance Asset Snapshot                 │ │  │
│  │  │   - Total Supply: 222 (TBC Diamonds NFT)            │ │  │
│  │  │   - Snapshot Block Height                            │ │  │
│  │  │   - Snapshot Hash                                    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↑                                   │
│                     (Read-Only Getters)                          │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Data Sources                            │  │
│  │   ProposalRegistry Contract ─────────→ Proposal Data      │  │
│  │   SnapshotVerifier Contract ─────────→ Snapshot Data      │  │
│  │   On-Chain Events ───────────────────→ Historical Record  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
           ┌──────────────────────────────────────┐
           │       Off-Chain Views (Optional)      │
           │   - Static Website                    │
           │   - Indexer-Backed Explorer           │
           │   - IPFS-Hosted Records               │
           │                                       │
           │   ⚠️ Non-Authoritative                │
           │   ⚠️ Mirror On-Chain Truth Only       │
           └──────────────────────────────────────┘
```

---

## Public Records Scope

### Proposal Archive

The transparency layer exposes the following proposal data:

| Field | Type | Description |
|-------|------|-------------|
| `proposal_id` | `uint64` | Unique proposal identifier |
| `proposal_hash` | `uint256` | Cryptographic hash of proposal content |
| `category` | `enum` | Proposal category (from Issue 7.2) |
| `voting_window_start` | `uint32` | Start timestamp of voting period |
| `voting_window_end` | `uint32` | End timestamp of voting period |
| `outcome` | `enum` | Final result: ACCEPTED, REJECTED, NO_QUORUM |

### Proposal Categories

As defined in Issue 7.2, the following categories are supported:

```
ROADMAP_SIGNAL           = 0
INTEGRATION_RECOMMENDATION = 1
DOCUMENTATION_UPDATE     = 2
RISK_DISCLOSURE          = 3
DEPRECATION_NOTICE       = 4
ECOSYSTEM_GRANT_SIGNAL   = 5
```

### Voting Summary (Aggregated Only)

| Field | Type | Description |
|-------|------|-------------|
| `total_votes_cast` | `uint16` | Number of votes cast (max 222) |
| `quorum_threshold` | `uint16` | Minimum votes required for quorum |
| `pass_fail_result` | `bool` | Whether proposal passed (true) or failed (false) |

**Privacy Constraint**: No voter-level data is exposed. Individual votes, voter addresses, and vote timestamps are never accessible.

### Governance Asset Snapshot

| Field | Type | Description |
|-------|------|-------------|
| `total_supply` | `uint16` | Fixed at 222 (TBC Diamonds NFT) |
| `snapshot_block_height` | `uint64` | Block height at snapshot time |
| `snapshot_hash` | `uint256` | Hash of snapshot data for verification |

---

## Privacy Design

### Mandatory Privacy Constraints

The transparency layer **MUST NOT** expose:

| Forbidden Data | Reason |
|----------------|--------|
| Wallet addresses | Deanonymization risk |
| NFT holder identities | Privacy violation |
| Vote timestamps | Timing correlation attack |
| Individual vote choices | Voter privacy |
| Delegation graphs | Relationship exposure |

### Privacy Protection Mechanisms

1. **Aggregation Only**: Voting data is aggregated before exposure
2. **No Address Mapping**: No functions return wallet addresses
3. **Hash-Only Content**: Proposal content stored as hash, not plaintext
4. **Time Quantization**: Only voting windows exposed, not individual timestamps
5. **No Enumeration**: Cannot iterate over voters or vote history

### Privacy Threat Analysis

| Threat | Mitigation |
|--------|------------|
| Vote timing analysis | Timestamps not exposed |
| Wallet clustering | No address data available |
| Vote/balance correlation | Aggregated data only |
| Social graph inference | No delegation data exposed |
| Metadata leakage | Minimal data exposure by design |

---

## Contract Interface

### TransparencyRegistry Contract

```tact
// Read-only transparency registry
// NO mutable state, NO admin functions, NO protocol authority

contract TransparencyRegistry {
    // Reference to proposal registry (for cross-contract reads)
    proposal_registry: Address;

    // Reference to snapshot verifier (for cross-contract reads)
    snapshot_verifier: Address;

    init(proposal_registry: Address, snapshot_verifier: Address) {
        self.proposal_registry = proposal_registry;
        self.snapshot_verifier = snapshot_verifier;
    }

    // ========================================
    // PROPOSAL ARCHIVE GETTERS
    // ========================================

    get fun getProposalSummary(proposal_id: Int): ProposalSummary? {
        // Returns aggregated proposal data without sensitive info
    }

    get fun getProposalCount(): Int {
        // Returns total number of proposals
    }

    get fun getProposalsByCategory(category: Int): Int {
        // Returns count of proposals in category
    }

    get fun getProposalOutcome(proposal_id: Int): Int {
        // Returns: 0=PENDING, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
    }

    // ========================================
    // VOTING SUMMARY GETTERS (AGGREGATED)
    // ========================================

    get fun getVotingSummary(proposal_id: Int): VotingSummary? {
        // Returns aggregated voting stats only
        // NO individual voter data
    }

    get fun getQuorumThreshold(): Int {
        // Returns current quorum requirement
    }

    get fun getTotalVotesCast(proposal_id: Int): Int {
        // Returns aggregate vote count only
    }

    // ========================================
    // GOVERNANCE ASSET SNAPSHOT GETTERS
    // ========================================

    get fun getGovernanceAssetSnapshot(): AssetSnapshot {
        // Returns snapshot of TBC Diamonds NFT supply
    }

    get fun getTotalGovernanceSupply(): Int {
        // Returns: 222 (fixed supply)
    }

    get fun getLatestSnapshotBlock(): Int {
        // Returns block height of latest snapshot
    }

    get fun getSnapshotHash(): Int {
        // Returns hash for external verification
    }
}
```

### Data Structures

```tact
// Proposal summary (privacy-preserving)
struct ProposalSummary {
    proposal_id: Int as uint64;
    proposal_hash: Int as uint256;
    category: Int as uint8;
    voting_window_start: Int as uint32;
    voting_window_end: Int as uint32;
    outcome: Int as uint8;  // 0=PENDING, 1=ACCEPTED, 2=REJECTED, 3=NO_QUORUM
}

// Voting summary (aggregated, no individual data)
struct VotingSummary {
    proposal_id: Int as uint64;
    total_votes_cast: Int as uint16;
    quorum_threshold: Int as uint16;
    quorum_met: Bool;
    passed: Bool;
}

// Governance asset snapshot
struct AssetSnapshot {
    total_supply: Int as uint16;           // Fixed: 222
    snapshot_block_height: Int as uint64;
    snapshot_hash: Int as uint256;
}
```

---

## Off-Chain Views (Optional)

### Implementation Options

1. **Static Website**: HTML/JS reading from on-chain
2. **Indexer-Backed Explorer**: Backend indexing events
3. **IPFS-Hosted Records**: Decentralized archive

### Requirements for Off-Chain Views

All off-chain implementations **MUST**:

- Mirror on-chain truth exactly
- Be explicitly marked as non-authoritative
- Include disclaimer banner
- Never expose private data
- Support independent verification

### Recommended Disclaimer

```
⚠️ GOVERNANCE DISCLAIMER

Governance outcomes are advisory only.
TONBANKCARD protocol behavior is immutable and non-custodial.

This view is non-authoritative. Verify all data on-chain.
```

---

## UX Examples

### Governance Explorer View

```
┌─────────────────────────────────────────────────────────────┐
│  📋 TONBANKCARD Governance Explorer                         │
│                                                             │
│  ⚠️ Governance outcomes are advisory only.                  │
│     TONBANKCARD protocol behavior is immutable.             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Proposal #12                                               │
│  ────────────────────────────────────────                   │
│  Type:     INTEGRATION_RECOMMENDATION                       │
│  Status:   ✅ ACCEPTED                                       │
│  Votes:    143 / 222                                        │
│  Quorum:   Met (>50%)                                       │
│  Snapshot: Block 19,882,441                                 │
│                                                             │
│  Hash: 0x7f3a...89bc                                        │
│  Window: 2024-01-15 → 2024-01-22                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Recent Proposals                                           │
│  ────────────────────────────────────────                   │
│  #12  INTEGRATION_RECOMMENDATION   ACCEPTED   143 votes    │
│  #11  ROADMAP_SIGNAL               REJECTED    89 votes    │
│  #10  DOCUMENTATION_UPDATE         ACCEPTED   167 votes    │
│  #9   RISK_DISCLOSURE              NO_QUORUM   45 votes    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Governance Statistics View

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Governance Statistics                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total Governance Assets:  222 TBC Diamond NFTs            │
│  Total Proposals:          47                               │
│  Proposals Accepted:       31 (66%)                         │
│  Proposals Rejected:       12 (26%)                         │
│  No Quorum:                 4 (8%)                          │
│                                                             │
│  By Category:                                               │
│  ────────────────────────────────────────                   │
│  ROADMAP_SIGNAL:             15                             │
│  INTEGRATION_RECOMMENDATION: 12                             │
│  DOCUMENTATION_UPDATE:        8                             │
│  RISK_DISCLOSURE:             6                             │
│  DEPRECATION_NOTICE:          4                             │
│  ECOSYSTEM_GRANT_SIGNAL:      2                             │
│                                                             │
│  Latest Snapshot: Block 19,992,103                         │
│  Snapshot Hash:   0x8a2b...3f4d                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Explicitly Forbidden Features

The transparency layer **MUST NOT** include:

| Forbidden Feature | Reason |
|-------------------|--------|
| "Top voters" leaderboard | Voter privacy violation |
| Participation rankings | Social pressure / coercion risk |
| Comments or reactions | Off-chain moderation creep |
| Proposal edit history | Immutability violation |
| Vote change tracking | Timing attack vector |
| Delegation visualization | Relationship exposure |
| Wallet balance display | Financial privacy |

---

## Security Considerations

### Zero Protocol Authority

The transparency layer has **zero protocol authority**:

- Cannot execute proposal outcomes
- Cannot modify contract state
- Cannot influence voting
- Cannot gate protocol behavior
- Cannot introduce moderation powers

### Immutability Guarantees

- All exposed data references immutable on-chain records
- No mechanism exists to alter historical data
- Proposals cannot be edited after submission
- Voting outcomes are final once recorded

### Attack Surface Analysis

| Attack Vector | Protection |
|---------------|------------|
| Data tampering | On-chain source of truth |
| Censorship | Decentralized access via contract |
| Sybil attack | NFT-based voting (1 NFT = 1 vote) |
| Vote buying | No voter identification exposed |
| Coercion | Anonymous voting preserved |

---

## Implementation Checklist

### On-Chain Components

- [ ] TransparencyRegistry contract (read-only getters)
- [ ] Interface definitions for data structures
- [ ] Cross-contract read integration with ProposalRegistry
- [ ] Cross-contract read integration with SnapshotVerifier

### Documentation

- [x] Architecture documentation (this file)
- [ ] Privacy design explanation
- [ ] Threat analysis documentation
- [ ] API reference for getters

### Testing

- [ ] Completeness of public records tests
- [ ] Immutability guarantee tests
- [ ] Privacy leakage resistance tests
- [ ] No-write-path verification tests

---

## References

- [Issue #40 - Governance Transparency](https://github.com/xlabtg/tonbankcard-protocol/issues/40)
- [Issue 7.1 - Governance DAO (TBC Diamonds)](../ISSUE_TEMPLATE/governance-dao.md)
- [Issue 7.2 - Governance Process & Proposal Registry](../ISSUE_TEMPLATE/governance-process.md)
- [docs/governance.md](./governance.md) - Protocol governance principles
- [docs/invariants.md](./invariants.md) - Protocol invariants
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

---

**Document Status**: Implementation Draft
**Last Updated**: 2025-12-29
**Maintainers**: Tonbankcard Protocol Team
