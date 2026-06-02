# Governance Contracts

## Overview

This directory contains the **non-executable governance** contracts for the Tonbankcard Protocol. These contracts implement a public proposal registry, transparency layer, snapshot verification, and helper utilities for the TBC Diamonds NFT governance system.

> **CRITICAL**: These contracts provide **information only**. They have **NO execution capability**, **NO fund custody**, and **NO protocol control**.

### Core Principle

> **Governance must be observable, not actionable.**

Transparency exists to **build trust**, not to **exercise power**.

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

### TransparencyRegistry.tact (Issue #40)

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

### ProposalRegistry.tact

The main governance contract that manages proposals and voting.

**Purpose**: Public proposal registry for recording governance intent and voting outcomes.

**Features:**
- Submit proposals (requires verified TBC Diamond NFT ownership)
- Cast votes (1 NFT = 1 vote, ownership verified on-chain)
- Finalize proposals after voting window
- Query proposal status and vote counts

#### On-chain NFT ownership verification (audit finding CONTRACTS-C1 / issue #248)

The registry **never trusts a caller-supplied NFT ID**. Before a vote or
proposal is recorded, it asks a trusted on-chain resolver "who owns Diamond
NFT N?" and only materialises the action once the resolver confirms that the
original sender is the NFT owner. This closes the vulnerability where any single
wallet could fabricate all 222 votes by simply supplying NFT IDs it did not own.

Because owner resolution is a cross-contract lookup, this is an **asynchronous
request/response flow**:

```
1. User           -> ProposalRegistry : CastVote / SubmitProposal
                                          (stashes a PENDING request keyed by
                                           query_id, bound to sender())
2. ProposalRegistry -> Resolver        : ResolveOwnership{nft_id, claimant}
3. Resolver       -> ProposalRegistry  : OwnershipResolved{nft_id, owner}
4. ProposalRegistry                    : record vote/proposal IFF owner == claimant
```

Security properties:

- A vote/proposal is materialised **only** inside the `OwnershipResolved`
  callback, which requires `sender() == owner_resolver` (spoofed callbacks are
  rejected) **and** `resolved_owner == claimant`.
- A caller-supplied `voter_nft_id` / `author_nft_id` alone can never record
  anything — defeating the "iterate NFT IDs 1..222 from one wallet" attack.
- The resolver is configured once by the deployer via `SetOwnerResolver`. Until
  it is set, all voting and proposal submission is rejected.

**Public Functions:**

| Function | Description |
|----------|-------------|
| `SetOwnerResolver` | One-time, deployer-only configuration of the NFT ownership resolver |
| `SubmitProposal` | Request to register a new proposal (recorded only after ownership is confirmed) |
| `CastVote` | Request to vote on an active proposal (recorded only after ownership is confirmed) |
| `OwnershipResolved` | Resolver callback that confirms NFT ownership and finalizes the pending action |
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
| `getOwnerResolver()` | Configured NFT ownership resolver (`null` until set) |
| `getDeployer()` | Deployer address (resolver-configuration authority) |

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

## Directory Structure

```
contracts/governance/
├── README.md                              # This file
├── TransparencyRegistry.tact              # Transparency layer contract (Issue #40)
├── ProposalRegistry.tact                  # Proposal registry (Issue #38)
├── SnapshotVerifier.tact                  # Snapshot verifier (Issue #38)
├── diamond_resolver.fc                    # Diamond NFT resolver
├── types/
│   └── TransparencyTypes.tact             # Data structures and constants
├── interfaces/
│   └── ITransparencyRegistry.tact         # Read-only interface
└── schemas/
    └── offchain-index.json                # Off-chain indexing schema
```

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

## Data Structures

### ProposalSummary (TransparencyRegistry)

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

### VotingSummary (TransparencyRegistry)

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

### AssetSnapshot (TransparencyRegistry)

Governance asset snapshot:

```tact
struct AssetSnapshot {
    total_supply: Int as uint16;           // Fixed: 222
    snapshot_block_height: Int as uint64;
    snapshot_hash: Int as uint256;
}
```

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

## Proposal States

| Status | Code | Description |
|--------|------|-------------|
| PENDING/ACTIVE | 0 | Voting in progress |
| ACCEPTED | 1 | Majority FOR, quorum met |
| REJECTED | 2 | Majority AGAINST, quorum met |
| NO_QUORUM | 3 | Quorum not met |

## Vote Types

| Vote | Code | Description |
|------|------|-------------|
| FOR | 0 | Support the proposal |
| AGAINST | 1 | Oppose the proposal |
| ABSTAIN | 2 | Neither support nor oppose |

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

## View Functions

### Transparency Registry View Functions

#### Proposal Archive

| Function | Returns | Description |
|----------|---------|-------------|
| `getProposalSummary(id)` | `ProposalSummary?` | Get proposal by ID |
| `getProposalCount()` | `Int` | Total proposals |
| `getProposalsByCategory(cat)` | `Int` | Count by category |
| `getProposalOutcome(id)` | `Int` | Outcome status |

