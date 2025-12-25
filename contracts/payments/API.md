# Account Locks API Reference

## Overview

This document provides the complete API reference for the Account Locks smart contract, including all operation codes, get methods, error codes, and event specifications.

## Operation Codes

### Lock Management Operations

#### Set Fraud Lock
```
OpCode: 0x1001 (4097 decimal)
Authorization: Risk Authority only
Message Body:
  - uint32 op (0x1001)
  - slice nft_address

Description: Sets the fraud lock flag for the specified NFT account.

Example:
  send_message(
    to: account_locks_contract,
    value: 0.05 TON,
    body: begin_cell()
      .store_uint(0x1001, 32)
      .store_slice(nft_address)
    .end_cell()
  )

Events Emitted: AccountLocked(nft_address, FRAUD_LOCK=1)
```

#### Clear Fraud Lock
```
OpCode: 0x1002 (4098 decimal)
Authorization: Risk Authority only
Message Body:
  - uint32 op (0x1002)
  - slice nft_address

Description: Clears the fraud lock flag for the specified NFT account.

Example:
  send_message(
    to: account_locks_contract,
    value: 0.05 TON,
    body: begin_cell()
      .store_uint(0x1002, 32)
      .store_slice(nft_address)
    .end_cell()
  )

Events Emitted: AccountUnlocked(nft_address, FRAUD_LOCK=1)
```

#### Set Collateral Lock
```
OpCode: 0x1003 (4099 decimal)
Authorization: Lending Adapter only
Message Body:
  - uint32 op (0x1003)
  - slice nft_address

Description: Sets the collateral lock flag for the specified NFT account.

Example:
  send_message(
    to: account_locks_contract,
    value: 0.05 TON,
    body: begin_cell()
      .store_uint(0x1003, 32)
      .store_slice(nft_address)
    .end_cell()
  )

Events Emitted: AccountLocked(nft_address, COLLATERAL_LOCK=2)
```

#### Clear Collateral Lock
```
OpCode: 0x1004 (4100 decimal)
Authorization: Lending Adapter only
Message Body:
  - uint32 op (0x1004)
  - slice nft_address

Description: Clears the collateral lock flag for the specified NFT account.

Example:
  send_message(
    to: account_locks_contract,
    value: 0.05 TON,
    body: begin_cell()
      .store_uint(0x1004, 32)
      .store_slice(nft_address)
    .end_cell()
  )

Events Emitted: AccountUnlocked(nft_address, COLLATERAL_LOCK=2)
```

### Validation Operations

#### Check Can Send
```
OpCode: 0x2001 (8193 decimal)
Authorization: Any (typically Payment Hub)
Message Body:
  - uint32 op (0x2001)
  - slice nft_address

Description: Checks if the specified NFT account can send TBC.
Throws error 403 if account is locked, otherwise returns success.

Example:
  send_message(
    to: account_locks_contract,
    value: 0.05 TON,
    body: begin_cell()
      .store_uint(0x2001, 32)
      .store_slice(nft_address)
    .end_cell()
  )

Success: Transaction completes
Failure: Throws 403 (account_locked)
```

## Get Methods

All get methods can be called off-chain without sending a transaction.

### get_account_lock_state

```func
(int, int) get_account_lock_state(slice nft_address)
```

**Description**: Returns the complete lock state for an NFT account.

**Parameters**:
- `nft_address` (slice): The address of the NFT account to query

**Returns**:
- Tuple of two integers:
  - `fraud_locked` (int): 0 = not locked, 1 = locked
  - `collateral_locked` (int): 0 = not locked, 1 = locked

**Example Usage**:
```func
slice my_nft = addr("EQA...");
(int fraud, int collateral) = account_locks.get_account_lock_state(my_nft);

if (fraud) {
  ;; Account is fraud-locked
}
if (collateral) {
  ;; Account is collateral-locked
}
```

**JavaScript/TypeScript**:
```typescript
const result = await accountLocksContract.getAccountLockState(nftAddress);
const fraudLocked = result[0];
const collateralLocked = result[1];
```

---

### get_is_account_locked

```func
int get_is_account_locked(slice nft_address)
```

**Description**: Checks if an NFT account has any active lock.

**Parameters**:
- `nft_address` (slice): The address of the NFT account to query

**Returns**:
- `int`: 1 if any lock is active, 0 if no locks

**Example Usage**:
```func
int is_locked = account_locks.get_is_account_locked(my_nft);

if (is_locked) {
  throw(403);  ;; Account is locked
}
```

**JavaScript/TypeScript**:
```typescript
const isLocked = await accountLocksContract.getIsAccountLocked(nftAddress);
if (isLocked) {
  console.log("Account is locked");
}
```

