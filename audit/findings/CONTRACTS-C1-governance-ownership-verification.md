---
title: "[CONTRACTS-C1] Governance voting and proposal submission lack on-chain NFT ownership verification"
severity: critical
area: contracts
priority: critical
stage: 1
labels: ["bug","audit","type:contract","type:security","priority:critical","stage:1-critical"]
---

## Summary

The governance `ProposalRegistry` records votes and proposals using a caller-supplied NFT ID without ever verifying that the message sender actually owns that Diamond NFT. Any address can therefore vote on behalf of any of the 222 Diamond NFTs and submit proposals as any author, which fully defeats the protocol's invariant that NFT ownership is the sole source of governance authority.

## Severity & Category

- Severity: Critical
- Category: Access control / Authorization (missing on-chain ownership verification)

## Affected Code

- `contracts/governance/ProposalRegistry.tact` lines `163-165` (`SubmitProposal` ownership note)
- `contracts/governance/ProposalRegistry.tact` lines `211-250` (`CastVote` handler), specifically the `vote_key` derivation at line `241` and the trust note at lines `244-247`

## Description

In the `SubmitProposal` handler the contract validates only that the author NFT ID is in range and then explicitly trusts the caller:

```tact
// NOTE: In production, we would verify the sender owns the Diamond NFT
// This requires a cross-contract call to the NFT collection
// For this implementation, we trust the caller to provide valid ownership proof
```

The `CastVote` handler derives the dedup key purely from caller-supplied values and records the vote with no ownership check:

```tact
// Check if already voted (using composite key)
let vote_key: Int = msg.proposal_id * 1000 + msg.voter_nft_id;
require(self.votes_cast.get(vote_key) == null, "Already voted");

// NOTE: In production, we would verify:
// 1. Sender owns the Diamond NFT
// 2. NFT was owned at snapshot time
// This requires cross-contract calls or off-chain verification

// Record vote
self.votes_cast.set(vote_key, true);
```

`msg.voter_nft_id` (and `msg.author_nft_id`) are attacker-controlled. There is no `require(sender() == resolvedOwner)` anywhere in either path, so the link between the on-chain sender and the claimed NFT is never established.

## Impact

Any address can iterate `voter_nft_id` over the full Diamond range (1-222) and cast a vote for each one, because the only uniqueness guard is the `(proposal_id, voter_nft_id)` dedup key, not ownership. With 222 NFTs and a quorum of roughly 22, a single attacker can fabricate all 222 votes from one wallet and unilaterally pass or reject any proposal, and can also submit proposals while impersonating any author. This makes governance outcomes entirely attacker-determined and directly contradicts the non-custodial, NFT-ownership-is-authority invariant.

## Suggested Fix

- Resolve the actual on-chain owner of the claimed Diamond NFT via the NFT Account Resolver / collection (TEP-62 owner resolution) before recording any vote or proposal.
- Require `sender() == resolvedOwner` (or route the action through an owner-authorized message) and reject otherwise; never trust a caller-supplied `voter_nft_id` / `author_nft_id` as proof of ownership.
- If resolution is asynchronous (cross-contract), implement a request/response flow where the vote is only finalized after the resolver confirms ownership for `sender()`.

## Acceptance Criteria

- [ ] `CastVote` resolves the NFT owner on-chain and rejects when `sender()` is not the owner of `voter_nft_id`.
- [ ] `SubmitProposal` resolves and enforces ownership of `author_nft_id` by `sender()`.
- [ ] Caller-supplied NFT IDs alone can no longer cause a vote or proposal to be recorded.
- [ ] Regression test: a sender that does not own NFT `N` is rejected when calling `CastVote`/`SubmitProposal` for NFT `N`, and a single wallet cannot accumulate votes for NFTs it does not own.
- [ ] Regression test: the legitimate owner of NFT `N` can still vote/submit successfully.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md` (NFT-ownership-is-authority invariant)
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#248](https://github.com/xlabtg/tonbankcard-protocol/issues/248)
