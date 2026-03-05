# TONBANKCARD Protocol — Formal Invariants

**Document Type:** Audit Package
**Issue Reference:** [#55 — Issue 10.2 Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
**Derived From:** [docs/invariants.md](../docs/invariants.md)
**Version:** 1.0
**Status:** FROZEN — Pre-Audit Package
**Last Updated:** 2026-03-05

---

## Purpose

This document defines the seven formal invariants of the TONBANKCARD protocol that must hold under all conditions. Each invariant includes:
- Formal definition
- Contract-to-code mapping (specific file and line references)
- Test coverage reference
- Threat model reference
- Audit checklist item

**Any violation of these invariants is a critical security finding.**

---

## I1 — Non-Custodial Ownership

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
- The NFT owner is the sole authority over the associated on-chain balance
- No smart contract can move funds without the NFT owner's explicit signature
- No backend service can initiate fund transfers
- No external adapter can trigger fund movement

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `PaymentHub.tact` | Line 164 — `validateOwnership()` | `msg.sender == NFT_owner` enforced |
| `MerchantPaymentHub.tact` | Lines 90–96 — `checkOwnership()` | Payer must be current NFT owner |
| `account-locks.fc` | Lines 160–217 | Lock operations do NOT move funds |

**Evidence of Compliance:**
- No `adminWithdraw()` function exists in any contract
- No `emergencyDrain()` function exists
- No `forcedTransfer()` function exists
- Admin functions (`handle_set_paused`, `handle_flag_account`) modify flags only, never balances

**Test Coverage:**
- `tests/invariants/I1-non-custodial-ownership.spec.ts`
- Negative: Attempt transfer from non-owner → must fail
- Negative: Admin attempting to move user funds → must fail

**Threat Model Reference:** T1 (NFT Race), T8 (Admin Key Compromise)

**Audit Checklist:**
- [ ] All fund transfer functions verify `msg.sender == current_NFT_owner`
- [ ] Zero admin fund access functions in entire codebase
- [ ] Backend services are read-only (no signing keys for protocol contracts)
- [ ] No custody mechanism exists

---

## I2 — NFT = Account Authority

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

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `PaymentHub.tact` | Line 36 — `owner` field in `AccountState` | Owner field reflects current NFT owner |
| `MerchantPaymentHub.tact` | Lines 42, 90–96 | `nft_owners` map correctly reflects on-chain state |
| `nft_account_resolver.fc` | Lines 61–69 — `resolve_owner()` | Returns current on-chain NFT owner, no caching |

**Critical Requirement:**
- Always query current NFT owner on-chain before operations
- No cached ownership records for fund control decisions
- NFT transfer automatically updates account authority

**Test Coverage:**
- `tests/invariants/I2-nft-account-authority.spec.ts`
- Test: NFT transfer → account authority updates
- Negative: Previous owner cannot transact after NFT transfer

**Threat Model Reference:** T1 (NFT Race Conditions)

**Audit Checklist:**
- [ ] NFT ownership queried on-chain (not cached) for each operation
- [ ] No secondary authorization mechanisms exist
- [ ] Account authority correctly transfers with NFT
- [ ] Race condition: NFT transferred during pending transaction handled correctly

---

## I3 — No Admin Fund Control

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
- Admin roles can only set flags/states (locks, pauses, blocks)
- No emergency withdrawal functions exist
- No upgradeable proxies
- Development/testing admin functions MUST be removed before production

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `PaymentHub.tact` | Lines 229–240 | `deployer` can only `InitializeAccount` (testing, must be removed) |
| `account-locks.fc` | Lines 160–217 | risk_authority sets locks only, cannot move funds |
| `MerchantPaymentHub.tact` | Lines 223–245 | Admin setup functions are test-only |

**Evidence of Compliance (Must Verify):**
```
Search for: withdraw, drain, emergency, admin_transfer, force_transfer
Expected: ZERO results in fund-moving contexts
```

**Admin Roles and Their Limits:**

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Admin (Payment Hub) | Pause contract, flag accounts | Move funds, upgrade contract |
| risk_authority | Set/clear FRAUD_LOCK | Move funds, set COLLATERAL_LOCK |
| lending_adapter | Set/clear COLLATERAL_LOCK | Move funds, set FRAUD_LOCK |
| deployer | InitializeAccount (test-only) | Move funds |

**Test Coverage:**
- `tests/invariants/I3-no-admin-fund-control.spec.ts`
- Negative: Admin cannot withdraw user funds
- Negative: risk_authority cannot move funds
- Negative: deployer cannot drain account balances
- Code audit: Verify no admin override in fund transfer paths

**Threat Model Reference:** T8 (Admin Key Compromise)

**Audit Checklist:**
- [ ] No admin withdrawal functions in any contract
- [ ] Admin roles limited to non-financial operations only
- [ ] No upgradeable proxy patterns
- [ ] Test-only admin functions identified and planned for removal before mainnet
- [ ] Search result: zero admin fund access functions

---

## I4 — Atomic Transfers

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
- No partial balance updates possible
- No intermediate states where funds are "in flight"
- Reentrancy protection ensures atomicity

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `PaymentHub.tact` | Lines 149–150 — reentrancy guard | `transferLock` prevents concurrent entry |
| `PaymentHub.tact` | Lines 196–202 — `executeTransfer()` | Both balances updated atomically |
| `MerchantPaymentHub.tact` | Lines 134–135 — debit/credit | Atomic payer debit + merchant credit |

**TON Atomicity Guarantee:**
TON's message-passing actor model processes each message as a single atomic transaction. The TVM either commits all state changes or reverts all of them — no partial commits.

**Test Coverage:**
- `tests/invariants/I4-atomic-transfers.spec.ts`
- Test: Successful transfer → both balances updated correctly
- Test: Failed transfer → both balances unchanged
- Test: Reentrancy attempt → blocked by guard

**Threat Model Reference:** T2 (Reentrancy), T3 (Ledger Desync)

**Audit Checklist:**
- [ ] Balance updates are atomic (both debit and credit in same transaction)
- [ ] Reentrancy protection implemented and tested
- [ ] No intermediate states possible
- [ ] Failed transfers fully revert all state changes

---

## I5 — Ledger Conservation

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
- Internal transfers have zero protocol fees (only TON gas)
- Balance sum is an invariant across all operations

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `PaymentHub.tact` | Lines 197–198 | Direct balance arithmetic — no hidden fees |
| `MerchantPaymentHub.tact` | Lines 178–187 | Symmetric debit/credit — payer loses exactly what merchant gains |

**Delegation to TBC Jetton:**
The TBC jetton contract (immutable, already deployed) enforces:
- `total_supply = Σ(all wallet balances)`
- No partial transfers (atomic jetton execution)
- Payment Hub routes transfers through jetton contract

**Test Coverage:**
- `tests/invariants/I5-ledger-conservation.spec.ts`
- Test: Sum of balances unchanged after transfer
- Test: Multiple concurrent transfers preserve total supply
- Test: Self-transfer does not create/destroy funds

**Threat Model Reference:** T3 (Ledger Desync)

**Audit Checklist:**
- [ ] Every debit has exactly equal credit (zero net change)
- [ ] No hidden fees deducted from transfer amounts
- [ ] Total balance sum preserved across all operations
- [ ] No rounding errors or precision loss in arithmetic
- [ ] No mint or burn functions exist in protocol contracts

---

## I6 — Lock ≠ Confiscation

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
- Locks restrict actions, NOT ownership
- Locked accounts can still receive funds
- Locks do not transfer or freeze funds to protocol custody
- All locks are reversible by appropriate authority
- Lock operations emit auditable events

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `account-locks.fc` | Lines 83–92 — `can_send()` | Returns 0 if any lock active |
| `account-locks.fc` | Lines 94–98 — `can_receive()` | Always returns 1 (hardcoded) |
| `account-locks.fc` | Lines 100–110 | Lock operations don't modify balances |
| `MerchantPaymentHub.tact` | Lines 116–119 — `checkLockState()` | Checks lock before send, not receive |

**Lock Types:**

| Lock | Set By | Clears When | Allows Receive? | Seizes Funds? |
|------|--------|-------------|-----------------|---------------|
| FRAUD_LOCK | risk_authority | risk_authority clears it | YES | NO |
| COLLATERAL_LOCK | lending_adapter | lending_adapter clears it | YES | NO |

**Known Concern — Indefinite Locks:**
Admin can set locks WITHOUT automatic unlock mechanism. A lock held indefinitely approaches effective confiscation. Planned mitigation: lock expiration timestamps via DAO governance.

**Test Coverage:**
- `tests/invariants/I6-lock-not-confiscation.spec.ts`
- Test: Fraud lock prevents sending, allows receiving
- Test: Collateral lock prevents sending, allows receiving
- Test: Lock does not change balance
- Test: Lock can be reversed by authorized party
- Negative: Lock cannot seize funds

**Threat Model Reference:** T4 (Lock Bypass), T8 (Admin Key)

**Audit Checklist:**
- [ ] Locks do not modify account balances
- [ ] Locked accounts can always receive funds
- [ ] Locks are reversible by appropriate authority
- [ ] Lock events emitted on all lock/unlock operations
- [ ] No "permanent confiscation" path exists

---

## I7 — External Adapter Isolation

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
      O MUST follow all invariants I1–I6
```

**Guaranteed Properties:**
- External providers have no direct smart contract access
- All external interactions are mediated by user wallets
- Backend APIs orchestrate but don't execute transfers
- External adapters are read-only from protocol perspective

**Contract-to-Code Mapping:**

| Contract | Location | What to Verify |
|----------|----------|----------------|
| `account-locks.fc` | Lines 36–43 | Only `risk_authority` and `lending_adapter` have roles — no external adapters |
| `PaymentHub.tact` | Entire contract | No external adapter addresses in authorization |
| `MerchantPaymentHub.tact` | Entire contract | All transfers require NFT owner signature |

**Off-Chain Isolation Verification:**
- `backend/adapters/changenow.ts` — informational only, cannot sign transactions
- `backend/adapters/nowpayments.ts` — informational only
- `backend/adapters/coinrabbit.ts` — informational only
- Merchant API (`api/`) — orchestrates user-signed transactions only

**Test Coverage:**
- `tests/invariants/I7-external-adapter-isolation.spec.ts`
- Test: External services cannot initiate transfers
- Test: All transfers require valid user signature
- Architectural review: No external adapter privileged access

**Threat Model Reference:** T6 (External Adapter Exploits), T7 (Oracle — future)

**Audit Checklist:**
- [ ] No external adapter addresses in smart contract authorization
- [ ] All protocol operations require user-initiated transactions
- [ ] No bypass mechanisms for external services
- [ ] Backend is orchestration-only (cannot sign or execute transactions)

---

## Invariant-to-Contract Mapping Summary

| Invariant | PaymentHub.tact | MerchantPaymentHub.tact | account-locks.fc | nft_account_resolver.fc |
|-----------|----------------|------------------------|------------------|------------------------|
| **I1: Non-Custodial** | Line 164 | Lines 90–96 | N/A (no fund control) | Lines 61–69 |
| **I2: NFT Authority** | Line 36 | Lines 42, 90–96 | N/A | Lines 61–69 |
| **I3: No Admin Control** | Lines 229–240 (test-only) | Lines 223–245 (test-only) | Lines 160–217 (lock-only) | N/A |
| **I4: Atomic** | Lines 149–150, 196–202 | Lines 134–135 | N/A | N/A |
| **I5: Conservation** | Lines 197–198 | Lines 178–187 | N/A | N/A |
| **I6: Lock ≠ Confiscate** | N/A | Lines 116–119 | Lines 83–110 | N/A |
| **I7: Adapter Isolation** | Entire contract | Entire contract | Lines 36–43 | N/A |

---

## Invariant Violation Response Protocol

If any invariant is violated during audit:

1. **CRITICAL SEVERITY** — All invariant violations are critical
2. **IMMEDIATE HALT** — Affected operations must be stopped
3. **INCIDENT RESPONSE** — Follow security incident protocol
4. **ROOT CAUSE ANALYSIS** — Full investigation required
5. **FIX VERIFICATION** — Must demonstrate invariant restoration before re-audit

---

## Complete Audit Checklist

### I1 — Non-Custodial Ownership
- [ ] All fund transfers verify NFT ownership
- [ ] No admin override for fund movement
- [ ] Backend services are read-only
- [ ] No custody mechanisms exist

### I2 — NFT = Account Authority
- [ ] NFT ownership queried on-chain for each operation
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

## References

- **Full Invariants Document**: [docs/invariants.md](../docs/invariants.md)
- **Threat Model**: [audit/THREAT_MODEL.md](./THREAT_MODEL.md)
- **Audit Scope**: [audit/SCOPE.md](./SCOPE.md)
- **Issue #18**: [Original Formal Invariants](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
- **Issue #55**: [Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
