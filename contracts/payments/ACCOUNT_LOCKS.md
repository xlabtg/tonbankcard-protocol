# Account Locks Smart Contract

## Overview

The Account Locks contract implements on-chain lock flags for NFT-based accounts in the Tonbankcard protocol. It provides a signaling and control layer for risk management and collateral handling without taking custody of user funds.

## Purpose

Account Locks enable:
- **Anti-fraud protection**: Flag suspicious accounts to prevent outgoing transfers
- **Collateral management**: Lock accounts used as collateral in lending protocols
- **Non-custodial security**: Restrict operations without taking custody of funds

## Lock Types

### 1. FRAUD_LOCK
- **Purpose**: Flag accounts suspected of fraudulent activity
- **Effect**:
  - ❌ Cannot send TBC
  - ✅ Can receive TBC
- **Authorization**: Only Risk Authority (or DAO in future)

### 2. COLLATERAL_LOCK
- **Purpose**: Lock accounts being used as collateral in lending
- **Effect**:
  - ❌ Cannot send/withdraw TBC
  - ✅ Can receive TBC
- **Authorization**: Only Lending Adapter contract

### 3. READ_ONLY (Future)
- **Purpose**: Regulatory or DAO-imposed restrictions
- **Effect**:
  - ❌ All outgoing operations blocked
  - ✅ Incoming operations allowed

## Data Model

### LockState Structure
```func
struct LockState {
  fraud_locked: bool      // 1 bit
  collateral_locked: bool // 1 bit
}
```

### Storage
The contract stores a dictionary mapping:
```
nft_address_hash (256-bit) -> LockState
```

Plus two authority addresses:
- `risk_authority`: Can set/clear fraud locks
- `lending_adapter`: Can set/clear collateral locks

## Public Interface

### Get Methods

#### `get_account_lock_state(slice nft_address) -> (int, int)`
Returns the lock state for an NFT account.
- Returns: `(fraud_locked, collateral_locked)`
- Both values are `0` (unlocked) or `1` (locked)

**Example**:
```func
(int fraud, int collateral) = get_account_lock_state(nft_addr);
```

#### `get_is_account_locked(slice nft_address) -> int`
Checks if account has any active lock.
- Returns: `1` if any lock is active, `0` if no locks

**Example**:
```func
int is_locked = get_is_account_locked(nft_addr);
```

#### `get_can_send(slice nft_address) -> int`
Checks if account can send TBC.
- Returns: `1` if can send, `0` if locked

**Example**:
```func
int can_send = get_can_send(nft_addr);
if (can_send == 0) {
  ;; Account is locked, reject transfer
}
```

#### `get_can_receive(slice nft_address) -> int`
Checks if account can receive TBC.
- Returns: Always `1` (receiving is always allowed)

**Example**:
```func
int can_receive = get_can_receive(nft_addr);  ;; Always returns 1
```

#### `get_version() -> int`
Returns contract version number.
- Returns: `1` (current version)

## Operations

### Set Fraud Lock
**OpCode**: `0x1001`
**Payload**: NFT address
**Authorization**: Risk Authority only

Sets the fraud lock flag for an NFT account.

### Clear Fraud Lock
**OpCode**: `0x1002`
**Payload**: NFT address
**Authorization**: Risk Authority only

Clears the fraud lock flag for an NFT account.

### Set Collateral Lock
**OpCode**: `0x1003`
**Payload**: NFT address
**Authorization**: Lending Adapter only

Sets the collateral lock flag for an NFT account.

### Clear Collateral Lock
**OpCode**: `0x1004`
**Payload**: NFT address
**Authorization**: Lending Adapter only

Clears the collateral lock flag for an NFT account.

### Check Can Send
**OpCode**: `0x2001`
**Payload**: NFT address
**Authorization**: Any (typically Payment Hub)

Checks if an account can send TBC. Throws error `403` (account_locked) if any lock is active.

## Events

### AccountLocked
Emitted when a lock is set on an account.
- **Marker**: `0x4c6f636b` ("Lock")
- **Payload**:
  - NFT address
  - Lock type (FRAUD_LOCK=1 or COLLATERAL_LOCK=2)

### AccountUnlocked
Emitted when a lock is cleared from an account.
- **Marker**: `0x556e6c6b` ("Unlk")
- **Payload**:
  - NFT address
  - Lock type (FRAUD_LOCK=1 or COLLATERAL_LOCK=2)

## Enforcement Rules

### SEND Operations
Before any SEND operation, the Payment Hub must check:
```func
int can_send = get_can_send(from_nft);
throw_unless(403, can_send);
```

Conditions:
- `fraud_locked == 0` AND
- `collateral_locked == 0`

### RECEIVE Operations
RECEIVE operations are **always allowed**, regardless of lock status.

This ensures:
- Locked accounts can still receive funds
- Debts can be repaid to collateralized accounts
- Fraud investigation doesn't prevent receiving refunds

