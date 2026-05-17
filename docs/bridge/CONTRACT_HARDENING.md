# Cross-Chain Bridge — Contract Hardening Track (post-A2)

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **no contract code shipped until A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document collects every contract-level change planned for the
cross-chain bridge as part of production hardening. The changes are
intentionally **deferred** past the A2 audit baseline — landing any
of them before A2 returns verdict `READY` would invalidate the audit
scope and reset the engagement clock.

The pattern mirrors the E3 PR 201 approach for FRAUD_LOCK (issue
#134): governance documents, off-chain validators, and tests land now
under issue #138; contract code lands later, in a follow-up PR that
explicitly cites this document and the A2 verdict.

Every other bridge production-readiness document
([`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md),
[`VALIDATORS.md`](./VALIDATORS.md),
[`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md),
[`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md),
[`MONITORING.md`](./MONITORING.md),
[`BUG_BOUNTY.md`](./BUG_BOUNTY.md)) references **CH-N** items by ID
from §3 below — this is the single source of truth for the contract
changes the bridge production launch depends on.

---

## 2. Why deferred (not "future-work")

Issue #138 §3 names A2 as a **hard prerequisite**:

> _"A2: Phase 4 contract audit complete — Cross-Chain Bridge included
> in the audit scope, no critical / high findings outstanding"_.

The A2 engagement
([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
locks the contract artefact at a specific commit hash so that the
auditor can sign off on a single bytecode. Changing any line of
[`CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) ahead
of the audit:

1. Invalidates the auditor's bytecode hash.
2. Resets the clock on the threat-catalogue review (CCB-1..CCB-7).
3. Disqualifies the deployment manifest from the B2 ceremony
   ([`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md)).

Therefore each CH-N item below is **designed but not landed** under
issue #138. Landing happens in a follow-up issue referencing this
document, gated by the conditions in §4.

---

## 3. Hardening Backlog

Each row below has the same shape: the threat it closes, the contract
diff in shape (not in literal code), and the cross-document
references that flip from "operationally mitigated" to "closed
on-chain" once the change ships.

### CH-1 — `external_tx_hash` deduplication map

**Closes threat:** T-RP-2 cross-chain replay
([`REPLAY_PROTECTION.md` §4.2](./REPLAY_PROTECTION.md)), A2 §4.1
CCB-1 / CCB-7.

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `external_tx_seen: map<Int, Bool>` (256-bit key = `external_tx_hash`). |
| `ConfirmBridgeExecution` | Before status transition, require `external_tx_seen.get(msg.external_tx_hash) == null`; on success, set the key to `true` **before** emitting the event. |
| Error code | Add `ERROR_BR_EXTERNAL_TX_REPLAY = 8`. Existing codes 0..7 unchanged. |
| Getters | Add `get fun externalTxSeen(hash: Int): Bool`. |
| Events | No change. Existing `BridgeExecutionConfirmed` is sufficient. |

**Migration:** No prior state to migrate (bridge has not gone live).
The map starts empty.

**Tests required at landing:** dedicated replay-test sweep in
`tests/cross-chain-bridge/CrossChainBridge.spec.ts` — two consecutive
`ConfirmBridgeExecution` with the same `external_tx_hash` against
different `(nft_address, intent_id)` pairs must fail the second.

**Doc references that update:** [`REPLAY_PROTECTION.md`
§4.2](./REPLAY_PROTECTION.md) flips from _"externalised to relayer
today"_ to _"closed on-chain"_; [`MONITORING.md`
§3.2](./MONITORING.md) drops the L1 dedup alert (kept as defence in
depth at L1).

### CH-2 — Composite-key hardening

**Closes threat:** T-RP-3 intent-key collision
([`REPLAY_PROTECTION.md` §4.3](./REPLAY_PROTECTION.md)), A2 §4.5 X-5
/ C-CCB-H2.

**Shape of change:**

| Element | Change |
|---------|--------|
| `intentKey` ([contract lines 384–386](../../contracts/CrossChainBridge.tact)) | Replace integer addition combinator with `sha256` over a concatenated cell: `sha256(beginCell().storeAddress(nft_address).storeUint(intent_id, 64).endCell().asSlice())`. |
| Storage shape | No change to `bridge_intents` map shape (still `map<Int, BridgeIntentInfo>`); only the key derivation function changes. |
| Backwards compatibility | None required — bridge has not gone live, so no pre-existing intents to migrate. |

**Tests required at landing:** unit test that constructs two
addresses whose `sha256` distance equals an attacker-chosen `Δ`,
issues two intents with `intent_id` values differing by `Δ`, and
asserts they land in distinct keys (would have collided under the
old combinator).

**Doc references that update:** [`REPLAY_PROTECTION.md`
§4.3](./REPLAY_PROTECTION.md) marks T-RP-3 closed and removes the
adapter-side monotonic-counter mitigation as defence-in-depth.

### CH-3 — `RemoveRelayer` handler

**Closes operational gap:** validator rotation in [`VALIDATORS.md`
§5.2](./VALIDATORS.md) — today the contract has no path to remove a
relayer; the rotation procedure resorts to dropping signature weight
to 0 at the relayer-service layer.

**Shape of change:**

| Element | Change |
|---------|--------|
| New message | `message RemoveRelayer { relayer: Address; }`. |
| Handler | `receive(msg: RemoveRelayer) { require(sender() == self.deployer, "..."); self.authorized_relayers.set(msg.relayer, false); }` |
| Test-only flag | Same gate as `RegisterRelayer` until governance multi-sig wiring lands separately. |
| Eventing | Emit `BridgeRelayerRemoved { relayer: Address; timestamp: uint32; }` for indexer correlation. |

**Migration:** None — adding a new handler.

**Tests required at landing:** add `RemoveRelayer` flow to the
existing onboarding/rotation test in
`tests/cross-chain-bridge/CrossChainBridge.spec.ts`.

**Doc references that update:** [`VALIDATORS.md`
§5.2](./VALIDATORS.md) drops the parenthetical _"NOTE: contract
currently lacks RemoveRelayer"_.

### CH-4 — `verifyAttestation()` getter

**Closes:** §4.4 of [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md)
— the canonical message-hash binding. Today the binding is asserted
**off-chain** by the relayer service; CH-4 adds an on-chain getter
that any party can call to verify a candidate attestation against the
contract's view of the intent.

**Shape of change:**

| Element | Change |
|---------|--------|
| Getter | `get fun canonicalMessageHash(nft_address: Address, intent_id: Int, external_tx_hash: Int): Int` — returns `sha256(target_chain || intent_id || amount || target_address_hash || external_tx_hash || self.address || chain_id)` over the stored intent (looked up by composite key), or `0` if the intent does not exist. |
| Getter (verification) | `get fun verifyAttestation(nft_address: Address, intent_id: Int, external_tx_hash: Int, candidate_hash: Int): Bool` — returns `candidate_hash == canonicalMessageHash(...)`. |
| No state mutation | Both getters are pure-read; no event, no storage write. |

**Migration:** None.

**Tests required at landing:** parity test asserting the getter
returns the same hash the off-chain `canonicalMessageHash` in
[`backend/adapters/bridge.ts`](../../backend/adapters/bridge.ts)
computes for a controlled input set.

**Doc references that update:** [`REPLAY_PROTECTION.md`
§4.4](./REPLAY_PROTECTION.md) marks the on-chain side of the binding
"verifiable" (not just asserted by relayer); [`VALIDATORS.md`
§4.2](./VALIDATORS.md) cites CH-4 as the on-chain mirror.

### CH-5 — Per-chain daily outflow counter

**Closes:** the L0 enforcement gap noted in [`CIRCUIT_BREAKERS.md`
§4.3](./CIRCUIT_BREAKERS.md). Today the per-chain daily cap exists
only at L1 (adapter); CH-5 puts the cap inside the contract so even a
compromised adapter cannot push past it.

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `chain_outflow_24h: map<Int, Int>` (key = target_chain ID, value = TBC amount in current 24 h window) and `last_reset_at: Int` (uint32 timestamp). |
| Storage | Add `chain_cap_24h: map<Int, Int>` (key = target_chain ID, value = per-chain 24 h ceiling from PP-CCB-1..5). Initial values seeded by deployer at init via a one-shot `SetChainCaps` setter; subsequent changes via G-class. |
| `RegisterBridgeIntent` | Before accepting, roll over `last_reset_at` if `now() - last_reset_at >= 86400` (resets all entries to 0). Then `require(chain_outflow_24h[target_chain] + msg.amount <= chain_cap_24h[target_chain], ...)`. On success, increment. |
| Error code | Add `ERROR_BR_CHAIN_CAP_EXCEEDED = 10`. |
| Setter | `message SetChainCap { target_chain: Int; cap: Int; }` — bridge-maintainer multi-sig only. |
| Events | Emit `ChainCapExceeded { target_chain, attempted_amount, current_outflow }` on rejection so monitoring at [`MONITORING.md` §3.3](./MONITORING.md) can page. |

**Migration:** Initial caps from PP-CCB-1..5 set during deployment.

**Tests required at landing:** sweep of `RegisterBridgeIntent`
intents until the daily cap is exhausted; verify rollover at the 24 h
boundary; verify `SetChainCap` gated by multi-sig (E2-style
parameter-change test).

**Doc references that update:** [`CIRCUIT_BREAKERS.md`
§4.3](./CIRCUIT_BREAKERS.md) flips from _"L1 only"_ to _"L0 + L1 in
depth"_.

### CH-6 — Pause flag (`PauseBridge` / `UnpauseBridge`)

**Closes:** issue #138 §7 _"manual pause must be available"_; A2 §4.4
CCB-5 (manual operations).

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `paused: Bool` (default `false`). |
| Messages | `message PauseBridge { reason_code: Int as uint8; }`, `message UnpauseBridge { /* empty */ }`. |
| Authority | Both gated by `sender() == self.bridge_admin` — `bridge_admin` is a new storage field initialised to the deployer at init and transferable via the two-phase pattern from `PaymentHub.tact` (PP-15) with 7-day timelock. |
| `RegisterBridgeIntent` / `ConfirmBridgeExecution` | Add `require(!self.paused, ...)`; return `ERROR_BR_PAUSED = 9`. |
| `CancelBridgeIntent` | **Not** gated by `paused` — non-custodial guarantee (I1) requires that users always retain the right to cancel. |
| Events | `BridgePauseTriggered { reason_code, timestamp }`, `BridgeResumed { timestamp }`. |
| Getters | `get fun isPaused(): Bool`. |

**Migration:** Initial `paused = false`. Initial `bridge_admin` is
the deployer at init; B2 ceremony transfers it to the bridge
maintainer multi-sig via the two-phase pattern.

**Tests required at landing:** pause/resume flow; pause must reject
register & confirm but allow cancel; only bridge admin can pause;
emergency pause rejects unauthorised sender with `NOT_AUTHORIZED`.

**Doc references that update:** [`CIRCUIT_BREAKERS.md`
§5.2](./CIRCUIT_BREAKERS.md) drops the conditional _"Once CH-6
ships"_ language.

### CH-7 — Remove test-only handlers (PP-40)

**Closes:** [`docs/governance/PARAMETERS.md`
§8.6 PP-40](../governance/PARAMETERS.md) — _"test-only handlers must
be removed before mainnet"_.

**Shape of change:**

| Element | Change |
|---------|--------|
| `RegisterNFTOwnerBridge` ([contract lines 413–419](../../contracts/CrossChainBridge.tact)) | Remove from mainnet build. Either delete unconditionally, or gate behind a Tact `#ifdef TESTING` equivalent if Tact gains conditional compilation by then. |
| `RegisterRelayer` ([contract lines 421–424](../../contracts/CrossChainBridge.tact)) | Replace with the production setter (a G-class governance proposal calling a new `MultiSigRegisterRelayer` handler gated by `bridge_admin`). |
| Message types `RegisterNFTOwnerBridge` and `RegisterRelayer` | Remove from mainnet build. |

**Migration:** The B2 deployment ceremony populates the
production relayer set via the new `MultiSigRegisterRelayer` handler
in a sequence of transactions signed by the bridge-admin multi-sig.

**Tests required at landing:** assert mainnet artefact does not
export `RegisterNFTOwnerBridge` or `RegisterRelayer`; assert
test-suite uses the production `MultiSigRegisterRelayer` path via the
test-only multi-sig override (E1 activation runbook pattern).

**Doc references that update:** [`docs/governance/PARAMETERS.md`
§8.6](../governance/PARAMETERS.md) — strike-through PP-40.

---

## 4. Sign-off Gating

CH-N items may only land in a follow-up PR after **all** of the
following conditions hold:

1. **A2 verdict.** A2 audit
   ([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
   returns verdict `READY` and the corresponding `STATUS.md` is
   updated.
2. **No critical/high outstanding.** A2 final report lists zero
   open critical or high findings against `CrossChainBridge.tact`.
3. **B2 ceremony scheduled.** `docs/deployments/B2-mainnet/multisig.bridge.json`
   exists with `threshold >= 2` and `eoa: false` for every signer.
4. **Bridge readiness validator green.**
   [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
   reports `OK` on the proposed PR's branch.
5. **PR scope.** The follow-up PR contains **only** the CH-N changes
   listed in this document (no new features). Each CH-N is a separate
   commit; the PR body references the CH-N IDs in 1:1 correspondence
   with commits.

A PR that touches `contracts/CrossChainBridge.tact` without satisfying
all five conditions must be rejected by the CI guardrail in §5.

---

## 5. CI Guardrail

The CI check at
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(planned — issue #138, this PR) implements the following rules:

| Rule | Applies to | Action on violation |
|------|-----------|---------------------|
| **R-CH-1** | Any PR touching `contracts/CrossChainBridge.tact` | Verify `docs/security/audits/A2-phase4-contracts/STATUS.md` shows `verdict: READY` and `branch: <PR-base-branch>`. Fail otherwise. |
| **R-CH-2** | Any PR touching `docs/bridge/*.md` | Verify every `CH-N` reference resolves to a §3 row here. Fail on dangling refs. |
| **R-CH-3** | Any PR touching `contracts/CrossChainBridge.tact` | Verify a corresponding `CH-N` entry exists in §3 (no surprise contract changes). Fail otherwise. |
| **R-CH-4** | Release-tag workflow | Verify `RegisterNFTOwnerBridge` / `RegisterRelayer` are absent from the mainnet artefact (PP-40 / CH-7 enforcement). |
| **R-CH-5** | Any PR touching `docs/governance/PARAMETERS.md` PP-CCB-* rows | Verify the values match this document's §3 CH-5 row and [`CIRCUIT_BREAKERS.md` §4.1](./CIRCUIT_BREAKERS.md). |

The validator is the analogue of
[`scripts/governance/check-parameter-changes.ts`](../../scripts/governance/check-parameter-changes.ts)
(E2) and
[`scripts/governance/check-risk-authority.ts`](../../scripts/governance/check-risk-authority.ts)
(E3). It runs on every PR touching the bridge surface.

---

## 6. Cross-reference summary

| CH-N | Closes | Where it is referenced |
|------|--------|------------------------|
| **CH-1** | T-RP-2 | [`REPLAY_PROTECTION.md` §4.2, §8](./REPLAY_PROTECTION.md), [`MONITORING.md` §3.2](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **CH-2** | T-RP-3 / X-5 | [`REPLAY_PROTECTION.md` §4.3, §8](./REPLAY_PROTECTION.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **CH-3** | Rotation gap | [`VALIDATORS.md` §5.2](./VALIDATORS.md) |
| **CH-4** | Off-chain attestation parity | [`REPLAY_PROTECTION.md` §4.4](./REPLAY_PROTECTION.md), [`VALIDATORS.md` §4.2](./VALIDATORS.md) |
| **CH-5** | L0 daily-cap enforcement | [`CIRCUIT_BREAKERS.md` §4.3](./CIRCUIT_BREAKERS.md), [`MONITORING.md` §3.3](./MONITORING.md) |
| **CH-6** | Manual pause | [`CIRCUIT_BREAKERS.md` §5.2](./CIRCUIT_BREAKERS.md), [`VALIDATORS.md` §5.3](./VALIDATORS.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **CH-7** | PP-40 cleanup | [`docs/governance/PARAMETERS.md` §8.6](../governance/PARAMETERS.md) |

---

## 7. Acceptance criteria mapping (Issue #138 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §2, §4 — gates every CH-N on `verdict: READY`. |
| AC-4 | Replay protection verified by auditor | CH-1 + CH-2 + CH-4 close the on-chain side of the model in [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md). |
| AC-5 | Bridge circuit breakers operational | CH-5 + CH-6 close the L0 layer in [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md). |
| AC-3 | Bridge validator set architecture documented | CH-3 closes the operational gap noted in [`VALIDATORS.md` §5.2](./VALIDATORS.md). |
| (cross) | PP-40 cleanup | CH-7 removes test-only handlers per [`PARAMETERS.md` §8.6](../governance/PARAMETERS.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Supported chains       | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| Validators             | [`VALIDATORS.md`](./VALIDATORS.md) |
| Replay protection      | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Circuit breakers       | [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Parameter inventory    | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) |
| CI validator (planned) | [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts) |
| Pattern: E2 validator  | [`scripts/governance/check-parameter-changes.ts`](../../scripts/governance/check-parameter-changes.ts) |
| Pattern: E3 validator  | [`scripts/governance/check-risk-authority.ts`](../../scripts/governance/check-risk-authority.ts) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
