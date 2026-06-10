---
title: "[CONTRACTS-M1] CollateralSignal allows owner re-binding (missing write-once guard)"
severity: medium
area: contracts
priority: medium
stage: 3
labels: ["bug","audit","type:contract","type:security","priority:medium","stage:3-medium"]
---

## Summary

`CollateralSignal.RegisterNFTOwner` writes the NFT-to-owner mapping directly without the write-once guard used by every other contract. This lets the deployer overwrite or re-bind an already-registered owner at any time.

> **Resolution (Issue #364 — RESOLVED ✅):** the deployer-gated `RegisterNFTOwner`
> handler was removed entirely as part of the pre-mainnet hardening for the
> HIGH-severity backdoor (cross-cutting finding X-1). Ownership is now bound only
> by the trusted on-chain NFT Account Resolver via `receive(msg: ResolveNFTOwner)`,
> and the write-once guard this finding asked for is enforced there:
> `require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered")`
> (`contracts/CollateralSignal.tact`, immediately before the `set`). A second
> registration for an already-bound NFT now reverts and the original binding is
> preserved, so the owner mapping is one-time and immutable — consistent with the
> rest of the protocol's write-once registration model. Covered by the on-chain
> Sandbox suite (`contracts/collateral-signal/collateral-signal.spec.ts`) and the
> CI regression guard (`contracts/payment-hub/non-production-stubs.spec.ts`,
> Issue #364 block).

## Severity & Category

- Severity: Medium
- Category: Access control / Data integrity (missing write-once protection)

## Affected Code

- `contracts/CollateralSignal.tact` lines `366-370` (`RegisterNFTOwner` performs `self.nft_owners.set(...)` directly)

## Description

Other contracts guard owner registration with a check that the mapping is currently empty, e.g. `require(self.nft_owners.get(msg.nft_address) == null, ...)`. `CollateralSignal` omits this guard and performs the `set` unconditionally:

```tact
// RegisterNFTOwner handler (lines 366-370)
self.nft_owners.set(msg.nft_address, /* owner */ ...);
```

Because there is no check that the entry is unset, an existing owner binding can be silently overwritten by a subsequent registration call.

## Impact

The owner mapping is intended to be a one-time, immutable binding. Without the guard, whoever can call `RegisterNFTOwner` (the deployer) can re-bind an NFT to a different owner address at any time, undermining the integrity and finality of owner registration in `CollateralSignal` and creating an inconsistency with the rest of the protocol's write-once registration model.

## Suggested Fix

- Add the write-once guard before the `set`:
  ```tact
  require(self.nft_owners.get(msg.nft_address) == null, "Owner already registered");
  ```
- Mirror the exact guard wording/behavior used by the other contracts for consistency.

## Acceptance Criteria

- [x] The owner-registration handler (now resolver-gated `ResolveNFTOwner`, Issue #364) rejects any registration for an NFT address that already has an owner.
- [x] First-time registration still succeeds.
- [x] Regression test: a second registration for an already-registered NFT reverts with "NFT owner already registered" and the original binding is preserved (`contracts/collateral-signal/collateral-signal.spec.ts`).

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#279](https://github.com/xlabtg/tonbankcard-protocol/issues/279)
