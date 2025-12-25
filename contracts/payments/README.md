# Payment Hub - Internal TBC Transfers

This directory contains the smart contract implementation for **Internal TBC Transfers** between NFT accounts in the Tonbankcard protocol.

## Overview

The Payment Hub contract (`PaymentHub.tact`) implements the core banking operation of transferring TBC tokens between NFT-based accounts without fees, entirely on-chain.

**Issue Reference**: [#6 - Issue 3.3 Payment Hub — Internal TBC Transfers Between NFT Accounts](https://github.com/xlabtg/tonbankcard-protocol/issues/6)

## Architecture

### Core Functionality

- **Internal Transfers**: Zero-fee TBC transfers between NFT accounts
- **State Management**: Account states (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- **Ownership Verification**: Integration with NFT Account Resolver pattern
- **Atomic Operations**: All balance updates are atomic and fail-safe

### Account States

| State | Can Send | Can Receive | Description |
|-------|----------|-------------|-------------|
| `ACTIVE` | ✅ | ✅ | Normal operational state |
| `FROZEN` | ❌ | ✅ | Account frozen, cannot send |
| `COLLATERAL_LOCKED` | ❌ | ✅ | Collateral locked for lending |
| `CLOSED` | ❌ | ❌ | Account permanently closed |

## Contract Interface

### Messages

#### TransferInternalRequest
```tact
message TransferInternalRequest {
    from_nft: Address;        // Source NFT account
    to_nft: Address;          // Destination NFT account
    amount_tbc: Int as coins; // Amount in TBC (nanocoins)
    payload: TransferPayload?; // Optional metadata
}
```

#### TransferPayload
```tact
struct TransferPayload {
    memo: String;      // Optional memo
    orderId: String;   // Optional order ID for merchant payments
}
```

### Events

#### InternalTransferEvent
```tact
message InternalTransferEvent {
    from_nft: Address;
    to_nft: Address;
    amount_tbc: Int as coins;
    payload_hash: Int as uint256;  // Deterministic hash for indexing
    timestamp: Int as uint32;
}
```

## Validation Rules

The contract enforces strict validation before executing transfers:

1. **Amount Validation**: `amount_tbc > 0`
2. **NFT Validation**: Both `from_nft` and `to_nft` must be valid NFT accounts
3. **Ownership**: `msg.sender` must be the owner of `from_nft`
4. **Source State**: `from_nft` must be in `ACTIVE` state
5. **Destination State**: `to_nft` must not be `CLOSED`
6. **Balance**: `balance(from_nft) >= amount_tbc`

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 100 | `ERROR_INVALID_AMOUNT` | Transfer amount must be > 0 |
| 101 | `ERROR_INSUFFICIENT_BALANCE` | Insufficient balance |
| 102 | `ERROR_INVALID_NFT_FROM` | Invalid from_nft address |
| 103 | `ERROR_INVALID_NFT_TO` | Invalid to_nft address |
| 104 | `ERROR_UNAUTHORIZED` | Sender is not NFT owner |
| 105 | `ERROR_FROM_ACCOUNT_NOT_ACTIVE` | From account must be ACTIVE |
| 106 | `ERROR_TO_ACCOUNT_CLOSED` | Cannot send to CLOSED account |
| 107 | `ERROR_REENTRANCY` | Reentrancy detected |

## Security Features

### Reentrancy Protection
The contract implements a reentrancy guard to prevent reentrant calls during transfer execution.

### Atomic Updates
All balance updates are atomic - either both debit and credit succeed, or the entire transaction reverts.

### No Admin Override
There are no admin functions that can manipulate user balances or override ownership verification.

### Overflow Safety
All arithmetic operations are overflow-safe using TON's native integer types.

## Edge Cases

The implementation handles the following edge cases:

1. **Self-Transfer** (`from_nft == to_nft`): Treated as no-op but emits event for transparency
2. **Zero Balance Recipient**: Can receive transfers normally
3. **NFT Ownership Change**: Always verifies current owner on-chain
4. **Frozen/Locked Accounts**: Cannot send but can receive
5. **Multiple Transfers in Same Block**: Fully supported

## Integration with Dependencies

### NFT Account Resolver (Issue #4)
The contract includes the `isValidAccountNFT()` function that validates NFT accounts. This integrates with the NFT Account Resolver pattern to verify:
- NFT belongs to whitelisted collection
- NFT is not burned
- NFT is valid for account operations

### Account State Machine (Issue #5)
The contract implements the Account State Machine through:
- `AccountState` struct storing balance and state
- State transition enforcement
- Balance management with state-based permissions

## Getter Functions

The contract provides the following read-only getters:

- `getBalance(nft_address)`: Returns TBC balance
- `getAccountState(nft_address)`: Returns account state enum
- `getOwner(nft_address)`: Returns NFT owner address
- `canSend(nft_address)`: Checks if account can send
- `canReceive(nft_address)`: Checks if account can receive

## Testing

### Test Coverage Requirements

All tests must be written using Blueprint framework with Sandbox for isolated blockchain testing.

#### Required Test Cases

1. **Normal Flow**
   - Successful transfer between two ACTIVE accounts
   - Correct balance updates (debit/credit)
   - Event emission verification

2. **Validation Failures**
   - Insufficient balance
   - Invalid amount (zero or negative)
   - Invalid NFT addresses
   - Ownership mismatch

3. **State Enforcement**
   - Cannot send from FROZEN account
   - Cannot send from COLLATERAL_LOCKED account
   - Cannot send to CLOSED account
   - Can receive to FROZEN account

4. **Edge Cases**
   - Self-transfer (from_nft == to_nft)
   - Transfer to account with zero balance
   - Multiple transfers in sequence
   - Reentrancy attempt

### Running Tests

```bash
# Install dependencies
npm install

# Run tests
npx blueprint test

# Run tests with coverage
npx blueprint test --coverage
```

## Deployment

The contract is designed to be deployed once and remain immutable. No upgrade paths or admin controls are included by design.

### Initialization

```typescript
// Example deployment
const paymentHub = await PaymentHub.fromInit(deployerAddress);
```

## Future Extensions

The following features are **out of scope** for this implementation:

- Merchant API integration
- External payment gateways
- Lending/collateral logic
- Fee mechanisms
- DEX integration

These will be addressed in separate issues as the protocol evolves.

## Dependencies

- **Requires**:
  - Issue #4 — NFT Account Resolver (interface implemented)
  - Issue #5 — Account State Machine (logic implemented)

- **Required For**:
  - Issue 3.4 — Account Locks
  - Issue 3.5 — Merchant Payments
  - Future lending adapters
  - DAO governance features

## References

- [Issue #6 - Internal TBC Transfers](https://github.com/xlabtg/tonbankcard-protocol/issues/6)
- [TON Smart Contract Documentation](https://docs.ton.org/v3/documentation/smart-contracts/overview)
- [Tact Language Documentation](https://docs.tact-lang.org/)
- [Blueprint Testing Framework](https://github.com/ton-org/blueprint)
- [Architecture Documentation](../../docs/architecture.md)

## License

MIT License - See LICENSE file for details
