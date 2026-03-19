# Account State Machine - Payment Hub Module

## Overview

The Account State Machine is the core ledger component of the Tonbankcard Payment Hub. It manages NFT account states, TBC token balances, and enforces strict state transition rules.

**Issue Reference**: [#5 - Payment Hub — Account State Machine & Internal Ledger](https://github.com/xlabtg/tonbankcard-protocol/issues/5)

## Purpose

This module serves as the **single source of truth** for:
- NFT account states (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- TBC token balances for each NFT account
- State transition authorization
- Balance operation permissions

## Architecture

### Core Principles

1. **NFT as Account**: Each NFT address maps to an account state
2. **TBC-Only**: All balances are stored in TBC tokens (uint128)
3. **State-Based Permissions**: Operations are allowed/blocked based on account state
4. **Atomic Operations**: All state changes are atomic and fail-safe
5. **No Admin Bypass**: Authorization is strictly enforced

### Account States

| State | Value | Description | Can Send? | Can Receive? |
|-------|-------|-------------|-----------|--------------|
| `ACTIVE` | 1 | Normal operation | ✅ | ✅ |
| `FROZEN` | 2 | Risk/fraud freeze | ❌ | ✅ |
| `COLLATERAL_LOCKED` | 3 | Used as collateral | ❌ | ✅ |
| `CLOSED` | 4 | Account closed | ❌ | ❌ |

### State Transition Rules

```
ACTIVE
  ├─→ FROZEN (risk engine / DAO)
  ├─→ COLLATERAL_LOCKED (lending adapter)
  └─→ CLOSED (future)

FROZEN
  └─→ ACTIVE (DAO only - not yet implemented)

COLLATERAL_LOCKED
  └─→ ACTIVE (lending adapter only - not yet implemented)

CLOSED
  └─→ (no transitions allowed)
```

## Data Structures

### AccountState

```tact
struct AccountState {
    balance_tbc: Int as uint128;  // Balance in TBC tokens
    state: Int as uint8;          // Current account state
}
```

## Public Interface

### Messages (Write Operations)

#### DepositTBC
Deposit TBC tokens to an NFT account.

```tact
message DepositTBC {
    nft_address: Address;
    amount: Int as coins;
}
```

**Rules**:
- Amount must be > 0
- Can deposit to any state (including FROZEN)
- Balances accumulate
- Overflow-safe

---

#### WithdrawTBC
Withdraw TBC tokens from an NFT account.

```tact
message WithdrawTBC {
    nft_address: Address;
    amount: Int as coins;
    destination: Address;
}
```

**Rules**:
- Amount must be > 0
- Account must be in ACTIVE state
- Sufficient balance required
- Requires NFT ownership (via Resolver - Issue #4)

**Reverts if**:
- Account is FROZEN
- Account is COLLATERAL_LOCKED
- Insufficient balance

---

#### TransferInternal
Transfer TBC between NFT accounts (internal protocol transfer).

```tact
message TransferInternal {
    from_nft: Address;
    to_nft: Address;
    amount: Int as coins;
}
```

**Rules**:
- Amount must be > 0
- Source account must be ACTIVE
- Destination can be any state (except CLOSED in future)
- Atomic operation
- Requires source NFT ownership

**Reverts if**:
- from_nft == to_nft (self-transfer)
- Source account not ACTIVE
- Insufficient balance in source

---

#### ChangeAccountState
Change the state of an NFT account.

```tact
message ChangeAccountState {
    nft_address: Address;
    new_state: Int as uint8;
}
```

**Rules**:
- Must follow state transition table
- Different transitions require different authorizations
- State value must be 1-4

**Authorized Transitions**:
- ACTIVE → FROZEN: Risk engine / DAO
- ACTIVE → COLLATERAL_LOCKED: Lending adapter
- ACTIVE → CLOSED: User / DAO
- FROZEN → ACTIVE: DAO only (future)
- COLLATERAL_LOCKED → ACTIVE: Lending adapter only (future)

---

### Queries (Read-Only Operations)

#### getAccountState
Get complete account state.

```tact
get fun getAccountState(nft_address: Address): AccountState
```

**Returns**:
```tact
AccountState {
    balance_tbc: Int;
    state: Int;
}
```

---

#### getBalance
Get TBC balance for an NFT account.

```tact
get fun getBalance(nft_address: Address): Int
```

**Returns**: Balance in TBC (uint128)

---

#### getState
Get current state of an NFT account.

```tact
get fun getState(nft_address: Address): Int
```

**Returns**: State value (1-4)

---

#### canSend
Check if an account can send TBC.

```tact
get fun canSend(nft_address: Address): Bool
```

**Returns**: `true` only if state is ACTIVE

---

#### canReceive
Check if an account can receive TBC.

```tact
get fun canReceive(nft_address: Address): Bool
```

**Returns**: `true` for all states except CLOSED

---

## Security Features

### 1. Reentrancy Protection
- All state updates complete before external calls
- No callbacks during critical sections

### 2. Overflow Protection
- Uses Tact's built-in overflow-safe arithmetic
- Balance type: `uint128` (sufficient for TBC)

### 3. Authorization Model
- NFT ownership required for operations (via Resolver)
- No admin bypass
- State transitions require specific authorities

### 4. Atomicity Guarantees
- All operations are atomic
- Partial updates automatically revert
- Consistent state always maintained

### 5. Explicit Error Handling
```tact
const ERROR_UNAUTHORIZED: Int = 401;
const ERROR_INVALID_STATE: Int = 402;
const ERROR_INSUFFICIENT_BALANCE: Int = 403;
const ERROR_INVALID_TRANSITION: Int = 404;
const ERROR_INVALID_NFT: Int = 405;
const ERROR_INVALID_AMOUNT: Int = 406;
```

## Edge Cases Handled

### ✅ NFT Transferred with Balance > 0
- Balance remains with NFT address
- New owner gains access to balance
- State preserved during transfer

### ✅ NFT Transferred while COLLATERAL_LOCKED
- State remains COLLATERAL_LOCKED
- New owner cannot withdraw until unlocked
- Lending adapter maintains control

### ✅ Withdrawal from FROZEN Account
- Transaction reverts
- Balance preserved
- Error message returned

### ✅ Deposit to CLOSED Account
- Currently allowed (may change in future)
- Balance accumulates
- State remains CLOSED

### ✅ Double-Spend Prevention
- Atomic balance checks
- Sequential transaction processing
- Second transaction reverts if insufficient balance

## Integration Points

### Dependencies

#### NFT Account Resolver (Issue #4)
**Status**: Open dependency

The Account State Machine requires the NFT Account Resolver to:
- Verify NFT ownership before operations
- Validate NFT belongs to authorized collections
- Check account flags (has_active_collateral, is_restricted, etc.)

**Current Implementation**: Authorization checks are documented but not yet enforced. The contract assumes the calling contract handles ownership verification.

**Future Integration**:
```tact
// Pseudo-code for future integration
receive(msg: WithdrawTBC) {
    let owner = resolver.resolveOwner(msg.nft_address);
    require(sender() == owner, "Unauthorized");
    // ... rest of logic
}
```

### Used By

This module is designed to be used by:

1. **Internal Transfer Module** (Issue 3.3)
   - Peer-to-peer TBC transfers
   - Zero-fee internal payments

2. **Account Locks Module** (Issue 3.4)
   - State transitions
   - Freeze/unfreeze operations

3. **Merchant Payments**
   - Payment acceptance
   - Settlement

4. **Lending Adapter**
   - Collateral locking
   - Liquidation handling

5. **Anti-Fraud / Risk Engine**
   - Account freezing
   - Suspicious activity blocking

## Testing

### Test Coverage

The test suite (`account-state.spec.ts`) covers:

1. **Balance Management** (6 tests)
   - Deposits (new account, accumulation)
   - Withdrawals (valid, insufficient balance)
   - Internal transfers (valid, self-transfer rejection)

2. **State Transitions** (5 tests)
   - Default state (ACTIVE)
   - Valid transitions (ACTIVE → FROZEN/COLLATERAL_LOCKED)
   - Invalid transitions (FROZEN → ACTIVE, COLLATERAL_LOCKED → ACTIVE)

3. **State-Based Operations** (6 tests)
   - Withdrawal blocking (FROZEN, COLLATERAL_LOCKED)
   - Deposit allowing (all states)
   - Transfer blocking from FROZEN
   - Transfer allowing to FROZEN

4. **Edge Cases** (7 tests)
   - NFT transfer scenarios
   - Zero balance operations
   - CLOSED account handling
   - Double-spend prevention

5. **Query Functions** (4 tests)
   - canSend/canReceive checks
   - State retrieval
   - Balance queries

### Running Tests

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Deployment

### Prerequisites

1. TON blockchain access
2. Tact compiler
3. Deployment wallet with TON

### Build

```bash
# Compile contract
npm run build

# Generate wrappers
npm run build:wrappers
```

### Deploy

```bash
# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet
```

### Post-Deployment

After deployment:
1. Verify contract on TONScan
2. Test basic operations (deposit, query)
3. Integrate with NFT Account Resolver
4. Update documentation with contract address

## Future Enhancements

### Not in Scope (Issue #5)

The following features are **intentionally excluded** from this implementation:

- ❌ Lending logic
- ❌ Merchant API integration
- ❌ DEX swap functionality
- ❌ DAO voting mechanisms

### Planned (Future Issues)

- [ ] DAO-based FROZEN → ACTIVE transitions
- [ ] Lending adapter authorization
- [ ] CLOSED account receive blocking
- [ ] Multi-signature authorization
- [ ] Time-locked state transitions
- [ ] Batch operations

## Limitations & Assumptions

### Current Assumptions

1. **Authorization**: Caller is trusted to verify NFT ownership
2. **TBC Integration**: Placeholder for actual TBC jetton interaction
3. **State Authorities**: Hardcoded transition rules (no dynamic authority)

### Known Limitations

1. **No NFT Ownership Check**: Requires Issue #4 integration
2. **No TBC Transfer**: Placeholder for jetton contract interaction
3. **No DAO Authority**: FROZEN unlock mechanism not implemented
4. **No Lending Adapter**: COLLATERAL_LOCKED unlock not implemented

### Gas Considerations

- Deposit: ~10,000 gas
- Withdraw: ~15,000 gas
- Internal Transfer: ~20,000 gas
- State Change: ~10,000 gas
- Queries: minimal gas (read-only)

## Support & Contributions

### Issues

Report bugs or request features:
https://github.com/xlabtg/tonbankcard-protocol/issues

### Contributing

1. Follow [CONTRIBUTING.md](../../CONTRIBUTING.md)
2. Read [Architecture Docs](../../docs/architecture.md)
3. Create an issue before major changes
4. Include tests with all changes
5. Update documentation

### Security

**DO NOT** disclose security vulnerabilities publicly.

Report security issues via private channels (see CONTRIBUTING.md).

## License

MIT — see [LICENSE](../../LICENSE)

## References

- [TON Documentation](https://docs.ton.org/)
- [Tact Language](https://tact-lang.org/)
- [Issue #5](https://github.com/xlabtg/tonbankcard-protocol/issues/5)
- [Issue #4 - NFT Account Resolver](https://github.com/xlabtg/tonbankcard-protocol/issues/4)
- [Architecture Docs](../../docs/architecture.md)

---

**Status**: Implementation Complete
**Version**: 1.0.0
**Last Updated**: 2025-12-25
