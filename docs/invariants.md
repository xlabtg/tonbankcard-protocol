# Tonbankcard Protocol Invariants & Guarantees

## Overview

This document defines the **formal invariants** and **protocol guarantees** that MUST hold true at all times in the Tonbankcard protocol. These invariants form the foundation of security, correctness, and user trust.

**Issue Reference**: [#22 - Audit Readiness Checklist & Scope Definition](https://github.com/xlabtg/tonbankcard-protocol/issues/22)

**Related**: [Issue 4.1 - Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/20)

---

## Core Protocol Invariants

### I1: Non-Custodial Guarantee

**Statement**: The protocol NEVER takes custody of user funds.

**Formal Definition**:
```
∀ user_nft ∈ NFT_Accounts:
  balance(user_nft) is controlled exclusively by owner(user_nft)
  ∧ ∄ admin_function that can withdraw(balance(user_nft)) without user_signature
```

**Enforcement**:
- ✅ No admin withdrawal functions in smart contracts
- ✅ All transfers require NFT owner signature
- ✅ Protocol cannot force transfers
- ✅ No emergency admin fund access

**Violation Consequences**: Complete protocol trust failure

**Test Coverage**: See `MerchantPaymentHub.spec.ts`, `MerchantPaymentLocks.spec.ts`

---

### I2: NFT Ownership = Account Authority

**Statement**: NFT ownership is the ONLY authority for account operations.

**Formal Definition**:
```
∀ operation ∈ {send, withdraw, transfer}:
  authorized(operation, account) ⟺ msg.sender == owner(account.nft)
```

**Enforcement**:
- ✅ Ownership checked at transaction execution time
- ✅ No cached ownership assumptions
- ✅ No alternative authentication paths
- ✅ No admin override mechanisms

**Edge Cases**:
- NFT transfer during pending transaction: Ownership verified atomically per call
- Multiple operations in same block: Each checks current owner independently

**Test Coverage**: See `NFTAccountResolver.spec.ts`

---

### I3: Balance Conservation

**Statement**: The sum of all account balances equals total TBC supply in Payment Hub scope.

**Formal Definition**:
```
∑(balance(nft) for all nft ∈ NFT_Accounts) = constant

∀ internal_transfer(from, to, amount):
  balance(from)_before - amount = balance(from)_after
  ∧ balance(to)_before + amount = balance(to)_after
  ∧ total_supply_before = total_supply_after
```

**Enforcement**:
- ✅ Atomic debit and credit operations
- ✅ No TBC minting in transfer logic
- ✅ No TBC burning in transfer logic
- ✅ Transaction reverts if balance insufficient

**Violation Detection**:
- Audit check: Sum all account balances and verify against expected total
- Test: Mock multiple transfers and verify conservation

**Test Coverage**: See `MerchantPaymentHub.spec.ts`, `MerchantPaymentEdgeCases.spec.ts`

---

### I4: Atomic Transfer Execution

**Statement**: All transfers are atomic - either fully executed or fully reverted.

**Formal Definition**:
```
∀ transfer(from, to, amount):
  (balance(from)_after = balance(from)_before - amount
   ∧ balance(to)_after = balance(to)_before + amount)
  ∨ (balance(from)_after = balance(from)_before
   ∧ balance(to)_after = balance(to)_before)
```

**Enforcement**:
- ✅ TON blockchain atomicity guarantees
- ✅ No partial state updates
- ✅ Explicit error handling with reverts
- ✅ No debit without credit

**Edge Cases**:
- Transaction runs out of gas: All state reverted
- Validation fails mid-execution: All state reverted
- Receiver contract throws: All state reverted (in future external integrations)

**Test Coverage**: See `MerchantPaymentEdgeCases.spec.ts`

---

### I5: Lock Enforcement

**Statement**: Locked accounts CANNOT send TBC but CAN receive TBC.

**Formal Definition**:
```
∀ account ∈ NFT_Accounts:
  (fraud_locked(account) ∨ collateral_locked(account))
  ⟹ can_send(account) = false
  ∧ can_receive(account) = true
```

**Lock Types**:
1. **FRAUD_LOCK**: Prevents sending due to fraud investigation
2. **COLLATERAL_LOCK**: Prevents sending while used as collateral

**Enforcement**:
- ✅ Lock check before all SEND operations
- ✅ Locks enforced at protocol level, not application level
- ✅ No alternative transfer paths bypass locks
- ✅ Receiving is always allowed

**Edge Cases**:
- Multiple locks active: Account locked if ANY lock is active
- NFT transferred with lock: Lock persists with NFT address
- Lock set during pending transfer: Transfer fails atomically

**Test Coverage**: See `MerchantPaymentLocks.spec.ts`, `contracts/payments/tests/account-locks.spec.fc`

---

### I6: Account State Transitions

**Statement**: Account states transition according to strict rules.

**Formal Definition**:
```
State ∈ {ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED}

ACTIVE → {FROZEN, COLLATERAL_LOCKED, CLOSED}  // Valid
FROZEN → {ACTIVE}                             // DAO only (future)
COLLATERAL_LOCKED → {ACTIVE}                  // Lending adapter only (future)
CLOSED → {}                                   // No transitions
```

**Operational Constraints**:
```
state(account) = ACTIVE ⟹ can_send(account) ∧ can_receive(account)
state(account) = FROZEN ⟹ ¬can_send(account) ∧ can_receive(account)
state(account) = COLLATERAL_LOCKED ⟹ ¬can_send(account) ∧ can_receive(account)
state(account) = CLOSED ⟹ ¬can_send(account) ∧ ¬can_receive(account)
```

**Enforcement**:
- ✅ State checked before SEND operations
- ✅ Invalid transitions rejected
- ✅ Authorization required for state changes
- ✅ CLOSED state is terminal

**Test Coverage**: See `MerchantPaymentHub.spec.ts`

---

### I7: No Phantom Balances

**Statement**: Accounts cannot have negative balances or balances exceeding actual TBC holdings.

**Formal Definition**:
```
∀ account ∈ NFT_Accounts:
  balance(account) ≥ 0
  ∧ balance(account) ≤ actual_tbc_holdings(account)
```

**Enforcement**:
- ✅ Unsigned integer types prevent negative balances
- ✅ Insufficient balance check before debit
- ✅ Overflow protection in arithmetic
- ✅ No unchecked balance manipulation

**Violation Detection**:
- Attempt withdrawal with insufficient balance → Transaction reverts
- Integer overflow attempt → TVM built-in protection

**Test Coverage**: See `MerchantPaymentHub.spec.ts` (insufficient balance tests)

---

### I8: Merchant Payment Authorization

**Statement**: Only the payer can authorize payments to merchants.

**Formal Definition**:
```
∀ payMerchant(payer_nft, merchant_nft, amount):
  msg.sender = owner(payer_nft)
  ∧ amount > 0
  ∧ balance(payer_nft) ≥ amount
```

**Enforcement**:
- ✅ Ownership verification required
- ✅ No merchant pull payments without authorization
- ✅ No admin-initiated transfers
- ✅ Positive amount validation

**Merchant Protection**:
- Merchants CANNOT withdraw from user accounts
- Merchants can only receive user-initiated payments
- Payment amounts are user-specified

**Test Coverage**: See `MerchantPaymentHub.spec.ts`, `MerchantPaymentDynamic.spec.ts`

---

### I9: Invoice Uniqueness (Dynamic Payments)

**Statement**: Each invoice can only be paid once per unique identifier.

**Formal Definition**:
```
∀ invoice_id ∈ Invoices:
  ∃! payment_event where payload_hash(payment) = hash(invoice_id)
```

**Enforcement**:
- ✅ Unique payload hash per payment
- ✅ Event emission includes payload hash
- ✅ Off-chain indexing prevents duplicates
- ⚠️ On-chain replay prevention not yet implemented (future enhancement)

**Current Implementation**:
- Invoice uniqueness enforced by merchant backend
- On-chain contract emits events with payload hash for indexing
- Future: On-chain nonce or invoice ID tracking

**Test Coverage**: See `MerchantPaymentDynamic.spec.ts`

---

### I10: External Adapter Isolation

**Statement**: External adapters (ChangeNOW, NOWPayments) CANNOT move funds without user authorization.

**Formal Definition**:
```
∀ adapter ∈ {ChangeNOW, NOWPayments, CoinRabbit}:
  adapter.can_initiate_transfer() = false
  ∧ adapter.signals ≠ authoritative
```

**Enforcement**:
- ✅ Adapters are off-chain integration points
- ✅ Adapters provide quotes and routing only
- ✅ User signs all on-chain transactions
- ✅ No adapter callback authorization

**Trust Boundaries**:
- Adapters trusted for: Quote accuracy, service availability
- Adapters NOT trusted for: Fund custody, transfer execution
- On-chain confirmation required for all settlements

**Integration Pattern**:
```
User → Frontend → Backend API → Adapter (quote)
                           ↓
User → TON Connect → Sign Transaction → Blockchain
```

**Test Coverage**: Not directly tested (integration boundary)

---

### I11: Reentrancy Safety

**Statement**: Contracts are safe from reentrancy attacks.

**Formal Definition**:
```
∀ function f with state_mutation:
  all_state_changes_before(external_calls)
  ∧ no_recursive_invocation_possible
```

**Enforcement**:
- ✅ TON's actor model prevents reentrancy by design
- ✅ No callbacks during critical sections
- ✅ State finalized before external calls
- ✅ Explicit execution order

**TON-Specific Protection**:
- Messages processed sequentially
- No synchronous callbacks
- State committed per transaction

**Test Coverage**: Implicit in TON architecture

---

### I12: Immutable Core Logic

**Statement**: Core protocol contracts are immutable after deployment.

**Formal Definition**:
```
∀ core_contract ∈ {PaymentHub, NFTResolver, AccountStateMachine, AccountLocks}:
  ∄ upgrade_function
  ∧ ∄ admin_logic_override
```

**Enforcement**:
- ✅ No upgradeable proxy patterns
- ✅ No admin setters for critical logic
- ✅ Code is final at deployment
- ✅ Bug fixes require new deployments

**Rationale**: Immutability prevents:
- Admin takeover
- Rug pulls
- Logic manipulation
- Trust erosion

**Exceptions**:
- Configuration parameters may be adjustable (e.g., authority addresses)
- Peripheral adapters may be upgradeable with governance
- Core fund custody logic is always immutable

---

## Operational Invariants

### O1: Gas Efficiency

**Statement**: All operations complete within reasonable gas limits.

**Expected Gas Costs**:
- Internal Transfer: ~0.01 TON
- Merchant Payment: ~0.01 TON
- Account State Query: ~0.005 TON
- Lock Check: ~0.005 TON

**Enforcement**:
- Minimize storage operations
- Optimize data structures
- Early failure on validation errors
- No unbounded loops

---

### O2: Event Emission Completeness

**Statement**: All state mutations emit corresponding events.

**Events**:
- `MerchantPayment`: Emitted on successful merchant payment
- `InternalTransferEvent`: Emitted on internal transfer (future)
- `AccountLocked`: Emitted when lock is set
- `AccountUnlocked`: Emitted when lock is cleared

**Purpose**:
- Off-chain indexing
- Transaction history
- Audit trails
- Real-time monitoring

**Enforcement**:
- ✅ Emit event after successful state change
- ✅ Include all relevant data in event
- ✅ Deterministic event ordering

---

### O3: Read-Only Getters

**Statement**: All getter methods are side-effect-free.

**Formal Definition**:
```
∀ getter ∈ {getBalance, getAccountState, getLockState, canSend, canReceive}:
  state_before_getter = state_after_getter
```

**Enforcement**:
- ✅ Getters marked as view/read-only
- ✅ No state mutations in getters
- ✅ No external calls in getters
- ✅ Deterministic return values

---

## Security Invariants

### S1: Authorization Hierarchy

**Statement**: Each operation has clear authorization requirements.

**Authorization Levels**:
1. **User Operations**: Require NFT ownership
   - Internal transfers
   - Merchant payments
   - Withdrawals

2. **Authority Operations**: Require designated authority
   - Risk Authority: Fraud lock management
   - Lending Adapter: Collateral lock management
   - DAO: State unlocking (future)

3. **Public Operations**: No authorization required
   - Balance queries
   - State queries
   - Lock status queries

**Enforcement**:
- ✅ Explicit authorization checks
- ✅ No privilege escalation paths
- ✅ Clear error messages for unauthorized access

---

### S2: Input Validation

**Statement**: All inputs are validated before processing.

**Validation Rules**:
- Amount > 0 for all transfers
- Valid NFT addresses (non-zero, correct format)
- Sufficient balance before debit
- Valid state transitions
- Authorized sender

**Enforcement**:
- ✅ Require statements for critical checks
- ✅ Early failure on invalid input
- ✅ Explicit error codes
- ✅ No silent failures

---

### S3: Overflow Protection

**Statement**: All arithmetic operations are overflow-safe.

**Enforcement**:
- ✅ TON TVM built-in overflow protection
- ✅ Tact language overflow checks
- ✅ Appropriate integer types (uint128 for balances)
- ✅ Checked arithmetic operations

**Test Cases**:
- Maximum balance value
- Addition overflow attempts
- Subtraction underflow attempts

---

## Invariant Verification

### Automated Testing

Each invariant should have:
1. **Unit Tests**: Test individual invariant in isolation
2. **Integration Tests**: Test invariant across contract interactions
3. **Adversarial Tests**: Attempt to violate invariant
4. **Edge Case Tests**: Test boundary conditions

### Manual Audit Checklist

Auditors should verify:
- [ ] Non-custodial guarantee (I1) - No admin fund access
- [ ] Ownership authority (I2) - Proper authorization checks
- [ ] Balance conservation (I3) - No TBC creation/destruction
- [ ] Atomic execution (I4) - All-or-nothing transfers
- [ ] Lock enforcement (I5) - Locks prevent sending
- [ ] State transitions (I6) - Valid state machine
- [ ] No phantom balances (I7) - Balance integrity
- [ ] Merchant authorization (I8) - User-initiated only
- [ ] Invoice uniqueness (I9) - No replay attacks
- [ ] Adapter isolation (I10) - No unauthorized access
- [ ] Reentrancy safety (I11) - Protected against reentrancy
- [ ] Immutability (I12) - No upgrade paths

### Formal Verification (Future)

Recommended formal verification targets:
1. Balance conservation proof
2. Atomic transfer correctness
3. State machine validity
4. Authorization soundness

---

## Invariant Violations

### Detection

Invariant violations can be detected through:
1. **Automated Tests**: Unit and integration tests
2. **Runtime Assertions**: On-chain require statements
3. **Off-chain Monitoring**: Indexer sanity checks
4. **Audit Reviews**: Manual code inspection
5. **Bug Bounty**: Community-driven testing

### Response

If an invariant is violated:
1. **Immediate**: Identify affected contracts and scope
2. **Containment**: Document violation and impact
3. **Resolution**: Patch via new contract deployment
4. **Migration**: User-initiated migration to fixed contract
5. **Post-Mortem**: Root cause analysis and prevention

### Known Limitations

Current implementation limitations:
- **Invoice Replay**: On-chain replay prevention not yet implemented (enforced off-chain)
- **DAO Unlocking**: FROZEN → ACTIVE transition not yet implemented
- **Lending Adapter**: COLLATERAL_LOCKED → ACTIVE transition not yet implemented
- **NFT Ownership Integration**: Ownership checks in some contracts are documented but not fully enforced

---

## References

- [Issue #22 - Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/22)
- [Issue #20 - Threat Model](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
- [Architecture Documentation](./architecture.md)
- [Contract README](../contracts/README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-27
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.0
