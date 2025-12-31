# TONBANKCARD

## Protocol v1.0 — Overall Release Notes

**Protocol version:** v1.0
**Status:** FINAL / FROZEN
**Network:** TON
**Release date:** 2025
**Applies to:** All deployments listed in the Network Deployment Matrix

---

## 1. Release Overview

TONBANKCARD v1.0 is the **first finalized release** of the TONBANKCARD protocol.

This release delivers a **complete, non-custodial financial infrastructure stack** built on TON, including:

* NFT-based account abstraction
* On-chain payment settlement
* Merchant payment orchestration
* Collateral signaling for external lending
* Non-executable governance
* Full transparency and audit readiness

All core components are **immutable, documented, and frozen**.

---

## 2. Scope of v1.0

Protocol v1.0 includes the following finalized layers:

### ✅ Account Layer

* NFT-based accounts (multiple series)
* NFT ownership as sole authority
* Deterministic account resolution

### ✅ Settlement Layer

* Payment Hub (TBC settlement)
* Internal NFT-to-NFT transfers
* Merchant payment settlement
* Explicit invariant enforcement

### ✅ Risk & Signaling Layer

* Account locks & risk flags (signal-only)
* TON-based collateral signaling
* Public collateral status lookup

### ✅ Integration Layer

* Merchant API
* Merchant SDK
* Read-only payment status indexer
* External payment provider adapters (ChangeNOW, NOWPayments)

### ✅ Governance Layer

* Governance NFTs (TBC Diamonds, 222 supply)
* Proposal registry
* Voting records
* Non-executable governance model

### ✅ Transparency & Lifecycle

* Public Protocol Registry
* Network Deployment Matrix
* Protocol versioning & deployment policy
* Audit readiness documentation

---

## 3. What Is New in v1.0

Protocol v1.0 introduces, for the first time:

* NFT-based financial accounts on TON
* Fully non-custodial merchant payments
* Immutable payment settlement rules
* Governance without execution power
* Collateral signaling without custody or liquidation
* Explicit trust boundary documentation

This is a **foundational release**, not an incremental upgrade.

---

## 4. What v1.0 Does NOT Include

TONBANKCARD v1.0 intentionally excludes:

* custodial services
* upgradeable contracts
* admin or emergency keys
* protocol-level lending
* forced liquidations
* reversible payments
* yield or incentive mechanisms

These exclusions are **by design**, not by limitation.

---

## 5. Backward Compatibility

As the initial release:

* v1.0 defines the baseline
* no backward compatibility guarantees apply retroactively
* all future versions must remain compatible with v1.0 deployments

No breaking changes to v1.0 are permitted.

---

## 6. Security & Audit Status

For v1.0:

* Formal invariants are defined
* Threat model is documented
* Audit scope is enumerated
* Deployments are frozen
* No privileged roles exist

The protocol is **audit-ready**.

---

## 7. Governance Status

Governance v1.0 is:

* active
* non-executive
* non-binding
* immutable

Governance cannot:

* modify contracts
* control funds
* pause the protocol

---

## 8. Deployment Status

All deployments for v1.0 are:

* recorded in the Network Deployment Matrix
* publicly verifiable on-chain
* immutable once frozen

Testnet and Mainnet deployments are explicitly separated.

---

## 9. Documentation Set

The following documents define TONBANKCARD v1.0:

* Litepaper v1 (Public)
* Whitepaper v1 (Final Technical)
* Governance Release Notes v1
* Protocol v1.0 Overall Release Notes
* Public Protocol Registry
* Network Deployment Matrix
* Audit Readiness Checklist

Together, these documents form the **canonical protocol specification**.

---

## 10. Upgrade Policy

TONBANKCARD v1.0 is **final**.

Any future changes require:

* a new protocol version (v2+)
* new deployments
* new documentation
* explicit version separation

No implicit upgrades are allowed.

---

## 11. Known Limitations

* No protocol-level refunds
* No dispute resolution
* No SLA guarantees
* No price or liquidity guarantees
* No governance execution

These limitations are transparent and permanent for v1.0.

---

## 12. Final Statement

TONBANKCARD v1.0 represents a **complete, immutable, non-custodial financial protocol**.

It is designed to be:

* simple
* verifiable
* trust-minimized
* resistant to control

> **TONBANKCARD v1.0 is finished by design, not by abandonment.**

---

### Release Status

✅ Implemented
✅ Documented
✅ Frozen
✅ Audit-ready
✅ Open for ecosystem integration
