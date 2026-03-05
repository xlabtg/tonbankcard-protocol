# TONBANKCARD Protocol — Audit Scope

**Document Type:** Audit Package
**Issue Reference:** [#55 — Issue 10.2 Audit Readiness (Formalized, Tooling + Process)](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
**Related Prior Work:** [docs/audit-scope.md](../docs/audit-scope.md)
**Version:** 1.0
**Status:** FROZEN — Pre-Audit Package
**Last Updated:** 2026-03-05

---

## Audit Objectives

The external security audit verifies the following properties:

1. **Fund Safety** — Users cannot lose funds due to contract bugs or admin actions
2. **Non-Custodial Guarantee** — Protocol never takes custody of user funds
3. **Invariant Preservation** — All protocol invariants hold under adversarial conditions
4. **Authorization Correctness** — NFT ownership is properly enforced in all code paths
5. **Lock Enforcement** — Account locks prevent unauthorized operations without confiscation
6. **Atomic Operations** — Transfers are all-or-nothing; no partial state possible
7. **No Admin Backdoors** — No privileged role can bypass user security or move user funds

---

## 2.1 Smart Contracts — In Scope

All of the following contracts MUST be included in the audit:

### Critical Priority

| Contract | File | Language | Lines | Focus |
|----------|------|----------|-------|-------|
| **MerchantPaymentHub** | `contracts/MerchantPaymentHub.tact` | Tact | 287 | Payment settlement, ownership, lock enforcement |
| **PaymentHub** | `contracts/payments/PaymentHub.tact` | Tact | 355 | Internal transfers, atomicity, ownership |
| **NFT Account Resolver** | `contracts/nft-resolver/nft_account_resolver.fc` | FunC | 149 | Ownership resolution, collection whitelist |
| **NFT Account Resolver** | `contracts/nft-resolver/nft_account_resolver.tact` | Tact | 121 | Ownership resolution (Tact wrapper) |
| **Account State Machine** | `contracts/payment-hub/account-state.tact` | Tact | 285 | State management, balance integrity |

### High Priority

| Contract | File | Language | Lines | Focus |
|----------|------|----------|-------|-------|
| **Account Locks** | `contracts/payments/account-locks.fc` | FunC | 269 | Lock authorization, lock semantics |

### Medium Priority

| Component | Files | Purpose |
|-----------|-------|---------|
| **Type Definitions** | `contracts/types/AccountState.tact`, `contracts/types/LockState.tact` | Shared data structures |
| **Interfaces** | `contracts/interfaces/IAccountStateMachine.tact`, `contracts/interfaces/IAccountLocks.tact`, `contracts/interfaces/INFTResolver.tact` | Public interface definitions |

**Total lines under audit: 1,598** (critical + high + medium)

---

### Per-Contract Audit Focus

#### MerchantPaymentHub (`contracts/MerchantPaymentHub.tact`)

Key functions auditors must review:

| Function | Lines | Invariants | Notes |
|----------|-------|------------|-------|
| `receive(MerchantPaymentRequest)` | 64–86 | I1, I2, I4 | Main entry point |
| `validateAndExecutePayment()` | 89–145 | I1–I6 | Core validation |
| `checkOwnership()` | 90–96 | I1, I2 | NFT ownership verification |
| `checkLockState()` | 116–119 | I6 | Lock enforcement |
| `executeTransfer()` | 134–135, 178–187 | I4, I5 | Atomic balance update |

Storage variables: `account_states`, `account_balances`, `account_locks`, `nft_owners` (lines 47–50)

#### PaymentHub (`contracts/payments/PaymentHub.tact`)

| Function | Lines | Invariants | Notes |
|----------|-------|------------|-------|
| `receive(TransferInternalRequest)` | 121–155 | I1, I4 | Internal transfer entry |
| `executeTransfer()` | 196–202 | I4, I5 | Atomic balance updates |
| `validateOwnership()` | 164 | I1, I2 | NFT ownership check |
| `reentrancyGuard()` | 149–150 | I4 | Reentrancy protection |

#### Account Locks (`contracts/payments/account-locks.fc`)

| Function | Lines | Invariants | Notes |
|----------|-------|------------|-------|
| `get_can_send()` | 100–110 | I6 | Lock enforcement |
| `get_can_receive()` | 94–98 | I6 | Always returns true |
| `set_fraud_lock()` | 160–180 | I3, I6 | Risk Authority only |
| `set_collateral_lock()` | 202–217 | I3, I6 | Lending Adapter only |

Authorization (lines 36–43): `risk_authority` and `lending_adapter` are the only privileged roles and can only set/clear locks — they CANNOT move funds.

---

## 2.2 Off-Chain Components — Informational Scope

The following off-chain components are reviewed for their integration guarantees and trust boundaries (not security audit of the code itself):

| Component | Trust Level | Scope |
|-----------|------------|-------|
| **Merchant API** | Medium | Signature validation, replay protection, trust boundary documentation |
| **SDK** | User-controlled | Data integrity, signature construction |
| **Indexer** | Read-only | Staleness risks, reorg handling |
| **External Adapters** | Low (adversarial) | Isolation guarantees |

**Off-chain components CANNOT move user funds.** The blockchain is the single source of truth.

---

## Out-of-Scope Components

The following are explicitly excluded from the audit scope:

### External Deployed Contracts (immutable, separately audited)
- TBC Token Jetton: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`
- NFT Collection Series 7777: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- NFT Collection Series 8888: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`
- TBC Diamonds (Governance): `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU`
- TBC/TON DEX (TONCO): `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M`

### Off-Chain Components (application security, separate scope)
- Frontend UI (React / Telegram Mini App)
- Backend API (Node.js / Express)
- Indexer service

### Third-Party Services
- ChangeNOW, NOWPayments, CoinRabbit, TONCO DEX

### Unimplemented Features (future scope)
- Lending Adapters, DAO Governance, Multi-Sig Cards, Recurring Payments

---

## Critical Audit Focus Areas

### 1. Ownership & Authorization (MUST verify)

- NFT ownership is the ONLY authority for account operations
- Ownership checked at execution time, not signing time
- No cached ownership records for authorization decisions
- No alternative control paths exist

**Test**: Transfer NFT to new owner, confirm old owner cannot transact

### 2. Fund Safety — No Admin Control (MUST verify)

- Zero admin withdrawal functions in any contract
- No emergency fund drains
- Admin roles (risk_authority, lending_adapter) limited to lock flags only
- All fund movements require current NFT owner signature

**Test**: Search entire codebase — expected zero admin fund functions

### 3. Ledger Integrity (MUST verify)

- Sum of all balances is constant across transfers
- Atomic debit/credit — no partial state
- No balance creation or destruction
- Overflow/underflow protection

**Test**: Transfer TBC, verify Σ(balances_before) = Σ(balances_after)

### 4. Lock Enforcement (MUST verify)

- FRAUD_LOCK prevents sending, allows receiving
- COLLATERAL_LOCK prevents sending, allows receiving
- No lock bypass paths (direct transfers, merchant payments)
- Locks are reversible by appropriate authority
- Locked accounts maintain ownership and balance

**Test**: Set FRAUD_LOCK, attempt all transfer types — all must fail

### 5. Merchant Payment Security (MUST verify)

- Payer must sign every transaction
- No merchant pull payments
- Amount specified by payer only

**Note**: Invoice replay protection is off-chain; see `docs/audit-notes.md`

### 6. External Adapter Isolation (MUST verify)

- Adapters cannot initiate on-chain state changes
- External API responses are informational only
- All fund movements require user-signed on-chain transactions

---

## Contract Freeze Status

**Freeze declared:** 2025-12-29
**Freeze commit:** `4027b9d`
**Current HEAD:** `eb5dd593248a33a5a7517ae59b840827c140906a`
**Status:** LOCKED — No contract logic changes permitted

See [FREEZE_METADATA.md](./FREEZE_METADATA.md) for complete freeze metadata including compiler versions and file hashes.

---

## Test Coverage Summary

| Contract | Line Coverage | Branch Coverage | Test Files |
|----------|---------------|-----------------|------------|
| MerchantPaymentHub | ~90%+ | ~85%+ | `tests/MerchantPaymentHub.spec.ts`, `tests/MerchantPaymentDynamic.spec.ts`, `tests/MerchantPaymentEdgeCases.spec.ts` |
| PaymentHub | ~85%+ | ~80%+ | `contracts/payments/PaymentHub.spec.ts` |
| Account Locks | ~85%+ | ~80%+ | `contracts/payments/tests/account-locks.spec.fc` |
| NFT Resolver | ~80%+ | ~75%+ | `tests/nft-resolver/NFTAccountResolver.spec.ts` |
| Account State Machine | ~90%+ | ~85%+ | `contracts/payment-hub/account-state.spec.ts` |

Invariant-specific tests: `tests/invariants/I{1-6}*.spec.ts`

See [TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md) for the complete coverage report.

---

## Running the Test Suite

```bash
# Clone repository at freeze commit
git clone https://github.com/xlabtg/tonbankcard-protocol
git checkout eb5dd593248a33a5a7517ae59b840827c140906a

# Install dependencies
npm install

# Run all tests
npx blueprint test

# Run with coverage
npx blueprint test --coverage

# Run specific contract tests
npx blueprint test MerchantPaymentHub.spec.ts
npx blueprint test account-locks.spec.fc
```

See [BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md) for full build and environment setup.

---

## Known Limitations (Auditor Notice)

Auditors must be aware of these documented limitations before beginning review:

| Limitation | Severity | Description |
|------------|----------|-------------|
| Invoice replay (off-chain only) | MEDIUM | Contract does not enforce invoice uniqueness on-chain |
| DAO unlock not implemented | LOW | FROZEN → ACTIVE transition requires future DAO governance |
| Lending unlock not implemented | LOW | COLLATERAL_LOCKED → ACTIVE requires Lending Adapter (not yet deployed) |
| NFT ownership integration (partial) | MEDIUM | Some contracts rely on calling contract for ownership check |

These are documented accepted risks, not security vulnerabilities. Full details in `docs/audit-notes.md`.

---

## Audit Package Structure

```
/audit/
├── SCOPE.md              ← This file: audit boundaries, focus areas
├── THREAT_MODEL.md       ← Threat classes, attack vectors, mitigations
├── INVARIANTS.md         ← Formal invariants with contract-code mapping
├── FREEZE_METADATA.md    ← Git hash, compiler versions, file checksums
├── BUILD_INSTRUCTIONS.md ← How to reproduce builds and run tests
└── TEST_COVERAGE_REPORT.md ← Coverage data and test organization
```

---

## References

- **Invariants**: [docs/invariants.md](../docs/invariants.md)
- **Threat Model**: [docs/threat-model.md](../docs/threat-model.md)
- **Architecture**: [docs/architecture.md](../docs/architecture.md)
- **Audit Notes**: [docs/audit-notes.md](../docs/audit-notes.md)
- **Versioning Policy**: [docs/versioning-policy.md](../docs/versioning-policy.md)
- **Deployment Matrix**: [docs/deployments/network-matrix.md](../docs/deployments/network-matrix.md)
- **Contributing Guidelines**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Issue #55**: [Audit Readiness (Formalized)](https://github.com/xlabtg/tonbankcard-protocol/issues/55)
