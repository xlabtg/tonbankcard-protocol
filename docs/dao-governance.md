# TBC Diamonds DAO Governance Framework

## Overview

This document defines the **TBC Diamonds DAO governance framework** — a minimal, non-custodial governance system using the **TBC Diamonds NFT collection (222 total supply)** for protocol-level coordination.

**Critical Principle**: This DAO exists to **coordinate humans**, not control code.

## Executive Summary

| Property | Value |
|----------|-------|
| Governance Asset | TBC Diamonds NFT Collection |
| Total Supply | 222 NFTs |
| Voting Power | 1 NFT = 1 vote |
| Governance Type | Advisory + Signaling (Non-Binding) |
| Execution Capability | **NONE** |
| Fund Custody | **NONE** |
| Protocol Control | **NONE** |

## Governance Philosophy (MANDATORY)

### Core Principles

TBC Diamonds governance is:

- **Slow by design**: Deliberate decision-making over rapid execution
- **Conservative**: Bias toward stability and security
- **Transparent**: All proposals and votes are public
- **Opt-in**: Participation is voluntary

### What Governance MUST NOT Do

The governance system is **explicitly prohibited** from:

❌ **Controlling user funds** — No custody, no withdrawal, no freezing
❌ **Executing transactions** — No on-chain execution engine
❌ **Overriding smart contracts** — Immutable contracts remain immutable
❌ **Acting as legal entity** — No corporate powers or liabilities
❌ **Changing deployed contracts** — No upgrade proxies, no admin keys
❌ **Seizing or freezing assets** — Users maintain full sovereignty
❌ **Forcing protocol actions** — All outcomes are non-binding

### Rationale

If governance can break the protocol, **the protocol is badly designed**.

TONBANKCARD is designed so governance **cannot** break it.

## TBC Diamonds NFT Collection

### Properties

- **Total Supply**: 222 NFTs (fixed, immutable)
- **Voting Power**: Each NFT represents **1 governance unit**
- **Delegation**: No delegation by default (may be added via off-chain signaling)
- **Fractionalization**: Prohibited (1 NFT = 1 indivisible vote)
- **Ownership Resolution**: On-chain via TEP-62 compliant NFT standard

### Collection Details

- **Collection Name**: TBC Diamonds
- **Standard**: TON NFT (TEP-62)
- **Transferability**: Transferable (ownership determines voting rights)
- **Soulbinding**: Not soulbound (NFTs can be traded/transferred)

### Ownership Verification

Ownership is resolved on-chain using the standard NFT `get_nft_data()` method:

```func
;; Query NFT ownership
(int init?, int index, slice collection_address, slice owner_address, cell individual_content) = nft_contract.get_nft_data();

;; owner_address has voting rights if init? = -1 (true)
```

## Scope of Governance Authority

### What Governance MAY Signal On

The DAO governance MAY provide **non-binding signals** on:

✅ **Protocol Roadmap Direction**
   - Feature prioritization
   - Development focus areas
   - Long-term vision alignment

✅ **Recommended Integrations**
   - Third-party service partnerships (e.g., DEXs, bridges)
   - External protocol collaborations
   - Ecosystem expansion suggestions

✅ **Parameter Suggestions (Non-Binding)**
   - Fee recommendations for future contracts
   - Economic parameter guidance
   - Risk parameter suggestions

✅ **Documentation Changes**
   - Protocol documentation improvements
   - Educational content priorities
   - User guide enhancements

✅ **Deprecation Notices**
   - Recommendations to sunset legacy features
   - Migration path suggestions
   - End-of-life announcements

✅ **Ecosystem Grants (Off-Chain)**
   - Community funding recommendations
   - Development grant priorities
   - Bounty program suggestions

### What Governance MUST NOT Control

❌ **Smart Contract Logic** — Immutable contracts cannot be changed
❌ **Deployed Contract Upgrades** — No upgrade proxies exist
❌ **Fund Movements** — No treasury, no custody
❌ **Account Restrictions** — No freeze, no ban, no seizure
❌ **Forced Protocol Actions** — No on-chain execution

## Governance Model

### Voting Model

