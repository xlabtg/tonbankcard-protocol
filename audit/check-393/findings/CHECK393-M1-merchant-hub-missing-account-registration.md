---
title: Deployable MerchantPaymentHub has no account-registration handler, so nft_owners/account_states stay empty and every payment fails (incomplete #363 remediation)
severity: Medium
area: contracts
priority: medium
stage: 3-medium
labels:
  - bug
  - audit
  - type:contract
  - type:security
  - priority:medium
  - stage:3-medium
  - track:A
---

## Summary

`MerchantPaymentHub` is in the mainnet deployable set and the deploy runbook,
and its payment entrypoint (`MerchantPaymentRequest`) reads ownership/state from
the contract's own `nft_owners` and `account_states` maps. Issue #363 correctly
removed the test-only admin bootstrap handlers
(`SetAccountState`/`SetAccountBalance`) that previously populated those maps,
and the header now states registration "is performed by the NFT Account
Resolver integration." **But no such integration handler exists in the
contract** — there is no `receive` that writes `nft_owners` or `account_states`.
As a result the maps remain permanently empty on a freshly deployed instance,
and every `MerchantPaymentRequest` short-circuits to `ERROR_PAYER_NOT_EXISTS`
(or `ERROR_MERCHANT_NOT_EXISTS`). The deployable contract is non-functional for
its primary purpose.

## Severity & Category

- Severity: Medium
- Category: Incomplete remediation / contract completeness (deployed entrypoint
  non-functional). Fails closed (no fund-safety violation), but the documented
  registration path does not exist.

## Affected Code

- `contracts/MerchantPaymentHub.tact:16-34` (header claims resolver-based
  registration: "Account registration (nft_owners / account_states) is
  performed by the NFT Account Resolver integration, NOT by an admin handler")
- `contracts/MerchantPaymentHub.tact:247-268` (`validateAndExecutePayment`:
  reads `nft_owners.get(payer_nft)` at 257 → `ERROR_PAYER_NOT_EXISTS` at 259;
  `account_states.get(merchant_nft)` at 266 → `ERROR_MERCHANT_NOT_EXISTS` at 268)
- Complete receiver set (none writes `nft_owners`/`account_states`):
  `MerchantPaymentRequest` (223), `ApplyAccountLock` (387),
  `ProposeWhitelistCollection` (405), `ExecuteWhitelistCollection` (419),
  `CancelWhitelistCollection` (436), `MerchantProposeAdminTransfer` (473),
  `MerchantExecuteAdminTransfer` (490), `MerchantCancelAdminTransfer` (510)
- Only `.set` writers: `account_balances` (348/353), `account_locks` (389),
  `whitelisted_collections` (425)
- `scripts/deploy/deployable-contracts.ts:37`, `scripts/deploy/deploy.ts:70`,
  `scripts/deploy/MAINNET_RUNBOOK.md:37,214` (listed as a mainnet contract that
  merchants issue invoices against)
- Contrast — siblings that DO expose a resolver-gated registration receiver:
  `contracts/CollateralSignal.tact:398-401` (`ResolveNFTOwner`),
  `contracts/RecurringPayments.tact:438-439`,
  `contracts/LendingProtocolCoordinator.tact:364-365`,
  `contracts/MultiSigCard.tact:721-722`,
  `contracts/CrossChainBridge.tact:425-426`

## Description

The payment guard depends on locally-stored ownership/state:

```tact
// contracts/MerchantPaymentHub.tact:257-268 (validateAndExecutePayment, abridged)
let payer_owner: Address? = self.nft_owners.get(payer_nft);
if (payer_owner == null) { return ERROR_PAYER_NOT_EXISTS; }      // always taken
// ...
let merchant_state_opt: Int? = self.account_states.get(merchant_nft);
if (merchant_state_opt == null) { return ERROR_MERCHANT_NOT_EXISTS; }
```

Issue #363 removed `SetAccountState`/`SetAccountBalance` (admin-mint/register
backdoors — correct to remove) and moved all logic into the
`MerchantPaymentHubBase` trait. The test suite re-adds the bootstrap handlers
in a **non-deployable harness** (`MerchantPaymentHubHarness`) and runs every
test against the harness, so the production trait logic is exercised only with
maps that the harness pre-seeds. On the real deployable
`contract MerchantPaymentHub` there is no handler — admin or resolver — that
ever writes `nft_owners` or `account_states`. The header documents an "NFT
Account Resolver integration" as the replacement, but unlike every sibling
contract (which all expose a `ResolveNFTOwner` receiver), `MerchantPaymentHub`
exposes none. The remediation removed the backdoor but never landed the
legitimate registration path.

This is independent of the separate, functional `contracts/payments/PaymentHub.tact`
(which registers ownership via `InitializeAccount`); the defect is specific to
the deployable `MerchantPaymentHub`.

## Impact

- A freshly deployed `MerchantPaymentHub` cannot process any merchant payment:
  every `MerchantPaymentRequest` returns `ERROR_PAYER_NOT_EXISTS` /
  `ERROR_MERCHANT_NOT_EXISTS`.
- The mainnet runbook step that has merchants issue invoices against the
  deployed hub cannot succeed.
- The CI regression guard and test suite give false confidence because they run
  against the harness, not the deployable contract.

## Suggested Fix

- Add a resolver-gated, write-once account-registration receiver to
  `MerchantPaymentHub` mirroring the sibling pattern
  (`CollateralSignal.ResolveNFTOwner`): authenticate the trusted NFT Account
  Resolver as `sender()`, then `require(self.nft_owners.get(nft) == null, ...)`
  before `self.nft_owners.set(...)` / `self.account_states.set(...)`.
- Add at least one test that runs against the **deployable** contract (not only
  the harness) and asserts a full payment succeeds end-to-end after legitimate
  registration.
- If the integration genuinely lives in another contract, document and wire the
  exact message/handler so the maps can be populated post-deploy; otherwise
  remove `MerchantPaymentHub` from the deployable set until it is functional.

## Acceptance Criteria

- [ ] A legitimate, authenticated registration path populates `nft_owners` /
      `account_states` on the deployable contract.
- [ ] A payment succeeds end-to-end on the deployable `MerchantPaymentHub`
      (not just the harness) after registration.
- [ ] Regression test exercising the deployable contract's payment happy-path.
- [ ] The header's "NFT Account Resolver integration" claim matches a handler
      that actually exists, or is corrected.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/393
- Incomplete remediation of #363 (`contracts/merchant-hub/merchant-payment-hub.spec.ts`,
  `contracts/payment-hub/non-production-stubs.spec.ts`)
- Sibling reference: `contracts/CollateralSignal.tact:398-401`
- `audit/INVARIANTS.md`

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/397
