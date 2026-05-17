# Engagement E1 — Status

**Engagement ID:** `E1`
**Issue:** [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Runbook:** [`RUNBOOK.md`](./RUNBOOK.md)
**Phase:** Engagement preparation
**Gating verdict:** ⏳ Pending — activation not yet executed
**Public announcement:** ❌ Blocked until verdict = `ACTIVATED-LIVE` and `E1-PROP-001` final outcome recorded
**Last Updated:** 2026-05-17

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues |
| Activation operator | `@konard` | GitHub issues |
| Multi-sig signer #1 (mainnet) | TBD — must equal B2 signer #1 | Hardware wallet — Ledger or equivalent |
| Multi-sig signer #2 (mainnet) | TBD — must equal B2 signer #2 | Hardware wallet — Ledger or equivalent |
| Multi-sig signer #3 (mainnet) | TBD — must equal B2 signer #3 | Hardware wallet — Ledger or equivalent |
| Verification reviewer | TBD | GitHub PR review (mandatory second pair of eyes) |
| Indexer operator | TBD | Operates the staging + mainnet indexer pipeline (`backend/indexer/src/governance/`) |
| Communications lead | TBD | Posts `E1-PROP-001` to GitHub Discussions; coordinates with holders |

Multi-sig signer identities are inherited from B2 — E1 does **not** introduce new keys.

---

## 2. Upstream gates

Mirror of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4. Activation may not proceed past Phase 4 until all rows are ✅.

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G-1 | A1 verdict = `READY` for Phase 2 (incl. governance) | ⏳ Pending | [`../../security/audits/A1-core-contracts/STATUS.md`](../../security/audits/A1-core-contracts/STATUS.md) |
| G-2 | B2 verdict = `MAINNET-LIVE` after 24-h soak | ⏳ Pending | [`../../deployments/B2-mainnet/STATUS.md`](../../deployments/B2-mainnet/STATUS.md) §1 |
| G-3 | Mainnet manifest records governance group `activated: no` | ⏳ Pending | B2 manifest commit |
| G-4 | Payment-block 7-day soak elapsed without Critical findings | ⏳ Pending | B2 STATUS §"Soak window" + B3 alert log |
| G-5 | Testnet round-trip executed | ⏳ Pending | [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md) §4 results table |
| G-6 | `PARAMETERS.md` / `SNAPSHOT.md` reviewed by second pair of eyes | ⏳ Pending | PR review of this engagement |
| G-7 | Indexer governance pipeline live in staging | ⏳ Pending | B3 dashboard screenshot + alert attestation |
| G-8 | `E1-PROP-001` 24-hour cool-down elapsed | ⏳ Pending | GitHub Discussions URL recorded in §3 |
| G-9 | `SnapshotVerifier.set_registry` bound on mainnet (irreversible) | ⏳ Pending | Activation manifest §6 |
| G-10 | Activation manifest committed + `network-matrix.md` atomic update | ⏳ Pending | PR URL recorded in §6 |

---

## 3. First proposal anchor (`E1-PROP-001`)

| Field | Value |
|-------|-------|
| Draft URL (GitHub Discussions) | TBD |
| Draft timestamp `T₀` | TBD |
| Cool-down end `T₀ + 24h` | TBD |
| Chosen `snapshot_seqno` | TBD |
| Chosen `snapshot_root_hash` | TBD |
| Chosen `snapshot_gen_utime` | TBD |
| Indexer attestation hash | TBD |
| IPFS CID for proposal metadata | TBD |
| `metadata_hash` (SHA-256) | TBD |
| Author NFT ID | TBD |

Filled atomically with the manifest commit in §6.

---

## 4. Testnet round-trip result

| Field | Value |
|-------|-------|
| Round-trip executed? | ⏳ Pending |
| Testnet `ProposalRegistry` address | TBD |
| Testnet `SnapshotVerifier` address | TBD |
| Testnet `TransparencyRegistry` address | TBD |
| `SubmitProposal` tx | TBD |
| `RegisterSnapshot` tx | TBD |
| `CastVote` (≥ 22 votes) txs | TBD |
| `FinalizeProposal` tx | TBD |
| `TransparencyRegistry` mirror txs | TBD |
| Audit-script verdict (`scripts/governance/audit-snapshot.ts`) | TBD |
| CRITICAL findings | TBD (must equal 0 for G-5 to flip ✅) |

Report PDF: `audit/governance-snapshots/E1-PROP-000-testnet.json` (placeholder until round-trip executed).

---

## 5. Indexer pipeline status (staging)

| Field | Value |
|-------|-------|
| Indexer module enabled (`backend/indexer/src/governance/`) | ⏳ Pending |
| Events mirrored: `ProposalSubmitted` | ⏳ |
| Events mirrored: `SnapshotRegistered` | ⏳ |
| Events mirrored: `VoteCast` | ⏳ |
| Events mirrored: `ProposalFinalized` | ⏳ |
| B3 dashboard panel "Governance — events / hour" | ⏳ |
| B3 alert `R-014 GovernanceEventGap` armed | ⏳ |

---

## 6. Activation manifest

| Field | Value |
|-------|-------|
| Mainnet `ProposalRegistry` address | TBD (from B2 manifest) |
| Mainnet `SnapshotVerifier` address | TBD (from B2 manifest) |
| Mainnet `TransparencyRegistry` address | TBD (from B2 manifest) |
| `set_registry` tx hash | TBD |
| `set_registry` signed by | TBD (≥ 2 of 3 hardware-wallet signers) |
| Activation manifest path | `docs/governance/E1-activation/activations/<timestamp>.json` |
| Manifest commit | TBD |
| PR URL atomically updating `network-matrix.md` (governance group `activated: yes`) | TBD |
| Reviewer attestation | TBD |

---

## 7. First on-chain proposal (`E1-PROP-001`)

| Field | Value |
|-------|-------|
| `proposal_id` | TBD (likely 1 — first proposal on the freshly activated registry) |
| `category` | `0` (ROADMAP_SIGNAL) |
| `voting_start` | TBD |
| `voting_end` | TBD (`voting_start + 604 800`) |
| `quorum_threshold` | `22` |
| Author NFT ID | TBD |
| Votes FOR / AGAINST / ABSTAIN | TBD |
| Final outcome | TBD (`ACCEPTED` / `REJECTED` / `NO_QUORUM`) |
| `ProposalFinalized` event tx | TBD |
| `TransparencyRegistry` mirror tx | TBD |
| Audit-script verdict | TBD |
| Off-chain implementation cooldown end (`voting_end + 48 h`) | TBD |

---

## 8. Verdict ledger

| Verdict | Definition | Status |
|---------|------------|--------|
| `READY-FOR-E2` | Phases 1–6 complete, `E1-PROP-001` ACCEPTED, no CRITICAL | ⏳ |
| `ACTIVATED-LIVE` | `network-matrix.md` shows governance group `activated: yes` | ⏳ |
| `ABORTED` | CRITICAL finding before G-9 — engagement re-cycles | n/a |

---

## 9. Change-log

| Date | Change | Commit |
|------|--------|--------|
| 2026-05-17 | Engagement preparation: `PARAMETERS.md`, `SNAPSHOT.md`, package created (issue #132, PR #164) | this PR |