- **Voting Power**: 1 TBC Diamond NFT = 1 vote
- **Quorum**: Configurable per proposal (recommended: 10-20% of supply)
- **Decision Threshold**: Simple majority (>50%) unless otherwise specified
- **Vote Counting**: Snapshot-based (ownership at specific block height)

### Proposal Lifecycle

All governance proposals follow this lifecycle:

```
1. Proposal Draft (Off-Chain)
   - Author creates proposal document
   - Community discussion on GitHub/Forum
   - Refinement based on feedback
   ↓
2. Proposal Submission
   - Formal proposal published
   - Snapshot block height determined
   ↓
3. Snapshot of Diamond Holders
   - Record all NFT owners at snapshot block
   - Create voter registry (222 max voters)
   ↓
4. Voting Period
   - Duration: Configurable (recommended: 7-14 days)
   - Method: Off-chain voting platform (e.g., Snapshot)
   - Votes signed with NFT owner wallets
   ↓
5. Vote Counting
   - Tally votes based on snapshot ownership
   - Verify signatures against NFT owners
   ↓
6. Final Outcome Published
   - Results published on-chain (as data, not execution)
   - Outcome is **non-binding**
   ↓
7. Implementation (Optional)
   - If outcome requires action, humans implement
   - No automatic execution
   - No forced compliance
```

### Proposal Types

#### Type A: Signaling Proposals
**Purpose**: Gauge community sentiment
**Execution**: None (informational only)
**Examples**:
- "Should we prioritize lending features over multi-sig cards?"
- "Which DEX should be recommended for TBC liquidity?"

#### Type B: Recommendation Proposals
**Purpose**: Suggest actions to core team or community
**Execution**: Voluntary adoption by relevant parties
**Examples**:
- "Recommend deprecating Series 7777 NFT collection in favor of new version"
- "Suggest allocating grant funding to X project"

#### Type C: Parameter Guidance
**Purpose**: Provide input on future contract parameters
**Execution**: Developers may incorporate into new deployments
**Examples**:
- "Recommend 0.1% fee for future payment hub contract"
- "Suggest minimum collateral ratio of 150% for lending"

**Note**: All proposal types are **non-binding**.

## Security & Neutrality Constraints

### No On-Chain Execution Engine

The governance system **MUST NOT** include:

- Smart contracts that execute governance outcomes
- Admin keys controlled by governance
- Multi-sig wallets that take protocol actions
- Time-locked contracts that enforce decisions

**Rationale**: Execution capability = protocol control = custody risk

### No DAO Treasury Contract

The governance system **MUST NOT** include:

- Smart contracts holding funds
- Community pool controlled by governance
- Token reserves managed by DAO
- Custodial wallets for grants/expenses

**Rationale**: Treasury = custody = violation of non-custodial principle

### No Privileged Calls

The governance system **MUST NOT** have:

- Special permissions in protocol contracts
- Admin functions callable by DAO
- Emergency override capabilities
- Upgrade authority over deployed contracts

**Rationale**: Privileged access = centralization = attack vector

### Governance Results Are Informational Only

All governance outcomes are:

- **Non-binding**: No legal or technical enforcement
- **Advisory**: Suggestions, not commands
- **Transparent**: All results published publicly
- **Opt-in**: Compliance is voluntary

## Technical Implementation

### Documentation

**Primary Documentation**: `docs/dao-governance.md` (this file)

**Contents**:
- Governance philosophy and principles
- TBC Diamonds NFT collection details
- Proposal lifecycle and voting model
- Security constraints and limitations
- Attack surface analysis
- Legal and risk disclaimers

### Code Components (Minimal)

#### 1. Diamond Ownership Resolver (Read-Only)

**Purpose**: Query TBC Diamonds NFT ownership for voting snapshots

**File**: `contracts/governance/diamond_resolver.fc`

**Features**:
- Read-only get methods (no state changes)
- Validates NFT ownership at specific block
- Returns voter registry for proposals
- No fund custody or transfers

**Interface**:
```func
;; Get Diamond NFT owner
slice get_diamond_owner(int diamond_index) method_id;

;; Check if address owns any Diamonds
int has_voting_power(slice owner_address) method_id;

;; Get total voting power of an address
int get_voting_power(slice owner_address) method_id;

;; Get all Diamond owners (snapshot helper)
;; Returns up to 222 owner addresses
tuple get_all_owners() method_id;
```

