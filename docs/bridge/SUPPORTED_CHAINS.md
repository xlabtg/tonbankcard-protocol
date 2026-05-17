# Cross-Chain Bridge — Supported Chain Registry

**Document Type:** Bridge Production Readiness Artifact
**Issue Reference:** [#138 — F3 Cross-Chain Bridge Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the canonical registry of chains that the
[`CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact)
coordination contract recognises. It is referenced by:

- The contract's `CHAIN_*` constants (PP-27 in
  [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) §8.4).
- The off-chain bridge adapter
  ([`backend/adapters/bridge.ts`](../../backend/adapters/bridge.ts)),
  which maps each chain to its external-provider ticker/network.
- The CI validator
  [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts),
  which refuses to publish a bridge deployment manifest whose chain
  set drifts from this file.
- The bug-bounty program brief
  ([`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)) §3.1.

Any change to §3 or §4 is a **Governance-controlled** parameter change
under [PARAMETERS.md §10](../governance/PARAMETERS.md) and follows the
[PARAMETER_CHANGES.md](../governance/PARAMETER_CHANGES.md) template.

---

## 2. Acceptance criterion this artifact satisfies

Issue #138 §8 — _"Supported chain list documented in
`docs/bridge/SUPPORTED_CHAINS.md`"_ (**AC-2**).

---

## 3. Initial Chain Set (v1)

