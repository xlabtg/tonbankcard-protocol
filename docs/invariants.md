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

## Proof Status

Each invariant is backed by one or more of the following layers:

1. **Property-based tests** — randomised TypeScript model in
   `tests/invariants/property/` driven by `fast-check`. These are the
   **authoritative** machine-checked statements of I1–I7 and run on every
   pull request via the `test-invariants` CI job. See
   [Test Tooling](#test-tooling) below for how to run them.
2. **Adversarial unit tests** — deterministic attack scenarios for I4 and
   I7 in `tests/invariants/property/I4-adversarial.spec.ts` and
   `tests/invariants/property/I7-adversarial.spec.ts`.
3. **Bounded TLA+ model** — formal state-machine model in
   `docs/formal-verification/Protocol.tla` checked by TLC against the
   configuration in `Protocol.cfg`. This is a stretch-goal artifact (see
   [Issue #114](https://github.com/xlabtg/tonbankcard-protocol/issues/114))
   for documentation and explorability; the TypeScript property tests are
   authoritative.
4. **On-chain contract enforcement** — the production Tact / FunC contracts
   referenced in each invariant's "Contract Mapping" subsection.

| Invariant | Property tests | Adversarial tests | TLA+ predicate | Status |
| --------- | -------------- | ----------------- | -------------- | ------ |
| I1 — Non-Custodial Ownership      | `property/I1-non-custodial.spec.ts`       | — (covered by I7 adversarial) | `OwnerOnlyTransferInv`     | ✅ enforced |
| I2 — NFT = Account Authority      | `property/I2-nft-authority.spec.ts`       | — | structural (encoded as `owner[nft]`) | ✅ enforced |
| I3 — No Admin Fund Control        | `property/I3-no-admin-fund-control.spec.ts` | — | `AdminCannotMoveFundsInv`  | ✅ enforced |
| I4 — Atomic Transfers             | `property/I4-atomic-transfers.spec.ts`    | `property/I4-adversarial.spec.ts` | `AtomicityInv`             | ✅ enforced |
| I5 — Ledger Conservation          | `property/I5-ledger-conservation.spec.ts` | — | `ConservationInv`          | ✅ enforced |
| I6 — Lock ≠ Confiscation          | `property/I6-lock-not-confiscation.spec.ts` | — | `LockPreservesBalanceInv`  | ✅ enforced |
| I7 — Lock Enforcement / Adapter Isolation | `property/I7-lock-enforcement.spec.ts` | `property/I7-adversarial.spec.ts` | `LockedCannotSendInv`      | ✅ enforced |

### Test Tooling

The property-based suite is a standalone npm project at `tests/invariants/`.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full developer workflow.

```bash
cd tests/invariants
npm install
npm test           # runs all property-based + adversarial tests
npm run typecheck  # validates TypeScript model
```

CI runs both of the above commands on every pull request via the
`test-invariants` job in `.github/workflows/ci.yml`. The full suite is
budgeted to complete in well under 60 seconds; current wall-clock is
≈4 seconds on a clean clone.

The formal-verification stretch goal is in `docs/formal-verification/`:

```bash
cd docs/formal-verification
java -jar tla2tools.jar -deadlock -config Protocol.cfg Protocol.tla
```

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
∀ role R in [admin, operator, risk_authority, lending_adapter]:
  ∀ account A:
    R CANNOT initiate fund transfer from A
    R CANNOT withdraw from A
    R CANNOT modify balance(A) except through user-initiated transfers
    R CANNOT upgrade contracts to bypass these restrictions
    R CAN transfer the admin role to another address only via the two-phase timelock
```

**Guaranteed Properties:**
- No role other than the NFT owner can initiate fund transfers
- Admin roles (admin, risk authority, lending adapter) can only set flags/states
- No emergency withdrawal functions exist
- No upgradeable proxies that could bypass these rules
- Development/testing admin functions MUST be removed before production
- Admin role is transferable but ONLY via two-phase timelock (7-day delay)
- Admin role transfer does NOT affect user fund ownership or balances

**Implementation Requirements:**
1. Admin roles limited to non-financial operations:
   - Admin: Whitelist NFT collections, initialize accounts (testing only)
   - Risk authority: Set/clear fraud locks only
   - Lending adapter: Set/clear collateral locks only
2. No `onlyAdmin` functions that move funds
3. No upgradeable proxy patterns
4. All contracts are immutable after deployment

**Admin Transfer Mechanism (Issue #96):**

To prevent single-point-of-failure from the deployer key and allow migration to DAO/multisig, the `admin` role supports two-phase transferable ownership with a 7-day timelock:

1. **Phase 1 — Propose** (`ProposeAdminTransfer` / `MerchantProposeAdminTransfer`):
   - Only the current admin can call this
   - Records the proposed new admin and a timestamp = `now() + 7 days`
   - Does NOT change admin immediately
2. **Phase 2 — Execute** (`ExecuteAdminTransfer` / `MerchantExecuteAdminTransfer`):
   - Only the proposed new admin can call this
   - Can only execute after the 7-day timelock has elapsed
   - Commits the admin change; clears the pending proposal
3. **Cancel** (`CancelAdminTransfer` / `MerchantCancelAdminTransfer`):
   - Only the current admin can cancel a pending proposal before it executes

The same two-phase timelock pattern applies to `risk_authority` and `lending_adapter` roles in `account-locks.fc` (op codes `0x4001`–`0x4013`).

**Contract Mapping:**
- `PaymentHub.tact`: `admin` field replaces `deployer`; admin transfer via `ProposeAdminTransfer`/`ExecuteAdminTransfer`/`CancelAdminTransfer`
- `MerchantPaymentHub.tact`: Same pattern via `MerchantProposeAdminTransfer`/`MerchantExecuteAdminTransfer`/`MerchantCancelAdminTransfer`
- `account-locks.fc`: `risk_authority` and `lending_adapter` transferable via `op::propose_risk_authority` / `op::execute_risk_authority` / `op::cancel_risk_authority` and equivalents for `lending_adapter`

**Test Coverage:**
- `tests/invariants/I3-no-admin-fund-control.spec.ts`
  - Negative test: Admin cannot withdraw user funds
  - Negative test: Risk authority cannot move funds
  - Negative test: Deployer cannot drain account balances
  - Positive test: Admin can propose a transfer
  - Negative test: Execution before timelock expiry is rejected
  - Positive test: Execution after timelock succeeds; user funds unchanged
  - Negative test: New admin cannot move user funds (I3 preserved post-transfer)
  - Positive test: Admin can cancel a pending transfer
- `tests/admin-transfer/PaymentHub-admin-transfer.spec.ts` — comprehensive admin transfer tests
- `tests/admin-transfer/MerchantPaymentHub-admin-transfer.spec.ts` — comprehensive admin transfer tests

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
- `tests/invariants/property/I4-atomic-transfers.spec.ts` — property-based
  invariant check (300 random runs).
- `tests/invariants/property/I4-adversarial.spec.ts` — deterministic
  adversarial scenarios: replay, race, reentrancy, closed destination,
  mid-flight lock, negative amount.
- `docs/formal-verification/Protocol.tla` — `AtomicityInv` predicate
  (Transfer is a single TLA+ action).

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
- `tests/invariants/property/I7-lock-enforcement.spec.ts` — property-based
  check that locks block sends and that no role outside the NFT owner can
  initiate a transfer.
- `tests/invariants/property/I7-adversarial.spec.ts` — adversarial
  scenarios: wrong-role lock clearing, NFT transfer while locked, replay
  after unlock, collateral-lock isolation.
- `docs/formal-verification/Protocol.tla` — `LockedCannotSendInv` predicate
  (Transfer action is gated on `~ fraud[from] /\ ~ collat[from]`).
- Architectural review: No external adapter privileged access in Payment
  Hub contracts.

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

Comprehensive machine-checked coverage for all invariants. The
**authoritative** layer is the property-based suite under
`tests/invariants/property/`, run on every pull request by the
`test-invariants` CI job.

### Property-Based Invariant Tests (`tests/invariants/property/`)
- `I1-non-custodial.spec.ts` — only NFT owner can debit.
- `I2-nft-authority.spec.ts` — previous owner loses authority after NFT transfer.
- `I3-no-admin-fund-control.spec.ts` — privileged operations never modify balances.
- `I4-atomic-transfers.spec.ts` — every transfer fully applied or reverted (300 runs).
- `I5-ledger-conservation.spec.ts` — sum of balances preserved across any sequence.
- `I6-lock-not-confiscation.spec.ts` — locks do not change balance or ownership.
- `I7-lock-enforcement.spec.ts` — locked accounts cannot send; non-owner roles cannot initiate.

### Adversarial Scenarios (`tests/invariants/property/`)
Deterministic unit tests targeting concrete attack vectors from
`docs/threat-model.md`:
- `I4-adversarial.spec.ts` — replay, race, reentrancy, closed destination,
  mid-flight lock, negative amount.
- `I7-adversarial.spec.ts` — wrong-role lock clearing, NFT transfer while
  locked, replay after unlock, collateral-lock isolation.

### Formal Verification Artifacts (`docs/formal-verification/`)
- `Protocol.tla` — TLA+ state-machine model encoding I1, I3, I4, I5, I6, I7
  as named invariants (`OwnerOnlyTransferInv`, `AdminCannotMoveFundsInv`,
  `AtomicityInv`, `ConservationInv`, `LockPreservesBalanceInv`,
  `LockedCannotSendInv`).
- `Protocol.cfg` — TLC configuration with bounded constants.

### Pre-Existing Stub Specs (`tests/invariants/`)
The flat `I*-*.spec.ts` files at the root of `tests/invariants/` are
legacy aspirational specs that depend on contract wrappers not yet
generated by the Tact build. They are kept as documentation of intended
coverage; the executable, CI-enforced replacement is the
property-based suite above.

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
