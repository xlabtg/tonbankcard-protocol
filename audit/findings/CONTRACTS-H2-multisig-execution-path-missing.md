---
title: "[CONTRACTS-H2] MultiSig approved payments have no execution path; PaymentProposalExecuted is dead"
severity: high
area: contracts
priority: high
stage: 2
labels: ["bug","audit","type:contract","type:security","priority:high","stage:2-high"]
---

## Summary

In `MultiSigCard`, once a payment proposal reaches the approval threshold its status is set to `APPROVED`, but no handler or message path transitions it from `APPROVED` to executed or moves any funds. The `PaymentProposalExecuted` event is therefore never emitted, and the multisig state machine terminates without ever performing the approved action.

## Severity & Category

- Severity: High
- Category: Incomplete state machine / Broken functionality (funds never executed)

## Affected Code

- `contracts/MultiSigCard.tact` line `103` (`PaymentProposalExecuted` event definition)
- `contracts/MultiSigCard.tact` approval handler reaching `PROPOSAL_APPROVED` (status set to `APPROVED` with no subsequent execution transition)

## Description

The contract defines a `PaymentProposalExecuted` event and an `APPROVED` terminal status, but the approval handler is the last step in the lifecycle: when the threshold is met, the proposal is marked `APPROVED` and processing stops. There is no `ExecutePaymentProposal` (or equivalent) handler that consumes an `APPROVED` proposal, performs the payment/action, and emits `PaymentProposalExecuted`. As a result the event is unreachable dead code and the approved intent is never carried out on-chain.

## Impact

Users and integrators who rely on the multisig to actually execute an approved payment will find that approval has no effect beyond a status flag. Off-chain indexers waiting for `PaymentProposalExecuted` will never observe it, and any UX or downstream automation keyed on execution will silently stall. This is a functional correctness gap that makes the multisig payment feature non-operational while appearing complete.

## Suggested Fix

- Implement an `ExecutePaymentProposal` handler gated on `status == APPROVED` and on signer / NFT-owner authorization that performs the approved action (e.g. moves funds) and emits `PaymentProposalExecuted`, then transitions the proposal to an `EXECUTED` terminal state.
- If on-chain execution is intentionally out of scope, remove the dead `PaymentProposalExecuted` event and the `APPROVED` terminal status, and document the multisig as advisory-only (approval signaling without on-chain execution).

## Acceptance Criteria

- [ ] An approved proposal can be executed through a dedicated, authorization-gated handler, or the dead event is removed and advisory-only behavior is documented.
- [ ] If execution is implemented, `PaymentProposalExecuted` is emitted exactly once on successful execution and the proposal moves to a distinct executed state.
- [ ] Execution rejects proposals not in `APPROVED` status and rejects unauthorized senders.
- [ ] Regression test: a proposal that reaches threshold can be executed (emitting the event) and cannot be executed twice; an unauthorized or non-approved execution attempt is rejected.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#259](https://github.com/xlabtg/tonbankcard-protocol/issues/259)
