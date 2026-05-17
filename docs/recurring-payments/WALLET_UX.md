# Recurring Payments — Wallet-UI Subscription UX

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the user-facing wallet flows for subscribing
to, viewing, cancelling, and (post-RP-CH-3) pausing / resuming a
recurring payment mandate. It is the source of truth for Issue #139
§3 _"Subscription management UX in wallet-ui"_ and §8 acceptance
criterion **AC-5** _"Wallet cancel/pause/resume UX: subscription list
view, one-tap cancel, pause/resume support, history view"_.

The UX preserves invariants **I1 (Non-Custodial)**, **I2 (NFT
Authority)**, **I3 (No Admin Control)**. The wallet **never** auto-signs
subscription messages; every state-changing action emits a fresh TON
Connect signature prompt.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §8 — _"AC-5: Wallet cancel/pause/resume UX"_.

Indirectly informs AC-2 (subscribe is the on-chain entry to the
mandate format in [`SPECIFICATION.md` §3](./SPECIFICATION.md)) and
AC-8 (wallet-ui test bar of **28 tests** asserted in
[`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md)).

---

## 3. Subscribe flow (TON Connect)

### 3.1 Entry point

The merchant shares a plan link from
[`DASHBOARD_INTEGRATION.md` §3](./DASHBOARD_INTEGRATION.md):

```
https://pay.tonbankcard.com/sub/<plan_id>
```

Opening the link in the wallet (deep-link `tonkeeper://`,
`tonconnect://`, etc.) loads `wallet-ui/SubscribePage`.

### 3.2 Authorization sheet

The wallet-ui fetches the plan, validates it against the dashboard
public-key signature, and presents an authorization sheet to the user.
The sheet shows — verbatim:

| Field | Source | Display rule |
|-------|--------|--------------|
| Merchant name | `plan.name` from dashboard | Truncated at 64 chars |
| Merchant NFT card | `plan.merchant_nft_address` | Linked to public NFT viewer |
| Amount | `plan.amount_per_period` | TBC amount with token icon |
| Billing period | `plan.billing_period` | One of "Daily" / "Weekly" / "Every 30 days (monthly)" / "Every 365 days (annual)" — see [`SPECIFICATION.md` §4.2](./SPECIFICATION.md) for why monthly = 30 d / annual = 365 d |
| Max executions | `plan.max_executions` | "Unlimited" if 0, else `"n payments"` |
| Grace period | `plan.grace_seconds` or default 604800 | "7 days" by default (see [`SPECIFICATION.md` §6.1](./SPECIFICATION.md)) |
| Next payment | `now()` (first execution is immediate) | "Today" |
| Cancel anytime | static text | "You can cancel from this wallet at any time." |

The sheet also displays the **on-chain mandate ID** (the `mandate_id`
the wallet-ui generates and embeds into `CreateMandate`) and a copy
button so the user has an out-of-band reference.

### 3.3 Signature

The user taps **"Authorize"**. TON Connect surfaces the
`CreateMandate` message with the exact fields from §3.2 mapped into
the [`SPECIFICATION.md` §3.1](./SPECIFICATION.md) struct. The user
signs in the wallet (Tonkeeper, MyTonWallet, etc.). The wallet-ui
**never** holds a session-scoped key — there is no "keep this card
signed in" toggle on the subscribe surface.

### 3.4 Failure modes (post-signature)

| On-chain error code | UX reaction |
|---------------------|-------------|
| `ERROR_RP_NFT_NOT_REGISTERED` (8) | Show "Your NFT card is not yet registered with the protocol. Tap to register before subscribing." (Diamond minting flow.) |
| `ERROR_RP_NOT_OWNER` (1) | Show "This wallet does not own the selected NFT card. Switch wallets and retry." |
| `ERROR_RP_INVALID_AMOUNT` (2) | Show "This plan has an invalid amount. Contact the merchant." Mark plan invalid in wallet-ui cache. |
| `ERROR_RP_INVALID_PERIOD` (3) | Show "This plan has an invalid billing period. Contact the merchant." |

The numeric codes match `contracts/RecurringPayments.tact` lines
98–107 and the registry in [`docs/error-codes.md`](../error-codes.md).

---

## 4. Subscription list view

`Wallet → My subscriptions` shows the user's outstanding mandates
(deduplicated across all NFT cards the wallet controls).

### 4.1 List columns

| Column | Source | Sortable |
|--------|--------|----------|
| Merchant | `merchant_address` resolved via dashboard public profile | by name |
| Amount × period | `amount_per_period` × period label | by amount |
| Next payment | `last_executed_at + period_seconds` | by date |
| Status | `active` / `cancelled` / `expired` per [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md) | by status |
| Total paid | Σ over `RecurringPaymentExecuted` | by amount |

Each row is tap-expandable to the detail sheet (§4.3).

### 4.2 One-tap cancel

Cancellation is exposed as a single action in the row's swipe menu
(iOS / Android pattern) and as a button in the detail sheet.

1. User taps **"Cancel subscription"**.
2. Wallet-ui shows a confirmation: "This will stop **{merchant}**'s
   subscription. The merchant cannot restart it without your
   approval." with **Cancel** / **Confirm**.
3. On Confirm, wallet-ui constructs `CancelMandate{ nft_address,
   mandate_id }` and triggers TON Connect signature.
4. Once `MandateCancelled` is observed by the indexer, the row
   transitions to `cancelled` and is moved to the "Inactive" section.

This satisfies Issue #139 §6 NFR: _"Cancellation: Effective before
next billing cycle"_. Because the on-chain `CancelMandate` is
processed in the next block (≤ 5 s on TON mainnet) and §5.2 of
[`SPECIFICATION.md`](./SPECIFICATION.md) gates execution on
`MANDATE_ACTIVE`, the cancellation is **always** effective before the
next billing window opens.

### 4.3 Detail sheet (history)

Tapping a row opens the detail sheet:

- Header: merchant name + amount per period.
- Status pill.
- Next payment / last payment.
- **History list:** one row per `RecurringPaymentExecuted` event,
  newest first, with timestamp, amount, on-chain tx link.
- Footer:
  - if `active`: **Cancel** button.
  - if `cancelled` / `expired`: subscribe-again link to the merchant
    plan page (if still active).

---

## 5. Pause / resume (post-RP-CH-3)

Issue #139 §8 AC-5 mentions "pause/resume support". The current
contract has **no** pause flag; pause/resume are exposed in the UX
**only after** the hardening item RP-CH-3
([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)) ships in a
follow-up PR.

Until RP-CH-3 lands, the wallet UI surfaces pause as **"Cancel and
re-subscribe later"** with explicit copy:

> "Pause is coming with the next protocol update. To stop billing
> temporarily, cancel this subscription. You can re-subscribe to the
> same plan when ready."

Post-RP-CH-3 the wallet-ui will surface a true `PauseMandate` action
(separate signature) and a `ResumeMandate` action; the UX wiring is
specified here so the post-RP-CH-3 follow-up PR is just an
implementation diff against the **existing** documented surface:

| Action | Message constructed | TON Connect prompt |
|--------|---------------------|---------------------|
| Pause  | `PauseMandate { nft_address, mandate_id }` | "Pause **{merchant}**'s subscription? Billing will not resume until you tap **Resume**." |
| Resume | `ResumeMandate { nft_address, mandate_id }` | "Resume **{merchant}**'s subscription? Billing will start again at the next scheduled period." |

A paused mandate is displayed in the **Inactive** section with a
**Resume** action visible.

---

## 6. Notifications hook

The wallet-ui registers a notification token per
[`NOTIFICATIONS.md` §4](./NOTIFICATIONS.md). The token is
**opt-in**; the subscribe flow surfaces an enable-notifications prompt
**once** after the first successful `CreateMandate`. The prompt copy
is:

> "Get a heads-up 3 days before each billing. We'll send a single
> push per subscription. You can turn this off anytime in Settings."

The notification path is described in
[`NOTIFICATIONS.md` §§3–4](./NOTIFICATIONS.md). The wallet stores the
opt-in choice locally and pushes it to the notifications backend via
the existing user-preference endpoint.

---

## 7. Invariant preservation

| Invariant | Where the wallet UX could break it | Mitigation here |
|-----------|------------------------------------|------------------|
| **I1 Non-Custodial** | Auto-signed `ExecuteRecurringPayment` on schedule | The wallet **never** auto-signs anything — every signature is user-initiated. Execute is dispatched by the merchant executor ([`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md)) under the merchant's own key. |
| **I2 NFT Authority** | Subscribing without owning the NFT | `CreateMandate` requires `sender() == owner(nft_address)`; the wallet-ui filters the NFT picker to wallet-owned cards (§3.4). |
| **I3 No Admin Control** | "Cancel-on-behalf" admin button | No such button exists; `CancelMandate` is gated on the NFT owner's signature (§4.2). |

---

## 8. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-2 | `SPECIFICATION.md` written | §3.2 binds the on-chain mandate format display verbatim to [`SPECIFICATION.md` §3.1 / §4.2](./SPECIFICATION.md). |
| AC-5 | Wallet cancel/pause/resume UX | This document (§§3, 4, 5). |
| AC-6 | User notification system | §6 registers the wallet-side opt-in path documented in [`NOTIFICATIONS.md`](./NOTIFICATIONS.md). |
| AC-7 | End-to-end testnet flow | §3 + §4 = the subscribe + cancel happy path verified in [`TESTNET_DEPLOYMENT.md` §5](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Wallet-ui tests (28) pass | §§3–6 form the surface for the 28-test bar in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| Wallet compatibility   | [`docs/wallet-compatibility.md`](../wallet-compatibility.md) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
