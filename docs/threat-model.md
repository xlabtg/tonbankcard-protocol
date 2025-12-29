# TONBANKCARD Protocol — Threat Model & Attack Surface Analysis

**Document Type:** Security Architecture
**Issue Reference:** [#20 - Issue 4.2 Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
**Dependencies:** [#18 - Issue 4.1 Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
**Status:** Living Documentation
**Last Updated:** 2025-12-27

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Threat Model Assumptions](#threat-model-assumptions)
3. [Trust Boundaries](#trust-boundaries)
4. [Attack Surface Map](#attack-surface-map)
5. [Threat Classes & Mitigations](#threat-classes--mitigations)
6. [Threat-to-Contract Mapping](#threat-to-contract-mapping)
7. [Threat-to-Invariant Mapping](#threat-to-invariant-mapping)
8. [Residual Risks](#residual-risks)
9. [Monitoring & Detection](#monitoring--detection)
10. [Audit Checklist](#audit-checklist)

---

## Executive Summary

This document identifies, analyzes, and documents all realistic threat vectors affecting the TONBANKCARD protocol. The protocol implements a **non-custodial virtual bank** on TON blockchain using NFT-based account abstraction and TBC token settlement.

### Core Security Guarantees

1. **Non-Custodial**: Protocol never takes custody of user funds
2. **NFT = Authority**: NFT ownership is sole authority over accounts
3. **No Admin Override**: No privileged roles can move user funds
4. **Atomic Operations**: All transfers are atomic (succeed fully or revert)
5. **Ledger Conservation**: Internal balances always conserve total supply

### Threat Model Scope

This analysis covers:
- Smart contracts (Payment Hub, NFT Resolver, Account Locks)
- NFT-based account abstraction
- Internal ledger & transfer logic
- Account locks & collateral flags
- Merchant settlement flows
- External adapters (ChangeNOW, NOWPayments)
- Off-chain components (API, indexers, SDKs)

---

## Threat Model Assumptions

### Attacker Capabilities

**Attackers CAN:**
- Observe all on-chain state and transactions
- Front-run transactions (MEV attacks)
- Interact with smart contracts arbitrarily
- Transfer NFTs freely on open markets
- Deploy malicious contracts that interact with protocol
- Attempt reentrancy via callbacks
- Send crafted messages to contracts
- Analyze contract bytecode
- Monitor mempool for pending transactions

**Attackers CANNOT:**
- Break cryptographic primitives (ECDSA, SHA-256)
- Forge digital signatures
- Bypass TON consensus mechanism
- Modify immutable contract code
- Access user private keys (unless compromised externally)
- Manipulate block timestamps beyond consensus rules
- Execute transactions without gas fees

### System Assumptions

**We ASSUME:**
- TON blockchain consensus is secure and Byzantine-fault tolerant
- TON Virtual Machine (TVM) executes code deterministically
- NFT contracts correctly implement ownership semantics
- TBC jetton contract correctly implements TEP-74 standard
- Off-chain indexers may lag but eventually sync
- Users protect their private keys responsibly
- External APIs (ChangeNOW, NOWPayments) may be adversarial

**We DO NOT ASSUME:**
- Off-chain components are always available
- External price oracles are truthful
- External adapters act honestly
- All users are honest actors
- Network conditions are always optimal

---

## Trust Boundaries

### Boundary Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                     TRUST BOUNDARY LEVEL 1                     │
│                      (HIGHEST TRUST)                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            TON Blockchain Consensus Layer               │  │
│  │  - Validator consensus (Byzantine Fault Tolerant)      │  │
│  │  - Block finality guarantees                           │  │
│  │  - Cryptographic primitives (signatures, hashes)       │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                     TRUST BOUNDARY LEVEL 2                     │
│                  (HIGH TRUST - IMMUTABLE)                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          Protocol Smart Contracts (On-Chain)            │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │  │
│  │  │ Payment Hub   │  │  NFT Resolver │  │ Account     │ │  │
│  │  │ (payment-hub  │  │  (nft_account │  │ Locks       │ │  │
│  │  │  .fc)         │  │  _resolver.fc)│  │ (account-   │ │  │
│  │  └───────────────┘  └───────────────┘  │  locks.fc)  │ │  │
│  │                                         └─────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  External Immutable Contracts                    │  │  │
│  │  │  - NFT Collections (7777, 8888)                  │  │  │
│  │  │  - TBC Jetton Master & Wallets                   │  │  │
│  │  │  - TONCO DEX (liquidity pool)                    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                     TRUST BOUNDARY LEVEL 3                     │
│                  (MEDIUM TRUST - OFF-CHAIN)                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          Protocol Off-Chain Components                  │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │  Backend   │  │  Merchant   │  │  Frontend UI    │  │  │
│  │  │  Indexer   │  │  API        │  │  (Wallet/Widget)│  │  │
│  │  │  (read-    │  │  (orchestr- │  │  (presentation) │  │  │
│  │  │   only)    │  │   ation)    │  │                 │  │  │
│  │  └────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                     TRUST BOUNDARY LEVEL 4                     │
│                 (LOW TRUST - EXTERNAL SERVICES)               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              External Third-Party Services              │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │ ChangeNOW   │  │ NOWPayments  │  │ CoinRabbit    │  │  │
│  │  │ (swap API)  │  │ (payment API)│  │ (lending API) │  │  │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │  │
│  │                                                          │  │
│  │  ⚠️  UNTRUSTED: Cannot modify on-chain state           │  │
│  │  ⚠️  May return false data or be unavailable           │  │
│  │  ⚠️  Interactions require on-chain confirmation        │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Trust Boundary Rules

#### Level 1: Blockchain Consensus (Absolute Trust)
- **What**: TON validator consensus, cryptographic primitives
- **Trust Level**: Absolute (foundation of all security)
- **Failure Impact**: Catastrophic (protocol cannot function)

#### Level 2: Smart Contracts (High Trust - Immutable)
- **What**: Protocol contracts, existing NFT/TBC contracts
- **Trust Level**: High (immutable, auditable, deterministic)
- **Protection**: Code immutability, no upgrade paths, no admin keys
- **Failure Impact**: Critical (requires new contract deployment)

#### Level 3: Off-Chain Components (Medium Trust - Read-Only)
- **What**: Indexers, APIs, frontend UIs
- **Trust Level**: Medium (can fail or be malicious, but cannot move funds)
- **Protection**: Read-only access, user-signed transactions, blockchain as source of truth
- **Failure Impact**: Service degradation (users can interact directly with contracts)

#### Level 4: External Services (Low Trust - Adversarial)
- **What**: ChangeNOW, NOWPayments, CoinRabbit, price oracles
- **Trust Level**: Low (assume adversarial)
- **Protection**: On-chain confirmation required, no authority over funds
- **Failure Impact**: Service-specific (protocol continues functioning)

---

## Attack Surface Map

### Smart Contract Attack Surface

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT HUB CONTRACT                        │
│                   (payment-hub.fc - 372 lines)                   │
├─────────────────────────────────────────────────────────────────┤
│  PUBLIC ENTRY POINTS (Attack Vectors):                          │
│                                                                  │
│  1. recv_internal()                       [Lines 266-332]       │
│     ├─ op::internal_transfer              [Line 287]           │
│     │  └─ handle_internal_transfer()      [Lines 127-163]      │
│     │     ├─ verify_nft_account()         [Lines 96-112]       │
│     │     └─ emit_event()                 [Lines 115-124]      │
│     │                                                            │
│     ├─ op::merchant_payment               [Line 297]           │
│     │  └─ handle_merchant_payment()       [Lines 166-197]      │
│     │     ├─ verify_nft_account()         [Lines 96-112]       │
│     │     └─ emit_event()                 [Lines 115-124]      │
│     │                                                            │
│     ├─ op::payment_received               [Line 307]           │
│     │  └─ handle_payment_received()       [Lines 200-230]      │
│     │                                                            │
│     ├─ op::set_paused (ADMIN ONLY)        [Line 317]           │
│     │  └─ handle_set_paused()             [Lines 233-239]      │
│     │                                                            │
│     └─ op::account_flagged (ADMIN ONLY)   [Line 323]           │
│        └─ handle_flag_account()           [Lines 242-263]      │
│                                                                  │
│  CRITICAL DEPENDENCIES:                                         │
│     ├─ get_nft_owner() - NFT ownership query [Lines 73-80]     │
│     ├─ blocked_accounts dictionary                             │
│     └─ nft_collection_addresses whitelist                      │
│                                                                  │
│  THREAT VECTORS:                                                │
│     ⚠️  T1: NFT ownership race conditions                       │
│     ⚠️  T2: Reentrancy via callbacks                            │
│     ⚠️  T3: Ledger desynchronization (phantom balances)         │
│     ⚠️  T4: Admin key compromise (pause/block abuse)            │
│     ⚠️  T8: Admin key compromise (emergency functions)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNT LOCKS CONTRACT                        │
│                  (account-locks.fc - 261 lines)                  │
├─────────────────────────────────────────────────────────────────┤
│  PUBLIC ENTRY POINTS (Attack Vectors):                          │
│                                                                  │
│  1. recv_internal()                       [Lines 141-232]       │
│     ├─ op::set_fraud_lock                 [Line 160]           │
│     │  └─ emit_account_locked()           [Lines 113-124]      │
│     │                                                            │
│     ├─ op::clear_fraud_lock               [Line 175]           │
│     │  └─ emit_account_unlocked()         [Lines 127-138]      │
│     │                                                            │
│     ├─ op::set_collateral_lock            [Line 190]           │
│     │  └─ emit_account_locked()           [Lines 113-124]      │
│     │                                                            │
│     ├─ op::clear_collateral_lock          [Line 205]           │
│     │  └─ emit_account_unlocked()         [Lines 127-138]      │
│     │                                                            │
│     └─ op::check_can_send                 [Line 220]           │
│        └─ can_send()                      [Lines 83-92]        │
│                                                                  │
│  AUTHORIZATION:                                                 │
│     ├─ risk_authority (fraud locks)       [Line 162, 177]      │
│     └─ lending_adapter (collateral locks) [Line 192, 207]      │
│                                                                  │
│  PUBLIC GET METHODS:                                            │
│     ├─ get_lock_state()                   [Lines 57-73]        │
│     ├─ is_account_locked()                [Lines 76-79]        │
│     ├─ can_send()                         [Lines 83-92]        │
│     └─ can_receive()                      [Lines 95-98]        │
│                                                                  │
│  THREAT VECTORS:                                                │
│     ⚠️  T4: Lock bypass attempts (alternate paths)              │
│     ⚠️  T6: Lock flag manipulation (if authorities compromised) │
│     ⚠️  T8: Risk authority or lending adapter key compromise    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    NFT RESOLVER CONTRACT                         │
│               (nft_account_resolver.fc - 150 lines)              │
├─────────────────────────────────────────────────────────────────┤
│  PUBLIC ENTRY POINTS (Attack Vectors):                          │
│                                                                  │
│  1. recv_internal()                       [Lines 124-142]       │
│     └─ REJECTS ALL MESSAGES (read-only)   [Line 141]           │
│                                                                  │
│  PUBLIC GET METHODS (READ-ONLY):                                │
│     ├─ resolve_owner_with_validation()    [Lines 61-69]        │
│     ├─ is_valid_account_nft()             [Lines 74-91]        │
│     ├─ get_account_flags()                [Lines 96-105]       │
│     ├─ is_whitelisted_collection()        [Lines 108-110]      │
│     ├─ get_whitelisted_collections()      [Lines 113-115]      │
│     └─ get_payment_hub()                  [Lines 118-120]      │
│                                                                  │
│  HARDCODED WHITELISTS:                                          │
│     ├─ Collection 7777                    [Lines 22-30]        │
│     └─ Collection 8888                    [Lines 32-40]        │
│                                                                  │
│  THREAT VECTORS:                                                │
│     ⚠️  T1: NFT transfer race (stale ownership reads)           │
│     ✅  MINIMAL RISK: Contract is stateless and read-only       │
└─────────────────────────────────────────────────────────────────┘
```

### External Interfaces Attack Surface

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL ADAPTER INTERFACES                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ChangeNOW API (Crypto Swaps)                                │
│     ├─ createTransaction()                                      │
│     ├─ getTransactionStatus()                                   │
│     └─ getEstimatedExchangeAmount()                             │
│                                                                  │
│     THREAT VECTORS:                                             │
│     ⚠️  T6: False transaction confirmations                     │
│     ⚠️  T6: Rate manipulation (slippage attacks)                │
│     ⚠️  T6: API spoofing (MITM)                                 │
│                                                                  │
│  2. NOWPayments API (Payment Processing)                        │
│     ├─ createInvoice()                                          │
│     ├─ getPaymentStatus()                                       │
│     └─ webhookCallback()                                        │
│                                                                  │
│     THREAT VECTORS:                                             │
│     ⚠️  T5: Invoice replay attacks                              │
│     ⚠️  T6: Webhook spoofing                                    │
│     ⚠️  T6: Payment status manipulation                         │
│                                                                  │
│  3. CoinRabbit API (Lending/Collateral)                         │
│     ├─ createLoan()                                             │
│     ├─ getLoanStatus()                                          │
│     └─ collateralCallback()                                     │
│                                                                  │
│     THREAT VECTORS:                                             │
│     ⚠️  T7: Price oracle manipulation                           │
│     ⚠️  T6: False liquidation signals                           │
│                                                                  │
│  MITIGATIONS (ALL ADAPTERS):                                    │
│     ✅  Adapters are NON-AUTHORITATIVE                          │
│     ✅  On-chain confirmation required for all operations       │
│     ✅  No direct contract access to external APIs              │
│     ✅  User must sign all fund movements                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OFF-CHAIN COMPONENTS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Backend Indexer                                             │
│     ├─ Monitors blockchain events                              │
│     ├─ Caches NFT ownership changes                            │
│     ├─ Indexes TBC transfers                                    │
│     └─ Provides query endpoints (READ-ONLY)                    │
│                                                                  │
│     THREAT VECTORS:                                             │
│     ⚠️  T3: Stale cache serving incorrect data                  │
│     ⚠️  Indexer compromise (DoS, data manipulation)             │
│                                                                  │
│  2. Merchant API                                                │
│     ├─ Accepts payment requests                                │
│     ├─ Generates payment links                                 │
│     ├─ Tracks payment status                                   │
│     └─ Sends webhook notifications                             │
│                                                                  │
│     THREAT VECTORS:                                             │
│     ⚠️  T5: Merchant payment abuse (unauthorized withdrawals)   │
│     ⚠️  API authentication bypass                               │
│     ⚠️  Webhook injection                                       │
│                                                                  │
│  MITIGATIONS:                                                   │
│     ✅  READ-ONLY access to blockchain                          │
│     ✅  Cannot initiate transactions without user signature     │
│     ✅  Blockchain remains source of truth                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Threat Classes & Mitigations

### T1 — NFT Transfer Race Conditions

#### Description
NFT ownership can change during pending or concurrent transactions, leading to:
- Account hijack (new owner controls old owner's pending operations)
- Double-spend attempts (NFT transferred mid-transaction)
- Authorization bypass (ownership check vs. execution timing gap)

#### Attack Scenario
```
1. Alice owns NFT #7777001 with 1000 TBC balance
2. Alice initiates transfer: NFT #7777001 → NFT #8888001, 500 TBC
3. Before transaction executes, Alice transfers NFT #7777001 to Bob
4. Bob now owns NFT #7777001
5. Transaction executes - who authorized it? Alice (then) or Bob (now)?
```

#### Affected Components
- **Payment Hub Contract**: `handle_internal_transfer()` [payment-hub.fc:127-163]
- **Payment Hub Contract**: `handle_merchant_payment()` [payment-hub.fc:166-197]
- **NFT Resolver Contract**: All ownership queries

#### Risk Level
**HIGH** - Can lead to unauthorized fund movement

#### Current Mitigations

✅ **Ownership Checked at Execution Time**
```func
// payment-hub.fc:135
var (valid, owner) = verify_nft_account(from_nft, sender_address);
```
- Ownership verified when transaction executes, not when submitted
- Uses on-chain `get_nft_owner()` call to NFT contract
- No cached ownership assumptions

✅ **Atomic Validation Per Call**
- Each message handled independently
- No state persisted between ownership checks
- Sender must be current owner at execution time

#### Residual Risks

⚠️ **Front-Running Risk**: Attacker can observe pending transfer and front-run with NFT purchase
- **Severity**: LOW (attacker must legitimately purchase NFT)
- **Impact**: New owner gains access to account balance (intended behavior)

⚠️ **MEV (Maximal Extractable Value)**: Validators can reorder transactions
- **Severity**: MEDIUM (TON's consensus makes this difficult)
- **Impact**: Transaction ordering may favor certain actors

#### Recommended Additional Mitigations

1. **Nonce-Based Transaction Ordering** (Future Enhancement)
   - Add per-account nonce to prevent replay and ordering attacks
   - Not implemented in current version

2. **Time-Locked Transfers** (Future Enhancement)
   - Allow users to set transfer delays for high-value NFTs
   - Not in current scope

#### Test Coverage
See: `tests/adversarial/nft-race-conditions.spec.fc`

---

### T2 — Reentrancy & Callback Abuse

#### Description
Malicious contracts attempt reentrancy via callbacks during fund transfers or state changes.

#### Attack Scenario
```
1. Attacker deploys malicious NFT contract
2. Malicious NFT's recv_internal() triggers callback to Payment Hub
3. During Payment Hub's execution, callback attempts to:
   - Re-enter transfer function
   - Manipulate balance before debit completes
   - Violate invariant I5 (ledger conservation)
```

#### Affected Components
- **Payment Hub Contract**: All message handlers
- **Account Locks Contract**: Lock state modification handlers

#### Risk Level
**MEDIUM** - TON's actor model provides inherent protection

#### Current Mitigations

✅ **TON Actor Model**
- TON uses message-passing actor model, not EVM-style calls
- No synchronous external calls during execution
- Each message handled atomically in separate transaction

✅ **No External Calls During State Mutation**
```func
// payment-hub.fc:287-295
if (op == op::internal_transfer) {
    slice from_nft = in_msg_body~load_msg_addr();
    slice to_nft = in_msg_body~load_msg_addr();
    int amount = in_msg_body~load_coins();
    cell memo = in_msg_body~load_ref();

    handle_internal_transfer(sender_address, from_nft, to_nft, amount, memo);
    return ();  // No further execution
}
```
- All state changes complete before any messages sent
- `emit_event()` sends external message AFTER all state mutations
- No callbacks during critical section

✅ **Explicit Execution Order**
- Load data → Validate → Update state → Save data → Emit events
- Order enforced by function design

#### Residual Risks

⚠️ **Cross-Contract Message Ordering**: Malicious contract can send multiple messages
- **Severity**: LOW (each message processed atomically)
- **Impact**: Cannot violate atomicity of single transaction

#### Test Coverage
See: `tests/adversarial/reentrancy-attempts.spec.fc`

---

### T3 — Ledger Desynchronization

#### Description
Internal ledger diverges from actual TBC token balances, creating:
- Phantom balances (ledger shows more than jetton wallet holds)
- Insolvency illusion (protocol appears solvent but isn't)
- Double-spend via desync exploitation

#### Attack Scenario
```
1. Internal ledger: Account A has 1000 TBC
2. Actual jetton wallet: Account A has 500 TBC
3. Account A attempts to transfer 750 TBC
4. If ledger check passes but jetton transfer fails → desync
5. Ledger shows 250 TBC remaining, but wallet still has 500 TBC
```

#### Affected Components
- **Payment Hub Contract**: Balance tracking (not yet implemented)
- **TBC Jetton Wallets**: Actual token custody
- **Off-Chain Indexer**: Balance caching

#### Risk Level
**CRITICAL** - Violates invariant I5 (Ledger Conservation)

#### Current Mitigations

✅ **Single Source of Truth: TBC Jetton Contract**
```func
// payment-hub.fc:146-153 (CURRENT IMPLEMENTATION - DEMO ONLY)
// In actual implementation, this would:
// 1. Get TBC jetton wallet address for from_nft
// 2. Send jetton transfer message
// 3. Jetton wallet validates balance and executes transfer
```
- Payment Hub does NOT maintain internal balance ledger
- All balances stored in TBC jetton wallets (existing immutable contract)
- Payment Hub only validates and routes transfer requests

✅ **Jetton Transfer Validation**
- TBC jetton wallets validate sufficient balance before transfer
- Transfer either completes fully or reverts (atomic)
- No partial transfers possible

✅ **Invariant Checks on Every Mutation**
- Jetton contract enforces conservation: `Σ(balances_before) = Σ(balances_after)`
- Payment Hub cannot override jetton wallet logic

#### Residual Risks

⚠️ **Off-Chain Indexer Staleness**: Cached balances may be stale
- **Severity**: MEDIUM (informational only)
- **Impact**: UI shows incorrect balance, but on-chain truth prevails
- **Mitigation**: Indexer includes block height/timestamp, UI warns on stale data

⚠️ **Cross-Contract Race**: NFT transfer + jetton transfer in same block
- **Severity**: LOW (both are atomic, no intermediate state visible)
- **Impact**: Temporary inconsistency resolved by block finality

#### Additional Safeguards Required

🔧 **Production Implementation Must:**
1. Query TBC jetton wallet address for NFT account
2. Send jetton transfer message with proper format (TEP-74)
3. Handle jetton transfer success/failure notifications
4. Never cache balances internally

#### Test Coverage
See: `tests/adversarial/ledger-conservation.spec.fc`

---

### T4 — Lock Bypass Attempts

#### Description
Attackers attempt to move funds despite active account locks (FRAUD_LOCK or COLLATERAL_LOCK).

#### Attack Scenario
```
1. Account locked with COLLATERAL_LOCK (used as loan collateral)
2. Attacker attempts to:
   a) Direct jetton transfer (bypass Payment Hub)
   b) NFT transfer to new owner who initiates transfer
   c) Exploit alternate transfer paths
   d) Manipulate lock flags directly
```

#### Affected Components
- **Account Locks Contract**: Lock enforcement [account-locks.fc:83-92]
- **Payment Hub Contract**: Lock checking before transfers
- **TBC Jetton Wallets**: Direct transfer path (BYPASS RISK)

#### Risk Level
**HIGH** - Violates invariant I6 (Lock ≠ Confiscation)

#### Current Mitigations

✅ **Locks Enforced at Protocol Level**
```func
// account-locks.fc:83-92
int can_send(slice nft_address) method_id {
    (int fraud_locked, int collateral_locked) = get_lock_state(nft_address);

    // Cannot send if either fraud_locked or collateral_locked
    if (fraud_locked | collateral_locked) {
        return 0;
    }

    return 1;
}
```

✅ **Payment Hub Integration**
```func
// payment-hub.fc:135
var (valid, owner) = verify_nft_account(from_nft, sender_address);
// Should also check: can_send(from_nft) via Account Locks contract
```

✅ **Receiving Always Allowed**
```func
// account-locks.fc:95-98
int can_receive(slice nft_address) method_id {
    return 1;  // RECEIVE operations are always allowed
}
```
- Locked accounts can still receive funds
- Prevents "confiscation" semantics
- Complies with invariant I6

#### Current Vulnerabilities

❌ **CRITICAL: Payment Hub Does Not Check Locks**
- Current implementation validates NFT ownership but does NOT call Account Locks
- Lines payment-hub.fc:135 verify ownership only
- Missing integration with `account-locks.fc::can_send()`

❌ **CRITICAL: TBC Jetton Direct Transfer Bypass**
- Users can transfer TBC jetton tokens DIRECTLY via jetton wallet
- TBC jetton contract is immutable and does NOT know about Account Locks
- Locks only enforced if transfers go through Payment Hub

#### Required Mitigations

🔧 **MUST FIX: Payment Hub Lock Checking**
```func
// Required addition to payment-hub.fc:135
var (valid, owner) = verify_nft_account(from_nft, sender_address);

// ADD THIS CHECK:
int sender_can_send = account_locks.can_send(from_nft);
throw_unless(error::account_blocked, sender_can_send);
```

🔧 **MUST FIX: TBC Jetton Integration**
**Option 1: Wrapper Contract (Recommended)**
- Deploy wrapper around TBC jetton wallets
- Wrapper checks Account Locks before forwarding transfers
- Requires migration of user balances

**Option 2: Social Convention**
- Document that locks are ADVISORY only via direct jetton transfers
- Require all protocol integrations use Payment Hub
- Marketplace integration displays lock warnings

**Current Status**: Option 2 (advisory locks) is default due to immutable TBC contract

#### Residual Risks

⚠️ **Direct Jetton Transfer Bypass**: Users can bypass locks via direct jetton transfer
- **Severity**: HIGH (fundamental architectural limitation)
- **Impact**: Locks are ADVISORY for direct transfers, ENFORCED for Payment Hub transfers
- **Mitigation**: Off-chain monitoring, marketplace integration, social consensus

⚠️ **Lock Flag Manipulation**: If risk_authority or lending_adapter keys compromised
- **Severity**: HIGH (can unlock fraudulent accounts)
- **Impact**: Fraudulent accounts can move funds
- **Mitigation**: Use multi-sig or DAO governance for lock authorities

#### Test Coverage
See: `tests/adversarial/lock-bypass-attempts.spec.fc`

---

### T5 — Merchant Payment Abuse

#### Description
Merchants attempt unauthorized withdrawals, invoice replay, or payment manipulation.

#### Attack Scenario
```
Scenario 1: Invoice Replay
1. Customer pays invoice #12345 for 100 TBC
2. Merchant resubmits same invoice #12345
3. If no replay protection, customer charged twice

Scenario 2: Unauthorized Settlement
1. Merchant claims payment without user authorization
2. Attempts to pull funds from customer account
3. Protocol must reject non-user-initiated transfers

Scenario 3: Payload Manipulation
1. Customer authorizes payment with payload: {item: "A", price: 100}
2. Merchant modifies payload to: {item: "B", price: 200}
3. Signature validation must prevent this
```

#### Affected Components
- **Payment Hub Contract**: `handle_merchant_payment()` [payment-hub.fc:166-197]
- **Merchant API**: Invoice generation and tracking
- **Off-Chain Indexer**: Payment event monitoring

#### Risk Level
**MEDIUM** - Mitigated by user-initiated transaction model

#### Current Mitigations

✅ **User-Initiated Settlement Only**
```func
// payment-hub.fc:174
var (valid, owner) = verify_nft_account(payer_nft, sender_address);
```
- `sender_address` must be payer NFT owner
- Merchants CANNOT pull funds from customer accounts
- All merchant payments require customer signature

✅ **Atomic Payment Execution**
- Payment completes fully or reverts
- No partial payments
- No pending settlement states

✅ **Event Emission for Tracking**
```func
// payment-hub.fc:189-195
cell event_data = begin_cell()
    .store_slice(payer_nft)
    .store_slice(merchant_nft)
    .store_coins(amount)
    .store_ref(payment_details)
    .end_cell();

emit_event(op::merchant_payment, event_data);
```
- All merchant payments logged on-chain
- Off-chain indexer can detect anomalies
- Payment details hashed for integrity

#### Current Vulnerabilities

⚠️ **NO INVOICE UNIQUENESS CONSTRAINT**
```func
// payment-hub.fc:171 - payment_details contains invoice_id
cell payment_details  ;; Contains: invoice_id, order_id, memo
```
- Contract does NOT check for duplicate invoice IDs
- Same invoice can be paid multiple times
- Replay protection is OFF-CHAIN only

⚠️ **NO PAYLOAD INTEGRITY CHECK**
- `payment_details` cell is arbitrary data
- Contract does not validate structure
- Merchant can claim any data was in payload (off-chain dispute)

#### Recommended Mitigations

🔧 **Invoice Uniqueness (Future Enhancement)**
```func
// Pseudocode for future implementation
global cell paid_invoices;  // Dictionary: invoice_hash -> paid

() handle_merchant_payment(...) {
    int invoice_hash = cell_hash(payment_details);
    var (already_paid, _) = paid_invoices.udict_get?(256, invoice_hash);
    throw_if(error::invoice_already_paid, already_paid);

    // ... existing logic ...

    paid_invoices~udict_set(256, invoice_hash, begin_cell().store_uint(1, 1).end_cell().begin_parse());
}
```
- Prevents invoice replay on-chain
- Requires storage for paid invoice hashes
- Not implemented in current version

🔧 **Payload Signing (Off-Chain)**
- Merchant generates invoice with signature
- Payment details include merchant's signature over invoice data
- UI validates signature before user signs transaction
- Not enforced on-chain (user can bypass)

#### Residual Risks

⚠️ **Invoice Replay**: Users can pay same invoice multiple times
- **Severity**: LOW (user authorizes each payment explicitly)
- **Impact**: Accidental double-payment possible
- **Mitigation**: Off-chain invoice tracking, UI warnings

⚠️ **Merchant Impersonation**: Attacker sends payment to wrong merchant_nft
- **Severity**: LOW (user must sign transaction with merchant address)
- **Impact**: User funds sent to wrong recipient
- **Mitigation**: UI displays merchant details before signature

#### Test Coverage
See: `tests/adversarial/merchant-payment-abuse.spec.fc`

---

### T6 — External Adapter Exploits

#### Description
External providers (ChangeNOW, NOWPayments, CoinRabbit) misbehavior or API spoofing:
- False transaction confirmations
- Incorrect settlement signals
- API response manipulation
- Man-in-the-middle attacks

#### Attack Scenario
```
Scenario 1: False Confirmation (ChangeNOW)
1. User requests swap: 1000 TON → TBC
2. ChangeNOW API returns: "Transaction confirmed, 50000 TBC sent"
3. User's TBC wallet shows no deposit (false confirmation)
4. Protocol must not credit balance based on API response alone

Scenario 2: API Spoofing (MITM)
1. Attacker intercepts API call to NOWPayments
2. Returns fake payment status: "Invoice paid"
3. Merchant ships goods before on-chain confirmation
4. Actual payment never occurred

Scenario 3: Price Manipulation (CoinRabbit)
1. Attacker manipulates price oracle data
2. Makes collateral appear more valuable than reality
3. Takes out under-collateralized loan
4. Defaults when actual prices revealed
```

#### Affected Components
- **Off-Chain Adapters**: ChangeNOW, NOWPayments, CoinRabbit API clients
- **Merchant API**: External settlement coordination
- **Payment Hub Contract**: External deposit handling [payment-hub.fc:200-230]

#### Risk Level
**MEDIUM** - External services are untrusted, but cannot directly affect on-chain state

#### Current Mitigations

✅ **Adapters Are Non-Authoritative**
- External API responses are INFORMATIONAL only
- Cannot trigger on-chain state changes directly
- All fund movements require on-chain confirmation

✅ **On-Chain Confirmation Required**
```func
// payment-hub.fc:200-230 - handle_payment_received
() handle_payment_received(
    slice recipient_nft,
    int amount,
    slice source_address,  // Must be on-chain source (DEX, jetton transfer)
    cell details
) impure {
    // ... validation ...

    // In actual implementation:
    // - Verify incoming jetton transfer notification
    // - Credit to recipient NFT's jetton wallet
    // - Source could be DEX contract after swap
```
- Payment Hub only processes actual on-chain jetton transfers
- Cannot be triggered by external API call
- Source must be verifiable on-chain address

✅ **No Trust in Off-Chain Success Signals**
- Merchant API does NOT auto-settle based on external API responses
- User must confirm on-chain receipt before settlement finalized
- Blockchain is source of truth for all balances

#### Integration Architecture

```
User Initiates External Deposit:
1. [OFF-CHAIN] User → Frontend → Merchant API → ChangeNOW API
   └─ Creates swap order, returns deposit address

2. [ON-CHAIN] User → ChangeNOW Deposit Address
   └─ User sends crypto to ChangeNOW

3. [EXTERNAL] ChangeNOW processes swap (UNTRUSTED)
   └─ May succeed, fail, or be malicious

4. [ON-CHAIN] ChangeNOW → TONCO DEX → User's TBC Jetton Wallet
   └─ ONLY THIS STEP MATTERS - blockchain confirms receipt

5. [OFF-CHAIN] Indexer detects jetton transfer → Updates UI
   └─ Informational only, users can verify on-chain directly
```

#### Current Vulnerabilities

⚠️ **UI May Display External API Data**: Frontend might show "pending" status from API
- **Severity**: LOW (informational only)
- **Impact**: User confusion if API lies
- **Mitigation**: Always display on-chain confirmation status

⚠️ **Merchant API Webhook Spoofing**: Attacker sends fake webhook
- **Severity**: MEDIUM (depends on merchant API auth)
- **Impact**: Merchant ships goods before payment
- **Mitigation**: Webhook signature verification, on-chain confirmation check

#### Required Additional Mitigations

🔧 **Webhook Signature Verification**
```typescript
// Merchant API pseudocode
function handleWebhook(request) {
    const signature = request.headers['X-Signature'];
    const payload = request.body;

    if (!verifySignature(payload, signature, EXTERNAL_API_PUBLIC_KEY)) {
        throw new Error('Invalid webhook signature');
    }

    // STILL verify on-chain before finalizing
    const onChainConfirmed = await checkBlockchain(payload.txHash);
    if (!onChainConfirmed) {
        throw new Error('Transaction not confirmed on-chain');
    }

    // Now safe to process
}
```

🔧 **On-Chain Confirmation Delays**
- Merchant API waits for N block confirmations before settlement
- Prevents reorganization attacks
- Current: Not implemented (relies on TON finality)

#### Residual Risks

⚠️ **External Service Downtime**: ChangeNOW/NOWPayments unavailable
- **Severity**: LOW (protocol continues functioning)
- **Impact**: External on/off ramps unavailable, internal transfers unaffected
- **Mitigation**: Multiple gateway support, fallback options

⚠️ **Price Oracle Manipulation** (Future Risk - Lending Protocol)
- **Severity**: HIGH (when lending is implemented)
- **Impact**: Under-collateralized loans
- **Mitigation**: Use decentralized oracles (Pyth, Chainlink on TON), conservative thresholds

#### Test Coverage
See: `tests/adversarial/external-adapter-exploits.spec.fc`

---

### T7 — Oracle / Price Manipulation (Future)

#### Description
Manipulation of external price data for collateral valuation, enabling:
- Under-collateralized lending
- Forced liquidations
- Collateral value inflation

#### Attack Scenario
```
1. Attacker manipulates TBC/TON price oracle
2. Inflates TBC value from $0.10 to $1.00
3. Takes out loan with 100 TBC as collateral ($10 → $100 apparent value)
4. Receives 80 TON loan ($80 based on manipulated price)
5. Price oracle returns to true value ($0.10)
6. Loan is severely under-collateralized
7. Attacker defaults, lender loses funds
```

#### Affected Components
- **Future Lending Contracts**: Not yet implemented
- **CoinRabbit Integration**: External lending adapter
- **Price Oracle Contracts**: Not yet deployed

#### Risk Level
**HIGH (Future)** - Currently N/A as lending is not implemented

#### Planned Mitigations

✅ **Price Signals Are Advisory Only**
- Lending protocol does NOT rely solely on oracle prices
- Conservative collateralization ratios
- Time-weighted average pricing (TWAP)

✅ **No Direct Liquidation Authority**
- Oracles cannot trigger liquidations directly
- Multi-step liquidation process with human oversight
- Grace periods for price volatility

✅ **Conservative Thresholds**
```
Recommended Collateralization:
- Minimum: 150% (borrow $100, post $150 collateral)
- Liquidation Threshold: 120% (liquidate if falls below)
- Oracle Price Deviation Limit: ±10% per hour
```

✅ **Decentralized Oracle Network**
- Use Pyth Network or Chainlink on TON
- Aggregate multiple price feeds
- Outlier detection and removal

#### Future Implementation Requirements

🔧 **Oracle Contract Standards**
- Must implement standard price feed interface
- Include timestamp, confidence interval, deviation metrics
- Support multiple price sources

🔧 **Liquidation Safeguards**
- Time-locked liquidation initiation (cannot liquidate instantly)
- Appeal mechanism for disputed liquidations
- Partial liquidation (only liquidate enough to restore ratio)

#### Current Status
**NOT IMPLEMENTED** - Lending protocol is future scope (Issue not yet created)

#### Test Coverage
See: `tests/future/oracle-manipulation.spec.fc` (placeholder)

---

### T8 — Admin Key Compromise

#### Description
Compromise of privileged keys (admin, risk_authority, lending_adapter) enabling:
- Emergency pause abuse (DoS attack)
- Fraudulent account blocking
- Unauthorized lock manipulation

#### Attack Scenario
```
Scenario 1: Payment Hub Admin Key Compromise
1. Attacker gains access to admin private key
2. Sends op::set_paused = 1 to Payment Hub
3. All protocol operations halted (DoS)
4. Users cannot transfer funds

Scenario 2: Risk Authority Key Compromise
1. Attacker compromises risk_authority key
2. Sets FRAUD_LOCK on competitor's merchant account
3. Merchant cannot receive payments (business disruption)

Scenario 3: Mass Account Blocking
1. Attacker uses compromised admin key
2. Flags all high-value accounts as blocked
3. Effectively confiscates funds (violates I1, I3)
```

#### Affected Components
- **Payment Hub Contract**: Admin functions [payment-hub.fc:233-263]
  - `handle_set_paused()` [Line 233]
  - `handle_flag_account()` [Line 242]
- **Account Locks Contract**: Authority checks [account-locks.fc:162, 177, 192, 207]

#### Risk Level
**CRITICAL** - Violates core invariants if exploited

#### Current Mitigations

✅ **No Admin Fund Paths**
```func
// payment-hub.fc - NO admin withdrawal functions
// Admin can ONLY:
// 1. Pause contract (emergency)
// 2. Flag accounts (fraud prevention)
// Admin CANNOT:
// - Transfer user funds
// - Override ownership
// - Seize balances
```

✅ **Immutable Contracts**
- No upgrade mechanisms
- Admin cannot change contract logic
- Code is frozen at deployment

✅ **Limited Admin Powers**
| Function | Admin Power | Risk Level |
|----------|------------|------------|
| `set_paused` | Halt operations | HIGH (DoS) |
| `flag_account` | Block account | HIGH (censorship) |
| `set_fraud_lock` | Risk authority only | HIGH (fraud prevention) |
| `set_collateral_lock` | Lending adapter only | MEDIUM (lending flow) |

#### Current Vulnerabilities

❌ **CRITICAL: Single Admin Key**
- Payment Hub admin is single address (no multi-sig)
- Account Locks risk_authority is single address
- No key rotation mechanism

❌ **No Governance Delay**
- Admin actions take effect immediately
- No time-lock for community review
- No on-chain governance process

❌ **Unlimited Flag Scope**
```func
// payment-hub.fc:242-263
() handle_flag_account(slice sender_address, slice nft_address, int flag_state) impure {
    throw_unless(error::unauthorized, equal_slices(sender_address, admin_address));

    // NO LIMIT on how many accounts can be flagged
    if (flag_state) {
        blocked_accounts~udict_set(256, slice_hash(nft_address), ...);
    }
}
```
- Admin can block unlimited accounts
- No rate limiting or maximum blocks per day

#### Required Mitigations

🔧 **MUST IMPLEMENT: Multi-Signature Admin**
```func
// Future implementation
global cell admin_addresses;  // Multiple admins required
const int ADMIN_THRESHOLD = 3;  // 3-of-5 multi-sig

() handle_set_paused(slice sender_address, int pause_state, cell signatures) impure {
    int valid_sigs = verify_multisig(signatures, admin_addresses, msg_hash);
    throw_unless(error::unauthorized, valid_sigs >= ADMIN_THRESHOLD);

    paused = pause_state;
    save_data();
}
```

🔧 **MUST IMPLEMENT: Governance Delay (Time-Lock)**
```func
// Proposed flag_account flow:
1. Admin proposes flag: propose_flag_account(nft_address, reason)
2. 48-hour delay period begins
3. Community can dispute proposal
4. After delay, execute_flag_account(nft_address) completes

// Emergency override available with higher multi-sig threshold
```

🔧 **SHOULD IMPLEMENT: Rate Limiting**
```func
global int last_flag_timestamp;
global int flags_today;
const int MAX_FLAGS_PER_DAY = 10;

() handle_flag_account(...) {
    int now = now();
    if (now - last_flag_timestamp > 86400) {
        flags_today = 0;  // Reset daily counter
    }
    throw_if(error::rate_limit, flags_today >= MAX_FLAGS_PER_DAY);

    flags_today += 1;
    last_flag_timestamp = now;
    // ... rest of logic
}
```

🔧 **MUST IMPLEMENT: DAO Governance Migration**
- Transfer admin, risk_authority, lending_adapter control to DAO
- On-chain voting for flag proposals
- Transparent governance process

#### Residual Risks

⚠️ **Governance Participation Risk**: Low voter turnout in DAO
- **Severity**: MEDIUM (small group controls governance)
- **Impact**: Centralization risk remains
- **Mitigation**: Quorum requirements, vote delegation

⚠️ **Emergency Response Delay**: Time-locks slow down fraud response
- **Severity**: MEDIUM (fraudulent accounts operate during delay)
- **Impact**: Some fraud may succeed before flag takes effect
- **Mitigation**: Separate emergency process with higher threshold

#### Governance Roadmap

**Phase 1 (Current)**: Single admin key (TEMPORARY - high risk)
**Phase 2 (Q1 2026)**: Multi-sig admin (3-of-5)
**Phase 3 (Q2 2026)**: Time-locked governance with DAO oversight
**Phase 4 (Q3 2026)**: Full DAO governance, remove manual admin keys

#### Test Coverage
See: `tests/adversarial/admin-key-compromise.spec.fc`

---

## Threat-to-Contract Mapping

### Payment Hub Contract (`payment-hub.fc`)

| Threat | Affected Functions | Lines | Severity | Mitigated? |
|--------|-------------------|-------|----------|------------|
| **T1** - NFT Race | `verify_nft_account()` | 96-112 | HIGH | ✅ Yes |
| **T1** - NFT Race | `handle_internal_transfer()` | 127-163 | HIGH | ✅ Yes |
| **T1** - NFT Race | `handle_merchant_payment()` | 166-197 | HIGH | ✅ Yes |
| **T2** - Reentrancy | All `recv_internal` handlers | 266-332 | MEDIUM | ✅ Yes (TON actor model) |
| **T3** - Ledger Desync | Balance tracking (FUTURE) | N/A | CRITICAL | ✅ Yes (jetton is source of truth) |
| **T4** - Lock Bypass | `handle_internal_transfer()` | 135 | HIGH | ❌ **NO** - missing lock check |
| **T4** - Lock Bypass | `handle_merchant_payment()` | 174 | HIGH | ❌ **NO** - missing lock check |
| **T5** - Merchant Abuse | `handle_merchant_payment()` | 166-197 | MEDIUM | ⚠️ Partial (no replay protection) |
| **T6** - External Adapter | `handle_payment_received()` | 200-230 | MEDIUM | ✅ Yes (on-chain confirmation) |
| **T8** - Admin Compromise | `handle_set_paused()` | 233-239 | CRITICAL | ❌ **NO** - single key |
| **T8** - Admin Compromise | `handle_flag_account()` | 242-263 | CRITICAL | ❌ **NO** - single key |

### Account Locks Contract (`account-locks.fc`)

| Threat | Affected Functions | Lines | Severity | Mitigated? |
|--------|-------------------|-------|----------|------------|
| **T1** - NFT Race | `get_lock_state()` | 57-73 | MEDIUM | ✅ Yes (read-only) |
| **T2** - Reentrancy | All lock set/clear handlers | 160-217 | LOW | ✅ Yes (TON actor model) |
| **T4** - Lock Bypass | `can_send()` | 83-92 | HIGH | ⚠️ Partial (advisory for direct jetton) |
| **T4** - Lock Bypass | `recv_internal` authorization | 162, 177, 192, 207 | HIGH | ✅ Yes (authority checks) |
| **T8** - Admin Compromise | `op::set_fraud_lock` | 160-172 | CRITICAL | ❌ **NO** - single risk_authority |
| **T8** - Admin Compromise | `op::set_collateral_lock` | 190-202 | MEDIUM | ❌ **NO** - single lending_adapter |

### NFT Resolver Contract (`nft_account_resolver.fc`)

| Threat | Affected Functions | Lines | Severity | Mitigated? |
|--------|-------------------|-------|----------|------------|
| **T1** - NFT Race | `resolve_owner_with_validation()` | 61-69 | LOW | ✅ Yes (informational only) |
| **T1** - NFT Race | `is_valid_account_nft()` | 74-91 | LOW | ✅ Yes (validation logic) |
| **T2** - Reentrancy | `recv_internal` | 124-142 | N/A | ✅ Yes (rejects all messages) |

**Note**: NFT Resolver is read-only and stateless, minimal attack surface.

### External Components (Off-Chain)

| Threat | Component | Severity | Mitigated? |
|--------|-----------|----------|------------|
| **T3** - Ledger Desync | Backend Indexer | MEDIUM | ⚠️ Partial (eventual consistency) |
| **T5** - Merchant Abuse | Merchant API | MEDIUM | ⚠️ Partial (user-initiated only) |
| **T6** - External Adapter | ChangeNOW Integration | MEDIUM | ✅ Yes (non-authoritative) |
| **T6** - External Adapter | NOWPayments Integration | MEDIUM | ✅ Yes (on-chain confirmation) |
| **T7** - Oracle Manipulation | CoinRabbit Integration | HIGH (future) | 🔧 Planned (not implemented) |

---

## Threat-to-Invariant Mapping

This section maps each threat to the protocol invariants from Issue #18 (Issue 4.1 — Formal Invariants & Protocol Guarantees).

### Invariant I1 — Non-Custodial Ownership

**Definition**: *The owner of the NFT account is the sole authority over the associated on-chain balance.*

| Threat | Violates I1? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T1** - NFT Race | ⚠️ **Potential** | NFT transferred during pending transaction → new owner gains authority | ✅ Mitigated (ownership checked at execution) |
| **T3** - Ledger Desync | ❌ **YES** | Phantom balances allow non-owner fund access | ✅ Mitigated (jetton is source of truth) |
| **T4** - Lock Bypass | ❌ **NO** | Locks restrict actions, not ownership | ✅ Compliant (locks are flags) |
| **T8** - Admin Compromise | ❌ **YES** | Admin cannot move funds, but can DoS (pause) | ⚠️ Partial (admin can block, not seize) |

**Invariant Status**: ✅ **PRESERVED** - Admin cannot take custody or move funds, only restrict operations.

---

### Invariant I2 — NFT = Account Authority

**Definition**: *NFT ownership is the single source of truth for account authority.*

| Threat | Violates I2? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T1** - NFT Race | ⚠️ **Potential** | Stale ownership check allows old owner authority | ✅ Mitigated (on-chain verification at execution) |
| **T4** - Lock Bypass | ❌ **NO** | Locks don't create secondary ownership | ✅ Compliant |
| **T5** - Merchant Abuse | ⚠️ **Potential** | Merchant attempts to claim authority | ✅ Mitigated (user must sign all payments) |
| **T8** - Admin Compromise | ❌ **NO** | Admin has separate authority (pause/flag), not account authority | ✅ Compliant |

**Invariant Status**: ✅ **PRESERVED** - NFT ownership is sole determinant of account operations.

---

### Invariant I3 — No Admin Fund Control

**Definition**: *No role other than the NFT owner can initiate fund transfers.*

| Threat | Violates I3? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T4** - Lock Bypass | ❌ **NO** | Locks prevent owner transfers but don't enable admin transfers | ✅ Compliant |
| **T5** - Merchant Abuse | ⚠️ **Potential** | Merchant attempts unauthorized withdrawal | ✅ Mitigated (user-initiated only) |
| **T6** - External Adapter | ⚠️ **Potential** | External service claims to credit account | ✅ Mitigated (on-chain confirmation required) |
| **T8** - Admin Compromise | ✅ **PRESERVED** | Admin can pause/flag but CANNOT transfer funds | ✅ **CRITICAL INVARIANT HOLDS** |

**Invariant Status**: ✅ **PRESERVED** - No admin withdrawal functions exist in any contract.

**Code Evidence**:
```func
// payment-hub.fc:233-263 - Admin functions REVIEW
() handle_set_paused(slice sender_address, int pause_state) impure {
    // NO fund movement, only state flag
    paused = pause_state;
}

() handle_flag_account(slice sender_address, slice nft_address, int flag_state) impure {
    // NO fund movement, only block flag
    blocked_accounts~udict_set(256, slice_hash(nft_address), ...);
}

// NO admin_withdraw() function exists
// NO emergency_drain() function exists
// NO privileged transfer() function exists
```

---

### Invariant I4 — Atomic Transfers

**Definition**: *A transfer either completes fully or does not occur at all.*

| Threat | Violates I4? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T2** - Reentrancy | ⚠️ **Potential** | Reentrancy during transfer creates intermediate state | ✅ Mitigated (TON actor model, no reentrancy) |
| **T3** - Ledger Desync | ❌ **YES** | Partial transfer (ledger updates, jetton fails) | ✅ Mitigated (single-source jetton model) |
| **T4** - Lock Bypass | ❌ **NO** | Lock check failure causes full revert | ✅ Compliant |

**Invariant Status**: ✅ **PRESERVED** - TON's message-passing model ensures atomicity.

**Code Evidence**:
```func
// payment-hub.fc:287-295
if (op == op::internal_transfer) {
    // ... load parameters ...
    handle_internal_transfer(sender_address, from_nft, to_nft, amount, memo);
    return ();  // All state changes committed or reverted atomically
}
```

---

### Invariant I5 — Ledger Conservation

**Definition**: *Σ(balances before) = Σ(balances after)* for all internal operations.

| Threat | Violates I5? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T2** - Reentrancy | ⚠️ **Potential** | Reentrant call mints/burns funds incorrectly | ✅ Mitigated (no reentrancy possible) |
| **T3** - Ledger Desync | ❌ **YES** | Ledger shows different total than jetton wallets | ✅ Mitigated (jetton enforces conservation) |

**Invariant Status**: ✅ **PRESERVED** - TBC jetton contract (immutable, existing) enforces conservation.

**Delegation to TBC Jetton**:
- Payment Hub does NOT maintain internal balances
- All balances stored in TBC jetton wallets
- Jetton contract enforces: `total_supply = Σ(all wallet balances)`
- Payment Hub only routes transfer requests

---

### Invariant I6 — Lock ≠ Confiscation

**Definition**: *Locks restrict actions, not ownership. Locked funds remain user-owned.*

| Threat | Violates I6? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T4** - Lock Bypass | ❌ **NO** (by design) | Locked accounts cannot send, but still OWN funds | ✅ Compliant |
| **T8** - Admin Compromise | ⚠️ **Borderline** | Admin can lock account indefinitely (effective confiscation) | ⚠️ **RISK** - needs governance oversight |

**Invariant Status**: ✅ **PRESERVED** - Locks are reversible flags, not fund seizure.

**Code Evidence**:
```func
// account-locks.fc:83-92
int can_send(slice nft_address) method_id {
    (int fraud_locked, int collateral_locked) = get_lock_state(nft_address);
    if (fraud_locked | collateral_locked) {
        return 0;  // Cannot SEND
    }
    return 1;
}

// account-locks.fc:95-98
int can_receive(slice nft_address) method_id {
    return 1;  // Can ALWAYS RECEIVE (ownership maintained)
}
```

**Concern**: Admin can set locks WITHOUT automatic unlock mechanism. Long-term lock = effective confiscation.

**Recommendation**: Implement lock expiration timestamps or governance review for locks > 90 days.

---

### Invariant I7 — External Adapter Isolation

**Definition**: *External providers cannot trigger transfers, bypass protocol rules, or act without explicit user actions.*

| Threat | Violates I7? | Scenario | Mitigation Status |
|--------|-------------|----------|-------------------|
| **T6** - External Adapter | ⚠️ **Potential** | External API claims transaction completed | ✅ Mitigated (on-chain confirmation required) |
| **T7** - Oracle Manipulation | ⚠️ **Potential (future)** | Oracle triggers liquidation | 🔧 Planned (advisory prices only) |

**Invariant Status**: ✅ **PRESERVED** - External services have NO on-chain authority.

**Code Evidence**:
```func
// payment-hub.fc:200-230
() handle_payment_received(
    slice recipient_nft,
    int amount,
    slice source_address,  // Must be ON-CHAIN address (DEX, jetton wallet)
    cell details
) impure {
    // ... validation ...

    // CRITICAL: source_address is verified on-chain
    // External API cannot call this directly
    // Only on-chain contracts (DEX, jetton wallets) can trigger
}
```

---

## Residual Risks

### Critical Risks Requiring Immediate Action

| Risk ID | Description | Impact | Likelihood | Priority | Mitigation Required |
|---------|-------------|--------|------------|----------|---------------------|
| **R-CRIT-1** | Payment Hub missing Account Locks integration | Locked accounts can send via Payment Hub | HIGH | HIGH | **CRITICAL** - Add lock checks |
| **R-CRIT-2** | Single admin key (payment hub, account locks) | Admin key compromise = protocol DoS | CRITICAL | MEDIUM | **HIGH** - Implement multi-sig |
| **R-CRIT-3** | Direct TBC jetton transfer bypasses locks | Locks are advisory only for direct transfers | HIGH | HIGH | **MEDIUM** - Document limitation |

### High Risks Requiring Mitigation

| Risk ID | Description | Impact | Likelihood | Priority | Mitigation Required |
|---------|-------------|--------|------------|----------|---------------------|
| **R-HIGH-1** | No invoice replay protection | Users can accidentally pay twice | MEDIUM | MEDIUM | **MEDIUM** - Off-chain tracking |
| **R-HIGH-2** | No admin action time-locks | Malicious admin can pause instantly | HIGH | LOW | **MEDIUM** - Implement governance delay |
| **R-HIGH-3** | Unlimited account flagging by admin | Mass censorship attack possible | HIGH | LOW | **MEDIUM** - Rate limiting |

### Medium Risks (Monitor & Document)

| Risk ID | Description | Impact | Likelihood | Priority |
|---------|-------------|--------|------------|----------|
| **R-MED-1** | Off-chain indexer staleness | UI shows incorrect balances temporarily | LOW | HIGH |
| **R-MED-2** | External adapter downtime | On/off ramps unavailable | MEDIUM | MEDIUM |
| **R-MED-3** | NFT marketplace front-running | Attackers can buy NFT before user's transfer executes | LOW | MEDIUM |
| **R-MED-4** | Webhook spoofing (merchant API) | Merchants may ship goods before on-chain confirmation | MEDIUM | LOW |

### Low Risks (Acceptable)

| Risk ID | Description | Impact | Likelihood |
|---------|-------------|--------|------------|
| **R-LOW-1** | Self-transfer via Payment Hub | User sends TBC to self (no-op but logs event) | NEGLIGIBLE | LOW |
| **R-LOW-2** | Event emission gas costs | High-frequency events may cost gas | LOW | MEDIUM |
| **R-LOW-3** | Lock state read race | Lock state changes between UI read and transaction | NEGLIGIBLE | LOW |

### Future Risks (Not Yet Applicable)

| Risk ID | Description | Status |
|---------|-------------|--------|
| **R-FUT-1** | Oracle price manipulation | Not implemented (no lending yet) |
| **R-FUT-2** | Flash loan attacks | Not applicable (no instant borrow/repay) |
| **R-FUT-3** | Cross-chain bridge exploits | Not implemented (TON-only currently) |

---

## Monitoring & Detection

### On-Chain Monitoring

#### Critical Events to Monitor

```typescript
// Recommended monitoring alerts

// 1. Suspicious Lock Activity
event AccountLocked {
    nft_address: Address;
    lock_type: uint8;  // FRAUD_LOCK or COLLATERAL_LOCK
}

// Alert if:
// - More than 10 accounts locked in 24 hours
// - High-value account (>10k TBC) locked
// - Merchant account locked (business disruption)

// 2. Large Transfers
event InternalTransferEvent {
    from_nft: Address;
    to_nft: Address;
    amount_tbc: uint256;
}

// Alert if:
// - Single transfer > 100,000 TBC
// - Account transfers >50% of balance in one transaction
// - Newly created account receives large transfer

// 3. Admin Actions
event ContractPaused {
    admin: Address;
    timestamp: uint32;
}

event AccountFlagged {
    nft_address: Address;
    flagged: bool;
    admin: Address;
}

// Alert ALL admin actions immediately

// 4. Failed Transactions
// Monitor for patterns of:
// - Repeated authorization failures (brute force?)
// - Lock bypass attempts (error::account_blocked)
// - Insufficient balance attempts (suspicious behavior)
```

#### Blockchain Indexer Monitoring

```typescript
// Continuous monitoring tasks

interface MonitoringTask {
    name: string;
    interval: number;  // seconds
    check: () => Promise<Alert[]>;
}

const tasks: MonitoringTask[] = [
    {
        name: "Lock State Consistency",
        interval: 60,
        check: async () => {
            // Verify Account Locks state matches Payment Hub blocked list
            const locks = await accountLocks.getAllLocks();
            const blocked = await paymentHub.getBlockedAccounts();

            // Alert if mismatch
            return findInconsistencies(locks, blocked);
        }
    },

    {
        name: "Balance Conservation",
        interval: 300,  // 5 minutes
        check: async () => {
            // Verify Σ(jetton wallets) = TBC total supply
            const walletBalances = await indexer.getAllTBCBalances();
            const totalSupply = await tbcJetton.getTotalSupply();

            const sum = walletBalances.reduce((a, b) => a + b, 0n);
            if (sum !== totalSupply) {
                return [new Alert("Balance conservation violated!")];
            }
            return [];
        }
    },

    {
        name: "Admin Key Activity",
        interval: 10,  // Real-time
        check: async () => {
            // Monitor all transactions from admin addresses
            const adminTxs = await indexer.getRecentAdminTransactions();

            return adminTxs.map(tx => new Alert(`Admin action: ${tx.type}`));
        }
    },

    {
        name: "NFT Ownership Changes",
        interval: 60,
        check: async () => {
            // Track NFT transfers with balances > threshold
            const nftTransfers = await indexer.getRecentNFTTransfers();
            const highValueTransfers = nftTransfers.filter(async (transfer) => {
                const balance = await getAccountBalance(transfer.nftAddress);
                return balance > 10000n * 10n**9n;  // 10k TBC
            });

            return highValueTransfers.map(t =>
                new Alert(`High-value NFT transferred: ${t.nftAddress}`)
            );
        }
    }
];
```

### Off-Chain Monitoring

#### Merchant API Alerts

```typescript
// Fraud detection patterns

class FraudDetector {
    // Pattern 1: Invoice Replay
    async detectReplayAttacks() {
        const payments = await db.getRecentPayments(24);  // Last 24h
        const invoiceMap = new Map<string, number>();

        for (const payment of payments) {
            const count = invoiceMap.get(payment.invoiceId) || 0;
            invoiceMap.set(payment.invoiceId, count + 1);
        }

        // Alert if same invoice paid multiple times
        const replays = Array.from(invoiceMap.entries())
            .filter(([id, count]) => count > 1);

        if (replays.length > 0) {
            await sendAlert({
                type: "REPLAY_ATTACK",
                invoices: replays
            });
        }
    }

    // Pattern 2: Velocity Checks
    async detectHighVelocity() {
        const accounts = await db.getActiveAccounts();

        for (const account of accounts) {
            const txs = await db.getAccountTransactions(account.nft_address, 1);  // Last hour

            if (txs.length > 100) {
                await sendAlert({
                    type: "HIGH_VELOCITY",
                    account: account.nft_address,
                    count: txs.length
                });
            }
        }
    }

    // Pattern 3: External API Discrepancies
    async detectAPIDiscrepancies() {
        const externalPending = await changeNowAPI.getPendingTransactions();
        const onChainConfirmed = await indexer.getRecentDeposits();

        // Alert if external API shows "completed" but on-chain missing
        const discrepancies = externalPending.filter(ext =>
            ext.status === "completed" &&
            !onChainConfirmed.find(oc => oc.txHash === ext.txHash)
        );

        if (discrepancies.length > 0) {
            await sendAlert({
                type: "API_DISCREPANCY",
                transactions: discrepancies
            });
        }
    }
}
```

#### Security Metrics Dashboard

```typescript
// Key metrics to display

interface SecurityMetrics {
    // Operational Health
    totalAccounts: number;
    activeAccounts24h: number;
    totalVolume24h: bigint;

    // Security Status
    lockedAccounts: {
        fraud: number;
        collateral: number;
        total: number;
    };

    failedTransactions24h: {
        unauthorized: number;
        accountLocked: number;
        insufficientBalance: number;
    };

    // Admin Activity
    adminActions24h: {
        pauses: number;
        flags: number;
        locks: number;
    };

    // External Services
    externalAPIStatus: {
        changeNow: "up" | "down" | "degraded";
        nowPayments: "up" | "down" | "degraded";
        coinRabbit: "up" | "down" | "degraded";
    };

    // Anomaly Detection
    alerts: {
        critical: number;
        high: number;
        medium: number;
    };
}
```

---

## Audit Checklist

### Smart Contract Security Audit

#### Payment Hub Contract (`payment-hub.fc`)

- [ ] **Ownership Verification**
  - [ ] Verify `verify_nft_account()` calls actual NFT contract
  - [ ] Ensure ownership checked at execution time, not submission
  - [ ] Test NFT transfer during pending transaction handling

- [ ] **Lock Integration** ❌ **FAILING**
  - [ ] Verify `handle_internal_transfer()` checks Account Locks
  - [ ] Verify `handle_merchant_payment()` checks Account Locks
  - [ ] **CRITICAL**: Currently missing lock integration

- [ ] **Admin Functions**
  - [ ] Confirm admin CANNOT transfer user funds
  - [ ] Verify `handle_set_paused()` only sets flag, no fund movement
  - [ ] Verify `handle_flag_account()` only blocks, no confiscation
  - [ ] Test admin key compromise scenarios

- [ ] **Event Emission**
  - [ ] Verify events emitted AFTER state changes
  - [ ] Ensure events cannot be spoofed
  - [ ] Check event data integrity

- [ ] **Arithmetic Safety**
  - [ ] Verify no overflow in amount calculations
  - [ ] Check nanoTON conversion correctness
  - [ ] Validate coin amount ranges

#### Account Locks Contract (`account-locks.fc`)

- [ ] **Authorization**
  - [ ] Verify risk_authority cannot set collateral locks
  - [ ] Verify lending_adapter cannot set fraud locks
  - [ ] Test unauthorized lock attempts

- [ ] **Lock Semantics**
  - [ ] Confirm `can_send()` returns 0 when any lock active
  - [ ] Confirm `can_receive()` always returns 1
  - [ ] Verify locks are reversible (clear operations work)

- [ ] **State Management**
  - [ ] Ensure lock state persisted correctly
  - [ ] Verify dictionary operations don't corrupt data
  - [ ] Test lock state for non-existent accounts

#### NFT Resolver Contract (`nft_account_resolver.fc`)

- [ ] **Read-Only Enforcement**
  - [ ] Verify `recv_internal()` rejects ALL messages
  - [ ] Confirm no state mutations possible
  - [ ] Test attempted writes revert

- [ ] **Whitelist Integrity**
  - [ ] Verify collection addresses hardcoded correctly
  - [ ] Ensure whitelist cannot be modified
  - [ ] Test whitelisted vs. non-whitelisted NFTs

### Invariant Verification

- [ ] **I1: Non-Custodial Ownership**
  - [ ] No custody functions exist in any contract
  - [ ] NFT owner is sole authority over account operations

- [ ] **I2: NFT = Account Authority**
  - [ ] No secondary ownership mechanisms
  - [ ] Ownership transfer = account control transfer

- [ ] **I3: No Admin Fund Control**
  - [ ] No admin withdrawal functions
  - [ ] No emergency drain functions
  - [ ] Admin can only pause/flag, not transfer

- [ ] **I4: Atomic Transfers**
  - [ ] Transfers succeed fully or revert
  - [ ] No intermediate states possible

- [ ] **I5: Ledger Conservation**
  - [ ] TBC jetton enforces `Σ(balances) = total_supply`
  - [ ] Payment Hub does not maintain internal ledger

- [ ] **I6: Lock ≠ Confiscation**
  - [ ] Locks are reversible flags
  - [ ] Locked accounts can still receive
  - [ ] No fund seizure possible

- [ ] **I7: External Adapter Isolation**
  - [ ] External APIs cannot trigger on-chain state changes
  - [ ] On-chain confirmation required for all deposits

### Attack Scenario Testing

- [ ] **T1: NFT Transfer Race**
  - [ ] Test NFT transfer during pending payment
  - [ ] Verify new owner cannot hijack old owner's transaction
  - [ ] Test front-running scenarios

- [ ] **T2: Reentrancy**
  - [ ] Test malicious contract callback attempts
  - [ ] Verify TON actor model prevents reentrancy
  - [ ] Test recursive message attempts

- [ ] **T3: Ledger Desync**
  - [ ] Verify jetton wallet balance = source of truth
  - [ ] Test indexer cache staleness handling
  - [ ] Confirm no phantom balances possible

- [ ] **T4: Lock Bypass**
  - [ ] Test locked account send via Payment Hub (should fail)
  - [ ] Test locked account send via direct jetton transfer (succeeds - by design)
  - [ ] Test NFT transfer to bypass lock (should maintain lock)

- [ ] **T5: Merchant Payment Abuse**
  - [ ] Test invoice replay (currently allowed - document)
  - [ ] Test unauthorized merchant withdrawal (should fail)
  - [ ] Test payload manipulation (user must sign exact payload)

- [ ] **T6: External Adapter**
  - [ ] Test fake external API confirmation (should not credit account)
  - [ ] Test webhook spoofing (merchant API must verify signature)
  - [ ] Test on-chain confirmation requirement

- [ ] **T8: Admin Key Compromise**
  - [ ] Test admin pause attack (succeeds - admin can DoS)
  - [ ] Test admin mass flagging (succeeds - admin can censor)
  - [ ] Test admin fund theft (should fail - no function exists)

### Integration Testing

- [ ] **Payment Hub ↔ Account Locks**
  - [ ] Verify Payment Hub queries lock state before transfers
  - [ ] Test lock set during pending transfer
  - [ ] Verify lock clear allows transfers

- [ ] **Payment Hub ↔ NFT Resolver**
  - [ ] Verify NFT whitelist validation
  - [ ] Test non-whitelisted NFT rejection
  - [ ] Verify ownership resolution

- [ ] **Payment Hub ↔ TBC Jetton**
  - [ ] Test jetton transfer message format
  - [ ] Verify balance validation
  - [ ] Test jetton transfer failure handling

### Operational Security

- [ ] **Key Management**
  - [ ] Admin key storage and access controls
  - [ ] Risk authority key rotation plan
  - [ ] Lending adapter key security

- [ ] **Monitoring**
  - [ ] Indexer uptime and reliability
  - [ ] Alert system functionality
  - [ ] Anomaly detection accuracy

- [ ] **Incident Response**
  - [ ] Admin pause procedure tested
  - [ ] Fraud lock escalation process
  - [ ] Communication plan for security events

---

## Document Maintenance

This threat model is **living documentation** and must be updated whenever:

1. New contracts are deployed
2. Protocol features are added
3. Security vulnerabilities are discovered
4. Invariants are modified (requires governance approval)
5. External integrations change
6. Audit findings are addressed

### Update Procedure

1. Create Issue describing threat model change
2. Update this document with new threats/mitigations
3. Add corresponding adversarial tests
4. Submit PR for review
5. Security team approval required before merge

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-27 | Initial threat model for Issue #20 | AI Issue Solver |

---

## References

- [Issue #18 - Formal Invariants & Protocol Guarantees](https://github.com/xlabtg/tonbankcard-protocol/issues/18)
- [Issue #20 - Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
- [TON Security Best Practices](https://docs.ton.org/develop/smart-contracts/security/secure-programming)
- [TON Actor Model](https://docs.ton.org/develop/smart-contracts/guidelines/message-delivery-guarantees)
- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)

---

**Document Status**: ✅ Complete
**Audit Readiness**: ⚠️ Requires fixes (R-CRIT-1, R-CRIT-2)
**Next Review**: After Payment Hub ↔ Account Locks integration completed