#### 2. Snapshot Helper Utilities

**Purpose**: Off-chain utilities to create voter snapshots

**File**: `scripts/governance/snapshot.ts`

**Features**:
- Query all 222 TBC Diamonds NFTs
- Record ownership at specific block height
- Generate voter registry JSON
- Verify snapshot integrity

**Usage**:
```bash
# Create snapshot at current block
npm run governance:snapshot

# Create snapshot at specific block
npm run governance:snapshot --block 12345678

# Verify snapshot integrity
npm run governance:verify-snapshot snapshot_12345678.json
```

**Output Format**:
```json
{
  "snapshot_block": 12345678,
  "snapshot_time": "2025-01-15T10:00:00Z",
  "collection_address": "EQC...",
  "total_supply": 222,
  "voters": [
    {
      "nft_index": 0,
      "owner_address": "EQA...",
      "voting_power": 1
    },
    ...
  ],
  "total_voting_power": 222,
  "unique_owners": 187
}
```

### Tests

**Test Suite**: `tests/governance/DiamondGovernance.spec.ts`

**Test Coverage**:

1. **NFT Ownership Resolution**
   - Correct owner identification
   - Handling of uninitialized NFTs
   - Multiple NFTs per owner

2. **Vote Counting Correctness**
   - Accurate vote tallies
   - Quorum calculations
   - Majority threshold checks

3. **NFT Transfer Timing Attacks**
   - Snapshot-based voting prevents double voting
   - Transfer after snapshot doesn't affect vote
   - Transfer before snapshot correctly updates voter

4. **Edge Cases**
   - All NFTs owned by single address (1 voter, 222 votes)
   - All NFTs owned by different addresses (222 voters)
   - NFT burned/uninitialized (excluded from snapshot)
   - Smart contract as NFT owner (allowed)

5. **Security Properties**
   - No execution capabilities
   - No fund custody
   - No state manipulation
   - Read-only operations only

## Attack Surface Analysis

### Threat Model

Governance introduces new attack vectors even without execution capability:

#### 1. NFT Loaning / Flash Ownership

**Attack**: Attacker borrows NFTs temporarily to vote, then returns them

**Impact**: Vote manipulation, doesn't reflect long-term stakeholders

**Mitigation**:
- **Snapshot-based voting**: Ownership recorded at specific block, loaning after snapshot doesn't help
- **Disclosure**: Clearly communicate that lending is possible
- **Community awareness**: Voters should understand this risk

**Not Mitigated**: Coordinated lending right before snapshot still possible

**Acceptance**: This is a known limitation of NFT-based governance, disclosed to users

#### 2. Market Manipulation Around Votes

**Attack**: Buy NFTs before important vote, sell after, to manipulate outcome

**Impact**: Temporary stakeholders influence protocol direction

**Mitigation**:
- **Slow governance**: Long proposal periods reduce profitability of manipulation
- **Non-binding outcomes**: No forced execution reduces value of manipulation
- **Transparency**: All proposals public well in advance
- **Time-locked proposals**: Snapshot block announced days before voting

**Not Mitigated**: Wealthy actors can still buy influence

**Acceptance**: Free market allows NFT trading, governance accepts this

#### 3. Social Governance Attacks

**Attack**: Coordinated campaigns to pass harmful proposals via social pressure

**Impact**: Protocol reputation damage, user confusion

**Mitigation**:
- **Non-binding governance**: No forced execution
- **Core team veto**: Developers ignore harmful "recommendations"
- **Community education**: Clear communication of governance limits
- **Proposal review**: Community scrutiny before voting

**Not Mitigated**: Social attacks can still damage community trust

**Acceptance**: Governance is opt-in, users can ignore bad proposals

#### 4. Sybil Attacks via NFT Accumulation

**Attack**: Single entity acquires many NFTs to control governance

**Impact**: Centralization of voting power

**Mitigation**:
- **Fixed supply**: Only 222 NFTs exist, expensive to acquire majority
- **Market constraints**: Buying many NFTs drives up price
- **Non-binding votes**: Limited value of control

