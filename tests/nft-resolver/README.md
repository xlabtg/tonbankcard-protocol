# NFT Account Resolver Tests

## Overview

Comprehensive test suite for the NFT Account Resolver contract, covering all functionality, edge cases, and security properties.

## Test Structure

```
tests/nft-resolver/
├── NFTAccountResolver.spec.ts   # Main test suite
├── README.md                     # This file
└── fixtures/                     # Test data (future)
```

## Test Categories

### 1. Collection Validation
- Whitelisted collections (7777, 8888)
- Unknown collections rejected
- Collection enumeration

### 2. NFT Account Validation
- Valid NFTs from both collections
- Invalid collections rejected
- Burned NFTs rejected
- Initialization status checks

### 3. Owner Resolution
- Valid owner resolution
- Invalid collection handling
- Burned NFT handling
- Ownership transfer scenarios

### 4. Account Flags
- Default flag values
- Multiple NFT queries
- Payment Hub integration (future)

### 5. Edge Cases
- NFT transfer during active collateral
- Smart contract as owner
- Multiple collection support
- Rapid ownership changes

### 6. Security Properties
- Stateless verification
- Message rejection
- Fund rejection
- Deterministic behavior

### 7. Gas Efficiency
- Validation gas costs
- Resolution gas costs
- Performance benchmarks

### 8. Integration Scenarios
- Payment Hub pattern
- Merchant payment validation
- Multi-contract workflows

## Running Tests

### Prerequisites

```bash
npm install
# or
yarn install
```

### Run All Tests

```bash
npm test
# or
yarn test
```

### Run Specific Test Suite

```bash
npm test -- NFTAccountResolver.spec.ts
```

### Run with Coverage

```bash
npm run test:coverage
```

## Test Data

### Mock Addresses

```typescript
// Whitelisted collections (real addresses)
const COLLECTION_7777 = Address.parse('EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
const COLLECTION_8888 = Address.parse('EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7');

// Mock addresses for testing
const mockNFTAddress = Address.parse('EQA' + '0'.repeat(46));
const mockOwner = Address.parse('EQB' + '1'.repeat(46));
const mockInvalidCollection = Address.parse('EQD' + '3'.repeat(46));
```

## Expected Test Results

All tests should pass with 100% coverage:

```
✓ Collection Validation (4 tests)
✓ NFT Account Validation (5 tests)
✓ Owner Resolution with Validation (5 tests)
✓ Account Flags (2 tests)
✓ Edge Cases (8 tests)
✓ Security Properties (4 tests)
✓ Gas Efficiency (2 tests)
✓ Integration Scenarios (2 tests)

Total: 32 tests
All passing ✓
```

## Coverage Requirements

- **Statements**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Lines**: 100%

## Edge Case Testing

### 1. NFT Transfer During Active Collateral

**Scenario**: NFT is transferred while it has active collateral

**Test**:
```typescript
test('should allow transfer validation even with collateral flag', async () => {
    const result = await resolver.getResolveOwnerWithValidation(
        mockNFTAddress, COLLECTION_7777, mockNewOwner, 1n, true
    );
    expect(result.is_valid).toBe(true);
    expect(result.owner_addr).toEqualAddress(mockNewOwner);
});
```

**Expected**: Transfer is allowed, new owner is identified

### 2. Smart Contract as Owner

**Scenario**: NFT is owned by a smart contract wallet

**Test**:
```typescript
test('should accept smart contract as owner', async () => {
    const smartWalletAddress = resolver.address;
    const result = await resolver.getResolveOwnerWithValidation(
        mockNFTAddress, COLLECTION_7777, smartWalletAddress, 1n, true
    );
    expect(result.is_valid).toBe(true);
});
```

**Expected**: Smart contract ownership is valid

### 3. Rapid Ownership Changes

**Scenario**: NFT is transferred multiple times quickly

