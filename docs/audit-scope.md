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

2. **Threat Model**: `docs/threat-model.md`
   - Identifies 11 threat classes
   - Maps threats to affected components
   - Documents mitigations and residual risks

3. **Architecture**: `docs/architecture.md`
   - High-level protocol design
   - Trust boundaries
   - Component responsibilities

4. **Contract Documentation**: `contracts/README.md`
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
| **Threat Model** | Attack surface analysis | `docs/threat-model.md` |
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

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-27
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.0
