# Public Collateral Status Lookup Contract

**Issue Reference:** [#34 - Issue 6.3 Public Collateral Status Lookup (Privacy-Preserving)](https://github.com/xlabtg/tonbankcard-protocol/issues/34)

---

## Overview

This contract provides a **public, read-only mechanism** to verify whether an NFT-based account has **active collateral commitments**, without exposing any sensitive details.

### Core Design Principle

> **Reveal existence, not details.**

The contract answers **ONLY ONE question**:

> "Does this NFT account currently signal active collateral?"

---

## Privacy Guarantees

The lookup **DOES NOT** expose:

| Protected Data | Description |
|----------------|-------------|
| Collateral amount | Financial privacy |
| Collateral asset | Portfolio disclosure prevention |
| Lender identity | Relationship confidentiality |
| Loan terms | Commercial sensitivity |
| Repayment status | Financial status protection |
| Transaction history | Activity pattern protection |
| Timestamps | Timing analysis prevention |
| Wallet linkages | Identity correlation prevention |

---

## Public Interface

### Get Methods

#### `has_active_collateral(slice nft_address) -> int`

Returns whether an NFT account has active collateral commitments.

**Parameters:**
- `nft_address` (slice): The NFT account address to query

**Returns:**
- `1` if active collateral exists
- `0` if no active collateral

**Example:**
```func
int has_collateral = public_collateral_lookup.has_active_collateral(nft_address);

if (has_collateral) {
    ;; Display warning to user
}
```

#### `get_version() -> int`

Returns the contract version number.

**Returns:**
- Contract version (currently `1`)

#### `get_account_locks_contract() -> slice`

Returns the address of the Account Locks contract used for queries.

**Returns:**
- Account Locks contract address

---

## Deployment

### Initialization

The contract requires the Account Locks contract address during deployment:

```typescript
// Deploy with Account Locks contract address
const deployResult = await lookup.send(
    deployer.getSender(),
    { value: toNano('0.05') },
    {
        $$type: 'Deploy',
        accountLocksAddress: accountLocksContract.address
    }
);
```

---

## Integration Examples

### NFT Marketplace Integration

```typescript
async function displayNFTWarning(nftAddress: Address): Promise<void> {
    const lookup = new PublicCollateralLookup(lookupAddress);
    const hasCollateral = await lookup.getHasActiveCollateral(nftAddress);

    if (hasCollateral) {
        showWarning("This NFT has active collateral commitments.");
    }
}
```

### Merchant Pre-Payment Check

```typescript
async function prePaymentCheck(payerNft: Address): Promise<RiskLevel> {
    const hasCollateral = await lookup.getHasActiveCollateral(payerNft);

    return hasCollateral ? RiskLevel.WARNING : RiskLevel.NORMAL;
}
```

### Wallet Transfer Warning

```typescript
async function checkBeforeTransfer(nftAddress: Address): Promise<boolean> {
    const hasCollateral = await lookup.getHasActiveCollateral(nftAddress);

    if (hasCollateral) {
        return await confirmTransfer(
            "This NFT has active collateral. Continue transfer?"
        );
    }
    return true;
}
```

---

## Prohibited Extensions

The following are **EXPLICITLY PROHIBITED** per Issue #34:

| Function | Reason |
|----------|--------|
| `get_collateral_amount()` | Exposes financial details |
| `get_lender_address()` | Exposes relationship |
| `get_loan_terms()` | Exposes contract terms |
| `get_lock_timestamp()` | Enables timing analysis |
| `log_query()` | Creates access patterns |
| `block_transfer()` | This is informational only |
| `notify_third_party()` | Privacy violation |

Any attempt to add these functions **MUST BE REJECTED**.

---

## Security Properties

| Property | Status |
|----------|--------|
| Read-only | No state modification possible |
| Constant-time | No timing attacks |
| No events | No access pattern logging |
| No side effects | Pure function |
| Privacy-preserving | Boolean-only return |

---

## Testing

See: [`tests/collateral-lookup/`](../../tests/collateral-lookup/)

### Test Categories

1. **Correct Boolean Signaling** - Returns correct true/false values
2. **Zero Leakage Guarantees** - No metadata, timing, or access patterns
3. **Adversarial Probing** - Handles malicious queries safely

---

## References

- [docs/public-collateral-lookup.md](../../docs/public-collateral-lookup.md) - Full specification
- [contracts/payments/account-locks.fc](../payments/account-locks.fc) - Lock implementation
- [docs/invariants.md](../../docs/invariants.md) - Protocol invariants