**Test**:
```typescript
test('should handle multiple sequential owner changes', async () => {
    const owners = [mockOwner, mockNewOwner, deployer.address];
    for (const owner of owners) {
        const result = await resolver.getResolveOwnerWithValidation(
            mockNFTAddress, COLLECTION_7777, owner, 1n, true
        );
        expect(result.owner_addr).toEqualAddress(owner);
        expect(result.is_valid).toBe(true);
    }
});
```

**Expected**: All ownership changes are handled correctly

## Security Testing

### 1. Stateless Verification

**Test**: Multiple queries with different owners should not interfere

```typescript
test('should be stateless (no storage of ownership)', async () => {
    const result1 = await resolver.getResolveOwnerWithValidation(..., mockOwner, ...);
    const result2 = await resolver.getResolveOwnerWithValidation(..., mockNewOwner, ...);

    expect(result1.owner_addr).toEqualAddress(mockOwner);
    expect(result2.owner_addr).toEqualAddress(mockNewOwner);
});
```

### 2. Message Rejection

**Test**: Contract should reject all incoming messages

```typescript
test('should reject incoming messages (read-only contract)', async () => {
    const result = await resolver.send(user.getSender(), { value: toNano('0.1') }, 'test');
    expect(result.transactions).toHaveTransaction({
        success: false,
    });
});
```

### 3. Fund Rejection

**Test**: Contract should not accept funds

```typescript
test('should not accept funds', async () => {
    const initialBalance = await getBalance(resolver.address);
    try {
        await resolver.send(user.getSender(), { value: toNano('1.0') }, null);
    } catch (e) { /* Expected */ }
    const finalBalance = await getBalance(resolver.address);
    expect(finalBalance).toBeLessThanOrEqual(initialBalance + toNano('0.01'));
});
```

## Gas Benchmarks

Expected gas consumption for each operation:

| Operation | Expected Gas | Max Acceptable |
|-----------|--------------|----------------|
| `is_valid_account_nft` | ~1,500 | < 2,500 |
| `resolve_owner_with_validation` | ~2,000 | < 3,500 |
| `get_account_flags` | ~1,000 | < 2,000 |
| `is_whitelisted_collection` | ~1,000 | < 2,000 |

## Integration Testing

### Payment Hub Integration Pattern

```typescript
test('Payment Hub integration pattern', async () => {
    // Step 1: Validate NFT
    const isValid = await resolver.getIsValidAccountNft(collectionAddr, true);
    expect(isValid).toBe(true);

    // Step 2: Resolve owner
    const ownerInfo = await resolver.getResolveOwnerWithValidation(...);
    expect(ownerInfo.is_valid).toBe(true);

    // Step 3: Check flags
    const flags = await resolver.getGetAccountFlags(nftAddr);
    expect(flags).toBeDefined();
});
```

## Troubleshooting

### Common Issues

1. **Test Timeout**
   - Increase timeout in test configuration
   - Check network connectivity

2. **Address Parsing Errors**
   - Verify address format (EQ prefix)
   - Check address length (48 characters)

3. **Contract Deployment Failures**
   - Ensure sufficient balance in deployer
   - Verify contract code compiles

4. **Assertion Failures**
   - Check expected vs actual values
   - Verify test data setup

## Future Test Additions

- [ ] Payment Hub integration tests (after Issue #3)
- [ ] Account flag mutation tests (after Issue #3)
- [ ] Real NFT contract integration tests
- [ ] Load testing (many concurrent queries)
- [ ] Fuzz testing for edge cases

## Contributing

When adding new tests:

1. Follow existing test structure
2. Include descriptive test names
3. Test both success and failure cases
4. Add edge case coverage
5. Update this README

## References

- [Contract Documentation](../../docs/contracts/nft-account-resolver.md)
- [Issue #4](https://github.com/xlabtg/tonbankcard-protocol/issues/4)
- [TON Sandbox](https://github.com/ton-community/sandbox)
- [TON Test Utils](https://github.com/ton-community/test-utils)

---

**Last Updated**: 2024
**Test Coverage**: 100% (target)
**Status**: Implementation Complete
