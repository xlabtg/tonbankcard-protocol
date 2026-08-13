# Adversarial Test Cases for Threat Model

**Document Type:** Test Specification
**Issue Reference:** [#20 - Issue 4.2 Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
**Related Documentation:** [threat-model.md](../../docs/threat-model.md)
**Status:** Test Specifications Ready for Implementation
**Last Updated:** 2025-12-27

---

## Overview

This directory contains adversarial test cases designed to validate the security properties and mitigations described in the threat model. Each test case attempts to exploit a specific threat vector and verifies that the protocol's defenses work as intended.

---

## Test Categories

### 1. T1 - NFT Transfer Race Conditions
**File:** `nft-race-conditions.spec.ts`
**Threat:** NFT ownership changes during pending transactions
**Tests:** 8 test cases

### 2. T2 - Reentrancy & Callback Abuse
**File:** `reentrancy-attempts.spec.ts`
**Threat:** Malicious contracts attempt reentrancy
**Tests:** 6 test cases

### 3. T3 - Ledger Desynchronization
**File:** `ledger-conservation.spec.ts`
**Threat:** Internal ledger diverges from jetton balances
**Tests:** 7 test cases

### 4. T4 - Lock Bypass Attempts
**File:** `lock-bypass-attempts.spec.ts`
**Threat:** Attempts to move funds despite locks
**Tests:** 10 test cases

### 5. T5 - Merchant Payment Abuse
**File:** `merchant-payment-abuse.spec.ts`
**Threat:** Invoice replay, unauthorized withdrawals
**Tests:** 8 test cases

### 6. T6 - External Adapter Exploits
**File:** `external-adapter-exploits.spec.ts`
**Threat:** API spoofing, false confirmations
**Tests:** 7 test cases

### 7. T8 - Admin Key Compromise
**File:** `admin-key-compromise.spec.ts`
**Threat:** Abuse of admin privileges
**Tests:** 9 test cases

### 8. Invariant Verification
**File:** `invariant-tests.spec.ts`
**Threat:** Protocol invariant violations
**Tests:** 14 test cases

---

## Total Test Coverage

- **Total Test Files:** 8
- **Total Test Cases:** 69
- **Critical Path Tests:** 23
- **Edge Case Tests:** 46

---

## Test Execution

### Prerequisites

```bash
# Install dependencies
npm install

# Install TON test framework (Blueprint)
npm install @ton-community/blueprint
npm install @ton-community/sandbox
```

### Run All Adversarial Tests

```bash
# Run all adversarial tests
npx blueprint test tests/adversarial/

# Run specific threat category
npx blueprint test tests/adversarial/nft-race-conditions.spec.ts

# Run with coverage
npx blueprint test --coverage tests/adversarial/
```

### Expected Results

All tests should **PASS** (attack attempts properly mitigated) except:

**Known Vulnerabilities (Tests will FAIL until fixed):**
- `lock-bypass-attempts.spec.ts` - "Should reject transfer from locked account via Payment Hub" (R-CRIT-1)
- `admin-key-compromise.spec.ts` - Multi-sig tests (single admin key currently)

---

## Test Implementation Guidelines

### Test Structure Template

```typescript
import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { toNano } from '@ton/core';
import { PaymentHub } from '../wrappers/PaymentHub';
import { AccountLocks } from '../wrappers/AccountLocks';
import '@ton/test-utils';

describe('Threat Vector: [NAME]', () => {
    let blockchain: Blockchain;
    let paymentHub: SandboxContract<PaymentHub>;
    let accountLocks: SandboxContract<AccountLocks>;
    let attacker: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // Deploy contracts
        paymentHub = blockchain.openContract(await PaymentHub.fromInit());
        accountLocks = blockchain.openContract(await AccountLocks.fromInit());

        // Setup attacker
        attacker = await blockchain.treasury('attacker');
    });

    it('[TEST CASE NAME]', async () => {
        // ARRANGE: Setup attack scenario

        // ACT: Execute attack

        // ASSERT: Verify attack failed / mitigations worked
    });
});
```

### Naming Conventions

- Test files: `[threat-category]-[descriptive-name].spec.ts`
- Test suites: `describe('Threat Vector: [Threat ID] - [Name]', ...)`
- Test cases: `it('Should [expected behavior] when [attack scenario]', ...)`

### Assertion Patterns

```typescript
// Attack should FAIL (mitigation works)
await expect(maliciousTransaction).toRevertWith('error::unauthorized');

// Attack should be DETECTED
const events = result.events;
expect(events).toContainEventMatching({ type: 'SecurityAlert' });

// Invariant should HOLD
const balanceSum = await getAllBalances();
const totalSupply = await getTotalSupply();
expect(balanceSum).toEqual(totalSupply);  // Invariant I5
```

---

## Test File Specifications

The following sections provide detailed specifications for each test file. These can be implemented by developers or used as acceptance criteria for test-driven development.

---

## File: `nft-race-conditions.spec.ts`

### Test Suite: T1 - NFT Transfer Race Conditions

#### Test 1: Front-Running Attack
```
SCENARIO: Attacker observes pending transfer and buys NFT before execution

SETUP:
1. Alice owns NFT #7777001 with 1000 TBC balance
2. Alice initiates transfer: 500 TBC from NFT #7777001 to NFT #8888001
3. Before execution, Bob purchases NFT #7777001 from marketplace
4. Transaction executes

EXPECTED RESULT:
❌ Transaction FAILS with error::unauthorized
✅ Alice's signature is invalid (she no longer owns NFT)
✅ No funds transferred
✅ Bob (new owner) did not authorize transaction

INVARIANTS VERIFIED:
- I1: Non-Custodial Ownership (Bob's funds safe)
- I2: NFT = Account Authority (ownership verified at execution)
```

#### Test 2: Concurrent NFT Transfer
```
SCENARIO: NFT transferred in same block as payment

SETUP:
1. Alice owns NFT #7777001
2. In same block:
   - Tx1: Alice transfers NFT #7777001 to Bob
   - Tx2: Alice initiates payment from NFT #7777001
3. Transaction ordering varies

EXPECTED RESULT:
Case A (NFT transfer first):
  ❌ Payment FAILS with error::unauthorized

Case B (Payment first):
  ✅ Payment SUCCEEDS (Alice owned NFT at execution time)
  ✅ Bob inherits reduced balance (payment already deducted)

INVARIANTS VERIFIED:
- I2: NFT = Account Authority
- I4: Atomic Transfers
```

#### Test 3: MEV Reordering Attack
```
SCENARIO: Validator reorders transactions to favor attacker

SETUP:
1. Alice owns NFT #7777001 with high-value balance
2. Mempool contains:
   - Tx1 (Alice): Transfer 1000 TBC from NFT
   - Tx2 (Bob): Purchase NFT #7777001
3. Validator processes Tx2 before Tx1

EXPECTED RESULT:
❌ Tx1 FAILS (Alice no longer owns NFT)
✅ Bob owns NFT with original balance
⚠️ Alice's transaction reverted (inconvenience but funds safe)

IMPACT: User inconvenience, not fund loss
SEVERITY: LOW (attacker must legitimately purchase NFT)
```

#### Test 4: Ownership Cache Poisoning
```
SCENARIO: Attacker attempts to exploit cached ownership data

SETUP:
1. Mock caching mechanism (if any)
2. Alice owns NFT, cache shows Alice
3. Alice transfers NFT to Bob
4. Attacker sends transaction while cache still shows Alice as owner

EXPECTED RESULT:
❌ Transaction FAILS
✅ Runtime ownership check queries blockchain (ignores cache)
✅ Current owner (Bob) is verified

VERIFICATION:
- Confirm no ownership caching in Payment Hub
- Verify get_nft_owner() calls NFT contract every time
```

#### Test 5: Soulbound NFT Safety
```
SCENARIO: Non-transferable NFT cannot be hijacked

SETUP:
1. NFT #7777001 is marked soulbound (if supported)
2. Attacker attempts to purchase/transfer NFT
3. Original owner initiates transfer

EXPECTED RESULT:
✅ NFT transfer FAILS (soulbound)
✅ Original owner's transaction SUCCEEDS
✅ Account cannot be hijacked via NFT market

NOTE: Test only if soulbound NFTs are implemented
```

#### Test 6: Multi-Hop Ownership Change
```
SCENARIO: NFT changes owners multiple times before transaction

SETUP:
1. Alice owns NFT → initiates payment
2. Alice → Bob (transfer 1)
3. Bob → Carol (transfer 2)
4. Payment transaction executes

EXPECTED RESULT:
❌ Payment FAILS with error::unauthorized
✅ Current owner is Carol, not Alice
✅ No intermediate ownership states accepted
```

#### Test 7: Ownership Timing Edge Case
```
SCENARIO: NFT transfer and payment in consecutive blocks

SETUP:
1. Block N: Alice owns NFT #7777001
2. Block N: Alice submits payment transaction (pending)
3. Block N+1: Alice transfers NFT to Bob
4. Block N+1: Payment transaction executes

EXPECTED RESULT:
❌ Payment FAILS (ownership changed)
✅ Execution-time ownership check prevents hijack

VERIFICATION:
- Verify ownership checked in recv_internal, not submission
- Confirm no time-of-check/time-of-use (TOCTOU) vulnerability
```

#### Test 8: Recovered Ownership Race
```
SCENARIO: NFT transferred away and back during transaction lifecycle

SETUP:
1. Alice owns NFT → initiates transfer
2. Alice transfers NFT to Bob
3. Bob immediately transfers NFT back to Alice
4. Original transaction executes

EXPECTED RESULT:
✅ Transaction SUCCEEDS (Alice owns NFT again)
✅ Ownership verification passes at execution time

EDGE CASE: Tests that ownership is evaluated at execution, not submission
```

---

## File: `reentrancy-attempts.spec.ts`

### Test Suite: T2 - Reentrancy & Callback Abuse

#### Test 1: Malicious NFT Contract Callback
```
SCENARIO: Attacker deploys malicious NFT that attempts reentrancy

SETUP:
1. Attacker deploys MaliciousNFT contract
2. MaliciousNFT.recv_internal() tries to call Payment Hub during ownership query
3. Payment Hub calls get_nft_owner(MaliciousNFT)

ATTACK CODE (Malicious NFT):
```func
() recv_internal(...) {
    if (op == get_nft_owner_query) {
        // Attempt reentrancy
        send_message(payment_hub, op::internal_transfer, ...);
    }
}
```

EXPECTED RESULT:
✅ TON actor model prevents synchronous reentrancy
✅ Malicious message queued for later (not during execution)
✅ Payment Hub state protected

VERIFICATION:
- Confirm no synchronous external calls in Payment Hub
- Verify emit_event() happens AFTER state mutations
```

#### Test 2: Event Callback Exploit
```
SCENARIO: Attacker listens for emit_event and sends callback

SETUP:
1. Normal transfer executes: Alice → Bob, 500 TBC
2. Payment Hub emits InternalTransferEvent
3. Malicious contract receives event notification
4. Malicious contract sends reentrant transaction

EXPECTED RESULT:
✅ Reentrant transaction is NEW message (separate execution)
✅ Original transaction completed atomically
✅ No state corruption possible

INVARIANT VERIFIED: I4 (Atomic Transfers)
```

#### Test 3: Recursive Message Attack
```
SCENARIO: Attacker sends message that triggers chain of calls

SETUP:
1. MaliciousContract sends op::internal_transfer to Payment Hub
2. Payment Hub processes normally
3. During processing, MaliciousContract sends ANOTHER op::internal_transfer
4. Attempts to create recursive execution

EXPECTED RESULT:
✅ Second message queued, not executed recursively
✅ First message completes independently
✅ TON message queue prevents stack-based reentrancy

VERIFICATION:
- Confirm TON actor model isolation
- Verify no global state shared across messages
```

#### Test 4: Cross-Contract Reentrancy
```
SCENARIO: Attack via Account Locks → Payment Hub interaction

SETUP:
1. Attacker calls Account Locks.check_can_send()
2. Account Locks internally queries Payment Hub
3. Attacker attempts to reenter Payment Hub during this query

EXPECTED RESULT:
✅ Get methods are read-only (no state changes)
✅ No reentrancy possible in read path
✅ Even if attempted, TON prevents synchronous calls

NOTE: This test verifies defense-in-depth (even without TON protection)
```

#### Test 5: State Mutation Order Attack
```
SCENARIO: Attacker attempts to exploit order of state changes

SETUP:
1. Payment Hub processes transfer:
   - Load data
   - Validate
   - Update state (CRITICAL SECTION)
   - Save data
   - Emit events
2. Attacker sends message during CRITICAL SECTION

EXPECTED RESULT:
✅ No external calls during CRITICAL SECTION
✅ State saved before any events emitted
✅ Attack message queued after transaction completes

CODE REVIEW:
```func
// payment-hub.fc:287-295 - Verify this pattern
handle_internal_transfer(...) {
    // 1. Validation (read-only)
    verify_nft_account(...);

    // 2. State mutation (no external calls)
    // ... balance updates ...

    // 3. Emit event (AFTER state committed)
    emit_event(...);
    return ();
}
```
```

#### Test 6: Jetton Transfer Callback
```
SCENARIO: TBC jetton wallet sends callback during transfer

SETUP:
1. Payment Hub sends jetton transfer message to TBC wallet
2. TBC jetton wallet processes transfer
3. TBC wallet sends success/failure notification back
4. Attacker intercepts and modifies notification

EXPECTED RESULT:
✅ Jetton transfer is separate message (asynchronous)
✅ Payment Hub does not wait for confirmation
✅ Jetton transfer atomicity ensured by jetton contract

CURRENT STATUS: Production implementation needed
```

---

## File: `ledger-conservation.spec.ts`

### Test Suite: T3 - Ledger Desynchronization

#### Test 1: Jetton Balance = Source of Truth
```
SCENARIO: Verify Payment Hub does NOT maintain internal ledger

SETUP:
1. Multiple accounts with TBC balances
2. Execute transfers via Payment Hub
3. Query balances from:
   - TBC jetton wallets (source of truth)
   - Payment Hub (should have no balance storage)

EXPECTED RESULT:
✅ Payment Hub has no balance state variables
✅ All balance queries delegated to TBC jetton
✅ No internal ledger to desynchronize

CODE AUDIT:
- Confirm payment-hub.fc contains no balance dictionaries
- Verify no balance storage in load_data() / save_data()
```

#### Test 2: Conservation During Transfers
```
SCENARIO: Total supply conserved across all transfers

SETUP:
1. Record Σ(all TBC wallet balances) BEFORE
2. Execute 100 random internal transfers
3. Record Σ(all TBC wallet balances) AFTER

EXPECTED RESULT:
✅ Σ(before) = Σ(after)
✅ No TBC created or destroyed
✅ Invariant I5 maintained

VERIFICATION:
- Sum must equal TBC jetton total supply
- Test with both successful and failed transfers
```

#### Test 3: Failed Transfer Rollback
```
SCENARIO: Failed transfer does not corrupt balances

SETUP:
1. Account A: 100 TBC
2. Account B: 50 TBC
3. Attempt transfer: A → B, 200 TBC (insufficient balance)

EXPECTED RESULT:
❌ Transfer FAILS with error::insufficient_balance
✅ Account A still has 100 TBC (no partial debit)
✅ Account B still has 50 TBC (no partial credit)
✅ Total supply unchanged

INVARIANT: I4 (Atomic Transfers)
```

#### Test 4: Indexer Cache Staleness
```
SCENARIO: Off-chain indexer shows stale balance

SETUP:
1. Indexer caches: Account A has 1000 TBC
2. Execute transfer: A → B, 500 TBC
3. Indexer has not yet updated cache
4. User queries indexer API

EXPECTED RESULT:
⚠️ Indexer may return stale data (500 TBC delay)
✅ On-chain query returns correct balance (500 TBC)
✅ UI should include "last updated" timestamp
✅ Users can always query blockchain directly

SEVERITY: LOW (informational only, not a security issue)
```

#### Test 5: Concurrent Transfer Consistency
```
SCENARIO: Multiple transfers to same account in one block

SETUP:
1. Account A starts with 0 TBC
2. In same block:
   - Transfer 1: B → A, 100 TBC
   - Transfer 2: C → A, 200 TBC
   - Transfer 3: D → A, 300 TBC

EXPECTED RESULT:
✅ All transfers succeed
✅ Account A ends with 600 TBC
✅ No race conditions or lost updates
✅ TVM handles concurrent messages correctly

VERIFICATION:
- Each transfer is independent message
- Jetton wallet state updates are serialized
```

#### Test 6: Cross-Contract Balance Verification
```
SCENARIO: Verify Payment Hub and TBC jetton agree on balances

SETUP:
1. Query all NFT account balances via:
   - Method 1: Direct TBC jetton wallet queries
   - Method 2: Payment Hub get methods (if any)

EXPECTED RESULT:
✅ Payment Hub has NO balance getters (delegates to jetton)
✅ Only source is TBC jetton wallets
✅ Impossible to have discrepancy

ARCHITECTURAL VERIFICATION:
- Confirm single source of truth design
```

#### Test 7: Phantom Balance Attack
```
SCENARIO: Attacker attempts to create TBC without backing

SETUP:
1. Attacker deploys FakeJettonWallet
2. FakeJettonWallet claims balance of 1,000,000 TBC
3. Attacker attempts to use FakeJettonWallet in Payment Hub

EXPECTED RESULT:
❌ Payment Hub only accepts transfers from real TBC jetton master
✅ tbc_jetton_master address is immutable and verified
✅ Fake jetton wallets rejected

CODE VERIFICATION:
```func
// payment-hub.fc:47
global slice tbc_jetton_master;  // Immutable after deployment
```
```

---

## File: `lock-bypass-attempts.spec.ts`

### Test Suite: T4 - Lock Bypass Attempts

#### Test 1: Locked Account Send via Payment Hub (CRITICAL)
```
SCENARIO: Account with FRAUD_LOCK attempts transfer via Payment Hub

SETUP:
1. Account A has 1000 TBC
2. Set FRAUD_LOCK on Account A via Account Locks contract
3. Account A owner attempts internal_transfer via Payment Hub

EXPECTED RESULT (CURRENT - VULNERABILITY):
⚠️ Transfer SUCCEEDS (lock not checked)
❌ TEST FAILS - Known vulnerability R-CRIT-1

EXPECTED RESULT (AFTER FIX):
❌ Transfer FAILS with error::account_blocked
✅ Payment Hub checks Account Locks.can_send() before transfer
✅ Locked account cannot send via Payment Hub

FIX REQUIRED:
```func
// payment-hub.fc:135 - Add this check
var (valid, owner) = verify_nft_account(from_nft, sender_address);

// ADD THIS:
int can_send = call_account_locks_can_send(from_nft);
throw_unless(error::account_blocked, can_send);
```
```

#### Test 2: Direct Jetton Transfer Bypass
```
SCENARIO: Account with lock transfers TBC directly via jetton wallet

SETUP:
1. Account A (NFT #7777001) has 1000 TBC
2. Set COLLATERAL_LOCK on Account A
3. Account A owner sends jetton transfer DIRECTLY to TBC jetton wallet
   (bypasses Payment Hub entirely)

EXPECTED RESULT:
✅ Transfer SUCCEEDS (by design)
⚠️ Lock is ADVISORY for direct jetton transfers
⚠️ TBC jetton contract is immutable and does not know about locks

SEVERITY: HIGH architectural limitation
MITIGATION: Document limitation, off-chain monitoring, marketplace warnings

INVARIANT NOTE: Does NOT violate I6 (locks are flags, not confiscation)
```

#### Test 3: NFT Transfer to Bypass Lock
```
SCENARIO: Attacker transfers locked NFT to new address to bypass lock

SETUP:
1. Account A (NFT #7777001) has FRAUD_LOCK
2. Owner transfers NFT #7777001 to new address (Account B)
3. Account B (now owns NFT #7777001) attempts to send TBC

EXPECTED RESULT:
❌ Transfer FAILS (lock persists)
✅ Lock is tied to NFT address, not owner address
✅ Lock state dictionary key is nft_address hash

CODE VERIFICATION:
```func
// account-locks.fc:102
() set_lock(cell lock_dict, slice nft_address, ...) {
    int key = slice_hash(nft_address);  // Lock tied to NFT, not owner
    lock_dict~udict_set(256, key, value.begin_parse());
}
```
```

#### Test 4: Multiple Lock Types Combined
```
SCENARIO: Account has both FRAUD_LOCK and COLLATERAL_LOCK

SETUP:
1. Account A has 1000 TBC
2. Set FRAUD_LOCK on Account A (risk authority)
3. Set COLLATERAL_LOCK on Account A (lending adapter)
4. Attempt transfer

EXPECTED RESULT:
❌ Transfer FAILS with error::account_blocked
✅ can_send() returns 0 if ANY lock active:
```func
// account-locks.fc:83-92
int can_send(slice nft_address) method_id {
    (int fraud_locked, int collateral_locked) = get_lock_state(nft_address);
    if (fraud_locked | collateral_locked) {  // Bitwise OR
        return 0;
    }
    return 1;
}
```
```

#### Test 5: Lock While Transfer Pending
```
SCENARIO: Account locked during pending transfer transaction

SETUP:
1. Account A initiates transfer (transaction in mempool)
2. Before execution, risk_authority sets FRAUD_LOCK on Account A
3. Original transfer transaction executes

EXPECTED RESULT (AFTER PAYMENT HUB FIX):
❌ Transfer FAILS (lock checked at execution time, not submission)
✅ Runtime lock check prevents race condition

CURRENT STATUS: Test will FAIL until R-CRIT-1 fixed
```

#### Test 6: Receiving to Locked Account
```
SCENARIO: Locked account receives TBC

SETUP:
1. Account A has FRAUD_LOCK
2. Account B sends 500 TBC to Account A

EXPECTED RESULT:
✅ Transfer SUCCEEDS
✅ can_receive() always returns 1
✅ Locked accounts can RECEIVE, just not SEND

INVARIANT VERIFICATION: I6 (Lock ≠ Confiscation)
```func
// account-locks.fc:95-98
int can_receive(slice nft_address) method_id {
    return 1;  // ALWAYS allow receiving
}
```
```

#### Test 7: Unauthorized Lock Manipulation
```
SCENARIO: Attacker attempts to set locks without authorization

SETUP:
1. Attacker is NOT risk_authority or lending_adapter
2. Attacker sends op::set_fraud_lock message to Account Locks

EXPECTED RESULT:
❌ Operation FAILS with err::unauthorized
✅ Authorization check enforces single authority per lock type

CODE VERIFICATION:
```func
// account-locks.fc:162
if (op == op::set_fraud_lock) {
    throw_unless(err::unauthorized, equal_slice_bits(sender_address, risk_authority));
    // ... rest
}
```
```

#### Test 8: Lock Authority Compromise
```
SCENARIO: Risk authority key stolen, attacker locks all accounts

SETUP:
1. Attacker gains access to risk_authority private key
2. Attacker sends set_fraud_lock to 1000 accounts
3. Protocol DoS (no one can send TBC)

EXPECTED RESULT (CURRENT):
⚠️ Attack SUCCEEDS (single key vulnerability)
❌ Mass account locking possible
⚠️ Severity: CRITICAL (R-CRIT-2)

MITIGATION REQUIRED:
- Multi-sig risk authority (3-of-5)
- Rate limiting on lock operations
- DAO governance for lock authority
```

#### Test 9: Lock State Persistence
```
SCENARIO: Verify locks survive contract restarts / block reorganization

SETUP:
1. Set FRAUD_LOCK on Account A
2. Execute transfer (should fail)
3. Simulate block reorganization or contract redeployment (if testable)
4. Query lock state

EXPECTED RESULT:
✅ Lock persists in storage
✅ Lock state retrieved correctly after restart
✅ Transfer still fails

VERIFICATION: Storage integrity test
```

#### Test 10: Clear Lock and Immediate Transfer
```
SCENARIO: Lock cleared, then immediate transfer in same block

SETUP:
1. Account A has FRAUD_LOCK
2. In same block:
   - Tx1: clear_fraud_lock(Account A)
   - Tx2: Account A sends internal_transfer

EXPECTED RESULT:
Case A (clear first): ✅ Transfer SUCCEEDS
Case B (transfer first): ❌ Transfer FAILS

VERIFICATION: Transaction ordering matters, but both outcomes are correct
```

---

## File: `merchant-payment-abuse.spec.ts`

### Test Suite: T5 - Merchant Payment Abuse

#### Test 1: Invoice Replay Attack
```
SCENARIO: Customer pays same invoice multiple times

SETUP:
1. Merchant creates invoice #12345 for 100 TBC
2. Customer pays invoice #12345 (payment 1)
3. Attacker (or merchant) resubmits invoice #12345
4. Customer unknowingly pays again (payment 2)

EXPECTED RESULT (CURRENT):
⚠️ Replay SUCCEEDS (no uniqueness check)
✅ But customer must SIGN each payment
⚠️ Severity: LOW (user explicitly authorizes)

RECOMMENDED MITIGATION:
- UI warns: "You already paid this invoice on [date]"
- Merchant API tracks paid invoices off-chain
- Optional: On-chain invoice hash dictionary (future)
```

#### Test 2: Unauthorized Merchant Withdrawal
```
SCENARIO: Merchant attempts to pull funds without customer authorization

SETUP:
1. Customer has 1000 TBC
2. Merchant sends op::merchant_payment claiming customer authorized
3. Message NOT signed by customer's wallet

EXPECTED RESULT:
❌ Payment FAILS with error::unauthorized
✅ verify_nft_account checks sender_address = customer
✅ Merchants cannot PULL funds (only RECEIVE user-initiated payments)

INVARIANT VERIFIED: I3 (No Admin Fund Control) + I2 (NFT = Authority)
```

#### Test 3: Payload Manipulation
```
SCENARIO: Merchant modifies payment details after customer signs

SETUP:
1. Customer signs: merchant_payment(amount=100, payload={item: "A"})
2. Merchant attempts to modify payload to {item: "B", amount: 200}
3. Submit modified transaction

EXPECTED RESULT:
❌ Transaction FAILS (signature invalid for modified data)
✅ TON transaction signature covers entire message
✅ Payload tampering breaks signature

NOTE: This is blockchain-level protection, not contract-specific
```

#### Test 4: Self-Payment Edge Case
```
SCENARIO: Customer pays themselves (payer_nft == merchant_nft)

SETUP:
1. Account A sends merchant_payment where merchant = Account A
2. Amount: 500 TBC

EXPECTED RESULT:
✅ Payment SUCCEEDS (no-op but allowed)
✅ Event emitted for transparency
⚠️ Balance unchanged (self-transfer)

RATIONALE: No security issue, just unusual usage
```

#### Test 5: Payment to Closed Merchant Account
```
SCENARIO: Customer pays merchant whose account is CLOSED

SETUP:
1. Merchant account marked CLOSED (if state machine implemented)
2. Customer sends payment to closed merchant

EXPECTED RESULT:
❌ Payment FAILS with error::account_closed
✅ Cannot send to CLOSED accounts

NOTE: Requires Account State Machine (Issue #5) implementation
```

#### Test 6: High-Velocity Payment Abuse
```
SCENARIO: Attacker spams merchant payments to DoS

SETUP:
1. Attacker sends 1000 merchant_payment transactions in 1 second
2. Each payment: 1 nanoTBC (minimal amount)
3. Target: Overwhelm indexer or merchant API

EXPECTED RESULT:
✅ Transactions succeed (user pays gas for each)
⚠️ Attacker wastes own money on gas fees
✅ Protocol unaffected (on-chain robust)
⚠️ Off-chain indexer may lag (not security issue)

MITIGATION: Rate limiting on merchant API (off-chain)
```

#### Test 7: Payment Details Size Bomb
```
SCENARIO: Attacker sends huge payment_details cell

SETUP:
1. Craft payment_details cell with 10MB of data
2. Send merchant_payment with bloated payload

EXPECTED RESULT:
❌ Transaction FAILS (exceeds cell size limits)
✅ TON enforces max cell size (1023 bytes per cell)
✅ Excessive data rejected by TVM

VERIFICATION: TVM limits prevent storage abuse
```

#### Test 8: Zero Amount Payment
```
SCENARIO: Customer sends payment with amount = 0

SETUP:
1. Customer sends merchant_payment(amount = 0)

EXPECTED RESULT:
❌ Payment FAILS with error::invalid_amount
✅ Validation requires amount > 0

CODE VERIFICATION:
```func
// payment-hub.fc:181
throw_unless(error::invalid_amount, amount > 0);
```
```

---

## File: `external-adapter-exploits.spec.ts`

### Test Suite: T6 - External Adapter Exploits

#### Test 1: False ChangeNOW Confirmation
```
SCENARIO: ChangeNOW API claims transaction completed but never sent funds

SETUP:
1. User requests swap: 1000 USDT → TBC via ChangeNOW
2. ChangeNOW API returns: {status: "completed", txHash: "0xfake"}
3. Merchant API receives webhook from ChangeNOW
4. NO on-chain TBC transfer occurred

EXPECTED RESULT:
❌ Merchant API does NOT credit user balance
✅ On-chain confirmation check FAILS (no jetton transfer event)
✅ User balance unchanged until blockchain confirms

VERIFICATION:
- Merchant API must query blockchain, not trust external API
- Webhook signature verified but still requires on-chain check
```

#### Test 2: API Response MITM Attack
```
SCENARIO: Attacker intercepts ChangeNOW API call and injects fake response

SETUP:
1. User → Merchant API → ChangeNOW API
2. Attacker intercepts HTTPS (via compromised certificate)
3. Returns fake: {status: "completed", amount: 10000 TBC}

EXPECTED RESULT:
⚠️ Merchant API may display "pending" status (informational)
❌ Funds NOT credited without on-chain confirmation
✅ Final settlement requires blockchain verification

MITIGATION:
- Certificate pinning (optional)
- On-chain confirmation mandatory
- Display "unconfirmed" until blockchain confirms
```

#### Test 3: Webhook Spoofing
```
SCENARIO: Attacker sends fake webhook to Merchant API

SETUP:
1. Attacker discovers Merchant API webhook endpoint
2. Sends POST request: {
     event: "payment_completed",
     invoice_id: "12345",
     amount: 1000,
     signature: "fake_signature"
   }

EXPECTED RESULT:
❌ Webhook rejected (invalid signature)
✅ Merchant API verifies HMAC signature using shared secret
✅ Even if signature valid, on-chain confirmation required

MITIGATION CODE:
```typescript
function verifyWebhook(payload, signature, secret) {
    const expected = hmac_sha256(payload, secret);
    if (signature !== expected) {
        throw new Error('Invalid webhook signature');
    }

    // STILL require on-chain confirmation
    const onChain = await blockchain.getTransaction(payload.txHash);
    if (!onChain) {
        throw new Error('Transaction not confirmed on-chain');
    }
}
```
```

#### Test 4: NOWPayments Payment Status Manipulation
```
SCENARIO: Attacker modifies payment status in transit

SETUP:
1. Customer initiates payment via NOWPayments
2. Actual status: "pending"
3. Attacker modifies API response to: "confirmed"

EXPECTED RESULT:
⚠️ UI may show "confirmed" temporarily
❌ Goods NOT shipped until blockchain confirms
✅ Merchant checks blockchain before finalizing

MERCHANT SAFETY:
```typescript
async function checkPaymentStatus(invoice_id) {
    // 1. Query NOWPayments API (untrusted)
    const apiStatus = await nowPayments.getStatus(invoice_id);

    // 2. Query blockchain (source of truth)
    const txHash = await db.getTransactionHash(invoice_id);
    const onChainConfirmed = await blockchain.isConfirmed(txHash);

    // 3. Only trust blockchain
    return {
        apiStatus: apiStatus,  // Informational only
        actualStatus: onChainConfirmed ? 'confirmed' : 'pending'
    };
}
```
```

#### Test 5: Double-Spend via External Gateway
```
SCENARIO: Attacker exploits external gateway's confirmation process

SETUP:
1. Attacker deposits 100 USDT to ChangeNOW
2. ChangeNOW swaps to TON and sends to user's TBC wallet
3. Attacker initiates chargeback/reversal on USDT deposit

EXPECTED RESULT:
✅ TBC already received on-chain (irreversible)
⚠️ ChangeNOW may ban attacker
⚠️ ChangeNOW absorbs loss (not protocol's problem)

PROTOCOL SAFETY:
- On-chain transfers are final
- External gateway risk is their problem
- Protocol is non-custodial (no liability)
```

#### Test 6: Delayed Settlement Attack
```
SCENARIO: External adapter delays settlement to manipulate prices

SETUP:
1. User requests swap: TON → TBC at rate 1:500
2. ChangeNOW delays swap execution by 1 hour
3. TBC price drops 10% during delay
4. ChangeNOW executes swap at worse rate

EXPECTED RESULT:
⚠️ User receives less TBC than expected
✅ Protocol unaffected (swap rate is external concern)
❌ No on-chain protection possible

MITIGATION:
- Use multiple gateways for competition
- Display "estimated arrival" times
- User can cancel if taking too long (via gateway's cancellation process)
```

#### Test 7: CoinRabbit Price Oracle Manipulation (Future)
```
SCENARIO: Attacker manipulates price feed for collateral valuation

SETUP:
1. Lending protocol queries CoinRabbit for TBC/USD price
2. Attacker compromises oracle or executes flash loan attack
3. Oracle reports TBC = $10 (actual: $0.10)
4. Attacker takes out loan with inflated collateral value

EXPECTED RESULT (PLANNED MITIGATIONS):
❌ Loan request rejected (oracle deviation exceeds threshold)
✅ Use time-weighted average price (TWAP)
✅ Aggregate multiple price sources
✅ Conservative collateralization ratios

CURRENT STATUS: Lending not implemented (Future Issue)
```

---

## File: `admin-key-compromise.spec.ts`

### Test Suite: T8 - Admin Key Compromise

#### Test 1: Admin Emergency Pause Attack
```
SCENARIO: Compromised admin key used to pause protocol (DoS)

SETUP:
1. Attacker gains access to admin_address private key
2. Sends op::set_paused(1) to Payment Hub
3. All users attempt to use protocol

EXPECTED RESULT:
✅ Pause succeeds (attacker has valid admin key)
❌ All protocol operations fail with error::contract_paused
⚠️ Protocol DoS until admin unpause or governance intervention

SEVERITY: CRITICAL (R-CRIT-2)

IMPACT:
- Users cannot send or receive TBC via Payment Hub
- Direct jetton transfers still work (bypass)
- Non-custodial: Funds NOT at risk, only availability

MITIGATION REQUIRED: Multi-sig admin (3-of-5)
```

#### Test 2: Mass Account Flagging
```
SCENARIO: Attacker uses admin key to flag all high-value accounts

SETUP:
1. Identify top 100 accounts by balance
2. Use compromised admin key to send op::account_flagged for each
3. Attempt to create protocol-wide censorship

EXPECTED RESULT:
✅ Flagging succeeds (valid admin key)
❌ All flagged accounts blocked from sending
⚠️ Effective censorship attack

SEVERITY: CRITICAL

MITIGATION REQUIRED:
- Multi-sig admin
- Rate limiting (max 10 flags per day)
- DAO governance for flags
```

#### Test 3: Admin Fund Theft Attempt
```
SCENARIO: Compromised admin attempts to steal user funds

SETUP:
1. Attacker has admin_address private key
2. Attempts to send transaction: transfer 1000 TBC from User A to Attacker

EXPECTED RESULT:
❌ NO such function exists
✅ Admin has NO fund transfer capabilities
✅ Invariant I3 preserved (No Admin Fund Control)

VERIFICATION:
```func
// payment-hub.fc - Audit all functions
// CONFIRM: No admin_withdraw, no emergency_drain, no privileged_transfer
```

INVARIANT STATUS: ✅ CRITICAL INVARIANT HOLDS even with admin compromise
```

#### Test 4: Risk Authority Key Compromise
```
SCENARIO: Attacker steals risk_authority key from Account Locks

SETUP:
1. Compromise risk_authority private key
2. Send op::set_fraud_lock on competitor merchant accounts
3. Disrupt competing businesses

EXPECTED RESULT:
✅ Lock succeeds (valid authority key)
❌ Merchant accounts blocked from sending
⚠️ Business disruption attack

SEVERITY: HIGH

MITIGATION:
- Multi-sig risk authority
- Fraud lock requires evidence submission (future)
- Appeal process via DAO
```

#### Test 5: Lending Adapter Key Compromise
```
SCENARIO: Attacker compromises lending_adapter key

SETUP:
1. Steal lending_adapter private key
2. Set COLLATERAL_LOCK on random accounts
3. Claim accounts are collateral for fake loans

EXPECTED RESULT:
✅ Locks succeed (valid adapter key)
❌ Innocent users cannot send TBC
⚠️ False collateral locks

SEVERITY: MEDIUM (collateral locks are for specific use case)

MITIGATION:
- Lending adapter should be smart contract (not EOA)
- Collateral locks tied to verifiable loan contracts
```

#### Test 6: Unauthorized Admin Change Attempt
```
SCENARIO: Attacker tries to change admin address

SETUP:
1. Compromised admin key
2. Attempts to call set_admin(new_admin_address)

EXPECTED RESULT:
❌ Function does NOT exist
✅ Admin address is immutable after deployment
✅ No upgrade mechanism

CODE VERIFICATION:
```func
// payment-hub.fc - Confirm NO admin update function
// Admin set in deploy, never changed
```
```

#### Test 7: Admin Pause and Unpause Race
```
SCENARIO: Multiple admins in multi-sig scenario (future)

SETUP:
1. Admin1 pauses contract
2. Admin2 immediately unpauses
3. Admin1 pauses again
4. Rapid pause/unpause toggling

EXPECTED RESULT (CURRENT):
✅ Last transaction wins (single admin)

EXPECTED RESULT (AFTER MULTI-SIG):
⚠️ Requires majority vote for pause
✅ Cannot toggle without consensus
✅ Time-lock prevents rapid changes

MITIGATION: Multi-sig with time-lock governance
```

#### Test 8: Admin Key Rotation (Not Implemented)
```
SCENARIO: Admin attempts to rotate compromised key

SETUP:
1. Admin key compromised
2. Legitimate admin tries to rotate to new key
3. Attacker races to use old key

EXPECTED RESULT (CURRENT):
❌ Key rotation NOT supported
⚠️ No recovery mechanism

RECOMMENDED FEATURE:
```func
// Future implementation
const int KEY_ROTATION_DELAY = 86400 * 7;  // 7 days

() propose_admin_rotation(slice new_admin) {
    rotation_proposed_at = now();
    proposed_new_admin = new_admin;
}

() finalize_admin_rotation() {
    throw_unless(err, now() - rotation_proposed_at > KEY_ROTATION_DELAY);
    admin_address = proposed_new_admin;
}
```
```

#### Test 9: Multi-Contract Admin Consistency
```
SCENARIO: Different admins across Payment Hub and Account Locks

SETUP:
1. Payment Hub admin = Address A
2. Account Locks risk_authority = Address B
3. Verify coordination between contracts

EXPECTED RESULT:
⚠️ No automatic synchronization
✅ Each contract manages own authority
⚠️ Risk of inconsistent governance

RECOMMENDATION:
- Deploy all contracts with same multi-sig admin
- Shared governance contract for all protocol components
```

---

## File: `invariant-tests.spec.ts`

### Test Suite: Protocol Invariant Verification

This test suite directly verifies the 7 core invariants from Issue #18.

#### Invariant I1: Non-Custodial Ownership

**Test 1.1: Admin Cannot Move User Funds**
```
SETUP: User has 1000 TBC, admin has full contract access

TEST: Admin attempts all possible operations to move user funds

EXPECTED: ✅ NO operation allows admin to transfer user TBC

VERIFICATION: Audit all contract functions, confirm none allow admin fund movement
```

**Test 1.2: User Maintains Custody During All Operations**
```
SETUP: User performs 100 random operations (transfers, locks, etc.)

TEST: Query fund custody at each step

EXPECTED: ✅ User's TBC always in user's jetton wallet (never in contract custody)
```

#### Invariant I2: NFT = Account Authority

**Test 2.1: NFT Transfer = Authority Transfer**
```
SETUP:
1. Alice owns NFT #7777001 with 1000 TBC
2. Transfer NFT to Bob
3. Bob attempts to send TBC

EXPECTED: ✅ Bob has full authority over account
```

**Test 2.2: No Secondary Ownership Mechanisms**
```
SETUP: Audit all contracts for authority checks

TEST: Verify ONLY NFT ownership grants authority

EXPECTED: ✅ No admin override, no delegate mechanisms, no proxy authority
```

#### Invariant I3: No Admin Fund Control

**Test 3.1: Exhaustive Admin Function Audit**
```
SETUP: List all admin-privileged functions across all contracts

TEST: Attempt fund movement via each function

EXPECTED: ✅ ZERO functions allow admin to transfer user funds

AUDIT:
- Payment Hub: handle_set_paused (state only)
- Payment Hub: handle_flag_account (flag only)
- Account Locks: set_fraud_lock (flag only)
- Account Locks: set_collateral_lock (flag only)

RESULT: ✅ All admin functions are NON-CUSTODIAL
```

**Test 3.2: Admin Compromise Worst Case**
```
SETUP: Attacker has ALL admin keys (payment hub, account locks, etc.)

TEST: Attempt to steal 1 nanoTBC from any user

EXPECTED: ❌ IMPOSSIBLE - no code path exists
```

#### Invariant I4: Atomic Transfers

**Test 4.1: Transfer Success = Complete Operation**
```
SETUP: Transfer 500 TBC from A to B

TEST: If transfer succeeds, verify both debit and credit occurred

EXPECTED: ✅ A debited 500, B credited 500, no intermediate state
```

**Test 4.2: Transfer Failure = No State Change**
```
SETUP: Attempt invalid transfer (insufficient balance)

TEST: Verify NO partial debit or credit

EXPECTED: ✅ Both accounts unchanged
```

**Test 4.3: Mid-Flight Atomic Guarantee**
```
SETUP: Transfer in progress, query state during execution (if possible)

EXPECTED: ✅ Cannot observe intermediate state (TON atomicity)
```

#### Invariant I5: Ledger Conservation

**Test 5.1: Total Supply Conservation**
```
SETUP: 1000 random transfers across 100 accounts

TEST: Σ(all balances) before and after

EXPECTED: ✅ Σ(before) = Σ(after) = TBC total supply
```

**Test 5.2: No Phantom Minting**
```
SETUP: Attacker attempts to create TBC via:
- Reentrancy
- Integer overflow
- Desync between Payment Hub and jetton

EXPECTED: ❌ All attempts fail, supply unchanged
```

**Test 5.3: No Accidental Burning**
```
SETUP: Send TBC to invalid/closed/non-existent account

EXPECTED: ❌ Transfer fails, TBC not burned
```

#### Invariant I6: Lock ≠ Confiscation

**Test 6.1: Locked Account Still Owns Funds**
```
SETUP:
1. Account A has 1000 TBC
2. Set FRAUD_LOCK on Account A

TEST: Query jetton wallet ownership

EXPECTED: ✅ TBC still in Account A's jetton wallet (not moved to escrow)
```

**Test 6.2: Locks Are Reversible**
```
SETUP: Set all lock types, then clear all lock types

EXPECTED: ✅ Account returns to normal operation, funds never at risk
```

**Test 6.3: Receiving Always Allowed**
```
SETUP: Account with FRAUD_LOCK and COLLATERAL_LOCK

TEST: Send TBC to locked account

EXPECTED: ✅ Transfer succeeds, account can receive
```

#### Invariant I7: External Adapter Isolation

**Test 7.1: External API Cannot Trigger Transfers**
```
SETUP:
1. Mock external API (ChangeNOW)
2. External API sends: "credit 1000 TBC to user"

TEST: Attempt to credit without on-chain jetton transfer

EXPECTED: ❌ NO credit, only on-chain events matter
```

**Test 7.2: External Service Downtime Has No Impact**
```
SETUP:
1. Disable all external APIs (ChangeNOW, NOWPayments, etc.)
2. Attempt internal transfers via Payment Hub

EXPECTED: ✅ Internal operations continue normally
```

**Test 7.3: Malicious External Adapter**
```
SETUP:
1. External adapter sends false data:
   - Fake payment confirmations
   - Wrong amounts
   - Invalid signatures

TEST: Verify protocol ignores false data

EXPECTED: ✅ Only on-chain confirmation triggers state changes
```

---

## Implementation Priority

### Phase 1: Critical Security Tests (Week 1)
1. `invariant-tests.spec.ts` - Verify core guarantees
2. `lock-bypass-attempts.spec.ts` - Test R-CRIT-1 vulnerability
3. `admin-key-compromise.spec.ts` - Test R-CRIT-2 vulnerability

### Phase 2: High-Risk Threat Vectors (Week 2)
4. `nft-race-conditions.spec.ts` - T1 coverage
5. `ledger-conservation.spec.ts` - T3 coverage
6. `merchant-payment-abuse.spec.ts` - T5 coverage

### Phase 3: Medium-Risk Vectors (Week 3)
7. `reentrancy-attempts.spec.ts` - T2 coverage
8. `external-adapter-exploits.spec.ts` - T6 coverage

---

## Continuous Integration

### CI Pipeline Integration

```yaml
# .github/workflows/adversarial-tests.yml
name: Adversarial Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx blueprint test tests/adversarial/
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  # Fail CI if critical vulnerabilities detected
  critical-vulns:
    runs-on: ubuntu-latest
    steps:
      - run: npx blueprint test tests/adversarial/lock-bypass-attempts.spec.ts
      - run: npx blueprint test tests/adversarial/admin-key-compromise.spec.ts
    # Expected to FAIL until R-CRIT-1 and R-CRIT-2 fixed
    continue-on-error: true  # Temporarily allow failures
```

---

## Test Coverage Goals

- **Line Coverage**: >90% for security-critical contracts
- **Branch Coverage**: 100% for all validation logic
- **Attack Vector Coverage**: 100% (all 8 threat classes)
- **Invariant Coverage**: 100% (all 7 invariants)

---

## Document Status

✅ **Specifications Complete**
🔧 **Implementation Pending**
⚠️ **2 Critical Vulnerabilities Documented** (R-CRIT-1, R-CRIT-2)

**Next Steps:**
1. Implement test files using Blueprint/Sandbox framework
2. Fix R-CRIT-1 (Payment Hub lock integration)
3. Plan R-CRIT-2 mitigation (multi-sig governance)
4. Achieve 100% adversarial test coverage
