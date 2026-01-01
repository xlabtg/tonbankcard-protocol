# Tonbankcard Protocol Architecture Diagrams for Auditors

## Overview

This document provides visual architecture diagrams specifically designed for security auditors to understand the Tonbankcard protocol structure, data flows, trust boundaries, and attack surfaces.

**Issue Reference**: [#22 - Audit Readiness Checklist & Scope Definition](https://github.com/xlabtg/tonbankcard-protocol/issues/22)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TON BLOCKCHAIN                                    │
│                         (Trusted Execution Layer)                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      SMART CONTRACTS (In-Scope)                     │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │    │
│  │  │ Merchant        │  │ Payment Hub     │  │ Account State    │  │    │
│  │  │ Payment Hub     │──│ (Internal       │──│ Machine          │  │    │
│  │  │ (Issue #8)      │  │  Transfers)     │  │ (Issue #5)       │  │    │
│  │  │                 │  │ (Issue #6)      │  │                  │  │    │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘  │    │
│  │           │                    │                     │             │    │
│  │           └────────────────────┴─────────────────────┘             │    │
│  │                              │                                     │    │
│  │           ┌──────────────────┴──────────────────┐                 │    │
│  │           │                                      │                 │    │
│  │  ┌────────▼────────┐                  ┌─────────▼──────────┐      │    │
│  │  │ NFT Account     │                  │ Account Locks      │      │    │
│  │  │ Resolver        │                  │ (Issue #7)         │      │    │
│  │  │ (Issue #4)      │                  │                    │      │    │
│  │  └─────────────────┘                  └────────────────────┘      │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              EXTERNAL CONTRACTS (Out of Scope)                       │   │
│  │                                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐     │   │
│  │  │ TBC Token    │    │ NFT Cards    │    │ TONCO DEX        │     │   │
│  │  │ (Jetton)     │    │ (7777, 8888) │    │ (TBC/TON Pool)   │     │   │
│  │  └──────────────┘    └──────────────┘    └──────────────────┘     │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
        ┌───────────▼──────────┐      ┌──────────▼──────────┐
        │   OFF-CHAIN          │      │   EXTERNAL          │
        │   COMPONENTS         │      │   SERVICES          │
        │   (Out of Scope)     │      │   (Untrusted)       │
        │                      │      │                     │
        │  • Backend API       │      │  • ChangeNOW        │
        │  • Indexer           │      │  • NOWPayments      │
        │  • Frontend UI       │      │  • CoinRabbit       │
        │  • SDK Libraries     │      │                     │
        └──────────────────────┘      └─────────────────────┘
```

---

## 2. In-Scope Smart Contract Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                     MERCHANT PAYMENT HUB                              │
│                  (contracts/MerchantPaymentHub.tact)                  │
│                        🔴 CRITICAL - In-Scope                          │
│                                                                        │
│  Public Functions:                                                    │
│  • payMerchant(payer_nft, merchant_nft, amount, payload)             │
│  • getBalance(nft_address)                                            │
│  • getAccountState(nft_address)                                       │
│  • getLockState(nft_address)                                          │
│                                                                        │
│  Critical Checks:                                                     │
│  ✅ Ownership verification                                            │
│  ✅ Balance conservation                                              │
│  ✅ Lock enforcement (FRAUD_LOCK, COLLATERAL_LOCK)                   │
│  ✅ State validation (ACTIVE, FROZEN, COLLATERAL_LOCKED, CLOSED)     │
│                                                                        │
└─────────────┬──────────────────────┬─────────────────┬───────────────┘
              │                      │                 │
              │ uses                 │ uses            │ uses
              │                      │                 │
┌─────────────▼─────────┐  ┌─────────▼────────┐  ┌────▼──────────────┐
│  PAYMENT HUB          │  │ ACCOUNT STATE     │  │ ACCOUNT LOCKS     │
│  (Internal Transfers) │  │ MACHINE           │  │ (Risk & Collat.)  │
│  PaymentHub.tact      │  │ account-state.tact│  │ account-locks.fc  │
│  🔴 CRITICAL          │  │ 🔴 CRITICAL       │  │ 🟠 HIGH           │
│                       │  │                   │  │                   │
│  Functions:           │  │  Functions:       │  │  Functions:       │
│  • transferInternal   │  │  • getBalance     │  │  • get_can_send   │
│  • canSend            │  │  • getState       │  │  • get_can_receive│
│  • canReceive         │  │  • canSend        │  │  • set_fraud_lock │
│                       │  │  • canReceive     │  │  • set_coll_lock  │
└───────────┬───────────┘  └──────────┬────────┘  └─────────┬─────────┘
            │                         │                      │
            │ uses                    │ uses                 │
            │                         │                      │
            └─────────────┬───────────┘                      │
                          │                                  │
                ┌─────────▼────────────┐                     │
                │  NFT ACCOUNT         │                     │
                │  RESOLVER            │                     │
                │  nft_account_        │                     │
                │  resolver.fc/.tact   │                     │
                │  🔴 CRITICAL         │                     │
                │                      │                     │
                │  Functions:          │                     │
                │  • resolveOwner      │                     │
                │  • isValidAccountNFT │                     │
                │                      │◄────────────────────┘
                └──────────────────────┘
```

---

## 3. Trust Boundaries & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRUST LEVEL: HIGH                               │
│                      (Cryptographically Verified)                       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    ON-CHAIN STATE                               │    │
│  │                                                                 │    │
│  │  NFT Ownership:  address → owner_address                       │    │
│  │  TBC Balances:   nft_address → balance_tbc                     │    │
│  │  Account States: nft_address → (state, locks)                  │    │
│  │  Lock Flags:     nft_address → (fraud_lock, collateral_lock)  │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ Read/Write via signed transactions
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                         TRUST LEVEL: MEDIUM                              │
│                          (Auditable, Stateless)                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    OFF-CHAIN CACHE                              │    │
│  │                                                                 │    │
│  │  Backend Indexer:                                              │    │
│  │    • Mirrors on-chain state                                    │    │
│  │    • Provides fast queries                                     │    │
│  │    • NO authority to modify state                              │    │
│  │    • Treated as potentially stale                              │    │
│  │                                                                 │    │
│  │  Merchant API:                                                 │    │
│  │    • Orchestrates payment flows                                │    │
│  │    • Provides quotes and invoices                              │    │
│  │    • NO authority to move funds                                │    │
│  │    • Requires user signature for all transfers                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ Quotes, routing, status only
                               │
┌──────────────────────────────▼───────────────────────────────────────────┐
│                         TRUST LEVEL: LOW                                 │
│                      (External, Potentially Malicious)                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                 EXTERNAL SERVICES                               │    │
│  │                                                                 │    │
│  │  ChangeNOW / NOWPayments:                                      │    │
│  │    • Provide swap quotes                                       │    │
│  │    • Process external crypto                                   │    │
│  │    • NO access to on-chain funds                               │    │
│  │    • Can only provide information, not execute transfers       │    │
│  │                                                                 │    │
│  │  TONCO DEX:                                                    │    │
│  │    • Decentralized liquidity pool                              │    │
│  │    • Price discovery for TBC/TON                               │    │
│  │    • User interacts directly via signed transactions           │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Merchant Payment Flow (Critical Path)

```
┌─────────┐                                                     ┌──────────┐
│  User   │                                                     │ Merchant │
│ (Payer) │                                                     │          │
└────┬────┘                                                     └────▲─────┘
     │                                                               │
     │ 1. Initiates payment                                          │
     │    (Signs transaction with TON wallet)                        │
     │                                                               │
     ▼                                                               │
┌─────────────────────────────────────────────────────────────┐     │
│            MerchantPaymentHub.payMerchant()                 │     │
│                                                              │     │
│  Step 1: Validate Inputs                                    │     │
│    ✅ amount_tbc > 0                                         │     │
│    ✅ payer_nft != merchant_nft                              │     │
│    ✅ payer_nft and merchant_nft are valid addresses        │     │
│                                                              │     │
│  Step 2: Verify Ownership ──┐                               │     │
│    ✅ msg.sender == owner(payer_nft)                        │     │
│         │                                                    │     │
└─────────┼────────────────────────────────────────────────────┘     │
          │                                                          │
          ▼                                                          │
     ┌────────────────────────┐                                     │
     │ NFT Account Resolver   │                                     │
     │ resolveOwner()         │                                     │
     │ ✅ Returns current     │                                     │
     │    owner on-chain      │                                     │
     └────────────────────────┘                                     │
          │                                                          │
          │ Returns owner_address                                   │
          │                                                          │
┌─────────▼────────────────────────────────────────────────────┐     │
│  Step 3: Check Payer Account State                          │     │
│    Query: getAccountState(payer_nft)                         │     │
│    ✅ state == ACTIVE (not FROZEN, COLLATERAL_LOCKED, CLOSED)│     │
│         │                                                    │     │
│  Step 4: Check Payer Locks ──┐                              │     │
│    Query: getLockState(payer_nft)                           │     │
│    ✅ !fraud_locked                                          │     │
│    ✅ !collateral_locked                                     │     │
│         │                                                    │     │
└─────────┼────────────────────────────────────────────────────┘     │
          │                                                          │
          ▼                                                          │
     ┌────────────────────────┐                                     │
     │  Account Locks         │                                     │
     │  get_can_send()        │                                     │
     │  ✅ Returns true if    │                                     │
     │     no locks active    │                                     │
     └────────────────────────┘                                     │
          │                                                          │
          │ Returns can_send = true                                 │
          │                                                          │
┌─────────▼────────────────────────────────────────────────────┐     │
│  Step 5: Check Merchant Account State                       │     │
│    Query: getAccountState(merchant_nft)                      │     │
│    ✅ state != CLOSED                                        │     │
│                                                              │     │
│  Step 6: Check Balances                                     │     │
│    Query: getBalance(payer_nft)                              │     │
│    ✅ balance(payer_nft) >= amount_tbc                       │     │
│         │                                                    │     │
└─────────┼────────────────────────────────────────────────────┘     │
          │                                                          │
          ▼                                                          │
     ┌────────────────────────┐                                     │
     │ Account State Machine  │                                     │
     │ getBalance()           │                                     │
     │ ✅ Returns current     │                                     │
     │    TBC balance         │                                     │
     └────────────────────────┘                                     │
          │                                                          │
          │ Returns balance                                         │
          │                                                          │
┌─────────▼────────────────────────────────────────────────────┐     │
│  Step 7: Execute Atomic Transfer                             │     │
│                                                              │     │
│    balance(payer_nft) -= amount_tbc      // Debit           │     │
│    balance(merchant_nft) += amount_tbc   // Credit          │     │
│                                                              │     │
│  Step 8: Emit Event                                         │     │
│    MerchantPayment {                                         │     │
│      payer_nft,                                              │     │
│      merchant_nft,                                           │     │
│      amount_tbc,                                             │     │
│      payload_hash,                                           │     │
│      timestamp                                               │     │
│    }                                                         │     │
│                                                              │     │
└──────────────────────────────────────────────────────────────┘     │
          │                                                          │
          │ Success                                                  │
          │                                                          │
          └──────────────────────────────────────────────────────────┘

CRITICAL INVARIANTS PRESERVED:
✅ I1: Non-Custodial (user signed transaction)
✅ I2: NFT Ownership Authority (owner verified)
✅ I3: Balance Conservation (debit = credit)
✅ I4: Atomic Execution (all-or-nothing)
✅ I5: Lock Enforcement (locked accounts can't send)
✅ I6: State Transitions (ACTIVE can send, FROZEN can't)
✅ I7: No Phantom Balances (sufficient balance checked)
✅ I8: Merchant Authorization (payer initiated)
```

---

## 5. Account Lock Enforcement Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   ACCOUNT LOCKS ARCHITECTURE                      │
│                  (contracts/payments/account-locks.fc)            │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ Risk Authority  │         │ Lending Adapter  │
│ (Future: DAO)   │         │ (Smart Contract) │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ set_fraud_lock()          │ set_collateral_lock()
         │ clear_fraud_lock()        │ clear_collateral_lock()
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Account Locks        │
         │  Storage:             │
         │    nft_address →      │
         │      fraud_locked     │
         │      collateral_locked│
         └───────────┬───────────┘
                     │
                     │ Query: get_can_send(nft_address)
                     │
         ┌───────────▼───────────┐
         │  Lock Logic:          │
         │                       │
         │  IF fraud_locked OR   │
         │     collateral_locked │
         │  THEN                 │
         │    can_send = FALSE   │
         │  ELSE                 │
         │    can_send = TRUE    │
         │                       │
         │  can_receive = TRUE   │
         │  (always allowed)     │
         └───────────┬───────────┘
                     │
                     │ Returns can_send flag
                     │
         ┌───────────▼────────────┐
         │  Payment Hub           │
         │  (checks before SEND)  │
         │                        │
         │  require(can_send,     │
         │    "Account locked");  │
         └────────────────────────┘

LOCK TYPES:

1. FRAUD_LOCK
   Authority: Risk Authority
   Effect: Prevents SEND operations
   Use Case: Suspicious activity, fraud investigation

2. COLLATERAL_LOCK
   Authority: Lending Adapter
   Effect: Prevents SEND operations
   Use Case: NFT used as collateral in lending protocol

ENFORCEMENT POINTS:
✅ Internal transfers (PaymentHub)
✅ Merchant payments (MerchantPaymentHub)
✅ External withdrawals (future)
✅ All SEND operations

BYPASS PROTECTION:
❌ No alternative transfer paths
❌ No admin override
❌ No "emergency" unlock without authority
```

---

## 6. Account State Machine

```
┌─────────────────────────────────────────────────────────────┐
│              ACCOUNT STATE TRANSITIONS                       │
│         (contracts/payment-hub/account-state.tact)           │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   ACTIVE    │ ◄─── Initial state
                    │   (State 0) │
                    │             │
                    │ Can Send: ✅│
                    │ Can Recv: ✅│
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           │               │               │
      ┌────▼─────┐   ┌─────▼─────┐  ┌────▼─────┐
      │  FROZEN  │   │COLLATERAL │  │  CLOSED  │
      │(State 1) │   │  LOCKED   │  │(State 3) │
      │          │   │ (State 2) │  │          │
      │Can Send:❌   │Can Send: ❌   │Can Send:❌
      │Can Recv:✅   │Can Recv: ✅   │Can Recv:❌
      └────┬─────┘   └─────┬─────┘  └──────────┘
           │               │               │
           │ (Future)      │ (Future)      │ No transitions
           │ DAO unlock    │ Lending unlock│ (Terminal state)
           │               │               │
           └───────┬───────┴───────────────┘
                   │
                   ▼
            (Back to ACTIVE)

STATE PROPERTIES:

┌───────────────┬──────────┬────────────┬─────────────────────┐
│ State         │ Can Send │ Can Receive│ Use Case            │
├───────────────┼──────────┼────────────┼─────────────────────┤
│ ACTIVE        │    ✅    │     ✅     │ Normal operation    │
│ FROZEN        │    ❌    │     ✅     │ Risk/fraud freeze   │
│ COLLATERAL_   │    ❌    │     ✅     │ Used as collateral  │
│   LOCKED      │          │            │ in lending          │
│ CLOSED        │    ❌    │     ❌     │ Account permanently │
│               │          │            │ closed              │
└───────────────┴──────────┴────────────┴─────────────────────┘

AUTHORIZATION REQUIREMENTS:

ACTIVE → FROZEN:           Risk Authority / DAO
ACTIVE → COLLATERAL_LOCKED: Lending Adapter
ACTIVE → CLOSED:            User / DAO
FROZEN → ACTIVE:            DAO (future)
COLLATERAL_LOCKED → ACTIVE: Lending Adapter (future)

ENFORCEMENT:
✅ State checked before all SEND operations
✅ Invalid transitions rejected
✅ State changes emit events
```

---

## 7. Attack Surface Map

```
┌──────────────────────────────────────────────────────────────────┐
│                      ATTACK SURFACE                              │
│                (Potential Entry Points for Adversaries)          │
└──────────────────────────────────────────────────────────────────┘

ON-CHAIN ATTACK VECTORS:

┌─────────────────────────┐
│ 1. NFT Transfer         │  Risk: 🔴 HIGH
│    Race Conditions      │  Mitigation: ✅ Atomic ownership checks
└─────────────────────────┘

┌─────────────────────────┐
│ 2. Reentrancy           │  Risk: 🟢 LOW (TON prevents)
│    Attacks              │  Mitigation: ✅ Actor model
└─────────────────────────┘

┌─────────────────────────┐
│ 3. Ledger               │  Risk: 🔴 HIGH
│    Desynchronization    │  Mitigation: ✅ Atomic operations,
└─────────────────────────┘                balance conservation

┌─────────────────────────┐
│ 4. Lock Bypass          │  Risk: 🟠 MEDIUM
│    Attempts             │  Mitigation: ✅ Protocol-level enforcement
└─────────────────────────┘

┌─────────────────────────┐
│ 5. Merchant Payment     │  Risk: 🟠 MEDIUM
│    Abuse                │  Mitigation: ✅ User-initiated only
└─────────────────────────┘                ⚠️ Replay prevention off-chain

┌─────────────────────────┐
│ 6. Smart Contract       │  Risk: 🟠 MEDIUM
│    Bugs                 │  Mitigation: ✅ Comprehensive testing
└─────────────────────────┘                ⚠️ Audit required

OFF-CHAIN ATTACK VECTORS:

┌─────────────────────────┐
│ 7. External Adapter     │  Risk: 🟡 MEDIUM
│    Exploits             │  Mitigation: ✅ Adapter isolation
└─────────────────────────┘                ✅ No fund authority

┌─────────────────────────┐
│ 8. Admin Key            │  Risk: 🟠 MEDIUM (DoS only)
│    Compromise           │  Mitigation: ✅ No fund access
└─────────────────────────┘                ⚠️ Multi-sig needed

┌─────────────────────────┐
│ 9. Frontend/UI          │  Risk: 🟠 MEDIUM
│    Attacks              │  Mitigation: ⚠️ User verification
└─────────────────────────┘                ⚠️ Wallet confirmation

ATTACK SURFACE REDUCTION STRATEGIES:

✅ Minimize external calls
✅ Explicit input validation
✅ Clear error messages
✅ Atomic state updates
✅ No upgradeable proxies (core contracts)
✅ Comprehensive event emission
✅ Lock enforcement at protocol level
```

---

## 8. Security Boundaries & Isolation

```
┌───────────────────────────────────────────────────────────────┐
│                  SECURITY ISOLATION LAYERS                     │
└───────────────────────────────────────────────────────────────┘

LAYER 1: CRYPTOGRAPHIC ISOLATION
┌─────────────────────────────────────────────────────────────┐
│  • Private keys never leave user wallet                     │
│  • All transactions signed by user                          │
│  • NFT ownership verified via cryptographic proof           │
│  • No shared secrets or trust relationships                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 2: SMART CONTRACT ISOLATION
┌─────────────────────────────────────────────────────────────┐
│  • Immutable core contracts (no upgrades)                   │
│  • No admin fund access                                     │
│  • Explicit authorization checks                            │
│  • Atomic operations prevent partial states                 │
│  • Overflow protection (TVM built-in)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 3: PROTOCOL ISOLATION
┌─────────────────────────────────────────────────────────────┐
│  • External adapters cannot move funds                      │
│  • Off-chain components read-only                           │
│  • Event-driven architecture (no callbacks)                 │
│  • Clear trust boundaries documented                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 4: OPERATIONAL ISOLATION
┌─────────────────────────────────────────────────────────────┐
│  • Admin keys separate from fund control                    │
│  • Risk Authority can only set locks (not move funds)       │
│  • Lending Adapter managed separately                       │
│  • Multi-sig for critical operations (future)               │
└─────────────────────────────────────────────────────────────┘

ISOLATION VERIFICATION:
✅ No contract has both lock authority AND fund movement authority
✅ External services cannot trigger on-chain state changes
✅ Off-chain cache divergence doesn't affect security
✅ User retains full control at all times
```

---

## 9. Data Flow: User Payment Journey

```
┌───────────────────────────────────────────────────────────────────┐
│               COMPLETE USER PAYMENT FLOW                          │
│         (From User Intent to On-Chain Settlement)                 │
└───────────────────────────────────────────────────────────────────┘

1. USER INITIATES PAYMENT
   ┌─────────────┐
   │    User     │  "Pay 100 TBC to Merchant"
   │  (Frontend) │
   └──────┬──────┘
          │
          │ Requests invoice from merchant
          ▼
   ┌─────────────┐
   │  Merchant   │  Generates invoice: {merchant_nft, amount, order_id}
   │    API      │
   └──────┬──────┘
          │
          │ Returns invoice details
          ▼

2. USER REVIEWS & SIGNS TRANSACTION
   ┌─────────────┐
   │    User     │  Reviews:
   │   Wallet    │    • Merchant address
   │ (TON Connect)   • Amount (100 TBC)
   └──────┬──────┘    • Gas fee
          │
          │ Signs transaction with private key
          │ (Private key NEVER leaves wallet)
          ▼

3. TRANSACTION BROADCAST TO BLOCKCHAIN
   ┌──────────────────────────────────┐
   │      TON Blockchain              │
   │  Transaction enters mempool      │
   │  Validators process transaction  │
   └──────┬───────────────────────────┘
          │
          │ Transaction mined into block
          ▼

4. SMART CONTRACT EXECUTION
   ┌────────────────────────────────────────┐
   │  MerchantPaymentHub.payMerchant()     │
   │                                        │
   │  [All validations from Diagram 4]     │
   │                                        │
   │  • Check ownership                     │
   │  • Check state (ACTIVE)                │
   │  • Check locks (none)                  │
   │  • Check balance (≥ 100 TBC)           │
   │  • Execute atomic transfer             │
   │    - Debit payer: 100 TBC              │
   │    - Credit merchant: 100 TBC          │
   │  • Emit MerchantPayment event          │
   └────────┬───────────────────────────────┘
            │
            │ Transaction succeeds
            ▼

5. EVENT INDEXING & NOTIFICATION
   ┌─────────────┐
   │   Indexer   │  Captures MerchantPayment event
   │             │  Updates off-chain cache
   └──────┬──────┘
          │
          │ Notifies merchant API
          ▼
   ┌─────────────┐
   │  Merchant   │  Payment confirmed!
   │    API      │  Order #123 marked as paid
   └──────┬──────┘
          │
          │ Webhook to merchant
          ▼
   ┌─────────────┐
   │  Merchant   │  Fulfills order
   │  Backend    │
   └─────────────┘

SECURITY CHECKPOINTS:
✅ Checkpoint 1: User reviews transaction details in wallet
✅ Checkpoint 2: User signs with private key (user-only)
✅ Checkpoint 3: Smart contract validates ownership
✅ Checkpoint 4: Smart contract checks state & locks
✅ Checkpoint 5: Smart contract verifies balance
✅ Checkpoint 6: Atomic transfer (all-or-nothing)
✅ Checkpoint 7: Event emitted for auditability

FAILURE POINTS (Graceful Degradation):
❌ If merchant API down → User can still pay on-chain
❌ If indexer down → On-chain state unaffected
❌ If frontend down → User can use alternative frontend or CLI
❌ If wallet rejects → Transaction never reaches blockchain
```

---

## 10. Threat Model Visual Summary

```
┌───────────────────────────────────────────────────────────────────┐
│               THREAT CLASSIFICATION & SEVERITY                     │
└───────────────────────────────────────────────────────────────────┘

🔴 CRITICAL THREATS (Must Prevent)
┌────────────────────────────────────────────────────────────┐
│ T1: NFT Transfer Race Conditions                           │ ✅ MITIGATED
│ T3: Ledger Desynchronization                               │ ✅ MITIGATED
│ T9: Smart Contract Bugs (fund loss)                        │ ⚠️ AUDIT NEEDED
└────────────────────────────────────────────────────────────┘

🟠 HIGH THREATS (Strong Mitigation Required)
┌────────────────────────────────────────────────────────────┐
│ T4: Lock Bypass Attempts                                   │ ✅ MITIGATED
│ T5: Merchant Payment Abuse                                 │ ⚠️ PARTIAL
│ T8: Admin Key Compromise                                   │ ⚠️ PARTIAL (DoS only)
└────────────────────────────────────────────────────────────┘

🟡 MEDIUM THREATS (Acceptable Residual Risk)
┌────────────────────────────────────────────────────────────┐
│ T6: External Adapter Exploits                              │ ✅ ISOLATED
│ T10: Frontend/UI Attacks                                   │ ⚠️ USER DEPENDENT
└────────────────────────────────────────────────────────────┘

🟢 LOW THREATS (Monitored)
┌────────────────────────────────────────────────────────────┐
│ T2: Reentrancy (TON prevents)                              │ ✅ PREVENTED
│ T11: Denial of Service                                     │ ⚠️ INHERENT TO BLOCKCHAIN
└────────────────────────────────────────────────────────────┘

THREAT → MITIGATION → RESIDUAL RISK MAPPING

T1 (NFT Race) ──→ Atomic ownership checks ──→ 🟢 LOW
T3 (Ledger)   ──→ Balance conservation   ──→ 🟢 LOW
T4 (Lock)     ──→ Protocol enforcement   ──→ 🟢 LOW
T5 (Merchant) ──→ User-initiated only    ──→ 🟡 MEDIUM (replay off-chain)
T6 (Adapter)  ──→ Isolation              ──→ 🟡 MEDIUM (UX impact)
T8 (Admin)    ──→ No fund access         ──→ 🟡 MEDIUM (DoS possible)
T9 (Bugs)     ──→ Testing + Audit        ──→ 🟠 MEDIUM (pending audit)
```

---

## Auditor Quick Reference

### Key Files to Review (Priority Order)

1. **🔴 CRITICAL**:
   - `contracts/MerchantPaymentHub.tact` - Merchant payment logic
   - `contracts/payments/PaymentHub.tact` - Internal transfers
   - `contracts/payment-hub/account-state.tact` - Balance management
   - `contracts/nft-resolver/nft_account_resolver.fc` - Ownership

2. **🟠 HIGH**:
   - `contracts/payments/account-locks.fc` - Lock enforcement
   - `docs/invariants.md` - Protocol invariants
   - `docs/threat-model.md` - Threat analysis

3. **🟡 MEDIUM**:
   - `contracts/types/*.tact` - Type definitions
   - `contracts/interfaces/*.tact` - Interfaces
   - `tests/*.spec.ts` - Test coverage

### Key Invariants to Verify

- **I1**: Non-Custodial (no admin fund access)
- **I3**: Balance Conservation (sum unchanged)
- **I4**: Atomic Execution (all-or-nothing)
- **I5**: Lock Enforcement (locks prevent sending)
- **I7**: No Phantom Balances (balance integrity)

### Test Commands

```bash
# Run all tests
npx blueprint test

# Run with coverage
npx blueprint test --coverage

# Run specific test suite
npx blueprint test MerchantPaymentHub.spec.ts
```

---

**Document Status**: Audit Preparation
**Last Updated**: 2025-12-27
**Maintainers**: Tonbankcard Protocol Team
**Audit Version**: 1.0
