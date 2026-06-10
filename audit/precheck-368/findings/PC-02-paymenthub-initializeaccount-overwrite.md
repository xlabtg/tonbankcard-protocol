---
title: PaymentHub.InitializeAccount overwrites an existing account's owner and balance, enabling fund drain
severity: High
area: contracts/payments
priority: high
stage: 1-critical
labels:
  - bug
  - type:security
  - type:contract
  - priority:high
  - audit
  - stage:1-critical
---

## Summary

`PaymentHub.tact`'s `receive(msg: InitializeAccount)` unconditionally writes `balance` and `owner` for the target account with **no "account does not already exist" guard**. An attacker can re-initialize an account that already holds a balance, reassigning `owner` to themselves, and then drain it — because transfer authorization later checks `sender() == from_account.owner`.

## Severity & Category

- Severity: High
- Category: Access Control / Non-custodial invariant (I1) violation

## Affected Code

- `contracts/payments/PaymentHub.tact:340-352` (`receive(msg: InitializeAccount)` — no existence guard)
- `contracts/payments/PaymentHub.tact:243` (`TransferInternalRequest` requires `sender() == from_account.owner`)
- Sibling for contrast: `MerchantPaymentHub` `SetAccountBalance` includes the `existing == null` guard (lines ~320-325)

## Description

The initializer overwrites state directly:

```tact
receive(msg: InitializeAccount) {
    // sets balance and owner for msg.account_id unconditionally
    // no `require(self.accounts.get(msg.account_id) == null, ...)`
}
```

The sibling contract `MerchantPaymentHub` demonstrates the intended pattern — it guards against overwriting an existing account. `PaymentHub` omits this guard, so `InitializeAccount` is idempotent-by-overwrite rather than create-once.

Because `TransferInternalRequest` authorizes a transfer with `require(sender() == from_account.owner)`, reassigning `owner` via a second `InitializeAccount` is sufficient to take control of any balance.

## Impact

- An attacker re-initializes a funded account, sets `owner` to an address they control, and transfers the balance out.
- Direct violation of the Non-Custodial invariant (I1): account funds become controllable by a third party.

## Suggested Fix

- Add `require(self.accounts.get(msg.account_id) == null, "account exists")` to `receive(msg: InitializeAccount)`, mirroring the `MerchantPaymentHub` guard.
- If re-initialization is a legitimate flow, gate it behind the current owner's authorization rather than allowing anonymous overwrite.

## Acceptance Criteria

- [ ] `InitializeAccount` for an already-initialized account is rejected.
- [ ] Owner of an existing account cannot be changed by an unauthorized `InitializeAccount`.
- [ ] Regression test: initialize + fund account A (owner X), attempt re-`InitializeAccount` as owner Y, assert it reverts and X still owns the balance.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- `audit/INVARIANTS.md` (I1 Non-Custodial)
