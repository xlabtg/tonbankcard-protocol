---
title: "[CONTRACTS-LOW] Contracts hardening backlog (Low / Info findings)"
severity: low
area: contracts
priority: low
stage: 4
labels: ["bug","audit","type:contract","type:security","priority:low","stage:4-low"]
---

## Summary

This file consolidates the Low and Info severity smart-contract findings from the audit. Each subsection is an independently actionable hardening item; none is individually critical, but addressing them strengthens validation, removes stubs, and closes the gap between the deployed contracts and the protocol's non-custodial, NFT-ownership-is-authority model.

## Severity & Category

- Severity: Low / Info
- Category: Hardening, validation correctness, stub removal, non-custodial conformance

## Affected Code

- `contracts/payments/PaymentHub.tact` lines `239`, `425-437`, `442-463`
- `contracts/governance/SnapshotVerifier.tact` lines `129-147` (fallback `137-141`)
- `contracts/collateral-lookup/PublicCollateralLookup.tact` lines `97-105`
- `contracts/payment-hub/account-state.tact` lines `117-255`; deployer-gated `RegisterNFTOwner*` handlers across `contracts/RecurringPayments.tact` and `contracts/MultiSigCard.tact`

## Description

The detailed findings, impact, and fixes are captured per subsection below.

### L-1: PaymentHub.isValidAccountNFT checks an NFT address against the collections whitelist

- Affected: `contracts/payments/PaymentHub.tact` lines `425-437`, `442-463`, `239`
- Description: `isValidAccountNFT(nft_address)` performs `whitelisted_collections.get(nft_address) != null`, looking up an individual NFT address in a map that is meant to hold collection addresses. This conflates two distinct identifier types, so the validation is effectively meaningless (an NFT address will essentially never appear in a collection-keyed map).
- Impact: The check provides no real guarantee. Fund-loss risk is limited because a new account starts at balance 0 and `require(sender() == from_account.owner)` blocks spending, but the validation should not be relied upon for any security property.
- Suggested fix: Resolve the NFT's collection and check that collection against `whitelisted_collections`, or maintain a separate, correctly-keyed per-NFT whitelist and look up against that.
- Acceptance: `isValidAccountNFT` validates against the correct identifier type; regression test confirms an NFT from a whitelisted collection passes and an NFT from a non-whitelisted collection fails.

### L-2: SnapshotVerifier.isEligible fails open when no snapshot is registered

- Affected: `contracts/governance/SnapshotVerifier.tact` lines `129-147` (fallback `137-141`)
- Description: When no snapshot is registered, `isEligible` falls back to treating all NFTs as eligible (fail-open). The verifier is also not wired into the `ProposalRegistry` vote-casting flow.
- Impact: A missing snapshot grants blanket eligibility instead of denying it, and because the verifier is not integrated, eligibility is not actually enforced during voting.
- Suggested fix: Fail closed (return `false` / `require` that a snapshot exists) when no snapshot is registered, and integrate `isEligible` into the vote-casting flow so it gates real votes.
- Acceptance: With no snapshot registered, `isEligible` returns false; the vote-casting path invokes the verifier; regression test covers both the no-snapshot (denied) and valid-snapshot (allowed) cases.

### L-3: PublicCollateralLookup.hasActiveCollateral is a stub that always returns false

- Affected: `contracts/collateral-lookup/PublicCollateralLookup.tact` lines `97-105`
- Description: `hasActiveCollateral` is a stub that always returns `false`; it never queries the Account Locks contract.
- Impact: Integrators relying on this lookup receive false negatives (they will believe no active collateral exists), which can lead to incorrect downstream decisions.
- Suggested fix: Implement the cross-contract query against Account Locks, or clearly mark the function as an unimplemented stub / remove it until implemented.
- Acceptance: `hasActiveCollateral` reflects real Account Locks state, or is unambiguously marked/removed; regression test confirms true/false results match actual collateral state.

### I-1: Test-only deployer-gated handlers remain in audited contracts

- Affected: `contracts/payment-hub/account-state.tact` lines `117-255` (`DepositTBC` / `WithdrawTBC` / `TransferInternal` / `ChangeAccountState`, each `require(sender() == self.owner, "...test-only")`); similar deployer-gated `RegisterNFTOwner*` handlers across `contracts/RecurringPayments.tact` and `contracts/MultiSigCard.tact`
- Description: These handlers let the deployer mint balances, move funds, and change account state, gated only on the deployer key rather than NFT ownership. `audit/INVARIANTS.md` acknowledges these are TEST-ONLY and must be removed before mainnet; in their current form they violate the non-custodial invariant.
- Impact: While present, the deployer holds custodial powers (mint/move/state-change) over user accounts, contradicting the protocol's non-custodial, NFT-ownership-is-authority model. If shipped to mainnet they would be an authorization escalation.
- Suggested fix: Remove the test-only handlers and replace any needed flows with NFT-owner-authorized equivalents; enforce their absence from production builds in CI.
- Acceptance: No deployer-gated mint/move/state-change handlers exist in production contracts; CI check fails if a `test-only` deployer-gated handler is present in a deployable manifest.

## Impact

Individually low, these items collectively reduce validation correctness, leave non-functional stubs in place, and retain custodial test-only powers that conflict with the non-custodial invariant. Addressing them aligns the deployed contracts with the documented security model.

## Suggested Fix

Apply the per-subsection fixes above. Prioritize I-1 (remove custodial test-only handlers) and L-2 (fail-closed eligibility) as they touch authorization and governance integrity.

## Acceptance Criteria

- [ ] L-1: `PaymentHub.isValidAccountNFT` validates against the correct identifier type (collection or per-NFT whitelist) with a regression test.
- [ ] L-2: `SnapshotVerifier.isEligible` fails closed without a snapshot and is wired into vote casting, with regression tests for both cases.
- [ ] L-3: `PublicCollateralLookup.hasActiveCollateral` is implemented against Account Locks or clearly removed/marked, with a regression test.
- [ ] I-1: Test-only deployer-gated handlers are removed from production contracts and a CI check enforces their absence.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`
- `audit/THREAT_MODEL.md`
- `CONTRIBUTING.md` (non-custodial philosophy)

---

**Tracking issue:** [#298](https://github.com/xlabtg/tonbankcard-protocol/issues/298)
