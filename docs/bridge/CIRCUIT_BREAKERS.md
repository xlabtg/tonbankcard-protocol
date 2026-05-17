# Cross-Chain Bridge — Circuit Breakers & Pause Authority

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the circuit-breaker envelope that protects the
cross-chain bridge from runaway outflow, validator misbehaviour, and
target-chain compromise. It defines the **layered** breaker model that
issue #138 §7 mandates (_"Bridge circuit breakers operational —
auto-pause threshold conservative initially (e.g., 1% of TVL per day),
manual pause must be available"_) and maps every threshold to a
governance-controlled parameter.

The bridge contract is **non-custodial** (I1, [`CrossChainBridge.tact`
header lines 5–22](../../contracts/CrossChainBridge.tact)). It cannot
implement TVL-style circuit breakers at the asset level — there is no
asset under its control to cap. Instead, it caps **intent throughput**
(daily intent count and on-chain `amount`-field outflow); the
off-chain adapter and indexer apply the TVL-style caps before an
intent ever reaches the chain.

---

## 2. Acceptance criterion this artifact satisfies

Issue #138 §8 — _"Bridge circuit breakers operational"_ (**AC-5**).

Also satisfies issue #138 §7 — the four sub-requirements:

1. Daily outflow caps per chain. → §3, §4.
2. Total TVL caps per chain (advisory). → §4 column "Per-chain total
   locked (advisory)" referenced from [`SUPPORTED_CHAINS.md`
   §4.1](./SUPPORTED_CHAINS.md).
3. Auto-pause threshold (1 %/day initial). → §5.1.
4. Manual pause available. → §5.2.

---

## 3. Breaker Layers

Circuit breakers operate at three layers, each with its own
authority and reaction time:

| Layer        | Authority                  | Reaction time | Mechanism                                | Recovery                              |
|--------------|----------------------------|--------------:|------------------------------------------|---------------------------------------|
| **L0 — Contract** | Compiled-in constants & on-chain counters | Block-time (≤ 5 s) | Reject `RegisterBridgeIntent` if breach. | Auto-resets at the next 24 h boundary. |
| **L1 — Adapter** | Off-chain adapter (`backend/adapters/bridge.ts`) | ≤ 1 s | Refuse to construct an intent that would breach a cap. | Operator restart; caps reload at ≤ 5 min. |
| **L2 — Operations** | Bridge maintainer multi-sig (PauseBridge) | ≤ 30 min (paging SLA) | `PauseBridge` setter via multi-sig. | `UnpauseBridge` via multi-sig after incident response. |

L0 is the contract's last line of defence and cannot be bypassed by
any actor. L1 is the user-friendly first line that returns informative
errors and never wastes a transaction. L2 is the human-in-the-loop
escape hatch that triggers when the automated layers misclassify an
event.

