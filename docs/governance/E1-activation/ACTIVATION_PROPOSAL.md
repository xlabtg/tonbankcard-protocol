# Governance Activation Proposal — `E1-PROP-001`

**Engagement:** [E1](./ENGAGEMENT.md)
**Issue:** [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132) (acceptance row 7)
**Category:** `0` — `ROADMAP_SIGNAL`
**Status:** Draft — published to GitHub Discussions at engagement Phase 5; submitted on-chain after the 24-hour cool-down
**Author:** `@konard` (TBC Diamonds NFT ID TBD)
**Last Updated:** 2026-05-17

---

> This is the **first** governance proposal in the history of TONBANKCARD. Its only purpose is to **ratify the initial governance parameters and snapshot methodology** so that subsequent proposals operate against a community-acknowledged baseline.

---

## 1. Proposal abstract

The proposal asks TBC Diamonds holders to ratify:

1. The initial governance parameters published in [`../PARAMETERS.md`](../PARAMETERS.md).
2. The voter snapshot methodology published in [`../SNAPSHOT.md`](../SNAPSHOT.md).
3. The off-chain implementation cooldown of **≥ 48 hours** following `ProposalFinalized`.
4. The activation of the on-chain proposal registry, snapshot verifier, and transparency registry — already deployed by B2 with `activated: no`, to be flipped to `activated: yes` upon `ACCEPTED` outcome.

A `FOR` vote is interpreted as endorsement of the baseline as written. An `AGAINST` vote is interpreted as objection to one or more of items 1–4; the community is invited to publish the objection in the proposal discussion thread.

The proposal is **non-binding**. The contracts and the maintainer team will operate under the proposed parameters regardless of outcome — `REJECTED` simply opens an immediate follow-up cycle to amend the parameters before the next proposal.

---

## 2. Author & eligibility

| Field | Value |
|-------|-------|
| Author NFT ID | TBD (≥ 1, ≤ 222) |
| Snapshot block | TBD (selected per [`../SNAPSHOT.md`](../SNAPSHOT.md) §3.2 — 24-hour cool-down after publication of this draft) |
| Snapshot root hash | TBD |
| Eligible voter count | TBD (typically 222 minus excluded addresses) |
| Author signed proposal hash | TBD |

The author owns at least 1 TBC Diamonds NFT at the snapshot block and produces this proposal under the documented Phase-1 cool-down (24 h of off-chain drafting and indexer attestation).

---

## 3. Proposed text

