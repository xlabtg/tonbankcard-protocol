# Lending Adapter Tests (Issue 6.2)

This directory contains tests for the CoinRabbit Lending Adapter.

## Test Categories

### 1. Identity Resolution Correctness

Tests verifying that NFT-based borrower identity resolution works correctly:

- Valid NFT Account ID formats (Series 7777, 8888)
- Invalid and malformed IDs
- Collection address derivation
- Owner address handling

### 2. Adversarial Lender Behavior Simulation

Tests ensuring lenders cannot abuse the adapter:

- No custody mechanisms available
- Cannot modify on-chain state
- Cannot forge identity
- Cannot bypass validation
- Cannot track debt in protocol

### 3. Failure Mode Handling

Tests for edge cases and error handling:

- Invalid input handling
- Edge cases (long IDs, special characters)
- Collateral signal handling
- Loan intent failures
- Reference tracking failures

### 4. Security Invariant Verification

Tests confirming security properties:

- Non-custodial verification
- Read-only collateral access
- No lender authority
- Adapter replaceability

## Running Tests

```bash
# Run all lending adapter tests
npm test -- tests/lending-adapter/

# Run with coverage
npm test -- --coverage tests/lending-adapter/

# Run specific test file
npm test -- tests/lending-adapter/LendingAdapter.spec.ts
```

## Key Security Properties Tested

1. **Adapter provides NO custody mechanism**
   - No methods to lock, transfer, or seize funds
   - No access to private keys
   - All operations are read-only or off-chain

2. **Lender has ZERO protocol-level authority**
   - No callback mechanisms
   - No hooks or triggers
   - Cannot execute protocol actions

3. **All verification includes disclaimers**
   - Every response to lenders includes explicit disclaimer
   - Protocol makes no guarantees

4. **Identity is NFT-based, not wallet-based**
   - NFT Account ID is the primary identifier
   - Wallet address is informational only

## Test Coverage Goals

| Area | Target Coverage |
|------|-----------------|
| Identity Resolution | 100% |
| Adversarial Scenarios | 100% |
| Error Handling | 95% |
| Security Invariants | 100% |

## Adding New Tests

When adding tests, ensure they verify:

1. Non-custodial properties are maintained
2. Lender cannot gain protocol authority
3. All user data includes proper disclaimers
4. Error cases fail safely
5. NFT-based identity is preserved

## References

- [Issue 6.2 Specification](https://github.com/xlabtg/tonbankcard-protocol/issues/32)
- [Lending Adapter Documentation](../../docs/lending-adapter.md)
- [Adapter Implementation](../../backend/adapters/coinrabbit.ts)
