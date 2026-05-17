# Cross-Chain Bridge — Monitoring & Alerting

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document defines the alert catalogue, pager routing, and
operational-health checks that the cross-chain bridge production
launch requires. It is the bridge-specific addendum to the protocol
monitoring spec in
[`docs/production/MONITORING.md`](../production/MONITORING.md) and is
referenced from the B3 monitoring engagement
([`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md))
as the bridge surface's alert source.

The bridge is **non-custodial** (I1). Monitoring at the bridge layer
therefore has a narrow but load-bearing purpose: detect status
falsifications, validator misbehaviour, and target-chain anomalies
before they accumulate into a pause-worthy incident.

---

## 2. Acceptance criterion this artifact satisfies

Issue #138 §8 — _"Bridge monitoring alerts configured"_ (**AC-6**).

Also satisfies issue #138 §7.3 — _"Bridge-specific monitoring (B3
integration)"_.

---

## 3. Alert catalogue

Each alert below has a unique ID (`BR-Mxx`), a trigger condition, a
paging rule, and a cross-reference to the document where the
underlying threshold is defined (so the values in this catalogue stay
consistent with [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) and
[`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md)).

### 3.1 Per-chain volume alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M01 | Per-tx amount on chain X breaches PP-CCB-X per-tx max | P1       | Bridge on-call within 5 min     | [`CIRCUIT_BREAKERS.md` §4.1](./CIRCUIT_BREAKERS.md) |
| BR-M02 | Per-NFT 24 h volume on chain X breaches PP-CCB-X      | P2       | Bridge on-call within 15 min    | [`CIRCUIT_BREAKERS.md` §4.1](./CIRCUIT_BREAKERS.md) |
| BR-M03 | Per-chain 24 h outflow ≥ 0.5 × PP-CCB-7 cap          | P2       | Bridge on-call within 15 min    | [`CIRCUIT_BREAKERS.md` §4.1](./CIRCUIT_BREAKERS.md) |
| BR-M04 | Per-chain 24 h outflow ≥ PP-CCB-7 cap (1 % of advisory TVL/24 h) | P1 | Pager fan-out + auto-pause AP-1 fires | [`CIRCUIT_BREAKERS.md` §5.1 AP-1](./CIRCUIT_BREAKERS.md) |

The alert thresholds (50 % / 100 % of cap) follow the
[`docs/production/MONITORING.md`](../production/MONITORING.md) §4 _"two-stage"_
pattern — warn at half the cap so the on-call has time to investigate
before auto-pause arms.

### 3.2 Replay & correlation alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M05 | `external_tx_hash` appears in two distinct intent confirmations within a 1 h window | P1 | Bridge on-call + security on-call within 5 min | [`REPLAY_PROTECTION.md` §4.2](./REPLAY_PROTECTION.md) T-RP-2 |
| BR-M06 | Indexer correlation step (§6 of `REPLAY_PROTECTION.md`) rejects a confirmation | P1 | Bridge on-call within 5 min     | [`REPLAY_PROTECTION.md` §6](./REPLAY_PROTECTION.md) |
| BR-M07 | More than 3 BR-M06 events in 1 h | P0 | Pager fan-out + auto-pause AP-2 fires | [`CIRCUIT_BREAKERS.md` §5.1 AP-2](./CIRCUIT_BREAKERS.md) |
| BR-M08 | Attestation hash format on the relayer side diverges from [`REPLAY_PROTECTION.md` §4.4](./REPLAY_PROTECTION.md) canonical format | P0 | Security on-call within 5 min | [`REPLAY_PROTECTION.md` §4.4](./REPLAY_PROTECTION.md) |

Once **CH-1** ships ([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)),
BR-M05 also fires on the on-chain `external_tx_seen` reject path — the
alert is **kept** as defence-in-depth even after CH-1, because L1
detection is faster than waiting for the contract to reject.

