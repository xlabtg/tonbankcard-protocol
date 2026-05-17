# Cross-Chain Bridge — Bug-Bounty Category

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Program Brief:** [A5 Bug Bounty](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
**Status:** Draft — frozen at engagement kickoff; **activation gated on A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the bridge-specific addendum to the protocol bug
bounty program ([A5
PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)).
It enumerates the **bridge-specific scope, severity uplifts, and
out-of-scope clarifications** that the bridge surface needs in
addition to the protocol-wide rules.

The [A5 program brief](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§3.1 already lists `CrossChainBridge.tact` as **Pending A2** — bounty
submissions against it are rerouted to the A2 intake until A2 returns
verdict `READY`. This document defines what the bridge category
**will activate as** once A2 unblocks it; it does **not** activate the
category prematurely.

---

## 2. Acceptance criterion this artifact satisfies

Issue #138 §8 — _"Bridge bug-bounty category active"_ (**AC-7**).

Activation is **conditional**: AC-7 is satisfied when (a) this
document exists, (b) A2 reaches `READY`, (c)
[`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md)
records the category transition from `Pending A2` to `Active`, and
(d) the bridge readiness CI check
([`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts))
asserts (a)–(c) every PR.

---

## 3. In-scope assets

| Asset | Severity ceiling | Notes |
|-------|------------------|-------|
| [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) | **Critical** (per [A5 SEVERITY_RUBRIC.md §2.1](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)) — Critical reward band, eligible for the open-ended uplift per [A5 STATUS.md §10](../security/audits/A5-bug-bounty/STATUS.md). | Direct contract findings. |
| [`backend/adapters/bridge.ts`](../../backend/adapters/bridge.ts) | **High** (off-chain auth-break severity tier) | Adapter logic — caps, attestation hash format, dedup. |
| [`backend/services/bridge-chain-monitor.ts`](../../backend/services/bridge-chain-monitor.ts) *(planned, post-CH-5)* | **Medium** (off-chain) | RPC poller / reorg monitor. |
| [`backend/indexer/`](../../backend/indexer/) (bridge event subset only) | **High** (off-chain) | Bridge-event correlation step ([`REPLAY_PROTECTION.md` §6](./REPLAY_PROTECTION.md)). |
| [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts) *(planned)* | **Medium** | CI gate that prevents misconfigured releases. |

Off-chain adapter / indexer findings stay in the **off-chain** reward
column of the A5 program brief. Smart-contract findings against
`CrossChainBridge.tact` use the **smart-contract** column, with the
bridge-specific severity uplifts in §4.

---

## 4. Bridge-specific severity uplifts

The protocol-wide rubric in
[`SEVERITY_RUBRIC.md` §2](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
maps to the bridge surface as follows. Where the rubric is generic
across invariants, the table below names the bridge-specific
realisation so triage stays unambiguous.

### 4.1 Critical — `I1` Non-Custodial break on bridge surface

| Trigger | Realisation on bridge | Reward band |
|---------|------------------------|-------------|
| Forced fund movement on TON side via bridge contract | Any path through `CrossChainBridge.tact` that moves a jetton, TON, or any asset out of the contract. **Cannot exist by construction (contract holds no funds)** — but any payload that tricks an external adapter into transferring user funds via the bridge path qualifies. | Smart-contract Critical (open-ended) |
| Forged confirmation that drains a target-chain bridge contract (out of scope per #138 §4) | Out of scope — refers to project-deployed EVM-side contracts. Researchers report to the EVM contract's own bounty program. | n/a |
| Bypass of `I7` External Adapter Isolation through the bridge surface | An adapter invocation that reaches a protected operation in `PaymentHub` / `MerchantPaymentHub` via the bridge path. | Smart-contract Critical |

### 4.2 High — `I3` admin escape, replay, attestation forgery

| Trigger | Realisation on bridge | Reward band |
|---------|------------------------|-------------|
| Replay of `ConfirmBridgeExecution` for the same intent (T-RP-1) | Closed today by status-check pattern — any PoC that bypasses the lattice in [`REPLAY_PROTECTION.md` §4.1](./REPLAY_PROTECTION.md) qualifies. | Smart-contract High |
| Cross-chain replay (T-RP-2) where the same `external_tx_hash` is accepted twice | Operationally mitigated at L1 today; on-chain after CH-1. PoC against either layer qualifies. | Smart-contract High |
| Intent-key collision (T-RP-3 / X-5) demonstration with two distinct `(nft_address, intent_id)` pairs | Known A2-class issue. PoC against the **current** combinator earns the High band even though documented; PoC against the **post-CH-2** combinator earns Critical. | High (current) / Critical (post-CH-2) |
| Attestation-hash format divergence (T-RP-4) — find a hash pre-image collision that lets the relayer accept an attestation for a different intent | Smart-contract High; if the divergence enables forced confirmation against a wrong target chain, escalates to Critical. | High → Critical |
| Validator-set 6-of-9 bypass — submit a confirmation with < 6 valid signatures | Smart-contract High; if it leads to direct fund loss on the external side, escalates to Critical. | High → Critical |

### 4.3 High — `I3` pause / circuit-breaker bypass

| Trigger | Realisation on bridge | Reward band |
|---------|------------------------|-------------|
| Bypass of `paused: Bool` (post-CH-6) — a `RegisterBridgeIntent` or `ConfirmBridgeExecution` that succeeds while `paused == true` | Direct contract issue. | Smart-contract High |
| Bypass of the per-chain daily-outflow counter (post-CH-5) — a sequence of intents that collectively exceed PP-CCB-X within 24 h without `ERROR_BR_CHAIN_CAP_EXCEEDED` | Direct contract issue. | Smart-contract High |
| Bypass of the auto-pause AP-1..AP-5 triggers in [`CIRCUIT_BREAKERS.md` §5.1](./CIRCUIT_BREAKERS.md) | Off-chain auto-pause logic in the relayer service. | Off-chain High |

### 4.4 Medium — incorrect status, monitoring gaps

| Trigger | Realisation on bridge | Reward band |
|---------|------------------------|-------------|
| Indexer mis-categorises a confirmed intent as pending under a specific edge case | Bridge surface variant of the generic "indexer mis-categorisation" Medium in [`SEVERITY_RUBRIC.md` §2.3](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md). | Off-chain Medium |
| BR-Mxx monitoring alert (per [`MONITORING.md` §3](./MONITORING.md)) fails to fire under a deterministic trigger | Alerting gap. | Off-chain Medium |
| `BridgeAutoPauseTriggered` event payload missing a required field per the §5.1 schema | Reduces signal fidelity. | Off-chain Medium |

### 4.5 Low / Informational

Same as protocol-wide rubric. No bridge-specific uplift.

---

## 5. Bridge-specific out-of-scope clarifications

The following items extend the protocol-wide out-of-scope list in
[`PROGRAM_BRIEF.md` §3.4](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md):

| Item | Rationale |
|------|-----------|
| Findings in third-party bridges (Wormhole, Multichain, etc.) reached through ChangeNOW or another external provider | Out-of-scope per the third-party-dependency rule. Report to the bridge's own program. |
| Findings in target-chain bridge contracts deployed by the protocol team | Out of scope per #138 §4 — _"EVM-side bridge contracts are out of scope"_. These have separate audits. |
| Validator-key compromise via social engineering or phishing | Out-of-scope per the social-engineering rule. The operational slashing posture ([`VALIDATORS.md` §6](./VALIDATORS.md)) is the runbook for such events. |
| Findings on test-only handlers `RegisterNFTOwnerBridge` / `RegisterRelayer` ([contract lines 413–424](../../contracts/CrossChainBridge.tact)) | Out of scope — these will be removed before mainnet per [PP-40](../governance/PARAMETERS.md) / CH-7. Researchers who find pre-mainnet-removal issues should report to the A2 engagement instead. |
| Reorg-induced status divergence on a target chain that has not reached its finality threshold (per [`REPLAY_PROTECTION.md` §4.5](./REPLAY_PROTECTION.md)) | By design — the relayer service waits for finality before issuing an attestation. A reorg before finality is expected behaviour. Findings that demonstrate the relayer issuing an attestation **before** the threshold qualify as High. |

---

## 6. Threat-catalogue cross-reference

The A2 threat catalogue in
[`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md` §4.1](../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
maps to bug-bounty bands as follows:

| A2 threat | Description | Bounty band |
|-----------|-------------|-------------|
| **CCB-1** | Replay attack on bridge messages | High (§4.2 here) |
| **CCB-2** | Validator-set compromise (5-of-9 corruption) | Critical if it enables forced confirmation; High otherwise (§4.2 here) |
| **CCB-3** | Target-chain finality failure (reorg) | Out-of-scope unless relayer issues attestation pre-finality (§5 here) |
| **CCB-4** | Economic attack on validator set | High → Critical per impact (§4.2 here) |
| **CCB-5** | Manual operations / pause bypass | High (§4.3 here) |
| **CCB-6** | Composite-key collision (X-5) | High (current combinator) / Critical (post-CH-2) (§4.2 here) |
| **CCB-7** | Cross-chain replay | High (§4.2 here) |

---

## 7. Activation timeline

The bridge bounty category activates only after:

1. **A2 verdict `READY`** — recorded in
   [`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md).
2. **CH-1..CH-7 landed** — per
   [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md).
   (CH-7 in particular — removal of test-only handlers — is required
   so that researchers don't waste cycles finding pre-removal issues.)
3. **PROGRAM_BRIEF.md update** — the §3.1 row for `CrossChainBridge.tact`
   transitions from `Pending A2` to `Active` and references this
   document for the bridge-specific scope.
4. **STATUS.md note** — the bug-bounty `STATUS.md` records the
   category activation date and the bridge-specific intake URL.

Activation **must not** precede A2. A premature activation would
expose the protocol to a bounty-payout obligation for findings that
the A2 audit would have caught for a flat audit fee.

---

## 8. Triage SLA (bridge findings)

The protocol-wide SLA in
[`PROGRAM_BRIEF.md` §6](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
applies to bridge submissions. Bridge-specific refinements:

| Severity | Initial response | Triage decision | Notes |
|----------|-----------------:|----------------:|-------|
| Critical | 4 h              | 24 h            | Critical bridge findings invoke `PauseBridge` while triage is in progress. The pause is automatic per the [`CIRCUIT_BREAKERS.md` §5.2](./CIRCUIT_BREAKERS.md) reason-code `RC-BOUNTY-CRITICAL`. |
| High     | 8 h              | 72 h            | High bridge findings page the bridge on-call (P1 per [`MONITORING.md` §3.7](./MONITORING.md)). |
| Medium   | 24 h             | 7 days          | Standard triage queue. |
| Low      | 7 days           | 14 days         | Standard triage queue. |

The Critical bridge SLA is **tighter** than the protocol-wide
default because a Critical bridge finding's payload can in principle
move funds via a target chain (even though the TON-side contract
itself is non-custodial). The `RC-BOUNTY-CRITICAL` pause is a
defence-in-depth lever — the alternative is hoping the discoverer
withholds disclosure during the standard triage window.

---

## 9. Acceptance criteria mapping (Issue #138 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §7 — gates activation on A2. |
| AC-3 | Bridge validator set documented | §4.2 — uses the validator-set thresholds defined in [`VALIDATORS.md`](./VALIDATORS.md). |
| AC-4 | Replay protection verified by auditor | §4.2 / §6 — replay bounty bands track T-RP-1..T-RP-5. |
| AC-5 | Bridge circuit breakers operational | §4.3 / §8 — bypass severity defined, Critical SLA invokes pause. |
| AC-7 | Bridge bug-bounty category active | this document, activation per §7. |

---

## 10. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Supported chains       | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| Validators             | [`VALIDATORS.md`](./VALIDATORS.md) |
| Replay protection      | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Circuit breakers       | [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| A5 program brief       | [`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md) |
| A5 severity rubric     | [`docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md`](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md) |
| A5 status              | [`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md) |
| Invariants             | [`audit/INVARIANTS.md`](../../audit/INVARIANTS.md) |

---

## 11. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
