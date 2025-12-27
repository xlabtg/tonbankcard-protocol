# Tonbankcard Protocol Smart Contracts

This directory contains the smart contract implementations for the Tonbankcard Protocol.

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
├── MerchantPaymentHub.tact        # Merchant payment contract (Issue #8)
├── payments/               # Payment infrastructure contracts
│   ├── payment-hub.fc      # Core payment routing and account binding
│   ├── PaymentHub.tact     # Tact implementation (Issue #6)
│   └── README.md           # Payment contracts documentation
├── nft-resolver/           # NFT account resolver (Issue #4)
│   ├── nft_account_resolver.fc
│   ├── nft_account_resolver.tact
│   └── README.md
├── payment-hub/            # Payment hub with account state (Issue #5)
│   ├── account-state.tact
│   └── README.md
├── token/                  # TBC jetton (external, deployed)
├── nft-cards/              # NFT card collections (external, deployed)
└── lending/                # Future: Lending and collateral contracts
```

## Implemented Contracts

### MerchantPaymentHub (Issue #8)

**Status**: ✅ Implemented (Tact)
**File**: `MerchantPaymentHub.tact`
**Purpose**: On-chain merchant payment settlement in TBC

Main contract for processing merchant payments in the Tonbankcard ecosystem.

**Features:**
- Static merchant payments (direct to NFT address)
- Dynamic invoice payments (with metadata payload)
- Account state enforcement (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- Lock enforcement (FRAUD_LOCK, COLLATERAL_LOCK)
- Event emission for indexing
- Zero protocol fees for internal transfers

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

### Payment Hub (Tact Implementation) - Issue #6

**Status**: ✅ Implemented (Tact version)
**File**: `payments/PaymentHub.tact`
**Purpose**: Internal TBC transfers between NFT accounts

Features:
- Zero-fee internal transfers
- Account state management (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- Ownership verification
- Atomic balance updates
- Comprehensive validation and security

See [payments/README.md](./payments/README.md) for detailed documentation.

### Payment Hub (FunC Implementation) - Issue #3

**Status**: Implementation draft (Issue #3)
**Language**: FunC
**Purpose**: Core banking logic for the Tonbankcard Protocol

**Features**:
- NFT-based account binding and validation
- Internal TBC transfers (zero fee)
- Merchant payment flows
- External payment entry/exit hooks
- Event emission for indexing
- Anti-fraud account flagging
- Emergency pause mechanism

**Documentation**: [docs/contracts/payment-hub.md](../docs/contracts/payment-hub.md)
**Tests**: [tests/payments/payment-hub.test.md](../tests/payments/payment-hub.test.md)

### NFT Account Resolver - Issue #4

**Status**: ✅ Implemented
**Files**: `nft-resolver/nft_account_resolver.fc`, `nft-resolver/nft_account_resolver.tact`
**Purpose**: NFT ownership verification

**Documentation**: [nft-resolver/README.md](./nft-resolver/README.md)
**Tests**: [tests/nft-resolver/NFTAccountResolver.spec.ts](../tests/nft-resolver/NFTAccountResolver.spec.ts)

### Account State Machine - Issue #5

**Status**: ✅ Implemented
**File**: `payment-hub/account-state.tact`
**Purpose**: Account state management

**Documentation**: [payment-hub/README.md](./payment-hub/README.md)

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

## External Contracts (Already Deployed)

### TBC Token (Jetton)
- **Address**: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`
- **Type**: TON Jetton (fungible token)
- **Status**: Deployed and immutable
- **Purpose**: Internal settlement token
- **Explorer**: [TONViewer](https://tonviewer.com/EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq)

### NFT Card Collections
- **Series 7777**: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- **Series 8888**: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`
- **Type**: TON NFT Standard
- **Status**: Deployed
- **Purpose**: Account abstraction (each NFT = unique account)

See [docs/existing-contracts.md](../docs/existing-contracts.md) for full details.

## Security Considerations

1. **Non-Custodial**: Contract does not hold user funds
2. **No Admin Bypass**: No privileged roles can override validations
3. **Atomic Execution**: Settlement is all-or-nothing
4. **Deterministic**: Same input always produces same output
5. **No Reentrancy**: TON's actor model prevents reentrancy attacks

## Security Guidelines

All contracts **MUST** adhere to:

### Non-Custodial Principles
- ❌ No storage of user private keys
- ❌ No admin withdrawal of user funds
- ❌ No forced transfers
- ✅ User-signed transactions only
- ✅ NFT ownership as sole authority

### Smart Contract Security
- ✅ No upgradeable proxies for core logic
- ✅ Explicit error handling
- ✅ Input validation on all operations
- ✅ Reentrancy protection (TVM native)
- ✅ Overflow protection (TVM native)

### Access Control
- Admin roles for defensive operations only (pause, flag)
- No admin access to user funds
- Clear separation of user vs admin operations

## Testing

Tests are located in the `tests/` directory:

- `MerchantPaymentHub.spec.ts` - Basic functionality tests
- `MerchantPaymentDynamic.spec.ts` - Dynamic invoice payment tests
- `MerchantPaymentLocks.spec.ts` - Lock enforcement tests
- `MerchantPaymentEdgeCases.spec.ts` - Edge case tests

For Tact contracts, use Blueprint testing framework with TON Sandbox:

```bash
# Run all tests
npx blueprint test

# Run specific test file
npx blueprint test MerchantPaymentHub.spec.ts

# Run with coverage
npx blueprint test --coverage
```

### Testing Requirements

All contracts must have:
- ✅ Unit tests for each function
- ✅ Integration tests for user flows
- ✅ Security tests for access control
- ✅ Edge case tests
- ✅ Error condition tests
- ✅ Event emission tests

## Development

### Prerequisites
- Node.js 18+
- Tact compiler
- FunC compiler
- Fift interpreter
- Blueprint (TON development framework)

### Building
```bash
npm run build
```

Or using Blueprint:
```bash
npx blueprint build
```

### Deployment

**⚠️ IMPORTANT**: Never deploy to mainnet without:
1. Complete test coverage
2. Security audit
3. Testnet verification
4. Architecture review approval

```bash
# Deploy contract
npx blueprint run

# Verify deployment
npx blueprint verify
```

## Code Style

### FunC Conventions

```func
;; Comments use double semicolon
;; Function names use snake_case
;; Constants use SCREAMING_SNAKE_CASE or namespace::name

;; Operation codes
const int op::operation_name = 0x12345678;

;; Error codes
const int error::error_name = 100;

;; Functions
() function_name(slice param1, int param2) impure {
    ;; Implementation
}

;; Get methods
int get_something() method_id {
    load_data();
    return value;
}
```

### Tact Conventions

```tact
// Use clear, descriptive names
const ERROR_INSUFFICIENT_BALANCE: Int = 101;

// Document complex logic
// Atomic balance update - debit source, credit destination
from_account.balance = from_account.balance - amount;
to_account.balance = to_account.balance + amount;

// Use require for validation
require(amount > 0, "Amount must be positive");

// Emit events for all state changes
emit(InternalTransferEvent{...}.toCell());
```

### Documentation Requirements

Each contract file must include:
1. Header comment explaining purpose
2. Operation code definitions
3. Error code definitions
4. Storage layout documentation
5. Function documentation
6. Security considerations

## Architecture Principles

### Contract Dependencies

```
PaymentHub (Issue #6)
  ├── Depends on: NFT Account Resolver (Issue #4)
  └── Depends on: Account State Machine (Issue #5)

MerchantPaymentHub (Issue #8)
  ├── Depends on: Account State Machine (Issue #5)
  ├── Depends on: Internal Transfers (Issue #6)
  └── Depends on: Account Locks (Issue #7)

Future Contracts:
  ├── Account Locks (Issue #7)
  └── Lending Adapters → depends on Account State Machine
```

### Gas Optimization Best Practices

1. **Minimize Storage**: Use maps efficiently, avoid duplicate storage
2. **Batch Operations**: Group multiple operations when possible
3. **Early Returns**: Fail fast on validation errors
4. **Efficient Types**: Use appropriate integer sizes (uint8, uint32, etc.)

### Gas Costs (Estimated)

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Internal Transfer | ~0.01 TON | Includes validation and state updates |
| Merchant Payment | ~0.01 TON | Zero protocol fee |
| Account State Query | ~0.005 TON | Read-only getter |
| Account Initialization | ~0.01 TON | One-time setup |

## Future Contracts

### Planned Implementations

**Phase 2**:
- [ ] Lending adapter contracts
- [ ] Merchant escrow contract
- [ ] Payment channel contracts
- [ ] Account Locks (Issue #7)

**Phase 3**:
- [ ] Multi-sig card contracts
- [ ] Recurring payment contracts
- [ ] Cross-chain bridge adapters

**Phase 4**:
- [ ] Advanced privacy contracts
- [ ] Governance contracts (DAO)
- [ ] Staking/rewards contracts

## Deployment Checklist

Before deploying any contract:

- [ ] All tests passing
- [ ] Code reviewed by team
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Testnet deployment successful
- [ ] Integration tests with existing contracts
- [ ] Gas optimization reviewed
- [ ] Emergency procedures documented
- [ ] Mainnet deployment approved

## References

### Tonbankcard Protocol
- [Issue #8 - Merchant Payments](https://github.com/xlabtg/tonbankcard-protocol/issues/8)
- [Issue #7 - Account Locks](https://github.com/xlabtg/tonbankcard-protocol/issues/7)
- [Issue #6 - Internal Transfers](https://github.com/xlabtg/tonbankcard-protocol/issues/6)
- [Issue #5 - Account State Machine](https://github.com/xlabtg/tonbankcard-protocol/issues/5)
- [Issue #4 - NFT Account Resolver](https://github.com/xlabtg/tonbankcard-protocol/issues/4)
- [Architecture Documentation](../docs/architecture.md)
- [Existing Contracts](../docs/existing-contracts.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

### TON Development
- [TON Smart Contract Documentation](https://docs.ton.org/develop/smart-contracts/)
- [FunC Language Reference](https://docs.ton.org/develop/func/overview)
- [Tact Documentation](https://docs.tact-lang.org/)
- [Blueprint Framework](https://github.com/ton-community/blueprint)
- [TON Sandbox](https://github.com/ton-org/sandbox)

### Security Resources
- [TON Security Best Practices](https://docs.ton.org/v3/documentation/smart-contracts/security/things-to-focus)
- [Tact Security Guide](https://docs.tact-lang.org/book/security)
- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)

### Standards
- [TON Jetton Standard](https://github.com/ton-blockchain/jetton-contract)
- [TON NFT Standard](https://github.com/ton-blockchain/nft-contract)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

**Key Points**:
- All contract changes require an Issue
- Follow non-custodial principles strictly
- Include comprehensive tests
- Update documentation with code
- Security review required

## License

MIT License - See LICENSE file for details

---

**Last Updated**: 27.12.2025
**Maintainer**: Tonbankcard Protocol Team