---

### get_can_send

```func
int get_can_send(slice nft_address)
```

**Description**: Checks if an NFT account can send TBC (i.e., has no locks).

**Parameters**:
- `nft_address` (slice): The address of the NFT account to query

**Returns**:
- `int`: 1 if can send, 0 if locked

**Example Usage**:
```func
int can_send = account_locks.get_can_send(from_nft);
throw_unless(403, can_send);

;; Proceed with transfer
```

**JavaScript/TypeScript**:
```typescript
const canSend = await accountLocksContract.getCanSend(nftAddress);
if (!canSend) {
  throw new Error("Account is locked and cannot send TBC");
}
```

---

### get_can_receive

```func
int get_can_receive(slice nft_address)
```

**Description**: Checks if an NFT account can receive TBC.

**Parameters**:
- `nft_address` (slice): The address of the NFT account to query

**Returns**:
- `int`: Always returns 1 (receiving is always allowed)

**Example Usage**:
```func
int can_receive = account_locks.get_can_receive(to_nft);
;; Always returns 1, receiving is always allowed
```

**JavaScript/TypeScript**:
```typescript
const canReceive = await accountLocksContract.getCanReceive(nftAddress);
// Always true
```

---

### get_version

```func
int get_version()
```

**Description**: Returns the contract version number.

**Parameters**: None

**Returns**:
- `int`: Current version number (1)

**Example Usage**:
```func
int version = account_locks.get_version();
```

**JavaScript/TypeScript**:
```typescript
const version = await accountLocksContract.getVersion();
console.log(`Contract version: ${version}`);
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 400 | `err::invalid_operation` | Unknown or invalid operation code |
| 401 | `err::unauthorized` | Sender is not authorized to perform this operation |
| 403 | `err::account_locked` | Account is locked and cannot send TBC |
| 404 | `err::invalid_nft` | Invalid NFT address (reserved for future use) |

### Error Code Usage

```func
;; Throwing errors
throw(400);  ;; Invalid operation
throw(401);  ;; Unauthorized
throw(403);  ;; Account locked
throw(404);  ;; Invalid NFT

;; Conditional throw
throw_unless(401, is_authorized);
throw_unless(403, can_send);
```

## Events

### AccountLocked

**Marker**: `0x4c6f636b` ("Lock" in ASCII)

**Emitted When**: A lock is set on an NFT account

**Payload**:
```
Message:
  - uint6: 0x18 (nobounce flag)
  - slice: nft_address (address of locked NFT)
  - coins: 0 (no value)
  - uint: 0 (standard fields)
  - uint32: 0x4c6f636b (event marker "Lock")
  - uint8: lock_type (FRAUD_LOCK=1 or COLLATERAL_LOCK=2)
```

**Example Indexer Code**:
```typescript
// Listen for AccountLocked events
client.on('message', (msg) => {
  if (msg.body.marker === 0x4c6f636b) {
    const nftAddress = msg.destination;
    const lockType = msg.body.lockType;

    if (lockType === 1) {
      console.log(`Fraud lock set on ${nftAddress}`);
    } else if (lockType === 2) {
      console.log(`Collateral lock set on ${nftAddress}`);
    }
  }
});
```

---

### AccountUnlocked

**Marker**: `0x556e6c6b` ("Unlk" in ASCII)

**Emitted When**: A lock is cleared from an NFT account

**Payload**:
```
Message:
  - uint6: 0x18 (nobounce flag)
  - slice: nft_address (address of unlocked NFT)
  - coins: 0 (no value)
  - uint: 0 (standard fields)
  - uint32: 0x556e6c6b (event marker "Unlk")
  - uint8: lock_type (FRAUD_LOCK=1 or COLLATERAL_LOCK=2)
```

**Example Indexer Code**:
```typescript
// Listen for AccountUnlocked events
client.on('message', (msg) => {
  if (msg.body.marker === 0x556e6c6b) {
    const nftAddress = msg.destination;
    const lockType = msg.body.lockType;

    if (lockType === 1) {
      console.log(`Fraud lock cleared from ${nftAddress}`);
    } else if (lockType === 2) {
      console.log(`Collateral lock cleared from ${nftAddress}`);
    }
  }
});
```

## Lock Type Constants

```func
const int LOCK_NONE = 0;           // No locks
const int FRAUD_LOCK = 1;          // Fraud flag
const int COLLATERAL_LOCK = 2;     // Collateral flag
const int READ_ONLY = 4;           // Read-only mode (future)
```

## Storage Structure

The contract storage contains:

```
cell storage = begin_cell()
  .store_dict(lock_dict)           // Dictionary: nft_hash -> LockState
  .store_slice(risk_authority)     // Address of risk authority
  .store_slice(lending_adapter)    // Address of lending adapter
