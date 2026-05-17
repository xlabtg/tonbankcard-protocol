# Initial Governance Parameters

**Engagement:** [E1 — DAO Governance Activation](./E1-activation/ENGAGEMENT.md)
**Issue:** [#132 — DAO Governance Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
**Status:** Proposed — pending ratification by the first governance proposal (`E1-PROP-001`)
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** Governance is **non-executable** by design — see [`docs/dao-governance.md`](../dao-governance.md) and [`docs/governance-process.md`](../governance-process.md). The parameters below configure **how votes are counted**; they do not configure **how outcomes are executed**, because there is no on-chain execution engine. The term "execution delay" in this document refers exclusively to the **off-chain implementation cooldown** described in §5.

---

## 1. Purpose

This document fixes the **initial governance parameters** used by `ProposalRegistry.tact` and `SnapshotVerifier.tact` at activation time, and the **process parameters** observed off-chain by maintainers, proposal authors and indexers.

The parameters here are the values that the **first governance proposal** (`E1-PROP-001`, [`E1-activation/ACTIVATION_PROPOSAL.md`](./E1-activation/ACTIVATION_PROPOSAL.md)) asks the community to ratify. Until that proposal is `ACCEPTED`, the values are **proposed defaults** and the runbook ([`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md)) instructs the deployer to use them verbatim.

Changes to these parameters after ratification require a new governance proposal of category `ROADMAP_SIGNAL` and the contract redeployment policy in §6.

---

## 2. Parameter table (canonical values)

| # | Parameter | Value | On-chain? | Source |
|---|-----------|-------|-----------|--------|
| P-1 | **Governance asset** | TBC Diamonds NFT collection (222 NFTs, 1 NFT = 1 vote) | Yes — `ProposalRegistry.DIAMONDS_TOTAL_SUPPLY = 222` | `contracts/governance/ProposalRegistry.tact` |
| P-2 | **Voting power model** | Flat — `1 NFT = 1 vote`, no delegation, no fractionalisation | Yes — enforced by `CastVote` deduplication via `votes_cast` map | `docs/dao-governance.md` §"TBC Diamonds NFT Collection" |
| P-3 | **Voting period (duration)** | **7 days** (`604 800` seconds) | Yes — `DEFAULT_VOTING_DURATION = 604800` | `ProposalRegistry.tact` |
| P-4 | **Quorum threshold** | **22 votes** (≈ 10 % of 222) | Yes — `DEFAULT_QUORUM_THRESHOLD = 22` | `ProposalRegistry.tact` |
| P-5 | **Decision rule** | Simple majority among non-abstain votes when quorum is met | Yes — `votes_for > votes_against` after quorum check | `ProposalRegistry.tact` `FinalizeProposal` handler |
| P-6 | **Proposal threshold (submission)** | **1 TBC Diamond NFT** owned by the author at submission time | Partly — author NFT ID stored, ownership verified off-chain at the snapshot block | `ProposalRegistry.tact` `SubmitProposal` + [`SNAPSHOT.md`](./SNAPSHOT.md) §4 |
| P-7 | **Snapshot timing** | Snapshot block taken **strictly before** proposal `SubmitProposal` is broadcast; recorded by indexer | Off-chain (indexer) + on-chain `RegisterSnapshot` to `SnapshotVerifier` before `voting_start` | [`SNAPSHOT.md`](./SNAPSHOT.md) §3 |
| P-8 | **Off-chain implementation cooldown** ("execution delay") | **≥ 48 hours** between `ProposalFinalized` and any voluntary off-chain implementation step | Off-chain — see §5 | This document, §5 |
| P-9 | **Proposal categories** | Fixed enum `0 … 5` (no custom categories) | Yes — `require(category >= 0 && category <= 5)` | `ProposalRegistry.tact` |
| P-10 | **Vote options** | `FOR = 0`, `AGAINST = 1`, `ABSTAIN = 2` | Yes — `require(msg.vote == VOTE_FOR …)` | `ProposalRegistry.tact` |
| P-11 | **Vote privacy** | NFT ID is **not** emitted in the `VoteCast` event | Yes — see comment in `VoteCast` message struct | `ProposalRegistry.tact` |
| P-12 | **Finalisation actor** | Any wallet may invoke `FinalizeProposal` once `now() > voting_end`; finalisation is permissionless | Yes | `ProposalRegistry.tact` `FinalizeProposal` handler |
| P-13 | **Transparency logging** | All `ProposalSubmitted`, `VoteCast`, `ProposalFinalized` events mirrored to `TransparencyRegistry.tact` via the indexer | On-chain (events) + off-chain (mirroring) | [`SNAPSHOT.md`](./SNAPSHOT.md) §6, `contracts/governance/TransparencyRegistry.tact` |

> Values P-3 and P-4 are **already encoded as compile-time constants** in `contracts/governance/ProposalRegistry.tact`. Changing them is not a parameter update — it is a code change that requires a redeployment under the same multi-sig ceremony used in B2 ([`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../deployments/B2-mainnet/MULTISIG_CEREMONY.md)).

---

## 3. Rationale (per parameter)

### P-3 — Voting period: 7 days

- Issue #132 §6 requires "minimum 7 days" for community participation.
- 7 days is the contract default (`DEFAULT_VOTING_DURATION = 604 800` s).
- A 7-day window covers one full weekly cycle, which is necessary because TBC Diamonds holders are geographically distributed.
- Per-proposal authors **may extend** the window via `SubmitProposal.voting_duration`. They **must not** shorten it: the runbook treats any value below `604 800` as a P-3 violation and aborts.

### P-4 — Quorum: 22 votes (~10 %)

- Issue #132 §6/§7 require quorum "high enough to prevent governance capture by small groups" and "set conservatively initially (err on side of higher quorum)".
- Contract default is `22 = ceil(0.10 × 222)`. The 222-NFT supply is small; quorum higher than 22 risks freezing governance entirely when participation is low, while quorum lower than 22 weakens capture resistance.
- The 10 % figure mirrors the precedent recorded in [`docs/dao-governance.md`](../dao-governance.md) §"Voting Model" ("recommended: 10–20 % of supply"), at the conservative end of the band.
- Authors **may raise** quorum per proposal via `SubmitProposal.quorum_threshold`. They **must not** lower it below 22: the runbook treats any value < 22 as a P-4 violation and aborts.

### P-5 — Decision rule: simple majority on non-abstain

- Contract logic in `FinalizeProposal` performs `votes_for > votes_against` only **after** the quorum gate.
- Abstentions count towards quorum but not towards majority. This lets large holders meet quorum without distorting outcome direction.

### P-6 — Proposal threshold: 1 NFT

- Contract enforces `1 ≤ author_nft_id ≤ 222`; ownership at the snapshot block is verified off-chain by the indexer and on-chain by `SnapshotVerifier.isEligible(proposal_id, author_nft_id)`.
- A higher threshold (e.g. "must hold ≥ 5 NFTs") would entrench whales. Single-NFT threshold is consistent with `docs/governance-process.md` §"Submission" ("Author must own at least 1 TBC Diamond NFT").

### P-7 — Snapshot timing

- Snapshot **must precede** `SubmitProposal` to defeat last-minute vote buying (issue #132 §7).
- The exact block-selection protocol lives in [`SNAPSHOT.md`](./SNAPSHOT.md) §3.

### P-8 — Off-chain implementation cooldown ("execution delay" ≥ 48 hours)

- Issue #132 §5/§7 use the words "execution delay" and "timelock". Because governance is **non-executable** (no on-chain action), neither concept maps to a smart-contract primitive in this protocol. The contracts intentionally provide **no** timelock module — adding one would re-introduce execution authority.
- Instead, the protocol applies a **process cooldown**: from the moment a proposal moves to `ACCEPTED`, no maintainer, deployer, or external integrator may begin voluntary off-chain implementation steps for **≥ 48 hours**. The cooldown is observed by the maintainer team and audited by the indexer's event timestamps.
- The cooldown protects against same-day implementation racing under social pressure and gives independent reviewers time to detect malicious proposals.
- The cooldown does **not** apply to:
  - Documentation-only proposals where the implementation is the publication itself.
  - Proposals that finalise as `REJECTED` or `NO_QUORUM`.
- The cooldown is enforced by maintainer policy (`docs/governance-process.md` §"Implementation Phase"). It is not enforced on-chain because there is nothing on-chain to delay.

### P-11 — Vote privacy

- Contract intentionally omits `voter_nft_id` from the `VoteCast` event. Mirrored privacy guarantees are documented in [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md).

### P-12 — Permissionless finalisation

- Anyone may pay the gas to finalise a proposal whose voting window has closed. This prevents a single party from blocking finalisation. The action is idempotent — the contract enforces `require(p.status == STATUS_ACTIVE)`.

---

## 4. Cross-references with contract constants

The table below is the authoritative cross-walk between the **values in this document** and the **constants in `contracts/governance/ProposalRegistry.tact`**. CI verifies that the two stay in sync via the harness described in [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §7.

| Parameter | Document value | Contract constant | Match? |
|-----------|----------------|-------------------|--------|
| P-1 | 222 NFTs | `DIAMONDS_TOTAL_SUPPLY = 222` | ✅ |
| P-3 | 7 days = 604 800 s | `DEFAULT_VOTING_DURATION = 604800` | ✅ |
| P-4 | 22 votes | `DEFAULT_QUORUM_THRESHOLD = 22` | ✅ |
| P-9 | 6 categories (0..5) | `CATEGORY_ROADMAP_SIGNAL = 0 … CATEGORY_ECOSYSTEM_GRANT_SIGNAL = 5` | ✅ |
| P-10 | 3 vote options | `VOTE_FOR = 0`, `VOTE_AGAINST = 1`, `VOTE_ABSTAIN = 2` | ✅ |

Any drift between this table and the contract source is a CI-blocking defect.

---

## 5. Off-chain implementation cooldown (the "48-hour rule")

Because the protocol has **no execution engine**, traditional governance timelocks do not apply. Instead, the maintainer team observes the following discipline once a proposal finalises:

1. **T+0** — `ProposalFinalized` event emitted on-chain. The indexer mirrors it to `TransparencyRegistry`.
2. **T+0 → T+48h** — Cooldown window. The maintainer team **must not**:
   - Open implementation PRs that cite the proposal as the sole justification.
   - Publish a release that depends on the proposal's outcome.
   - Sign off-chain attestations referencing the proposal as authority.
   The team **may**:
   - Open discussion issues / RFCs.
   - Draft (but not merge) implementation PRs.
   - Plan staged rollouts.
3. **T+48h** — Cooldown ends. Implementation work may proceed in accordance with `docs/governance-process.md`.
4. **Audit trail** — Indexer records the `ProposalFinalized` timestamp; any maintainer commit timestamp that references the proposal **must** be ≥ `ProposalFinalized + 48 hours`. CI tooling (`scripts/governance/check-cooldown.ts`, scheduled by [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §6) verifies the gap on every PR mentioning a proposal ID.

The cooldown can be lengthened **per proposal** by the author. It cannot be shortened below 48 hours without a new governance proposal that explicitly amends this section.

---

## 6. Change-management policy

| Change | Required process |
|--------|------------------|
| Adjust **on-chain default** (P-3, P-4) | Code change → new B2-style multi-sig ceremony → new contract address → manifest entry with `supersedes` set; previous contract is `paused` per [`docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md`](../deployments/B2-mainnet/ROLLBACK_PROCEDURES.md) §3 |
| Adjust **off-chain parameter** (P-7, P-8) | New governance proposal (category `ROADMAP_SIGNAL`), `ACCEPTED` outcome, ≥ 48 h cooldown, then a documentation PR that updates this file |
| Lower P-3 below 7 days, lower P-4 below 22, lower P-8 below 48 h | **Forbidden** in the initial activation cycle. Requires a separate governance round following ratification of this document |
| Add a new proposal category | **Forbidden** — categories are a fixed enum in the contract |

---

## 7. References

- [`docs/dao-governance.md`](../dao-governance.md) — governance philosophy and constraints
- [`docs/governance-process.md`](../governance-process.md) — proposal lifecycle
- [`docs/governance-transparency.md`](../governance-transparency.md) — public transparency layer
- [`docs/governance-transparency-privacy.md`](../governance-transparency-privacy.md) — voter privacy guarantees
- [`SNAPSHOT.md`](./SNAPSHOT.md) — voter snapshot methodology
- [`E1-activation/ENGAGEMENT.md`](./E1-activation/ENGAGEMENT.md) — activation engagement plan
- [`E1-activation/ACTIVATION_PROPOSAL.md`](./E1-activation/ACTIVATION_PROPOSAL.md) — first governance proposal text
- `contracts/governance/ProposalRegistry.tact` — canonical source of P-3, P-4, P-9, P-10
- `contracts/governance/SnapshotVerifier.tact` — canonical source of snapshot semantics
- `contracts/governance/TransparencyRegistry.tact` — public mirror of governance events
