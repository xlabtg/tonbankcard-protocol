# NFT Account Resolver Contract

## Overview

This directory contains the NFT Account Resolver smart contract, which provides core account abstraction functionality for the TONBANKCARD protocol.

## Files

- **`nft_account_resolver.fc`** - FunC implementation (production-ready)
- **`nft_account_resolver.tact`** - Tact implementation (alternative, for reference)
- **`README.md`** - This file

## Purpose

The NFT Account Resolver links NFT cards to their owners and validates NFT-based accounts. It serves as a stateless verification layer that other protocol contracts use to:

1. Verify NFT ownership
2. Validate NFTs as protocol accounts
3. Check account state flags
4. Prevent unauthorized access

## Key Features

- ✅ **Stateless Design**: No mutable state, purely verification logic
- ✅ **Read-Only**: No fund custody, no transfers, no state changes
- ✅ **Gas Efficient**: Minimal computation for validation
- ✅ **Deterministic**: Same inputs always produce same outputs
- ✅ **TEP-62 Compliant**: Works with standard TON NFTs
- ✅ **Security First**: Hardcoded collection whitelist

## Whitelisted Collections

The resolver validates NFTs from two collections:

1. **Series 7777**: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
2. **Series 8888**: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`

These addresses are **hardcoded** and cannot be changed after deployment.

## Public Interface (Get Methods)

### Core Methods

```func
;; Resolve and validate NFT ownership
(slice, int, slice, int) resolve_owner_with_validation(
    slice nft_address,
    slice collection_addr,
    slice owner_addr,
    int index,
    int is_initialized
)

;; Validate NFT as protocol account
int is_valid_account_nft(slice collection_addr, int is_initialized)

;; Get account state flags
(int, int, int) get_account_flags(slice nft_address)

;; Check if collection is whitelisted
int is_whitelisted_collection(slice collection_addr)

;; Get whitelisted collections
(slice, slice) get_whitelisted_collections()
```

## Usage Example

### From Another Smart Contract

```func
#include "nft_account_resolver.fc";

() process_payment(slice sender, slice nft_addr, int amount) impure {
    ;; Get NFT data (from off-chain or another contract)
    slice collection = get_nft_collection(nft_addr);
    slice owner = get_nft_owner(nft_addr);
    int index = get_nft_index(nft_addr);
    int is_init = get_nft_init_status(nft_addr);

    ;; Validate with resolver
    (slice resolved_owner, int is_valid, _, _) =
        resolver.resolve_owner_with_validation(
            nft_addr, collection, owner, index, is_init
        );

    throw_unless(403, is_valid);  ;; Forbidden: Invalid NFT
    throw_unless(403, equal_slices(sender, resolved_owner));  ;; Forbidden: Not owner

    ;; Proceed with payment...
}
```

### From Off-Chain (TypeScript)

```typescript
import { Address } from '@ton/core';

// Step 1: Get NFT data from blockchain
const nftContract = blockchain.openContract(NFTItem.createFromAddress(nftAddress));
const nftData = await nftContract.getGetNftData();

// Step 2: Validate with Resolver
const resolver = blockchain.openContract(NFTAccountResolver.createFromAddress(resolverAddress));
const validation = await resolver.getResolveOwnerWithValidation(
    nftAddress,
    nftData.collection_address,
    nftData.owner_address,
    nftData.index,
    nftData.init ? -1n : 0n
);

// Step 3: Check result
if (validation.is_valid) {
    console.log(`Valid NFT account owned by ${validation.owner_addr}`);
} else {
    console.error('Invalid NFT account');
}
```

## Security Considerations

### What This Contract DOES NOT Do

❌ **No Fund Custody**: Contract never holds user funds
❌ **No Transfers**: Cannot initiate or block NFT transfers
❌ **No State Changes**: Purely read-only verification
❌ **No Admin Controls**: No privileged operations
❌ **No Caching**: Always requires fresh NFT data

### Security Guarantees

✅ **Stateless**: No storage of ownership data
✅ **Deterministic**: Same inputs = same outputs
✅ **Non-Custodial**: Complies with protocol principles
✅ **Immutable**: Hardcoded collection whitelist
✅ **Gas-Efficient**: Minimal attack surface

## Integration with Other Contracts

### Dependencies

- **None** (standalone contract)

### Dependents

- **Payment Hub** (Issue #3) - Uses resolver for account validation
- **Merchant Payments** - Validates customer NFTs
- **Lending Module** - Verifies collateral NFT ownership
- **Anti-Fraud Engine** - Checks account flags

## Edge Cases Handled

1. ✅ **NFT Transfer During Collateral**: Resolver correctly identifies new owner
2. ✅ **NFT Transfer During Merchant Integration**: New owner gains access
3. ✅ **Smart Wallet as Owner**: Works with contract owners
4. ✅ **Invalid Collection**: Rejects non-whitelisted NFTs
5. ✅ **Burned NFT**: Rejects uninitialized NFTs
6. ✅ **Rapid Transfers**: Stateless design handles any transfer frequency

## Testing

See `tests/nft-resolver/NFTAccountResolver.spec.ts` for comprehensive test suite covering:

- Collection validation
- NFT account validation
- Owner resolution
- Account flags
- Edge cases
- Security properties
- Gas efficiency
- Integration scenarios

## Deployment

### Prerequisites

1. TON development environment (FunC compiler, etc.)
2. Access to TON testnet/mainnet
3. NFT collection addresses verified

### Deployment Steps

```bash
# 1. Compile contract
func -o nft_account_resolver.fif -SPA nft_account_resolver.fc

# 2. Generate deployment cell
fift -s build.fif

# 3. Deploy to testnet
# (Use your preferred deployment tool)

# 4. Verify get methods work
# (Test with ton-http-api or similar)

# 5. Set Payment Hub address (after Issue #3)
# (One-time configuration)
```

## Gas Costs

Estimated gas consumption:

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| `is_valid_account_nft` | ~1,500 | Simple validation |
| `resolve_owner_with_validation` | ~2,000 | Full validation |
| `get_account_flags` | ~1,000 | Placeholder (no Payment Hub yet) |
| `is_whitelisted_collection` | ~1,000 | Address comparison |

**Total typical flow**: ~3,000-4,000 gas (very efficient)

## Future Enhancements

Out of scope for this issue, but potential future additions:

- Dynamic collection whitelist (requires governance)
- Time-lock support (separate contract)
- DAO-based restrictions
- Historical ownership tracking
- Cross-chain NFT validation

## Documentation

- [Complete Documentation](../../docs/contracts/nft-account-resolver.md)
- [Issue #4](https://github.com/xlabtg/tonbankcard-protocol/issues/4) - Requirements
- [Architecture](../../docs/architecture.md) - Protocol architecture

## Contributing

All changes must follow [CONTRIBUTING.md](../../CONTRIBUTING.md) guidelines:

1. Create an Issue first
2. Follow non-custodial principles
3. Include tests
4. Update documentation
5. Security review required

## License

TBD (follows repository license)

---

**Contract Version**: 1.0
**Status**: Implementation Complete
**Last Updated**: 2024