.end_cell()

Dictionary Entry (LockState):
  key: uint256 (hash of NFT address)
  value: begin_cell()
    .store_uint(fraud_locked, 1)      // 0 or 1
    .store_uint(collateral_locked, 1) // 0 or 1
  .end_cell()
```

## Integration Examples

### Payment Hub Integration

```func
;; Before internal transfer
int can_send_flag = account_locks_contract.get_can_send(from_nft);
throw_unless(403, can_send_flag);

;; Proceed with transfer
transfer_internal(from_nft, to_nft, amount);
```

### Merchant API Integration

```typescript
async function acceptPayment(payerNft: Address, amount: bigint) {
  // Check if payer account is locked
  const [fraud, collateral] = await accountLocks.getAccountLockState(payerNft);

  if (fraud) {
    throw new Error("Payment rejected: Account flagged for fraud");
  }

  if (collateral) {
    // Warning but may still accept
    console.warn("Payment from collateralized account");
  }

  // Proceed with payment
}
```

### Frontend Integration

```typescript
async function displayAccountStatus(nftAddress: Address) {
  const [fraudLocked, collateralLocked] =
    await accountLocks.getAccountLockState(nftAddress);

  if (fraudLocked) {
    showWarning("⚠️ Account flagged for fraud investigation");
    disableSendButton();
  }

  if (collateralLocked) {
    showWarning("🔒 Account locked as collateral in lending protocol");
    disableSendButton();
  }

  if (!fraudLocked && !collateralLocked) {
    showSuccess("✅ Account active");
    enableSendButton();
  }
}
```

### Lending Adapter Integration

```func
;; When user deposits collateral
() deposit_collateral(slice user_nft, int amount_ton) impure {
  ;; Receive TON collateral
  ;; ...

  ;; Lock the account
  send_message(
    account_locks_contract,
    0.05 TON,
    begin_cell()
      .store_uint(0x1003, 32)  ;; set_collateral_lock
      .store_slice(user_nft)
    .end_cell()
  );

  ;; Issue loan
  ;; ...
}

;; When loan is repaid
() repay_loan(slice user_nft) impure {
  ;; Verify loan repaid
  ;; ...

  ;; Unlock the account
  send_message(
    account_locks_contract,
    0.05 TON,
    begin_cell()
      .store_uint(0x1004, 32)  ;; clear_collateral_lock
      .store_slice(user_nft)
    .end_cell()
  );
}
```

## Gas Costs

Estimated gas consumption for operations:

| Operation | Estimated Gas | Notes |
|-----------|---------------|-------|
| Set Lock | ~5,000 gas | First lock on account |
| Set Lock | ~3,000 gas | Updating existing lock |
| Clear Lock | ~3,000 gas | Removing lock |
| Get Lock State | ~500 gas | Read-only get method |
| Check Can Send | ~500 gas | Read-only get method |

Note: Actual gas costs may vary based on network conditions and message complexity.

## Best Practices

### 1. Always Check Lock Status

```func
// Before any SEND operation
int can_send = account_locks.get_can_send(from_nft);
throw_unless(403, can_send);
```

### 2. Handle Lock Events

```typescript
// Index all lock changes for audit trail
indexer.on('AccountLocked', (event) => {
  database.insert({
    nft: event.nftAddress,
    lockType: event.lockType,
    timestamp: event.timestamp,
    action: 'locked'
  });
});
```

### 3. Display Clear Warnings

```typescript
// Inform users about lock status
if (fraudLocked) {
  showModal({
    title: "Account Restricted",
    message: "This account has been flagged for security review. " +
             "You cannot send TBC until the review is complete.",
    severity: "error"
  });
}
```

### 4. Coordinate Lock Operations

```func
// When clearing combined locks, clear in correct order
;; 1. Verify conditions are met
;; 2. Clear specific lock type
;; 3. Verify account state
;; 4. Notify user
```

## Version History

- **v1.0.0** (2025-12-25): Initial API implementation
  - FRAUD_LOCK and COLLATERAL_LOCK support
  - Public read interface
  - Event emission
  - Authorization model

## Related Documentation

- [Account Locks README](README.md) - Detailed feature documentation
- [Test Suite](tests/README.md) - Testing guidelines
- [Architecture](../../docs/architecture.md) - System architecture
- [Issue #7](https://github.com/xlabtg/tonbankcard-protocol/issues/7) - Original specification
