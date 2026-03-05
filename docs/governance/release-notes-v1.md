# TONBANKCARD Governance — Release Notes v1

**Version:** Governance v1
**Status:** Frozen
**Release date:** 2025-01
**Applies to:** TONBANKCARD Protocol (Mainnet & Testnet)

---

## 1. Purpose of Governance v1

Governance v1 defines the **non-executive, non-custodial governance layer** of the TONBANKCARD protocol.

Its sole purpose is to:

* provide **collective signaling**
* define **social consensus**
* publish **non-binding protocol intentions**
* ensure **transparency and accountability**

Governance v1 **does not** introduce any form of:

* protocol control
* fund control
* contract upgrade authority
* emergency powers

---

## 2. Governance Asset: TBC Diamonds

Governance participation is represented by a fixed NFT collection:

**Asset:** TBC Diamonds
**Standard:** TON NFT
**Total supply:** 222 (fixed, immutable)
**Contract:**
`EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU`

### Properties

* NFTs are freely transferable
* No minting after initial deployment
* No burn functionality
* No privilege escalation based on metadata

Ownership of a TBC Diamond represents **voting and proposal rights only**.

---

## 3. Governance Powers (Explicitly Limited)

Governance v1 holders **CAN**:

* submit proposals
* vote on proposals
* publish recommendations
* express social consensus
* request audits or reviews
* signal protocol direction

Governance v1 holders **CANNOT**:

* execute transactions
* modify smart contracts
* pause or freeze the protocol
* control funds
* override protocol invariants
* force upgrades or migrations

All governance actions are **non-executable by design**.

---

## 4. Proposal Registry

All proposals are recorded in a **public, append-only registry**.

Each proposal includes:

* unique proposal ID
* author (NFT holder)
* timestamp
* proposal category
* immutable proposal text
* voting period
* final outcome (Approved / Rejected / Expired)

Proposals are informational artifacts and do not trigger on-chain execution.

---

## 5. Voting Mechanism

* Voting weight: **1 NFT = 1 vote**
* No delegation in v1
* No quorum enforcement in v1
* No vote escrow or locking
* No snapshot manipulation

Votes are:

* publicly verifiable
* immutable once submitted
* non-binding

---

## 6. Transparency Guarantees

Governance v1 guarantees:

* public visibility of all proposals
* public visibility of all votes
* immutable historical record
* no off-chain vote counting authority

All governance data is:

* indexable
* verifiable on-chain
* reproducible by third parties

---

## 7. Relationship to Protocol Core

Governance v1:

* has **no authority** over Payment Hub
* has **no authority** over NFT accounts
* has **no authority** over collateral signaling
* has **no authority** over merchant settlement

The TONBANKCARD protocol remains:

* non-custodial
* immutable
* invariant-driven
* user-controlled

Governance exists **outside** the trust boundary of core protocol logic.

---

## 8. Upgrade Policy

Governance v1 is **frozen**.

Any future governance changes (v2+) require:

* a new governance specification
* a new release note
* explicit acknowledgment that Governance v1 has no execution power

No implicit governance upgrades are permitted.

---

## 9. Risk Disclosure

Governance v1 intentionally avoids:

* capture resistance mechanisms
* emergency controls
* reactive powers

This is a **design choice**, not a limitation.

TONBANKCARD prioritizes:

* protocol immutability
* user sovereignty
* predictable behavior

over governance-driven intervention.

---

## 10. Security Framework Cross-Reference

Governance v1 is explicitly **outside** the security trust boundary of the core protocol.

The formal security architecture is defined independently of governance. Governance decisions cannot alter the security model.

| Security Document | Purpose | Reference |
|-------------------|---------|-----------|
| **Formal Threat Model** | Adversary model, attack surface, trust boundaries | [docs/security/THREAT_MODEL.md](../security/THREAT_MODEL.md) |
| **Key Management Framework** | Operational security, key rotation, compromise response | [docs/security/KEY_MANAGEMENT.md](../security/KEY_MANAGEMENT.md) |

All protocol invariants defined in the security framework remain **unchanged and unenforceable by governance**.

> Governance coordinates people. Security is enforced by code.

---

## 11. Final Statement

TONBANKCARD Governance v1 is a **coordination layer, not a control layer**.

It exists to:

* document intent
* align stakeholders
* preserve transparency

It does **not** replace:

* code
* cryptography
* invariants
* user control

> **Code is law. Governance is commentary.**

---

### Governance v1 Status

✅ Defined
✅ Documented
✅ Frozen
✅ Non-executable
✅ Audit-friendly
