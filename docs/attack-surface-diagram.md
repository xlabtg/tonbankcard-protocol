# TONBANKCARD Protocol — Attack Surface Diagrams

**Document Type:** Visual Security Architecture
**Issue Reference:** [#20 - Issue 4.2 Threat Model & Attack Surface Analysis](https://github.com/xlabtg/tonbankcard-protocol/issues/20)
**Companion Document:** [threat-model.md](./threat-model.md)
**Last Updated:** 2025-12-27

---

## Overview

This document provides visual representations of the TONBANKCARD protocol's attack surface, trust boundaries, and threat vectors. These diagrams complement the detailed threat model documentation.

---

## 1. Complete System Architecture with Trust Boundaries

```mermaid
graph TB
    subgraph TB1["<b>TRUST BOUNDARY 1: TON Blockchain (ABSOLUTE TRUST)</b>"]
        CONSENSUS[TON Validator Consensus<br/>Byzantine Fault Tolerant]
        CRYPTO[Cryptographic Primitives<br/>ECDSA, SHA-256]
    end

    subgraph TB2["<b>TRUST BOUNDARY 2: Smart Contracts (HIGH TRUST - IMMUTABLE)</b>"]
        subgraph PROTOCOL["Protocol Contracts"]
            PH[Payment Hub<br/>payment-hub.fc<br/>⚠️ T1, T2, T3, T4, T5, T8]
            AL[Account Locks<br/>account-locks.fc<br/>⚠️ T4, T8]
            NR[NFT Resolver<br/>nft_account_resolver.fc<br/>⚠️ T1 minor]
        end

        subgraph EXTERNAL_CONTRACTS["External Immutable Contracts"]
            NFT[NFT Collections<br/>7777, 8888]
            TBC[TBC Jetton<br/>Master & Wallets]
            DEX[TONCO DEX<br/>Liquidity Pool]
        end
    end

    subgraph TB3["<b>TRUST BOUNDARY 3: Off-Chain Components (MEDIUM TRUST)</b>"]
        IDX[Backend Indexer<br/>READ-ONLY<br/>⚠️ T3 staleness]
        API[Merchant API<br/>Orchestration<br/>⚠️ T5]
        UI[Frontend UI<br/>Presentation<br/>⚠️ Phishing risk]
    end

    subgraph TB4["<b>TRUST BOUNDARY 4: External Services (LOW TRUST - ADVERSARIAL)</b>"]
        CN[ChangeNOW<br/>Swap API<br/>⚠️ T6]
        NP[NOWPayments<br/>Payment API<br/>⚠️ T6]
        CR[CoinRabbit<br/>Lending API<br/>⚠️ T7 future]
    end

    %% Trust flow
    CONSENSUS -.-> PH
    CONSENSUS -.-> AL
    CONSENSUS -.-> NR

    PH <--> NFT
    PH <--> TBC
    PH <--> AL
    NR -.-> NFT

    TBC <--> DEX

    IDX -.reads.-> PH
    IDX -.reads.-> AL
    IDX -.reads.-> NFT
    IDX -.reads.-> TBC

    API --> IDX
    UI --> API
    UI -.signs tx.-> PH

    API -.queries.-> CN
    API -.queries.-> NP
    API -.queries.-> CR

    DEX -.liquidity.-> CN

    classDef trust1 fill:#2ecc71,stroke:#27ae60,stroke-width:4px,color:#000
    classDef trust2 fill:#3498db,stroke:#2980b9,stroke-width:3px,color:#fff
    classDef trust3 fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000
    classDef trust4 fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff

    class TB1,CONSENSUS,CRYPTO trust1
    class TB2,PH,AL,NR,NFT,TBC,DEX trust2
    class TB3,IDX,API,UI trust3
    class TB4,CN,NP,CR trust4
```

---

## 2. Threat Vector Flow Diagram

```mermaid
graph LR
    subgraph ATTACKERS["<b>ATTACKER CAPABILITIES</b>"]
        A1[On-Chain Observer<br/>View all state]
        A2[Front-Runner<br/>MEV attacks]
        A3[Malicious Contract<br/>Reentrancy attempts]
        A4[NFT Market Actor<br/>Buy/sell NFTs]
        A5[Compromised Admin<br/>Abuse privileges]
        A6[External Service<br/>False data]
    end

    subgraph THREATS["<b>THREAT VECTORS</b>"]
        T1[T1: NFT Race<br/>Ownership timing]
        T2[T2: Reentrancy<br/>Callback abuse]
        T3[T3: Ledger Desync<br/>Phantom balances]
        T4[T4: Lock Bypass<br/>Alternate paths]
        T5[T5: Merchant Abuse<br/>Replay/unauthorized]
        T6[T6: External Exploit<br/>API spoofing]
        T7[T7: Oracle Attack<br/>Price manipulation]
        T8[T8: Admin Compromise<br/>Key theft]
    end

    subgraph TARGETS["<b>TARGET COMPONENTS</b>"]
        C1[Payment Hub<br/>Transfer logic]
        C2[Account Locks<br/>Lock enforcement]
        C3[TBC Jetton<br/>Balance storage]
        C4[Merchant API<br/>Settlement]
        C5[External Adapters<br/>Gateways]
    end

    A1 --> T1
    A2 --> T1
    A3 --> T2
    A4 --> T1
    A4 --> T4
    A5 --> T8
    A6 --> T6
    A6 --> T7

    T1 --> C1
    T2 --> C1
    T2 --> C2
    T3 --> C1
    T3 --> C3
    T4 --> C1
    T4 --> C2
    T5 --> C1
    T5 --> C4
    T6 --> C4
    T6 --> C5
    T7 --> C5
    T8 --> C1
    T8 --> C2

    classDef attacker fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef threat fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000
    classDef target fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff

    class A1,A2,A3,A4,A5,A6 attacker
    class T1,T2,T3,T4,T5,T6,T7,T8 threat
    class C1,C2,C3,C4,C5 target
```

---

## 3. Payment Hub Attack Surface Detail

```mermaid
graph TD
    subgraph PUBLIC_INTERFACE["<b>PAYMENT HUB PUBLIC INTERFACE</b>"]
        RECV[recv_internal<br/>Main Entry Point]
    end

    subgraph OPERATIONS["<b>OPERATIONS (Attack Vectors)</b>"]
        OP1[op::internal_transfer<br/>⚠️ T1, T4 NFT race, Lock bypass]
        OP2[op::merchant_payment<br/>⚠️ T1, T4, T5 NFT race, Lock bypass, Replay]
        OP3[op::payment_received<br/>⚠️ T6 External adapter]
        OP4[op::set_paused<br/>⚠️ T8 Admin abuse]
        OP5[op::account_flagged<br/>⚠️ T8 Admin abuse]
    end

    subgraph VALIDATION["<b>VALIDATION LAYER</b>"]
        V1[verify_nft_account<br/>Ownership check<br/>✅ Runtime verification]
        V2[Collection whitelist<br/>✅ Immutable list]
        V3[Blocked accounts<br/>✅ Admin controlled]
        V4["❌ MISSING: Lock check<br/>CRITICAL VULNERABILITY"]
    end

    subgraph STATE["<b>STATE MANAGEMENT</b>"]
        S1[Admin address<br/>⚠️ Single key]
        S2[Paused flag<br/>DoS vector]
        S3[NFT collections<br/>Whitelist dict]
        S4[Blocked accounts<br/>Censorship dict]
        S5[TBC jetton master<br/>Immutable ref]
    end

    subgraph EXTERNAL_CALLS["<b>EXTERNAL INTERACTIONS</b>"]
        E1[get_nft_owner<br/>Query NFT contract<br/>⚠️ T1 race window]
        E2[emit_event<br/>External message<br/>⚠️ T2 timing]
        E3["TBC jetton transfer<br/>(Not implemented)<br/>⚠️ T3 desync risk"]
    end

    RECV --> OP1
    RECV --> OP2
    RECV --> OP3
    RECV --> OP4
    RECV --> OP5

    OP1 --> V1
    OP1 --> V2
    OP1 --> V3
    OP1 -.MISSING.-> V4

    OP2 --> V1
    OP2 --> V2
    OP2 -.MISSING.-> V4

    OP4 --> S1
    OP5 --> S1

    V1 --> E1
    OP1 --> E2
    OP2 --> E2
    OP1 -.FUTURE.-> E3

    classDef critical fill:#e74c3c,stroke:#c0392b,stroke-width:3px,color:#fff
    classDef warning fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000
    classDef safe fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000
    classDef missing fill:#95a5a6,stroke:#7f8c8d,stroke-width:2px,color:#fff,stroke-dasharray: 5 5

    class OP4,OP5,V4 critical
    class OP1,OP2,OP3,E1,E2,E3,S1,S2 warning
    class V1,V2,V3,S5 safe
    class V4,E3 missing
```

---

## 4. Account Locks Contract Attack Surface

```mermaid
graph TD
    subgraph INTERFACE["<b>ACCOUNT LOCKS INTERFACE</b>"]
        RECV_AL[recv_internal<br/>Message Handler]
        GET[GET Methods<br/>Read-Only Queries]
    end

    subgraph LOCK_OPS["<b>LOCK OPERATIONS</b>"]
        L1[set_fraud_lock<br/>⚠️ T8 Risk authority]
        L2[clear_fraud_lock<br/>⚠️ T8 Risk authority]
        L3[set_collateral_lock<br/>⚠️ Lending adapter]
        L4[clear_collateral_lock<br/>⚠️ Lending adapter]
        L5[check_can_send<br/>✅ Used by Payment Hub]
    end

    subgraph AUTH["<b>AUTHORIZATION</b>"]
        A1[risk_authority<br/>⚠️ Single key<br/>Controls fraud locks]
        A2[lending_adapter<br/>⚠️ Single key<br/>Controls collateral locks]
    end

    subgraph LOCK_STATE["<b>LOCK STATE STORAGE</b>"]
        LS[Lock Dictionary<br/>nft_address → lock_flags<br/>fraud_locked: bool<br/>collateral_locked: bool]
    end

    subgraph QUERIES["<b>PUBLIC QUERIES</b>"]
        Q1[get_lock_state<br/>Returns flags]
        Q2[can_send<br/>0 if any lock active]
        Q3[can_receive<br/>Always returns 1<br/>✅ Invariant I6]
    end

    subgraph BYPASS["<b>BYPASS VECTORS</b>"]
        B1[Direct TBC Jetton Transfer<br/>⚠️ T4 CRITICAL<br/>Bypasses lock checks<br/>Locks are ADVISORY]
        B2[NFT Transfer<br/>New owner inherits locks<br/>✅ Lock persists]
    end

    RECV_AL --> L1
    RECV_AL --> L2
    RECV_AL --> L3
    RECV_AL --> L4
    RECV_AL --> L5

    L1 --> A1
    L2 --> A1
    L3 --> A2
    L4 --> A2

    L1 --> LS
    L2 --> LS
    L3 --> LS
    L4 --> LS

    GET --> Q1
    GET --> Q2
    GET --> Q3

    Q1 --> LS
    Q2 --> LS
    Q3 --> LS

    LS -.bypassed by.-> B1
    LS -.checked on.-> B2

    classDef critical fill:#e74c3c,stroke:#c0392b,stroke-width:3px,color:#fff
    classDef warning fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000
    classDef safe fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000

    class B1,A1,A2 critical
    class L1,L2,L3,L4,L5,LS warning
    class Q3,B2 safe
```

---

## 5. Data Flow: Internal Transfer with Attack Points

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend UI
    participant Wallet as TON Wallet
    participant PH as Payment Hub<br/>⚠️ Attack Surface
    participant AL as Account Locks<br/>⚠️ Attack Surface
    participant NFT as NFT Contract
    participant TBC as TBC Jetton
    participant Indexer

    Note over User,Indexer: NORMAL FLOW (Green) vs ATTACK POINTS (Red)

    User->>UI: Initiate transfer<br/>1000 TBC from NFT A to NFT B
    UI->>Wallet: Request signature

    rect rgb(255, 200, 200)
        Note over Wallet: ⚠️ T1 ATTACK WINDOW<br/>NFT ownership can change here
    end

    Wallet->>User: Sign transaction
    User->>Wallet: Approve
    Wallet->>PH: Send op::internal_transfer<br/>(from=NFT A, to=NFT B, amount=1000)

    rect rgb(255, 200, 200)
        Note over PH: ⚠️ T1 RACE CONDITION<br/>Check ownership at execution time
    end

    PH->>NFT: get_nft_owner(NFT A)
    NFT-->>PH: owner = User address

    alt Ownership Mismatch
        rect rgb(255, 100, 100)
            PH->>Wallet: THROW error::unauthorized<br/>❌ Attack prevented
        end
    end

    PH->>PH: verify_nft_account(NFT A, User)

    rect rgb(255, 200, 200)
        Note over PH,AL: ❌ MISSING: Lock check<br/>T4 VULNERABILITY<br/>Should call AL.can_send(NFT A)
    end

    alt If lock check was implemented
        PH->>AL: can_send(NFT A)
        AL-->>PH: 0 (locked) or 1 (unlocked)

        alt Account Locked
            rect rgb(255, 100, 100)
                PH->>Wallet: THROW error::account_blocked<br/>❌ Attack prevented
            end
        end
    end

    PH->>TBC: Transfer 1000 TBC<br/>from NFT A wallet to NFT B wallet

    rect rgb(255, 200, 200)
        Note over TBC: ⚠️ T3 DESYNC RISK<br/>Jetton must be source of truth
    end

    TBC->>TBC: Validate balance
    TBC->>TBC: Debit 1000 from NFT A
    TBC->>TBC: Credit 1000 to NFT B

    rect rgb(200, 255, 200)
        Note over TBC: ✅ Atomic operation<br/>Invariant I4 preserved
    end

    TBC-->>PH: Transfer complete

    PH->>PH: emit_event(InternalTransfer)

    rect rgb(255, 200, 200)
        Note over PH: ⚠️ T2 ATTACK WINDOW<br/>Event emission could trigger<br/>malicious callback (mitigated by TON)
    end

    PH-->>Wallet: Success

    Wallet->>User: Transfer confirmed

    PH->>Indexer: Event: InternalTransfer

    rect rgb(255, 200, 200)
        Note over Indexer: ⚠️ T3 STALENESS<br/>Cache may be temporarily incorrect
    end

    Indexer->>Indexer: Update cache

    Indexer->>UI: Balance updated
    UI->>User: Display new balance

    rect rgb(255, 255, 200)
        Note over User: ⚠️ UI may show stale data<br/>User should verify on-chain
    end
```

---

## 6. Attack Tree: NFT Transfer Race Condition (T1)

```mermaid
graph TD
    ROOT[T1: NFT Transfer Race Attack<br/>GOAL: Hijack account or double-spend]

    subgraph ATTACK_PATHS["<b>ATTACK PATHS</b>"]
        A1[Path 1: Front-Running<br/>Observe pending tx, buy NFT first]
        A2[Path 2: MEV Extraction<br/>Validator reorders transactions]
        A3[Path 3: Concurrent Transfer<br/>Transfer NFT during payment execution]
    end

    subgraph CONDITIONS["<b>REQUIRED CONDITIONS</b>"]
        C1[NFT is transferable<br/>Not soulbound]
        C2[Attacker has funds<br/>To purchase NFT]
        C3[Transaction visible<br/>In mempool]
        C4[Ownership check<br/>Has timing gap]
    end

    subgraph MITIGATIONS["<b>MITIGATIONS IN PLACE</b>"]
        M1[✅ Runtime Ownership Verify<br/>Check at execution, not submission]
        M2[✅ Atomic Transaction<br/>No intermediate states]
        M3[✅ No Cached Ownership<br/>Always query NFT contract]
        M4[⚠️ TON Consensus<br/>Makes MEV difficult but not impossible]
    end

    subgraph OUTCOMES["<b>ATTACK OUTCOMES</b>"]
        O1[❌ FAIL: Ownership Mismatch<br/>Transaction reverts<br/>error::unauthorized]
        O2[✅ SUCCESS: Legitimate Purchase<br/>Attacker bought NFT legally<br/>Gains access to balance<br/>This is INTENDED behavior]
        O3[⚠️ PARTIAL: Ordering Advantage<br/>Attacker's tx processes first<br/>User's tx fails<br/>User inconvenience only]
    end

    ROOT --> A1
    ROOT --> A2
    ROOT --> A3

    A1 --> C1
    A1 --> C2
    A1 --> C3
    A2 --> C3
    A2 --> C4
    A3 --> C1
    A3 --> C4

    C1 --> M1
    C2 --> M2
    C3 --> M4
    C4 --> M1

    M1 --> O1
    M2 --> O1
    M4 --> O2
    A1 --> O2
    A2 --> O3

    classDef attack fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef condition fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000
    classDef mitigation fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff
    classDef fail fill:#95a5a6,stroke:#7f8c8d,stroke-width:2px,color:#fff
    classDef success fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000

    class ROOT,A1,A2,A3 attack
    class C1,C2,C3,C4 condition
    class M1,M2,M3,M4 mitigation
    class O1,O3 fail
    class O2 success
```

---

## 7. Attack Tree: Lock Bypass Attempt (T4)

```mermaid
graph TD
    ROOT[T4: Lock Bypass Attack<br/>GOAL: Move funds despite account lock]

    subgraph PATHS["<b>ATTACK PATHS</b>"]
        P1[Path 1: Payment Hub<br/>Internal transfer with lock]
        P2[Path 2: Direct Jetton<br/>Bypass Payment Hub entirely]
        P3[Path 3: NFT Transfer<br/>Transfer ownership to unlock]
        P4[Path 4: Lock Flag Manipulation<br/>Compromise authority key]
    end

    subgraph P1_FLOW["<b>PATH 1 DETAILS</b>"]
        P1A[Send op::internal_transfer]
        P1B[Payment Hub validates]
        P1C{Lock check exists?}
        P1D[✅ CURRENT: No lock check<br/>❌ VULNERABILITY]
        P1E[🔧 FUTURE: Check AL.can_send]
    end

    subgraph P2_FLOW["<b>PATH 2 DETAILS</b>"]
        P2A[Send jetton transfer<br/>directly to TBC wallet]
        P2B[TBC jetton validates balance]
        P2C{TBC knows about locks?}
        P2D[❌ NO: TBC is immutable<br/>No lock integration]
        P2E[✅ Transfer succeeds<br/>BYPASS SUCCESSFUL]
    end

    subgraph P3_FLOW["<b>PATH 3 DETAILS</b>"]
        P3A[Transfer NFT to new address]
        P3B[New owner tries to send]
        P3C{Lock persists?}
        P3D[✅ YES: Lock tied to NFT address<br/>Not owner address]
        P3E[❌ Still locked<br/>BYPASS FAILS]
    end

    subgraph P4_FLOW["<b>PATH 4 DETAILS</b>"]
        P4A[Compromise risk_authority<br/>or lending_adapter key]
        P4B[Send op::clear_fraud_lock<br/>or op::clear_collateral_lock]
        P4C{Key compromise successful?}
        P4D[✅ YES: Lock cleared<br/>CRITICAL VULNERABILITY]
        P4E[❌ NO: Attack fails<br/>Authorization error]
    end

    ROOT --> P1
    ROOT --> P2
    ROOT --> P3
    ROOT --> P4

    P1 --> P1A --> P1B --> P1C
    P1C -->|Current| P1D
    P1C -->|Future| P1E
    P1D --> SUCCESS1[❌ ATTACK SUCCEEDS<br/>Lock bypassed via Payment Hub]
    P1E --> FAIL1[✅ ATTACK FAILS<br/>error::account_blocked]

    P2 --> P2A --> P2B --> P2C --> P2D --> P2E
    P2E --> SUCCESS2[❌ ATTACK SUCCEEDS<br/>Lock bypassed via direct transfer<br/>⚠️ BY DESIGN limitation]

    P3 --> P3A --> P3B --> P3C --> P3D --> P3E
    P3E --> FAIL2[✅ ATTACK FAILS<br/>Lock persists with NFT]

    P4 --> P4A --> P4B --> P4C
    P4C -->|Yes| P4D
    P4C -->|No| P4E
    P4D --> SUCCESS3[❌ ATTACK SUCCEEDS<br/>Admin key compromise]
    P4E --> FAIL3[✅ ATTACK FAILS<br/>Unauthorized]

    classDef attack fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef success fill:#c0392b,stroke:#a93226,stroke-width:3px,color:#fff
    classDef fail fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000
    classDef warning fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000

    class ROOT,P1,P2,P3,P4 attack
    class SUCCESS1,SUCCESS2,SUCCESS3 success
    class FAIL1,FAIL2,FAIL3 fail
    class P1D,P2D,P2E,P4D warning
```

---

## 8. Threat Severity Matrix

```mermaid
quadrantChart
    title Threat Risk Assessment (Impact vs. Likelihood)
    x-axis Low Likelihood --> High Likelihood
    y-axis Low Impact --> High Impact
    quadrant-1 Critical - Immediate Action
    quadrant-2 High - Plan Mitigation
    quadrant-3 Medium - Monitor
    quadrant-4 Low - Accept Risk

    T8 Admin Compromise: [0.3, 0.95]
    T4 Lock Bypass (Payment Hub): [0.8, 0.85]
    T3 Ledger Desync: [0.2, 0.9]
    T4 Lock Bypass (Direct Jetton): [0.7, 0.7]
    T1 NFT Race (MEV): [0.4, 0.6]
    T5 Merchant Abuse: [0.5, 0.5]
    T6 External Adapter: [0.6, 0.4]
    T2 Reentrancy: [0.2, 0.7]
    T7 Oracle (Future): [0.3, 0.8]
    T1 NFT Race (Front-run): [0.5, 0.3]
```

**Legend:**
- **Quadrant 1 (Top-Right)**: Critical risks requiring immediate action
  - T8: Admin key compromise
  - T4: Lock bypass via Payment Hub (missing check)

- **Quadrant 2 (Top-Left)**: High impact, lower likelihood - plan mitigation
  - T3: Ledger desynchronization
  - T7: Oracle manipulation (future)
  - T2: Reentrancy (low likelihood due to TON)

- **Quadrant 3 (Bottom-Left)**: Medium risk - monitor and document
  - T1: NFT race (front-running)
  - T5: Merchant abuse

- **Quadrant 4 (Bottom-Right)**: Lower impact, higher likelihood - accept or minor fixes
  - T4: Lock bypass via direct jetton (architectural limitation)
  - T6: External adapter exploits
  - T1: NFT race (MEV)

---

## 9. Invariant Protection Map

```mermaid
graph TD
    subgraph INVARIANTS["<b>PROTOCOL INVARIANTS (Issue #18)</b>"]
        I1[I1: Non-Custodial Ownership<br/>User funds always user-controlled]
        I2[I2: NFT = Account Authority<br/>Ownership is sole authority]
        I3[I3: No Admin Fund Control<br/>No privileged transfers]
        I4[I4: Atomic Transfers<br/>All-or-nothing execution]
        I5[I5: Ledger Conservation<br/>Σ balances = total supply]
        I6[I6: Lock ≠ Confiscation<br/>Locks are reversible flags]
        I7[I7: External Adapter Isolation<br/>No authority to external services]
    end

    subgraph PROTECTIONS["<b>PROTECTION MECHANISMS</b>"]
        P1[Runtime Ownership Verify<br/>payment-hub.fc:96-112]
        P2[No Admin Transfer Functions<br/>Architecture constraint]
        P3[TON Actor Model<br/>Message-passing semantics]
        P4[TBC Jetton as Source of Truth<br/>External immutable contract]
        P5[Receiving Always Allowed<br/>account-locks.fc:95-98]
        P6[On-Chain Confirmation Required<br/>payment-hub.fc:200-230]
    end

    subgraph THREATS_MAP["<b>THREATS TARGETING INVARIANTS</b>"]
        T1_MAP[T1: NFT Race<br/>→ I1, I2]
        T2_MAP[T2: Reentrancy<br/>→ I4, I5]
        T3_MAP[T3: Ledger Desync<br/>→ I1, I5]
        T4_MAP[T4: Lock Bypass<br/>→ I6]
        T5_MAP[T5: Merchant Abuse<br/>→ I2, I3]
        T6_MAP[T6: External Adapter<br/>→ I7]
        T8_MAP[T8: Admin Compromise<br/>→ I3, I6]
    end

    I1 --> P1
    I1 --> P4
    I2 --> P1
    I3 --> P2
    I4 --> P3
    I4 --> P4
    I5 --> P4
    I6 --> P5
    I7 --> P6

    T1_MAP -.attacks.-> I1
    T1_MAP -.attacks.-> I2
    T2_MAP -.attacks.-> I4
    T2_MAP -.attacks.-> I5
    T3_MAP -.attacks.-> I1
    T3_MAP -.attacks.-> I5
    T4_MAP -.attacks.-> I6
    T5_MAP -.attacks.-> I2
    T5_MAP -.attacks.-> I3
    T6_MAP -.attacks.-> I7
    T8_MAP -.attacks.-> I3
    T8_MAP -.attacks.-> I6

    P1 -.defends.-> T1_MAP
    P2 -.defends.-> T5_MAP
    P2 -.defends.-> T8_MAP
    P3 -.defends.-> T2_MAP
    P4 -.defends.-> T3_MAP
    P5 -.defends.-> T4_MAP
    P6 -.defends.-> T6_MAP

    classDef invariant fill:#3498db,stroke:#2980b9,stroke-width:3px,color:#fff
    classDef protection fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000
    classDef threat fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff

    class I1,I2,I3,I4,I5,I6,I7 invariant
    class P1,P2,P3,P4,P5,P6 protection
    class T1_MAP,T2_MAP,T3_MAP,T4_MAP,T5_MAP,T6_MAP,T8_MAP threat
```

---

## 10. External Integration Attack Vectors

```mermaid
graph TD
    subgraph USER_FLOW["<b>USER EXTERNAL DEPOSIT FLOW</b>"]
        U1[User: Initiate deposit<br/>1000 USDT → TBC]
        U2[Frontend: Query external APIs]
        U3[ChangeNOW: Generate deposit address]
        U4[User: Send USDT to deposit address]
    end

    subgraph EXTERNAL_PROCESSING["<b>EXTERNAL SERVICE (UNTRUSTED)</b>"]
        E1[ChangeNOW: Receive USDT]
        E2[ChangeNOW: Process swap<br/>⚠️ T6 ATTACK POINT<br/>May lie about completion]
        E3[ChangeNOW: Send TON to DEX]
        E4[DEX: Swap TON → TBC<br/>✅ ON-CHAIN, TRUSTED]
        E5[DEX: Send TBC to user wallet]
    end

    subgraph CONFIRMATION["<b>ON-CHAIN CONFIRMATION (REQUIRED)</b>"]
        C1[TBC Jetton: Transfer event<br/>✅ Blockchain truth]
        C2[Indexer: Detect transfer]
        C3[Merchant API: Verify on-chain]
        C4{On-chain confirmed?}
        C5[✅ Credit user account<br/>Display in UI]
        C6[❌ Do NOT credit<br/>External API was lying]
    end

    subgraph ATTACK_SCENARIOS["<b>ATTACK SCENARIOS</b>"]
        A1[Attack 1: False Confirmation<br/>ChangeNOW says "completed"<br/>but never sent TON]
        A2[Attack 2: MITM<br/>Attacker intercepts API response<br/>returns fake success]
        A3[Attack 3: Webhook Spoof<br/>Attacker sends fake webhook<br/>to merchant API]
    end

    U1 --> U2 --> U3 --> U4
    U4 --> E1 --> E2

    E2 -->|Honest path| E3 --> E4 --> E5
    E5 --> C1 --> C2 --> C3 --> C4

    C4 -->|Yes| C5
    C4 -->|No| C6

    E2 -.Attack 1.-> A1
    U2 -.Attack 2.-> A2
    C3 -.Attack 3.-> A3

    A1 --> C3
    A2 --> C3
    A3 --> C3

    A1 --> C6
    A2 --> C6
    A3 --> C6

    classDef user fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff
    classDef external fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef safe fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#000
    classDef attack fill:#f39c12,stroke:#e67e22,stroke-width:2px,color:#000

    class U1,U2,U3,U4 user
    class E1,E2,E3 external
    class C1,C2,C3,C4,C5,E4,E5 safe
    class A1,A2,A3,C6 attack
```

---

## Summary

These diagrams provide visual representations of:

1. **Trust Boundaries** - Four-tier trust model from blockchain consensus to external services
2. **Threat Vectors** - Attack paths from capabilities to targets
3. **Attack Surfaces** - Detailed entry points in Payment Hub and Account Locks
4. **Data Flows** - Sequence of operations with attack windows highlighted
5. **Attack Trees** - Detailed paths for NFT race and lock bypass attacks
6. **Risk Matrix** - Threat prioritization based on impact and likelihood
7. **Invariant Protection** - How protocol mechanisms defend core guarantees
8. **External Integration** - Attack vectors in external service integration

For detailed threat descriptions, mitigations, and test cases, see the companion [threat-model.md](./threat-model.md) document.

---

**Document Status**: ✅ Complete
**Rendering**: Use Mermaid-compatible viewers (GitHub, GitLab, Mermaid Live Editor)
**Next Update**: When new contracts deployed or threats identified
