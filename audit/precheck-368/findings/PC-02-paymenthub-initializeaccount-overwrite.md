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

## Resolution

**RESOLVED ✅ (Issue #371 / PC-02)** — PR
[#385](https://github.com/xlabtg/tonbankcard-protocol/pull/385), branch
`issue-371-7558ca56d035`.

Account creation is now **write-once**. In `receive(msg: InitializeAccount)`,
immediately after the existing admin authentication, the handler rejects any
write to a live slot (the real field is `nft_address`, not the `account_id`
hypothesised above):

```tact
require(self.accounts.get(msg.nft_address) == null, "Account already initialized");
```

A re-`InitializeAccount` against a funded slot now reverts (Tact hashes the
message to exit code `18265`), so `owner`/`balance` cannot be reassigned and the
`TransferInternalRequest` drain path is closed — restoring I1 (Non-Custodial)
and I3 (No Admin Control over user funds).

The fix also hardens the account **read** path. The former `getOrCreateAccount`
helper persisted a placeholder slot (`self.accounts.set(...)`) on every lookup,
including the free, unauthenticated `GetAccountStateRequest` query. With the
create-once guard in place, that side effect would let anyone permanently squat
an `nft_address` and block its legitimate first initialization — a
denial-of-service. The helper is therefore renamed to `getAccountOrDefault` and
made **read-only**: it returns a transient zero-balance default without writing
to storage. Real account state is persisted only by `InitializeAccount` and by
the atomic balance update in `TransferInternalRequest`.

**Regression coverage:**

- CI grep gate (`contracts/payments/` is outside the CI build/test matrix):
  `contracts/payment-hub/non-production-stubs.spec.ts` — suite
  *"Issue #371 (PC-02): PaymentHub.InitializeAccount is create-once"* asserts the
  guard string + condition are present inside `InitializeAccount` after the admin
  check, and that the read path stays `self.accounts.set(...)`-free.
- Standalone behavioural reproduction:
  `experiments/issue-371-paymenthub-create-once/create-once.repro.spec.ts`
  (4 tests: overwrite rejected, hijack-and-drain rejected, first init still
  succeeds, query cannot squat a slot).

## Acceptance Criteria

- [x] `InitializeAccount` for an already-initialized account is rejected.
- [x] Owner of an existing account cannot be changed by an unauthorized `InitializeAccount`.
- [x] Regression test: initialize + fund account A (owner X), attempt re-`InitializeAccount` as owner Y, assert it reverts and X still owns the balance.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- `audit/INVARIANTS.md` (I1 Non-Custodial)
