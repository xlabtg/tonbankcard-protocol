# Recurring Payments — Notification System

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the user notification system for recurring
payments: the **3-days-before-billing** heads-up notification
mandated by Issue #139 §3, plus the post-billing receipts and the
grace-period lapse notifications.

It is the source of truth for Issue #139 §8 acceptance criterion
**AC-6** _"User notifications: 3 days before billing"_.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §8 — _"AC-6: User notifications: 3 days before billing"_.

The notification system also directly enables the NFR _"Upcoming
payment notifications, 3 days before"_ in Issue #139 §6.

---

## 3. Notification catalogue

Each notification below has a unique ID (`RP-Nxx`), a trigger, the
delivery channels, and an opt-in/opt-out posture.

### 3.1 Upcoming-payment notifications

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **RP-N01** | Mandate has `last_executed_at + period_seconds - now()` in `[259200, 262800)` (i.e. T-3d ± 30 min) and `status == MANDATE_ACTIVE` | Push (wallet-ui) + email (if user provided) | Opt-in by default at first subscription ([`WALLET_UX.md` §6](./WALLET_UX.md)) |
| **RP-N02** | Same condition with T-1d (`[86400, 90000)`) and `notify_T_1d` user-preference flag set | Push | Opt-out by default — surfaced only on the **first** T-3d alert with an "Also remind me 1 day before" prompt |
| **RP-N03** | First subscription's first execution about to fire (i.e. `last_executed_at == 0` and indexer detects merchant has just dispatched `ExecuteRecurringPayment`) | Push only | Always-on (first-execution acknowledgement; cannot be turned off without disabling the mandate) |

The `259200 = 3 × 86400` and `86400` constants are the T-3d and T-1d
thresholds; the `30 min` (`1800 s`) window is the granularity of the
notification cron — see §5.

### 3.2 Post-billing receipts

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **RP-N04** | `RecurringPaymentExecuted` event observed by indexer for one of the user's mandates | Push | Opt-in by default |
| **RP-N05** | Same, but to merchant for revenue tracking | Webhook only (no user-facing channel) | n/a — merchant subscribes via dashboard webhook config |

### 3.3 Status-change notifications

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **RP-N06** | `MandateCancelled` event for one of the user's mandates | Push | Always-on (cancellation is user-initiated, so this is an acknowledgement) |
| **RP-N07** | `MandateCompleted` (max_executions reached) for one of the user's mandates | Push | Opt-in by default |
| **RP-N08** | Grace-period lapse — dashboard derives `now() - last_executed_at > period_seconds + grace_seconds` (see [`SPECIFICATION.md` §6](./SPECIFICATION.md)) | Push + email | Always-on |

---

## 4. Channels

### 4.1 Push notifications

The wallet-ui registers a push token at first subscribe
([`WALLET_UX.md` §6](./WALLET_UX.md)). The notification service
stores `(user_id, push_token, platform)` in the
`notifications.subscriptions` table.

Push payload (FCM / APNS, normalized):

```json
{
  "title": "Upcoming subscription payment",
  "body": "{{merchant_name}} will charge {{amount}} TBC in 3 days.",
  "data": {
    "type": "RP-N01",
    "nft_address": "EQ...",
    "mandate_id": "5",
    "next_payment_at_unix": 1747987200
  }
}
```

The payload contains **no PII**. The merchant name comes from the
dashboard plan record; the amount is the on-chain `amount_per_period`.

### 4.2 Email

For users who supply an email address (optional, captured at first
subscribe via a checkbox), the notification service dispatches
templated email via Postmark (existing transactional-email
infrastructure).

Email is **disabled by default** for RP-N01..RP-N04. Email is
**enabled by default** for RP-N08 (grace-period lapse) because the
user has typically already missed the push by then.

### 4.3 Webhook (merchant)

The merchant configures a webhook URL in the dashboard. The
notification service POSTs the following events:

- `subscription.created` — on `MandateCreated`.
- `subscription.executed` — on `RecurringPaymentExecuted`.
- `subscription.cancelled` — on `MandateCancelled`.
- `subscription.completed` — on `MandateCompleted`.
- `subscription.lapsed` — on grace-period lapse per
  [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md).

