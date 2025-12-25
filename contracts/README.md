# Tonbankcard Protocol Smart Contracts

This directory contains the smart contract implementations for the Tonbankcard protocol.

## Overview

The contracts implement a non-custodial payment infrastructure on TON blockchain where:
- NFT cards represent bank accounts
- TBC token is used for settlement
- All operations are on-chain and deterministic
- No admin controls over user funds

## Structure

```
contracts/
├── types/                  # Shared type definitions
│   ├── AccountState.tact   # Account state enum and helpers
│   └── LockState.tact      # Lock state struct and helpers
├── interfaces/             # Contract interfaces
│   ├── IAccountStateMachine.tact  # Account state and balance management
│   ├── IAccountLocks.tact         # Lock enforcement interface
│   └── INFTResolver.tact          # NFT ownership verification
├── MerchantPaymentHub.tact        # Main merchant payment contract
└── README.md
```

## Contracts

### MerchantPaymentHub

Main contract for processing merchant payments in the Tonbankcard ecosystem.

**Features:**
- Static merchant payments (direct to NFT address)
- Dynamic invoice payments (with metadata payload)
- Account state enforcement (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- Lock enforcement (FRAUD_LOCK, COLLATERAL_LOCK)
- Event emission for indexing

**Public Functions:**

#### `payMerchant`
Process a payment from payer NFT to merchant NFT.

**Parameters:**
- `payer_nft: Address` - NFT card address of the payer
- `merchant_nft: Address` - NFT card address of the merchant
- `amount_tbc: Int` - Amount in TBC to transfer
- `payload: Cell?` - Optional payment metadata (order_id, invoice_id, etc.)

**Validations:**
1. Sender must own `payer_nft`
2. `payer_nft` must exist
3. `merchant_nft` must exist
4. `amount_tbc` must be > 0
5. `payer_nft` state must be ACTIVE
6. `payer_nft` must not be locked (no FRAUD_LOCK, no COLLATERAL_LOCK)
7. `merchant_nft` state must not be CLOSED
8. `payer_nft` balance must be >= `amount_tbc`

**Effects:**
- Debits `amount_tbc` from `payer_nft`
- Credits `amount_tbc` to `merchant_nft`
- Emits `MerchantPayment` event

**View Functions:**

#### `getAccountState(nft_address: Address): Int`
Returns the current state of an NFT account.

**Returns:**
- `0` - ACTIVE
- `1` - FROZEN
- `2` - COLLATERAL_LOCKED
- `3` - CLOSED

#### `getBalance(nft_address: Address): Int`
Returns the TBC balance of an NFT account.

#### `getLockState(nft_address: Address): LockState`
Returns the lock state of an NFT account.

**Returns:**
```
LockState {
  fraud_locked: Bool
  collateral_locked: Bool
}
```

#### `isAccountLocked(nft_address: Address): Bool`
Returns true if account has any locks active.

#### `hasFraudLock(nft_address: Address): Bool`
Returns true if account has fraud lock.

#### `hasCollateralLock(nft_address: Address): Bool`
Returns true if account has collateral lock.

## Account States

| State | Can Send | Can Receive | Description |
|-------|----------|-------------|-------------|
| ACTIVE (0) | ✅ | ✅ | Normal operation |
| FROZEN (1) | ❌ | ✅ | Temporarily frozen |
| COLLATERAL_LOCKED (2) | ❌ | ✅ | Used as collateral |
| CLOSED (3) | ❌ | ❌ | Account closed |

## Lock Types

| Lock | Effect | Use Case |
|------|--------|----------|
| FRAUD_LOCK | Cannot send | Anti-fraud measure |
| COLLATERAL_LOCK | Cannot send | Active lending collateral |

**Note:** Locks only prevent sending, not receiving.

## Events

### MerchantPayment
Emitted when a merchant payment is successfully processed.

```tact
message MerchantPayment {
    payer_nft: Address       // Payer NFT address
    merchant_nft: Address    // Merchant NFT address
    amount_tbc: Int         // Amount transferred
    payload_hash: Int       // Hash of payload cell
    timestamp: Int          // Block timestamp
}
```

## Security Considerations

1. **Non-Custodial**: Contract does not hold user funds
2. **No Admin Bypass**: No privileged roles can override validations
3. **Atomic Execution**: Settlement is all-or-nothing
4. **Deterministic**: Same input always produces same output
5. **No Reentrancy**: TON's actor model prevents reentrancy attacks

## Testing

Tests are located in the `tests/` directory:

- `MerchantPaymentHub.spec.ts` - Basic functionality tests
- `MerchantPaymentDynamic.spec.ts` - Dynamic invoice payment tests
- `MerchantPaymentLocks.spec.ts` - Lock enforcement tests
- `MerchantPaymentEdgeCases.spec.ts` - Edge case tests

Run tests with:
```bash
npm test
```

## Development

### Prerequisites
- Node.js 18+
- Tact compiler
- Blueprint (TON development framework)

### Building
```bash
npm run build
```

### Deployment
```bash
npm run deploy
```

## References

- [Issue #8 - Merchant Payments](https://github.com/xlabtg/tonbankcard-protocol/issues/8)
- [Issue #5 - Account State Machine](https://github.com/xlabtg/tonbankcard-protocol/issues/5)
- [Issue #6 - Internal Transfers](https://github.com/xlabtg/tonbankcard-protocol/issues/6)
- [Issue #7 - Account Locks](https://github.com/xlabtg/tonbankcard-protocol/issues/7)
- [Tact Documentation](https://docs.tact-lang.org/)
- [TON Documentation](https://docs.ton.org/)

## License

See repository LICENSE file.
