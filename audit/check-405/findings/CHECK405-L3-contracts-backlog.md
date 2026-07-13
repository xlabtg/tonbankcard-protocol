---
title: "Contracts backlog (file-only): SnapshotVerifier set_registry can only bind to the deployer, and MerchantPaymentHub has no balance-funding path"
severity: Low
area: contracts
priority: low
stage: 4-low
labels:
  - bug
  - audit
  - type:contract
  - priority:low
  - stage:4-low
  - track:A
---

## Summary

Two low-severity smart-contract observations, filed for the contract team.
**No contract code is changed in this PR** — the contracts are frozen for this
round and (for the second item) any change touches protocol economics, which is
out of scope for an automated audit fix. These are documented so the team can
schedule them into a dedicated contract PR with the appropriate review.

1. **`SnapshotVerifier.set_registry` can only ever bind to the deployer.** The
   `receive("set_registry")` handler is a string message carrying no address, so
   it sets `self.proposal_registry = sender()`, and `sender()` is required to
   equal `self.deployer`. The write-once guard then makes that permanent. The
   proposal-registry slot can therefore never hold the *actual* registry address
   — only the deployer's. `getProposalRegistry()` is informational only (no auth
   path consumes it; eligibility responses are validated by `ProposalRegistry`
   independently), so impact is low, but the setter is effectively a no-op that
   looks meaningful.
2. **`MerchantPaymentHub` has no handler that credits `account_balances` from an
   external source.** The only caller of `creditBalance` is the payment-success
   path (crediting the merchant from the payer). The removed
   `SetAccountBalance`/`SetAccountState` admin handlers (issue #363) left no
   replacement funding path, yet a payment requires `payer_balance >= amount_tbc`
   (`VALIDATION 7`). A freshly registered payer has balance `0`, so **every**
   payment reverts with `ERROR_INSUFFICIENT_BALANCE`. This is distinct from #397
   (missing account *registration*): even with registration, there is no way for
   an account to acquire a balance.

## Severity & Category

- Severity: Low (item 1: dead setter; item 2: liveness gap whose fix is a
  protocol-economics decision, not an audit code change)
- Category: Governance wiring / protocol liveness

## Affected Code

1. `contracts/governance/SnapshotVerifier.tact:156-160`
   (`receive("set_registry")` → `self.proposal_registry = sender()`).
2. `contracts/MerchantPaymentHub.tact:329-337` (balance check + the sole
   `creditBalance` call), `380-389` (`debitBalance`/`creditBalance`),
   `17-22` (comment referencing the removed admin setters / "settlement flow").

## Description

1. To bind a real registry address, the message must *carry* an address, as
   `TransparencyRegistry` does with a typed `message`. As written, the setter
   cannot store anything but the deployer, so the getter is misleading.
2. The contract's non-custodial design deliberately removed admin balance
   controls (#363), but no non-custodial funding mechanism (e.g. a jetton
   deposit handler that credits the depositing account, or a settlement-driven
   credit) replaced them. Without one, the payment entrypoint is unreachable in
   practice. Choosing the correct funding model is a protocol decision the team
   must own — hence **file-only**.

## Impact

- Item 1: `getProposalRegistry()` returns the deployer, never the registry;
  low because nothing security-critical reads it.
- Item 2: on a literal reading of the deployable contract, no payment can
  succeed. Because this is an economics/design decision (and must preserve the
  non-custodial guarantee — no admin-injected balances), it is documented, not
  auto-fixed.

## Suggested Fix (for the contract team — not applied here)

1. Replace `receive("set_registry")` with a typed
   `message SetProposalRegistry { registry: Address }` handler (deployer-only,
   write-once), mirroring `TransparencyRegistry`.
2. Design a non-custodial funding path (e.g. jetton-deposit → credit the
   depositor's `account_balances`, or credit as part of a settlement message)
   and add it deliberately, with tests and a threat-model review. Must not
   introduce admin-controlled balance injection.

## Acceptance Criteria (for the follow-up contract PR)

- [ ] `set_registry` can bind the real registry address (typed message,
      deployer-only, write-once).
- [ ] A documented, non-custodial funding path allows an account to obtain a
      balance so payments can succeed; covered by contract tests.
- [ ] Non-custodial invariants (no admin fund control, no forced transfers)
      remain intact.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- Related: #363 (admin setter removal), #397 (missing account registration),
  `TransparencyRegistry` typed-message pattern.
- Non-custodial rules: `audit/INVARIANTS.md`.

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/414
