# NFT Account Resolver - Implementation Notes

## Implementation Summary

This document provides additional context about the NFT Account Resolver implementation for Issue #4.

## Design Decisions

### 1. Stateless Architecture

**Decision**: Make the resolver completely stateless (except Payment Hub reference)

**Rationale**:
- Ensures consistent behavior across calls
- Prevents stale ownership data
- Reduces gas costs
- Eliminates attack vectors from state manipulation
- Aligns with protocol's deterministic principles

**Trade-off**: Requires external data (NFT ownership info) to be provided by caller

### 2. Hardcoded Collection Whitelist

**Decision**: Hardcode collection addresses in contract code

**Rationale**:
- Maximum security (no governance attack surface)
- Collections are deployed and immutable
- Prevents malicious collection addition
- Aligns with protocol's immutability principle

**Trade-off**: Cannot add new collections without deploying new resolver

**Future**: If more collections needed, deploy new resolver or use governance-controlled whitelist contract

### 3. Read-Only Contract (Rejects All Messages)

**Decision**: Contract rejects all incoming messages

**Rationale**:
- Prevents accidental fund transfers
- Reduces attack surface
- Clear purpose: verification only
- No state changes needed

**Implementation**: `recv_internal` throws `0xffff` for all non-bounced messages

### 4. External Data Requirement

