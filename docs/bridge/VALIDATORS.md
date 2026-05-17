# Cross-Chain Bridge — Validator Set Architecture

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the cryptographic threshold model, the
operational onboarding/rotation procedure, and the slashing posture
for the relayer set that approves cross-chain message confirmations
on the TON side of the bridge.

The relayer set is the **only** off-chain authority that
[`CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) trusts to
move an intent from `BRIDGE_INTENT_PENDING` to `BRIDGE_INTENT_CONFIRMED`
without the NFT owner's signature (`ConfirmBridgeExecution`,
[contract lines 228–276](../../contracts/CrossChainBridge.tact)). The
contract itself never custodies funds (I1, contract header lines 5–22),
so the validator set's blast radius is bounded to **status truth**,
not **fund movement**.

---

## 2. Acceptance criterion this artifact satisfies

Issue #138 §8 — _"Bridge validator set architecture documented in
`docs/bridge/VALIDATORS.md`"_ (**AC-3**).

Also satisfies issue #138 §5.2 — _"Validator set: minimum 5-of-9
multi-sig required for bridge message approval"_ — by §4 below.

---

## 3. Trust model

### 3.1 What the validator set can do

| Action | Mechanism | Bounded by |
|--------|-----------|-----------|
| Confirm a `PENDING` intent  | `ConfirmBridgeExecution` (M-of-N quorum, §4.2) | Status transition only; **no fund movement** (I1, I7). |
| Cancel a stuck intent       | _Not permitted._ Only the NFT owner can cancel (`CancelBridgeIntent`, contract lines 282–328). | Validators have no override path. |
| Modify the chain set         | _Not permitted._ Chains are governed by [SUPPORTED_CHAINS.md §5](./SUPPORTED_CHAINS.md). | Governance only. |
| Modify per-chain caps        | _Not permitted._ Caps are G-class parameters in [CIRCUIT_BREAKERS.md §4](./CIRCUIT_BREAKERS.md). | Governance only. |
| Pause the bridge             | _Not permitted._ Pause is a bridge-maintainer multi-sig action ([CIRCUIT_BREAKERS.md §5](./CIRCUIT_BREAKERS.md)). | Operations multi-sig only. |

### 3.2 What the validator set **cannot** do

The protocol's invariants ([`audit/INVARIANTS.md`](../../audit/INVARIANTS.md))
hold against a fully-corrupt validator set. Even a 9-of-9 collusion
**cannot**:

1. Move TBC tokens, TON, or any jetton out of the contract.
   The contract never holds them. Receipts only.
2. Mint cross-chain TBC. The TBC jetton master is out of bridge
   scope ([`audit/SCOPE.md`](../../audit/SCOPE.md) §"Out of Scope").
3. Spoof an NFT owner's `RegisterBridgeIntent`. Only the NFT owner
   address (via `sender()`) can register an intent — see contract
   lines 173–176, guarded by `validateOwnership` (lines 357–366).
4. Forge a `BridgeIntentRegistered` event the indexer would accept.
   Indexer correlation requires both an on-chain registration *and*
   a relayer confirmation; either alone is rejected.

The collusion risk is therefore bounded to **falsely marking an intent
`CONFIRMED`** when the external chain never executed it. The NFT owner
can always cancel a stuck intent before confirmation; the indexer
records the discrepancy if confirmation is forged after the external
chain proves nothing was sent.

---

## 4. Threshold Model — 5-of-9

### 4.1 Why 5-of-9

| Property                 | 3-of-5 | **5-of-9** | 7-of-11 |
|--------------------------|--------|-----------|---------|
| Liveness (max offline)   | 2      | 4         | 4       |
| Safety (collusion needed)| 3      | 5         | 7       |
| Geographic diversity     | low    | medium    | high    |
| Operational overhead     | low    | medium    | high    |

5-of-9 is the issue #138 §5.2 floor and the right Pareto point for
bridge confirmations: collusion needs ≥5 independent operators (more
than the equivalent multi-sig in MultiSigCard, see
[`MultiSigCard.tact` line 88 `MAX_SIGNERS = 3`](../../contracts/MultiSigCard.tact)),
while liveness tolerates 4 offline operators — enough to absorb a
hostile takeover of any single jurisdiction.

### 4.2 On-chain enforcement

The TON-side contract enforces the threshold **per-message**, not as a
single quorum gate:

1. Each of the nine validators is independently registered via
   `RegisterRelayer` (contract lines 421–424; gated by the deployer
   per the [A2 baseline mitigation for X-1](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) §4.5).
2. A `ConfirmBridgeExecution` message carries the **aggregate**
   external evidence (a single `external_tx_hash` plus the
   threshold-signature attestation from the off-chain relayer set —
   the off-chain side checks signatures and refuses to broadcast
   below 5-of-9).
3. The contract refuses any confirmation submitted by an address that
   is not in `authorized_relayers` (contract line 234, branch on
   `isAuthorizedRelayer`).

Because the threshold-signature check happens **off-chain** before the
relayer set submits a single `ConfirmBridgeExecution`, on-chain costs
stay flat regardless of N. The on-chain contract sees one transaction
per confirmation. The off-chain validator set is responsible for
producing the M-of-N attestation.

The off-chain attestation protocol is [BLS aggregate signatures over
the canonical message hash `H(target_chain || intent_id || amount ||
target_address_hash || external_tx_hash)`](./REPLAY_PROTECTION.md §4),
verified by the relayer service before relayed to TON.

### 4.3 Quorum upgrade path

Raising the threshold (e.g. 5-of-9 → 7-of-13) is a **G-class**
parameter change. The change must:

1. Pass a [PARAMETER_CHANGES](../governance/PARAMETER_CHANGES.md)
   proposal (44-NFT quorum, 48 h cooldown).
2. Run a 14-day **dry-run** period where the relayer service computes
   both attestations (old and new) and reports drift to
   [`MONITORING.md`](./MONITORING.md) §3.4.
3. Land the new key set via the procedure in §5.3.

---

## 5. Onboarding & Key Rotation

### 5.1 Onboarding checklist

Each new validator MUST satisfy **every** check below before the
deployer-gated `RegisterRelayer` is executed. The checklist mirrors
[`docs/security/KEY_MANAGEMENT.md` §5](../security/KEY_MANAGEMENT.md)
(_"Risk Authority Multi-Sig Rotation Procedure"_) — the bridge set
runs the same baseline.

- [ ] **Hardware-backed keys.** TON-side key on Ledger or Trezor
      (`ed25519`). EVM-side key on Ledger (`secp256k1`). Plain
      mnemonics are not acceptable (SR-1 of E3).
- [ ] **Geographic/operational diversity.** No two validators may be:
      - in the same jurisdiction at the operator level, or
      - run by the same operator (validator-of-record), or
      - run by a counterparty (CEX, custodian, wallet vendor) that
        already holds protocol responsibility (per SR-3 of E3 / no
        double-mandate).
- [ ] **Public attestation.** A signed CV in
      [`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md)
      §"Validator roster".