### 3.3 Daily-outflow & circuit-breaker alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M09 | `BridgeAutoPauseTriggered` event on the indexer stream | P0       | Pager fan-out within 1 min     | [`CIRCUIT_BREAKERS.md` §5.1](./CIRCUIT_BREAKERS.md) |
| BR-M10 | `BridgePauseTriggered` event (post-CH-6) on chain stream | P0       | Pager fan-out within 1 min     | [`CIRCUIT_BREAKERS.md` §5.2](./CIRCUIT_BREAKERS.md) |
| BR-M11 | `ChainCapExceeded` event (post-CH-5) on chain stream | P1       | Bridge on-call within 5 min     | [`CONTRACT_HARDENING.md` CH-5](./CONTRACT_HARDENING.md) |
| BR-M12 | Auto-pause has been active for > 1 h with no incident report filed | P0 | Pager fan-out + security on-call | [`CIRCUIT_BREAKERS.md` §5.2](./CIRCUIT_BREAKERS.md) |

### 3.4 Validator drift & dry-run alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M13 | New validator (dry-run state) produces an attestation that diverges from the current 5-of-9 set on ≥ 1 % of a 1,000-event sample | P2 | Bridge on-call within 15 min | [`VALIDATORS.md` §5.2](./VALIDATORS.md) |
| BR-M14 | Drift on a dry-run validator exceeds 5 % over 1,000 events | P1 | Block rotation; emergency rotation procedure | [`VALIDATORS.md` §5.3](./VALIDATORS.md) |

### 3.5 Validator heartbeat alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M15 | Validator misses ≥ 3 consecutive attestation cycles  | P1       | Bridge on-call + named operator within 5 min | [`VALIDATORS.md` §5.3 trigger 1](./VALIDATORS.md) |
| BR-M16 | Active-validator count drops below 6/9               | P0       | Pager fan-out + auto-pause AP-3 fires | [`CIRCUIT_BREAKERS.md` §5.1 AP-3](./CIRCUIT_BREAKERS.md) |
| BR-M17 | A validator self-reports compromise (PGP-signed message arrives at `security@tonbankcard.com`) | P0 | Pager fan-out within 1 min | [`VALIDATORS.md` §5.3 trigger 2](./VALIDATORS.md) |

### 3.6 External provider & target-chain alerts

| ID    | Trigger                                              | Severity | Page                            | Cross-ref                                      |
|-------|------------------------------------------------------|---------:|---------------------------------|------------------------------------------------|
| BR-M18 | External provider (e.g. ChangeNOW) HTTP-5xx rate ≥ 5 % over 15 min | P1 | Bridge on-call + auto-pause AP-4 fires | [`CIRCUIT_BREAKERS.md` §5.1 AP-4](./CIRCUIT_BREAKERS.md) |
| BR-M19 | Target-chain reorg deeper than the finality threshold in [`REPLAY_PROTECTION.md` §4.5](./REPLAY_PROTECTION.md) | P0 | Pager fan-out + auto-pause AP-5 fires | [`CIRCUIT_BREAKERS.md` §5.1 AP-5](./CIRCUIT_BREAKERS.md) |
| BR-M20 | A target chain's RPC stops responding for > 5 min     | P2       | Bridge on-call within 15 min    | [`SUPPORTED_CHAINS.md` §5](./SUPPORTED_CHAINS.md) |

### 3.7 Roll-up — pager severity matrix

| Severity | Examples           | First-page SLA | Channels (per `INCIDENT_RESPONSE.md` §3) |
|----------|--------------------|----------------|------------------------------------------|
| **P0**   | BR-M07, BR-M08, BR-M09, BR-M10, BR-M12, BR-M16, BR-M17, BR-M19 | 1 min          | Bridge on-call + security on-call + bridge-admin multi-sig members |
| **P1**   | BR-M01, BR-M04, BR-M05, BR-M06, BR-M11, BR-M14, BR-M15, BR-M18 | 5 min          | Bridge on-call |
| **P2**   | BR-M02, BR-M03, BR-M13, BR-M20 | 15 min        | Bridge on-call (asynchronous channel) |

The **P0 fan-out** must be acknowledged by at least one human within
5 min; if not, the auto-pause auto-promotes (timer in [`CIRCUIT_BREAKERS.md`
§5.1](./CIRCUIT_BREAKERS.md) AP rules).

---

## 4. Data sources

Each alert above reads one or more of the data sources below. The
data-source map keeps the wiring transparent and lets the B3
engagement audit the data-flow path for each alert.

