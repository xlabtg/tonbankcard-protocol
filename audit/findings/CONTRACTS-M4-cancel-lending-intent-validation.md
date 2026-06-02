---
title: "[CONTRACTS-M4] CancelLendingIntent does not verify intent existence and resets created_at"
severity: medium
area: contracts
priority: medium
stage: 3
labels: ["bug","audit","type:contract","type:security","priority:medium","stage:3-medium"]
---

## Summary

The `CancelLendingIntent` handler in `LendingProtocolCoordinator` mutates intent state without first verifying the intent exists, and it overwrites the original `created_at` timestamp with the current time on cancellation. This can create/overwrite records for non-existent intents and corrupts any time-based logic that depends on the original creation time.

## Severity & Category

- Severity: Medium
- Category: Input validation / Data integrity (missing existence check, timestamp corruption)

## Affected Code

- `contracts/LendingProtocolCoordinator.tact` lines `204-236` (`CancelLendingIntent` handler)

## Description

The cancellation handler does not guard on the intent already existing before it writes back state, so cancelling an unknown `intent_id` can materialize or overwrite a record. In addition, the handler sets `created_at: current_time` as part of the cancellation write, replacing the intent's original creation timestamp rather than preserving it.

## Impact

Cancelling a non-existent intent can create or overwrite a stored record, polluting state. Resetting `created_at` to the cancellation time corrupts the historical creation timestamp, breaking any logic that depends on intent age (expiry windows, ordering, audit trails) and making cancelled records indistinguishable from freshly created ones.

## Suggested Fix

- `require` that the intent exists and is in a cancellable state before mutating.
- Preserve the original `created_at`; record cancellation via a separate `cancelled_at` field and/or a `status` transition only, never overwriting `created_at`.

## Acceptance Criteria

- [ ] Cancelling a non-existent intent reverts and does not create or overwrite any record.
- [ ] Cancelling an existing intent preserves its original `created_at` and updates only status / a dedicated `cancelled_at`.
- [ ] Only cancellable-state intents can be cancelled.
- [ ] Regression test: cancelling an unknown `intent_id` reverts; cancelling a valid intent keeps `created_at` unchanged and reflects the cancelled status.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#282](https://github.com/xlabtg/tonbankcard-protocol/issues/282)
