# Account Locks Test Suite

## Overview

This directory contains comprehensive unit tests for the Account Locks smart contract.

## Test Files

### `account-locks.spec.fc`
Complete test suite covering all lock scenarios and edge cases.

## Test Coverage

### 1. Initial State Tests
- ✅ Accounts start with no locks
- ✅ `can_send` returns true for unlocked accounts
- ✅ `can_receive` always returns true

### 2. Fraud Lock Tests
- ✅ Set fraud lock by authorized risk authority
- ✅ Clear fraud lock by risk authority
- ✅ Fraud lock blocks SEND operations
- ✅ Fraud lock allows RECEIVE operations
- ✅ Unauthorized attempts to set fraud lock fail

### 3. Collateral Lock Tests
- ✅ Set collateral lock by authorized lending adapter
- ✅ Clear collateral lock by lending adapter
- ✅ Collateral lock blocks SEND operations
- ✅ Collateral lock allows RECEIVE operations
- ✅ Unauthorized attempts to set collateral lock fail

### 4. Combined Lock Tests
- ✅ Both locks can be active simultaneously
- ✅ Clearing one lock preserves the other
- ✅ Account remains locked if any lock is active
- ✅ Account unlocks only when all locks are cleared

### 5. Edge Case Tests
- ✅ Multiple NFT accounts with different lock states
- ✅ NFT transfer preserves lock state
- ✅ Check can send operation integration
- ✅ RECEIVE operations always work regardless of locks

### 6. Authorization Tests
- ✅ Risk authority can only manage fraud locks
- ✅ Lending adapter can only manage collateral locks
- ✅ Unauthorized addresses cannot set/clear locks
- ✅ Users cannot self-clear their locks

## Running Tests

### Prerequisites

1. **TON Development Environment**
   ```bash
   # Install func compiler
   # See: https://docs.ton.org/develop/smart-contracts/sdk/javascript
   ```

2. **Blueprint (Recommended)**
   ```bash
   npm create ton@latest
   # Follow setup instructions
   ```

### Using Blueprint

1. **Initialize test project**:
   ```bash
   cd contracts/payments
   npx blueprint create AccountLocks
   ```

2. **Copy contract and tests**:
   ```bash
   cp account-locks.fc contracts/
   cp tests/account-locks.spec.fc tests/
   ```

3. **Run tests**:
   ```bash
   npx blueprint test
   ```

### Manual Testing with FunC

```bash
# Compile the contract
func -o account-locks.fif -SPA account-locks.fc

# Run tests (requires custom test runner)
func -P tests/account-locks.spec.fc
```

### Using ton-compiler

```bash
npm install -g ton-compiler

# Compile
ton-compiler account-locks.fc

# Test
ton-compiler tests/account-locks.spec.fc
```

## Test Scenarios

### Scenario 1: Normal Lock/Unlock Flow

```
1. Risk authority sets fraud lock
2. Verify can_send returns 0
3. Verify can_receive returns 1
4. Risk authority clears fraud lock
5. Verify can_send returns 1
```

### Scenario 2: Lending Collateral Flow

```
1. User deposits TON as collateral
2. Lending adapter sets collateral lock
3. User cannot withdraw TBC
4. Loan is repaid
5. Lending adapter clears collateral lock
6. User can withdraw TBC
```

### Scenario 3: Fraud Detection

```
1. Suspicious activity detected
2. Risk authority sets fraud lock immediately
3. User cannot send TBC to external accounts
4. Investigation completes
5. Risk authority clears lock (if legitimate) or keeps lock (if fraud confirmed)
```

### Scenario 4: Combined Locks

```
1. User has active collateral lock (lending)
2. Suspicious activity detected
3. Risk authority adds fraud lock
4. Both locks active, account fully restricted for sends
5. Investigation clears fraud lock
6. Collateral lock remains until loan repaid
```

## Expected Test Results

All tests should pass with the following assertions:

| Test # | Scenario | Expected Result |
|--------|----------|-----------------|
| 1 | Initial state | No locks, can_send=1 |
| 2 | Set fraud lock | fraud_locked=1, can_send=0 |
| 3 | Set collateral lock | collateral_locked=1, can_send=0 |
| 4 | Clear fraud lock | fraud_locked=0 |
| 5 | Clear collateral lock | collateral_locked=0 |
| 6 | Combined locks | Both=1, can_send=0 |
| 7 | Clear one lock | One cleared, other remains, can_send=0 |
| 8 | Unauthorized fraud lock | Throws 401 |
| 9 | Unauthorized collateral lock | Throws 401 |
| 10 | Multiple accounts | Each has independent state |
| 11 | check_can_send with lock | Throws 403 |
| 12 | Receive with locks | Always succeeds |
| 13 | NFT transfer | Lock persists after transfer |

