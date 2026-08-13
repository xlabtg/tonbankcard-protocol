# Risk Authority — Governance Structure & FRAUD_LOCK Operating Procedure

**Engagement:** [E3 — Risk Authority Decentralization](https://github.com/xlabtg/tonbankcard-protocol/issues/134)
**Companion documents:**
- [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) — user-facing appeal procedure
- [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 — protocol parameter inventory and single-key elimination policy
- [`../security/KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §§ 4, 5, 7 — Risk Authority key class and rotation
- [`../security/THREAT_MODEL.md`](../security/THREAT_MODEL.md) §§ 7, 8 — T4 (admin abuse), T8 (admin key compromise)
- [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) — incident playbook (Risk Authority key compromise)

**Status:** Proposed — to be ratified by the Risk Authority activation proposal (`E3-PROP-001`) alongside the multi-sig deployment ceremony described in §6.
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** Governance is **non-executable** by design — see [`docs/dao-governance.md`](../dao-governance.md). The Risk Authority is the **only** off-chain actor whose signature is allowed to mutate the on-chain `risk_authority` field of `contracts/payments/account-locks.fc`. Its authority is **scoped exclusively** to setting and clearing the `FRAUD_LOCK` flag on individual NFT accounts (operations `op::set_fraud_lock = 0x1001` and `op::clear_fraud_lock = 0x1002`). It has no power to move funds, change balances, alter ownership, set or clear `COLLATERAL_LOCK`, or modify any other protocol state — these are protected by **INVARIANT I3** (No Admin Fund Control) and **INVARIANT I6** (Lock ≠ Confiscation), as enforced by the contract and verified by the audit `A1-core-contracts/REPORT.md`.

---

## Table of Contents

1. [Purpose & scope](#1-purpose--scope)
2. [Who constitutes the Risk Authority](#2-who-constitutes-the-risk-authority)
3. [Fraud detection criteria](#3-fraud-detection-criteria)
4. [Lock procedure (set FRAUD_LOCK)](#4-lock-procedure-set-fraud_lock)
5. [Unlock procedure (clear FRAUD_LOCK)](#5-unlock-procedure-clear-fraud_lock)
6. [Multi-sig deployment & migration plan](#6-multi-sig-deployment--migration-plan)
7. [TransparencyRegistry logging](#7-transparencyregistry-logging)
8. [Long-term plan — DAO-elected Risk Committee](#8-long-term-plan--dao-elected-risk-committee)
9. [Acceptance criteria mapping](#9-acceptance-criteria-mapping)
10. [References](#10-references)

---

## 1. Purpose & scope

The `FRAUD_LOCK` is a non-custodial signaling primitive: it sets a single bit on an NFT account that disables outgoing TBC transfers from that account while leaving balance, ownership and receive capability intact (`contracts/payments/account-locks.fc`, lines 130–145 and lines 209–224). Because this bit is set by a privileged role (`risk_authority`), the role itself is an attack surface: a compromised key can lock arbitrary accounts and create a denial-of-service condition. [`THREAT_MODEL.md`](../security/THREAT_MODEL.md) catalogues this exposure as **T8 (Risk Authority key compromise)** and as part of the **T4 (admin abuse)** family.

E3 retires the single-key model. The Risk Authority becomes a **3-of-5 hardware-backed multi-sig** with a documented signer roster, an explicit fraud-detection rubric, a fixed maximum lock duration before automatic appeal review, and a public audit trail in `TransparencyRegistry`. The setter call path in `account-locks.fc` does **not** change — the contract continues to accept `op::set_fraud_lock` from whichever address is stored in the `risk_authority` state slot, and the existing two-phase `op::propose_risk_authority` / `op::execute_risk_authority` flow with its 7-day timelock is the migration vehicle (Issue #96, lines 36–44 of `account-locks.fc`). What changes is **who that address belongs to**: starting at the E3 activation, the on-chain `risk_authority` address resolves to a multi-sig wallet contract whose signature policy enforces the 3-of-5 requirement before any setter message is broadcast.

The Risk Authority does **not**:

- move TBC or any other token (forbidden by INVARIANT I3 and the absence of a transfer opcode in `account-locks.fc`),
- modify account balances or ownership (no such opcode exists; INVARIANT I6 forbids it),
- set or clear `COLLATERAL_LOCK` (that is the Lending Adapter's role; opcodes `0x1003` / `0x1004` gate on `lending_adapter`, not `risk_authority`),
- pause the protocol or call `op::set_paused` (that is the PaymentHub admin multi-sig, a separate signer set — see [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §7.2),
- mint, burn, or transfer TBC Diamonds NFTs.

This single-purpose scope is itself a security invariant: any expansion of Risk Authority capabilities requires a governance proposal of category `ROADMAP_SIGNAL` plus the redeployment ceremony in [`PARAMETERS.md`](./PARAMETERS.md) §10, because the role boundaries are encoded in `account-locks.fc` as `equal_slice_bits(sender_address, risk_authority)` guards (lines 212, 229).

---

## 2. Who constitutes the Risk Authority

### 2.1 Composition — 3-of-5 multi-sig

The Risk Authority is a single TON multi-sig wallet whose threshold is **3-of-5**. Five signers each hold one hardware-backed key. **No single signer can lock an account.** Any setter transaction requires at least three independent signatures.

| Seat | Role (not identity) | Selection | Term | Constraints |
|------|---------------------|-----------|------|-------------|
| RA-1 | **Protocol Team Lead** | Designated by the core engineering team | Indefinite (replaceable by Diamond DAO vote) | Must be a full-time core engineer; cannot also hold an Admin Key (PaymentHub) seat |
| RA-2 | **Protocol Security Officer** | Designated by the core security team | Indefinite (replaceable by Diamond DAO vote) | Must hold a hardware wallet on a cold air-gapped machine per [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §3 |
| RA-3 | **Community Representative** | Elected by Diamond holders for a 6-month term | 6 months, renewable once | Must hold ≥ 1 TBC Diamond at election; must not be employed by the core team |
| RA-4 | **External Auditor** | Designated by the core team from the firm that delivered the most recent A1 audit | 12 months, non-renewable for the same firm two cycles in a row | Must be an independent reviewer; cannot also vote in any governance proposal cycle that touches PP-13/PP-17 |
| RA-5 | **Independent Adjudicator** | Diamond DAO vote (category `RISK_DISCLOSURE`) | 12 months, renewable once | Must not hold any other operational role in the protocol (no Admin Key, no Lending Adapter, no Deployment Key) |

The composition is recorded **by role only** in this document. The mapping from role to public key (and, where required by jurisdiction, to legal identity) is maintained off-chain in the encrypted operations registry `ops/registry/risk-authority-signers.gpg` and published, redacted, to the quarterly transparency report (§7).

### 2.2 Hard requirements on signers

These rules satisfy [§7 of the engagement](https://github.com/xlabtg/tonbankcard-protocol/issues/134) ("Security Requirements") and tie directly into [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md):

1. **Hardware-backed keys (no exceptions).** Every signer's key resides on a Ledger or Trezor device dedicated to this role. Software wallets, cloud-stored keys and shared HSM partitions are prohibited (mirrors [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §3.1, row "On-chain authority keys").
2. **No double-mandate.** No individual may simultaneously hold more than one Risk Authority seat (RA-1 … RA-5). This rule also forbids a Risk Authority signer from concurrently holding the Admin Key (PaymentHub) seat, the Lending Adapter key or the Deployment Key (mirrors [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §4.3 "Strict Separation Rules").
3. **Geographic separation.** Signers must be distributed across at least three distinct legal jurisdictions and physical locations. No single subpoena, raid, or natural disaster may reach more than two of five keys.
4. **Active duty attestation.** Every signer must re-attest their ability to sign within 72 h once per quarter via a signed message anchored to a public block height. Two consecutive missed attestations trigger replacement under §2.4.
5. **No undisclosed conflicts of interest.** Signers must disclose, in the encrypted registry, every TBC-related commercial position they hold. Material undisclosed conflicts disqualify them retroactively and invalidate any FRAUD_LOCK actions they signed (the locks themselves remain in force pending appeal, but become reviewable on a fast-track under [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §4).

### 2.3 Disallowed signer profiles

- **A founder or full-time employee who already holds an Admin Key seat.** This collapses the separation-of-duties property required by INVARIANT I3.
- **A counterparty to a TBC merchant agreement.** Creates structural conflict of interest with PP-13 whitelisting decisions.
- **An anonymous signer with no off-chain accountability path.** The role exists to allow recourse; anonymity defeats that.
- **An automated agent (any LLM, any backend service, any CI key).** All signatures must originate from a hardware wallet operated by a human.

### 2.4 Replacement & rotation

Replacement of any Risk Authority signer follows the two-phase `op::propose_risk_authority` / `op::execute_risk_authority` flow already implemented in `account-locks.fc` lines 293–322 (Issue #96, 7-day timelock). Because the on-chain `risk_authority` is itself a multi-sig wallet **contract**, rotation has two distinct surfaces:

| Surface | Mechanism | Cooldown |
|---------|-----------|----------|
| **Single signer rotation** (e.g. RA-3 term ends) | The multi-sig wallet internal signer-set update — 3-of-5 signature of remaining signers; the on-chain `risk_authority` address does **not** change | 7 days from announcement to execution; ratification post-fact via TransparencyRegistry within 24 h |
| **Whole multi-sig replacement** (catastrophic compromise) | `op::propose_risk_authority` from the **current** multi-sig → 7-day timelock → `op::execute_risk_authority` from the **new** multi-sig | 7 days (contract-enforced via `ROLE_TRANSFER_DELAY = 7 * 24 * 60 * 60` on line 54) |
| **Emergency replacement** (key compromise, < 24 h) | The PaymentHub Admin multi-sig invokes the emergency role-transfer described in [`INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) §5.2; the 7-day timelock is **not bypassable** (contract enforces it), so the emergency path is "pause first, then transfer" — see §4.6 below | 0 h pause + 7 d transfer |

The rotation log lives at `docs/governance/risk-authority-rotation.log` (JSON Lines, append-only, written by the indexer that observes `op::propose_risk_authority` / `op::execute_risk_authority` events). Every rotation event must reference (i) the `proposal_id` of the Diamond DAO ratification proposal that approved the change, and (ii) the `tx_hash` of the on-chain execution.

---

## 3. Fraud detection criteria

The Risk Authority sets a `FRAUD_LOCK` **only** when the on-chain evidence satisfies at least one of the criteria below. Each criterion identifies the artifact a community member or auditor can reproduce, so that the lock decision is **auditable from the chain alone**.

### 3.1 Required on-chain evidence

| # | Criterion | Required artifact | Source of truth |
|---|-----------|-------------------|-----------------|
| FC-1 | **Court order or competent regulator notice** identifying the NFT account as the subject of an ongoing fraud / theft / sanctions investigation | Signed PDF, hash anchored on-chain via `TransparencyRegistry.RecordSnapshot` (snapshot_hash = `SHA-256(order_pdf)`) | Off-chain (court / regulator) + on-chain anchor |
| FC-2 | **Theft pattern on-chain**: ≥ 10 outbound transfers from an account holding ≥ 100 K TBC within ≤ 6 h to ≥ 10 distinct fresh accounts (no prior history) | Indexer query (`backend/indexer/fraud-cluster-detection.ts`) producing a Merkle root of the involved tx hashes | On-chain (indexer-derived; the query is open-source and reproducible) |
| FC-3 | **NFT collection compromise**: the NFT collection on which the account is registered has been flagged by ≥ 2 independent block-explorers (TONScan + GetGems) as compromised within the previous 24 h | Two independent screenshots + the explorer JSON manifest hashes | Off-chain (explorers) + on-chain anchor via `TransparencyRegistry.RecordSnapshot` |
| FC-4 | **Sanctions list match**: the account's beneficial owner appears on the latest UN / OFAC / EU sanctions list and the match was verified by RA-4 (External Auditor) | KYC matching report (encrypted, hash anchored on-chain), independent dual-control review log | Off-chain regulator lists + on-chain anchor |
| FC-5 | **Self-reported by NFT owner** (account compromise reported by the rightful holder) | Signed message from the NFT owner's prior key + the holder's recovery key (BIP-39 backup), submitted via `https://tonbankcard.com/report` | Off-chain reporting flow + on-chain anchor of the report hash |

> A criterion is satisfied if **and only if** the evidence is recorded in `docs/governance/fraud-lock-evidence/<incident-id>/` (encrypted artefacts and a public summary) **and** the SHA-256 of the evidence bundle is anchored on-chain via `TransparencyRegistry.RecordSnapshot` **before** the multi-sig signs the setter.

### 3.2 Disallowed grounds (never sufficient for FRAUD_LOCK)

The Risk Authority is **prohibited** from setting a FRAUD_LOCK on the basis of any of the following:

- Unverified social media accusations or reputation reports without on-chain evidence under FC-1…FC-5.
- Government requests outside the jurisdictions where the protocol operates and that do not satisfy FC-1.
- Commercial disputes between TBC merchants (out-of-scope; handled via the standard contractual route).
- "Politically exposed person" risk scoring in isolation (no automatic FRAUD_LOCK for PEP status).
- A single signer's discretionary call, however senior (this is the cardinal rule; the 3-of-5 requirement makes unilateral action contract-impossible).

Setting a lock on a disallowed ground is itself an incident under [`INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) §3 and triggers the **fast-track appeal** procedure in [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §4.

### 3.3 Due process before locking

For every FRAUD_LOCK proposal that is **not** based on FC-1 (judicial order) or FC-4 (sanctions match), the Risk Authority must observe the following due-process steps **before** broadcasting the setter transaction:

1. **Notification window — 24 h.** Attempt to notify the NFT account holder via the wallet UI in-app notification system and the holder's registered contact (if any). The 24-h window is reduced to **0 h** for FC-1 and FC-4 grounds, and to **1 h** for FC-2 patterns where active theft is in progress (the evidence bundle must explicitly justify the reduction).
2. **Internal dual review.** RA-2 (Security Officer) and RA-4 (External Auditor) must independently sign the evidence bundle. Their attestations are part of the 3-of-5 signature set; this prevents a quorum of three operational signers (RA-1, RA-3, RA-5) from acting without security or audit review.
3. **Evidence anchor.** The `SHA-256(evidence_bundle)` is anchored on-chain via `TransparencyRegistry.RecordSnapshot` **before** the lock setter is broadcast. Without this anchor the indexer alarms (see §7.3) and the lock decision becomes appealable on the fast-track.

### 3.4 Maximum lock duration & mandatory review

A FRAUD_LOCK set under any of FC-1…FC-5 is bounded by the following maximum durations. Beyond these durations, the lock must either be **cleared** or **renewed** by a fresh 3-of-5 multi-sig vote backed by a new evidence bundle.

| Criterion | Maximum duration before mandatory review | Renewable? |
|-----------|------------------------------------------|------------|
| FC-1 (judicial order) | Duration explicit in the order (or 12 months if unspecified) | Renewable only with an updated order |
| FC-2 (theft pattern) | 30 days | Renewable once, then must be either confirmed by FC-1 / FC-4 or cleared |
| FC-3 (collection compromise) | 14 days | Renewable once; further renewals require a Diamond DAO `RISK_DISCLOSURE` proposal |
| FC-4 (sanctions match) | Duration explicit in the applicable sanctions list publication | Renewable per list updates |
| FC-5 (self-reported compromise) | 30 days, but the holder may request immediate clearance after providing a fresh recovery proof | Renewable on request |

The default ceiling — "FRAUD_LOCK is never indefinite without an FC-1 court order" — is itself a non-functional requirement of E3 ("Lock appeal decisions must be reachable within 7 business days"; the 14- and 30-day caps give the holder a structural deadline to escalate via the appeal route in [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §3).

---

## 4. Lock procedure (set FRAUD_LOCK)

### 4.1 Lifecycle

```
T0  evidence collection                  (Risk Authority internal)
T0  notification window opens            (24h / 1h / 0h per §3.3)
T1  internal dual review                 (RA-2 + RA-4 signatures)
T1  evidence anchor → TransparencyRegistry.RecordSnapshot
T2  multi-sig signer ceremony            (3-of-5 signatures collected)
T3  on-chain setter:                     op::set_fraud_lock to account-locks.fc
T3+ indexer mirror:                      RecordVotingResult (lock event mirrored)
T3+ public summary published             docs/governance/fraud-lock-evidence/<id>/summary.md
```

The `account-locks.fc` setter at lines 210–224 retains the Issue #96 / Issue #7 access-control semantics. The only difference at T3 is the `sender_address` of the message: it is the multi-sig wallet contract, not an EOA, and `equal_slice_bits(sender_address, risk_authority)` (line 212) succeeds because the on-chain `risk_authority` slice was set to the multi-sig wallet address at the E3 activation deploy (§6).

### 4.2 Required fields in the on-chain payload

The setter message body carries — in addition to the NFT address required by the existing handler — an **incident ID** that the indexer uses to cross-reference the evidence bundle. The current on-chain message layout (line 214: `slice nft_address = in_msg_body~load_msg_addr();`) is preserved; the incident ID is **embedded after** the NFT address as a 256-bit value:

```func
;; existing
slice nft_address = in_msg_body~load_msg_addr();
;; appended (backward-compatible: the handler ignores trailing bytes
;; if no upgrade has been applied to account-locks.fc).
int incident_id = in_msg_body~load_uint(256);
```

> **Backward compatibility note.** The current `op::set_fraud_lock` handler reads only the NFT address and ignores anything else in the message body. Adding the 256-bit incident ID is therefore safe with the **existing contract bytecode** — the indexer parses the trailing payload from the raw transaction trace, not from the contract state. A future redeployment may extend the handler to validate the incident ID against an on-chain registry; this is out-of-scope for E3 (see §9, AC-2 "if technically feasible").

### 4.3 Internal multi-sig ceremony

The 3-of-5 signing ceremony follows the same format as the PaymentHub Admin multi-sig ceremony described in [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md). For each FRAUD_LOCK action:

1. The proposer (any of RA-1…RA-5) drafts the lock packet: NFT address, incident ID, evidence bundle SHA-256, declared criterion (FC-x), justified duration, notification log.
2. The packet is distributed via the encrypted ops channel; signers download independently to their cold air-gapped machines.
3. Each signer verifies the SHA-256 of the evidence bundle against the on-chain `TransparencyRegistry.RecordSnapshot` anchored at T1; mismatch aborts the ceremony.
4. Each signer produces a hardware-wallet signature on the packet. Signatures are merged off-chain.
5. The merged 3-of-5 signature is submitted as the multi-sig wallet's outbound transaction whose payload is the `op::set_fraud_lock` call.

The ceremony log (participants, timestamps, evidence hashes) is appended to `docs/governance/fraud-lock-evidence/<incident-id>/ceremony.log` and the SHA-256 of that log is included in the next quarterly transparency report.

### 4.4 Notifications

Concurrently with T3, the wallet UI is notified via the standard `AccountLocked` event (line 167 of `account-locks.fc`, emit marker `0x4c6f636b` "Lock"). The wallet UI watches that event and surfaces an in-app notification ("This account has been flagged. See appeal procedure.") that deep-links to `https://tonbankcard.com/appeal/<incident-id>` (resolves to [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §2).

The holder may also receive an email / push notification if they have registered contact details under the optional KYC-lite flow. Holders who have **not** registered contact details are reached only via the in-app notification — by design, the protocol does not collect contact information unless the holder volunteers it.

### 4.5 Public summary

Within 24 h of T3, the Risk Authority publishes a public summary at `docs/governance/fraud-lock-evidence/<incident-id>/summary.md` containing:

- The NFT account address (no holder identity).
- The criterion FC-x cited.
- The declared maximum duration (per §3.4).
- The SHA-256 of the evidence bundle and a redacted abstract of the underlying evidence (court order docket number, sanctions list URL, indexer query identifier, etc.).
- The signers (by role, not identity).
- The next-review timestamp (T3 + duration cap from §3.4).

The summary is rendered into the public dashboard (E4 deliverable) and into the quarterly transparency report. Failure to publish the summary within 24 h is an incident.

### 4.6 Emergency path

If active theft is in progress and the 24-h notification window in §3.3 step 1 is incompatible with the threat (the FC-2 "≤ 1 h" reduction is granted), the procedure compresses to:

```
T0  evidence collection + anchor         (≤ 30 min)
T0  internal dual review                 (≤ 15 min, parallelised)
T0  multi-sig signer ceremony            (≤ 15 min, ceremony.log marked URGENT)
T1  on-chain setter                      (within 60 min of T0)
T1  public summary                       (within 60 min of T1; expanded summary within 6 h)
```

The emergency path **does not bypass** the 3-of-5 multi-sig requirement and **does not bypass** the evidence-anchor step. It only compresses notification and dual-review windows, both of which are auditable from the ceremony log. The maximum lock duration for an emergency-path action is **48 h** unless renewed under the standard procedure (§3.4); a 48-h emergency lock that is not renewed is automatically scheduled for clearance.

There is **no** path by which a single Risk Authority signer, a quorum of two signers, or any non-Risk-Authority key can set FRAUD_LOCK. The contract guard `equal_slice_bits(sender_address, risk_authority)` (line 212) reduces this to "the on-chain multi-sig wallet emitted the call", and the wallet contract enforces 3-of-5.

---

## 5. Unlock procedure (clear FRAUD_LOCK)

`op::clear_fraud_lock` (opcode `0x1002`, lines 227–241 of `account-locks.fc`) is gated by the same `equal_slice_bits(sender_address, risk_authority)` check as the set path. Clearing follows the same 3-of-5 multi-sig ceremony, with the following differences:

1. **No evidence anchor is required** to clear a lock — clearing is always considered a safe direction.
2. **Triggers:** a successful appeal (per [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) §3), the expiration of the maximum duration in §3.4, the court order that originally produced FC-1 being vacated, or a holder-provided recovery proof under FC-5.
3. **Public summary:** within 24 h, the Risk Authority publishes a clearance summary referencing the original `<incident-id>` and the trigger reason at `docs/governance/fraud-lock-evidence/<incident-id>/clearance.md`.

Clearance is mirrored by the standard `AccountUnlocked` event (line 182, marker `0x556e6c6b` "Unlk"). The wallet UI updates the holder's account state automatically.

---

## 6. Multi-sig deployment & migration plan

### 6.1 Pre-activation state

At protocol launch (B2 mainnet) the on-chain `risk_authority` slice is set to a single hardware-backed EOA controlled by the core team — see [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §2.1, row "Risk Authority Key (Current Setup): Single key — HIGH RISK". This is acknowledged as a temporary state.

### 6.2 Multi-sig wallet deployment

E3 ratifies the deployment of a dedicated TON multi-sig wallet contract whose configuration matches §2 of this document:

- **Wallet type:** [`org.ton.contracts.multisig.v2`](https://github.com/ton-blockchain/multisig-contract-v2) (audit-grade, widely deployed reference implementation).
- **Threshold:** 3-of-5.
- **Signers:** five hardware-wallet public keys, one per RA-1…RA-5.
- **Signer-set updates:** require the same 3-of-5 signature inside the wallet.
- **No proposal-execution timelock at the wallet layer** (the contract-level role-transfer timelock of 7 days is the relevant cooling period; adding a second timelock would double-count delays and lengthen incident response without measurable benefit).

The wallet deployment is recorded in `docs/deployments/B2-mainnet/multisig.risk-authority.json` with the same schema used for the PaymentHub admin multi-sig. Its address is published before E3 activation.

### 6.3 On-chain role transfer (Issue #96 two-phase flow)

The transition from the single-key Risk Authority to the multi-sig wallet uses the existing handlers in `account-locks.fc`:

| Phase | Caller | Operation | Effect |
|-------|--------|-----------|--------|
| 1 | Single-key Risk Authority (current `risk_authority`) | `op::propose_risk_authority = 0x4001` with the multi-sig wallet address | Sets `pending_risk = multisig_wallet_address`, `pending_risk_at = now() + 7d` (lines 293–301) |
| 2 (≥ 7 days later) | Multi-sig wallet (the proposed authority) | `op::execute_risk_authority = 0x4002` | Sets `risk_authority = multisig_wallet_address`, `pending_risk_present = 0` (lines 304–312) |

Between Phase 1 and Phase 2, anyone can call `op::cancel_risk_authority` from the current single-key authority to abort the transfer (lines 315–322). After Phase 2 the single key is no longer authorised; the next role transfer can only originate from the multi-sig wallet.

### 6.4 Activation proposal `E3-PROP-001`

E3 activation is conditioned on the Diamond DAO ratifying the multi-sig wallet address and the signer roster (by role) via proposal `E3-PROP-001`. The proposal text lives in [`E3-activation/ACTIVATION_PROPOSAL.md`](./E3-activation/ACTIVATION_PROPOSAL.md) (to be added in the activation PR) and follows the template in [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md). It references:

- the multi-sig wallet deployment manifest (`multisig.risk-authority.json`),
- this document (`RISK_AUTHORITY.md`),
- the appeal procedure ([`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md)),
- the `KEY_MANAGEMENT.md` updates for key rotation,
- the on-chain Phase 1 transaction that opens the 7-day window.

`E3-PROP-001` is `RISK_DISCLOSURE` (category 3), recommended quorum **44** (supermajority, mirrors §9 of [`PARAMETERS.md`](./PARAMETERS.md) for lock-impacting changes), 48 h off-chain cooldown, and is voted before Phase 2 of §6.3.

### 6.5 Rollback contingency

If, during the 7-day timelock, the Diamond DAO ratification fails (`E3-PROP-001` finalises as `REJECTED` or `NO_QUORUM`), the single-key Risk Authority calls `op::cancel_risk_authority` and the on-chain state is unchanged. The next attempt requires a fresh `op::propose_risk_authority` and a fresh ratification proposal.

If the multi-sig wallet is itself catastrophically compromised after Phase 2 (e.g. three signer keys leaked simultaneously), the recovery path is described in [`INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) §5.2. It requires either (i) a Diamond DAO emergency `RISK_DISCLOSURE` proposal to authorise a contract redeployment with a fresh `risk_authority` (because the on-chain timelock cannot be skipped), or (ii) the PaymentHub Admin multi-sig issuing a protocol-wide `op::set_paused` to suspend all transfers while the timelock runs.

---

## 7. TransparencyRegistry logging

E3 requires that "All FRAUD_LOCK events [be] published via `TransparencyRegistry`" (engagement §3.4). The on-chain mirroring path is:

```
account-locks.fc                        TransparencyRegistry.tact
  emit_account_locked   →  indexer  →  RecordSnapshot { snapshot_hash = SHA-256(event_bundle) }
  emit_account_unlocked →  indexer  →  RecordSnapshot { snapshot_hash = SHA-256(event_bundle) }
```

### 7.1 Event schema

Every FRAUD_LOCK / unlock event yields an indexed record with the following fields (the indexer recomputes `event_bundle` deterministically so any community member can verify the chain trace):

| Field | Source | Type |
|-------|--------|------|
| `incident_id` | Setter message body (`uint256` appended after the NFT address, §4.2) | uint256 |
| `nft_address` | Setter message body | TON address |
| `lock_type` | Event marker (`0x4c6f636b` "Lock" / `0x556e6c6b` "Unlk") + `lock_type` byte | uint8 |
| `criterion` | Linked from the public summary at T3 + 24 h | enum FC-1…FC-5 |
| `evidence_sha256` | `TransparencyRegistry.RecordSnapshot.snapshot_hash` at T1 | uint256 |
| `signers_roles` | From the ceremony log (roles only, not identities) | array of {RA-1…RA-5} |
| `set_at` / `cleared_at` | `now()` at the setter / clearer transaction | uint32 |
| `max_duration_seconds` | §3.4 cap | uint32 |

### 7.2 Aggregate counters

The indexer maintains the following running counters (all derivable from the chain trace; the wallet UI surfaces them in the protocol-health card):

- `fraud_lock_set_count_30d` — number of FRAUD_LOCKs set in the last 30 days.
- `fraud_lock_cleared_count_30d` — number cleared in the last 30 days.
- `fraud_lock_active` — current number of accounts with FRAUD_LOCK = 1.
- `fraud_lock_appeals_filed_30d` — number of appeals received via [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md).
- `fraud_lock_appeals_upheld_30d` / `fraud_lock_appeals_overturned_30d` — breakdown of appeal outcomes.

These counters are the inputs to the quarterly transparency report (§7.4) and to the public dashboard (E4 deliverable).

### 7.3 Indexer alarms

The indexer emits a CI alarm if it observes any of the following:

| Alarm | Trigger | Severity |
|-------|---------|----------|
| `ra.lock-without-anchor` | `op::set_fraud_lock` transaction with no `RecordSnapshot` from the same wallet within the prior 1 h | HIGH — fast-track appeal |
| `ra.unknown-signer-set` | Wallet outbound transaction with a signer set that does not match the on-chain wallet config | CRITICAL — paged page-out |
| `ra.duration-cap-exceeded` | Lock active beyond §3.4 cap for the cited criterion | HIGH — review required within 24 h |
| `ra.summary-missing` | No `summary.md` for `<incident-id>` within 24 h of T3 | MEDIUM — incident under §6 of `INCIDENT_RESPONSE.md` |
| `ra.signer-attestation-missed` | Two consecutive missed quarterly attestations (§2.2 step 4) | MEDIUM — schedule replacement |

Alarms are published to the security ops channel and mirrored to the public dashboard with a 24 h delay (so that adversaries cannot use real-time alarm visibility to time attacks).

### 7.4 Quarterly transparency report

The first transparency report — required by Acceptance Criterion 7 of the engagement — is published within 30 days of E3 activation. It contains, at minimum:

- The §7.2 counters for the quarter.
- The list of FRAUD_LOCK incidents with their `<incident-id>`, criterion, duration, and outcome (active / cleared / under appeal).
- The list of signer rotations (by role) executed during the quarter.
- The list of indexer alarms raised and their resolution.
- Signed attestation from RA-1 (Protocol Team Lead) and RA-4 (External Auditor) that no FRAUD_LOCK was set outside §3.

The report template lives in [`docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md`](./TRANSPARENCY_REPORT_TEMPLATE.md) (E4 deliverable). Until E4 lands, the first E3 report is produced from this document's §7 directly.

---

## 8. Long-term plan — DAO-elected Risk Committee

The 3-of-5 multi-sig described in §2 is the **medium-term** Risk Authority. The **long-term** goal of the protocol is a fully DAO-elected Risk Committee with term limits. This section sketches the transition for reviewer awareness; the actual change is a future governance engagement (not in E3 scope).

| Phase | Composition | Selection | Term | Status |
|-------|-------------|-----------|------|--------|
| E3 (current) | 3-of-5 hardware multi-sig — RA-1…RA-5 | Mix of designation + DAO election (per §2.1) | Mixed (indefinite + 6–12 months) | **In scope** |
| E3.5 (next) | 3-of-5, all five seats elected | Diamond DAO `RISK_DISCLOSURE` proposals; staggered terms | 12 months, single-seat replacements every quarter to preserve continuity | **Out of scope** — requires E1 (DAO governance activation) fully operational at scale |
| E3.9 (long-term, optional) | 5-of-9 expanded committee | Diamond DAO + community delegates with NFT-weighted voting | 12 months, three seats up for election per quarter | **Out of scope** — speculative; revisit after 18 months of E3 operation |

The transition from E3 to E3.5 reuses the same migration mechanism as §6: a fresh multi-sig wallet contract is deployed with the new signer set, the Diamond DAO ratifies it via `E3.5-PROP-001`, and the on-chain `risk_authority` slice is rotated via the 7-day two-phase flow. There is no contract-level change required to reach E3.5 — only operational and governance maturity.

---

## 9. Acceptance criteria mapping

The table below maps each acceptance criterion of [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) to the artifact in this PR that satisfies it.

| # | Acceptance criterion | Artifact |
|---|----------------------|----------|
| AC-1 | E1 (DAO governance activation) complete | Tracked via [`E1-activation/ENGAGEMENT.md`](./E1-activation/ENGAGEMENT.md) — out of E3 scope; E3 is staged behind E1 ratification |
| AC-2 | Risk Authority multi-sig wallet set up and tested | §§ 6.2, 6.3 of this document + (operational) `docs/deployments/B2-mainnet/multisig.risk-authority.json` (to be added at activation time) |
| AC-3 | FRAUD_LOCK access control updated to require multi-sig authorization | §§ 6.1–6.3 — the on-chain `risk_authority` slice rotates to a 3-of-5 multi-sig wallet contract via the existing Issue #96 two-phase flow; the `account-locks.fc` setter guard `equal_slice_bits(sender_address, risk_authority)` (line 212) preserves the same access-control semantics |
| AC-4 | `docs/governance/RISK_AUTHORITY.md` written with full governance structure | This document |
| AC-5 | Appeal process documented and accessible to users | [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md), referenced from §§ 3.4, 4.4, 5 and from the wallet UI in-app notification deep link |
| AC-6 | `TransparencyRegistry` used to log all FRAUD_LOCK events | § 7, with on-chain mirroring via `RecordSnapshot` and indexer-derived event records |
| AC-7 | First transparency report published including lock activity | § 7.4 (template) + the activation PR ships the first report once the multi-sig is live |

The functional and non-functional requirements of the engagement are addressed as follows:

| Requirement | Section |
|-------------|---------|
| FR-1 — Multi-sig wallet set up (≥ 3-of-5) | § 2.1, § 6.2 |
| FR-2 — `account-locks.fc` updated to verify multi-sig authorisation if technically feasible | § 4.1, § 6.3 (no FC code edit needed: the existing handler accepts any address stored in `risk_authority`; rotating to a multi-sig wallet is the on-chain change) |
| FR-3 — `RISK_AUTHORITY.md` covers fraud criteria / lock procedure / appeal / signers | This document |
| NFR-1 — Multi-sig majority required | § 2.1 (3-of-5), § 4.3 |
| NFR-2 — Appeal decisions within 7 business days | [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) § 3 (SLA = 7 business days) |
| NFR-3 — All lock/unlock events auditable on-chain via TransparencyRegistry | § 7 |
| SR-1 — Hardware wallets for all signers | § 2.2 step 1 |
| SR-2 — Multi-sig key rotation procedure | § 2.4 + [`KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) § 7.2 update in this PR |
| SR-3 — No single person holds more than one signing key | § 2.2 step 2 |

---

## 10. References

- [`FRAUD_LOCK_APPEAL.md`](./FRAUD_LOCK_APPEAL.md) — user appeal procedure
- [`PARAMETERS.md`](./PARAMETERS.md) §§ 8–11 — parameter inventory and single-key elimination
- [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md) — governance proposal template (used for `E3-PROP-001`)
- [`SNAPSHOT.md`](./SNAPSHOT.md) — voter snapshot methodology (governs the `E3-PROP-001` ratification vote)
- [`E1-activation/ENGAGEMENT.md`](./E1-activation/ENGAGEMENT.md) — DAO activation prerequisite
- [`../security/KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §§ 4, 5, 7 — Risk Authority key class & rotation
- [`../security/THREAT_MODEL.md`](../security/THREAT_MODEL.md) §§ 7, 8 — T4, T8 risk treatment
- [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) — incident playbook
- `contracts/payments/account-locks.fc` — on-chain enforcement (lines 36–44, 210–322 in particular)
- `contracts/payments/ACCOUNT_LOCKS.md` — operator-facing contract documentation
- `contracts/governance/TransparencyRegistry.tact` — public mirror of governance events
- Issue [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) — E3 engagement
- Issue [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132) — E1 engagement (prerequisite)
- Issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) — E2 engagement (companion)
- Issue [#96](https://github.com/xlabtg/tonbankcard-protocol/issues/96) — Two-phase role transfer with 7-day timelock (migration vehicle)