**Decision**: Resolver requires NFT data as parameters (doesn't query NFT contracts)

**Rationale**:
- TON is async blockchain (cross-contract calls are complex)
- Off-chain indexers can batch NFT queries efficiently
- On-chain contracts already have NFT data from validation
- Keeps resolver simple and gas-efficient

**Usage Pattern**:
```typescript
// Off-chain: Query NFT first
const nftData = await nftContract.getGetNftData();

// Then validate
const validation = await resolver.resolveOwner(nftData);
```

### 5. Payment Hub Integration (Future)

**Decision**: Include Payment Hub reference but don't enforce it yet

**Rationale**:
- Payment Hub is dependency (Issue #3)
- Resolver should work standalone for testing
- Flags functionality will be completed after Issue #3

**Current State**: `get_account_flags` returns default values (all false)

**Future**: After Issue #3, flags will query Payment Hub contract

## Security Analysis

### Threat Model

**Threats Mitigated**:
1. ✅ **Unauthorized NFT usage**: Whitelist prevents invalid collections
2. ✅ **Stale ownership data**: Stateless design forces fresh validation
3. ✅ **Fund theft**: Read-only, no fund handling
4. ✅ **Admin takeover**: No admin functions
5. ✅ **Collection poisoning**: Hardcoded whitelist

**Out of Scope** (handled elsewhere):
- NFT transfer restrictions (Payment Hub responsibility)
- Balance manipulation (TBC token responsibility)
- Collateral enforcement (Lending module responsibility)

### Attack Vectors Considered

1. **Fake NFT Collection**
   - Mitigation: Hardcoded whitelist
   - Result: Invalid NFTs rejected

2. **Ownership Spoofing**
   - Mitigation: Caller must provide authentic NFT data
   - Result: Off-chain indexer or on-chain caller validates
   - Note: Resolver trusts caller has verified NFT data source

3. **Gas Exhaustion**
   - Mitigation: Simple operations, no loops
   - Result: ~3-4k gas per operation (very cheap)

4. **Reentrancy**
   - Mitigation: No external calls, no state changes
   - Result: Not vulnerable

5. **Integer Overflow**
   - Mitigation: Only uses index (from NFT), no arithmetic
   - Result: Not vulnerable

## Gas Optimization

### Optimization Techniques

1. **Inline Helper Functions**: `is_whitelisted_collection?` marked inline
2. **Minimal State**: Only Payment Hub address stored
3. **No Loops**: All operations are O(1)
4. **Direct Comparisons**: Address comparison via `equal_slices`

### Gas Benchmarks

| Operation | Expected | Actual (testnet) | Notes |
|-----------|----------|------------------|-------|
| `is_valid_account_nft` | 1,500 | TBD | After deployment |
| `resolve_owner_with_validation` | 2,000 | TBD | After deployment |
| `get_account_flags` | 1,000 | TBD | Placeholder only |
| `is_whitelisted_collection` | 1,000 | TBD | After deployment |

**Total typical flow**: ~3,000-4,000 gas (very efficient)

## Testing Strategy

### Test Coverage Goals

- **Statements**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Lines**: 100%

### Test Categories

1. **Unit Tests**: Individual function validation
2. **Integration Tests**: Multi-contract workflows
3. **Edge Case Tests**: Unusual but valid scenarios
4. **Security Tests**: Malicious input handling
5. **Gas Tests**: Performance benchmarks

### Critical Test Scenarios

1. ✅ Valid NFT from both collections (7777, 8888)
2. ✅ Invalid NFT from unknown collection
3. ✅ Burned NFT (is_initialized = false)
4. ✅ NFT ownership transfer
5. ✅ Smart contract as owner
6. ✅ Rapid sequential transfers
7. ✅ Message rejection
8. ✅ Fund rejection
9. ✅ Deterministic behavior

## Future Enhancements

### Phase 2 (After Issue #3 - Payment Hub)

- [ ] Complete `get_account_flags` implementation
- [ ] Query Payment Hub for account state
- [ ] Handle account restrictions
- [ ] Integrate collateral checks

### Phase 3 (Governance Layer)

- [ ] Dynamic collection whitelist (via governance)
- [ ] Time-lock support for NFTs
- [ ] DAO-based freeze mechanism
- [ ] Cross-chain NFT validation

### Phase 4 (Advanced Features)

- [ ] Historical ownership tracking
- [ ] Batch validation endpoints
- [ ] Off-chain signature verification
- [ ] NFT metadata validation

## Known Limitations

1. **Two Collections Only**: Hardcoded to 7777 and 8888
   - Future: Deploy new resolver or use whitelist contract

2. **External Data Required**: Cannot query NFT contracts directly
   - Future: Could add async query support (complex)

3. **No Historical Data**: Only validates current state
   - Future: Add indexer-based history

4. **Placeholder Flags**: Account flags not functional until Issue #3
   - Future: Integrate with Payment Hub

5. **No Batch Operations**: One NFT at a time
   - Future: Add batch validation methods

## Deployment Checklist

### Pre-Deployment

- [ ] Code review complete
- [ ] Security audit (if applicable)
- [ ] All tests passing
- [ ] Gas costs acceptable
- [ ] Documentation complete

### Deployment Steps

1. [ ] Compile FunC contract
2. [ ] Verify bytecode
3. [ ] Deploy to testnet
4. [ ] Test get methods on testnet
5. [ ] Verify whitelisted collections
6. [ ] Deploy to mainnet
7. [ ] Verify deployment
8. [ ] Document contract address
9. [ ] Update dependent contracts

### Post-Deployment

- [ ] Monitor gas usage
- [ ] Check for unexpected behavior
- [ ] Update documentation with address
- [ ] Integrate with Payment Hub (after Issue #3)
- [ ] Update off-chain indexer

## Integration Examples

### Payment Hub Integration

```func
// In Payment Hub contract
#include "nft_account_resolver.fc";

() process_transfer(slice sender, slice nft_addr, int amount) impure {
    // Get NFT data (from indexer or previous validation)
    slice collection = get_nft_collection(nft_addr);
    slice owner = get_nft_owner(nft_addr);
    int index = get_nft_index(nft_addr);
    int is_init = 1;  // From NFT contract

    // Validate with resolver
    (slice resolved_owner, int is_valid, _, _) =
        nft_resolver.resolve_owner_with_validation(
            nft_addr, collection, owner, index, is_init
        );

    throw_unless(403, is_valid);
    throw_unless(403, equal_slices(sender, resolved_owner));

    // Check flags
    (int has_collateral, int restricted, int merchant) =
        nft_resolver.get_account_flags(nft_addr);

    throw_if(409, restricted);  // Account restricted

    // Process transfer...
}
```

### Off-Chain Indexer Integration

```typescript
// Indexer service
class NFTAccountIndexer {
    async validateAccount(nftAddress: Address): Promise<boolean> {
        // 1. Query NFT contract
        const nftContract = await getNFTContract(nftAddress);
        const nftData = await nftContract.getGetNftData();

        // 2. Validate with resolver
        const resolver = await getResolverContract();
        const validation = await resolver.getResolveOwnerWithValidation(
            nftAddress,
            nftData.collection_address,
            nftData.owner_address,
            nftData.index,
            nftData.init ? -1n : 0n
        );

        // 3. Cache result (with TTL)
        await cache.set(`nft:${nftAddress}`, validation, TTL_60_SECONDS);

        return validation.is_valid;
    }
}
```

## References

- [Issue #4](https://github.com/xlabtg/tonbankcard-protocol/issues/4) - Original requirements
- [TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md) - NFT Standard
- [Architecture](../../docs/architecture.md) - Protocol architecture
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development guidelines

## Changelog

### Version 1.0 (Initial Implementation)
- ✅ Core resolver functionality
- ✅ Collection whitelist (7777, 8888)
- ✅ Ownership validation
- ✅ Account flags interface (placeholder)
- ✅ Comprehensive tests
- ✅ Complete documentation

---

**Document Version**: 1.0
**Contract Version**: 1.0
**Last Updated**: 2024-12-25
**Status**: Implementation Complete