**Not Mitigated**: Wealthy actor can still dominate

**Acceptance**: Plutocracy is inherent to token/NFT governance

#### 5. Proposal Spam

**Attack**: Flood system with low-quality proposals to dilute attention

**Impact**: Voter fatigue, important proposals overlooked

**Mitigation**:
- **Proposal requirements**: Minimum discussion period, formatting rules
- **Community moderation**: Off-chain proposal filtering
- **Reputation systems**: Track proposal quality over time

**Not Mitigated**: No on-chain spam prevention

**Acceptance**: Off-chain governance platforms handle this

### Attack Surface Summary

| Attack Vector | Severity | Mitigation | Acceptance |
|---------------|----------|------------|------------|
| NFT Loaning | Medium | Snapshot voting | Known limitation |
| Market Manipulation | Medium | Slow, non-binding | Free market property |
| Social Attacks | Low | Non-binding, education | Community resilience |
| Sybil (NFT accumulation) | Medium | Fixed supply, cost | Plutocratic model |
| Proposal Spam | Low | Off-chain moderation | Platform responsibility |

**Overall Risk Level**: **LOW** (due to non-binding, non-custodial design)

## Legal & Risk Disclaimer

### No Legal Authority

The TBC Diamonds DAO:

- **IS NOT** a legal entity
- **DOES NOT** have corporate powers
- **CANNOT** enter contracts
- **DOES NOT** have fiduciary duties
- **IS NOT** subject to corporate governance laws

### No Liability

TBC Diamonds NFT holders:

- **ARE NOT** liable for protocol actions
- **HAVE NO** duty to vote or participate
- **ASSUME NO** legal responsibility for outcomes
- **BEAR NO** fiduciary duties to other holders

### Voting Is Non-Binding

All governance votes:

- **ARE** advisory opinions only
- **DO NOT** create legal obligations
- **CANNOT** be enforced on-chain
- **MAY** be ignored by protocol developers

### Regulatory Uncertainty

NFT-based governance:

- **MAY** face regulatory scrutiny
- **COULD** be classified as securities in some jurisdictions
- **MIGHT** impose compliance obligations on holders
- **SUBJECT TO** evolving legal landscape

**Recommendation**: Consult legal counsel before participating in governance.

### No Investment Advice

TBC Diamonds NFTs:

- **ARE NOT** marketed as investments
- **HAVE NO** promised returns
- **CARRY** risks including total loss
- **SHOULD NOT** be purchased for speculative purposes

### User Responsibility

Users are responsible for:

- Understanding governance limitations
- Conducting own due diligence
- Complying with applicable laws
- Securing their NFTs and wallets

## Governance Operational Guidelines

### How to Participate

#### Step 1: Acquire TBC Diamonds NFT

- Purchase on secondary markets (e.g., TON NFT marketplaces)
- Receive via transfer or airdrop
- Verify authenticity (check collection address)

#### Step 2: Monitor Governance Channels

- GitHub Discussions: `https://github.com/xlabtg/tonbankcard-protocol/discussions`
- Governance Forum: (TBD)
- Snapshot Platform: (TBD)

#### Step 3: Review Proposals

- Read proposal documentation
- Participate in community discussion
- Evaluate alignment with protocol principles

#### Step 4: Vote (During Voting Period)

- Connect wallet with TBC Diamonds NFT
- Sign vote on off-chain platform (e.g., Snapshot)
- Voting power = number of NFTs owned at snapshot block

#### Step 5: Review Outcomes

- Check final vote results
- Understand non-binding nature
- Monitor implementation (if applicable)

### Proposal Submission Process

**Prerequisites**:
- Own at least 1 TBC Diamond NFT (optional, encouraged)
- Familiarize with governance documentation
- Engage in preliminary community discussion

**Steps**:

1. **Draft Proposal** (Off-Chain)
   - Use proposal template (see below)
   - Outline clear objective
   - Explain rationale and impact
   - Specify proposal type (Signaling/Recommendation/Guidance)

2. **Community Discussion**
   - Post on GitHub Discussions or Governance Forum
   - Gather feedback (minimum 3-7 days)
   - Refine proposal based on input

