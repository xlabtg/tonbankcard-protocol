---
title: SnapshotVerifier accepts unauthenticated RegisterSnapshot, letting anyone forge the governance eligibility roll
severity: High
area: contracts/governance
priority: high
stage: 1-critical
labels:
  - bug
  - type:security
  - type:contract
  - priority:high
  - audit
  - stage:1-critical
---

## Summary

`SnapshotVerifier.tact` is the eligibility oracle consumed by `ProposalRegistry` to decide whether an NFT may cast a governance vote. Its state-mutating `receive(msg: RegisterSnapshot)` handler performs **no `sender()` authorization check**, so any external address can register (or front-run) the snapshot for any `proposal_id` and arbitrarily define which NFT IDs are "eligible". The companion `receive("set_registry")` is first-caller-wins, and the stored `proposal_registry` address is never used to gate anything.

## Severity & Category

- Severity: High
- Category: Access Control / Governance integrity

## Affected Code

- `contracts/governance/SnapshotVerifier.tact:92-95` (`receive("set_registry")` — first caller wins, no owner)
- `contracts/governance/SnapshotVerifier.tact:102-139` (`receive(msg: RegisterSnapshot)` — no `sender()` check)
- `contracts/governance/SnapshotVerifier.tact:77` (`proposal_registry` stored but never enforced)
- `contracts/governance/ProposalRegistry.tact:440-456` (consumes `EligibilityCheckResponse` as source of truth)

## Description

The handler that builds the eligibility map is fully open:

```tact
receive(msg: RegisterSnapshot) {
    require(msg.proposal_id > 0, "Invalid proposal ID");
    require(self.snapshots.get(msg.proposal_id) == null, "Snapshot already exists");
    // ... iterates msg.eligible_nfts and stores eligibility, no sender() check ...
}
```

The only guards are `proposal_id > 0` and "snapshot does not already exist". There is no `require(sender() == ...)`. The comment at line 100 (`In production, this would be called by a trusted indexer`) acknowledges the intent but the trust is never enforced on-chain.

`ProposalRegistry` later asks the verifier via `EligibilityCheckRequest`/`EligibilityCheckResponse` and records a vote when `msg.eligible` is true (gated only by `require(sender() == self.snapshot_verifier!!)` — i.e. it trusts the verifier's answer). Because the snapshot the verifier answers from is attacker-controlled, the downstream authorization is meaningless.

Additionally, `receive("set_registry")` only checks `self.proposal_registry == null`, so the first arbitrary caller claims the registry slot; and even once set, that address is never consulted by `RegisterSnapshot`.

## Impact

- Any address can pre-register a forged snapshot for an upcoming proposal (front-running the legitimate indexer, which is blocked by the `Snapshot already exists` guard), choosing which NFT IDs count as eligible.
- An attacker can grant eligibility to NFTs they control and/or strip eligibility from honest holders, controlling governance outcomes.
- Violates the governance-integrity expectation that eligibility reflects real NFT ownership at snapshot time.

## Suggested Fix

- Add an owner/indexer authority to `SnapshotVerifier` (set at `init()` or via a one-time, owner-guarded setter) and enforce `require(sender() == self.trusted_indexer, "unauthorized")` in `receive(msg: RegisterSnapshot)`.
- Either remove the unused `proposal_registry` field or actually enforce it where relevant.
- Consider committing to a snapshot Merkle root signed/produced by the indexer rather than accepting a raw eligibility map, so the on-chain check can verify membership proofs.

## Acceptance Criteria

- [ ] `RegisterSnapshot` from a non-authorized sender is rejected.
- [ ] The trusted indexer/owner address is established in a way that cannot be claimed by an arbitrary first caller.
- [ ] Regression test: a non-owner `RegisterSnapshot` throws; an owner `RegisterSnapshot` succeeds and a subsequent forged overwrite is rejected.
- [ ] `ProposalRegistry` eligibility decisions are shown to derive only from authorized snapshots.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- `audit/THREAT_MODEL.md`, `audit/INVARIANTS.md`
