---
title: "[CONTRACTS-M3] Governance quorum mismatch: resolver computes 23, registry uses 22"
severity: medium
area: contracts
priority: medium
stage: 3
labels: ["bug","audit","type:contract","priority:medium","stage:3-medium"]
---

## Summary

The governance quorum threshold is computed differently in two places: the resolver rounds up to 23 votes, while the registry uses a truncated constant of 22. A proposal with exactly 22 votes therefore reaches quorum according to the registry but not according to the resolver.

## Severity & Category

- Severity: Medium
- Category: Correctness / Consistency (divergent quorum rounding)

## Affected Code

- `contracts/governance/diamond_resolver.fc` lines `145-153` (`(222 * 10 + 99) / 100 = 23`, round-up)
- `contracts/governance/ProposalRegistry.tact` line `52` (`DEFAULT_QUORUM_THRESHOLD = 22`, truncation of 22.2)

## Description

The resolver computes the 10% quorum of 222 NFTs with an explicit round-up: `(222 * 10 + 99) / 100 = 23`. The registry hardcodes `DEFAULT_QUORUM_THRESHOLD = 22`, which is the truncated value of `22.2`. The two components thus disagree on the threshold by one vote.

## Impact

For a proposal sitting at exactly 22 votes, the registry treats quorum as met while the resolver treats it as not met. Any consumer relying on the resolver's value (or comparing the two) can reach a different conclusion about whether a proposal passed, producing inconsistent or disputed governance outcomes at the boundary.

## Suggested Fix

- Choose a single rounding rule (round-up is the conventional choice for quorum) and use one shared constant across both the resolver and the registry, so `diamond_resolver.fc` and `ProposalRegistry.tact` always agree.

## Acceptance Criteria

- [ ] Both `diamond_resolver.fc` and `ProposalRegistry.tact` derive quorum from a single shared constant / rule.
- [ ] The computed quorum value is identical in both components for 222 NFTs.
- [ ] Regression test: a proposal at the boundary vote count yields the same pass/fail result from the registry and the resolver.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#281](https://github.com/xlabtg/tonbankcard-protocol/issues/281)
