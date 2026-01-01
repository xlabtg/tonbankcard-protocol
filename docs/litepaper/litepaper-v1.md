# TONBANKCARD

## Litepaper v1

**Non-Custodial Payment & Account Infrastructure on TON**

**Version:** v1.0
**Status:** Public
**Network:** TON
**Release:** 2025

---

## 1. Introduction

TONBANKCARD is a **non-custodial financial infrastructure protocol** built on The Open Network (TON).

The protocol introduces:

* NFT-based accounts
* trust-minimized payment settlement
* merchant payment orchestration
* collateral signaling for external lending
* governance without execution power

TONBANKCARD is **not a bank, not a payment processor, and not a custodian**.
It is an open protocol that enables payments and account abstraction **without intermediaries**.

---

## 2. The Problem

Modern digital payments suffer from structural issues:

* custodial risk
* opaque account ownership
* reversible settlements
* centralized control
* fragmented crypto integrations
* complex compliance layers

Even in crypto:

* wallets ≠ accounts
* merchants rely on centralized processors
* lending requires custody or trust

Users and merchants lack **sovereign, portable, verifiable accounts**.

---

## 3. The TONBANKCARD Solution

TONBANKCARD introduces a new primitive:

> **An account is an NFT.**

Each NFT represents:

* a unique account number
* a payment destination
* a settlement endpoint
* a collateral identity

Ownership of the NFT = ownership of the account.

No custody. No admins. No hidden controls.

---

## 4. Core Components

### 4.1 NFT Accounts (Cards)

* Each account is an NFT on TON
* NFT ownership defines account authority
* Accounts are transferable like any NFT
* Multiple account series are supported

NFT accounts act as:

* payment recipients
* payment senders
* merchant settlement endpoints

---

### 4.2 Payment Hub

The Payment Hub is the on-chain settlement layer.

It enables:

* payments between NFT accounts
* merchant payments
* internal transfers
* risk flags and account locks (signal-only)

All settlement happens:

* on-chain
* in TBC
* under immutable rules

---

### 4.3 TBC Token

TBC is the settlement token of the protocol.

It is used for:

* payments
* merchant settlement
* internal transfers

Liquidity is provided via:

* on-chain pools (e.g. TBC/TON)
* external conversion partners

TONBANKCARD does not control price or liquidity.

---

### 4.4 Merchant Payments

Merchants:

* receive payments directly to their NFT accounts
* never custody user funds
* verify payments on-chain

Integrations are available via:

* Merchant API
* Merchant SDK
* Read-only indexers

No chargebacks. No forced refunds.

---

### 4.5 External Payment Providers

TONBANKCARD integrates with external providers such as:

* ChangeNOW
* NOWPayments

These providers act as:

* on/off-ramps
* cross-chain converters

TONBANKCARD itself remains **chain-pure and non-custodial**.

---

### 4.6 Collateral Signaling & Lending

TONBANKCARD supports **collateral signaling**, not lending.

Users can:

* lock TON as a public on-chain signal
* expose collateral status via their NFT account

External lenders (e.g. CoinRabbit):

* read collateral signals
* make independent lending decisions

TONBANKCARD:

* does not issue loans
* does not liquidate
* does not custody collateral

---

## 5. Governance

### 5.1 Governance Asset

Governance is represented by **TBC Diamonds**:

* 222 fixed-supply NFTs
* no minting
* no burning
* no special privileges

---

### 5.2 Governance Model

Governance is:

* non-executive
* non-custodial
* non-binding

Governance holders can:

* submit proposals
* vote
* express consensus

They cannot:

* upgrade contracts
* move funds
* pause the protocol

> **Code is law. Governance is commentary.**

---

## 6. Security & Immutability

TONBANKCARD is designed around:

* immutable contracts
* explicit invariants
* no admin keys
* no upgradeable proxies

Security measures include:

* formal invariants
* threat modeling
* audit readiness documentation
* frozen deployments

The blockchain is the **single source of truth**.

---

## 7. Transparency

TONBANKCARD provides:

* Public Protocol Registry
* Network Deployment Matrix
* Governance records
* Read-only indexers

All critical information is:

* public
* verifiable
* reproducible

---

## 8. What TONBANKCARD Is Not

TONBANKCARD is not:

* a bank
* a payment processor
* a custodian
* a lender
* a yield protocol

It provides infrastructure, not financial guarantees.

---

## 9. Who Is TONBANKCARD For?

* merchants accepting crypto payments
* Telegram-native businesses
* DeFi protocols needing account abstraction
* users seeking sovereign accounts
* developers building on TON

---

## 10. Final Statement

TONBANKCARD is built on a simple principle:

> **Users should own their accounts.
> Protocols should not own users.**

TONBANKCARD replaces trust with transparency,
and custody with cryptography.

---

### Status

✅ Live on TON
✅ Non-custodial
✅ Immutable
✅ Governed without control
✅ Open for integration
