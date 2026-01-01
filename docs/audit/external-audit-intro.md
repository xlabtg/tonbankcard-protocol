# TONBANKCARD

## External Audit Intro Pack

**Protocol Version:** v1.0 (Frozen)
**Network:** TON
**Status:** Audit-Ready
**Date:** 2025

---

## 1. Purpose of This Document

This document provides auditors with a **single, authoritative entry point** to the TONBANKCARD protocol.

Its goals are to:

* define audit scope clearly
* explain protocol intent and constraints
* eliminate incorrect assumptions
* reduce audit time spent on discovery
* prevent misclassification of design decisions as vulnerabilities

---

## 2. Protocol Summary (High-Level)

TONBANKCARD is a **non-custodial financial infrastructure protocol** built on TON.

At its core, the protocol provides:

* NFT-based account abstraction
* On-chain payment settlement in TBC
* Merchant payment orchestration
* Risk signaling & collateral signaling
* Non-executable governance

The protocol **does not custody funds** and **cannot control user assets**.

---

## 3. Fundamental Design Principles (CRITICAL)

Auditors should evaluate the protocol under these **explicit constraints**:

### 3.1 Non-Custodial by Design

* No private keys stored
* No admin withdrawals
* No forced transfers
* No protocol-owned balances

### 3.2 NFT Ownership = Account Authority

* NFT ownership is the **sole** account control mechanism
* No secondary authorization layers exist

### 3.3 Immutability

* No upgradeable contracts
* No proxies
* No pause or emergency switches

### 3.4 Explicit Failure Over Implicit Behavior

* Transactions either succeed or revert
* No silent state correction
* No automated recovery logic

These are **intentional properties**, not limitations.

---

## 4. Audit Scope

### 4.1 In-Scope Components

| Component                  | Description                  | Priority    |
| -------------------------- | ---------------------------- | ----------- |
| PaymentHub                 | Core settlement & accounting | 🔴 Critical |
| MerchantPaymentHub         | Merchant payments            | 🔴 Critical |
| NFT Account Resolver       | Account abstraction          | 🔴 Critical |
| Account State Machine      | Balances & transitions       | 🔴 Critical |
| Account Locks              | Risk signaling               | 🟠 High     |
| Internal Transfers         | NFT ↔ NFT payments           | 🔴 Critical |
| Collateral Signal Contract | TON-based signaling          | 🟠 High     |
| Governance Registry        | Proposal & votes             | 🟡 Medium   |

### 4.2 Out-of-Scope

The following are **explicitly excluded**:

* Indexers & off-chain services
* Merchant backend implementations
* UI / frontend
* External providers (ChangeNOW, NOWPayments)
* External lending platforms (CoinRabbit)

---

## 5. Trust Model

### 5.1 On-Chain

* Smart contracts are the **only source of truth**
* No trusted operators
* No multisigs
* No admin roles

### 5.2 Off-Chain

* Indexers are **read-only**
* APIs are **non-authoritative**
* Off-chain failures must not affect on-chain safety

---

## 6. Threat Model Summary

Auditors should focus on:

* unauthorized fund movement
* invariant violations
* state desynchronization
* NFT ownership edge cases
* re-entrancy & message ordering
* griefing / DoS via locks or flags

Auditors should **not** treat the absence of admin recovery as a vulnerability.

Full threat model is documented in:

```
docs/security/threat-model.md
```

---

## 7. Formal Invariants (Selected)

Key invariants enforced by the protocol:

* Funds can only move with NFT ownership proof
* Total TBC in accounts = on-chain balance
* Locked accounts cannot initiate outgoing transfers
* Merchant settlement cannot exceed payer balance
* Collateral signaling cannot move funds

Full list:

```
docs/security/invariants.md
```

---

## 8. Known Design Trade-Offs (NOT BUGS)

Auditors are explicitly informed that the following are **intentional**:

* No admin recovery
* No emergency pause
* No protocol refunds
* No forced liquidation
* No governance execution

Findings based solely on these properties should be marked **Informational**.

---

## 9. Deployment & Freeze Information

* **Protocol version:** v1.0
* **Deployment status:** Frozen
* **Target network:** TON Mainnet
* **Compiler versions:**

  * Tact — stable
  * FunC — TON Labs release

All deployed addresses are listed in:

```
docs/registry/network-deployment-matrix.md
```

---

## 10. Expected Audit Deliverables

We request:

* Security findings (Critical → Informational)
* Clear reproduction steps
* Suggested mitigations (where applicable)
* Explicit classification of:

  * design decisions
  * non-issues
  * acceptable risks

---

## 11. Responsible Disclosure

Please **do not disclose findings publicly** before coordination.

Security contact details will be provided **privately** after engagement confirmation.

---

## 12. Final Notes to Auditors

TONBANKCARD prioritizes:

* correctness over convenience
* transparency over control
* immutability over flexibility

The protocol is intentionally minimal and strict.

> If a behavior appears “unfixable”, it is likely **by design**.