The initial v1 chain set is the smallest viable set required by
[#138 §5.1](https://github.com/xlabtg/tonbankcard-protocol/issues/138)
(_"Bridge supports at least Ethereum and one other EVM chain"_).
EVM-priority chains are listed first because they share the same
EVM-side bridge-contract codebase (out of scope per #138 §4).

| # | Chain         | Native ID | Contract constant   | Adapter ticker | Adapter network | Priority   | Stage    |
|---|---------------|-----------|---------------------|---------------|-----------------|------------|----------|
| 1 | **Ethereum**  | `1`       | `CHAIN_ETHEREUM=1`  | `eth`         | `eth`           | 🔴 P0      | v1 launch |
| 2 | **BSC**       | `56`      | `CHAIN_BSC=3`       | `bnb`         | `bsc`           | 🔴 P0      | v1 launch |
| 3 | **Polygon**   | `137`     | `CHAIN_POLYGON=4`   | `matic`       | `matic`         | 🔴 P0      | v1 launch |
| 4 | **Bitcoin**   | n/a       | `CHAIN_BITCOIN=2`   | `btc`         | `btc`           | 🟠 P1      | v1 launch (external swap only — no native bridge contract)         |
| 5 | **Solana**    | n/a       | `CHAIN_SOLANA=5`    | `sol`         | `sol`           | 🟢 P2      | v1 launch (external swap only — no native bridge contract)         |

The contract's `MAX_SUPPORTED_CHAIN = 5` constant ensures
`RegisterBridgeIntent` rejects any `target_chain` outside `[1, 5]`
([`CrossChainBridge.tact` lines 168–171](../../contracts/CrossChainBridge.tact)).

### 3.1 Why these chains

| Chain    | Reason for v1 inclusion |
|----------|-------------------------|
| Ethereum | Largest stable-coin TVL, mandatory per [#138 §5.1](https://github.com/xlabtg/tonbankcard-protocol/issues/138). |
| BSC      | Most cost-effective EVM target for sub-$50 bridge transfers (typical merchant size). |
| Polygon  | High-throughput EVM target with stable bridges to Ethereum. |
| Bitcoin  | Demanded by the existing ChangeNOW adapter user base; routed through external swap only (no contract). |
| Solana   | Demanded for sub-cent on-chain fees; routed through external swap only (no contract). |

### 3.2 Chain IDs

The contract uses **protocol-internal** chain identifiers (1–5), not
EIP-155 / SLIP-44 IDs. Native IDs are recorded in the table above for
reference only — the indexer is responsible for translating between
the protocol-internal ID and the native ID when constructing payloads
for an external EVM bridge.

This indirection is intentional: it isolates the on-chain code from
EIP-155 chain-ID changes (e.g. Polygon's pending re-numbering) and
keeps the `CHAIN_*` enum stable across the audit baseline.

---

## 4. Per-Chain Limits

The contract treats `amount` as **informational** (see contract
header lines 13–22 — _"Protocol records bridge events for
auditability; NO automatic fund movement across chains"_). Limits in
this section therefore apply at three layers:

1. **Contract layer** — `RegisterBridgeIntent.amount` validation
   (positive, ≤ per-chain cap) and the on-chain daily-outflow counter
   described in [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) §3.
2. **Adapter layer** — `CrossChainBridgeAdapter.createBridgeIntent`
   refuses intents above the per-chain cap before they reach the
   contract.
3. **Operational layer** — Per-chain alert thresholds in
   [`MONITORING.md`](./MONITORING.md) §3 — every breach pages the
   bridge on-call within ≤5 minutes.

### 4.1 Initial per-chain TVL caps

The launch caps are intentionally **conservative** per issue #138 §7
(_"Circuit breaker auto-pause threshold must be conservative initially
(e.g., 1% of TVL per day)"_). Caps are denominated in TBC because TBC
is the unit the contract accepts in the `amount` field.

| Chain     | Per-tx max | Per-NFT 24 h | Per-chain 24 h outflow | Per-chain total locked (advisory) |
|-----------|-----------:|-------------:|-----------------------:|----------------------------------:|
| Ethereum  | 10,000 TBC | 25,000 TBC   | 100,000 TBC            | 1,000,000 TBC                     |
| BSC       | 10,000 TBC | 25,000 TBC   | 100,000 TBC            | 500,000 TBC                       |
| Polygon   | 10,000 TBC | 25,000 TBC   | 100,000 TBC            | 500,000 TBC                       |
| Bitcoin   | 5,000 TBC  | 10,000 TBC   | 25,000 TBC             | 100,000 TBC                       |
| Solana    | 5,000 TBC  | 10,000 TBC   | 25,000 TBC             | 100,000 TBC                       |

These figures map to **PP-CCB-1 … PP-CCB-5** in
[`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) §4, and are
governance-controlled (class **G**) — changes follow the
[PARAMETER_CHANGES.md](../governance/PARAMETER_CHANGES.md) template
and require a 44-NFT quorum + 48 h cooldown.

The "Per-chain total locked (advisory)" column is **off-chain** — the
contract is non-custodial and does not actually lock funds. The
advisory cap is enforced by the off-chain adapter, which refuses to
quote intents that would push the chain over the cap, and by the
monitoring layer ([MONITORING.md §3.3](./MONITORING.md)).

### 4.2 Why 1% / 10% / 25% bands

| Band                  | Rationale |
|-----------------------|-----------|
| Per-tx ≤ 1% of total  | Limits the blast radius of a single mistake to ≤1% of locked TVL on the chain. |
| Per-NFT 24 h ≤ 2.5%   | Allows a determined power user (e.g. a merchant) to bridge their account in 2 days; any faster is anomalous. |
| Per-chain 24 h ≤ 10%  | Issue #138 §7 names 1%/day as the **floor**; 10%/day is the **ceiling** for the v1 chain set (auto-pause triggers above this). |

---

## 5. Chain Addition / Removal Procedure

### 5.1 Adding a chain (G-class change)

A new chain MUST satisfy **every** condition below before a governance
proposal is accepted:

1. **Audit gate** — A2 verdict for the chain's bridge code is
   `READY` (or the chain is no-contract-only, in which case A2 is
   skipped and a [security review of the external adapter](../security/audits/A4-offchain-services/ENGAGEMENT.md)
   is attached instead).
2. **EVM-side audit** — If the chain has a project-deployed EVM-side
   bridge contract (out of scope per #138 §4), that contract has an
   independent audit report attached to the proposal.
3. **Reorg model** — A documented finality assumption (e.g. "L2 with
   7-day finality window", "PoS L1 with 64-block finality") in the
   proposal body, referenced from
   [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) §5.
4. **Adapter mapping** — `CrossChainBridgeAdapter`'s
   `CHAIN_TICKERS` and `CHAIN_NETWORKS` tables in
   [`backend/adapters/bridge.ts`](../../backend/adapters/bridge.ts)
   updated in the same PR.
5. **Per-chain caps** — A row added to §4.1 (initial caps must be at
   most the v1 per-chain figures).
6. **Validator support** — The bridge validator set
   ([`VALIDATORS.md`](./VALIDATORS.md) §4) confirms quorum capacity
   to sign messages on the new chain (key material, RPC access).
7. **Monitoring** — A new row in
   [`MONITORING.md`](./MONITORING.md) §3.1 + alert routing in
   [`B3 — monitoring engagement`](../security/audits/A4-offchain-services/ENGAGEMENT.md)
   (or successor monitoring engagement) for the new chain.

### 5.2 Removing a chain (T-class change)

Removing a chain triggers a forced unwind of all outstanding intents
targeting it. The proposal MUST include:

1. A 7-day **deprecation notice** posted to the protocol blog, the
   transparency registry, and the bug-bounty platform.
2. A **drain plan** — every `PENDING` intent for the chain is either
   confirmed (relayer reports external tx hash) or cancelled
   (NFT owner action) before the removal.
3. **Adapter back-compat** — the adapter continues to *quote* the
   chain for the deprecation window so existing flows complete; new
   intents are refused immediately on proposal acceptance.

### 5.3 Emergency removal

If a chain suffers an active reorg / bridge compromise:

1. **Pause** — Bridge maintainer invokes `PauseBridge` on the
   contract (see [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) §5).
   This freezes *all* chains, not just the affected one — by design,
   per the threat model ([`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md)
   §4.4.4).
2. **Incident response** — Follow
   [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md).
3. **Per-chain disable** — Governance proposal (T-class, 24 h
   cooldown) flips the chain's `enabled` flag in the adapter without
   touching contract code.

---

## 6. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source | [`contracts/CrossChainBridge.tact`](../../contracts/CrossChainBridge.tact) |
| Adapter source  | [`backend/adapters/bridge.ts`](../../backend/adapters/bridge.ts) |
| Validator config | [`VALIDATORS.md`](./VALIDATORS.md) |
| Replay protection | [`REPLAY_PROTECTION.md`](./REPLAY_PROTECTION.md) |
| Circuit breakers | [`CIRCUIT_BREAKERS.md`](./CIRCUIT_BREAKERS.md) |
| Monitoring | [`MONITORING.md`](./MONITORING.md) |
| Bug bounty | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Threat model | [`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md) §4.4.4 |
| A2 engagement | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) §4.1 |
| Parameter inventory | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) PP-27, PP-28 |

---

## 7. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #138 (F3). |
