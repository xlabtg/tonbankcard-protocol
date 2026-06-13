---
title: UpdateLendingIntent has no state-transition guard and silently resurrects a CANCELLED intent to ACTIVE
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

`UpdateLendingIntent` in `LendingProtocolCoordinator` unconditionally writes
`intent_state: LENDING_INTENT_ACTIVE` for the sender's intent. There is no check
on the existing state, so an intent that was previously `CANCELLED` is silently
flipped back to `ACTIVE` by an update. The asymmetric sibling
`CancelLendingIntent` does guard its transition (`require(existing != null)` and
`require(state == ACTIVE)`), which shows a state machine was intended.

## Severity & Category

- Severity: Low
- Category: State-machine correctness (owner-only, no fund custody)

The handler is owner-gated and the coordinator holds no user funds, so impact is
limited to the intent's lifecycle integrity; hence Low. It is still a real
defect: a cancelled intent should not be revivable through an unrelated update.

## Affected Code

- `contracts/LendingProtocolCoordinator.tact:249-292` (`UpdateLendingIntent` —
  unconditional `intent_state: LENDING_INTENT_ACTIVE` at 272; upsert intent
  visible at 275: `created_at: existing.created_at == 0 ? current_time : existing.created_at`)
- `contracts/LendingProtocolCoordinator.tact:204-241` (`CancelLendingIntent` —
  guarded: `require(existing != null)` at 215, `require(i.intent_state == LENDING_INTENT_ACTIVE)` at 218)
- `contracts/LendingProtocolCoordinator.tact:299-305` (`getLendingIntentInfo`
  returns `defaultLendingIntentInfo()` on null)

## Description

`UpdateLendingIntent` is written as an upsert (it preserves `created_at` when a
prior record exists), so it explicitly contemplates updating an existing intent.
But it hard-codes the resulting state to `ACTIVE` regardless of the prior state:

```tact
// contracts/LendingProtocolCoordinator.tact:272 (abridged)
self.lending_intents.set(sender(), LendingIntent{
    // ...
    intent_state: LENDING_INTENT_ACTIVE,   // <-- unconditional
    created_at: existing.created_at == 0 ? current_time : existing.created_at,
});
```

Because there is no `require(existing == null || existing.intent_state == ACTIVE)`
(or an explicit allowed-transition check), calling `UpdateLendingIntent` after
`CancelLendingIntent` resurrects the cancelled intent. This is **distinct** from
`CONTRACTS-M4`, which addressed only the `Cancel` path's guard.

## Impact

- A cancelled lending intent can be brought back to `ACTIVE` via an update,
  contradicting the cancel semantics the contract otherwise enforces.
- Downstream consumers reading `getLendingIntentInfo` may treat a logically
  cancelled intent as active.

## Suggested Fix

- Add an explicit allowed-transition guard at the top of `UpdateLendingIntent`,
  e.g. `let existing = self.lending_intents.get(sender()); require(existing == null || existing!!.intent_state == LENDING_INTENT_ACTIVE, "intent not updatable")`.
- Document the lending-intent state machine (ACTIVE → CANCELLED terminal) and add
  a regression test: create → cancel → update must fail (or must not return to
  ACTIVE).

## Acceptance Criteria

- [ ] `UpdateLendingIntent` on a `CANCELLED` intent is rejected (or provably
      cannot set state back to `ACTIVE`).
- [ ] State machine documented in the contract.
- [ ] Regression test covers create → cancel → update.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/393
- Related but distinct: `CONTRACTS-M4` (Cancel-path guard)
- `audit/INVARIANTS.md`
