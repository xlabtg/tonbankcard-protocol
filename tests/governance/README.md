# Governance Tests

## Overview

Comprehensive test suite for TBC Diamonds DAO governance system.

## Test Files

- `DiamondGovernance.spec.ts` - Main test suite for governance components

## Test Coverage

### Diamond Resolver Contract Tests

✅ **Governance Metadata**
- Total supply validation (222 NFTs)
- Governance type indicator (advisory-only)
- Collection address configuration

✅ **Diamond Index Validation**
- Valid indices (0-221)
- Invalid indices (negative, >= 222)
- Boundary conditions

✅ **Quorum Calculation**
- Various quorum percentages (10%, 20%, 50%, 100%)
- Rounding behavior
- Invalid percentage rejection

✅ **Vote Outcome Calculation**
- Simple majority voting
- Tie handling
- Abstention exclusion from majority
- Quorum validation
- Vote overflow protection

### Snapshot Tool Tests

✅ **Snapshot Creation**
- Distributed ownership
- Single owner (centralization)
- All unique owners
- Uninitialized/burned NFT exclusion
- Voter sorting by index

✅ **Snapshot Verification**
- Structural integrity
- Duplicate detection
- Range validation
- Voting power validation
- Participation warnings
- Centralization warnings

✅ **NFT Transfer Timing Attacks**
- Double voting prevention (transfer after snapshot)
- Legitimate transfers (before snapshot)
- Rapid transfer handling

✅ **Edge Cases**
- Smart contract as NFT owner
- Multiple NFTs per owner
- Zero participation
- All abstentions

### Security Property Tests

✅ **Non-Custodial Guarantees**
- No fund custody capability
- No execution capability
- No protocol control

✅ **Advisory-Only Enforcement**
- Non-binding governance indication
- No legal obligations

✅ **Attack Surface Minimization**
- Read-only operations
- No state changes
- Governance cannot break protocol

### Integration Tests

✅ **Snapshot to Voting Flow**
- End-to-end workflow validation

✅ **Multi-Owner Voting**
- Vote tallying across multiple owners

## Running Tests

```bash
# Run all governance tests
npm run test:governance

# Run with coverage
npm run test:governance -- --coverage

# Run specific test file
npm run test tests/governance/DiamondGovernance.spec.ts

# Watch mode
npm run test:governance -- --watch
```

## Test Philosophy

All tests validate that:

1. **Governance is Advisory**: No execution capabilities
2. **Non-Custodial**: No fund custody at any level
3. **Read-Only**: No protocol state modifications
4. **Snapshot-Based**: Prevents timing attacks
5. **Transparent**: All logic is testable and verifiable

## Mock Data

Tests use mock snapshots with configurable:
- Owner distribution (1 to 222 unique owners)
- Block numbers
- Excluded NFT indices (simulating uninitialized NFTs)

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

## Future Test Enhancements

Potential additions (out of scope for Issue #36):

- On-chain contract tests (when deployed)
- Gas consumption benchmarks
- Fuzz testing for vote calculations
- Integration with actual NFT collection
- Historical snapshot verification
- Delegation tests (if added)

## References

- [DAO Governance Docs](../../docs/dao-governance.md)
- [Diamond Resolver Contract](../../contracts/governance/README.md)
- [Snapshot Tool](../../scripts/governance/README.md)

---

**Test Coverage Goal**: > 90% for all governance components
