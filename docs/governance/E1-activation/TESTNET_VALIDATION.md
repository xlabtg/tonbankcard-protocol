# E1 — Testnet Round-Trip Validation Plan

**Engagement:** [E1](./ENGAGEMENT.md)
**Issue:** [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132) (acceptance row 4)
**Status:** Plan frozen — executed once B1 testnet manifest contains the governance group
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Purpose.** Demonstrate, on **TON testnet**, that the governance round-trip (propose → snapshot → vote → finalise → mirror) works end-to-end against the actual contracts. The round-trip is gate G-5 of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4 and acceptance row 4 of issue #132 §8.

---

## 1. Scope

- Contracts: `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` on TON **testnet** (addresses from the B1 manifest).
- Test actors: maintainer multi-sig (deployer), 3 holder wallets (HW-1, HW-2, HW-3), indexer.
- Test proposal: `E1-PROP-000-testnet` (numbered `000` to distinguish from the mainnet `E1-PROP-001`).
- Network: TON testnet only — no mainnet writes are issued in this validation plan.

Out of scope:

- Holder count beyond 3 — testnet does not have 222 real TBC Diamonds holders; the round-trip exercises the **mechanics**, not real participation.
- Stress/fuzz testing — covered by D1 (`tests/`).
- Real economic incentives — testnet TBC and NFTs are valueless.

---

## 2. Pre-requisites

| # | Pre-requisite | Source |
|---|---------------|--------|
| 2.1 | B1 testnet manifest exists and lists `ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry` addresses | [`../../deployments/B1-testnet/STATUS.md`](../../deployments/B1-testnet/STATUS.md) §7/§8 |
| 2.2 | Three testnet holder wallets hold testnet TBC Diamonds NFTs (mock collection on testnet) | Manual provisioning |
| 2.3 | Indexer staging environment connected to testnet | `backend/indexer/.env.testnet` |
| 2.4 | `PARAMETERS.md` parameter table matches contract constants | `scripts/governance/verify-parameters.ts` |
| 2.5 | Cool-down policy understood by all test actors (no maintainer commits during voting window that reference `E1-PROP-000-testnet`) | Operator briefing |

---

## 3. Round-trip procedure

Each step records actor, expected event, and pass/fail criteria. The full report is written to `audit/governance-snapshots/E1-PROP-000-testnet.json`.

### Step 1 — Bind `SnapshotVerifier` to `ProposalRegistry`

| Field | Value |
|-------|-------|
| Actor | Maintainer multi-sig |
| Action | Send typed `SetProposalRegistry { registry: <testnet ProposalRegistry> }` to testnet `SnapshotVerifier` |
| Expected | `getProposalRegistry()` returns the testnet `ProposalRegistry` address |
| Pass | RPC read confirms binding |
| Fail | Engagement re-cycles |

### Step 2 — Draft proposal & cool-down

| Field | Value |
|-------|-------|
| Actor | Operator |
| Action | Publish `E1-PROP-000-testnet` draft on a private GitHub Discussions thread |
| Expected | `T₀` timestamp recorded |
| Pass | 24-hour cool-down elapsed without modifications |

### Step 3 — Snapshot block selection

| Field | Value |
|-------|-------|
| Actor | Operator + indexer |
| Action | Per [`../SNAPSHOT.md`](../SNAPSHOT.md) §3.2, pick first master-chain block with `gen_utime ≥ T₀ + 24h` |
| Expected | `(snapshot_seqno, root_hash, gen_utime)` recorded |
| Pass | Indexer attestation matches operator-recorded values |

### Step 4 — Eligibility map

| Field | Value |
|-------|-------|
| Actor | Indexer |
| Action | Build eligibility map per [`../SNAPSHOT.md`](../SNAPSHOT.md) §4 |
| Expected | Map covers `[1, N_testnet]` where `N_testnet` is the testnet collection supply (typically 3) |
| Pass | `eligibility_root` published; reproducible from `snapshot_seqno` |

### Step 5 — `RegisterSnapshot`

| Field | Value |
|-------|-------|
| Actor | Maintainer multi-sig |
| Action | Send `SnapshotVerifier.RegisterSnapshot{proposal_id=<next>, timestamp=gen_utime, eligible_nfts=<map>}` |
| Expected | `SnapshotRegistered` event emitted |
| Pass | `hasSnapshot(proposal_id) == true` AND `getEligibleCount(proposal_id)` equals testnet supply |
| Fail | Indexer reports CRITICAL — restart at Step 3 |

### Step 6 — `SubmitProposal`

| Field | Value |
|-------|-------|
| Actor | Maintainer multi-sig (via NFT-holder HW-1 wallet for authorship) |
| Action | Send `ProposalRegistry.SubmitProposal{metadata_hash, author_nft_id=HW-1's NFT, category=0, voting_duration=604800, quorum_threshold=23 or testnet-supply, whichever is lower}` |
| Expected | `ProposalSubmitted` event emitted; `getProposalCount()` increments |
| Pass | On-chain proposal matches the IPFS-pinned metadata (hash equality) |
| Fail | Engagement restarts at Step 2 |

> The testnet round-trip uses `min(23, testnet_supply)` for quorum so the round-trip can actually finalise as `ACCEPTED`. Mainnet `E1-PROP-001` uses the full `23`.

