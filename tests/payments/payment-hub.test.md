# Payment Hub Contract Test Plan

## Overview

This document outlines the test scenarios for the Payment Hub smart contract. The actual test implementation would use TON's testing framework (Blueprint/Sandbox).

## Test Environment Setup

```typescript
// Example test setup (TypeScript with Blueprint)
import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { PaymentHub } from '../wrappers/PaymentHub';
import { Cell, toNano } from 'ton-core';

describe('PaymentHub', () => {
    let blockchain: Blockchain;
    let paymentHub: SandboxContract<PaymentHub>;
    let admin: SandboxContract<TreasuryContract>;
    // ... additional setup
});
```

## Test Cases

### 1. Contract Initialization

**Test ID**: INIT-001
**Description**: Verify contract deploys with correct initial state
**Steps**:
1. Deploy PaymentHub with admin address, NFT collections, TBC jetton master
2. Query get_admin() method
3. Query get_paused() method
4. Verify TBC jetton master address

**Expected Result**:
- Contract deploys successfully
- Admin address matches deployment parameter
- Paused state is false (0)
- TBC jetton master address is correct

---

### 2. Account Binding - Valid NFT Ownership

**Test ID**: ACCOUNT-001
**Description**: Verify NFT ownership validation works correctly
**Steps**:
1. Deploy mock NFT item with known owner
2. Add NFT collection to allowed collections
3. Call is_account_active(nft_address)

**Expected Result**:
- Method returns true (-1 in FunC)
- NFT is recognized as active account

---

### 3. Account Binding - Invalid NFT

**Test ID**: ACCOUNT-002
**Description**: Reject NFT from non-whitelisted collection
**Steps**:
1. Create NFT from collection NOT in allowed list
2. Attempt internal transfer using this NFT
3. Check for error

**Expected Result**:
- Transaction fails with error::invalid_nft (101)
- No transfer occurs

---

### 4. Account Binding - Blocked Account

**Test ID**: ACCOUNT-003
**Description**: Prevent operations on blocked accounts
**Steps**:
1. Deploy valid NFT account
2. Admin calls handle_flag_account to block it
3. Attempt internal transfer from blocked account

**Expected Result**:
- Account is marked as blocked
- Transaction fails with error::account_blocked (102)
- AccountFlagged event is emitted

---

### 5. Internal Transfer - Successful Zero-Fee Transfer

**Test ID**: TRANSFER-001
**Description**: Execute internal transfer between two NFT accounts
**Steps**:
1. Setup two valid NFT accounts (from_nft, to_nft)
2. Sender signs transaction with op::internal_transfer
3. Include: from_nft address, to_nft address, amount, memo
4. Send transaction

**Expected Result**:
- Transaction succeeds
- TransferInternal event emitted with correct parameters
- No fees charged at protocol level

---

### 6. Internal Transfer - Invalid Sender

**Test ID**: TRANSFER-002
**Description**: Reject transfer when sender doesn't own from_nft
**Steps**:
1. User A owns NFT #1
2. User B attempts transfer FROM NFT #1
3. Transaction should fail

**Expected Result**:
- Transaction fails with error::unauthorized (105)
- No transfer occurs

---

### 7. Internal Transfer - Zero/Negative Amount

**Test ID**: TRANSFER-003
**Description**: Reject transfers with invalid amounts
**Steps**:
1. Attempt transfer with amount = 0
2. Attempt transfer with amount < 0

**Expected Result**:
- Both transactions fail with error::invalid_amount (106)

---

### 8. Merchant Payment - Static Invoice

**Test ID**: MERCHANT-001
**Description**: Process merchant payment with invoice details
**Steps**:
1. Create payment_details cell with invoice_id, order_id, memo
2. Payer sends merchant_payment operation
3. Include: payer_nft, merchant_nft, amount, payment_details

**Expected Result**:
- Transaction succeeds
- MerchantPaid event emitted
- Event contains all payment details for indexer

---

### 9. Merchant Payment - Invalid Merchant NFT

**Test ID**: MERCHANT-002
**Description**: Reject payment to invalid merchant account
**Steps**:
1. Attempt merchant payment to non-whitelisted NFT
2. Check for error

**Expected Result**:
- Transaction fails with error::invalid_nft (101)

---

### 10. External Payment Receipt

**Test ID**: EXTERNAL-001
**Description**: Accept incoming payment from DEX
**Steps**:
1. Simulate DEX sending TBC after swap
2. Call handle_payment_received with recipient_nft, amount, source, details
3. Verify event emission

**Expected Result**:
- PaymentReceived event emitted
- Event includes recipient, amount, source address

---

### 11. External Payment - Blocked Recipient

**Test ID**: EXTERNAL-002
**Description**: Reject payment to blocked account
**Steps**:
1. Block recipient NFT account
2. Attempt to send payment to blocked account

**Expected Result**:
- Transaction fails with error::account_blocked (102)

---

### 12. Security - Emergency Pause