- [ ] **Comms.** PGP key in the
      [`SECURITY.md`](../../SECURITY.md) registry; phone-tree contact
      added to [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md).
- [ ] **DR.** Each validator runs a documented disaster-recovery
      drill twice per quarter — recorded in
      [`MONITORING.md`](./MONITORING.md) §5.

### 5.2 Planned rotation (every 6 months OR personnel change)

Routine rotation runs through the on-chain governance flow because
the relayer set is a G-class parameter (PP-26 in
[`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) §8.4).

```
[Day 0]   Proposal posted: "Rotate validator V-i to V-i+9"
[Day 7]   Voting closes; if ACCEPTED → 48 h cooldown
[Day 9]   Deployer signs RegisterRelayer for V-i+9
[Day 9]   New validator joins the off-chain attestation network
[Day 9..30] Drift monitor (MONITORING.md §3.4) verifies V-i+9 produces
          identical attestations to V-i over ≥1,000 events
[Day 30]  Old validator V-i removed via RemoveRelayer (NOTE: contract
          currently lacks RemoveRelayer; see CONTRACT_HARDENING.md
          item CH-3 — the documented mitigation is to mark the old
          relayer "deprecated" in the off-chain attestation service
          and to drop its signature weight to 0 at the relayer-service
          layer until CH-3 ships)
```

### 5.3 Emergency rotation (suspected key compromise)

Triggered by any of:

- A validator misses ≥3 consecutive confirmations (per
  [`MONITORING.md`](./MONITORING.md) §3.5).
- A validator self-reports compromise (PGP-signed message to
  `security@tonbankcard.com`).
- Indexer detects a confirmation with `external_tx_hash` that does
  **not** match the proven external transaction (correlation
  failure → see [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) §6).

Procedure:

1. **Pause** — Bridge maintainer invokes `PauseBridge` (per
   [`CIRCUIT_BREAKERS.md` §5](./CIRCUIT_BREAKERS.md)).
2. **Drop signature weight** — Relayer service blacklists the
   suspect key within 1 h.
3. **Governance** — Emergency T-class proposal (24 h cooldown lane,
   per [PP-26 §9](../governance/PARAMETERS.md)) replaces the
   compromised key. Quorum is still 44 NFTs because validator-set
   changes are class G; only the cooldown lane shortens.
4. **Resume** — `UnpauseBridge` once attestations from the new set
   reach the dry-run drift target.

Maintaining the 5-of-9 threshold under compromise is the explicit
design intent: 4 honest validators are sufficient to hold safety while
the new key joins.

---

## 6. Slashing posture

### 6.1 Why on-chain slashing is **not implemented**

The contract is non-custodial (I1). It never holds collateral that a
validator could post as a bond. Any slashing scheme would require:

1. Bonding TBC (or another asset) into the contract — directly
   violating I1.
2. Adding a dispute window during which validators can be challenged —
   introduces new attack surface (replay of the dispute message).
3. An on-chain price oracle to value the slashed bond — introduces
   the threats CCB-4 already raises in
   [A2 §4.1](../security/audits/A2-phase4-contracts/ENGAGEMENT.md).

The protocol team explicitly rejected this trade in PR review of issue
#113 (A2 engagement preparation). The slashing posture is therefore
**operational**, not cryptographic.

### 6.2 Operational consequences (slashing-equivalent)

A validator that signs a confirmation contradicted by the external
chain (i.e. forges status) faces:

| Step | Consequence |
|------|-------------|
| 1    | Relayer service drops the validator's signature weight to 0 immediately. |
| 2    | Indexer publishes the discrepancy to the public transparency feed (`TransparencyRegistry.RecordSnapshot`, see [E4 transparency reporting](../security/audits/A4-offchain-services/ENGAGEMENT.md)). |
| 3    | Operator-of-record is named in [`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md) §"Validator roster" with a `compromised` marker. |
| 4    | Emergency governance proposal replaces the validator (per §5.3). |
| 5    | Bug-bounty payout (per [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) §3) — the discoverer is rewarded irrespective of whether the discoverer is another validator. |

Repeat offences by the same operator-of-record are added to the
[`audit-notes.md`](../audit-notes.md) "known compromised operators"
ledger, which is referenced by the validator-roster review at every
rotation.

### 6.3 Why this is sufficient

The bridge contract's threat model ([A2 §4.1 CCB-2](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
covers **validator compromise** as a worst-case scenario: even a fully
malicious validator cannot move funds, can only falsely mark status.
Operational slashing reduces the **time the falsehood is unchallenged**
to ≤1 h (the relayer-service drop step), which is shorter than the 30
min finality target in [#138 §6](../../ISSUE/F3-crosschain-bridge-production-readiness.md).

---

## 7. Validator roster

The roster is recorded in
[`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md)
§"Validator roster". This document only specifies the **structure**;
the actual identities are sealed until A2 verdict `READY`.

Roster table schema:

| # | Validator alias | Operator-of-record | Jurisdiction | TON pubkey hash | EVM pubkey hash | Onboarded | PGP fingerprint | Status |
|---|-----------------|--------------------|--------------|------------------|------------------|-----------|------------------|--------|

`Status` enumeration: `active`, `dry-run`, `paused`, `compromised`,
`retired`.

---

## 8. Acceptance criteria mapping (Issue #138 §8)

| AC  | Requirement | Where it lives |
|-----|-------------|----------------|
| AC-1 | A2 audit complete (prerequisite) | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| AC-3 | Bridge validator set architecture documented | this document (§§4, 5, 6, 7) |
| AC-4 | Replay protection verified by auditor | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) §4 — message-hash format depends on the validator-set attestation in §4.2 here |
| AC-6 | Bridge monitoring alerts configured | [`MONITORING.md`](./MONITORING.md) §3 — uses the validator-roster from §7 here |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Supported chains       | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| Replay protection      | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Circuit breakers       | [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Key management         | [`docs/security/KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §5 |
| Incident response      | [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) |
| Parameter inventory    | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) PP-26 |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