### Step 7 — Cast votes (≥ quorum)

| Field | Value |
|-------|-------|
| Actor | HW-1, HW-2, HW-3 |
| Action | Each sends `ProposalRegistry.CastVote{proposal_id, voter_nft_id, vote}` |
| Expected | Three `VoteCast` events; **no** `voter_nft_id` appears in event payload |
| Pass | `hasVoted(proposal_id, nft_id) == true` for each holder; second cast from the same NFT is rejected with `"Already voted"` |
| Fail | Investigate ownership reads; restart at Step 7 |

Vote distribution for the canonical test run: **FOR×3**. Variant runs include `FOR×2, AGAINST×1` and `AGAINST×2, ABSTAIN×1` to exercise all three terminal statuses.

### Step 8 — Wait for `voting_end`

Wait until `now() > voting_end`. On testnet this is a 7-day window. The plan tolerates a compressed window via a separate testnet build with `DEFAULT_VOTING_DURATION = 600` (10 minutes) — that build is **NOT** the production binary; the production round-trip uses the real 7-day window. Both builds are run; only the 7-day result counts for gate G-5.

### Step 9 — `FinalizeProposal`

| Field | Value |
|-------|-------|
| Actor | Any wallet |
| Action | Send `ProposalRegistry.FinalizeProposal{proposal_id}` |
| Expected | `ProposalFinalized` event with final status |
| Pass | `getProposalStatus(proposal_id)` returns the matching terminal value (`1=ACCEPTED`, `2=REJECTED`, `3=NO_QUORUM`) |
| Fail | Investigate; restart at Step 9 |

### Step 10 — `TransparencyRegistry` mirror

| Field | Value |
|-------|-------|
| Actor | Indexer |
| Action | Mirror all four event types into the testnet `TransparencyRegistry` |
| Expected | Mirror count matches origin event count |
| Pass | Audit script confirms 1:1 mirroring |
| Fail | Investigate indexer pipeline; do not proceed to mainnet |

### Step 11 — Audit script

```sh
npx ts-node scripts/governance/audit-snapshot.ts <proposal_id> --network testnet \
  --report audit/governance-snapshots/E1-PROP-000-testnet.json
```

The script enforces every check from [`../SNAPSHOT.md`](../SNAPSHOT.md) §6.3 and writes the JSON report.

### Step 12 — Privacy assertions

| Assertion | Method | Expected |
|-----------|--------|----------|
| `VoteCast` events never include `voter_nft_id` | Event-payload diff | Always true |
| Indexer-mirrored events never include voter wallet addresses | DB schema audit | Schema lacks the column |
| Vote timestamps are not exposed per voter | Read events | Aggregate counts only |

A failing assertion is CRITICAL — privacy is non-negotiable.

---

## 4. Results table (populated when executed)

| Step | Tx hash | Event | Pass/Fail | Notes |
|------|---------|-------|-----------|-------|
| 1 | TBD | `getProposalRegistry == registry` | TBD | — |
| 2 | n/a | Draft URL TBD | TBD | — |
| 3 | n/a | Snapshot block TBD | TBD | — |
| 4 | n/a | Eligibility root TBD | TBD | — |
| 5 | TBD | `SnapshotRegistered` | TBD | — |
| 6 | TBD | `ProposalSubmitted` | TBD | — |
| 7a | TBD | `VoteCast` (HW-1) | TBD | — |
| 7b | TBD | `VoteCast` (HW-2) | TBD | — |
| 7c | TBD | `VoteCast` (HW-3) | TBD | — |
| 7d | TBD | Replay of 7a rejected (`Already voted`) | TBD | — |
| 8 | n/a | `voting_end` reached | TBD | Real 7-day run |
| 9 | TBD | `ProposalFinalized` | TBD | — |
| 10 | TBD | Mirror count match | TBD | — |
| 11 | n/a | Audit report path TBD | TBD | — |
| 12 | n/a | Privacy assertions | TBD | — |

Final verdict: `PASS` / `FAIL`. Only `PASS` flips gate G-5 to ✅.

---

## 5. Pass criteria summary

The round-trip is `PASS` iff **all** of the following:

- All 12 steps record a passing tx or assertion.
- No `voter_nft_id` appears in any `VoteCast` payload.
- Indexer mirror count equals the origin event count exactly.
- Audit script exits with code 0.
- The chosen `quorum_threshold` was satisfied (or deliberately not satisfied, for the `NO_QUORUM` variant).
- No CRITICAL alert from B3 staging during the run.

---

## 6. References

- [`ENGAGEMENT.md`](./ENGAGEMENT.md)
- [`RUNBOOK.md`](./RUNBOOK.md)
- [`../PARAMETERS.md`](../PARAMETERS.md)
- [`../SNAPSHOT.md`](../SNAPSHOT.md)
- [`../../deployments/B1-testnet/STATUS.md`](../../deployments/B1-testnet/STATUS.md)
- [`../../production/B3-monitoring/ALERT_RULES.md`](../../production/B3-monitoring/ALERT_RULES.md)
- `contracts/governance/ProposalRegistry.tact`
- `contracts/governance/SnapshotVerifier.tact`
- `contracts/governance/TransparencyRegistry.tact`