> **Be it resolved by the TBC Diamonds holders that:**
>
> 1. The initial governance parameters published in `docs/governance/PARAMETERS.md` (commit `<sha>` of the TONBANKCARD repository) — specifically, voting period = 7 days, quorum = 22 votes, proposal threshold = 1 NFT, decision rule = simple majority on non-abstain, and the off-chain implementation cooldown of ≥ 48 hours — are hereby **ratified** as the baseline configuration of the DAO.
>
> 2. The voter snapshot methodology published in `docs/governance/SNAPSHOT.md` (same commit) — specifically, the NFT-only eligibility model, the 24-hour cool-down between draft and snapshot block selection, the exclusion list as published at `excluded_addresses_version = <ver>`, and the on-chain `SnapshotVerifier.RegisterSnapshot` ordering before `ProposalRegistry.SubmitProposal` — is hereby **ratified** as the canonical procedure for selecting voters.
>
> 3. The three deployed governance contracts (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`) at the mainnet addresses recorded in the latest `docs/deployments/mainnet/<timestamp>.json` manifest are hereby **activated** for community use. The maintainer team is requested (non-bindingly) to flip the `activated` column to `yes` in `docs/deployments/network-matrix.md` upon final outcome of this proposal.
>
> 4. The TBC Diamonds DAO confirms that this resolution is **advisory only**, in accordance with `docs/dao-governance.md`. No protocol contract, treasury, account, or admin authority is granted or implied by this proposal or its outcome. All voting outcomes are recorded on-chain in `ProposalRegistry` and mirrored to `TransparencyRegistry` for transparency.

The text above is the **canonical wording** of the proposal. The off-chain metadata (IPFS pin) contains:

- The exact wording.
- Cross-links to `PARAMETERS.md` and `SNAPSHOT.md` at the ratified commit hash.
- The snapshot block fields (§2 above).
- A SHA-256 hash of the eligibility map.
- The list of excluded addresses (§4 below).

The on-chain `metadata_hash` is `SHA-256` of the canonical JSON serialisation of the metadata file. Any byte-level edit invalidates the proposal.

---

## 4. Excluded addresses (snapshot exclusion list)

The following address classes are excluded from voting at snapshot time per [`../SNAPSHOT.md`](../SNAPSHOT.md) §2.3:

| Class | Address(es) | Reason |
|-------|-------------|--------|
| TBC Diamonds collection contract itself | TBD | Pre-mint / recovery |
| Burn address | `null` / canonical burn | Cannot sign |
| Known custodial DEX wallets | TBD list from `docs/governance-transparency-verification.md` | Pool, not a person |
| NFTs with `init? = false` at snapshot block | TBD (typically empty for a fully-minted collection) | Standard TEP-62 |

`excluded_addresses_version = 1.0.0` for `E1-PROP-001`. Any future change to this list requires its own ratification proposal.

---

## 5. Vote options

| Option | On-chain value | Interpretation |
|--------|----------------|----------------|
| `FOR` | `0` | Endorse §3 items 1–4 as written |
| `AGAINST` | `1` | Object to one or more items in §3 (objection should be posted in the discussion thread) |
| `ABSTAIN` | `2` | Counts towards quorum but not towards direction |

Quorum: **22 votes** (P-4). Decision rule: simple majority on non-abstain (P-5) after quorum.

---

## 6. Voting window

| Field | Value |
|-------|-------|
| `voting_start` | At the moment of `ProposalSubmitted` event |
| `voting_duration` | 604 800 seconds (7 days, P-3) |
| `voting_end` | `voting_start + 7d` |
| Finalisation by | Any wallet, after `voting_end` |
| Off-chain implementation cooldown | 48 h after `ProposalFinalized` |

The author commits to **not** modifying the proposal text or metadata after `SubmitProposal`. Any errata are published as a follow-up proposal.

---

## 7. Discussion venue

| Channel | URL |
|---------|-----|
| Draft & discussion (GitHub Discussions) | TBD — to be created at Phase 5 |
| Voting frontend (TON Connect-based DApp) | TBD — read-only proposal viewer |
| Public mirror | `TransparencyRegistry` (mainnet) |
| Indexer dashboard | B3 dashboard, "Governance" panel |

---

## 8. Post-finalisation operational note

Regardless of outcome:

- The contracts remain queryable.
- The indexer continues to mirror events.
- The maintainer team is required to publish a **post-vote report** within 14 days of `ProposalFinalized` listing the vote distribution, audit-script verdict, and any dispute filings.
- The maintainer team observes the **48-hour off-chain cooldown** before opening any implementation work that cites this proposal.

If `REJECTED` or `NO_QUORUM`:

- The maintainer team opens a follow-up RFC within 14 days.
- The original proposal stays on-chain as a permanent record.
- The activation **is not** rolled back (there is no rollback primitive).

---

## 9. References

- [`../PARAMETERS.md`](../PARAMETERS.md)
- [`../SNAPSHOT.md`](../SNAPSHOT.md)
- [`ENGAGEMENT.md`](./ENGAGEMENT.md)
- [`RUNBOOK.md`](./RUNBOOK.md)
- [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md)
- [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json)
- [`../../dao-governance.md`](../../dao-governance.md)
- [`../../governance-process.md`](../../governance-process.md)
- `contracts/governance/ProposalRegistry.tact`
- `contracts/governance/SnapshotVerifier.tact`
- `contracts/governance/TransparencyRegistry.tact`
