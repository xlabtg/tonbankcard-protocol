# TONBANKCARD Protocol — Security Testing Strategy

**Document Type:** Security Documentation
**Issue Reference:** [#74 — Improvements / Phase 10 — Security Testing Expansion](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_10_security.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Objective](#1-objective)
2. [Testing Layers](#2-testing-layers)
3. [Fuzz Testing](#3-fuzz-testing)
4. [Replay Attack Simulations](#4-replay-attack-simulations)
5. [Signature Forgery Attempts](#5-signature-forgery-attempts)
6. [Lock Bypass Attempts](#6-lock-bypass-attempts)
7. [Formal Verification Feasibility](#7-formal-verification-feasibility)
8. [Dependency Security Audit](#8-dependency-security-audit)
9. [Test Execution Guide](#9-test-execution-guide)
10. [Coverage Targets](#10-coverage-targets)

---

## 1. Objective

Expand test coverage to include adversarial scenarios beyond the happy-path and basic negative tests. This strategy defines:

- Adversarial test scenarios for each contract
- Fuzz testing scope and methodology
- Replay attack simulation approach
- Signature forgery test vectors
- Lock bypass attempt coverage
- Formal verification feasibility assessment
- Dependency security audit process

---

## 2. Testing Layers

The TONBANKCARD security testing strategy is organized into five layers:

| Layer | Scope | Tools | Location |
|-------|-------|-------|----------|
| **Unit Tests** | Individual contract functions | Blueprint (Tact/FunC) | `contracts/*/tests/`, `tests/` |
| **Invariant Tests** | Protocol-level invariants I1–I7 | Blueprint | `tests/invariants/` |
| **Adversarial Tests** | Simulated attacks | Blueprint, custom harness | `tests/adversarial/` |
| **Integration Tests** | Cross-component flows | Blueprint + mocked adapters | `tests/` |
| **Fuzzing** | Input space exploration | Custom fuzz harness | `tests/fuzz/` (target) |

---

## 3. Fuzz Testing

### 3.1 Scope

Fuzz testing targets all contracts that handle external input. Priority order:

| Contract | Fuzz Target | Input Space |
|----------|-------------|-------------|
| `MerchantPaymentHub.tact` | `receive(MerchantPaymentRequest)` | amount, merchant address, payer address, invoice ID |
| `PaymentHub.tact` (FunC) | `recv_internal` | message body, sender address, value |
| `account-locks.fc` | `can_send` query | arbitrary NFT address inputs |
| `nft_account_resolver.fc` | `resolve_owner` | arbitrary NFT address, collection address |

### 3.2 Fuzz Test Cases

**PaymentHub — Amount Boundary Fuzzing**
```typescript
// tests/fuzz/payment-hub-amounts.fuzz.ts
// Fuzz: amount = 0, 1, MAX_UINT64 - 1, MAX_UINT64, overflow values
// Expected: amounts <= balance succeed; amounts > balance revert; zero amount reverts
describe('PaymentHub amount boundary fuzzing', () => {
  const boundaryAmounts = [
    BigInt(0),
    BigInt(1),
    BigInt(999_999_999),
    BigInt(1_000_000_000),
    BigInt('18446744073709551614'),  // MAX_UINT64 - 1
    BigInt('18446744073709551615'),  // MAX_UINT64
  ];
  // For each: verify correct accept/reject behavior and no state corruption
});
```

**Account Locks — Arbitrary Address Fuzzing**
```
// Fuzz: arbitrary NFT addresses (valid TON addresses, zero address, malformed)
// Expected: valid addresses work correctly; invalid addresses revert cleanly
// Invariant: lock state is never set for addresses that were not explicitly locked
```

**MerchantPaymentHub — Invoice ID Fuzzing**
```
// Fuzz: invoice IDs of varying lengths, special characters, identical IDs
// Expected: no crash on any invoice ID; same ID paid twice requires two user signatures
// Verifies: off-chain dedup is correctly the merchant's responsibility
```

### 3.3 Property-Based Invariant Fuzzing

For each invariant, define a fuzz harness that generates random valid sequences of operations and asserts the invariant holds after each step:

**I5 — Ledger Conservation Fuzz**
```
Generate N random transfers between M accounts
After each transfer, assert: Σ(all balances) = initial_total_supply
Must hold even after: failed transfers, self-transfers, concurrent transfers
```

**I6 — Lock Not Confiscation Fuzz**
```
Generate random sequences of: set_lock, clear_lock, transfer attempts
After each operation, assert:
  - balance(locked_account) = balance_before_lock
  - can_receive(locked_account) = true (always)
  - Σ(all balances) is unchanged by lock/unlock operations
```

### 3.4 Implementation Timeline

Phase 1 (current): Document fuzz harness specifications
Phase 2: Implement `tests/fuzz/` directory with harness skeletons
Phase 3: Integrate fuzz runs into CI with fixed seed for reproducibility

---

## 4. Replay Attack Simulations

### 4.1 Invoice Replay

**Threat:** Merchant resubmits a previously-paid invoice to collect twice.

**Test Scenario:**
```
1. Customer pays invoice ID "INV-001" for 100 TBC → succeeds
2. Merchant resubmits same invoke payload
3. Expected: second submission requires fresh customer signature
4. Verify: without customer re-signing, second payment cannot occur
```

**Current State:** Invoice replay protection is off-chain only (merchant backend deduplication). This test confirms the protocol-level behavior: duplicate payment requires the *user* to sign twice. The risk is to the *merchant*, not the user.

**Test Location:** `tests/adversarial/invoice-replay.spec.ts`

### 4.2 Transaction Replay

**Threat:** Attacker replays a valid signed transaction to execute it multiple times.

**Test Scenario:**
```
1. User signs TransferInternalRequest for 50 TBC
2. Transaction is submitted and succeeds
3. Attacker captures the signed message and resubmits
4. Expected: TON's built-in replay protection (seqno / logical time) rejects replay
5. Verify: second submission with same logical time is rejected by TVM
```

**Note:** TON's transaction model inherently prevents replays at the network level via logical time (lt). This test verifies protocol-level defense in depth.

**Test Location:** `tests/adversarial/transaction-replay.spec.ts`

### 4.3 Webhook Replay (Off-Chain)

**Threat:** Attacker replays a NOWPayments or ChangeNOW webhook to trigger duplicate processing.

**Test Scenario:**
```
1. NOWPayments webhook delivered for payment_id "PAY-001"
2. Merchant API processes webhook and marks invoice as settled
3. Attacker resends identical webhook payload
4. Expected: Merchant API detects duplicate (idempotency check) and ignores
5. Verify: second webhook does not trigger on-chain action or duplicate settlement
```

**Defense Requirements for Merchant API:**
- Idempotency key per webhook event
- Timestamp validation (reject webhooks older than 5 minutes)
- HMAC signature verification from provider

**Test Location:** `api/tests/webhook-replay.spec.ts`

---

## 5. Signature Forgery Attempts

### 5.1 NFT Ownership Forgery

**Threat:** Attacker submits a transaction claiming to be the NFT owner without actually owning the NFT.

**Test Scenarios:**
```
Scenario A — Direct Forgery:
  1. Attacker sends TransferInternalRequest from address not owning NFT #7777001
  2. Expected: checkOwnership() returns false; transaction reverts
  3. Exit code: authorization failure

Scenario B — Stale Ownership Claim:
  1. Alice previously owned NFT #7777001
  2. Alice transfers NFT to Bob
  3. Alice tries to use old NFT ownership for a transfer
  4. Expected: on-chain ownership check at execution time returns Bob → fails for Alice

Scenario C — Wrong NFT Collection:
  1. Attacker owns an NFT from a non-whitelisted collection
  2. Attacker sends request using the non-whitelisted NFT as authority
  3. Expected: NFT Account Resolver rejects unrecognized collection
```

**Test Location:** `tests/adversarial/signature-forgery.spec.ts`

### 5.2 Admin Role Forgery

**Threat:** Attacker attempts to call admin-only functions (pause, flag, lock) from non-privileged addresses.

**Test Scenarios:**
```
- Call handle_set_paused() from non-admin address → must revert
- Call set_fraud_lock() from non-risk_authority address → must revert
- Call set_collateral_lock() from non-lending_adapter address → must revert
```

**Test Location:** `tests/adversarial/admin-forgery.spec.ts`

---

## 6. Lock Bypass Attempts

### 6.1 Protocol Path Bypass

**Threat:** Attacker attempts to transfer from a FRAUD_LOCKED account through the Payment Hub.

**Test Scenarios:**
```
Scenario A — Direct Protocol Transfer:
  1. Account A has FRAUD_LOCK set
  2. Owner of NFT for Account A sends TransferInternalRequest for 100 TBC
  3. Expected: checkLockState() detects lock → transaction aborts with err::account_locked

Scenario B — Merchant Payment While Locked:
  1. Account A has FRAUD_LOCK set
  2. Account A's owner tries to pay merchant via MerchantPaymentHub
  3. Expected: lock check prevents settlement

Scenario C — Lock Bypass via State Transition:
  1. Account A has FRAUD_LOCK set (state = ACTIVE)
  2. Attacker tries to transition account to SUSPENDED then back to ACTIVE (hoping to clear lock)
  3. Expected: state transitions do not clear security locks
```

**Test Location:** `tests/adversarial/lock-bypass.spec.ts`

### 6.2 Direct Jetton Bypass (Documented Architectural Limitation)

**Threat:** User transfers TBC jetton directly (bypassing Payment Hub), ignoring FRAUD_LOCK.

**Current Status:** This is a **documented architectural limitation**. The TBC jetton contract is immutable and does not know about Account Locks. A FRAUD_LOCKED user CAN bypass the lock by interacting directly with the TBC jetton contract.

**Documented mitigation:** Off-chain monitoring detects direct transfers from locked accounts. Marketplace integration (future) can enforce lock awareness.

**Test:** Verify that the direct bypass path *exists* as documented, and that the lock is correctly enforced only within the protocol path.

**Test Location:** `tests/adversarial/direct-jetton-bypass.spec.ts`

---

## 7. Formal Verification Feasibility

### 7.1 Critical Contracts Assessment

| Contract | Formal Verification Feasibility | Priority | Tooling |
|----------|--------------------------------|----------|---------|
| `account-locks.fc` (FunC) | HIGH — small, simple state machine | HIGHEST | TVM Specification, FunC SMT encoding |
| `PaymentHub.tact` | MEDIUM — complex message handling | HIGH | Tact verification annotations |
| `MerchantPaymentHub.tact` | MEDIUM — ownership + lock + transfer | HIGH | Tact verification annotations |
| `nft_account_resolver.fc` | HIGH — stateless read-only logic | HIGH | TVM Specification |

### 7.2 Formal Specifications (Priority Invariants)

The following properties are the highest-priority targets for formal verification:

**Property 1 — Non-Custodial (I1)**
```
∀ msg ∈ recv_internal(PaymentHub):
  IF msg.op == transfer THEN
    msg.sender == get_nft_owner(msg.body.nft_address)
```

**Property 2 — Lock Enforcement (I6)**
```
∀ msg ∈ recv_internal(PaymentHub):
  IF msg.op == transfer THEN
    can_send(msg.body.nft_address) == true
```

**Property 3 — Conservation (I5)**
```
∀ T = transfer(A, B, amount):
  balance(A, after) = balance(A, before) - amount
  balance(B, after) = balance(B, before) + amount
  ∀ X ≠ A, B: balance(X, after) = balance(X, before)
```

### 7.3 Tooling Evaluation

| Tool | Applicability | Status |
|------|---------------|--------|
| TVM Symbolic Execution | FunC contracts | Evaluate Q3 2026 |
| Tact Verification Annotations | Tact contracts | Available in Tact 1.x |
| SMT Solvers (Z3/CVC5) | FunC property encoding | Research phase |
| Certora Prover (EVM-style) | Not directly applicable to TVM | N/A |

**Recommendation:** Prioritize formal verification of `account-locks.fc` and `nft_account_resolver.fc` due to their small size and critical security role. Target Q3 2026.

---

## 8. Dependency Security Audit

### 8.1 Lockfile Validation

All production dependency versions are pinned in lockfiles. The following files are authoritative:

| Component | Lockfile | Policy |
|-----------|----------|--------|
| SDK | `sdk/package-lock.json` | Exact versions (`npm ci`) |
| Indexer | `backend/indexer/package-lock.json` | `npm install` (must pin) |
| API | (if present) `api/package-lock.json` | Exact versions |

**Required action:** Migrate `backend/indexer` from `npm install` to `npm ci` (using committed lockfile) to ensure reproducible builds.

### 8.2 Dependency Risk Scoring

Risk scoring by dependency category:

| Category | Risk Level | Policy |
|----------|-----------|--------|
| `@ton/ton`, `@ton/core`, `@ton/crypto` | LOW (official TON libs) | Pin exact version; verify npm provenance |
| `express`, `better-sqlite3` | MEDIUM | Pin exact version; audit each minor upgrade |
| `jest`, `typescript`, `eslint` (devDeps) | LOW | Pin exact version; upgrade only on explicit review |
| `pino`, `pino-pretty` | LOW | Pin exact version |

**Automated scanning:** `npm audit` runs on every CI build. HIGH and CRITICAL findings block merges.

### 8.3 Supply Chain Verification

**Current controls:**
- Lock file committed to git (tamper-evident via git history)
- `npm ci` used in CI (uses lockfile exactly)
- No `postinstall` scripts that run arbitrary code in production deps

**Recommended additions:**
- Enable `npm audit signatures` to verify package signatures
- Pin Node.js version via `.nvmrc` or `engines` field (already done in indexer `package.json`)
- Consider Dependabot alerts for automatic vulnerability notifications

---

## 9. Test Execution Guide

### Running Adversarial Tests

```bash
# Run all adversarial tests
npx blueprint test tests/adversarial/

# Run specific adversarial scenario
npx blueprint test tests/adversarial/lock-bypass.spec.ts

# Run with verbose output
npx blueprint test --verbose tests/adversarial/

# Run invariant tests
npx blueprint test tests/invariants/
```

### Running Fuzz Tests (Future)

```bash
# Run fuzz harness with fixed seed (reproducible)
npx blueprint test tests/fuzz/ --seed 42

# Run fuzz harness for extended duration
FUZZ_ITERATIONS=10000 npx blueprint test tests/fuzz/
```

### Security Regression Suite

```bash
# Full security test suite (adversarial + invariants + security-tagged unit tests)
npm run test:security
```

---

## 10. Coverage Targets

### Adversarial Coverage Targets

| Test Category | Target Coverage | Current Status |
|---------------|----------------|----------------|
| Invoice replay | 2 scenarios | Partially covered (off-chain only) |
| Transaction replay | 1 scenario | Covered via TON network guarantees |
| Signature forgery | 3 scenarios | `tests/adversarial/` (partial) |
| Lock bypass (protocol) | 3 scenarios | `tests/adversarial/` (partial) |
| Admin forgery | 3 scenarios | `tests/invariants/I3-*` |
| Direct jetton bypass | 1 scenario (documentation) | Documented limitation |

### Target Test Distribution

After full implementation of this strategy:

| Layer | Test Count Target |
|-------|------------------|
| Invariant tests (I1–I7) | ≥ 7 × 5 = 35 test cases |
| Adversarial tests | ≥ 20 test cases |
| Fuzz harnesses | ≥ 5 property-based fuzz targets |
| Webhook validation tests | ≥ 10 test cases |

---

## References

- **Threat Model:** [`docs/security/THREAT_MODEL.md`](THREAT_MODEL.md)
- **Invariants:** [`docs/invariants.md`](../invariants.md)
- **Adversarial Tests:** [`tests/adversarial/README.md`](../../tests/adversarial/README.md)
- **Audit Scope:** [`audit/SCOPE.md`](../../audit/SCOPE.md)
- **Full System Audit:** [`docs/audit/FULL_SYSTEM_AUDIT.md`](../audit/FULL_SYSTEM_AUDIT.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
