# TONBANKCARD Protocol — Public Collateral Status Lookup

**Document Type:** Public Read-Only Interface Specification
**Issue Reference:** [#34 - Issue 6.3 Public Collateral Status Lookup (Privacy-Preserving)](https://github.com/xlabtg/tonbankcard-protocol/issues/34)
**Dependencies:**
- [#7 - Issue 6.1 Account Locks & Risk Flags](https://github.com/xlabtg/tonbankcard-protocol/issues/7)
- [#18 - Issue 4.1 Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
- [#20 - Issue 4.2 Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
**Status:** Specification
**Last Updated:** 2025-12-28

---

## Purpose

This document defines a **public, read-only mechanism** to verify whether an NFT-based account has **active collateral commitments**, without exposing any sensitive details.

The lookup is designed for:
- NFT marketplaces (GetGems, etc.)
- Merchants performing pre-payment risk assessment
- External UIs displaying account status
- Compliance layers requiring risk warnings

---

## Core Design Principle

> **Reveal existence, not details.**

The system answers **only one question**:

> "Does this NFT account currently signal active collateral?"

**Nothing more.**

---

## Privacy Rationale

### Information NOT Exposed

The lookup **MUST NOT** reveal:

| Data Type | Reason for Protection |
|-----------|----------------------|
| Collateral amount | Financial privacy |
| Collateral asset | Portfolio disclosure prevention |
| Lender identity | Relationship confidentiality |
| Loan terms | Commercial sensitivity |
| Repayment status | Financial status protection |
| Transaction history | Activity pattern protection |
| Timestamps | Timing analysis prevention |
| Wallet linkages | Identity correlation prevention |

### Privacy Threat Analysis

| Threat | Mitigation |
|--------|-----------|
| Balance inference from flag timing | Single boolean return, no timestamps |
| Lender identification via flag source | No attribution data returned |
| Activity pattern analysis | No access logging exposed |
| Cross-account correlation | Lookup by NFT address only, no wallet queries |
| Enumeration attacks | Rate limiting recommended for off-chain interfaces |

### Reverse Inference Prevention

The boolean return value provides no gradient:
- `true` = active collateral (1 or more commitments)
- `false` = no active collateral (0 commitments)

There is no way to determine:
- How many collateral positions exist
- When collateral was pledged
- When collateral might be released
- Who the lending counterparty is

---

## Lookup Identity

Lookup is performed using **one of**:

| Identifier | Format | Notes |
|------------|--------|-------|
| NFT Account Address | `EQ...` / `UQ...` | Standard TON address format |
| NFT Token ID | `collection:item` | Collection address + item index |

**IMPORTANT:** Wallet addresses MUST NOT be used for lookup. This prevents:
- Cross-account correlation
- Wallet-level privacy erosion
- Identity linkage attacks

---

## Data Model

### Output Format

```
{
  hasActiveCollateral: true | false
}
```

### Constraints

| Property | Constraint |
|----------|-----------|
| Type | Boolean only |
| Metadata | None |
| Extensibility | Prohibited |
| Enums | Prohibited |
| Reason codes | Prohibited |
| Timestamps | Prohibited |

---

## On-Chain Implementation

### Get Method Specification

```func
;; Public get method for collateral status lookup
;; Returns: 1 if active collateral, 0 if no collateral
;;
;; PRIVACY: Only returns boolean, no additional data
;; TIMING: Constant-time execution to prevent timing attacks
;;
int has_active_collateral(slice nft_address) method_id {
    ;; Query the Account Locks contract for collateral lock state
    (int fraud_locked, int collateral_locked) = get_lock_state(nft_address);

    ;; Return ONLY the collateral lock status (boolean)
    ;; Fraud lock status is NOT included (separate concern)
    return collateral_locked;
}
```

### Implementation Requirements

| Requirement | Rationale |
|-------------|-----------|
| Read-only function | No state modification |
| Constant-time execution | Prevent timing attacks |
| No storage duplication | Derive from Collateral Signal Contract |
| Single boolean return | Minimize information leakage |
| No side effects | Pure function |
| No event emission | No access pattern logging |

### Integration with Account Locks Contract

The Public Collateral Lookup queries the existing `account-locks.fc` contract:

```
┌─────────────────────┐        ┌──────────────────────┐
│  Public Collateral  │        │   Account Locks      │
│  Lookup             │───────▶│   Contract           │
│                     │        │                      │
│  has_active_        │        │  get_lock_state()    │
│  collateral()       │        │  - fraud_locked      │
│                     │        │  - collateral_locked │
└─────────────────────┘        └──────────────────────┘
         │
         ▼
   Returns: true/false
   (collateral_locked ONLY)
```

---

## Off-Chain Interfaces (Optional)

Optional read-only endpoints may be provided:

### REST API

```http
GET /api/v1/collateral-status/{nft_address}

Response:
{
  "hasActiveCollateral": true
}
```

### GraphQL

```graphql
query CollateralStatus($nftAddress: Address!) {
  collateralStatus(nftAddress: $nftAddress) {
    hasActiveCollateral
  }
}
```

### TON API Wrapper

```typescript
async function hasActiveCollateral(nftAddress: Address): Promise<boolean> {
  const result = await accountLocks.getHasCollateralLock(nftAddress);
  return result;
}
```

### Off-Chain Requirements

| Requirement | Implementation |
|-------------|---------------|
| Mirror on-chain truth | Query blockchain, don't cache indefinitely |
| Avoid caching correlations | No user-level tracking |
| Non-authoritative | Document that blockchain is source of truth |
| No access logging | Don't log which NFTs are queried |

---

## UX Use Cases

### NFT Marketplaces (GetGems, etc.)

When displaying an NFT-based account:

```
┌────────────────────────────────────────────┐
│  Tonbankcard NFT #7777001                  │
│                                            │
│  ⚠️ This NFT account has active            │
│     collateral commitments.                │
│                                            │
│  Balances and terms are not publicly       │
│  visible.                                  │
│                                            │
│  [View on Explorer]  [Make Offer]          │
└────────────────────────────────────────────┘
```

### Merchant Dashboards

Pre-payment risk hint:

```
Customer Account: EQ...abc
Collateral Status: ⚠️ Active

Note: This account has collateral commitments.
Payment processing is not affected.
```

### Wallets

Optional warning before NFT transfer:

```
┌────────────────────────────────────────────┐
│  Transfer NFT #7777001?                    │
│                                            │
│  ⚠️ This NFT has active collateral         │
│     commitments that will transfer         │
│     with ownership.                        │
│                                            │
│        [Cancel]    [Continue Transfer]     │
└────────────────────────────────────────────┘
```

---

## Prohibited Extensions

The lookup **MUST NOT**:

| Prohibited Action | Reason |
|-------------------|--------|
| Block transfers | Read-only, no enforcement |
| Enforce restrictions | Informational only |
| Trigger hooks | No side effects |
| Notify third parties | No push notifications |
| Log access patterns | Privacy protection |
| Return metadata | Minimal disclosure |
| Add reason codes | No diagnostic leakage |
| Include timestamps | Timing attack prevention |

---

## Acceptance Criteria

### Functional Requirements

- [ ] Lookup returns only boolean status (`true`/`false`)
- [ ] No collateral details are exposed (amount, asset, lender, terms)
- [ ] Lookup is read-only (no state changes)
- [ ] Constant-time execution (no timing attacks)
- [ ] Works with NFT address or token ID

### Privacy Requirements

- [ ] No balance information revealed
- [ ] No lender information revealed
- [ ] No timing information revealed
- [ ] No transaction history revealed
- [ ] No wallet linkages possible

### Behavioral Requirements

- [ ] No transfer restrictions exist (informational only)
- [ ] No protocol behavior changes based on lookup
- [ ] No events emitted on lookup
- [ ] No access logging on-chain

### Invariant Verification

- [ ] Privacy invariants remain intact (no new information disclosure)
- [ ] I6 compliance (Lock ≠ Confiscation) - lookup doesn't change lock semantics
- [ ] I7 compliance (External Adapter Isolation) - external systems can't modify state via lookup

---

## Test Specifications

### 1. Correct Boolean Signaling

```typescript
describe('Correct Boolean Signaling', () => {
  it('should return true when collateral lock is active', async () => {
    // Setup: Set collateral lock on account
    await accountLocks.setCollateralLock(nftAddress);

    // Test: Query collateral status
    const hasCollateral = await lookup.hasActiveCollateral(nftAddress);

    // Assert: Returns true
    expect(hasCollateral).toBe(true);
  });

  it('should return false when no collateral lock', async () => {
    // Setup: Account with no locks
    // Test: Query collateral status
    const hasCollateral = await lookup.hasActiveCollateral(nftAddress);

    // Assert: Returns false
    expect(hasCollateral).toBe(false);
  });

  it('should return false when only fraud lock is active', async () => {
    // Setup: Set only fraud lock (NOT collateral)
    await accountLocks.setFraudLock(nftAddress);

    // Test: Query collateral status
    const hasCollateral = await lookup.hasActiveCollateral(nftAddress);

    // Assert: Returns false (fraud lock is separate concern)
    expect(hasCollateral).toBe(false);
  });
});
```

### 2. Zero Leakage Guarantees

```typescript
describe('Zero Leakage Guarantees', () => {
  it('should not expose collateral amount', async () => {
    // Setup: Account with 1000 TON collateral
    await lendingAdapter.depositCollateral(nftAddress, toNano('1000'));

    // Test: Query collateral status
    const result = await lookup.hasActiveCollateral(nftAddress);

    // Assert: Only boolean, no amount info
    expect(typeof result).toBe('boolean');
    // No way to infer amount from boolean
  });

  it('should not expose timing information', async () => {
    // Test: Query multiple times
    const time1 = Date.now();
    const result1 = await lookup.hasActiveCollateral(lockedNft);
    const elapsed1 = Date.now() - time1;

    const time2 = Date.now();
    const result2 = await lookup.hasActiveCollateral(unlockedNft);
    const elapsed2 = Date.now() - time2;

    // Assert: Execution times should be similar (constant-time)
    // Allow for network variance
    expect(Math.abs(elapsed1 - elapsed2)).toBeLessThan(100);
  });

  it('should not log access patterns', async () => {
    // Test: Query and check for events
    const result = await lookup.send(
      user.getSender(),
      { value: toNano('0.01') },
      { $$type: 'CollateralStatusQuery', nft_address: nftAddress }
    );

    // Assert: No events emitted
    expect(result.events.length).toBe(0);
  });
});
```

### 3. Adversarial Probing Attempts

```typescript
describe('Adversarial Probing Attempts', () => {
  it('should not allow state modification via lookup', async () => {
    const stateBefore = await accountLocks.getAccountLockState(nftAddress);

    // Attempt: Query with malicious intent
    await lookup.hasActiveCollateral(nftAddress);

    // Assert: State unchanged
    const stateAfter = await accountLocks.getAccountLockState(nftAddress);
    expect(stateAfter).toEqual(stateBefore);
  });

  it('should reject wallet address lookup attempts', async () => {
    // Attempt: Query using wallet address instead of NFT
    // This depends on implementation - may throw or return false
    const walletAddress = userWallet.address;

    // Assert: Either rejects or returns safe default
    // Implementation should NOT correlate wallets
  });

  it('should handle non-existent NFT gracefully', async () => {
    // Test: Query for NFT that doesn't exist
    const fakeNft = randomAddress();

    const result = await lookup.hasActiveCollateral(fakeNft);

    // Assert: Returns false (no collateral) rather than error
    expect(result).toBe(false);
  });

  it('should not reveal lock count through timing', async () => {
    // Setup: Accounts with different numbers of historical locks
    // (if tracking existed)

    // Test: Query each
    // Assert: Execution times are equivalent
  });
});
```

---

## Security Considerations

### Threat Model Integration

This component aligns with the threat model from Issue #20:

| Threat | Mitigation |
|--------|-----------|
| T4 - Lock Bypass | Read-only, cannot bypass locks |
| T6 - External Adapter | Off-chain interfaces are non-authoritative |
| T8 - Admin Key | No admin operations in lookup |

### Attack Surface

```
┌─────────────────────────────────────────────────────────────────┐
│                 PUBLIC COLLATERAL LOOKUP                         │
│                    (Read-Only Surface)                           │
├─────────────────────────────────────────────────────────────────┤
│  PUBLIC ENTRY POINTS:                                            │
│                                                                  │
│  1. has_active_collateral(slice nft_address) method_id          │
│     └─ Returns: int (0 or 1)                                    │
│     └─ Read-only, no state changes                              │
│     └─ Constant-time execution                                   │
│                                                                  │
│  THREAT VECTORS:                                                 │
│     ✅ Minimal attack surface (read-only)                        │
│     ✅ No authorization required (public data)                   │
│     ✅ No side effects possible                                  │
│     ⚠️ Rate limiting recommended for off-chain endpoints         │
│                                                                  │
│  SECURITY PROPERTIES:                                            │
│     ✅ Cannot modify state                                       │
│     ✅ Cannot leak private data                                  │
│     ✅ Cannot trigger actions                                    │
│     ✅ Cannot log access patterns                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guidelines

### Do's

- Return only boolean (true/false)
- Query existing Account Locks contract
- Use constant-time operations
- Handle non-existent NFTs gracefully
- Document non-authoritative nature of off-chain endpoints

### Don'ts

- Don't add metadata to response
- Don't emit events on query
- Don't cache per-user query patterns
- Don't add extensibility hooks
- Don't add reason codes
- Don't return timestamps
- Don't allow state modification

---

## Integration Examples

### Smart Contract Integration

```func
;; Example: NFT marketplace checking collateral status before listing
() check_before_listing(slice nft_address) impure {
    int has_collateral = public_collateral_lookup.has_active_collateral(nft_address);

    if (has_collateral) {
        ;; Set warning flag on listing (informational only)
        listing~set_collateral_warning();
    }

    ;; Listing proceeds regardless (no blocking)
}
```

### TypeScript Integration

```typescript
import { PublicCollateralLookup } from './wrappers/PublicCollateralLookup';

async function displayNFTStatus(nftAddress: Address) {
  const lookup = await PublicCollateralLookup.fromAddress(lookupContractAddress);

  const hasCollateral = await lookup.getHasActiveCollateral(nftAddress);

  if (hasCollateral) {
    console.log("⚠️ This NFT has active collateral commitments.");
  } else {
    console.log("✅ No active collateral.");
  }
}
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-28 | Initial specification | AI Issue Solver |

---

## References

- [Issue #34 - Public Collateral Status Lookup](https://github.com/xlabtg/tonbankcard-protocol/issues/34)
- [Issue #7 - Account Locks & Risk Flags](https://github.com/xlabtg/tonbankcard-protocol/issues/7)
- [docs/invariants.md](./invariants.md) - Protocol Invariants
- [docs/threat-model.md](./threat-model.md) - Security Analysis
- [contracts/payments/account-locks.fc](../contracts/payments/account-locks.fc) - Lock Implementation

---

## Final Warning

This lookup is **informational only**.

Any attempt to:
- Expand output beyond boolean
- Add enforcement mechanisms
- Introduce heuristics
- Log access patterns

**MUST BE REJECTED.**