3. **Formal Submission**
   - Finalize proposal document
   - Submit to governance platform
   - Announce snapshot block and voting period

4. **Voting Period**
   - Duration: 7-14 days (configurable)
   - No changes to proposal during voting
   - Community can campaign for/against

5. **Result Publication**
   - Announce final outcome
   - Archive proposal and results
   - Track implementation (if applicable)

### Proposal Template

```markdown
# [Proposal ID]: [Title]

## Summary
[1-2 sentence overview]

## Proposal Type
- [ ] Signaling (gauge sentiment)
- [ ] Recommendation (suggest action)
- [ ] Parameter Guidance (input for future contracts)

## Objective
[What this proposal aims to achieve]

## Rationale
[Why this is important for the protocol]

## Specification
[Detailed description of the proposal]

## Impact Analysis
- **Affected Components**: [List contracts/systems impacted]
- **Risk Assessment**: [Potential risks or downsides]
- **Alternatives Considered**: [Other approaches evaluated]

## Implementation (If Applicable)
[How this would be implemented if approved]

## Voting Options
- [ ] For (approve proposal)
- [ ] Against (reject proposal)
- [ ] Abstain (no preference)

## Timeline
- **Discussion Period**: [Dates]
- **Snapshot Block**: [Block number]
- **Voting Period**: [Dates]

## References
- [Links to related documents, issues, discussions]

## Author
- **Name/Alias**: [Proposal author]
- **Contact**: [GitHub handle or contact method]
- **Diamond NFT Holder**: [Yes/No]
```

## Governance Tools & Infrastructure

### Required Infrastructure

#### 1. Off-Chain Voting Platform

