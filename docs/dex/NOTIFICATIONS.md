# DEX Integration — Notifications

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Status:** Draft — frozen at engagement kickoff; **rollout gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the user-facing notifications emitted by the
DEX integration layer. Notifications are distinct from
[`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) alerts: alerts
target on-call rotation; notifications target the **end user** whose
swap was affected.

## 2. Acceptance criterion this artifact satisfies

Issue #141 §3 ("alert if pool depth drops below threshold") — the
user-facing half of the alert envelope; the operator-facing half
lives in [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md).

---

## 3. Notification catalogue

The DEX integration layer emits 8 notifications, `DEX-N01`..`DEX-N08`.

### 3.1 Venue-status notifications

| ID | Trigger | Channels | Priority |
|----|---------|----------|---------|
| **DEX-N01** | A venue the user previously swapped through is demoted to `DEGRADED` | Push, in-app banner | Informational |
| **DEX-N02** | All venues demoted simultaneously (mirrors `DEX-M01`) | Push, in-app banner, email | Critical |

### 3.2 Swap-outcome notifications

| ID | Trigger | Channels | Priority |
|----|---------|----------|---------|
| **DEX-N03** | A user's swap reverts with `ERROR_DEX_SLIPPAGE_EXCEEDED` | Push, in-app toast | Standard |
| **DEX-N04** | A user's swap reverts with `ERROR_DEX_FLOOR_REJECT` | Push, in-app toast | Standard |
| **DEX-N05** | Fallback routing took effect — the user's swap settled on a venue different from `winner` | Push, in-app banner | Informational |

### 3.3 Pool-depth notifications

| ID | Trigger | Channels | Priority |
|----|---------|----------|---------|
| **DEX-N06** | The pool the user attempted to swap against breached `MIN_POOL_DEPTH_TON` during their request | Push, in-app toast | Standard |
| **DEX-N07** | The pool the user attempted to swap against dropped >25 % in 24 h (mirrors `DEX-M08`/`DEX-M09`) | Email digest | Informational |

### 3.4 Auto-pause notifications

| ID | Trigger | Channels | Priority |
|----|---------|----------|---------|
| **DEX-N08** | Merchant Payment Hub auto-paused TBC/TON swaps via `RC-LIQUIDITY-DRAIN` (mirrors `DEX-M18`) | Push, in-app banner, email | Critical |

---

## 4. Channels

### 4.1 Push notifications

Delivered through the existing wallet push infrastructure (FCM /
APNS). The wallet registers the push token through the standard
opt-in flow described in [`WALLET_UX.md`](./WALLET_UX.md) §5.

### 4.2 Email

Email is reserved for `Critical`-priority events (`DEX-N02`,
`DEX-N08`) and the `DEX-N07` digest. Email rendering re-uses the
existing transactional template at
`backend/templates/email/transactional.html` — no new templates are
introduced.

### 4.3 Webhook

Merchants who registered a webhook in the dashboard receive an HTTP
POST containing the notification payload. Webhook delivery is
idempotent: each `(notification_id, recipient)` tuple is delivered
at-most-once with exponential backoff to `MAX_WEBHOOK_RETRIES = 5`.

---

## 5. Scheduling

### 5.1 Idempotency

Each notification carries a deterministic `notification_id`:

```text
sha256(`${user_addr}|${event_type}|${request_id}|${epoch_bucket}`)
```

where `epoch_bucket = floor(now / 60)` clamps duplicate-suppression
to a 60-second window. The dispatcher MUST short-circuit duplicate
ids inside this window — duplicates are silently dropped, not
re-delivered.

### 5.2 Backoff

If the channel-side delivery fails, the dispatcher retries with an
exponential schedule: `2 s, 4 s, 8 s, 16 s, 32 s` (5 attempts,
matching `MAX_WEBHOOK_RETRIES`). Failure after 5 attempts records
`notification_log.delivery_status = 'FAILED'` and flips
`DEX-M16` (delivery failure rate alert).

---

## 6. Opt-in

| Channel | Default | User control |
|---------|---------|--------------|
| Push | Off | Wallet → Settings → Notifications → DEX events |
| Email | Off (Critical-only forced-on for merchants) | Dashboard → Notifications |
| Webhook | Off | Dashboard → Merchant webhooks |

The wallet refuses to send any non-Critical notification before the
user has opted in. `Critical` notifications (`DEX-N02`, `DEX-N08`)
can be silenced but the silence is recorded in the audit log so
support can confirm during incident response that the user
deliberately suppressed the alert.

---

## 7. Privacy posture

Notifications NEVER include:

- the user's full TON address (always last-4 only);
- exact swap amounts (rounded to 3 significant figures);
- the precise quote signature (only the `venue` and `errorCode`);
- referrals to any external venue's frontend URLs (the wallet links
  to the protocol's in-app explorer instead).

---

## 8. References

- [`docs/dex/SPECIFICATION.md`](./SPECIFICATION.md) §7.2 (error registry)
- [`docs/dex/LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) §§3.5, 3.6 (alert pairing)
- [`docs/dex/WALLET_UX.md`](./WALLET_UX.md) §5 (opt-in flow)
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
