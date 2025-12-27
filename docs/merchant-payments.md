# Merchant Payments Implementation

## Overview

This document describes the implementation of on-chain merchant payment functionality for the Tonbankcard protocol, as specified in Issue #8.

## Architecture

### Components

1. **MerchantPaymentHub Contract** - Main contract handling merchant payments
2. **Account State Machine Interface** - Manages account states and balances (from Issue #5)
3. **Internal Transfer Interface** - Handles TBC transfers between NFT accounts (from Issue #6)
4. **Account Locks Interface** - Enforces risk and collateral locks (from Issue #7)

### Payment Flow

```
User (Payer NFT Owner)
    ↓ signs transaction
payMerchant(payer_nft, merchant_nft, amount_tbc, payload)
    ↓
Validation:
  - payer_nft.state == ACTIVE
  - payer_nft not locked (no FRAUD_LOCK, no COLLATERAL_LOCK)
  - merchant_nft.state != CLOSED
  - amount_tbc > 0
  - ownership verified via Resolver
    ↓
Settlement:
  - Debit TBC from payer_nft
  - Credit TBC to merchant_nft
  - Atomic operation
    ↓
Event Emission:
  - MerchantPayment(payer_nft, merchant_nft, amount_tbc, payload_hash)
```

## Data Structures

### Account State (from Issue #5)
```
enum AccountState {
  ACTIVE           // Can send and receive
  FROZEN           // Can only receive
  COLLATERAL_LOCKED // Can only receive
  CLOSED           // Cannot send or receive
}
```

### Lock State (from Issue #7)
```
struct LockState {
  fraud_locked: Bool
  collateral_locked: Bool
}
```

### Merchant Payment Request
```
struct MerchantPaymentRequest {
  payer_nft: Address      // NFT card of the payer
  merchant_nft: Address   // NFT card of the merchant
  amount_tbc: Int         // Amount in TBC to transfer
  payload: Cell?          // Optional payment metadata
}
```

## Functions

### Public Functions

#### `payMerchant`
Executes a merchant payment from payer to merchant.

```tact
fun payMerchant(
  payer_nft: Address,
  merchant_nft: Address,
  amount_tbc: Int,
  payload: Cell?
)
```

**Validation:**
- Caller must be owner of `payer_nft`
- `payer_nft` state must be ACTIVE
- `payer_nft` must not have any locks
- `merchant_nft` state must not be CLOSED
- `amount_tbc` must be > 0
- `payer_nft` balance must be >= `amount_tbc`

**Effects:**
- Transfers `amount_tbc` TBC from `payer_nft` to `merchant_nft`
- Emits `MerchantPayment` event

**Edge Cases:**
- Self-payment (payer_nft == merchant_nft): Allowed but emits event
- Merchant with COLLATERAL_LOCK: Can receive
- Merchant with FRAUD_LOCK: Can receive
- Zero-balance merchant: Can receive
- Payload reuse: Allowed (no uniqueness constraint)

### View Functions

#### `getAccountState`
Returns the current state of an NFT account.

#### `getAccountLocks`
Returns the lock state of an NFT account.

#### `getBalance`
Returns the TBC balance of an NFT account.

## Events

### MerchantPayment
Emitted when a merchant payment is successfully processed.

```tact
event MerchantPayment {
  payer_nft: Address
  merchant_nft: Address
  amount_tbc: Int
  payload_hash: Int  // Hash of payload cell
  timestamp: Int
}
```

## Security Considerations

1. **Non-Custodial**: Contract never holds user funds
2. **No Admin Bypass**: No privileged roles can override validations
3. **Atomic Execution**: Settlement is all-or-nothing
4. **Deterministic**: Same input always produces same output
5. **No Reentrancy**: Uses TON's actor model (inherently safe)
6. **State Machine Compliance**: Respects account states and locks

## Testing Requirements

### Unit Tests

1. **Static Merchant Payment**
   - Successful payment from active account
   - Payment with zero balance fails
   - Payment with insufficient balance fails
   - Payment from non-owner fails

2. **Dynamic Invoice Payment**
   - Payment with payload
   - Payload correctly hashed in event
   - Different payloads generate different hashes

3. **Lock Enforcement**
   - Payment from FRAUD_LOCK account fails
   - Payment from COLLATERAL_LOCK account fails
   - Payment to locked merchant succeeds

4. **Edge Cases**
   - Self-payment (same NFT as payer and merchant)
   - Payment to FROZEN merchant
   - Payment to merchant with active COLLATERAL_LOCK
   - Payload reuse
   - Payment from NFT transferred in same block

### Integration Tests

1. Account state changes are reflected
2. Events are correctly indexed
3. Multiple sequential payments
4. Concurrent payment attempts

## Implementation Notes

### Dependencies
- Issue #5: Account State Machine (interfaces defined)
- Issue #6: Internal Transfers (reuses transfer logic)
- Issue #7: Account Locks (enforces lock checks)

### Technology Stack
- **Language**: Tact (TON smart contract language)
- **Testing**: Tact test framework / Blueprint
- **Deployment**: TON blockchain

### File Structure
```
contracts/
├── interfaces/
│   ├── IAccountStateMachine.tact
│   ├── IInternalTransfer.tact
│   └── IAccountLocks.tact
├── types/
│   ├── AccountState.tact
│   └── LockState.tact
├── MerchantPaymentHub.tact
└── mocks/
    ├── MockAccountStateMachine.tact
    ├── MockInternalTransfer.tact
    └── MockAccountLocks.tact
tests/
├── MerchantPaymentHub.spec.ts
├── MerchantPaymentLocks.spec.ts
└── MerchantPaymentEdgeCases.spec.ts
```

## Out of Scope

As specified in Issue #8:
- Merchant UI
- Webhooks
- Fiat settlement
- NOWPayments / ChangeNOW SDK integration

These will be handled in separate issues.

## References

- [Issue #8](https://github.com/xlabtg/tonbankcard-protocol/issues/8)
- [Issue #5 - Account State Machine](https://github.com/xlabtg/tonbankcard-protocol/issues/5)
- [Issue #6 - Internal Transfers](https://github.com/xlabtg/tonbankcard-protocol/issues/6)
- [Issue #7 - Account Locks](https://github.com/xlabtg/tonbankcard-protocol/issues/7)
- [Tact Documentation](https://docs.tact-lang.org/)
- [TON Documentation](https://docs.ton.org/)