Webhook auth uses the existing HMAC-SHA256 scheme from the merchant
API. Replay protection: payload includes `event_id` (UUID v4) and
`timestamp`; merchants reject duplicates by `event_id`.

---

## 5. Scheduling

The notification scheduler is a cron worker
(`backend/services/notification-scheduler.ts`, planned) that runs
every 30 minutes and:

1. Scans `MandateInfo` snapshots for mandates with
   `status == MANDATE_ACTIVE`.
2. For each, computes `t_next = last_executed_at + period_seconds`
   (or `created_at` if `last_executed_at == 0`).
3. For each `(id, t_next)` it has not yet sent RP-N01 for, if
   `t_next - now() ∈ [259200, 262800)`, dispatch RP-N01.
4. Same logic for RP-N02 with `t_next - now() ∈ [86400, 90000)`.
5. Dedup via `notifications.delivery_log` keyed by
   `(user_id, mandate_id, notification_id, t_next)`.

### 5.1 Idempotency

Each notification is identified by
`(user_id, mandate_id, RP-Nxx, t_next)`. Re-running the scheduler
(crash recovery, manual replay) does **not** double-send because the
dedup key incorporates the targeted execution boundary `t_next`.

### 5.2 Failure modes

| Failure | Recovery |
|---------|----------|
| Push token expired (FCM 410, APNS 410) | Remove token from `notifications.subscriptions`; do not retry. Email fallback only if RP-Nxx has email enabled. |
| FCM 5xx / APNS 5xx | Retry with exponential backoff (1 m, 5 m, 15 m). After 3 failures, mark `t_next` row failed but proceed to RP-N02 still. |
| Email 5xx | Same retry policy via Postmark's existing scheduler. |
| Webhook 5xx | Existing merchant-webhook retry policy applies. |

---

## 6. Opt-in / opt-out controls

Issue #139 §6 does not mandate fine-grained controls, but the
wallet-ui exposes them in `Settings → Notifications → Subscriptions`
to honour privacy norms:

| Toggle | Default | Persists |
|--------|---------|----------|
| Push (T-3d) RP-N01 | ON | user-preference DB |
| Push (T-1d) RP-N02 | OFF | user-preference DB |
| First-execution RP-N03 | ON (immutable) | n/a |
| Receipt RP-N04 | ON | user-preference DB |
| Cancellation RP-N06 | ON (immutable) | n/a |
| Completion RP-N07 | ON | user-preference DB |
| Grace-lapse RP-N08 | ON (immutable) | n/a |
| Email (all) | OFF (until address verified) | user-preference DB |

The wallet-ui synchronises the preference flags to the notification
service via the existing user-preference endpoint.

---

## 7. Privacy posture

The notification service stores:

- `(user_id, push_token, platform, opt_in_flags)` — required for
  delivery.
- `(user_id, mandate_id, RP-Nxx, t_next, status)` — delivery log for
  idempotency and replay.

It does **not** store:

- The user's NFT private key (the protocol never sees it).
- The merchant's executor key (the merchant's KMS does).
- TBC amounts beyond what the user sees on-screen at subscribe time
  (the amount is **not** encrypted — it is part of the on-chain
  mandate by design; the notification payload contains the same
  on-chain-public value).

Delivery logs are retained 90 days for idempotency / debugging, then
purged. The retention is configurable per the existing
`docs/governance/TRANSPARENCY_REPORTING.md` retention policy.

---

## 8. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-2 | `SPECIFICATION.md` written | §3.3 RP-N08 ties grace-lapse to [`SPECIFICATION.md` §6](./SPECIFICATION.md). |
| AC-4 | Dashboard subscription section | §4.3 webhook events feed [`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md). |
| AC-5 | Wallet cancel/pause/resume UX | §6 toggles surfaced from [`WALLET_UX.md`](./WALLET_UX.md). |
| AC-6 | User notifications: 3 days before billing | This document (§3.1 RP-N01, §5 scheduler). |
| AC-8 | Tests pass | The notification scheduler unit tests sit inside the wallet-ui test bar of 28 in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md); the webhook events sit inside the dashboard 47-test bar. |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Production monitoring  | [`docs/production/MONITORING.md`](../production/MONITORING.md) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
