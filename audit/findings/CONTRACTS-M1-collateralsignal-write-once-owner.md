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

- [ ] `RegisterNFTOwner` rejects any registration for an NFT address that already has an owner.
- [ ] First-time registration still succeeds.
- [ ] Regression test: a second `RegisterNFTOwner` for an already-registered NFT reverts with "Owner already registered" and the original binding is preserved.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#279](https://github.com/xlabtg/tonbankcard-protocol/issues/279)
