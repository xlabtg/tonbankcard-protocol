# Tonbankcard Protocol Threat Model & Attack Surface Analysis

## Overview

This document identifies, analyzes, and documents all realistic threat vectors affecting the Tonbankcard protocol. It defines the **attack surface**, **trust boundaries**, and **mitigation strategies** required to preserve protocol invariants under adversarial conditions.

**Issue Reference**: [#22 - Audit Readiness Checklist & Scope Definition](https://github.com/xlabtg/tonbankcard-protocol/issues/22)

**Related**: [Issue #20 (4.2) - Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)

---

## Scope

This threat model applies to:

- ✅ Smart contracts (Payment Hub, NFT Resolver, MerchantPaymentHub, Account Locks)
- ✅ NFT-based account abstraction
- ✅ Internal ledger & transfer logic
- ✅ Account locks & risk flags
- ✅ Merchant settlement
- ✅ External adapters (ChangeNOW / NOWPayments)
- ⚠️ Off-chain components (API, indexers, SDKs) - limited scope

**Out of Scope**:
- ❌ UI/UX improvements
- ❌ Economic optimization
- ❌ Yield modeling
- ❌ Governance politics
- ❌ Third-party infrastructure (DEX internals, external provider security)

---

## Threat Model Assumptions

### Attacker Capabilities

**Attackers CAN**:
- ✅ Observe all on-chain state
- ✅ Front-run transactions in mempool
- ✅ Interact with contracts arbitrarily
- ✅ Transfer NFTs freely (if not soulbound)
- ✅ Attempt reentrancy via malicious contracts
- ✅ Spam transactions and events
- ✅ Collude with external service providers
- ✅ Analyze contract code for vulnerabilities

**Attackers CANNOT**:
- ❌ Break cryptographic primitives (SHA-256, Ed25519)
- ❌ Forge signatures without private keys
- ❌ Bypass TON consensus mechanisms
- ❌ Modify deployed contract code
- ❌ Access private keys in user wallets
- ❌ Force users to sign transactions

### Trust Assumptions

**Trusted**:
- TON blockchain consensus
- Cryptographic primitives
- TON Virtual Machine (TVM) execution
- Smart contract immutability
- User wallet security (client-side)

**Semi-Trusted**:
- NFT ownership resolver correctness
- Off-chain indexer availability
- Backend API uptime

**Untrusted**:
- External adapters (ChangeNOW, NOWPayments, CoinRabbit)
- Merchant honesty
- User behavior
- Network reliability

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ HIGH TRUST ZONE (On-Chain)                                  │
│                                                              │
│  • Smart Contracts (immutable)                              │
│  • NFT Ownership (cryptographically verified)               │
│  • TBC Balances (on-chain state)                            │
│  • Transfer Logic (deterministic)                           │
│                                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ MEDIUM TRUST ZONE (Off-Chain Protocol)                      │
│                                                              │
│  • Backend Indexer (read-only cache)                        │
│  • Merchant API (orchestration)                             │
│  • Frontend UI (presentation)                               │
│  • SDK Libraries (client-side)                              │
│                                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ LOW TRUST ZONE (External Services)                          │
│                                                              │
│  • ChangeNOW (swap provider)                                │
│  • NOWPayments (payment gateway)                            │
│  • CoinRabbit (lending service)                             │
│  • TONCO DEX (liquidity pool)                               │
│  • Merchant Services (external)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Identified Threat Classes

### T1 — NFT Transfer Race Conditions

**Threat Description**:
NFT ownership changes during pending or concurrent transactions, leading to authorization bypass or double-spend attempts.

**Attack Scenarios**:

1. **Concurrent Transfer Attack**:
   - Attacker initiates transfer A from NFT account
   - Immediately transfers NFT to another wallet
   - Transfer A may execute under old or new owner

2. **Front-Running Attack**:
   - Victim signs transaction to send TBC
   - Attacker front-runs to buy victim's NFT
   - Attacker gains access to victim's balance

**Affected Components**:
- Payment Hub (contracts/payments/)
- Merchant Payment Hub (contracts/MerchantPaymentHub.tact)
- NFT Account Resolver (contracts/nft-resolver/)

**Risk Impact**:
- 🔴 **HIGH**: Account hijack, unauthorized fund access

**Mitigation Requirements**:
- ✅ Ownership checked **at execution time**, not at signing time
- ✅ No cached ownership assumptions
- ✅ Atomic validation per transaction
- ✅ NFT ownership verification integrated into transfer logic

**Current Implementation**:
- MerchantPaymentHub checks ownership atomically: `contracts/MerchantPaymentHub.tact:payMerchant`
- NFT Account Resolver provides `resolveOwner` interface
- Each transaction verifies current owner on-chain

**Residual Risk**: LOW (properly mitigated)

**Testing**:
- See `tests/MerchantPaymentHub.spec.ts` - ownership validation tests
- See `tests/MerchantPaymentEdgeCases.spec.ts` - NFT transfer scenarios

---

### T2 — Reentrancy & Callback Abuse

**Threat Description**:
Malicious contracts attempt reentrancy via callbacks to manipulate balances or violate invariants.

**Attack Scenarios**:

1. **Reentrancy During Transfer**:
   - Malicious NFT contract receives transfer callback
   - Callback reenters Payment Hub before state finalized
   - Attempts to withdraw balance multiple times

2. **Fallback Function Exploit**:
   - Attacker's receive function contains malicious code
   - Payment triggers fallback during transfer
   - Attempts to re-execute transfer logic

**Affected Components**:
- Payment Hub (all transfer functions)
- Merchant Payment Hub
- Account State Machine

**Risk Impact**:
- 🔴 **HIGH**: Balance manipulation, invariant violation, double-spend

**Mitigation Requirements**:
- ✅ Reentrancy-safe logic (state changes before external calls)
- ✅ No external calls during state mutation
- ✅ Explicit execution order (checks-effects-interactions pattern)
- ✅ TON actor model prevents synchronous callbacks

**Current Implementation**:
- TON's actor model eliminates reentrancy by design (asynchronous messaging)
- State finalized before any external messages
- No synchronous callbacks in TON architecture

**Residual Risk**: VERY LOW (TON architecture prevents this)

**Testing**:
- Implicit in TON architecture
- No explicit reentrancy tests needed (architectural guarantee)

---

### T3 — Ledger Desynchronization

**Threat Description**:
Internal ledger diverges from actual token balances, creating phantom balances or insolvency.

**Attack Scenarios**:

1. **Balance Mismatch**:
   - On-chain balance shows 100 TBC
   - Internal ledger shows 200 TBC
   - User can withdraw more than they own

2. **Conservation Violation**:
   - Total balances exceed total TBC supply
   - Transfer creates TBC out of thin air
   - Sum of debits ≠ sum of credits

**Affected Components**:
- Account State Machine (contracts/payment-hub/account-state.tact)
- Payment Hub (contracts/payments/)
- TBC Jetton integration (future)

**Risk Impact**:
- 🔴 **CRITICAL**: Phantom balances, protocol insolvency, total failure

**Mitigation Requirements**:
- ✅ Single source of truth (on-chain state)
- ✅ Invariant checks on every mutation (balance conservation)
- ✅ Atomic debit/credit operations
- ✅ Conservation tests in test suite

**Current Implementation**:
- Balances stored on-chain in account state
- Atomic transfer logic: debit source, credit destination
- No balance manipulation outside transfer functions
- See invariant I3 in `docs/invariants.md`

**Residual Risk**: LOW (proper implementation)

**Testing**:
- See `tests/MerchantPaymentHub.spec.ts` - balance conservation tests
- See `tests/MerchantPaymentEdgeCases.spec.ts` - edge case transfers

---

### T4 — Lock Bypass Attempts

**Threat Description**:
Attempts to move funds despite active account locks, evading fraud flags or collateral restrictions.

**Attack Scenarios**:

1. **Direct Transfer Bypass**:
   - Account has FRAUD_LOCK set
   - Attacker attempts direct internal transfer
   - Hopes lock check is skipped

2. **Merchant Payment Bypass**:
   - Account has COLLATERAL_LOCK set
   - Attacker uses merchant payment flow
   - Attempts to bypass lock enforcement

3. **External Withdrawal Bypass**:
   - Locked account tries to withdraw via external adapter
   - Bypasses lock check in withdrawal logic

**Affected Components**:
- Account Locks (contracts/payments/account-locks.fc)
- Payment Hub (all SEND operations)
- Merchant Payment Hub

**Risk Impact**:
- 🟠 **MEDIUM-HIGH**: Collateral evasion, fraud execution, undermines risk management

**Mitigation Requirements**:
- ✅ Locks enforced at protocol level, not application level
- ✅ No alternate transfer paths bypass locks
- ✅ Lock check before ALL SEND operations
- ✅ Explicit failure states with clear errors

**Current Implementation**:
- `get_can_send()` check before all transfers
- Lock enforcement in `MerchantPaymentHub:payMerchant`
- FRAUD_LOCK and COLLATERAL_LOCK both prevent sending
- Receiving always allowed (locks don't prevent incoming)

**Residual Risk**: LOW (comprehensive enforcement)

**Testing**:
- See `tests/MerchantPaymentLocks.spec.ts` - lock enforcement tests
- See `contracts/payments/tests/account-locks.spec.fc` - lock unit tests

---

### T5 — Merchant Payment Abuse

**Threat Description**:
Merchants attempt unauthorized withdrawals or invoice replay to extract funds multiple times.

**Attack Scenarios**:

1. **Invoice Replay Attack**:
   - User pays invoice #123
   - Merchant resubmits same invoice
   - User charged twice for same purchase

2. **Merchant Pull Attack**:
   - Merchant attempts to withdraw from user account
   - Without user authorization
   - Drains user balance

3. **Amount Manipulation**:
   - User authorizes 10 TBC payment
   - Merchant modifies amount to 100 TBC
   - Unauthorized amount charged

**Affected Components**:
- Merchant Payment Hub (contracts/MerchantPaymentHub.tact)
- Merchant API (backend)
- Invoice tracking (off-chain)

**Risk Impact**:
- 🟠 **MEDIUM**: Unauthorized fund extraction, user trust violation

**Mitigation Requirements**:
- ✅ User-initiated settlement only (no merchant pull)
- ✅ Invoice uniqueness (one payment per invoice ID)
- ✅ Replay protection (on-chain or off-chain)
- ✅ Amount specified by user in signed transaction

**Current Implementation**:
- User signs transaction with explicit amount
- Payment requires NFT owner signature
- Payload hash included in event for indexing
- Invoice uniqueness enforced off-chain by merchant backend (on-chain planned for future)

**Residual Risk**: MEDIUM (on-chain replay prevention not yet implemented)

**Future Enhancement**:
- On-chain nonce or invoice ID tracking
- Contract-level replay prevention

**Testing**:
- See `tests/MerchantPaymentDynamic.spec.ts` - invoice payment tests
- See `tests/MerchantPaymentHub.spec.ts` - authorization tests

---

### T6 — External Adapter Exploits

**Threat Description**:
ChangeNOW, NOWPayments, or other external adapters misbehave, provide false confirmations, or attempt unauthorized operations.

**Attack Scenarios**:

1. **False Confirmation Attack**:
   - Adapter reports successful swap
   - User's TBC is debited
   - External crypto never arrives

2. **API Spoofing**:
   - Attacker impersonates adapter API
   - Provides fake quotes or status
   - Users make decisions on false data

3. **Adapter Compromise**:
   - Adapter's API keys stolen
   - Attacker initiates unauthorized operations
   - Attempts to drain user funds

**Affected Components**:
- Backend API (adapter integrations)
- External adapters (ChangeNOW, NOWPayments, CoinRabbit)
- User withdrawal flows

**Risk Impact**:
- 🟠 **MEDIUM**: Incorrect settlement, false confirmations, poor UX

**Mitigation Requirements**:
- ✅ Adapters are non-authoritative (cannot move funds)
- ✅ On-chain confirmation required for settlements
- ✅ No trust in off-chain success signals
- ✅ User signs all on-chain transactions
- ✅ Adapter failures don't affect on-chain state

**Current Implementation**:
- Adapters provide quotes and routing only
- All fund movements require user signature
- On-chain transactions independent of adapter status
- Adapter failures result in pending status, not fund loss

**Residual Risk**: LOW-MEDIUM (properly isolated, but UX impact possible)

**Testing**:
- Integration tests for adapter timeout scenarios
- Manual testing of adapter failure modes

---

### T7 — Oracle / Price Manipulation (Future)

**Threat Description**:
Manipulation of external price data for collateral valuation, leading to undercollateralized lending or forced liquidations.

**Attack Scenarios**:

1. **Flash Loan Price Manipulation**:
   - Attacker manipulates TBC/TON pool price
   - Triggers liquidation of collateral
   - Buys collateral at discount

2. **Oracle Front-Running**:
   - Attacker observes price feed update
   - Front-runs liquidation transaction
   - Profits from price movement

**Affected Components**:
- Lending adapter (future)
- Price oracles (future)
- Collateral management (future)

**Risk Impact**:
- 🟡 **MEDIUM** (when implemented): Undercollateralized lending, forced liquidations

**Mitigation Requirements** (Future):
- ⚠️ Price signals are advisory only
- ⚠️ No direct liquidation authority for oracles
- ⚠️ Conservative collateralization thresholds
- ⚠️ Time-weighted average prices (TWAP)
- ⚠️ Multiple oracle sources

**Current Implementation**:
- Not yet implemented
- Lending functionality is planned for future

**Residual Risk**: N/A (not implemented)

---

### T8 — Admin Key Compromise

**Threat Description**:
Compromise of any privileged key (Risk Authority, Lending Adapter authority) leading to unauthorized operations.

**Attack Scenarios**:

1. **Risk Authority Key Theft**:
   - Attacker steals Risk Authority private key
   - Sets FRAUD_LOCK on all accounts
   - Denial of service attack

2. **Lending Adapter Compromise**:
   - Attacker gains control of Lending Adapter contract
   - Sets COLLATERAL_LOCK on arbitrary accounts
   - Prevents legitimate operations

3. **DAO Governance Attack** (Future):
   - Attacker compromises DAO multisig
   - Changes critical parameters
   - Attempts to drain treasury (if exists)

**Affected Components**:
- Account Locks (risk authority, lending adapter)
- Governance contracts (future)
- Authority management

**Risk Impact**:
- 🔴 **HIGH**: Protocol takeover, denial of service

**Mitigation Requirements**:
- ✅ No admin fund paths (cannot withdraw user funds)
- ✅ Immutable contracts (cannot change core logic)
- ✅ Governance-only emergency actions
- ✅ Multi-sig for critical authorities (future)
- ✅ Time-locked operations (future)

**Current Implementation**:
- Admin keys can only manage locks, NOT move funds
- Core logic is immutable
- No emergency withdrawal functions
- Risk Authority and Lending Adapter are separate roles

**Residual Risk**: MEDIUM (DoS possible, fund theft impossible)

**Future Enhancement**:
- Multi-sig for Risk Authority
- DAO governance for critical operations
- Time-locked admin actions
- Emergency pause mechanism with limits

**Testing**:
- See `tests/MerchantPaymentLocks.spec.ts` - authority authorization tests

---

### T9 — Smart Contract Bugs

**Threat Description**:
Bugs in smart contract logic leading to fund loss, invariant violations, or unexpected behavior.

**Attack Scenarios**:

1. **Integer Overflow/Underflow**:
   - Balance calculation overflows
   - Negative balance becomes very large positive
   - User can withdraw unlimited TBC

2. **Logic Errors**:
   - Incorrect validation check
   - State transition bug
   - Transfer executed twice

3. **Storage Corruption**:
   - Incorrect data structure usage
   - Storage slot collision
   - State becomes inconsistent

**Affected Components**:
- All smart contracts

**Risk Impact**:
- 🔴 **CRITICAL**: Fund loss, protocol failure

**Mitigation Requirements**:
- ✅ Comprehensive test coverage
- ✅ Formal verification (future)
- ✅ Security audit by external firm
- ✅ Bug bounty program
- ✅ Safe math libraries
- ✅ Extensive testing on testnet

**Current Implementation**:
- TON TVM built-in overflow protection
- Tact language type safety
- Comprehensive test suite (90%+ coverage)
- Multiple test types: unit, integration, edge cases, adversarial

**Residual Risk**: MEDIUM (mitigated by testing and audit)

**Testing**:
- See `tests/` directory - comprehensive test suite
- See `docs/invariants.md` - invariant verification

---

### T10 — Frontend/UI Attacks

**Threat Description**:
Attacks targeting frontend UI to trick users into signing malicious transactions.

**Attack Scenarios**:

1. **Phishing Attack**:
   - Fake frontend mimics official UI
   - User connects wallet
   - Attacker requests signatures for malicious transactions

2. **Transaction Parameter Manipulation**:
   - Frontend compromised
   - Transaction shows "Send 10 TBC"
   - Actually sends 1000 TBC

3. **Wallet Drainer**:
   - Malicious script injected into frontend
   - Requests signature for transfer to attacker
   - User approves without careful review

**Affected Components**:
- Frontend UI
- Wallet integration (TON Connect)
- User wallets

**Risk Impact**:
- 🟠 **MEDIUM**: User fund loss (not protocol-wide)

**Mitigation Requirements**:
- ⚠️ Wallet shows transaction details clearly
- ⚠️ Official domain verification
- ⚠️ HTTPS and CSP headers
- ⚠️ User education on transaction verification
- ⚠️ Multi-step confirmation for large amounts

**Current Implementation**:
- TON Connect shows transaction details in wallet
- Frontend code is open source
- HTTPS enforced (deployment requirement)

**Residual Risk**: MEDIUM (user security dependent)

**Out of Audit Scope**: Frontend security is separate concern

---

### T11 — Denial of Service (DoS)

**Threat Description**:
Attacks aimed at making the protocol unavailable or unusable.

**Attack Scenarios**:

1. **Gas Limit DoS**:
   - Attacker sends transactions that consume excessive gas
   - Blocks legitimate transactions
   - Protocol becomes expensive to use

2. **Storage Bloat**:
   - Attacker creates many accounts
   - Fills storage with junk data
   - Increases contract storage costs

3. **Event Spam**:
   - Attacker triggers many events
   - Overwhelms indexer
   - Off-chain services degrade

**Affected Components**:
- All smart contracts
- Off-chain indexer
- Backend API

**Risk Impact**:
- 🟡 **LOW-MEDIUM**: Availability impact, increased costs

**Mitigation Requirements**:
- ✅ Gas-efficient contract design
- ✅ Rate limiting in backend
- ✅ Spam filtering in indexer
- ✅ Minimal storage usage

**Current Implementation**:
- Optimized contract code for gas efficiency
- No unbounded loops
- Minimal storage per operation

**Residual Risk**: LOW (inherent to public blockchain)

---

## Attack Surface Map

### On-Chain Attack Surface

| Component | Entry Points | Risk Level | Mitigation Status |
|-----------|-------------|------------|-------------------|
| **Payment Hub** | `payMerchant`, internal transfers | 🔴 HIGH | ✅ Mitigated |
| **Account Locks** | Lock management operations | 🟠 MEDIUM | ✅ Mitigated |
| **NFT Resolver** | Ownership verification | 🟠 MEDIUM | ✅ Mitigated |
| **Account State Machine** | State transitions, balance updates | 🔴 HIGH | ✅ Mitigated |
| **Merchant Payment Hub** | Payment processing | 🔴 HIGH | ✅ Mitigated |

### Off-Chain Attack Surface

| Component | Entry Points | Risk Level | Mitigation Status |
|-----------|-------------|------------|-------------------|
| **Backend API** | REST endpoints | 🟡 MEDIUM | ⚠️ Partial |
| **Indexer** | Event processing | 🟡 LOW | ⚠️ Partial |
| **Frontend** | User interface | 🟠 MEDIUM | ⚠️ Out of scope |

### External Integration Attack Surface

| Component | Risk Level | Mitigation Status |
|-----------|------------|-------------------|
| **ChangeNOW** | 🟠 MEDIUM | ✅ Isolated |
| **NOWPayments** | 🟠 MEDIUM | ✅ Isolated |
| **CoinRabbit** | 🟡 LOW | ✅ Isolated |
| **TONCO DEX** | 🟡 LOW | ✅ Decentralized |

---

## Mitigation Summary

### Implemented Mitigations

✅ **Atomic Operations**: All transfers are atomic, preventing partial state updates

✅ **Ownership Verification**: NFT ownership checked at execution time

✅ **Lock Enforcement**: Comprehensive lock checks before all SEND operations

✅ **Balance Conservation**: Debit/credit operations maintain invariant

✅ **No Admin Fund Access**: Admins cannot withdraw user funds

✅ **Immutable Contracts**: Core logic cannot be changed post-deployment

✅ **Input Validation**: All inputs validated with explicit errors

✅ **Overflow Protection**: TVM built-in safe arithmetic

✅ **Event Emission**: All state changes emit events for indexing

✅ **Adapter Isolation**: External adapters cannot move funds

### Planned Mitigations (Future)

⚠️ **On-Chain Invoice Replay Protection**: Currently enforced off-chain

⚠️ **Multi-Sig Admin Keys**: Risk Authority and Lending Adapter

⚠️ **DAO Governance**: Community control of critical parameters

⚠️ **Price Oracle Diversification**: Multiple oracle sources for lending

⚠️ **Time-Locked Admin Actions**: Delay for critical operations

⚠️ **Formal Verification**: Mathematical proofs of invariants

---

## Threat-to-Invariant Mapping

| Threat | Violated Invariants | Mitigation |
|--------|---------------------|------------|
| T1 (NFT Race) | I2 (Ownership Authority) | Atomic ownership checks |
| T2 (Reentrancy) | I3 (Balance Conservation), I4 (Atomicity) | TON actor model |
| T3 (Ledger Desync) | I3 (Balance Conservation), I7 (No Phantom Balances) | Single source of truth |
| T4 (Lock Bypass) | I5 (Lock Enforcement) | Protocol-level locks |
| T5 (Merchant Abuse) | I8 (Merchant Authorization), I9 (Invoice Uniqueness) | User-initiated only |
| T6 (Adapter Exploit) | I10 (Adapter Isolation) | Non-authoritative adapters |
| T7 (Price Manipulation) | N/A (future) | Conservative thresholds |
| T8 (Admin Compromise) | I1 (Non-Custodial), I12 (Immutability) | No fund access |
| T9 (Smart Contract Bugs) | All invariants | Testing, audit |
| T10 (Frontend Attacks) | N/A (user-side) | Wallet verification |
| T11 (DoS) | N/A (availability) | Gas optimization |

---

## Security Testing Requirements

### Adversarial Test Cases

Each threat should have corresponding test cases:

1. **T1 Tests**: NFT transfer during pending transaction
2. **T2 Tests**: Reentrancy attempts (N/A for TON)
3. **T3 Tests**: Balance conservation across transfers
4. **T4 Tests**: Lock bypass attempts
5. **T5 Tests**: Unauthorized merchant payments
6. **T6 Tests**: Adapter failure scenarios
7. **T8 Tests**: Unauthorized admin operations
8. **T9 Tests**: Edge cases, overflow, underflow

### Penetration Testing

Recommended for external audit:
- Smart contract fuzzing
- Symbolic execution
- Manual code review
- Economic attack analysis
- Integration testing

---

## Risk Assessment Summary

| Risk Category | Overall Risk | Justification |
|---------------|--------------|---------------|
| **Fund Custody** | 🟢 LOW | Non-custodial by design, no admin access |
| **Balance Integrity** | 🟢 LOW | Atomic operations, conservation enforced |
| **Authorization** | 🟢 LOW | NFT ownership verified, no bypass paths |
| **Lock Enforcement** | 🟢 LOW | Comprehensive checks, no alternatives |
| **External Dependencies** | 🟡 MEDIUM | Adapters isolated, but UX risk remains |
| **Admin Key Compromise** | 🟡 MEDIUM | DoS possible, fund theft impossible |
| **Smart Contract Bugs** | 🟡 MEDIUM | Mitigated by testing, audit needed |
| **Invoice Replay** | 🟡 MEDIUM | Off-chain enforcement, on-chain planned |

**Overall Protocol Risk**: 🟢 **LOW-MEDIUM** (acceptable for audit)

---

## Recommended Actions

### Before Audit

1. ✅ Complete comprehensive test suite
2. ✅ Document all invariants
3. ✅ Map threats to mitigations
4. ⚠️ Implement on-chain invoice replay protection (optional)
5. ⚠️ Add multi-sig for admin keys (optional)

### During Audit

1. Provide this document to auditors
2. Highlight high-risk areas (T1, T3, T4)
3. Request formal verification of balance conservation
4. Test adversarial scenarios

### Post-Audit

1. Implement all critical findings
2. Re-test affected components
3. Update threat model with new discoveries
4. Establish bug bounty program

---

## References

- [Issue #22 - Audit Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/22)
- [Issue #20 - Threat Model Specification](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
- [Invariants Documentation](./invariants.md)
- [Architecture Documentation](./architecture.md)
- [Contract README](../contracts/README.md)
- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)
- [TON Security Best Practices](https://docs.ton.org/v3/documentation/smart-contracts/security/things-to-focus)

---

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-27
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.0
