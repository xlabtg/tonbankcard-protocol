# Governance Contracts

## Overview

This directory contains **read-only helper contracts** for the TBC Diamonds DAO governance system.

**CRITICAL**: These contracts provide **information only**. They have **NO execution capability**, **NO fund custody**, and **NO protocol control**.

## Contracts

### `diamond_resolver.fc`

**Purpose**: Read-only helper for TBC Diamonds NFT ownership resolution and vote counting

**Type**: Stateless, informational contract

**Functions**:
- Query TBC Diamonds collection metadata
- Validate Diamond NFT indices
- Calculate quorum requirements
- Compute voting outcomes
- Provide governance helper methods

**What It DOES**:
- ✅ Validates Diamond NFT indices (0-221)
- ✅ Calculates quorum and vote tallies
- ✅ Returns governance metadata
- ✅ Performs read-only computations

**What It DOES NOT Do**:
- ❌ Execute governance decisions
- ❌ Control protocol contracts
- ❌ Custody funds or NFTs
- ❌ Transfer assets
- ❌ Modify protocol state
- ❌ Enforce voting outcomes

## Governance Philosophy

All governance contracts follow these principles:

1. **Advisory Only**: No binding execution
2. **Non-Custodial**: No fund custody
3. **Read-Only**: No state changes to protocol
4. **Transparent**: All logic is open source
5. **Minimal**: Simplest possible implementation

## Security Properties

| Property | Status |
|----------|--------|
| Fund Custody | ❌ None |
| Execution Capability | ❌ None |
| Protocol Control | ❌ None |
| State Modification | ❌ None |
| Admin Keys | ❌ None |
| Upgrade Proxies | ❌ None |

**Risk Level**: **MINIMAL** (read-only, stateless, non-custodial)

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

## Testing

See `tests/governance/DiamondGovernance.spec.ts` for comprehensive tests.

## Deployment

**Prerequisites**:
- TBC Diamonds NFT collection deployed
- Collection address verified

**Deployment Steps**:

```bash
# 1. Compile contract
func -o diamond_resolver.fif -SPA diamond_resolver.fc

# 2. Deploy with collection address
# (Use your preferred deployment tool)

# 3. Verify get methods
# Test that get_governance_metadata() returns correct values
```

## Integration

### With Snapshot Scripts

The `scripts/governance/snapshot.ts` utility uses this contract to:
- Validate Diamond indices
- Calculate voting power
- Verify snapshot integrity

### With Off-Chain Voting

Voting platforms (e.g., Snapshot) use this for:
- NFT ownership verification
- Vote weight calculation
- Quorum validation

## Documentation

- [DAO Governance Documentation](../../docs/dao-governance.md) - Complete governance framework
- [Development Governance](../../docs/governance.md) - Development workflow
- [Architecture](../../docs/architecture.md) - Protocol architecture

## Contributing

All changes to governance contracts require:

1. **Issue Creation**: Describe proposed change
2. **Security Review**: Governance changes are security-sensitive
3. **Community Discussion**: Governance affects all stakeholders
4. **Tests**: Comprehensive test coverage required
5. **Documentation**: Update this README and dao-governance.md

**Never Add**:
- Execution capabilities
- Fund custody
- Protocol control
- State modification
- Admin privileges

## License

TBD (follows repository license)

---

**Remember**: If governance can break the protocol, the protocol is badly designed.

TONBANKCARD is designed so governance **cannot** break it.
