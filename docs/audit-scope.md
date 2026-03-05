# Tonbankcard Protocol Audit Scope Definition

## Overview

This document explicitly defines the **audit scope**, **contract freeze boundaries**, **invariants & threat references**, and **reviewer expectations** for the Tonbankcard protocol security audit.

This document ensures auditors can **efficiently evaluate protocol safety** without ambiguity or hidden assumptions.

**Issue Reference**: [#22 - Audit Readiness Checklist & Scope Definition](https://github.com/xlabtg/tonbankcard-protocol/issues/22)

---

## Audit Objectives

The security audit aims to verify:

1. **Fund Safety**: Users cannot lose funds due to contract bugs or admin actions
2. **Non-Custodial Guarantee**: Protocol never takes custody of user funds
3. **Invariant Preservation**: All protocol invariants hold under adversarial conditions
4. **Authorization Correctness**: NFT ownership is properly enforced
5. **Lock Enforcement**: Account locks prevent unauthorized operations
6. **Atomic Operations**: Transfers are all-or-nothing
7. **No Admin Backdoors**: No privileged roles can bypass user security

---

## In-Scope Contracts

The following contracts **MUST** be included in the audit:

### 1. Merchant Payment Hub
- **File**: `contracts/MerchantPaymentHub.tact`
- **Purpose**: On-chain merchant payment settlement in TBC
- **Status**: ✅ Implemented (Tact)
- **Priority**: 🔴 **CRITICAL**

**Key Functions**:
- `payMerchant(payer_nft, merchant_nft, amount_tbc, payload)`
- `getAccountState(nft_address)`
- `getBalance(nft_address)`
- `getLockState(nft_address)`

**Critical Focus Areas**:
- ✅ Ownership verification before payment
- ✅ Balance conservation (debit payer, credit merchant)
- ✅ Lock enforcement (FRAUD_LOCK, COLLATERAL_LOCK)
- ✅ State validation (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)
- ✅ Event emission completeness
- ✅ No admin override paths

**Related Files**:
- `tests/MerchantPaymentHub.spec.ts`
- `tests/MerchantPaymentDynamic.spec.ts`
- `tests/MerchantPaymentLocks.spec.ts`
- `tests/MerchantPaymentEdgeCases.spec.ts`

---

### 2. Payment Hub (Internal Transfers)
- **File**: `contracts/payments/PaymentHub.tact`
- **Purpose**: Internal TBC transfers between NFT accounts
- **Status**: ✅ Implemented (Tact)
- **Priority**: 🔴 **CRITICAL**

**Key Functions**:
- `transferInternal(from_nft, to_nft, amount_tbc, payload)`
- `getBalance(nft_address)`
- `getAccountState(nft_address)`
- `canSend(nft_address)`
- `canReceive(nft_address)`

**Critical Focus Areas**:
- ✅ Atomic debit/credit operations
- ✅ Ownership verification (sender owns from_nft)
- ✅ Balance conservation
- ✅ State enforcement (from_nft must be ACTIVE)
- ✅ Destination validation (to_nft not CLOSED)
- ✅ Zero-fee internal transfers

**Related Files**:
- `contracts/payments/README.md`
- Tests: (to be confirmed if separate tests exist)

---

### 3. NFT Account Resolver
- **Files**:
  - `contracts/nft-resolver/nft_account_resolver.fc`
  - `contracts/nft-resolver/nft_account_resolver.tact`
- **Purpose**: NFT ownership verification and account binding
- **Status**: ✅ Implemented (FunC & Tact)
- **Priority**: 🔴 **CRITICAL**

**Key Functions**:
- `resolveOwner(nft_address)` - Get current NFT owner
- `isValidAccountNFT(nft_address)` - Validate NFT belongs to whitelisted collection
- `getAccountInfo(nft_address)` - Retrieve account metadata

**Critical Focus Areas**:
- ✅ Ownership resolution correctness
- ✅ NFT collection whitelist validation
- ✅ No cached ownership (always fresh)
- ✅ Resistance to race conditions

**Related Files**:
- `contracts/nft-resolver/README.md`
- `contracts/nft-resolver/IMPLEMENTATION_NOTES.md`
- `tests/nft-resolver/NFTAccountResolver.spec.ts`

---

### 4. Account State Machine
- **File**: `contracts/payment-hub/account-state.tact`
- **Purpose**: Account state management and internal ledger
- **Status**: ✅ Implemented (Tact)
- **Priority**: 🔴 **CRITICAL**

**Key Functions**:
- `getAccountState(nft_address)` - Returns balance and state
- `getBalance(nft_address)` - Returns TBC balance
- `getState(nft_address)` - Returns state enum
- `canSend(nft_address)` - Check if can send
- `canReceive(nft_address)` - Check if can receive

**State Machine**:
```
ACTIVE (0) → FROZEN (1)
           → COLLATERAL_LOCKED (2)
           → CLOSED (3)
```

**Critical Focus Areas**:
- ✅ Balance integrity (no negative, no overflow)
- ✅ State transition correctness
- ✅ Conservation of total supply
- ✅ Atomic state updates

**Related Files**:
- `contracts/payment-hub/README.md`
- Tests: (integration tests in Payment Hub tests)

---

### 5. Account Locks
- **File**: `contracts/payments/account-locks.fc`
- **Purpose**: On-chain lock flags for fraud prevention and collateral management
- **Status**: ✅ Implemented (FunC)
- **Priority**: 🟠 **HIGH**

**Key Functions**:
- `get_account_lock_state(nft_address)` - Returns (fraud_locked, collateral_locked)
- `get_is_account_locked(nft_address)` - Returns bool
- `get_can_send(nft_address)` - Check if locked
- `get_can_receive(nft_address)` - Always returns true
- `set_fraud_lock(nft_address)` - Risk Authority only
- `set_collateral_lock(nft_address)` - Lending Adapter only

**Critical Focus Areas**:
- ✅ Authorization (only Risk Authority or Lending Adapter)
- ✅ Lock enforcement (prevent SEND, allow RECEIVE)
- ✅ No lock bypass paths
- ✅ Event emission on lock changes
- ✅ No admin override for locks

**Related Files**:
- `contracts/payments/ACCOUNT_LOCKS.md`
- `contracts/payments/tests/account-locks.spec.fc`

---

### 6. Shared Type Definitions and Interfaces
- **Files**:
  - `contracts/types/AccountState.tact`
  - `contracts/types/LockState.tact`
  - `contracts/interfaces/IAccountStateMachine.tact`
  - `contracts/interfaces/IAccountLocks.tact`
  - `contracts/interfaces/INFTResolver.tact`
- **Purpose**: Shared data structures and interfaces
- **Priority**: 🟡 **MEDIUM**

**Critical Focus Areas**:
- ✅ Type safety
- ✅ Consistent definitions across contracts
- ✅ No ambiguous states

---

## Out-of-Scope Components

The following components are **explicitly excluded** from the audit:

### External Contracts (Already Deployed)
- ❌ **TBC Token Jetton** (`EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`)
  - Reason: Already deployed and immutable, separate audit scope
- ❌ **NFT Card Collections** (Series 7777, 8888)
  - Reason: Already deployed and immutable

### Off-Chain Components
- ❌ **Frontend UI** (React/Telegram Mini App)
  - Reason: Not part of smart contract security audit
- ❌ **Backend API** (Node.js/Express)
  - Reason: Separate application security audit
- ❌ **Indexer** (Event processing)
  - Reason: Read-only, no fund custody
- ❌ **SDKs and Libraries**
  - Reason: Client-side, user-controlled

### External Services
- ❌ **ChangeNOW** integration
  - Reason: Third-party service, separate security model
- ❌ **NOWPayments** integration
  - Reason: Third-party service
- ❌ **CoinRabbit** integration
  - Reason: Third-party service
- ❌ **TONCO DEX** contracts
  - Reason: External protocol

### Future Components (Not Yet Implemented)
- ❌ **Lending Adapters**
  - Reason: Not implemented yet
- ❌ **DAO Governance**
  - Reason: Not implemented yet
- ❌ **Multi-Sig Cards**
  - Reason: Not implemented yet
- ❌ **Recurring Payments**
  - Reason: Not implemented yet

---

## Audit Focus Areas

### 🔴 Critical - MUST Verify

#### 1. Ownership & Authority
- **Requirement**: NFT ownership is the ONLY authority for account operations
- **Verification**:
  - ✅ Ownership checked at execution time, not signing time
  - ✅ No cached ownership assumptions
  - ✅ No alternative control paths
  - ✅ NFT transfer race conditions handled correctly

**Test**: Attempt payment after transferring NFT to different owner

**Expected**: Transaction fails with "Unauthorized" error

---

#### 2. Fund Safety
- **Requirement**: Non-custodial guarantees, no admin fund control
- **Verification**:
  - ✅ No admin withdrawal functions
  - ✅ No emergency fund drains
  - ✅ No forced transfers
  - ✅ All transfers require user signature

**Test**: Search entire codebase for admin override functions

**Expected**: Zero findings

---

#### 3. Ledger Integrity
- **Requirement**: Balance conservation, atomicity, no phantom balances
- **Verification**:
  - ✅ Sum of all balances constant during transfers
  - ✅ Atomic debit/credit operations
  - ✅ No balance creation/destruction
  - ✅ Overflow/underflow protection

**Test**: Transfer TBC between accounts, verify total unchanged

**Expected**: Sum of balances before = Sum of balances after

---

#### 4. Lock & Risk Enforcement
- **Requirement**: Locks prevent operations correctly
- **Verification**:
  - ✅ FRAUD_LOCK prevents sending
  - ✅ COLLATERAL_LOCK prevents sending
  - ✅ Locks allow receiving
  - ✅ No bypass paths (transfers, merchant payments, etc.)
  - ✅ Lock inheritance on NFT transfer

**Test**: Set FRAUD_LOCK, attempt internal transfer and merchant payment

**Expected**: Both transactions fail with "Account locked" error

---

#### 5. Merchant Payments
- **Requirement**: User-initiated settlement only
- **Verification**:
  - ✅ Payer must sign transaction
  - ✅ No merchant pull payments
  - ✅ Amount specified by payer
  - ✅ Replay protection (invoice uniqueness)

**Test**: Merchant attempts to call `payMerchant` without user signature

**Expected**: Transaction fails with "Unauthorized" error

---

#### 6. External Adapter Isolation
- **Requirement**: Adapters cannot move funds
- **Verification**:
  - ✅ No trust in off-chain signals
  - ✅ Adapter cannot initiate transfers
  - ✅ Failure-safe behavior (adapter down doesn't affect protocol)

**Test**: Adapter API returns false success, verify no on-chain impact

**Expected**: On-chain state unchanged without user signature

---

### 🟠 High Priority - Should Verify

#### 7. State Machine Correctness
- Valid state transitions only
- State-based permission enforcement
- No invalid state combinations

#### 8. Input Validation
- All inputs validated
- Explicit error messages
- No silent failures

#### 9. Event Emission
- All state changes emit events
- Events include all relevant data
- Deterministic event ordering

#### 10. Gas Optimization
- Operations complete within limits
- No unbounded loops
- Minimal storage usage

---

### 🟡 Medium Priority - Nice to Verify

#### 11. Code Quality
- Clear, readable code
- Appropriate comments
- Consistent style

#### 12. Error Handling
- Explicit error codes
- Descriptive error messages
- Graceful failure modes

---

## Contract Freeze Policy

### Before Audit Start

**Requirements**:
- ✅ All in-scope contracts MUST be frozen
- ✅ No logic changes allowed
- ✅ Only documentation updates permitted
- ✅ Contracts tagged with version number

**Freeze Checklist**:
- [ ] All contracts compiled and tested
- [ ] Test coverage ≥ 90% for critical paths
- [ ] Documentation complete
- [ ] Version tag created (e.g., `v1.0.0-audit`)
- [ ] Git commit hash recorded
- [ ] No pending changes in repository

### During Audit

**Allowed**:
- ✅ Documentation clarifications
- ✅ Test additions (non-invasive)
- ✅ Answering auditor questions

**Prohibited**:
- ❌ Contract logic changes
- ❌ Adding/removing functions
- ❌ Changing state variables
- ❌ Modifying validation logic
- ❌ "Quick fixes" for findings

**Policy**:
> Any change to in-scope contract logic during audit invalidates findings and requires re-audit from scratch.

### After Audit

**Response to Findings**:
1. Classify findings by severity (Critical, High, Medium, Low, Informational)
2. Implement fixes for Critical and High findings
3. Re-test all affected functionality
4. Request re-audit of changed code
5. Only deploy after all Critical findings resolved

---

## Invariants & Threats Reference

Auditors MUST consult:

1. **Protocol Invariants**: `docs/invariants.md`
   - Defines all formal invariants that must hold
   - Maps invariants to contract code
   - Provides test verification methods

2. **Threat Model (Legacy)**: `docs/threat-model.md`
   - Identifies 11 threat classes
   - Maps threats to affected components
   - Documents mitigations and residual risks

3. **Formal Security Architecture & Threat Model**: `docs/security/THREAT_MODEL.md`
   - Formal adversary model (7 attacker classes)
   - Attack surface classification (4 main categories, ~20 specific attacks)
   - Trust boundary definitions (5 trust levels)
   - Full mitigation mapping
   - Key compromise scenarios and blast radius analysis
   - Audit checklist

4. **Key Management Framework**: `docs/security/KEY_MANAGEMENT.md`
   - Operational key management procedures
   - Key classification (on-chain authority, governance, infrastructure)
   - Rotation policy and compromise recovery
   - Multi-sig requirements and prohibited practices

5. **Architecture**: `docs/architecture.md`
   - High-level protocol design
   - Trust boundaries
   - Component responsibilities

6. **Contract Documentation**: `contracts/README.md`
   - Detailed contract specifications
   - Function documentation
   - Security considerations

---

## Test Coverage Requirements

### Minimum Coverage Standards

| Contract | Line Coverage | Branch Coverage | Required Tests |
|----------|---------------|-----------------|----------------|
| MerchantPaymentHub | ≥ 95% | ≥ 90% | Unit, Integration, Adversarial, Edge Cases |
| PaymentHub | ≥ 95% | ≥ 90% | Unit, Integration, Adversarial, Edge Cases |
| NFT Account Resolver | ≥ 90% | ≥ 85% | Unit, Integration |
| Account State Machine | ≥ 95% | ≥ 90% | Unit, Integration, Edge Cases |
| Account Locks | ≥ 90% | ≥ 85% | Unit, Integration, Authorization |

### Test Categories

**Unit Tests**:
- Individual function behavior
- Input validation
- Error conditions
- Edge cases

**Integration Tests**:
- Multi-contract interactions
- End-to-end user flows
- State synchronization

**Adversarial Tests**:
- Attempt invariant violations
- Authorization bypass attempts
- Race condition exploits
- Reentrancy attempts (if applicable)

**Edge Case Tests**:
- Boundary values (max/min amounts)
- Zero balances
- Self-transfers
- NFT transfer during operation

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npx blueprint test

# Run with coverage
npx blueprint test --coverage

# Run specific contract tests
npx blueprint test MerchantPaymentHub.spec.ts
```

---

## Auditor Expectations

### What We Expect from Auditors

1. **Comprehensive Review**:
   - Manual code inspection of all in-scope contracts
   - Automated analysis (fuzzing, symbolic execution)
   - Attempt to violate each invariant
   - Test all identified threat scenarios

2. **Clear Reporting**:
   - Severity classification (Critical, High, Medium, Low, Info)
   - Proof of concept for exploits
   - Recommended fixes
   - Timeline for remediation

3. **Focus Areas** (in priority order):
   - Fund safety (no admin access, no custody)
   - Balance conservation
   - Authorization correctness
   - Lock enforcement
   - State machine correctness

4. **Communication**:
   - Regular status updates
   - Clarification questions via GitHub issues or direct channel
   - Draft report for review before final

### What Auditors Can Expect from Us

1. **Responsive Support**:
   - Answer questions within 24 hours
   - Provide additional documentation as needed
   - Clarify design decisions

2. **Complete Documentation**:
   - All contracts documented
   - All invariants defined
   - All threats identified
   - Test suite available

3. **Remediation Commitment**:
   - Fix all Critical findings before launch
   - Fix all High findings before launch
   - Address Medium findings or document acceptance
   - Acknowledge Low and Info findings

---

## Audit Timeline Expectations

### Phase 1: Preparation (Before Audit)
- **Duration**: Completed
- **Deliverables**:
  - ✅ All contracts frozen
  - ✅ Documentation complete
  - ✅ Test suite finalized
  - ✅ This audit scope document

### Phase 2: Audit Execution
- **Duration**: 2-4 weeks (auditor estimate)
- **Activities**:
  - Manual code review
  - Automated analysis
  - Invariant testing
  - Threat scenario validation

### Phase 3: Report & Remediation
- **Duration**: 1-2 weeks
- **Activities**:
  - Draft report review
  - Finding classification
  - Fix implementation
  - Re-testing

### Phase 4: Final Report
- **Duration**: 1 week
- **Activities**:
  - Final audit report
  - Re-audit of fixes
  - Sign-off

**Total Estimated Timeline**: 4-7 weeks

---

## Known Limitations & Accepted Risks

### Documented Limitations

1. **Invoice Replay Protection**:
   - **Status**: Enforced off-chain by merchant backend
   - **Risk**: Medium (merchant responsibility)
   - **Future**: On-chain nonce tracking planned

2. **DAO Unlocking Not Implemented**:
   - **Status**: FROZEN → ACTIVE transition not yet available
   - **Risk**: Low (alternative: deploy new contract)
   - **Future**: DAO governance planned

3. **Lending Adapter Not Implemented**:
   - **Status**: COLLATERAL_LOCK unlock mechanism not available
   - **Risk**: Low (no lending feature yet)
   - **Future**: Lending adapter planned

4. **NFT Ownership Integration**:
   - **Status**: Some contracts document ownership checks but don't enforce
   - **Risk**: Medium (integration dependency)
   - **Mitigation**: Caller contracts must enforce

### Accepted Risks

1. **External Adapter Availability**:
   - **Risk**: ChangeNOW/NOWPayments may be unavailable
   - **Impact**: Poor UX, but no fund loss
   - **Acceptance**: Isolated by design

2. **Gas Price Volatility**:
   - **Risk**: TON gas prices may spike
   - **Impact**: Higher user costs
   - **Acceptance**: Inherent to blockchain

3. **Frontend Phishing**:
   - **Risk**: Users may use fake frontends
   - **Impact**: User fund loss (not protocol-wide)
   - **Acceptance**: User education required

---

## Audit Deliverables

### Required from Audit Team

1. **Draft Report**:
   - Executive summary
   - Methodology
   - Findings (severity, description, PoC, recommendation)
   - Code quality assessment

2. **Final Report**:
   - Updated with remediation verification
   - Re-audit of fixes
   - Final risk assessment
   - Sign-off

3. **Supporting Materials**:
   - Automated analysis logs
   - Fuzzing results
   - Test coverage reports

### Required from Tonbankcard Team

1. **Remediation Plan**:
   - Response to each finding
   - Timeline for fixes
   - Acceptance of informational findings

2. **Updated Contracts**:
   - Fixed versions
   - Version tags
   - Migration plan (if needed)

3. **Post-Audit Documentation**:
   - Update docs with audit learnings
   - Public audit report (after approval)
   - Security disclosure policy

---

## Contact & Communication

### During Audit

- **Primary Contact**: [Specify contact person/email]
- **Response Time**: Within 24 hours
- **Communication Channels**:
  - GitHub Issues (for technical questions)
  - Email (for sensitive findings)
  - Telegram/Discord (for quick clarifications)

### Security Disclosure

**DO NOT** disclose security vulnerabilities publicly before:
1. Remediation is complete
2. Users have time to upgrade (if applicable)
3. Public disclosure is coordinated

**Report Critical Findings**:
- Email: [security contact - to be added]
- PGP Key: [if available]

---

## Acceptance Criteria for Audit Completion

This audit scope is complete when:

- [x] Audit scope is explicitly defined
- [x] All in-scope contracts are frozen
- [x] Invariants & threats are documented
- [x] Tests cover critical paths
- [x] Auditor-facing documentation is ready
- [ ] External audit firm selected
- [ ] Audit engagement started
- [ ] Draft report received
- [ ] All Critical findings resolved
- [ ] All High findings resolved
- [ ] Final audit report published

---

## Appendix A: Contract File Locations

```
contracts/
├── MerchantPaymentHub.tact              # In-scope (Critical)
├── payments/
│   ├── PaymentHub.tact                  # In-scope (Critical)
│   ├── payment-hub.fc                   # Legacy (for reference)
│   ├── account-locks.fc                 # In-scope (High)
│   └── README.md
├── payment-hub/
│   ├── account-state.tact               # In-scope (Critical)
│   └── README.md
├── nft-resolver/
│   ├── nft_account_resolver.fc          # In-scope (Critical)
│   ├── nft_account_resolver.tact        # In-scope (Critical)
│   └── README.md
├── types/
│   ├── AccountState.tact                # In-scope (Medium)
│   └── LockState.tact                   # In-scope (Medium)
└── interfaces/
    ├── IAccountStateMachine.tact        # In-scope (Medium)
    ├── IAccountLocks.tact               # In-scope (Medium)
    └── INFTResolver.tact                # In-scope (Medium)
```

---

## Appendix B: Test File Locations

```
tests/
├── MerchantPaymentHub.spec.ts           # Basic functionality
├── MerchantPaymentDynamic.spec.ts       # Dynamic invoice payments
├── MerchantPaymentLocks.spec.ts         # Lock enforcement
├── MerchantPaymentEdgeCases.spec.ts     # Edge cases
├── nft-resolver/
│   └── NFTAccountResolver.spec.ts       # NFT ownership verification
└── contracts/payments/tests/
    └── account-locks.spec.fc            # Account locks unit tests
```

---

## Appendix C: Documentation References

| Document | Purpose | Location |
|----------|---------|----------|
| **Invariants** | Formal protocol guarantees | `docs/invariants.md` |
| **Threat Model (Legacy)** | Attack surface analysis | `docs/threat-model.md` |
| **Security Threat Model (Formal)** | Full adversary model, attack surface, trust boundaries | `docs/security/THREAT_MODEL.md` |
| **Key Management Framework** | Operational security & key management | `docs/security/KEY_MANAGEMENT.md` |
| **Architecture** | High-level design | `docs/architecture.md` |
| **Governance** | Development principles | `docs/governance.md` |
| **Contributing** | Development rules | `CONTRIBUTING.md` |
| **Contract README** | Contract specifications | `contracts/README.md` |
| **Payment Hub README** | Payment Hub details | `contracts/payments/README.md` |
| **Account Locks README** | Lock system details | `contracts/payments/ACCOUNT_LOCKS.md` |

---

## Appendix D: Audit Checklist

### Pre-Audit Checklist
- [x] All in-scope contracts identified
- [x] All contracts frozen (no logic changes)
- [x] Test coverage meets minimum standards
- [x] Documentation complete
- [x] Invariants documented
- [x] Threat model documented
- [x] Known limitations documented
- [ ] Audit firm selected
- [ ] Audit agreement signed

### During-Audit Checklist
- [ ] Auditor questions answered promptly
- [ ] Additional documentation provided as needed
- [ ] No contract changes made
- [ ] Draft report received

### Post-Audit Checklist
- [ ] All findings classified
- [ ] Critical findings remediated
- [ ] High findings remediated
- [ ] Medium findings addressed or accepted
- [ ] Re-audit of fixes completed
- [ ] Final report received
- [ ] Public disclosure coordinated

---

## Appendix E: Contracts Under Audit (Detailed Reference)

This appendix provides **explicit code → scope mapping** for auditors. Each contract lists key functions, invariants covered, and specific line references.

### E.1 MerchantPaymentHub

| Property | Value |
|----------|-------|
| **File** | `contracts/MerchantPaymentHub.tact` |
| **Lines** | 287 |
| **Language** | Tact |
| **Priority** | 🔴 CRITICAL |

**Key Functions & Line References:**

| Function | Lines | Description | Invariants |
|----------|-------|-------------|------------|
| `receive(MerchantPaymentRequest)` | 64-86 | Main payment entry point | I1, I2, I4 |
| `validateAndExecutePayment()` | 89-145 | Core payment validation | I1, I2, I3, I5, I6 |
| `checkOwnership()` | 90-96 | NFT ownership verification | I1, I2 |
| `checkLockState()` | 116-119 | Lock enforcement | I6 |
| `executeTransfer()` | 134-135, 178-187 | Atomic balance update | I4, I5 |

**Storage Variables (lines 47-50):**
- `account_states: map<Address, Int>` - NFT address → state
- `account_balances: map<Address, Int>` - NFT address → TBC balance
- `account_locks: map<Address, LockState>` - NFT address → lock flags
- `nft_owners: map<Address, Address>` - NFT address → owner address

---

### E.2 PaymentHub

| Property | Value |
|----------|-------|
| **File** | `contracts/payments/PaymentHub.tact` |
| **Lines** | 355 |
| **Language** | Tact |
| **Priority** | 🔴 CRITICAL |

**Key Functions & Line References:**

| Function | Lines | Description | Invariants |
|----------|-------|-------------|------------|
| `receive(TransferInternalRequest)` | 121-155 | Internal transfer entry | I1, I4 |
| `executeTransfer()` | 196-202 | Atomic balance updates | I4, I5 |
| `validateOwnership()` | 164 | NFT ownership check | I1, I2 |
| `reentrancyGuard()` | 149-150 | Reentrancy protection | I4 |

**Storage Variables (lines 113-118):**
- `accounts: map<Address, AccountState>` - NFT address → account state
- `transferLock: Bool` - Reentrancy guard flag
- `deployer: Address` - Deployer address (test-only)

---

### E.3 NFT Account Resolver

| Property | Value |
|----------|-------|
| **File (FunC)** | `contracts/nft-resolver/nft_account_resolver.fc` |
| **File (Tact)** | `contracts/nft-resolver/nft_account_resolver.tact` |
| **Lines** | 149 (FunC) + 121 (Tact) = 270 total |
| **Language** | FunC + Tact |
| **Priority** | 🔴 CRITICAL |

**Key Functions & Line References (FunC):**

| Function | Lines | Description | Invariants |
|----------|-------|-------------|------------|
| `resolve_owner()` | 61-69 | Get current NFT owner | I2 |
| `validate_nft_collection()` | 45-58 | Check NFT is from valid collection | I2 |
| `get_account_info()` | 72-89 | Retrieve account metadata | I2 |

---

### E.4 Account State Machine

| Property | Value |
|----------|-------|
| **File** | `contracts/payment-hub/account-state.tact` |
| **Lines** | 285 |
| **Language** | Tact |
| **Priority** | 🔴 CRITICAL |

**State Machine:**
```
ACTIVE (0) ─────→ FROZEN (1)         [Risk Authority]
    │
    ├───────────→ COLLATERAL_LOCKED (2) [Lending Adapter]
    │
    └───────────→ CLOSED (3)         [User only - terminal]
```

**Key Functions:**

| Function | Description | Invariants |
|----------|-------------|------------|
| `getAccountState()` | Returns balance and state | - |
| `getBalance()` | Returns TBC balance | I5 |
| `canSend()` | Check if account can send | I6 |
| `canReceive()` | Check if account can receive | I6 |

---

### E.5 Account Locks

| Property | Value |
|----------|-------|
| **File** | `contracts/payments/account-locks.fc` |
| **Lines** | 269 |
| **Language** | FunC |
| **Priority** | 🟠 HIGH |

**Key Functions & Line References:**

| Function | Lines | Description | Invariants |
|----------|-------|-------------|------------|
| `get_account_lock_state()` | 94-98 | Get lock flags | I6 |
| `get_can_send()` | 100-110 | Check if send allowed | I6 |
| `get_can_receive()` | 94-98 | Always returns true | I6 |
| `set_fraud_lock()` | 160-180 | Risk Authority sets fraud lock | I3, I6 |
| `clear_fraud_lock()` | 182-200 | Risk Authority clears fraud lock | I3, I6 |
| `set_collateral_lock()` | 202-217 | Lending Adapter sets collateral lock | I3, I6 |

**Authorization (lines 36-43):**
- `risk_authority` - Can set/clear FRAUD_LOCK
- `lending_adapter` - Can set/clear COLLATERAL_LOCK
- Neither can move funds (I3)

---

### E.6 Type Definitions

| File | Lines | Purpose |
|------|-------|---------|
| `contracts/types/AccountState.tact` | 40 | Account state struct |
| `contracts/types/LockState.tact` | 34 | Lock state struct |

### E.7 Interfaces

| File | Lines | Purpose |
|------|-------|---------|
| `contracts/interfaces/IAccountStateMachine.tact` | 24 | Account state interface |
| `contracts/interfaces/IAccountLocks.tact` | 21 | Lock interface |
| `contracts/interfaces/INFTResolver.tact` | 13 | NFT resolver interface |

---

### E.8 Total Lines Under Audit

| Component | Lines | Priority |
|-----------|-------|----------|
| MerchantPaymentHub.tact | 287 | 🔴 CRITICAL |
| PaymentHub.tact | 355 | 🔴 CRITICAL |
| account-locks.fc | 269 | 🟠 HIGH |
| nft_account_resolver.fc | 149 | 🔴 CRITICAL |
| nft_account_resolver.tact | 121 | 🔴 CRITICAL |
| account-state.tact | 285 | 🔴 CRITICAL |
| Type definitions | 74 | 🟡 MEDIUM |
| Interfaces | 58 | 🟡 MEDIUM |
| **TOTAL** | **1,598** | - |

---

## Appendix F: Indexer Trust Model

This appendix defines the trust model for the off-chain indexer component.

### F.1 Indexer Overview

The off-chain indexer is a **read-only** component that:
- Subscribes to on-chain events
- Maintains a queryable cache of account states
- Provides API access to historical data
- **CANNOT** modify on-chain state

### F.2 What Is Indexed

| Event/Data | Source | Update Frequency |
|------------|--------|------------------|
| `MerchantPayment` events | MerchantPaymentHub | Per block |
| `InternalTransferEvent` events | PaymentHub | Per block |
| `AccountLocked` events | account-locks.fc | Per block |
| `AccountUnlocked` events | account-locks.fc | Per block |
| Account balances (via getters) | PaymentHub, MerchantPaymentHub | On-demand |
| Account states (via getters) | Account State Machine | On-demand |
| NFT ownership | NFT contracts | On-demand |

### F.3 What Is Authoritative (and What Is Not)

**⚠️ CRITICAL: Nothing from the indexer is authoritative.**

| Data Source | Authoritative? | Notes |
|-------------|----------------|-------|
| On-chain state (balances, locks) | ✅ **YES** | Single source of truth |
| On-chain events | ✅ **YES** | Immutable history |
| Indexer cache (balances) | ❌ **NO** | May lag behind chain |
| Indexer cache (events) | ❌ **NO** | May miss blocks during reorgs |
| Backend API responses | ❌ **NO** | Derived from indexer |
| External adapter confirmations | ❌ **NO** | Untrusted third parties |

**Rule:** All fund-affecting decisions MUST be made on-chain with current state, never based on indexer data.

### F.4 Fault Tolerance & Reorg Handling

| Scenario | Handling | Impact |
|----------|----------|--------|
| **Indexer downtime** | Backend returns stale data or errors | UX degradation, no fund risk |
| **Block reorg (< 5 blocks)** | Re-index affected blocks | Temporary inconsistency |
| **Block reorg (> 5 blocks)** | Full re-sync from checkpoint | Extended inconsistency |
| **Indexer data corruption** | Full re-sync from genesis | Recovery time |
| **Network partition** | Indexer falls behind | Stale data |

**Reorg Detection:**
- Compare block hashes at each height
- If mismatch detected, roll back and re-index
- Configurable reorg depth tolerance (default: 10 blocks)

### F.5 Indexer Security Properties

1. **Read-Only**: Indexer has no private keys, cannot sign transactions
2. **Non-Authoritative**: All displayed data is cached, may be stale
3. **Graceful Degradation**: Indexer failure does not prevent on-chain operations
4. **No Fund Custody**: Indexer never holds or controls user funds
5. **Public Data Only**: Indexes publicly available on-chain events

### F.6 API Trust Levels

| API Endpoint | Data Source | Trust Level | Use Case |
|--------------|-------------|-------------|----------|
| `GET /balance/:nft` | Indexer cache | ⚠️ LOW | Display only |
| `GET /history/:nft` | Indexed events | ⚠️ LOW | Display only |
| `GET /lock-status/:nft` | Indexer cache | ⚠️ LOW | Display only |
| On-chain getter | Blockchain | ✅ HIGH | Transaction validation |

**Best Practice:** Always verify critical data on-chain before executing transactions.

---

## Appendix G: Pre-Audit Freeze Checklist

This appendix defines the formal code freeze criteria for the security audit.

### G.1 Code Freeze Status

| Property | Value |
|----------|-------|
| **Freeze Date** | 2025-12-29 |
| **Freeze Commit** | `4027b9d` (Merge main into issue-22 branch) |
| **Branch** | `main` (after PR merge) |
| **Status** | 🔒 FROZEN |

### G.2 Frozen Contracts

| Contract | File | Status |
|----------|------|--------|
| MerchantPaymentHub | `contracts/MerchantPaymentHub.tact` | 🔒 FROZEN |
| PaymentHub | `contracts/payments/PaymentHub.tact` | 🔒 FROZEN |
| NFT Account Resolver (FunC) | `contracts/nft-resolver/nft_account_resolver.fc` | 🔒 FROZEN |
| NFT Account Resolver (Tact) | `contracts/nft-resolver/nft_account_resolver.tact` | 🔒 FROZEN |
| Account State Machine | `contracts/payment-hub/account-state.tact` | 🔒 FROZEN |
| Account Locks | `contracts/payments/account-locks.fc` | 🔒 FROZEN |
| Type Definitions | `contracts/types/*.tact` | 🔒 FROZEN |
| Interfaces | `contracts/interfaces/*.tact` | 🔒 FROZEN |

### G.3 Compiler & Toolchain Versions

| Tool | Version | Notes |
|------|---------|-------|
| **Tact Compiler** | Latest stable | Verify with `tact --version` |
| **FunC Compiler** | TON Labs release | Part of TON toolchain |
| **TON SDK** | Latest stable | For deployment scripts |
| **Node.js** | 18+ LTS | Test execution |
| **TypeScript** | 5.x | Test compilation |

> ⚠️ **Note:** Exact compiler versions should be captured at deployment time and recorded in the audit report.

### G.4 Target Network

| Property | Value |
|----------|-------|
| **Primary Target** | TON Mainnet |
| **Testing Networks** | TON Testnet |
| **Deployment Status** | Not yet deployed (audit first) |

### G.5 Freeze Rules

**Prohibited During Freeze:**
- ❌ Any changes to in-scope contract logic
- ❌ Adding or removing functions
- ❌ Changing state variables or storage layout
- ❌ Modifying error codes or message structures
- ❌ "Quick fixes" for audit findings

**Permitted During Freeze:**
- ✅ Documentation updates (non-code)
- ✅ Test additions (non-invasive, test files only)
- ✅ README and comment updates (no logic changes)
- ✅ CI/CD configuration changes

### G.6 Freeze Verification

To verify code freeze integrity:

```bash
# Get freeze commit hash
git rev-parse HEAD

# Compare with expected freeze commit
# Expected: 4027b9d (or later main branch commit after PR merge)

# Verify no uncommitted changes to contracts
git status contracts/

# Check contract file hashes
sha256sum contracts/MerchantPaymentHub.tact
sha256sum contracts/payments/PaymentHub.tact
sha256sum contracts/payments/account-locks.fc
sha256sum contracts/nft-resolver/nft_account_resolver.fc
sha256sum contracts/nft-resolver/nft_account_resolver.tact
sha256sum contracts/payment-hub/account-state.tact
```

### G.7 Post-Audit Unfreeze Procedure

After audit completion:

1. Create new branch for remediation
2. Apply fixes for Critical/High findings
3. Submit fixed code for re-audit
4. Receive final audit report
5. Update freeze commit to final audited version
6. Deploy to testnet for final verification
7. Deploy to mainnet

---

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-29
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.1