## Authorization Model

### Risk Authority
- Can set and clear FRAUD_LOCK
- Intended for protocol risk management
- Future: Will be controlled by DAO governance

### Lending Adapter
- Can set and clear COLLATERAL_LOCK
- Smart contract that manages lending collateral
- Must be audited and trusted

### Users
- ❌ Cannot set or clear their own locks
- ✅ Can query lock status via get methods
- ✅ Can receive TBC even when locked

## Edge Cases

### Multiple Locks
An account can have both FRAUD_LOCK and COLLATERAL_LOCK simultaneously.
- Clearing one lock doesn't affect the other
- Account remains locked until ALL locks are cleared
- `can_send()` returns `0` if ANY lock is active

### NFT Transfer with Active Lock
Locks are tied to NFT address, not ownership:
- If NFT is transferred to new owner, locks remain
- New owner inherits the locked state
- Locks must be cleared before account is usable

### Lock During Pending Transfer
The contract doesn't prevent setting locks during transfers:
- Responsibility of calling system (Payment Hub) to handle atomically
- Recommended: Check locks before initiating transfer

### Attempt Send with Lock
If Payment Hub checks `can_send()` and proceeds anyway:
- Lock check operation will throw error `403`
- Transaction will revert
- Funds remain safe

## Security Considerations

### Non-Custodial Guarantee
- Locks do NOT transfer funds to contract
- Locks do NOT give contract withdrawal rights
- Locks ONLY set boolean flags that restrict operations
- Users maintain full ownership of their TBC balance

### No Admin Override
- No global admin role that can bypass locks
- Only designated authorities (risk, lending) can manage specific lock types
- Each authority can only manage their own lock type

### Reentrancy Protection
- All state changes before external calls
- No recursive invocations possible
- Atomic operations guaranteed

### Overflow Protection
- Uses safe arithmetic (FunC built-in)
- Lock states are boolean (can't overflow)
- No balance calculations in this contract

## Integration Guide

### For Payment Hub
Before executing internal transfer:
```func
;; Check if sender can send
int can_send_flag = account_locks_contract.get_can_send(from_nft);
throw_unless(403, can_send_flag);

;; Proceed with transfer
;; ...
```

### For Merchant API
Check account status before accepting payment:
```func
int is_locked = account_locks_contract.get_is_account_locked(payer_nft);
if (is_locked) {
  ;; Inform merchant that payer account is restricted
  ;; May indicate fraud risk
}
```

### For UI / Frontend
Display lock status to user:
```func
(int fraud, int collateral) = get_account_lock_state(user_nft);

if (fraud) {
  show_message("Account flagged for fraud investigation");
}
if (collateral) {
  show_message("Account locked as collateral in lending protocol");
}
```

### For Marketplace (GetGems, etc.)
Check lock status before NFT trade:
```func
(int fraud, int collateral) = get_account_lock_state(nft_for_sale);

if (fraud) {
  show_warning("This NFT account has active fraud flag");
}
if (collateral) {
  show_warning("This NFT is being used as collateral");
}
```

## Testing

### Test Coverage
The test suite covers:
1. ✅ Initial state (no locks)
2. ✅ Set fraud lock (authorized)
3. ✅ Set collateral lock (authorized)
4. ✅ Clear fraud lock
5. ✅ Clear collateral lock
6. ✅ Combined locks (fraud + collateral)
7. ✅ Clear one lock while other remains
8. ✅ Multiple accounts with different states
9. ✅ Receive always allowed
10. ✅ NFT transfer preserves lock state
11. ✅ Unauthorized access attempts (should fail)

### Running Tests
```bash
# Using TON testing framework (when available)
func -P tests/account-locks.spec.fc
```

For manual testing, see `tests/account-locks.spec.fc`.

## Future Enhancements

### DAO Governance
- Replace Risk Authority with DAO voting contract
- Community-driven fraud flag management
- Multi-sig approval for lock operations

### READ_ONLY Lock
- Full lockdown mode for regulatory compliance
- Blocks all outgoing operations
- Preserves account state for audit

### Time-Limited Locks
- Auto-expiring locks
- Scheduled unlock timestamps
- Reduced manual intervention

### Lock Metadata
- Reason codes for locks
- Reference to investigation tickets
- Audit trail storage

## Version History

- **v1.0.0**: Initial implementation
  - FRAUD_LOCK support
  - COLLATERAL_LOCK support
  - Public read interface
  - Event emission

## License

TBD

## References

- [Issue #7](https://github.com/xlabtg/tonbankcard-protocol/issues/7) - Account Locks specification
- [Issue #5](https://github.com/xlabtg/tonbankcard-protocol/issues/5) - Account State Machine
- [Issue #6](https://github.com/xlabtg/tonbankcard-protocol/issues/6) - Internal Transfers
- [TON FunC Documentation](https://docs.ton.org/v3/documentation/smart-contracts/func/overview)