**Test ID**: SECURITY-001
**Description**: Admin can pause contract in emergency
**Steps**:
1. Admin calls set_paused(1)
2. Attempt any operation (transfer, merchant payment)
3. Query get_paused() method

**Expected Result**:
- Contract enters paused state
- All operations fail with error::contract_paused (104)
- get_paused() returns 1

---

### 13. Security - Unpause

**Test ID**: SECURITY-002
**Description**: Admin can unpause contract
**Steps**:
1. Contract is paused
2. Admin calls set_paused(0)
3. Attempt normal operations

**Expected Result**:
- Contract returns to active state
- Normal operations work correctly

---

### 14. Security - Unauthorized Pause

**Test ID**: SECURITY-003
**Description**: Non-admin cannot pause contract
**Steps**:
1. Non-admin user attempts to call set_paused
2. Check for error

**Expected Result**:
- Transaction fails with error::unauthorized (105)
- Contract state unchanged

---

### 15. Security - Unauthorized Account Flagging

**Test ID**: SECURITY-004
**Description**: Non-admin cannot flag accounts
**Steps**:
1. Non-admin user attempts to flag an account
2. Check for error

**Expected Result**:
- Transaction fails with error::unauthorized (105)
- Account status unchanged

---

### 16. Events - TransferInternal Emission

**Test ID**: EVENT-001
**Description**: Verify TransferInternal event structure
**Steps**:
1. Execute internal transfer
2. Capture emitted event
3. Parse event data

**Expected Result**:
- Event type is op::internal_transfer
- Event data contains: from_nft, to_nft, amount, memo
- Event is properly formatted for indexer

---

### 17. Events - MerchantPaid Emission

**Test ID**: EVENT-002
**Description**: Verify MerchantPaid event structure
**Steps**:
1. Execute merchant payment
2. Capture emitted event
3. Parse event data

**Expected Result**:
- Event type is op::merchant_payment
- Event data contains: payer_nft, merchant_nft, amount, payment_details

---

### 18. Get Methods - Query Account Status

**Test ID**: QUERY-001
**Description**: Test is_account_active get method
**Steps**:
1. Query active account
2. Query blocked account
3. Query invalid account

**Expected Result**:
- Active account returns true (-1)
- Blocked account returns false (0)
- Invalid account returns false (0)

---

### 19. Get Methods - Query Contract State

**Test ID**: QUERY-002
**Description**: Test state query methods
**Steps**:
1. Query get_admin()
2. Query get_paused()
3. Query get_tbc_jetton_master()

**Expected Result**:
- All methods return correct values
- No state modification occurs

---

### 20. Edge Cases - Empty Message Body

**Test ID**: EDGE-001
**Description**: Handle empty messages gracefully
**Steps**:
1. Send message with empty body to contract

**Expected Result**:
- Contract ignores message
- No errors thrown
- No state changes

---

## Integration Test Scenarios

### INT-001: Full Payment Flow
1. User receives TBC from DEX → PaymentReceived event
2. User transfers to merchant → MerchantPaid event
3. Merchant transfers to another user → TransferInternal event

### INT-002: Anti-Fraud Flow
1. User makes suspicious transactions
2. Admin flags account → AccountFlagged event
3. Further transactions blocked
4. Admin unflag after investigation
5. Transactions resume

### INT-003: Emergency Scenario
1. Security issue detected
2. Admin pauses contract
3. All operations blocked
4. Issue resolved
5. Admin unpauses
6. Normal operations resume

---

## Test Execution Notes

### Prerequisites
- TON blockchain test environment (Sandbox)
- Mock NFT contracts deployed
- Mock TBC jetton contract
- Admin wallet for testing

### Test Data
- Valid NFT addresses from test collections
- Valid TBC jetton master address
- Multiple test user wallets

### Coverage Goals
- 100% function coverage
- All error paths tested
- All event emissions verified
- All get methods validated

---

## Implementation Notes

The actual tests would be implemented using:

```typescript
// Example test implementation structure
import { Blockchain } from '@ton-community/sandbox';
import '@ton-community/test-utils';

it('should execute internal transfer successfully', async () => {
    // Arrange: Setup accounts and initial state
    const fromNFT = await deployMockNFT(user1.address);
    const toNFT = await deployMockNFT(user2.address);

    // Act: Execute transfer
    const result = await paymentHub.sendInternalTransfer(
        user1.getSender(),
        fromNFT.address,
        toNFT.address,
        toNano('100'),
        createMemoCell('test transfer')
    );

    // Assert: Verify results
    expect(result.transactions).toHaveTransaction({
        from: user1.address,
        to: paymentHub.address,
        success: true,
    });

    // Verify event emission
    const events = extractEvents(result.transactions);
    expect(events).toContainEqual({
        type: 'TransferInternal',
        from: fromNFT.address,
        to: toNFT.address,
        amount: toNano('100'),
    });
});
```

---

## Test Status

- [ ] Test environment setup
- [ ] Mock contracts deployed
- [ ] Unit tests implemented
- [ ] Integration tests implemented
- [ ] Edge cases covered
- [ ] All tests passing
