# Privacy Design & Threat Analysis

**Issue Reference**: #40
**Component**: Governance Transparency Layer
**Status**: Implementation Draft

---

## Executive Summary

This document provides a comprehensive privacy design explanation and threat analysis for the TONBANKCARD Governance Transparency Layer. The design prioritizes **privacy by default** while maintaining **public verifiability** of governance outcomes.

---

## Privacy Design Principles

### 1. Minimum Exposure Principle

The transparency layer exposes the **minimum data necessary** for verifiability:

| Data Type | Exposed | Reason |
|-----------|---------|--------|
| Proposal ID | Yes | Reference identifier |
| Proposal Hash | Yes | Verification without content |
| Proposal Category | Yes | Classification |
| Voting Window | Yes | Temporal context |
| Outcome | Yes | Governance result |
| Total Votes | Yes | Aggregate verification |
| **Voter Addresses** | **NO** | Privacy violation |
| **Individual Votes** | **NO** | Privacy violation |
| **Vote Timestamps** | **NO** | Timing attack vector |

### 2. Aggregation-Only Model

All voting data is aggregated before exposure:

```
Individual Vote Records (Private)        Aggregated Summary (Public)
┌─────────────────────────────┐         ┌─────────────────────────┐
│ voter: 0xABCD...            │         │ proposal_id: 12         │
│ vote: YES                   │    →    │ total_votes_cast: 143   │
│ timestamp: 1704067200       │         │ quorum_met: true        │
│ nft_id: 7777-0001           │         │ passed: true            │
└─────────────────────────────┘         └─────────────────────────┘
        NOT EXPOSED                           EXPOSED
```

### 3. Hash-Only Content Storage

Proposal content is stored as cryptographic hash:

```
Proposal Content (Private)              Hash Reference (Public)
┌─────────────────────────────┐         ┌─────────────────────────┐
│ "Integration with DEX X     │         │ proposal_hash:          │
│  recommended for improved   │    →    │ 0x7f3a8b2c...89bc       │
│  liquidity access..."       │         │                         │
└─────────────────────────────┘         └─────────────────────────┘
        NOT STORED                            STORED
```

This allows:
- External verification that content matches hash
- No content modification after submission
- Privacy for proposal details until published off-chain

---

## Data Classification

### Public Data (Exposed)

| Field | Type | Purpose |
|-------|------|---------|
| `proposal_id` | Integer | Unique identifier |
| `proposal_hash` | Hash | Content verification |
| `category` | Enum | Classification |
| `voting_window_start` | Timestamp | Period start |
| `voting_window_end` | Timestamp | Period end |
| `outcome` | Enum | Final result |
| `total_votes_cast` | Integer | Aggregate count |
| `quorum_threshold` | Integer | Requirement |
| `quorum_met` | Boolean | Status |
| `passed` | Boolean | Result |
| `total_supply` | Integer | Fixed: 222 |
| `snapshot_block_height` | Integer | Reference block |
| `snapshot_hash` | Hash | Verification |

### Private Data (Never Exposed)

| Field | Type | Why Private |
|-------|------|-------------|
| Wallet addresses | Address | Voter identity |
| NFT holder list | Address[] | Ownership privacy |
| Individual votes | Vote[] | Vote privacy |
| Vote timestamps | Timestamp[] | Timing correlation |
| Delegation mapping | Map | Relationship exposure |
| Vote change history | Log[] | Behavior tracking |
| Proposal content | String | Pre-publish privacy |

---

## Threat Analysis

### 1. Deanonymization Attacks

**Threat**: Identifying voters through available data

| Attack Vector | Protection |
|--------------|------------|
| Address enumeration | No address data stored |
| Vote timing analysis | No individual timestamps |
| Correlation with on-chain activity | Minimal on-chain footprint |
| NFT ownership tracking | Only total supply exposed |

**Residual Risk**: LOW

An attacker cannot identify who voted from transparency layer data alone.

### 2. Vote Buying/Coercion

**Threat**: Proving how someone voted to enable bribery or coercion

| Attack Vector | Protection |
|--------------|------------|
| Vote receipt generation | No individual votes exposed |
| Proof of participation | Only aggregate shown |
| Delegation tracking | No delegation data |

**Residual Risk**: LOW

Without individual vote data, vote buyers cannot verify compliance.

### 3. Metadata Leakage

**Threat**: Inferring private information from public metadata

| Attack Vector | Protection |
|--------------|------------|
| Proposal timing analysis | Only voting windows shown |
| Category pattern analysis | General categories only |
| Outcome prediction | Historical data only |

**Residual Risk**: LOW

Available metadata is too coarse for meaningful inference.

### 4. Social Pressure Attacks

**Threat**: Using public data to pressure voters

| Attack Vector | Protection |
|--------------|------------|
| "Top voter" rankings | Explicitly forbidden |
| Participation shaming | No participation tracking |
| Vote choice exposure | Aggregated data only |

**Residual Risk**: LOW

Design explicitly forbids features enabling social pressure.

### 5. Historical Data Mining

**Threat**: Mining historical records for sensitive patterns

| Attack Vector | Protection |
|--------------|------------|
| Voting pattern analysis | Only outcomes stored |
| Participation trends | Only counts stored |
| Address correlation | No addresses stored |

**Residual Risk**: VERY LOW

