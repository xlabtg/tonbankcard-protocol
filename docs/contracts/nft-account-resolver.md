# NFT Account Resolver

## Overview

The NFT Account Resolver is a core protocol component that provides account abstraction by linking NFT cards to their owners and internal TONBANKCARD accounts. This module serves as a read-only verification layer that other protocol contracts use to validate NFT-based account operations.

## Purpose

In TONBANKCARD:
- **Each NFT card = a bank account**
- NFT ownership = account authority
- Balances are stored separately (in TBC token contract)
- NFT is used for identity, ownership proof, and access control

The Resolver provides a **stateless, deterministic interface** for:
1. Verifying NFT ownership
2. Validating NFTs as protocol accounts
3. Checking account state flags
4. Preventing unauthorized access

## Architecture Role

```
┌─────────────────────────────────────────────────────┐
│                 Protocol Contracts                   │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Payment Hub  │  │   Merchant   │  │  Lending  │ │
│  │   Contract   │  │   Payments   │  │  Module   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
│         └─────────────────┼─────────────────┘        │
│                           ▼                          │
│              ┌─────────────────────────┐             │
│              │ NFT Account Resolver    │             │
│              │  (Stateless Verifier)   │             │
│              └────────────┬────────────┘             │
│                           │                          │
└───────────────────────────┼──────────────────────────┘
                            ▼
            ┌───────────────────────────────┐
            │    External NFT Contracts     │
            │                               │
            │  • Series 7777 Collection     │
            │  • Series 8888 Collection     │
            └───────────────────────────────┘
```

## Public Interface

### Get Methods

#### 1. `resolve_owner_with_validation`

**Purpose**: Resolve and validate NFT ownership

**Signature**:
```func
(slice, int, slice, int) resolve_owner_with_validation(
    slice nft_address,
    slice collection_addr,
    slice owner_addr,
    int index,
    int is_initialized
)
```