| Source ID | Description | Owner | Latency |
|-----------|-------------|-------|---------|
| **DS-1** | TON indexer stream (`backend/indexer/`) — emits `BridgeIntentRegistered` / `BridgeExecutionConfirmed` / `BridgeIntentCancelled` events | Indexer team | < 30 s from chain |
| **DS-2** | Per-target-chain RPC poller (`backend/services/bridge-chain-monitor.ts`, planned) — reads recent blocks, finality, reorg depth | Bridge team | < 60 s per chain |
| **DS-3** | Validator heartbeat feed — each validator publishes a signed heartbeat every 60 s to the relayer-service gossip layer | Validators | < 90 s |
| **DS-4** | External-provider health probe (`backend/adapters/bridge.ts` `healthCheck()`) | Adapter team | < 60 s |
| **DS-5** | `security@tonbankcard.com` PGP intake | Security team | manual |

---

## 5. Disaster-recovery drill schedule

Every validator and every alert path runs a documented drill **twice
per quarter**. Drills are recorded in
`docs/security/audits/A2-phase4-contracts/STATUS.md` §"DR drill log"
under the bridge-specific addendum.

| Drill | Frequency | Owner | Pass criteria |
|-------|-----------|-------|----------------|
| **DR-1** Validator key-loss simulation | quarterly | each validator individually | Replacement key onboarded; drift < 1 % over 1,000 events. |
| **DR-2** Indexer outage | quarterly | Indexer team | Bridge-team acknowledges within 5 min; pager fan-out completes within SLA. |
| **DR-3** Bridge pause + resume | quarterly | Bridge-admin multi-sig | Pause arms within 30 min of trigger; resume requires the incident-report flow in [`CIRCUIT_BREAKERS.md` §5.2](./CIRCUIT_BREAKERS.md). |
| **DR-4** External-provider failure | quarterly | Adapter team | Adapter degrades to maintenance mode within 1 min; users see HTTP 503 with the documented JSON body. |
| **DR-5** Target-chain reorg simulation | per-chain, biannually | Bridge team | Auto-pause AP-5 fires; per-chain disable proposed within 24 h. |

A missed drill blocks the next quarter's transparency report
([`docs/governance/TRANSPARENCY_REPORTING.md`](../governance/TRANSPARENCY_REPORTING.md)).

---

## 6. CI wiring

The alert catalogue's consistency is enforced by
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(planned, see [`CONTRACT_HARDENING.md` §5](./CONTRACT_HARDENING.md)).
Specific checks:

1. **Catalogue uniqueness.** Every `BR-Mxx` ID appears exactly once
   in §3.
2. **Cross-ref resolvability.** Every cross-ref column entry must
   resolve to a heading in the named file.
3. **Auto-pause coverage.** Every `AP-N` rule in [`CIRCUIT_BREAKERS.md`
   §5.1](./CIRCUIT_BREAKERS.md) must have at least one corresponding
   `BR-Mxx` alert that fires when AP-N triggers (BR-M09 satisfies
   this universally; per-AP refinement is the §3.3..§3.6 alerts).
4. **Threshold parity.** Numeric thresholds quoted in §3 must match
   the values in [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md)
   §4.1 and [`SUPPORTED_CHAINS.md` §4.1](./SUPPORTED_CHAINS.md).

The validator runs in the bridge-readiness CI job, gated on every PR
touching `docs/bridge/*.md`.

---

## 7. Acceptance criteria mapping (Issue #138 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-3 | Bridge validator set architecture documented | §3.4, §3.5 — alert paths for the 5-of-9 set. |
| AC-4 | Replay protection verified by auditor | §3.2 — replay alerts. |
| AC-5 | Bridge circuit breakers operational | §3.3 — circuit-breaker event alerting. |
| AC-6 | Bridge monitoring alerts configured | this document (§§3, 5, 6). |
| AC-7 | Bridge bug-bounty category active | §3.2 + §3.5 indirectly inform the bug-bounty in-scope list in [`BUG_BOUNTY.md`](./BUG_BOUNTY.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Supported chains       | [`SUPPORTED_CHAINS.md`](./SUPPORTED_CHAINS.md) |
| Validators             | [`VALIDATORS.md`](./VALIDATORS.md) |
| Replay protection      | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Circuit breakers       | [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Production monitoring  | [`docs/production/MONITORING.md`](../production/MONITORING.md) |
| Incident response      | [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) |
| B3 monitoring engagement | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
