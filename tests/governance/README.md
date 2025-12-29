# Governance Tests

This directory contains tests for the governance layer of the Tonbankcard Protocol.

## Overview

These tests verify the correctness, security, and privacy guarantees of the governance transparency layer.

## Test Files

### TransparencyRegistry.spec.ts

Tests for Issue #40 - Governance Transparency & Public Records (Read-Only)

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

## Privacy Test Checklist

The privacy tests verify that the transparency layer does NOT expose:

- [ ] Wallet addresses
- [ ] NFT holder identities
- [ ] Vote timestamps (individual)
- [ ] Individual vote choices
- [ ] Delegation graphs

## Security Considerations

Tests also verify security properties:

- Zero protocol authority
- Append-only data model
- No admin bypass functions
- Input validation
- Error handling

## References

- [Issue #40 - Governance Transparency](https://github.com/xlabtg/tonbankcard-protocol/issues/40)
- [docs/governance-transparency.md](../../docs/governance-transparency.md)
- [contracts/governance/README.md](../../contracts/governance/README.md)

---

**Last Updated**: 2025-12-29