The CCB-3 / CCB-4 threats in [A2 §4.2](../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
(_"Validator-set economic attack"_, _"Target-chain finality failure"_)
require all three layers to be operational before the bridge ships
to mainnet.

---

## 4. Quantitative thresholds

The numerical caps below are the initial v1 figures. Each cap maps to
a parameter row that will be added to
[`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) under
the new bridge sub-section §8.4-bis (insertion planned in the same PR
that lands the contract-hardening track CH-1..4; until then this
document is the canonical source).

### 4.1 Per-chain caps (mirrors [`SUPPORTED_CHAINS.md` §4.1](./SUPPORTED_CHAINS.md))

| Parameter ID | Scope    | Initial value | Class | Where set | Change procedure |
|--------------|----------|--------------:|:-----:|-----------|------------------|
| **PP-CCB-1** | Ethereum per-tx max | 10,000 TBC | G | Adapter constants + L0 counter | 44-NFT quorum, 48 h cooldown |
| **PP-CCB-1** | Ethereum per-NFT 24 h | 25,000 TBC | G | L1 + indexer | 44-NFT quorum, 48 h cooldown |
| **PP-CCB-1** | Ethereum per-chain 24 h outflow | 100,000 TBC | G | L0 counter (CH-5) + L1 adapter | 44-NFT quorum, 48 h cooldown |
| **PP-CCB-2** | BSC (same shape as PP-CCB-1) | 10,000 / 25,000 / 100,000 TBC | G | as above | as above |
| **PP-CCB-3** | Polygon (same shape) | 10,000 / 25,000 / 100,000 TBC | G | as above | as above |
| **PP-CCB-4** | Bitcoin | 5,000 / 10,000 / 25,000 TBC | G | as above | as above |
| **PP-CCB-5** | Solana | 5,000 / 10,000 / 25,000 TBC | G | as above | as above |
| **PP-CCB-6** | Finality threshold registry (§4.5 of `REPLAY_PROTECTION.md`) | per-chain | G | L1 + relayer | 44-NFT quorum, 48 h cooldown |
| **PP-CCB-7** | Auto-pause trigger fraction | 1 % of advisory TVL / 24 h | G | L1 + monitoring | 44-NFT quorum, 48 h cooldown |
| **PP-CCB-8** | Bridge pause flag | `paused: Bool` | G | L0 storage (CH-6) | Operations multi-sig (see §5.2) |

The shape `per-tx / per-NFT 24 h / per-chain 24 h` is normalised across
all chains so that monitoring rules in
[`MONITORING.md` §3](./MONITORING.md) can be generated mechanically.

### 4.2 Why these specific numbers

| Cap                  | Anchor                                                                                          | Sanity check                                                                              |
|----------------------|-------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| **10,000 TBC / tx (EVM)**    | ≈ 1 % of the **advisory per-chain TVL** for Ethereum (1,000,000 TBC). | A single mistake bleeds ≤ 1 % of the chain's stake.   |
| **25,000 TBC / NFT / 24 h (EVM)** | 2.5 × per-tx — a determined power user (merchant) can bridge their account in 2 days. | Any usage above 2 days/account is anomalous and triggers L2 alert.                |
| **100,000 TBC / chain / 24 h (EVM)** | 10 % of advisory per-chain TVL — the issue #138 §7 *ceiling* (1 %/day is the *floor*).  | Above this, auto-pause arms.                                                              |
| **5,000 TBC / tx (BTC, SOL)**       | Half of the EVM tx cap, reflecting lower advisory TVL caps on these chains.                  | Same blast-radius ratio (≤ 5 % of advisory) as EVM tx caps.                               |
| **1 % auto-pause trigger**          | Issue #138 §7 explicit floor.                                                                | Conservative; can only loosen via G-class.                                                |

### 4.3 Trust-minimisation note

The contract today does **not** enforce the per-chain daily outflow
counter at L0. That is item **CH-5** in
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) (planned, post-A2)
and the counter has the shape `chain_outflow_24h: map<Int, Int>` plus
a `last_reset_at: Int`. Until CH-5 ships, the L1 adapter is the only
enforcement point for the daily figures — a misconfigured adapter
could in principle process more than the daily cap, but a forged
adapter cannot mint funds (I1) — at most it can corrupt **status
records**, which the indexer correlation step (`REPLAY_PROTECTION.md`
§6) catches.

The per-tx cap and chain-ID validation are already enforced on-chain
via the `msg.amount > 0` check (line 181) and `msg.target_chain ∈ [1,
MAX_SUPPORTED_CHAIN]` check (line 187) in
[`CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact). The
hard upper-bound on `amount` is the `coins` SCALE (≈ 2⁷⁰); CH-5 adds
the explicit per-chain ceiling.

---

## 5. Pause Authority

### 5.1 Auto-pause (L1, off-chain)

The relayer service and indexer jointly run an auto-pause monitor.
Trigger conditions are:

| # | Condition | Threshold | Lookback | Source |
|---|-----------|-----------|----------|--------|
| AP-1 | Per-chain daily outflow exceeds PP-CCB-7 (1 % of advisory TVL / 24 h) | 1 % of `SUPPORTED_CHAINS §4.1` "Per-chain total locked (advisory)" | rolling 24 h | L1 adapter counters |
| AP-2 | More than 3 `ConfirmBridgeExecution` events fail external-tx correlation in a single hour | 3 / 1 h | rolling 1 h | Indexer correlation step (see [`REPLAY_PROTECTION.md` §6](./REPLAY_PROTECTION.md)) |
| AP-3 | Validator-set quorum drops below 6/9 active validators | < 6 active | instant | [`VALIDATORS.md` §3.5](./VALIDATORS.md) heartbeat |
| AP-4 | External provider (ChangeNOW) returns ≥ 5 % HTTP-5xx over 15 min | 5 % / 15 min | rolling 15 min | Adapter health check |
| AP-5 | Target-chain reorg deeper than the finality threshold in [`REPLAY_PROTECTION.md` §4.5](./REPLAY_PROTECTION.md) | reorg > N confirmations | instant | Per-chain RPC monitor |

A trigger fires the following in order:

1. Relayer service stops broadcasting new attestations (within 30 s).
2. Adapter rejects new `RegisterBridgeIntent` requests at the API layer
   with HTTP 503 and the JSON body `{ "error": "BRIDGE_AUTO_PAUSED",
   "trigger": "AP-N", "since": "<iso8601>", "ref":
   "docs/bridge/CIRCUIT_BREAKERS.md#auto-pause" }`.
3. A `BridgeAutoPauseTriggered` event is written to the indexer
   stream and forwarded to [`MONITORING.md` §3.6](./MONITORING.md)
   pager rotation.
4. The bridge maintainer multi-sig is paged. The auto-pause is
   **time-bounded** (max 4 h); after that, a manual pause (§5.2) must
   be invoked or the bridge resumes.

Auto-pause is **L1 only**. On-chain state is **not** affected; an
NFT owner can still cancel a pending intent via `CancelBridgeIntent`.
This is by design — non-custodial means the user retains the right to
exit even when the protocol is degraded.

### 5.2 Manual pause (L2, on-chain)

Once **CH-6** ships (post-A2), the contract gains a `paused: Bool`
storage field and the following messages:

```tact
message PauseBridge { reason_code: Int as uint8; }
message UnpauseBridge { /* empty */ }
```

Authority: only the bridge maintainer multi-sig (`PP-CCB-8`), recorded
in `docs/deployments/B2-mainnet/multisig.bridge.json`, may invoke
either message. The multi-sig is **2-of-3** at minimum per the
single-key elimination policy in
[`docs/governance/PARAMETERS.md` §10](../governance/PARAMETERS.md).

When `paused = true`:

| Handler | Behaviour |
|---------|-----------|
| `RegisterBridgeIntent` | Returns `ERROR_BR_PAUSED` (new code 9, CH-6) and emits no event. |
| `ConfirmBridgeExecution` | Returns `ERROR_BR_PAUSED`. Validators **cannot** advance status. |
| `CancelBridgeIntent` | **Allowed** — non-custodial guarantee (I1) requires that users always retain the right to cancel. |
| `RegisterRelayer` / `RegisterNFTOwnerBridge` (test-only) | Still gated by deployer (unchanged); these are removed before mainnet. |

Recovery (`UnpauseBridge`) requires:

1. The L1 auto-pause trigger has cleared for at least 1 h.
2. An incident report has been filed in
   [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md)
   and posted to the public transparency feed.
3. The bridge maintainer multi-sig signs `UnpauseBridge` with a
   non-empty `proposal_ref` linking to the incident report (off-chain
   metadata, attached in the message memo).

`PauseBridge` has **no timelock**; it is an emergency lever.
`UnpauseBridge` has a 24 h cooldown (recorded in
[`PARAMETERS.md` §9](../governance/PARAMETERS.md) when PP-CCB-8 is
added) so that pauses cannot be undone before incident response
completes.

### 5.3 Why pause is contract-wide, not per-chain

The contract pause is **global**, not per-chain, by design — per the
threat model in [`docs/security/THREAT_MODEL.md` §4.4.4](../security/THREAT_MODEL.md).
If one target chain is compromised, an attacker can attempt to route
an attestation against a *different* chain (the T-RP-2 cross-chain
replay vector in [`REPLAY_PROTECTION.md` §4.2](./REPLAY_PROTECTION.md))
— so pausing only the affected chain leaves the others exposed.

Per-chain disable lives at L1 (the adapter's `enabled` flag per chain,
flipped via a G-class proposal in [`SUPPORTED_CHAINS.md` §5.3](./SUPPORTED_CHAINS.md)).
The L1 mechanism is for routine deprecation; the L2 pause is for
incidents.

---

## 6. Verification Procedure

The bridge production readiness check
([`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts),
planned — see [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md))
verifies the following before any release-tag is allowed:

1. **§4.1 table consistency.** Per-chain caps in this document, in
   [`SUPPORTED_CHAINS.md` §4.1](./SUPPORTED_CHAINS.md), and in
   `backend/adapters/bridge.ts` constants must agree to the byte.
2. **PP-CCB-* parameter IDs.** Every numeric cap mentioned here maps to
   exactly one parameter row planned for
   [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md).
3. **Pause readiness.** When CH-6 ships, the contract must export a
   `paused()` getter and emit `BridgePauseTriggered` / `BridgeResumed`
   events. The validator asserts both.
4. **Adapter consistency.** The adapter's exported `BRIDGE_LIMITS`
   constant must match this document's §4.1 table.
5. **Multi-sig threshold.** `docs/deployments/B2-mainnet/multisig.bridge.json`
   exists, the address is not flagged `eoa: true`, and the threshold
   is ≥ 2.

A failure of any of the five checks blocks the bridge from advancing
out of the `Pending A2` status in
[`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md).

---

## 7. Acceptance criteria mapping (Issue #138 §8)

| AC  | Requirement | Where it lives |
|-----|-------------|----------------|
| AC-1 | A2 audit complete (prerequisite) | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| AC-2 | Supported-chain list documented | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| AC-3 | Bridge validator set architecture documented | [`VALIDATORS.md`](./VALIDATORS.md) |
| AC-4 | Replay protection verified by auditor | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| AC-5 | Bridge circuit breakers operational | this document (§§3, 4, 5) |
| AC-6 | Bridge monitoring alerts configured | [`MONITORING.md`](./MONITORING.md) — depends on §5.1 here for AP-* alert rules |
| AC-7 | Bridge bug-bounty category active | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) — pause / circuit-breaker bypass is in scope |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Supported chains       | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| Validators             | [`VALIDATORS.md`](./VALIDATORS.md) |
| Replay protection      | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Threat model           | [`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md) §4.4.4 |
| Parameter inventory    | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) §8.4 (PP-25..28) + planned §8.4-bis (PP-CCB-1..8) |
| Incident response      | [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
