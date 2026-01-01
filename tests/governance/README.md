# Governance Tests

## Overview

Comprehensive test suite for the TBC Diamonds DAO governance system and transparency layer.

## Test Files

- `TransparencyRegistry.spec.ts` - Transparency layer tests (Issue #40)
- `ProposalRegistry.spec.ts` - Proposal submission and management (Issue #38)
- `SnapshotVerifier.spec.ts` - Snapshot verification (Issue #38)
- `DiamondGovernance.spec.ts` - Diamond resolver tests (Issue #36)

## Test Coverage

### TransparencyRegistry Tests (Issue #40)

Tests for Governance Transparency & Public Records (Read-Only)

**Test Categories:**

1. **Proposal Archive** - Completeness and accuracy of public records
   - Recording new proposals with all required fields
   - Proposal count accuracy
   - Category-based filtering
   - Validation of category ranges

2. **Voting Summary** - Aggregated data correctness
   - Recording voting results (aggregated only)
   - Quorum detection
   - Outcome tracking
   - Threshold configuration

3. **Governance Assets** - Snapshot verification
   - Fixed total supply (222)
   - Snapshot block height
   - Verification hash

4. **Immutability** - Records cannot be modified
   - Append-only proposal records
   - Accurate outcome statistics

5. **Privacy** - No individual voter data exposed
   - No voter addresses in responses
   - Hash-only content storage
   - Aggregated voting data only

6. **No Write Paths** - Read-only verification
   - Getters do not modify state
   - No admin modification functions

### Diamond Resolver Contract Tests

**Governance Metadata**
- Total supply validation (222 NFTs)
- Governance type indicator (advisory-only)
- Collection address configuration

**Diamond Index Validation**
- Valid indices (0-221)
- Invalid indices (negative, >= 222)
- Boundary conditions

**Quorum Calculation**
- Various quorum percentages (10%, 20%, 50%, 100%)
- Rounding behavior
- Invalid percentage rejection

**Vote Outcome Calculation**
- Simple majority voting
- Tie handling
- Abstention exclusion from majority
- Quorum validation
- Vote overflow protection

### Snapshot Tool Tests

**Snapshot Creation**
- Distributed ownership
- Single owner (centralization)
- All unique owners
- Uninitialized/burned NFT exclusion
- Voter sorting by index

**Snapshot Verification**
- Structural integrity
- Duplicate detection
- Range validation
- Voting power validation
- Participation warnings
- Centralization warnings

**NFT Transfer Timing Attacks**
- Double voting prevention (transfer after snapshot)
- Legitimate transfers (before snapshot)
- Rapid transfer handling

**Edge Cases**
- Smart contract as NFT owner
- Multiple NFTs per owner
- Zero participation
- All abstentions

### Security Property Tests

**Non-Custodial Guarantees**
- No fund custody capability
- No execution capability
- No protocol control

**Advisory-Only Enforcement**
- Non-binding governance indication
- No legal obligations

**Attack Surface Minimization**
- Read-only operations
- No state changes
- Governance cannot break protocol

### Integration Tests

**Snapshot to Voting Flow**
- End-to-end workflow validation

**Multi-Owner Voting**
- Vote tallying across multiple owners

## Running Tests

```bash
# Run all governance tests
npx blueprint test tests/governance/

# Run specific test file
npx blueprint test tests/governance/TransparencyRegistry.spec.ts

# Run with coverage
npx blueprint test tests/governance/ --coverage

# Run specific test suite
npx blueprint test tests/governance/TransparencyRegistry.spec.ts -t "Proposal Archive"

# Alternative commands
npm run test:governance
npm run test:governance -- --coverage
npm run test tests/governance/DiamondGovernance.spec.ts

# Watch mode
npm run test:governance -- --watch
```

## Test Structure

Tests follow the Blueprint testing framework pattern:

```typescript
describe('TransparencyRegistry - Feature', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let transparencyRegistry: SandboxContract<TransparencyRegistry>;

    beforeEach(async () => {
        // Setup blockchain sandbox
        blockchain = await Blockchain.create();
        // Deploy contract
        transparencyRegistry = blockchain.openContract(...);
    });

    describe('SubFeature', () => {
        it('should behave correctly', async () => {
            // Arrange
            // Act
            // Assert
        });
    });
});
```

## Test Coverage Requirements

All tests must verify:

| Requirement | Test Coverage |
|-------------|---------------|
| Completeness of public records | Proposal archive tests |
| Immutability guarantees | Immutability tests |
| Privacy leakage resistance | Privacy tests |
| No write paths (read-only) | No-write-path verification |
| Event emission for indexing | Event emission tests |
| Non-custodial guarantees | Security tests |
| Advisory-only enforcement | Security tests |

## Test Philosophy

All tests validate that:

1. **Governance is Advisory**: No execution capabilities
2. **Non-Custodial**: No fund custody at any level
3. **Read-Only**: No protocol state modifications
4. **Snapshot-Based**: Prevents timing attacks
5. **Transparent**: All logic is testable and verifiable

## Privacy Test Checklist

The privacy tests verify that the transparency layer does NOT expose:

- [ ] Wallet addresses
- [ ] NFT holder identities
- [ ] Vote timestamps (individual)
- [ ] Individual vote choices
- [ ] Delegation graphs

## Security Test Cases

### Cannot Custody Funds

Validates that governance contracts:
- Have no `recv_internal` message processing
- Have no `send_raw_message` calls
- Cannot hold or transfer funds

### Cannot Execute Decisions

Validates that governance:
- Has no execution methods
- Has no admin privileges
- Cannot modify protocol state

### Cannot Break Protocol

Validates that even malicious governance:
- Cannot steal funds
- Cannot brick contracts
- Cannot censor users

## Key Test Scenarios

### 1. NFT Transfer Timing Attack

```typescript
// Alice owns Diamond #0, votes, then transfers to Bob
// Bob CANNOT vote with Diamond #0 (snapshot prevents this)
```

**Expected**: Only owner at snapshot block can vote

### 2. Single Owner Centralization

```typescript
// One address owns all 222 NFTs
```

**Expected**: Valid but warning issued

### 3. Quorum Validation

```typescript
// 10% quorum = 23 votes minimum
// 50 votes cast -> quorum met
```

**Expected**: Proposal can pass if quorum met

### 4. Simple Majority

```typescript
// 60 FOR, 40 AGAINST, 50 ABSTAIN
// Majority = FOR > AGAINST (60 > 40)
```

**Expected**: Proposal passes (abstentions excluded)

## Mock Data

Tests use mock snapshots with configurable:
- Owner distribution (1 to 222 unique owners)
- Block numbers
- Excluded NFT indices (simulating uninitialized NFTs)

## Adding New Tests

When adding tests, ensure:

1. **Clear Test Names**: Describe what is being tested
2. **Isolated Tests**: Each test is independent
3. **Edge Cases**: Cover boundary conditions
4. **Security Focus**: Validate non-custodial guarantees
5. **Documentation**: Comment complex scenarios

### Test Template

```typescript
describe('Feature Name', () => {
  it('should validate expected behavior', () => {
    // Arrange
    const input = setupTestData();

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Commits to main branch
- Nightly builds

All tests must pass before merge.

## References

- [Issue #40 - Governance Transparency](https://github.com/xlabtg/tonbankcard-protocol/issues/40)
- [Issue #38 - Proposal Registry](https://github.com/xlabtg/tonbankcard-protocol/issues/38)
- [Issue #36 - TBC Diamonds DAO](https://github.com/xlabtg/tonbankcard-protocol/issues/36)
- [Governance Transparency Docs](../../docs/governance-transparency.md)
- [DAO Governance Docs](../../docs/dao-governance.md)
- [Diamond Resolver Contract](../../contracts/governance/README.md)
- [Snapshot Tool](../../scripts/governance/README.md)

---

**Test Coverage Goal**: > 90% for all governance components
**Last Updated**: 2026-01-01