## Integration Testing

### With Payment Hub (Future)

```typescript
// Example integration test
describe('Payment Hub + Account Locks', () => {
  it('should block transfer from locked account', async () => {
    // Set fraud lock
    await accountLocks.setFraudLock(nftAddress);

    // Attempt transfer via Payment Hub
    const result = await paymentHub.transferInternal(
      fromNft: nftAddress,
      toNft: recipientNft,
      amount: 1000
    );

    // Should fail with account_locked error
    expect(result.exitCode).toBe(403);
  });
});
```

### With Lending Adapter (Future)

```typescript
describe('Lending Adapter + Account Locks', () => {
  it('should lock account when collateral deposited', async () => {
    // Deposit collateral
    await lendingAdapter.depositCollateral(nftAddress, amount);

    // Verify lock is set
    const [fraud, collateral] = await accountLocks.getLockState(nftAddress);
    expect(collateral).toBe(1);

    // Verify cannot send
    const canSend = await accountLocks.canSend(nftAddress);
    expect(canSend).toBe(0);
  });
});
```

## Debugging Failed Tests

### Common Issues

1. **Unauthorized access errors**
   - Verify sender address matches risk_authority or lending_adapter
   - Check address formatting (addr_std vs other types)

2. **Lock state not updating**
   - Ensure save_data() is called after set_lock()
   - Verify dictionary key hashing is consistent

3. **Event not emitted**
   - Check message construction in emit_* functions
   - Verify send_raw_message flags

4. **Get method returns unexpected values**
   - Verify slice parsing in get_lock_state()
   - Check dictionary lookup logic

### Debug Logging

Add temporary debug output:

```func
;; In get_lock_state
int key = slice_hash(nft_address);
~dump(key);  ;; Print key value

(slice value, int found) = lock_dict.udict_get?(256, key);
~dump(found);  ;; Print whether key was found
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Smart Contract Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g ton-compiler
      - run: ton-compiler contracts/payments/account-locks.fc
      - run: ton-compiler contracts/payments/tests/account-locks.spec.fc
```

## Test Maintenance

### When to Update Tests

- ✅ When adding new lock types (e.g., READ_ONLY)
- ✅ When changing authorization model
- ✅ When modifying enforcement rules
- ✅ When adding new public methods
- ✅ When fixing bugs (add regression test)

### Test Quality Guidelines

1. **Independence**: Each test should be self-contained
2. **Clarity**: Test names should describe what they verify
3. **Coverage**: Aim for 100% code path coverage
4. **Edge Cases**: Test boundary conditions
5. **Security**: Test unauthorized access scenarios

## Performance Testing

### Gas Consumption Tests

```func
;; Measure gas for lock operations
() test_gas_consumption() impure {
    ;; Set lock
    int gas_before = get_gas_consumed();
    set_fraud_lock(...);
    int gas_after = get_gas_consumed();
    int gas_used = gas_after - gas_before;

    ;; Verify within acceptable range
    throw_unless(2000, gas_used < MAX_ACCEPTABLE_GAS);
}
```

### Stress Tests

```func
;; Test with many locked accounts
() test_many_locks() impure {
    repeat(1000) {
        slice nft = create_random_nft_address();
        set_lock(lock_dict, nft, 1, 0);
    }

    ;; Verify performance doesn't degrade
}
```

## Security Testing

### Fuzzing

Consider fuzzing inputs:
- Random NFT addresses
- Random lock combinations
- Random sender addresses
- Edge case values (0, max_uint, etc.)

### Audit Checklist

- [ ] Authorization checks on all state-changing operations
- [ ] No reentrancy vulnerabilities
- [ ] No integer overflow/underflow
- [ ] Proper error handling with specific error codes
- [ ] Events emitted for all state changes
- [ ] No unchecked external calls
- [ ] Dictionary operations are safe
- [ ] Slice parsing doesn't panic on invalid input

## Resources

- [TON FunC Testing Guide](https://docs.ton.org/develop/smart-contracts/testing/overview)
- [Blueprint Documentation](https://github.com/ton-org/blueprint)
- [TON Test Examples](https://docs.ton.org/develop/smart-contracts/examples)
- [Secure Smart Contract Programming](https://ton.org/en/secure-smart-contract-programming-in-func)

## Support

For questions or issues with tests:
1. Check existing test failures in CI
2. Review test output and error codes
3. Consult TON documentation
4. Open issue on GitHub with test failure details
