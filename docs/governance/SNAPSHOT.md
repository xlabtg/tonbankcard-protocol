# Voter Snapshot Methodology

**Engagement:** [E1 — DAO Governance Activation](./E1-activation/ENGAGEMENT.md)
**Issue:** [#132 — DAO Governance Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
**Status:** Proposed — pending ratification by `E1-PROP-001`
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **TL;DR.** Voter eligibility is **NFT-only** (TBC Diamonds, 222 NFTs, 1 NFT = 1 vote). Eligibility is fixed at a **snapshot block selected before the proposal is submitted**. The snapshot is produced by the indexer, recorded on-chain via `SnapshotVerifier.RegisterSnapshot`, and is the **single source of truth** for which NFT IDs may cast a vote on a given proposal.

---

## 1. Purpose

This document defines the **voter snapshot methodology** for the TONBANKCARD DAO governance:

- Who is eligible to vote.
- How the snapshot block is selected.
- How NFT ownership is read at that block.
- How the resulting eligibility list is verified on-chain via `SnapshotVerifier.tact`.
- How the snapshot is published, audited, and disputed.

It is referenced by [`PARAMETERS.md`](./PARAMETERS.md) (parameter P-7), by `contracts/governance/SnapshotVerifier.tact`, and by the indexer specification in `backend/indexer/`. The methodology is ratified by the first governance proposal `E1-PROP-001` ([`E1-activation/ACTIVATION_PROPOSAL.md`](./E1-activation/ACTIVATION_PROPOSAL.md)).

---

## 2. Voter eligibility

### 2.1 Eligible asset

| Property | Value |
|----------|-------|
| Eligible asset | TBC Diamonds NFT collection |
| Total supply | 222 (fixed, immutable) |
| Voting power per NFT | 1 vote |
| Delegation | **Not supported** in the initial activation cycle |
| Fractionalisation | Prohibited (would invalidate the 1-NFT-1-vote invariant) |
| TBC token weighting | **Not used** (would re-introduce custody surface) |
| External voting power (LP shares, jetton wrappers, bridged copies) | **Not counted** |

Issue #132 §3 ("Voter Snapshot Methodology") allows "NFT-weighted or TBC-weighted (or both)". The initial activation cycle deliberately chooses **NFT-only** because:

- It matches the contract source (`DIAMONDS_TOTAL_SUPPLY = 222`).
- TBC weighting would require an additional snapshot of jetton wallet balances, including jetton wallets held by DEX pools (TONCO), bridges, and unknown custodial services. Each is an attack surface for last-minute vote-buying.
- The TBC Diamonds collection is the documented "governance asset" in `docs/dao-governance.md` §"TBC Diamonds NFT Collection".

A future governance proposal may extend eligibility to TBC token holders. Until then, **TBC token holdings do not confer voting power**.

### 2.2 Owner resolution

For each NFT ID `i` in `[1, 222]`, the indexer resolves the owner at the snapshot block via the standard TEP-62 `get_nft_data()` call against the TBC Diamonds collection at `EQ…` (canonical address pinned in [`docs/existing-contracts.md`](../existing-contracts.md)):

```
(init?, index, collection_address, owner_address, individual_content)
    = nft_item.get_nft_data();

ELIGIBLE(i)  ⇔  init? == -1                                    // NFT minted
              ∧ collection_address == TBC_DIAMONDS_COLLECTION   // not spoofed
              ∧ owner_address != null                           // has owner
              ∧ owner_address ∉ EXCLUDED_ADDRESSES              // see §2.3
```

Ownership reads use a single archive-node query at the chosen snapshot block. The indexer does **not** trust mempool or pending transactions — only states finalised in the snapshot block or earlier.

### 2.3 Excluded addresses

The following classes of owners are recorded but **not eligible** to vote:

| Class | Reason | How identified |
|-------|--------|----------------|
| Burn address (`null` / `Eq…burn`) | Cannot sign | Hard-coded list in indexer |
| Collection contract itself | Pre-mint or recovery | Owner equals collection address |
| Known custodial DEX wallets (TONCO LP) | Holder is a pool, not a person | Address list in [`docs/governance-transparency-verification.md`](../governance-transparency-verification.md) |
| NFTs whose `init?` is `false` | Not yet minted | Standard TEP-62 flag |

Excluded NFT IDs **must still appear** in the snapshot output (with `eligible = false`) so that auditors can verify the exclusion list is exhaustive and not silently dropped.

---

## 3. Snapshot block selection

### 3.1 Hard rules (P-7 from `PARAMETERS.md`)

1. The snapshot block **MUST** be selected **before** the proposal is broadcast as `SubmitProposal`. A snapshot that post-dates `voting_start` is invalid and the proposal is rejected by the runbook.
2. The snapshot block **MUST** be at least `min_age_blocks` old at selection time to allow for re-org finality. Initial value: **128 master-chain blocks** (~10 minutes), matching the conservative finality threshold used by the indexer (`backend/indexer/src/reorg.ts`).
3. The snapshot block **MUST** be published in the proposal metadata before `SubmitProposal` is broadcast (see §5).
4. The snapshot block **MUST NOT** be re-used between proposals — every proposal has its own snapshot. Re-using a snapshot would entrench whoever holds NFTs at the re-used block.

### 3.2 Block-selection procedure

The proposal author selects the snapshot block using the following deterministic procedure:

1. **Anchor.** The author publishes the proposal draft on GitHub Discussions, the canonical "Phase 1" venue from `docs/governance-process.md`.
2. **Cool-down.** A 24-hour cool-down begins from the timestamp of the draft post. During this window the author may revise the draft text; the snapshot block is **not yet chosen**.
3. **Block pin.** At cool-down end, the author records the **first master-chain block whose `gen_utime` is ≥ `draft_timestamp + 24h`**. The author publishes:
   - The block sequence number (`seqno`).
   - The block hash (`root_hash`).
   - The `gen_utime` of that block.
4. **Indexer attestation.** The maintainer team's archive indexer independently re-derives the same block from the published `draft_timestamp`. A divergence aborts the proposal and the author restarts at step 1.
5. **On-chain submission.** The author triggers `SnapshotVerifier.RegisterSnapshot` with the eligibility map derived in §4. **Only after** `SnapshotRegistered` is observed may the author broadcast `ProposalRegistry.SubmitProposal`.

The 24-hour cool-down defeats the "submit-then-buy" attack from issue #132 §7: a buyer who acquires NFTs **after** the snapshot block cannot vote on the open proposal.

### 3.3 Re-org handling

If the chosen block is re-orged out (`root_hash` no longer matches the master chain at `seqno`), the entire proposal is aborted and the author restarts at §3.2 step 1. The contract intentionally has **no rollback path** because re-using a stale snapshot would silently corrupt eligibility.

---

## 4. Building the eligibility list

The indexer reproduces the following deterministic pseudocode against the snapshot block:

```ts
function buildEligibility(snapshotBlock: BlockId): EligibilityMap {
  const map: Record<number, boolean> = {};
  for (let i = 1; i <= DIAMONDS_TOTAL_SUPPLY; i++) {
    const itemAddr = computeNftItemAddress(TBC_DIAMONDS_COLLECTION, i);
    const data     = getNftDataAt(itemAddr, snapshotBlock);

    map[i] =
      data.init === true                                   &&
      addrEq(data.collectionAddress, TBC_DIAMONDS_COLLECTION) &&
      data.ownerAddress != null                            &&
      !EXCLUDED_ADDRESSES.has(canon(data.ownerAddress));
  }
  return map;
}
```

Determinism rules:

- **Order-independent.** The map keys are sorted before serialisation; two indexers building the same snapshot block produce byte-identical output.
- **Stateless.** No memoisation, no caches, no off-chain side-state.
- **Replayable.** Anyone with archive access to the snapshot block can recompute the map and compare against the on-chain `eligibility` slot.

The serialised map is hashed with SHA-256 and recorded in the proposal metadata (`eligibility_root`). The on-chain `SnapshotVerifier.eligibility` storage is the binding record; the off-chain hash is a convenience for indexers.

### 4.1 Mapping to `SnapshotVerifier.RegisterSnapshot`

The indexer constructs the `RegisterSnapshot` message as:

```
RegisterSnapshot {
  proposal_id   = next_proposal_id_from_ProposalRegistry,
  timestamp     = gen_utime_of_snapshot_block,
  eligible_nfts = { i => true | i ∈ [1,222] ∧ eligibility(i) = true }
}
```

The contract iterates `nft_id ∈ [1, 222]` and stores `eligibility[proposal_id * 1000 + nft_id] = true` for every eligible NFT. Non-eligible NFT IDs are intentionally **absent** from `eligible_nfts` — the contract's `isEligible` method returns `false` for missing keys.

> **Important.** `SnapshotVerifier.isEligible` has a fallback branch that returns `true` for every NFT in `[1, 222]` **when no snapshot has been registered** (`hasSnapshot == false`). The runbook treats this as a defect-class invariant: **`hasSnapshot(proposal_id)` MUST be `true` before `ProposalRegistry.SubmitProposal` is broadcast**. The on-chain order is enforced by the deployment runbook ([`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §5) and re-checked by the indexer before counting any vote.

---

## 5. Proposal metadata fields produced by the snapshot

Each proposal's off-chain metadata (the IPFS / GitHub artefact whose SHA-256 is `metadata_hash` in `ProposalRegistry.tact`) **MUST** include the following snapshot block:

| Field | Type | Source |
|-------|------|--------|
| `snapshot_seqno` | uint | `seqno` of the master-chain block (§3.2 step 3) |
| `snapshot_root_hash` | hex | `root_hash` of the master-chain block |
| `snapshot_gen_utime` | unix-seconds | `gen_utime` of the master-chain block |
| `snapshot_indexer_attestation` | sig | Maintainer indexer signature over `(seqno, root_hash, gen_utime)` |
| `eligibility_root` | sha-256 | Hash of the serialised eligibility map (§4) |
| `eligible_count` | uint | Cardinality of the eligibility map (must equal the value returned by `SnapshotVerifier.getEligibleCount`) |
| `excluded_addresses_version` | semver | Version tag of the `EXCLUDED_ADDRESSES` list at snapshot time |

A proposal whose metadata is missing any of these fields **MUST NOT** be submitted on-chain. The runbook treats a missing field as a P-7 violation and aborts.

---

## 6. Transparency & audit

### 6.1 What is published

| Artefact | Where |
|----------|-------|
| Proposal metadata (with snapshot block) | GitHub Discussions thread + IPFS pin (CID stored as `metadata_hash`) |
| On-chain snapshot record | `SnapshotVerifier.snapshots[proposal_id]` |
| On-chain eligibility map | `SnapshotVerifier.eligibility[proposal_id * 1000 + nft_id]` |
| Indexer-mirrored event | `SnapshotRegistered` event → `TransparencyRegistry` event mirror |
| Audit script output | `scripts/governance/audit-snapshot.ts <proposal_id>` writes a JSON report under `audit/governance-snapshots/<proposal_id>.json` |

### 6.2 What is **not** published

- The wallet addresses of NFT owners — only NFT IDs.
- The timestamps of individual votes.
- Off-chain communications between holders.

These are enforced by `docs/governance-transparency-privacy.md` and by the deliberate omission of `voter_nft_id` from `VoteCast` events (see [`PARAMETERS.md`](./PARAMETERS.md) §3 P-11).

### 6.3 Audit script

`scripts/governance/audit-snapshot.ts` re-runs §4 against the on-chain snapshot. For every proposal it:

1. Re-derives the eligibility map from `snapshot_seqno`.
2. Compares each NFT ID against `SnapshotVerifier.isEligible(proposal_id, nft_id)`.
3. Compares the cardinality against `SnapshotVerifier.getEligibleCount(proposal_id)`.
4. Asserts `now_at_register < proposal.voting_start`.
5. Asserts `proposal.metadata_hash` matches the published metadata.

Any mismatch is reported with severity `CRITICAL` and the proposal is treated as invalid until reconciled.

### 6.4 Dispute path

Holders who believe the snapshot is incorrect open a GitHub issue tagged `governance:snapshot-dispute` within the voting window. The maintainer team reproduces §4 against the published `snapshot_seqno`. If a divergence is confirmed, the proposal is finalised as `NO_QUORUM` (the registry has no rollback primitive — `NO_QUORUM` is the closest neutral outcome) and the author restarts at §3.

---

## 7. Worked example (testnet round-trip)

The example below mirrors the round-trip executed in [`E1-activation/TESTNET_VALIDATION.md`](./E1-activation/TESTNET_VALIDATION.md). All values are placeholders until the testnet ceremony runs.

| Step | Actor | Action |
|------|-------|--------|
| 1 | Author (`@konard`) | Publishes draft `E1-PROP-001` to GitHub Discussions at `T₀`. |
| 2 | — | 24-hour cool-down. |
| 3 | Author | At `T₀ + 24h` picks the first master-chain block with `gen_utime ≥ T₀ + 24h`. Records `snapshot_seqno`, `root_hash`, `gen_utime`. |
| 4 | Indexer | Independently derives the same `(seqno, root_hash)`. Publishes attestation. |
| 5 | Indexer | Builds eligibility map per §4. Computes `eligibility_root`. |
| 6 | Author | Pushes proposal metadata to IPFS, records the CID. |
| 7 | Maintainer | Sends `SnapshotVerifier.RegisterSnapshot{proposal_id=1, timestamp=gen_utime, eligible_nfts}`. Awaits `SnapshotRegistered` event. |
| 8 | Maintainer | Sends `ProposalRegistry.SubmitProposal{metadata_hash=sha256(metadata), author_nft_id, category=0, voting_duration=604800, quorum_threshold=22}`. Awaits `ProposalSubmitted` event. |
| 9 | Holders | Cast votes during the 7-day window. |
| 10 | Anyone | After `voting_end`, invokes `ProposalRegistry.FinalizeProposal{proposal_id=1}`. |
| 11 | Indexer | Mirrors `ProposalFinalized` to `TransparencyRegistry`. |
| 12 | Maintainer | Runs `scripts/governance/audit-snapshot.ts 1`. Records report. |

A successful run of steps 1–12 against TON testnet is one of the acceptance gates of [`E1-activation/STATUS.md`](./E1-activation/STATUS.md) (gate G-7).

---

## 8. Failure modes & mitigations

| Failure | Symptom | Mitigation |
|---------|---------|------------|
| Snapshot block re-org | `root_hash` mismatch on indexer re-derivation | Abort, re-start at §3.2 step 1 |
| Indexer divergence (two indexers, two maps) | Different `eligibility_root` for the same `snapshot_seqno` | Hold-fast: do not submit `SubmitProposal`; investigate canonical address & exclusion list versions |
| `SubmitProposal` before `RegisterSnapshot` | `SnapshotVerifier.isEligible` falls back to "all NFTs eligible" | Forbidden by runbook §5; CI rejects ordering at PR-review time |
| Excluded-list drift between proposals | Same address eligible in proposal N, excluded in proposal N+1 | `excluded_addresses_version` published per proposal; governance proposal required to change the list |
| Vote buying after snapshot | Buyer cannot vote — eligibility is fixed at `snapshot_seqno` | By design (see §3.1) |
| NFT transferred during voting | Original owner at `snapshot_seqno` retains the vote, new owner has none | By design — `docs/governance-process.md` §"Identity Resolution" |

---

## 9. References

- [`PARAMETERS.md`](./PARAMETERS.md) — initial governance parameters (P-7 cross-reference)
- [`docs/governance-process.md`](../governance-process.md) — proposal lifecycle
- [`docs/governance-transparency.md`](../governance-transparency.md) — public transparency layer
- [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md) — privacy guarantees
- [`docs/governance-transparency-verification.md`](../governance-transparency-verification.md) — verification protocol & exclusion list
- [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) — operator runbook
- [`E1-activation/TESTNET_VALIDATION.md`](./E1-activation/TESTNET_VALIDATION.md) — testnet round-trip plan
- `contracts/governance/SnapshotVerifier.tact` — canonical snapshot record
- `contracts/governance/ProposalRegistry.tact` — references the snapshot via `voting_start`