#### Voting Summary

| Function | Returns | Description |
|----------|---------|-------------|
| `getVotingSummary(id)` | `VotingSummary?` | Aggregated voting data |
| `getQuorumThreshold()` | `Int` | Minimum votes required |
| `getTotalVotesCast(id)` | `Int` | Vote count for proposal |

#### Governance Assets

| Function | Returns | Description |
|----------|---------|-------------|
| `getGovernanceAssetSnapshot()` | `AssetSnapshot` | Current snapshot |
| `getTotalGovernanceSupply()` | `Int` | Fixed: 222 |
| `getLatestSnapshotBlock()` | `Int` | Snapshot block height |
| `getSnapshotHash()` | `Int` | Verification hash |

#### Statistics

| Function | Returns | Description |
|----------|---------|-------------|
| `getGovernanceStats()` | `GovernanceStats` | Aggregate statistics |
| `getCategoryStats(cat)` | `CategoryStats` | Per-category stats |

## Events

### TransparencyRegistry Events

| Event | Fields | Description |
|-------|--------|-------------|
| `ProposalRecorded` | id, category, timestamp | New proposal logged |
| `VotingResultRecorded` | id, outcome, votes, timestamp | Vote result logged |
| `SnapshotRecorded` | block, hash, timestamp | Snapshot updated |

### ProposalRegistry Events

| Event | Description |
|-------|-------------|
| `ProposalSubmitted` | Emitted when a new proposal is registered |
| `VoteCast` | Emitted when a vote is cast (NFT ID not included for privacy) |
| `ProposalFinalized` | Emitted when a proposal is finalized with final outcome |

## Security Constraints

The contracts enforce:

1. **Append-Only**: Proposals cannot be modified or deleted
2. **No Admin Override**: No privileged role can alter outcomes
3. **Immutable After Finalization**: Final status cannot change
4. **No Execution Engine**: Cannot trigger any contract calls
5. **Privacy-Preserving**: Voter NFT IDs not exposed in events

### What These Contracts CANNOT Do

- **Cannot execute proposals**: Outcomes are advisory only
- **Cannot modify protocol**: Zero protocol authority
- **Cannot move funds**: No fund access
- **Cannot identify voters**: Privacy preserved
- **Cannot censor proposals**: Append-only records
- Execute protocol changes
- Modify smart contracts
- Control user funds
- Freeze accounts
- Override security measures
- Enforce voting outcomes

### Attack Surface

| Vector | Mitigation |
|--------|------------|
| Data tampering | Append-only, no updates |
| Privacy leak | Aggregated data only |
| Execution attack | No execution capability |
| Admin abuse | No admin functions |

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

### Transparency Registry Usage Example

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

## Integration

> **Note:** `SubmitProposal` and `CastVote` are *requests*. The registry first
> verifies NFT ownership with the configured resolver and only records the
> proposal/vote once ownership is confirmed (see "On-chain NFT ownership
> verification" above). The deployer must call `SetOwnerResolver` once before any
> proposals or votes can be recorded.

### Configuring the ownership resolver (deployer, one-time)

```typescript
await registry.send(
  deployerSender,
  { value: toNano("0.05") },
  {
    $$type: "SetOwnerResolver",
    resolver: ownerResolverAddress // on-chain NFT owner resolver (TEP-62)
  }
);
```

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

## Testing

The `ProposalRegistry` ships with a self-contained Tact build + Jest test
project in this directory (mirroring `contracts/payment-hub`). It is wired into
the CI `Test (Contracts)` job.

- `ProposalRegistry.spec.ts` — regression tests for on-chain NFT ownership
  verification (audit finding CONTRACTS-C1 / issue #248): legitimate owners can
  submit/vote, non-owners are rejected, a single wallet cannot accumulate votes
  for NFTs it does not own, spoofed resolver callbacks are rejected, and actions
  are blocked until the resolver is configured.
- `test/TestOwnershipResolver.tact` — a test-only mock resolver that answers
  `ResolveOwnership` from a seeded `nft_id -> owner` map. It is **not** a
  production artifact; a real deployment uses an on-chain TEP-62 owner lookup.

Run the build and tests:
```bash
cd contracts/governance
npm install
npm run build   # compiles ProposalRegistry + the test harness, generating ./dist wrappers
npm test
```

> Additional aspirational specs under `tests/governance/` describe a broader
> governance suite and are not part of the contracts CI job.

## Documentation

- [Governance Transparency](../../docs/governance-transparency.md) - Transparency layer docs (Issue #40)
- [Governance Process](../../docs/governance-process.md) - Full governance documentation
- [DAO Governance](../../docs/dao-governance.md) - Complete DAO governance framework
- [Development Governance](../../docs/governance.md) - Development workflow

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

**Status**: Implementation
**Last Updated**: 2026-01-01
**Maintainers**: Tonbankcard Protocol Team
