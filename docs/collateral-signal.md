# Collateral Signal Contract — Documentation

**Document Type:** Protocol Extension Documentation
**Status:** Implementation
**Issue Reference:** [#30 - Collateral Signal Contract (TON-Based, Non-Custodial)](https://github.com/xlabtg/tonbankcard-protocol/issues/30)
**Last Updated:** 2025-12-28

---

## Overview

The Collateral Signal Contract is a **pure signaling layer** that allows NFT-based accounts to signal the presence of active collateral denominated in TON. This contract deliberately stops short of enforcement—it provides visibility into collateral status without ever taking custody of funds or controlling any assets.

### Key Principle

> **Collateral is signaled, not controlled.**

---

## Design Principles (MANDATORY)

The Collateral Signal Contract adheres to strict non-custodial principles:

| Principle | Guarantee |
|-----------|-----------|
| **Never custody funds** | Contract holds no user funds at any time |
| **Never lock assets** | No locking mechanism exists in the contract |
| **Never seize assets** | No confiscation capability |
| **Never initiate transfers** | Cannot move funds |
| **Never liquidate positions** | No liquidation logic |
| **Strictly opt-in** | All actions are user-initiated |

---

## Trust Model

The Collateral Signal Contract operates under a **zero-trust** model between all parties:

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRUST MODEL                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Protocol ─────── does NOT trust ─────── Lenders               │
│                                                                  │
│   Lenders ──────── do NOT trust ──────── Protocol               │
│                                                                  │
│   Collateral existence ────── verified ────── On-Chain          │
│                                                                  │
│   Enforcement ─────────────── happens ─────── Off-Protocol      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- The protocol does **not** trust lenders
- Lenders do **not** trust the protocol
- Collateral existence is verified **on-chain**
- Enforcement happens **off-protocol**

---

## Collateral Model

### Collateral Asset

- **TON native asset only** (v1)
- No wrapped or synthetic assets
- Amount is informational (not custodied)

### Account Binding

- Collateral is associated with the **NFT account ID**
- Not bound to wallet addresses
- Ownership derived exclusively from NFT ownership

### Signal States

The contract defines four indicative (non-authoritative) states:

| State | Value | Description |
|-------|-------|-------------|
| `NONE` | 0 | No collateral signaled |
| `ACTIVE` | 1 | Active collateral signaled |
| `WARNING` | 2 | Warning state (user-defined threshold) |
| `RELEASED` | 3 | Collateral released |

**Important:** These states are informational only and do not confer any enforcement rights.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Collateral Signal Contract                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────┐       ┌────────────────────┐           │
│   │    NFT Owner       │       │  External Lender   │           │
│   │  (Full Control)    │       │   (Read Only)      │           │
│   └─────────┬──────────┘       └─────────┬──────────┘           │
│             │                            │                       │
│             │ WRITE                      │ READ                  │
│             ▼                            ▼                       │
│   ┌─────────────────────────────────────────────────────┐       │
│   │              Signal State Storage                    │       │
│   │  ┌──────────────────────────────────────────────┐   │       │
│   │  │ NFT Address → CollateralSignalInfo           │   │       │
│   │  │   - signal_state (NONE/ACTIVE/WARNING/...)   │   │       │
│   │  │   - collateral_amount_ton                    │   │       │
│   │  │   - created_at                               │   │       │
│   │  │   - updated_at                               │   │       │
│   │  └──────────────────────────────────────────────┘   │       │
│   └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Contract Interface

### Messages (Write Operations)

Only the NFT owner can send these messages:

#### SignalCollateralRequest
```tact
message SignalCollateralRequest {
    nft_address: Address;             // The NFT account signaling collateral
    collateral_amount_ton: Int;       // Amount of TON collateral to signal
}
```

#### UpdateCollateralSignalRequest
```tact
message UpdateCollateralSignalRequest {
    nft_address: Address;             // The NFT account to update
    new_state: Int;                   // New signal state (0-3)
    collateral_amount_ton: Int;       // Updated collateral amount
}
```

#### ReleaseCollateralSignalRequest
```tact
message ReleaseCollateralSignalRequest {
    nft_address: Address;             // The NFT account to release signal from
}
```

### Getter Functions (Read Operations)

Available to all readers (Payment Hub, lenders, anyone):

| Function | Return Type | Description |
|----------|-------------|-------------|
| `getCollateralSignalInfo(nft_address)` | `CollateralSignalInfo` | Full signal information |
| `getCollateralSignalState(nft_address)` | `Int` | Current signal state (0-3) |
| `getSignaledCollateralAmount(nft_address)` | `Int` | Signaled TON amount |
| `hasActiveCollateralSignal(nft_address)` | `Bool` | True if ACTIVE or WARNING |

---

## Events

The contract emits events for indexing and monitoring:

### CollateralSignaled
```tact
message CollateralSignaled {
    nft_address: Address;
    collateral_amount_ton: Int;
    timestamp: Int;
}
```

### CollateralSignalUpdated
```tact
message CollateralSignalUpdated {
    nft_address: Address;
    previous_state: Int;
    new_state: Int;
    collateral_amount_ton: Int;
    timestamp: Int;
}
```

### CollateralSignalReleased
```tact
message CollateralSignalReleased {
    nft_address: Address;
    previous_amount_ton: Int;
    timestamp: Int;
}
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | `ERROR_CS_NONE` | Success |
| 1 | `ERROR_CS_NOT_OWNER` | Sender is not the NFT owner |
| 2 | `ERROR_CS_INVALID_STATE` | Invalid signal state value |
| 3 | `ERROR_CS_INVALID_AMOUNT` | Invalid collateral amount |
| 4 | `ERROR_CS_ALREADY_ACTIVE` | Signal already active |
| 5 | `ERROR_CS_NO_SIGNAL` | No signal exists to update |
| 6 | `ERROR_CS_NFT_NOT_REGISTERED` | NFT is not registered |

---

## Interactions

### With Payment Hub

The Payment Hub can interact with the Collateral Signal Contract in a **read-only** manner:

```
Payment Hub ──── MAY read ──── Collateral State
Payment Hub ── MUST NOT ──── Enforce liquidation
Payment Hub ── optionally ── Restrict outgoing transfers when ACTIVE
                              (via Issue 3.4 locks, separate mechanism)
```

**Important:** The Payment Hub does NOT receive any enforcement capabilities from the Collateral Signal Contract.

### With External Lenders

External lenders interact with the contract as follows:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Lender Integration Pattern                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Lender calls getCollateralSignalInfo(nft_address)          │
│                                                                  │
│   2. Lender verifies collateral_amount_ton meets requirements   │
│                                                                  │
│   3. Lender issues loan through their OWN contract              │
│                                                                  │
│   4. Lender monitors signal state for changes                   │
│                                                                  │
│   5. Lender enforces terms OFF-CHAIN or via THEIR OWN contracts │
│                                                                  │
│   ⚠️  Protocol remains NEUTRAL - no enforcement assistance      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Guide for Lenders

### Reading Collateral State

```typescript
// Example: Check if an account has active collateral signal
const nftAddress = Address.parse("EQ...");

// Option 1: Full info
const info = await collateralSignal.getGetCollateralSignalInfo(nftAddress);
if (info.signal_state === 1 || info.signal_state === 2) {
    console.log(`Active collateral: ${info.collateral_amount_ton} nanoTON`);
}

// Option 2: Quick check
const hasActive = await collateralSignal.getGetHasActiveCollateralSignal(nftAddress);
if (hasActive) {
    const amount = await collateralSignal.getGetSignaledCollateralAmount(nftAddress);
    // Process loan application...
}
```

### Important Considerations

1. **Do NOT trust the signaled amount as actual collateral**
   - The amount is informational only
   - Verify actual TON balance separately if needed
   - The protocol does not custody or lock any funds

2. **Monitor signal state changes**
   - Subscribe to `CollateralSignalUpdated` events
   - React to state changes according to your loan terms

3. **Enforce terms independently**
   - The protocol provides no enforcement
   - Implement your own risk management
   - Handle defaults through your own mechanisms

---

## Security Requirements

### Ownership Enforcement

| Requirement | Implementation |
|-------------|----------------|
| Only NFT owner can update state | `validateOwnership()` check on all write operations |
| No third-party enforcement hooks | No external caller privileges |
| No oracle dependency | Pure on-chain state storage |
| Explicit failure modes | Error codes returned, no silent failures |

### Non-Custodial Guarantees

The contract maintains these invariants:

1. **I1 (Non-Custodial)**: Contract never custodies funds
2. **I2 (NFT Authority)**: Only NFT owner controls signal state
3. **I3 (No Admin Control)**: Admin cannot affect signals (except test registration)
4. **I6 (Lock ≠ Confiscation)**: No locking or confiscation mechanisms

---

## State Transition Diagram

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
    ┌──────────┐         ┌──────────┐         ┌──────────┐    │
    │   NONE   │────────▶│  ACTIVE  │────────▶│ WARNING  │────┘
    └──────────┘         └──────────┘         └──────────┘
         ▲                    │                    │
         │                    │                    │
         │                    ▼                    ▼
         │              ┌──────────┐              │
         └──────────────│ RELEASED │◀─────────────┘
                        └──────────┘

    All transitions are user-initiated (NFT owner only)
    No automatic transitions or third-party triggers
```

---

## Out of Scope

The following items are **explicitly excluded** from this contract:

| Item | Reason |
|------|--------|
| Lending logic | Handled by external lenders |
| Interest calculation | External lender responsibility |
| Liquidation | Forbidden by design principles |
| Oracle pricing | No oracle dependency allowed |
| Yield generation | Not a DeFi protocol |
| Fund custody | Non-custodial architecture |
| Forced transfers | Violates I1 invariant |
| Lender privileges | Violates trust model |

---

## Testing

### Test Files

1. **CollateralSignal.spec.ts** — Basic functionality tests
   - Signal creation
   - State updates
   - Signal release
   - Ownership validation
   - Read-only interface

2. **CollateralSignalAdversarial.spec.ts** — Security tests
   - Third-party modification attempts
   - Invalid state rejection
   - Non-custodial verification
   - Multi-user isolation
   - Edge cases

### Running Tests

```bash
npm test -- --testPathPattern=CollateralSignal
```

---

## File Structure

```
contracts/
├── CollateralSignal.tact          # Main contract
├── types/
│   └── CollateralState.tact       # State type definitions
└── interfaces/
    └── ICollateralSignal.tact     # Read-only interface

tests/
├── CollateralSignal.spec.ts       # Basic functionality tests
└── CollateralSignalAdversarial.spec.ts  # Security tests

docs/
└── collateral-signal.md           # This documentation
```

---

## Acceptance Criteria Verification

| Criteria | Status | Evidence |
|----------|--------|----------|
| Contract signals collateral state only | ✅ | No fund movement logic exists |
| No custody or fund movement exists | ✅ | Contract holds no user funds |
| Only NFT owner can mutate state | ✅ | `validateOwnership()` enforced |
| Payment Hub interaction is read-only | ✅ | Only getter functions exposed |
| Security invariants remain intact | ✅ | I1, I2, I3, I6 verified |

---

## Final Note

This contract deliberately **stops short of enforcement**.

Any attempt to add:
- ❌ Liquidation hooks
- ❌ Forced transfers
- ❌ Lender privileges

**MUST be rejected** as it would violate the core design principles and protocol invariants.

---

## References

- [Issue #30 - Collateral Signal Contract](https://github.com/xlabtg/tonbankcard-protocol/issues/30)
- [Protocol Invariants](./invariants.md)
- [Architecture Overview](./architecture.md)
- [Payment Hub Documentation](../contracts/payment-hub/README.md)

---

**Built on TON. Signaled, Not Controlled. Owned by Users.**
