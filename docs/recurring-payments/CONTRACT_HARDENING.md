# Recurring Payments — Contract Hardening Track (post-A2)

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **no contract code shipped until A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document collects every contract-level change planned for the
recurring-payments module as part of production hardening. The
changes are intentionally **deferred** past the A2 audit baseline —
landing any of them before A2 returns verdict `READY` would
invalidate the audit scope and reset the engagement clock.

The pattern mirrors the F3 PR #206 approach for the cross-chain
bridge (issue #138): governance documents, off-chain validators, and
tests land now under issue #139; contract code lands later, in a
follow-up PR that explicitly cites this document and the A2 verdict.

Every other recurring-payments production-readiness document
([`SPECIFICATION.md`](./SPECIFICATION.md),
[`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`MONITORING.md`](./MONITORING.md),
[`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md),
[`BUG_BOUNTY.md`](./BUG_BOUNTY.md)) references **RP-CH-N** items by
ID from §3 below — this is the single source of truth for the
contract changes the recurring-payments production launch depends on.

---

## 2. Why deferred (not "future-work")

Issue #139 §8 names A2 as a **hard prerequisite**:

> _"AC-1: A2 audit complete (prerequisite). Phase 4 contract audit
> (`A2-phase4-contracts`) returns verdict `READY`; no critical or
> high finding remains open against `RecurringPayments.tact`."_

The A2 engagement
([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
locks the contract artefact at a specific commit hash so that the
auditor can sign off on a single bytecode. Changing any line of
[`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact)
ahead of the audit:

1. Invalidates the auditor's bytecode hash.
2. Resets the clock on the threat-catalogue review (X-1, X-5,
   C-RP-H1..H3 from the A2 engagement scope).
3. Disqualifies the deployment manifest from the
   recurring-payments mainnet ceremony documented in
   [`TESTNET_DEPLOYMENT.md` §7](./TESTNET_DEPLOYMENT.md).

Therefore each RP-CH-N item below is **designed but not landed**
under issue #139. Landing happens in a follow-up issue referencing
this document, gated by the conditions in §4.

---

## 3. Hardening Backlog

Each row below has the same shape: the threat it closes, the
contract diff in shape (not in literal code), and the cross-document
references that flip from "operationally mitigated" to "closed
on-chain" once the change ships.

### RP-CH-1 — Composite-key hardening (`mandateKey`)

**Closes threat:** T-RP-1 mandate-key collision
([`SPECIFICATION.md` §9](./SPECIFICATION.md)), A2 §X-5 / C-RP-H1
(structurally identical to the bridge CH-2 finding).

**Shape of change:**

| Element | Change |
|---------|--------|
| `mandateKey` ([contract line 402](../../contracts/RecurringPayments.tact)) | Replace `sha256(addr.asSlice()) + id` with a domain-separated keyed hash: `sha256(beginCell().storeSlice("MANDATE_KEY_V1".asSlice()).storeAddress(nft_address).storeUint(mandate_id, 64).endCell().asSlice())`. |
| Storage shape | No change to `mandates` map shape (still `map<Int, MandateInfo>`); only the key derivation function changes. |
| Backwards compatibility | None required — the contract has not gone live, so no pre-existing mandates to migrate. |
| Error code | No new code required — collision attempts already fall through to `ERROR_RP_MANDATE_NOT_FOUND = 4`. |
| Getters | Existing `getMandate(nft_address, mandate_id)` is unchanged at the ABI level (it still re-derives the key internally). |

**Migration:** None — the testnet-only deployment from
[`TESTNET_DEPLOYMENT.md` §4](./TESTNET_DEPLOYMENT.md) is throwaway
state.

**Tests required at landing:** unit test that constructs two
addresses whose `sha256` distance equals an attacker-chosen `Δ`,
issues two mandates with `mandate_id` values differing by `Δ`, and
asserts they land in distinct keys (would have collided under the
old combinator). Identical-shape test to F3 CH-2.

**Doc references that update:** [`SPECIFICATION.md`
§11.1](./SPECIFICATION.md) marks T-RP-1 closed and removes the
adapter-side `generateMandateId()` defence-in-depth note;
[`MONITORING.md` §3.2](./MONITORING.md) drops the
collision-suspect L1 alert SUB-M07 (kept as defence in depth at L1).

### RP-CH-2 — Remove test-only `RegisterNFTOwnerRecurring`

**Closes threat:** T-RP-6 test-only handler reaches mainnet
([`SPECIFICATION.md` §9](./SPECIFICATION.md), A2 §X-1).

**Shape of change:**

| Element | Change |
|---------|--------|
| `RegisterNFTOwnerRecurring` handler ([contract lines 428–432](../../contracts/RecurringPayments.tact)) | Remove from mainnet build. Either delete unconditionally, or gate behind a Tact `#ifdef TESTING` equivalent if Tact gains conditional compilation by then. |
| Message type `RegisterNFTOwnerRecurring` ([contract lines 436–439](../../contracts/RecurringPayments.tact)) | Remove from mainnet build. |
| `self.deployer` storage field | Remains for two-phase admin transfer used by RP-CH-3; not removed by this item. |
| Production NFT-owner seeding | Replaced by integration with `DiamondMintingHub.tact` (NFT-card ownership flows directly from the mint-hub state) — see [`SPECIFICATION.md` §7.1](./SPECIFICATION.md) note on `nft_owners` source-of-truth. |

**Migration:** The mainnet deployment ceremony documented in
[`TESTNET_DEPLOYMENT.md` §7](./TESTNET_DEPLOYMENT.md) populates the
production `nft_owners` view via the integration handler, never via
the test-only register.

**Tests required at landing:** assert the mainnet artefact does not
export `RegisterNFTOwnerRecurring`; assert the test-suite uses the
production owner-resolution path (mirrored from the F3 CH-7 test
pattern).

**Doc references that update:** [`SPECIFICATION.md` §7.1
Test-only handler](./SPECIFICATION.md) is removed entirely from the
mainnet doc set; [`docs/governance/PARAMETERS.md`
§8.6 PP-40](../governance/PARAMETERS.md) strikes through the
`RecurringPayments` row.

### RP-CH-3 — Pause flag (`PauseRecurringPayments` / `UnpauseRecurringPayments`)

**Closes:** Issue #139 §7 _"manual pause must be available"_ and the
auto-pause auto-trigger from [`MONITORING.md`
§3.6 SUB-M18](./MONITORING.md). The wallet pause/resume UX
([`WALLET_UX.md` §5](./WALLET_UX.md)) also blocks on this item.

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `paused: Bool` (default `false`). |
| Storage | Add `rp_admin: Address` initialised to `self.deployer` at init and transferable via the two-phase pattern from `PaymentHub.tact` (PP-15) with 7-day timelock. |
| Messages | `message PauseRecurringPayments { reason_code: Int as uint8; }`, `message UnpauseRecurringPayments { /* empty */ }`. |
| Authority | Both gated by `sender() == self.rp_admin`. |
| `receive(ExecuteRecurringPayment)` | Add `require(!self.paused, ...)`; return `ERROR_RP_PAUSED = 10`. |
| `receive(CreateMandate)` | Same gate — no new subscriptions during a pause. |
| `receive(CancelMandate)` | **Not** gated by `paused` — non-custodial invariant I1 requires that users always retain the right to cancel. |
| Per-mandate pause | Optional `message PauseMandate { nft_address; mandate_id; }` / `ResumeMandate { ... }` gated by `sender() == self.isOwner(...)` so a single user can pause their own mandate without governance involvement. The merchant cannot pause; only the NFT owner (I2). |
| Events | `RecurringPaymentsPaused { reason_code, timestamp }`, `RecurringPaymentsResumed { timestamp }`, `MandatePaused { nft_address, mandate_id, timestamp }`, `MandateResumed { nft_address, mandate_id, timestamp }`. |
| Getters | `get fun isPaused(): Bool`, `get fun isMandatePaused(nft_address: Address, mandate_id: Int): Bool`. |

**Migration:** Initial `paused = false`. Initial `rp_admin` is the
deployer at init; the mainnet ceremony transfers it to the
recurring-payments multi-sig via the two-phase pattern.

**Tests required at landing:** pause/resume flow at both the
contract-wide and per-mandate granularity; pause must reject create
& execute but allow cancel; only `rp_admin` can pause globally; only
the NFT owner can pause an individual mandate; emergency pause
rejects unauthorised sender with `ERROR_RP_NOT_AUTHORIZED = 9`.

**Doc references that update:** [`WALLET_UX.md`
§5](./WALLET_UX.md) drops the conditional _"Until RP-CH-3 lands"_
language; [`MONITORING.md` §3.6 SUB-M18](./MONITORING.md) flips from
_"manual escalation"_ to _"automated pause arms within 30 min"_.

### RP-CH-4 — `MandateLapsed` event

**Closes:** the polling-worker overhead noted in
[`SPECIFICATION.md` §6.2](./SPECIFICATION.md) and the indexer-derived
status calculation in
[`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md). Today
the indexer derives `lapsed` from `now() - last_executed_at >
period_seconds + grace_seconds`; RP-CH-4 emits a dedicated event
the moment it becomes observable on-chain, so the indexer no longer
needs a wall-clock polling pass.

**Shape of change:**

| Element | Change |
|---------|--------|
| Event | `event MandateLapsed { nft_address: Address; mandate_id: Int; lapsed_at: Int as uint32; period_seconds: Int as uint32; grace_seconds: Int as uint32; }`. |
| Emission trigger | First message after the lapse window opens (any subsequent `ExecuteRecurringPayment`, `CancelMandate`, or a new dedicated `PokeMandate` message) inspects `now() - mandate.last_executed_at > period_seconds + grace_seconds` and emits the event exactly once per `(nft_address, mandate_id, lapse_cycle)` tuple. |
| Idempotency | Add `lapsed_at: Int` (uint32) to `MandateInfo` — set to `0` initially; on emission, set to the lapse timestamp; on a subsequent successful `ExecuteRecurringPayment` (i.e. the lapsed mandate recovers within the same active state) the field is reset to `0`. |
| `PokeMandate` message | New zero-state-change message that **only** triggers the lapse check + event emission; anyone can call it (no auth) so an off-chain watchdog can force the event without paying merchant gas. |
| Error code | No new error code. `PokeMandate` is a no-op when the mandate has not lapsed yet. |

**Migration:** Existing `MandateInfo` rows get `lapsed_at = 0` by
default (Tact map nullable semantics).

**Tests required at landing:** time-travel test asserting the event
fires exactly once at the first observation past the lapse window;
event does not re-fire on subsequent pokes; event resets after a
successful execution.

**Doc references that update:** [`SPECIFICATION.md`
§6.2](./SPECIFICATION.md) marks RP-CH-4 closed and removes the
indexer-polling note; [`DASHBOARD_INTEGRATION.md`
§4.1](./DASHBOARD_INTEGRATION.md) status table cites the on-chain
event instead of the off-chain derivation.

### RP-CH-5 — Merchant-address allow-list (whitelist of payment destinations)

**Closes threat:** T-RP-4 merchant-address substitution
([`SPECIFICATION.md` §9](./SPECIFICATION.md)). Today the user
signs `CreateMandate{ merchant_address }` and trusts that the
wallet-ui rendered the correct address from the dashboard plan; an
attacker who controls the dashboard CDN could swap the address.
RP-CH-5 anchors the merchant address to the dashboard's
governance-published merchant registry.

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `merchant_registry: map<Address, Bool>` (key = registered merchant address, value = `true`). |
| New message | `message RegisterMerchant { merchant_address: Address; }` gated by `sender() == self.rp_admin` (the same admin introduced by RP-CH-3). |
| `receive(CreateMandate)` | Add `require(self.merchant_registry.get(msg.merchant_address) == true, "Merchant not registered");` returning `ERROR_RP_MERCHANT_NOT_REGISTERED = 11`. |
| Eventing | `MerchantRegistered { merchant_address, timestamp }`, `MerchantRevoked { merchant_address, timestamp }`. |
| Revocation | `message RevokeMerchant { merchant_address }` toggles the entry to `false`. Existing mandates are **not** retroactively invalidated; only **new** `CreateMandate` against the revoked merchant is rejected. |
| Getters | `get fun isMerchantRegistered(merchant_address: Address): Bool`. |

**Migration:** Genesis merchant list registered by the deployment
ceremony via `RegisterMerchant` transactions signed by the
recurring-payments multi-sig (post-A2).

**Tests required at landing:** allow-list happy path; rejected
`CreateMandate` against an unregistered merchant returns
`ERROR_RP_MERCHANT_NOT_REGISTERED`; revocation does not retroactively
cancel existing mandates; only `rp_admin` can register/revoke.

**Doc references that update:** [`SPECIFICATION.md`
§11.1 T-RP-4](./SPECIFICATION.md) flips to closed on-chain;
[`DASHBOARD_INTEGRATION.md` §3](./DASHBOARD_INTEGRATION.md) plan
creation validates the merchant against the on-chain registry
before publishing the plan link.

---

## 4. Sign-off Gating

RP-CH-N items may only land in a follow-up PR after **all** of the
following conditions hold:

1. **A2 verdict.** A2 audit
   ([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
   returns verdict `READY` and the corresponding `STATUS.md` is
   updated.
2. **No critical/high outstanding.** A2 final report lists zero
   open critical or high findings against
   `contracts/RecurringPayments.tact`.
3. **Mainnet ceremony scheduled.**
   `docs/deployments/recurring-payments-mainnet/multisig.recurring.json`
   exists with `threshold >= 2` and `eoa: false` for every signer.
4. **Recurring-payments readiness validator green.**
   [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
   reports `OK` on the proposed PR's branch.
5. **PR scope.** The follow-up PR contains **only** the RP-CH-N
   changes listed in this document (no new features). Each RP-CH-N is
   a separate commit; the PR body references the RP-CH-N IDs in 1:1
   correspondence with commits.

A PR that touches `contracts/RecurringPayments.tact` without
satisfying all five conditions must be rejected by the CI guardrail
in §5.

---

## 5. CI Guardrail

The CI check at
[`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
(planned — issue #139, this PR) implements the following rules:

| Rule | Applies to | Action on violation |
|------|-----------|---------------------|
| **R-RP-CH-1** | Any PR touching `contracts/RecurringPayments.tact` | Verify `docs/security/audits/A2-phase4-contracts/STATUS.md` shows `verdict: READY` and `branch: <PR-base-branch>`. Fail otherwise. |
| **R-RP-CH-2** | Any PR touching `docs/recurring-payments/*.md` | Verify every `RP-CH-N` reference resolves to a §3 row here. Fail on dangling refs. |
| **R-RP-CH-3** | Any PR touching `contracts/RecurringPayments.tact` | Verify a corresponding `RP-CH-N` entry exists in §3 (no surprise contract changes). Fail otherwise. |
| **R-RP-CH-4** | Release-tag workflow | Verify `RegisterNFTOwnerRecurring` is absent from the mainnet artefact (PP-40 / RP-CH-2 enforcement). |
| **R-RP-CH-5** | Any PR touching `docs/governance/PARAMETERS.md` PP-RP-* rows | Verify the values match this document's §3 rows (period bounds, grace defaults, merchant-registry semantics). |

The validator is the analogue of
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(F3) and runs on every PR touching the recurring-payments surface.

---

## 6. Cross-reference summary

| RP-CH-N | Closes | Where it is referenced |
|---------|--------|------------------------|
| **RP-CH-1** | T-RP-1 / X-5 | [`SPECIFICATION.md` §3.2, §9](./SPECIFICATION.md), [`MONITORING.md` §3.2](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **RP-CH-2** | T-RP-6 / X-1 | [`SPECIFICATION.md` §7.1, §9](./SPECIFICATION.md), [`docs/governance/PARAMETERS.md` §8.6](../governance/PARAMETERS.md) |
| **RP-CH-3** | Manual pause + auto-trigger | [`WALLET_UX.md` §5](./WALLET_UX.md), [`MONITORING.md` §3.6](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **RP-CH-4** | Indexer-polling overhead | [`SPECIFICATION.md` §6.2](./SPECIFICATION.md), [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md), [`MONITORING.md` §3.3](./MONITORING.md) |
| **RP-CH-5** | T-RP-4 merchant substitution | [`SPECIFICATION.md` §9](./SPECIFICATION.md), [`DASHBOARD_INTEGRATION.md` §3](./DASHBOARD_INTEGRATION.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |

---

## 7. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §2, §4 — gates every RP-CH-N on `verdict: READY`. |
| AC-2 | `SPECIFICATION.md` written | §3 RP-CH-N rows are the on-chain landing plan for the threats catalogued in [`SPECIFICATION.md` §9](./SPECIFICATION.md). |
| AC-5 | Wallet cancel/pause/resume UX | RP-CH-3 closes the on-chain side; [`WALLET_UX.md` §5](./WALLET_UX.md) is the off-chain UX. |
| AC-6 | User notification system | RP-CH-4 (`MandateLapsed`) lets the notification scheduler ([`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md)) consume on-chain events instead of polling. |
| (cross) | PP-40 cleanup | RP-CH-2 removes test-only handlers per [`PARAMETERS.md` §8.6](../governance/PARAMETERS.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Parameter inventory    | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) |
| CI validator (planned) | [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts) |
| Pattern: F3 validator  | [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
