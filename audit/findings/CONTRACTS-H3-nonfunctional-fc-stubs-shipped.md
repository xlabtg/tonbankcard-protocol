---
title: "[CONTRACTS-H3] Non-functional FunC stubs (payment-hub, nft_account_resolver) ship in deployable set"
severity: high
area: contracts
priority: high
stage: 2
labels: ["bug","audit","type:contract","type:security","priority:high","stage:2-high"]
---

## Summary

`payment-hub.fc` and `nft_account_resolver.fc` are non-functional placeholders that still reside in the deployable `contracts/` set. The payment hub throws on every inbound message, and the NFT account resolver returns dummy/empty owner data, so any contract that depends on the resolver for owner-based access control would resolve to an empty owner and lose its only authorization mechanism.

## Severity & Category

- Severity: High
- Category: Non-production stub in deployable set / Broken access control dependency

## Affected Code

- `contracts/payments/payment-hub.fc` line `291` (`recv_internal` throws `DEPLOY_BLOCKER_NOT_PRODUCTION_READY` `0xDEAD` on every message; `get_nft_data_raw` returns empty slices)
- `contracts/nft-resolver/nft_account_resolver.fc` lines `103-112` (`get_nft_data_raw` returns dummy/empty slices)

## Description

The payment hub's `recv_internal` is hardwired to reject all messages with a deploy-blocker exit code (`0xDEAD`), and its `get_nft_data_raw` returns empty slices rather than real NFT data. The NFT account resolver's `get_nft_data_raw` likewise returns dummy/empty slices instead of resolving the real on-chain owner. These are explicit "not production ready" placeholders that nonetheless live alongside production contracts in the deployable tree.

## Impact

The NFT account resolver is intended to be the authority that maps an NFT to its owner for access-control checks. Because it returns empty/dummy data, any consumer that calls it to authorize "is this sender the NFT owner" would treat an empty owner as the answer, defeating the protocol's sole access-control mechanism (NFT ownership). Shipping these stubs in the deployable set also risks them being deployed or linked by mistake, where the payment hub would brick all traffic (`0xDEAD`) and the resolver would silently authorize incorrectly.

## Suggested Fix

- Implement real TEP-62 owner resolution in `nft_account_resolver.fc` (return the actual NFT owner) and real ledger/message logic in `payment-hub.fc`.
- Until implemented, move both stubs out of the deployable contract set and exclude them from all build manifests so they cannot be compiled or deployed; keep the `0xDEAD` deploy blocker until real logic lands.

## Acceptance Criteria

- [ ] `nft_account_resolver.fc` returns real on-chain NFT owner data (TEP-62), or the stub is removed from the deployable set and all manifests.
- [ ] `payment-hub.fc` implements real message handling, or the stub is removed from the deployable set and all manifests.
- [ ] No consumer can obtain an empty/dummy owner that would pass an ownership-based access-control check.
- [ ] Regression test / CI check: the build manifests do not include non-production stubs, and resolver owner lookups return the correct owner for a known NFT.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/SCOPE.md`
- `audit/BUILD_INSTRUCTIONS.md`

---

**Tracking issue:** [#260](https://github.com/xlabtg/tonbankcard-protocol/issues/260)
