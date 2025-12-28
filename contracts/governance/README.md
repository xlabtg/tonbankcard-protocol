# Governance Contracts (Issue #38)

## Overview

This directory contains the **non-executable governance** contracts for the Tonbankcard Protocol. These contracts implement a public proposal registry and snapshot verification system for the TBC Diamonds NFT governance.

> **IMPORTANT**: These contracts are **purely advisory**. They record governance intent and voting outcomes but have **no ability to execute protocol changes**.

## Core Principle

```
Governance may SIGNAL, but never ACT.
```

## Contracts

### ProposalRegistry.tact

The main governance contract that manages proposals and voting.

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

Run tests:
```bash
npx blueprint test tests/governance/
```

## Documentation

- [Governance Process](../../docs/governance-process.md) - Full governance documentation
- [Issue #38](https://github.com/xlabtg/tonbankcard-protocol/issues/38) - Implementation issue
- [Issue #36](https://github.com/xlabtg/tonbankcard-protocol/issues/36) - TBC Diamonds DAO

## Legal Disclaimer

This governance system:

1. Does **NOT** create binding legal obligations
2. Does **NOT** constitute a DAO with legal personhood
3. Does **NOT** represent investment or financial advice
4. Is for **coordination purposes only**
5. Outcomes are **advisory signals**, not enforceable decisions

---

**Status**: Issue #38 Implementation
**Maintainers**: Tonbankcard Protocol Team