**Recommended**: Snapshot (https://snapshot.org)

**Features**:
- NFT-based voting strategies
- No gas costs for voting
- Transparent vote tallying
- IPFS-based proposal storage

**Integration**:
```javascript
// Snapshot strategy for TBC Diamonds
{
  "name": "erc721-with-multiplier",
  "params": {
    "symbol": "DIAMOND",
    "address": "EQ...", // TBC Diamonds collection address
    "multiplier": 1
  }
}
```

#### 2. Governance Forum

**Recommended**: GitHub Discussions or Discourse

**Purpose**:
- Proposal discussion
- Community feedback
- Long-form debate

#### 3. Snapshot Automation

**Tool**: `scripts/governance/snapshot.ts`

**Features**:
- Automated snapshot creation
- Voter registry generation
- Integrity verification

#### 4. Governance Dashboard (Optional)

**Features**:
- Active proposals overview
- Historical vote results
- Participation statistics
- Voter delegation (if enabled)

### Open Source Governance Stack

All governance infrastructure should be:

- **Open Source**: Transparent, auditable code
- **Non-Custodial**: No fund custody at any layer
- **Censorship-Resistant**: IPFS or on-chain storage
- **Decentralized**: No single point of control

## Governance Evolution

### Phase 1: Foundation (Current)

**Status**: Establishing baseline

**Components**:
- ✅ Documentation (this file)
- ✅ Diamond resolver contract
- ✅ Snapshot utilities
- ✅ Test suite

**Governance Capability**: **None** (documentation only)

### Phase 2: Signaling (Future)

**Prerequisites**:
- TBC Diamonds NFT collection deployed
- Off-chain voting platform configured
- Community engaged

**Components**:
- Snapshot voting enabled
- Governance forum active
- Regular signaling proposals

**Governance Capability**: **Sentiment signaling** (non-binding)

### Phase 3: Coordination (Long-term)

**Prerequisites**:
- Established governance track record
- High community participation
- Trusted proposal processes

**Components**:
- Ecosystem grants (off-chain funding)
- Partnership recommendations
- Protocol roadmap input

**Governance Capability**: **Coordination** (still non-binding)

### Phase 4: Enhanced Tooling (Aspirational)

**Prerequisites**:
- Proven governance value
- Community demand
- Technical maturity

**Components**:
- On-chain vote recording (data only, no execution)
- Delegation mechanisms
- Reputation systems
- Governance analytics

**Governance Capability**: **Advanced coordination** (still non-binding)

**Note**: Governance **NEVER** gains execution capability, regardless of phase.

## Frequently Asked Questions (FAQ)

### General

**Q: What is the TBC Diamonds DAO?**
A: A non-binding governance system using 222 NFTs to coordinate protocol-level decisions.

**Q: Can governance change deployed smart contracts?**
A: No. All protocol contracts are immutable after deployment.

**Q: Can governance control user funds?**
A: No. Governance has no custody, execution, or fund control capabilities.

**Q: Are governance votes legally binding?**
A: No. All votes are advisory opinions with no legal or technical enforcement.

### Participation

**Q: How do I vote?**
A: Own a TBC Diamonds NFT, connect wallet to voting platform (e.g., Snapshot), sign vote.

**Q: Can I delegate my voting power?**
A: Not by default. Delegation may be added via off-chain mechanisms in the future.

**Q: What if I don't vote?**
A: No penalty. Participation is optional.

**Q: Can smart contracts vote?**
A: Yes, if a smart contract owns a TBC Diamonds NFT, it can vote (via contract logic).

### Proposals

**Q: Who can submit proposals?**
A: Anyone. TBC Diamonds NFT ownership encouraged but not required.

**Q: What can proposals change?**
A: Proposals can only signal preferences or recommend actions. They cannot force changes.

**Q: How long do voting periods last?**
A: Typically 7-14 days, configurable per proposal.

### Security

**Q: Can governance steal my funds?**
A: No. Governance has no access to user funds.

**Q: What if a malicious proposal passes?**
A: Non-binding governance means harmful proposals can be ignored.

**Q: Can someone buy all NFTs and control governance?**
A: Theoretically yes, but: (1) expensive (222 NFTs), (2) votes are non-binding, (3) limited value.

### Economics

**Q: Do TBC Diamonds NFTs have value?**
A: Market determines value. Utility is governance participation, not financial returns.

**Q: Are dividends or staking rewards paid to holders?**
A: No. TBC Diamonds confer governance rights only.

**Q: Should I buy TBC Diamonds as an investment?**
A: No. These are governance participation tools, not investment vehicles.

## References

### Protocol Documentation

- [Architecture](./architecture.md) - Protocol architecture overview
- [Development Governance](./governance.md) - Development workflow governance
- [Threat Model](./threat-model.md) - Security analysis
- [Invariants](./invariants.md) - Protocol guarantees

### External Resources

- [Snapshot](https://snapshot.org) - Off-chain voting platform
- [TON NFT Standard (TEP-62)](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)
- [DAOhaus](https://daohaus.club/) - DAO frameworks (reference, not used)

### Related Issues

- Issue #36: DAO Governance (this implementation)
- Issue #2: Development Governance
- Issue #4: NFT Account Resolver

## Changelog

### Version 1.0 (2025-12-28)

- Initial governance framework documentation
- TBC Diamonds NFT governance model defined
- Security constraints and limitations documented
- Attack surface analysis completed
- Legal disclaimers added

---

## Document Status

**Version**: 1.0
**Status**: Initial Baseline
**Last Updated**: 2025-12-28
**Maintainers**: Tonbankcard Protocol Team
**Review Cycle**: Quarterly or as needed

---

## Appendix A: Governance vs. Protocol Control

To clarify the distinction between governance (allowed) and protocol control (prohibited):

| Action | Governance (Non-Binding) | Protocol Control (Prohibited) |
|--------|--------------------------|------------------------------|
| Recommend new feature | ✅ Yes | ❌ Cannot force implementation |
| Suggest fee parameter | ✅ Yes | ❌ Cannot change deployed contract |
| Vote on partnership | ✅ Yes | ❌ Cannot execute partnership |
| Signal roadmap priority | ✅ Yes | ❌ Cannot dictate development |
| Propose grant allocation | ✅ Yes | ❌ Cannot control treasury funds |
| Advise on deprecation | ✅ Yes | ❌ Cannot force shutdown |
| Express sentiment | ✅ Yes | ❌ Cannot override protocol |

**Key Insight**: Governance provides **information** (votes, signals), not **execution** (code, transactions).

---

**If governance can break the protocol, the protocol is badly designed.**
**TONBANKCARD is designed so governance cannot break it.**
