# TONBANKCARD

## Whitepaper v1 — Final Technical Specification

**Version:** v1.0
**Status:** Final / Frozen
**Network:** TON
**Document type:** Technical protocol specification
**Canonical source:** GitHub repository
**Applies to:** All deployments listed in Network Deployment Matrix

---

## 1. Abstract

TONBANKCARD is a **non-custodial financial infrastructure protocol** built on The Open Network (TON).

The protocol provides:

* NFT-based account abstraction
* on-chain payment settlement
* merchant payment orchestration
* collateral signaling for external lending
* non-executable governance

TONBANKCARD intentionally avoids custody, admin control, and upgrade authority.
All critical logic is immutable and governed by explicit invariants.

---

## 2. Design Principles

TONBANKCARD is built on the following principles:

1. **User Sovereignty**
   Users control assets directly via on-chain ownership.

2. **Non-Custodial by Design**
   The protocol never takes custody of funds.

3. **Immutability First**
   No upgradeable proxies, no admin keys.

4. **Explicit Invariants**
   All state transitions are constrained by formal rules.

5. **Transparency Over Control**
   Governance exists without execution power.

---

## 3. System Overview

### 3.1 High-Level Architecture

TONBANKCARD consists of:

* NFT Account Layer
* Settlement Layer (Payment Hub)
* Token Layer (TBC)
* Merchant Integration Layer
* Collateral Signaling Layer
* Governance & Documentation Layer

Each layer is isolated by **explicit trust boundaries**.

---

## 4. NFT-Based Account Abstraction

### 4.1 Account Model

An account is represented by an NFT.

Properties:

* Unique identifier (account number)
* Ownership = authority
* Transferable
* On-chain verifiable

No off-chain identity is required.

---

### 4.2 Account Resolver

The NFT Account Resolver maps:

* NFT ownership → account authority
* NFT metadata → account properties

Resolver logic is deterministic and immutable.

---

## 5. Payment Hub (Core Settlement)

### 5.1 Settlement Model

The Payment Hub:

* settles payments between NFT accounts
* enforces invariant-based state transitions
* operates exclusively in TBC

No balances are held off-chain.

---

### 5.2 Internal Transfers

* NFT → NFT transfers
* fully on-chain
* atomic
* final

No reversibility is supported at protocol level.

---

### 5.3 Merchant Payments

Merchant payments are:

* initiated by users
* settled directly to merchant NFT accounts
* verifiable on-chain

The protocol does not intermediate funds.

---

## 6. Risk Flags & Account Locks

Account locks and risk flags:

* are **signal-only**
* do not seize funds
* do not transfer assets

They exist to:

* expose risk state
* support external decision-making

---

## 7. Token Layer (TBC)

TBC is the settlement token.

Properties:

* used for payments
* used for merchant settlement
* freely transferable

Liquidity is external to the protocol.

---

## 8. External Payment Providers

External providers (e.g. ChangeNOW, NOWPayments):

* operate outside protocol trust boundary
* provide conversion and routing
* never gain protocol authority

All integrations are optional.

---

## 9. Collateral Signaling & Lending

### 9.1 Collateral Signals

Users may lock TON to emit a public signal.

Properties:

* non-custodial
* non-liquidating
* read-only

---

### 9.2 Lending Adapters

External lenders:

* read collateral signals
* make independent decisions
* bear full risk

TONBANKCARD does not issue loans.

---

## 10. Governance

### 10.1 Governance Asset

Governance is represented by:

* TBC Diamonds NFT
* fixed supply (222)

---

### 10.2 Governance Model

Governance is:

* non-executive
* non-binding
* informational

No governance action can affect protocol execution.

---

## 11. Security Model

### 11.1 Threat Model

Threats considered:

* malicious users
* malicious integrators
* indexer manipulation
* UI deception

Mitigations:

* on-chain verification
* immutability
* invariant enforcement

---

### 11.2 Audit Readiness

* Formal invariants documented
* Deployment freeze defined
* Scope explicitly enumerated

---

## 12. Protocol Versioning & Deployment

* Each version is immutable
* Deployments are append-only
* No retroactive changes

See:

* Network Deployment Matrix
* Public Protocol Registry

---

## 13. Transparency & Verification

All protocol-critical data is:

* public
* verifiable
* reproducible

No trust in off-chain services is required.

---

## 14. Explicit Non-Goals

TONBANKCARD does NOT provide:

* custody
* lending
* yield
* reversibility
* admin control

---

## 15. Conclusion

TONBANKCARD replaces:

* trust with verification
* custody with ownership
* intermediaries with invariants

The protocol is complete, immutable, and transparent.

> **If something is not verifiable on-chain, it is not part of the protocol.**
