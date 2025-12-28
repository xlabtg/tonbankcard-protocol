# TONBANKCARD Protocol — Formal Invariants & Guarantees

**Document Type:** Security Foundation
**Status:** Formal Specification
**Issue Reference:** [#18 - Issue 4.1 Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
**Last Updated:** 2025-12-27

---

## Purpose

This document defines the **core invariants and guarantees** of the TONBANKCARD protocol. These invariants are non-negotiable rules that must always hold true across all smart contracts, adapters, and future extensions.

These invariants form the basis for:
- Security audits
- Formal verification
- Governance decisions
- Ecosystem integrations

**Any violation of these invariants represents a critical security vulnerability.**

---

## Core Protocol Invariants

### I1 — Non-Custodial Ownership

**Statement:**
> At no point may the protocol take custody of user funds, move funds without explicit user-initiated transactions, or override NFT ownership.

**Formal Definition:**
```
∀ transaction T, ∀ user U:
  IF T transfers funds from U's account
  THEN T MUST be signed by U (the NFT owner)
  AND T MUST be initiated by U
  AND no protocol admin/operator can initiate T on behalf of U
```

**Guaranteed Properties:**
- The owner of the NFT account is the sole authority over the associated on-chain balance
- No smart contract can move funds without the NFT owner's explicit signature
- No backend service can initiate fund transfers
- No external adapter can trigger fund movement

**Implementation Requirements:**
1. All transfer functions MUST verify `msg.sender == NFT_owner`
2. No admin override functions are permitted
3. No proxy delegation to third parties for fund movement
4. Backend services are read-only

**Contract Mapping:**
- `PaymentHub.tact`: Verifies ownership in `TransferInternalRequest` handler (line 164)
- `MerchantPaymentHub.tact`: Validates payer ownership before settlement (lines 90-96)
- `account-locks.fc`: Lock mechanisms do not move funds, only restrict operations

**Test Coverage:**
- `tests/invariants/I1-non-custodial-ownership.spec.ts`
- Negative test: Attempt transfer from non-owner account
- Negative test: Admin attempting to move user funds

---

### I2 — NFT = Account Authority

**Statement:**
> Each NFT represents exactly one account. Account control is transferred only via NFT transfer. No secondary ownership mechanisms are allowed.

**Formal Definition:**
```
∀ NFT n, ∀ account a:
  account_authority(a) = NFT_owner(n)
  AND ∀ time t1, t2 where t2 > t1:
    IF NFT_owner(n, t1) ≠ NFT_owner(n, t2)
    THEN account_authority(a, t2) = NFT_owner(n, t2)
```

**Guaranteed Properties:**
- NFT ownership is the single source of truth for account authority
- Account control transfers atomically with NFT ownership transfer
- No separate "authorized users" or "delegates" with fund control
- No multi-signature override without multi-sig NFT ownership

**Implementation Requirements:**
1. Always query current NFT owner on-chain before operations
2. No cached ownership records for fund control decisions
3. NFT transfer automatically updates account authority
4. No separate authorization layer

**Contract Mapping:**
- `PaymentHub.tact`: Uses `owner` field from `AccountState` (line 36)
- `MerchantPaymentHub.tact`: Stores and validates NFT owners (lines 42, 90-96)
- `nft_account_resolver.fc`: Resolves NFT ownership as authority source (lines 61-69)

**Test Coverage:**
- `tests/invariants/I2-nft-account-authority.spec.ts`
- Test: NFT transfer updates account authority
- Negative test: Previous owner cannot transact after NFT transfer

---

### I3 — No Admin Fund Control

**Statement:**
> The protocol must not contain admin withdrawals, emergency drains, privileged fund movement, or hidden upgrade paths.

**Formal Definition:**
```
∀ role R in [admin, deployer, operator, risk_authority, lending_adapter]:
  ∀ account A:
    R CANNOT initiate fund transfer from A
    R CANNOT withdraw from A
    R CANNOT modify balance(A) except through user-initiated transfers
    R CANNOT upgrade contracts to bypass these restrictions
```

**Guaranteed Properties:**
- No role other than the NFT owner can initiate fund transfers
- Admin roles (deployer, risk authority, lending adapter) can only set flags/states
- No emergency withdrawal functions exist
- No upgradeable proxies that could bypass these rules
- Development/testing admin functions MUST be removed before production

**Implementation Requirements:**
1. Admin roles limited to non-financial operations:
   - Risk authority: Set/clear fraud locks only
   - Lending adapter: Set/clear collateral locks only
   - Deployer: Initialize accounts (testing only, must be removed)
2. No `onlyAdmin` functions that move funds
3. No upgradeable proxy patterns
4. All contracts are immutable after deployment

**Contract Mapping:**
- `PaymentHub.tact`: `deployer` can only `InitializeAccount` (testing only, lines 229-240)
- `account-locks.fc`: Risk authority sets locks, NOT moves funds (lines 160-217)
- `MerchantPaymentHub.tact`: Admin setup functions are test-only (lines 223-245)

**Test Coverage:**
- `tests/invariants/I3-no-admin-fund-control.spec.ts`
- Negative test: Admin cannot withdraw user funds
- Negative test: Risk authority cannot move funds
- Negative test: Deployer cannot drain account balances
- Code audit: Verify no admin override in fund transfer paths

---

### I4 — Atomic Transfers

**Statement:**
> All internal transfers must be atomic, fully settled or reverted, and free from intermediate states.

**Formal Definition:**
```
∀ transfer T from account A to account B with amount X:
  EITHER:
    (balance(A) = balance(A)_before - X) AND
    (balance(B) = balance(B)_before + X) AND
    (T.status = SUCCESS)
  OR:
    (balance(A) = balance(A)_before) AND
    (balance(B) = balance(B)_before) AND
    (T.status = REVERTED)
```

**Guaranteed Properties:**
- A transfer either completes fully or does not occur at all
- No partial balance updates
- No intermediate states where funds are "in flight"
- Reentrancy protection ensures atomicity

**Implementation Requirements:**
1. Use transaction revert on any validation failure
2. Update both sender and receiver balances in same transaction
3. Implement reentrancy guards
4. No asynchronous balance updates

**Contract Mapping:**
- `PaymentHub.tact`: Atomic balance update (lines 196-202), reentrancy guard (lines 121, 149-150)
- `MerchantPaymentHub.tact`: Atomic debit/credit (lines 134-135)

**Test Coverage:**
- `tests/invariants/I4-atomic-transfers.spec.ts`
- Test: Successful transfer updates both balances atomically
- Test: Failed transfer leaves both balances unchanged
- Test: Reentrancy attempt is blocked

---

### I5 — Ledger Conservation

**Statement:**
> Internal ledger operations must satisfy: Σ(balances before) = Σ(balances after), except for protocol-defined fees (if any) or explicitly defined mint/burn logic.

**Formal Definition:**
```
∀ transaction T:
  Σ(all_balances_after(T)) = Σ(all_balances_before(T)) - fees(T) - burns(T) + mints(T)

WHERE:
  fees(T) = 0 for internal TBC transfers (zero-fee guarantee)
  burns(T) = 0 (no burn mechanism in current protocol)
  mints(T) = 0 (no mint mechanism in payment hub)
```

**Guaranteed Properties:**
- Total TBC in the system is conserved during transfers
- No funds can be created or destroyed during transfers
- Internal transfers have zero fees
- Balance sum is an invariant across all operations

**Implementation Requirements:**
1. Every debit MUST have a corresponding credit of equal amount
2. No rounding errors or precision loss
3. No hidden fees deducted from transfers
4. Explicit tracking of any future fee mechanisms

**Contract Mapping:**
- `PaymentHub.tact`: Direct balance arithmetic (lines 197-198)
- `MerchantPaymentHub.tact`: Symmetric debit/credit (lines 178-187)

**Test Coverage:**
- `tests/invariants/I5-ledger-conservation.spec.ts`
- Test: Sum of balances unchanged after transfer
- Test: Multiple concurrent transfers preserve total supply
- Test: Self-transfer does not create/destroy funds

---

### I6 — Lock ≠ Confiscation

**Statement:**
> Account locks prevent outgoing transfers, do NOT seize or move funds, and are reversible.

**Formal Definition:**
```
∀ account A, ∀ lock L in [FRAUD_LOCK, COLLATERAL_LOCK]:
  IF is_locked(A, L) THEN:
    can_send(A) = FALSE
    can_receive(A) = TRUE
    balance(A) = unchanged
    owner(A) = unchanged
    ∃ authorized_role R: R can clear_lock(A, L)
```

**Guaranteed Properties:**
- Locks restrict actions, not ownership
- Locked accounts can still receive funds
- Locks do not transfer or freeze funds to protocol custody
- All locks are reversible by appropriate authority
- Lock operations emit auditable events

**Implementation Requirements:**
1. Lock operations MUST NOT modify account balances
2. Receiving operations MUST remain functional when locked
3. Lock state is stored separately from balance/ownership
4. Lock/unlock operations emit events for transparency

**Contract Mapping:**
- `account-locks.fc`: Lock operations don't touch balances (lines 100-110, 160-217)
- `account-locks.fc`: `can_receive()` always returns true (lines 94-98)
- `MerchantPaymentHub.tact`: Checks locks before send, not receive (lines 116-119)

**Test Coverage:**
- `tests/invariants/I6-lock-not-confiscation.spec.ts`
- Test: Fraud lock prevents sending, allows receiving
- Test: Collateral lock prevents sending, allows receiving
- Test: Lock does not change balance
- Test: Lock can be reversed by authorized party
- Negative test: Lock cannot seize funds

---

### I7 — External Adapter Isolation

**Statement:**
> External providers cannot trigger transfers, cannot bypass protocol rules, and can only interact through explicit user actions.

**Formal Definition:**
```
∀ external_adapter E in [ChangeNOW, NOWPayments, CoinRabbit, TONCO]:
  ∀ protocol_operation O:
    E CANNOT directly invoke O
    E CANNOT bypass validation rules of O
    IF E participates in O THEN:
      O MUST be initiated by user U
      O MUST follow all invariants I1-I6
```

**Guaranteed Properties:**
- External providers have no direct smart contract access
- All external interactions are mediated by user wallets
- Backend APIs orchestrate but don't execute transfers
- External adapters are read-only from protocol perspective

**Implementation Requirements:**
1. No external adapter addresses in smart contract authorization
2. Backend services orchestrate user-signed transactions only
3. External adapters interact with user wallets, not protocol contracts
4. DEX interactions are user-initiated swaps

**Contract Mapping:**
- `account-locks.fc`: Only `risk_authority` and `lending_adapter` have special roles, and they cannot move funds
- No external adapter addresses in Payment Hub contracts
- All transfers require NFT owner signature

**Test Coverage:**
- `tests/invariants/I7-external-adapter-isolation.spec.ts`
- Test: External services cannot initiate transfers
- Test: All transfers require valid user signature
- Architectural review: No external adapter privileged access

---

## Invariant Violation Response

If any invariant is violated (detected through testing, audit, or production monitoring):

1. **CRITICAL SEVERITY**: All invariant violations are critical
2. **IMMEDIATE HALT**: Affected operations must be stopped
3. **INCIDENT RESPONSE**: Follow security incident protocol
4. **ROOT CAUSE ANALYSIS**: Full investigation required
5. **FIX VERIFICATION**: Must demonstrate invariant restoration
6. **AUDIT REVIEW**: Security audit of fix before deployment

---

## Audit Checklist

For auditors reviewing the TONBANKCARD protocol:

### I1 — Non-Custodial Ownership
- [ ] All fund transfers verify NFT ownership
- [ ] No admin override for fund movement
- [ ] Backend services are read-only
- [ ] No custody mechanisms exist

### I2 — NFT = Account Authority
- [ ] NFT ownership is queried on-chain for each operation
- [ ] No cached ownership for authorization
- [ ] No secondary authorization mechanisms
- [ ] Account control transfers with NFT

### I3 — No Admin Fund Control
- [ ] No admin withdrawal functions
- [ ] Admin roles limited to non-financial operations
- [ ] No upgradeable proxies
- [ ] Test-only admin functions documented for removal

### I4 — Atomic Transfers
- [ ] Balance updates are atomic
- [ ] Reentrancy protection implemented
- [ ] No intermediate states
- [ ] Failed transfers fully revert

### I5 — Ledger Conservation
- [ ] Every debit has equal credit
- [ ] No hidden fees
- [ ] Total balance sum is preserved
- [ ] No rounding errors

### I6 — Lock ≠ Confiscation
- [ ] Locks don't modify balances
- [ ] Locked accounts can receive
- [ ] Locks are reversible
- [ ] Lock events are emitted

### I7 — External Adapter Isolation
- [ ] No external adapter direct contract access
- [ ] All operations user-initiated
- [ ] No bypass mechanisms
- [ ] Backend is orchestration-only

---

## Invariant-to-Contract Mapping

| Invariant | PaymentHub.tact | MerchantPaymentHub.tact | account-locks.fc | nft_account_resolver.fc |
|-----------|----------------|------------------------|------------------|------------------------|
| **I1: Non-Custodial** | Lines 164 (owner check) | Lines 90-96 (owner validation) | N/A (no fund control) | Lines 61-69 (ownership) |
| **I2: NFT Authority** | Line 36 (owner field) | Lines 42, 90-96 | N/A | Lines 61-69 |
| **I3: No Admin Control** | Lines 229-240 (test only) | Lines 223-245 (test only) | Lines 160-217 (lock only) | N/A |
| **I4: Atomic** | Lines 149-150, 196-202 | Lines 134-135 | N/A | N/A |
| **I5: Conservation** | Lines 197-198 | Lines 178-187 | N/A | N/A |
| **I6: Lock ≠ Confiscate** | N/A | Lines 116-119 | Lines 94-98, 100-110 | N/A |
| **I7: Adapter Isolation** | Entire contract | Entire contract | Lines 36-43 (no external) | N/A |

---

## Test Suite Summary

Comprehensive test coverage for all invariants:

### Unit Tests
- `tests/invariants/I1-non-custodial-ownership.spec.ts`
- `tests/invariants/I2-nft-account-authority.spec.ts`
- `tests/invariants/I3-no-admin-fund-control.spec.ts`
- `tests/invariants/I4-atomic-transfers.spec.ts`
- `tests/invariants/I5-ledger-conservation.spec.ts`
- `tests/invariants/I6-lock-not-confiscation.spec.ts`
- `tests/invariants/I7-external-adapter-isolation.spec.ts`

### Negative Tests (Attempted Violations)
Each invariant test file includes negative test cases that attempt to violate the invariant and verify the violation is prevented.

---

## Governance & Protocol Evolution

### Invariant Changes
These invariants are **foundational** to the protocol. Any future Issue, PR, or governance proposal that violates them must:

1. **Explicitly declare the violation** in the Issue/PR description
2. **Undergo protocol-level review** by security team
3. **Receive explicit governance approval** (future DAO mechanism)
4. **Update this document** with the new invariant definition
5. **Pass full audit** before deployment

### Acceptable Changes
Changes that **do not** violate invariants and are acceptable without governance:
- Additional validation rules (more restrictive)
- New lock types (following I6 pattern)
- Performance optimizations (preserving semantics)
- Additional getter functions (read-only)
- Event additions (non-state-changing)

### Prohibited Changes
Changes that **always** violate invariants and are prohibited:
- Admin fund withdrawal mechanisms
- Custody of user funds
- Non-atomic transfers
- Hidden fees or balance manipulation
- NFT ownership bypass mechanisms
- Irreversible confiscation locks

---

## References

- **Architecture**: [docs/architecture.md](./architecture.md)
- **Payment Hub**: [contracts/payments/README.md](../contracts/payments/README.md)
- **Account Locks**: [contracts/payments/ACCOUNT_LOCKS.md](../contracts/payments/ACCOUNT_LOCKS.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Issue #18**: [Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)

---

## Document Maintenance

**Responsibility**: Protocol Security Team
**Review Frequency**: Before each major release
**Update Triggers**:
- New smart contract deployment
- Protocol architecture changes
- Security audit findings
- Governance decisions

**Version History**:
- v1.0 (2025-12-27): Initial formal specification (Issue #18)

---

**Built on TON. Secured by Invariants. Owned by Users.**