**Parameters**:
- `nft_address` - NFT item contract address
- `collection_addr` - NFT collection address (from NFT's get_nft_data)
- `owner_addr` - Current owner address (from NFT's get_nft_data)
- `index` - NFT index in collection
- `is_initialized` - Whether NFT is initialized (not burned)

**Returns**:
- `owner_addr` - Current owner address
- `is_valid` - Boolean (true if NFT is valid account)
- `collection_addr` - Collection address
- `index` - NFT index

**Usage**:
```func
(slice owner, int valid, slice collection, int idx) =
    resolver.resolve_owner_with_validation(nft_addr, coll, own, idx, init);

if (valid) {
    ;; Proceed with operation
}
```

#### 2. `is_valid_account_nft`

**Purpose**: Validate if NFT can be used as protocol account

**Signature**:
```func
int is_valid_account_nft(slice collection_addr, int is_initialized)
```

**Parameters**:
- `collection_addr` - NFT collection address
- `is_initialized` - Whether NFT is initialized

**Returns**:
- `int` - Boolean (-1 for true, 0 for false)

**Validation Rules**:
1. ✅ NFT belongs to whitelisted collection (7777 or 8888)
2. ✅ NFT is initialized (not burned)
3. ✅ NFT is not blocked by protocol (future: check Payment Hub)

**Usage**:
```func
int is_valid = resolver.is_valid_account_nft(collection_addr, is_init);
throw_unless(403, is_valid);  ;; Forbidden: Invalid account NFT
```

#### 3. `get_account_flags`

**Purpose**: Get account state flags

**Signature**:
```func
(int, int, int) get_account_flags(slice nft_address)
```

**Returns**:
- `has_active_collateral` - Boolean
- `is_restricted` - Boolean
- `is_merchant` - Boolean

**Note**: Flags are stored in Payment Hub contract (Issue #3). This method provides read interface.

**Usage**:
```func
(int has_collateral, int restricted, int merchant) =
    resolver.get_account_flags(nft_addr);

if (has_collateral) {
    ;; Handle collateral restrictions
}
```

#### 4. `is_whitelisted_collection`

**Purpose**: Check if collection is allowed in protocol

**Signature**:
```func
int is_whitelisted_collection(slice collection_addr)
```

**Returns**:
- `int` - Boolean (-1 for true, 0 for false)

**Whitelisted Collections**:
- Series 7777: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- Series 8888: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`

#### 5. `get_whitelisted_collections`

**Purpose**: Get all whitelisted collection addresses

**Signature**:
```func
(slice, slice) get_whitelisted_collections()
```

**Returns**:
- `collection_7777` - Address of Series 7777 collection
- `collection_8888` - Address of Series 8888 collection

## Security Guarantees

### ✅ Resolver DOES:
- Provide stateless verification
- Validate NFT ownership (with external data)
- Check collection whitelist
- Be deterministic and reproducible
- Have minimal gas consumption

### ❌ Resolver DOES NOT:
- Store balances
- Accept or custody funds
- Block or restrict NFTs
- Modify NFT ownership
- Cache owner data (always verify on-chain)

## Integration Guide

### For Smart Contracts

```func
;; 1. Verify NFT ownership before operation
(slice owner, int valid, _, _) = nft_resolver.resolve_owner_with_validation(
    nft_addr, collection, owner, index, init
);
throw_unless(403, valid);

;; 2. Validate sender is NFT owner
throw_unless(403, equal_slices(sender(), owner));

;; 3. Check account flags if needed
(int has_collateral, int restricted, int merchant) =
    nft_resolver.get_account_flags(nft_addr);

throw_if(409, restricted);  ;; Account is restricted
```

### For Off-Chain Services

The Resolver requires **external data** from NFT contracts. Off-chain indexers should:

1. **Query NFT contract** via `get_nft_data()`:
   ```typescript
   const nftData = await nftContract.getGetNftData();
   // Returns: { init, index, collection_address, owner_address, individual_content }
   ```

2. **Pass data to Resolver**:
   ```typescript
   const validation = await resolver.getResolveOwnerWithValidation(
       nftAddress,
       nftData.collection_address,
       nftData.owner_address,
       nftData.index,
       nftData.init ? -1 : 0
   );
   ```

3. **Handle validation result**:
   ```typescript
   if (validation.is_valid) {
       // NFT is valid account
       console.log(`Owner: ${validation.owner_addr}`);
   }
   ```

## Edge Cases

### 1. NFT Transfer During Active Collateral

**Scenario**: User transfers NFT while it has active collateral

**Behavior**:
- Resolver correctly identifies new owner
- `has_active_collateral` flag remains true
- Payment Hub should prevent restricted operations
- **NOT BLOCKED**: Transfer is allowed (NFTs are transferable)

**Handling**:
```func
(int has_collateral, _, _) = resolver.get_account_flags(nft_addr);
if (has_collateral) {
    ;; Check with Payment Hub if operation is allowed
}
```

### 2. NFT Transfer During Merchant Integration

**Scenario**: NFT is transferred while linked to merchant account

**Behavior**:
- Resolver identifies new owner
- `is_merchant` flag remains true
- Merchant API must re-verify ownership
- Old owner loses access, new owner gains access

**Handling**: Merchant API should subscribe to ownership changes

### 3. NFT Owned by Smart Wallet

**Scenario**: NFT is owned by a smart contract wallet

**Behavior**:
- Resolver returns smart wallet address as owner
- Operations work normally
- Smart wallet controls NFT transfers

**No special handling needed** - protocol is address-agnostic

### 4. NFT from Wrong Collection

**Scenario**: User tries to use NFT from non-whitelisted collection

**Behavior**:
- `is_valid_account_nft` returns false
- Operations are rejected

**Error Code**: `403 Forbidden`

### 5. Burned NFT

**Scenario**: NFT has `is_initialized = false`

**Behavior**:
- `is_valid_account_nft` returns false
- All operations rejected

**Error Code**: `410 Gone`

### 6. NFT Contract Temporarily Unavailable

**Scenario**: Network issues or NFT contract bounce

**Behavior**:
- Off-chain: Retry with exponential backoff
- On-chain: Operation fails (no cached data)

**Recommendation**: Use reliable indexer with fallback nodes

## Assumptions

1. **NFT Contracts are Immutable**: Collections 7777 and 8888 cannot change
2. **TEP-62 Compliance**: NFTs implement standard `get_nft_data()` method
3. **No Caching**: Ownership is verified on-chain each time
4. **External Data Source**: Resolver requires NFT data as parameters
5. **Payment Hub Exists**: For full functionality, depends on Issue #3

## Limitations

1. **Not an Oracle**: Cannot query NFT contracts directly (async blockchain)
2. **Requires External Data**: Caller must provide NFT ownership info
3. **No Historical Data**: Only validates current state
4. **No State Flags Storage**: Flags are stored in Payment Hub
5. **Two Collections Only**: Hardcoded to 7777 and 8888 series

## Future Extensions (Out of Scope)

- ❌ Time-lock on NFT (separate contract needed)
- ❌ DAO-based freeze (governance layer)
- ❌ Marketplace integration warnings
- ❌ Dynamic collection whitelist (requires governance)
- ❌ Cross-chain NFT support

## Gas Costs

Approximate gas consumption (estimated):

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| `is_valid_account_nft` | ~1,500 gas | Address comparison + validation |
| `resolve_owner_with_validation` | ~2,000 gas | Full validation with returns |
| `get_account_flags` | ~1,000 gas | Read-only (placeholder) |
| `is_whitelisted_collection` | ~1,000 gas | Simple address comparison |

**Total for typical flow**: ~3,000-4,000 gas (very cheap)

## Testing Strategy

See `tests/nft-resolver/` for comprehensive test suite:

1. **Ownership Tests**:
   - Valid NFT from 7777 collection
   - Valid NFT from 8888 collection
   - Invalid NFT from unknown collection
   - Burned NFT validation

2. **Transfer Tests**:
   - NFT transfer updates owner correctly
   - Transfer with active collateral flag
   - Transfer with merchant flag

3. **Edge Case Tests**:
   - Smart wallet as owner
   - Multiple rapid transfers
   - Invalid collection addresses
   - Malformed NFT data

4. **Integration Tests**:
   - Payment Hub integration
   - Merchant API integration
   - Anti-fraud checks

## References

- [Issue #4](https://github.com/xlabtg/tonbankcard-protocol/issues/4) - Original requirements
- [Issue #3](https://github.com/xlabtg/tonbankcard-protocol/issues/3) - Payment Hub Contract dependency
- [TEP-62](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md) - NFT Standard
- [Architecture](../architecture.md) - Protocol architecture
- [Existing Contracts](../existing-contracts.md) - NFT collection addresses

## Security Audit Checklist

- [x] No fund custody
- [x] No admin controls
- [x] No mutable state (except Payment Hub reference)
- [x] No ownership modification
- [x] Stateless design
- [x] Deterministic results
- [x] Gas-efficient
- [x] Hardcoded collection addresses
- [x] TEP-62 compliant interface

## Deployment Notes

1. Deploy contract with null Payment Hub
2. After Issue #3 completion, set Payment Hub address
3. Verify whitelisted collections are correct
4. Test all get methods
5. Integrate with Payment Hub
6. Deploy off-chain indexer for NFT data

## License

TBD (follows repository license)

---

**Document Version**: 1.0
**Contract Version**: 1.0
**Last Updated**: 2024
**Status**: Implementation Complete