Historical data contains no sensitive fields to mine.

---

## Attack Surface Analysis

### On-Chain Contract

```
┌─────────────────────────────────────────────────────────────┐
│                 TransparencyRegistry Contract                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ENTRY POINTS (Inbound Messages):                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ RecordProposal     - Append-only, validated input   │   │
│  │ RecordVotingResult - Append-only, no voter data     │   │
│  │ RecordSnapshot     - Append-only, public data       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  EXIT POINTS (View Functions):                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ getProposalSummary()   - Aggregated, no addresses   │   │
│  │ getVotingSummary()     - Aggregated, no votes       │   │
│  │ getGovernanceStats()   - Aggregate counts only      │   │
│  │ getAssetSnapshot()     - Public snapshot data       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  FORBIDDEN OPERATIONS:                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✗ No address queries                                │   │
│  │ ✗ No vote enumeration                               │   │
│  │ ✗ No record modification                            │   │
│  │ ✗ No admin functions                                │   │
│  │ ✗ No delegation exposure                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Off-Chain Index

```
┌─────────────────────────────────────────────────────────────┐
│                    Off-Chain Index (Optional)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DATA SOURCES:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ On-chain events only (no external data)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SCHEMA CONSTRAINTS:                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ No wallet_addresses field                           │   │
│  │ No individual_votes field                           │   │
│  │ No vote_timestamps field                            │   │
│  │ No delegation_graphs field                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  REQUIRED DISCLAIMERS:                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "This data is non-authoritative"                    │   │
│  │ "Verify all data on-chain"                          │   │
│  │ "Governance outcomes are advisory only"             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Privacy Guarantees Matrix

| Guarantee | Implementation | Verification |
|-----------|----------------|--------------|
| No voter identification | No address storage | Type system + review |
| No vote disclosure | Aggregation only | Contract design |
| No timing correlation | No individual timestamps | Struct definition |
| No delegation exposure | Field not implemented | Contract design |
| Content privacy | Hash-only storage | Data model |
| Immutable records | Append-only design | No update functions |

---

## Compliance Considerations

### GDPR Alignment

| Principle | Transparency Layer Approach |
|-----------|---------------------------|
| Data Minimization | Only aggregate data stored |
| Purpose Limitation | Read-only, archival only |
| Storage Limitation | Append-only, no deletion |
| Accuracy | Mirrors on-chain truth |
| Integrity | Immutable records |

**Note**: GDPR applies to personal data. The transparency layer intentionally stores no personal data.

### Privacy by Design

The transparency layer implements Privacy by Design principles:

1. **Proactive not Reactive** - Privacy built into design, not added later
2. **Privacy as Default** - No configuration needed for privacy
3. **Privacy Embedded** - Core architecture ensures privacy
4. **Full Functionality** - Transparency without sacrificing privacy
5. **End-to-End Security** - No data leakage points
6. **Visibility and Transparency** - Design is documented and verifiable
7. **Respect for User Privacy** - Users control their identity

---

## Security Recommendations

### For Protocol Developers

1. **Never add address fields** to public data structures
2. **Always aggregate** before exposing voting data
3. **Use hashes** instead of storing content
4. **Audit all new getters** for privacy leaks
5. **Test for enumeration attacks** in all list operations

### For Off-Chain Implementers

1. **Follow the schema strictly** - no additional fields
2. **Include required disclaimers** on all views
3. **Never cache more data** than the schema allows
4. **Implement rate limiting** to prevent enumeration
5. **Use HTTPS** for all data access

### For Indexer Operators

1. **Index only emitted events** - no additional on-chain scanning
2. **Respect schema constraints** - no address enrichment
3. **Maintain audit logs** of data access patterns
4. **Implement data retention limits** where applicable

---

## Verification Checklist

Use this checklist to verify privacy compliance:

### Contract Level
- [ ] No Address type in public structs
- [ ] No voter enumeration functions
- [ ] No individual vote queries
- [ ] No timestamp exposure per vote
- [ ] No delegation mapping exposed

### Schema Level
- [ ] JSON schema has no address fields
- [ ] No individual vote array definitions
- [ ] Required disclaimer field present
- [ ] Privacy notice documented

### Test Level
- [ ] Privacy leakage tests implemented
- [ ] No-enumeration tests pass
- [ ] Aggregate-only verification
- [ ] Hash-only content verification

---

## Conclusion

The TONBANKCARD Governance Transparency Layer achieves the goal of **public verifiability** while maintaining **strong privacy guarantees**. The design:

1. **Exposes minimum necessary data** for governance verification
2. **Aggregates all voting data** to protect individual privacy
3. **Uses hash references** instead of storing content
4. **Explicitly forbids** privacy-violating features
5. **Provides clear guidance** for implementation

The residual privacy risk is **LOW** across all analyzed threat vectors.

---

## References

- [Issue #40 - Governance Transparency](https://github.com/xlabtg/tonbankcard-protocol/issues/40)
- [docs/governance-transparency.md](./governance-transparency.md)
- [contracts/governance/README.md](../contracts/governance/README.md)
- [docs/governance.md](./governance.md) - Protocol governance principles

---

**Document Status**: Implementation Draft
**Last Updated**: 2025-12-29
**Security Review**: Pending
**Maintainers**: Tonbankcard Protocol Team
