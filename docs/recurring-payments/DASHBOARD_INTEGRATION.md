# Recurring Payments — Merchant Dashboard Integration

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the merchant-dashboard surface required to
satisfy Issue #139 §3 ("Merchant Dashboard Integration") and §8
acceptance criterion **AC-4** _"Merchant dashboard subscription
section: subscriber list with status (active/cancelled/expired),
MRR (Monthly Recurring Revenue) calculation, churn rate, plan
creation UI"_.

The dashboard is the **only** off-chain surface that creates plan
records and exposes subscription analytics to merchants. It must
preserve the protocol invariants (I1 Non-Custodial, I2 NFT Authority,
I3 No Admin Control) — see §8 below for the invariant matrix.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §8 — _"AC-4: Merchant dashboard subscription section"_.

Indirectly informs AC-2 (the on-chain mandate format the dashboard
populates is documented in
[`SPECIFICATION.md` §3](./SPECIFICATION.md)) and AC-8 (the dashboard
test bar of **47 tests** referenced from
[`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md)).

---

## 3. Plan creation flow

The merchant operator navigates to `Dashboard → Subscriptions → Plans
→ New plan`. The form fields match the plan format in
[`SPECIFICATION.md` §4.1](./SPECIFICATION.md):

| UI field | Validation | Maps to |
|----------|------------|---------|
| Plan name | non-empty, ≤ 64 chars | `plan.name` |
| Description | ≤ 512 chars | `plan.description` |
| Amount per period (TBC) | `> 0`; max 2¹²⁰−1 | `plan.amount_per_period`, on-chain `CreateMandate.amount_per_period` |
| Billing period | one of `daily` / `weekly` / `monthly` / `annual` | `plan.billing_period` → `period_seconds` via [`SPECIFICATION.md` §4.2](./SPECIFICATION.md) |
| Max executions | `0 = unlimited` or `1 … 2³²−1` | `plan.max_executions`, on-chain `CreateMandate.max_executions` |
| Grace period (override) | optional, `0 … 30 days` | Off-chain only — see [`SPECIFICATION.md` §6.1](./SPECIFICATION.md) |
| Currency | `TBC` only (locked) | `plan.currency` — rejects non-TBC with HTTP 400 `INVALID_CURRENCY` |

On submit the dashboard:

1. Validates inputs client-side and re-validates server-side.
2. Computes `period_seconds` per [`SPECIFICATION.md` §4.2](./SPECIFICATION.md).
3. Writes `plan` to the dashboard database (`subscriptions.plans`).
4. Returns a plan public link `https://pay.tonbankcard.com/sub/<plan_id>`.

The dashboard does **not** submit any on-chain transaction at plan
creation time — the on-chain `CreateMandate` only fires when a user
subscribes (see [`WALLET_UX.md` §3](./WALLET_UX.md)).

### 3.1 Latency budget

| Step | Budget | Measured at |
|------|--------|-------------|
| Plan form load | < 500 ms | p95 |
| Plan create POST | < 2 s | p95 |
| Plan public link reachable | < 5 s end-to-end | NFR per Issue #139 §6 |

Latency is asserted by the smoke test
[`scripts/smoke-test.sh`](../../scripts/smoke-test.sh) extension
planned in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md).

---

## 4. Subscriber list view

`Dashboard → Subscriptions → Subscribers` shows a paginated table
keyed by `(plan_id, nft_address, mandate_id)`. Each row contains:

| Column | Source | Notes |
|--------|--------|-------|
| Subscriber NFT card | On-chain `MandateCreated.nft_address` (via indexer) | Linked to public account viewer |
| Plan name | Off-chain plan join on `plan_id` | |
| Status | One of `active` / `cancelled` / `expired` / `lapsed` | Derived per §4.1 |
| Started at | `MandateCreated.timestamp` | |
| Next billing | `last_executed_at + period_seconds` (or `created_at` if first execution pending) | |
| Executions | `MandateInfo.execution_count` | |
| Last payment | `RecurringPaymentExecuted.timestamp` for newest event | |
| Lifetime TBC | Σ `RecurringPaymentExecuted.amount` for this `(nft, mandate_id)` | Off-chain |

### 4.1 Status derivation

| Status | Condition |
|--------|-----------|
| **active** | On-chain `MandateInfo.status == MANDATE_ACTIVE` and `now() - last_executed_at <= period_seconds + grace_seconds` |
| **lapsed** | On-chain `MandateInfo.status == MANDATE_ACTIVE` but `now() - last_executed_at > period_seconds + grace_seconds` — see [`SPECIFICATION.md` §6](./SPECIFICATION.md) |
| **cancelled** | On-chain `MandateInfo.status == MANDATE_CANCELLED` |
| **expired** | On-chain `MandateInfo.status == MANDATE_COMPLETED` (max-executions reached) |

**Grace-period override.** The merchant-configured grace value from
§3 overrides the default `604800` ([`SPECIFICATION.md` §6.1](./SPECIFICATION.md))
**only at the dashboard view** — the on-chain contract never reads
this number.

---

## 5. Executor pattern (post-subscribe automatic billing)

Issue #139 §6 NFR: _"Payment processing: Automatic after subscription"_.

The dashboard executor is a per-merchant cron worker that scans
**active** mandates for which `now() >= last_executed_at + period_seconds`
and dispatches an `ExecuteRecurringPayment` message. The executor
runs **as the merchant address** (one of the two authorized senders
per [`SPECIFICATION.md` §5.1](./SPECIFICATION.md)) and pulls the
private key from the merchant's KMS — the protocol never touches it.

Executor design (single-shot, idempotent):

1. Read `MandateInfo` via the on-chain getter `getMandateInfo(...)`.
2. If `MandateInfo.status != MANDATE_ACTIVE`, skip and mark
   `lapsed`/`cancelled`/`expired` in the dashboard DB.
3. If `now() < last_executed_at + period_seconds`, skip
   (race-condition double-fire defence).
4. Otherwise dispatch `ExecuteRecurringPayment`.
5. The indexer pipeline (existing `backend/indexer/`) confirms via
   `RecurringPaymentExecuted` event and updates the dashboard row.

### 5.1 Failure modes

| Code (from `RecurringPaymentResponse.error_code`) | Dashboard reaction |
|----------|--------------------|
| `ERROR_RP_NONE` (0) | Mark execution `confirmed`. |
| `ERROR_RP_TOO_EARLY` (6) | Should not happen given §5 step 3 — record as bug, page on-call. |
| `ERROR_RP_MAX_REACHED` (7) | Mark mandate `expired`. |
| `ERROR_RP_MANDATE_NOT_ACTIVE` (5) | Mark mandate `cancelled` if state is `MANDATE_CANCELLED`, otherwise `expired`. |
| `ERROR_RP_NOT_AUTHORIZED` (9) | Critical — the merchant key is mis-configured or `merchant_address` was tampered with at plan-creation time. Page on-call. |
| Any other / missing response | Retry once after 60 s, then mark `failed`. |

The numeric codes match `contracts/RecurringPayments.tact` lines
98–107 and the registry in [`docs/error-codes.md`](../error-codes.md).

---

## 6. Cancellation visibility

When the user signs `CancelMandate` (via the wallet UX in
[`WALLET_UX.md`](./WALLET_UX.md)), the indexer emits a
`MandateCancelled` event. The dashboard:

1. Marks the subscription row `cancelled` immediately on event arrival.
2. Stops scheduling new executor runs.
3. Sends the merchant a webhook (`subscription.cancelled`) per the
   existing merchant-webhook spec.

The dashboard **never** offers a "cancel on behalf of the user"
button. This satisfies Issue #139 §7 _"Cancel/pause must require user
signature (not callable by merchant unilaterally)"_.

The merchant **can** archive a subscription row from the dashboard
view (DB-only flag); archival is purely a display preference and has
no on-chain effect.

---

## 7. Subscription analytics (MRR, churn, ARPU)

The Issue #139 §3 mandate requires MRR. The dashboard exposes:

| Metric | Definition | Time window |
|--------|------------|-------------|
| **MRR (Monthly Recurring Revenue)** | Σ over `active` mandates of `amount_per_period × monthly_factor(billing_period)` where `monthly_factor(daily) = 30`, `monthly_factor(weekly) = 4.345`, `monthly_factor(monthly) = 1`, `monthly_factor(annual) = 1/12` | Snapshot at `now()` |
| **ARR (Annual Recurring Revenue)** | `MRR × 12` | derived |
| **Churn rate** | Number of mandates moving from `active` to `cancelled` / `lapsed` / `expired` in the period, divided by the active count at the start of the period | Rolling 30 d |
| **ARPU (Avg Revenue Per User)** | `MRR / distinct nft_address count among active` | Snapshot |
| **New subscriptions** | `MandateCreated` events in the period | Rolling 30 d |
| **Active subscriptions** | Count of `active` rows per §4.1 | Snapshot |

The metrics are **server-side derived** from indexer data. They are
not authoritative for revenue accounting — the merchant's own
accounting must reconcile against `RecurringPaymentExecuted` events
on-chain.

### 7.1 MRR conversion table

The `monthly_factor` constants follow standard SaaS reporting
practice (Stripe, Recurly, ProfitWell):

| Billing period | `monthly_factor` | Rationale |
|----------------|------------------|-----------|
| `daily`        | 30               | 30 daily charges per month |
| `weekly`       | 4.345            | 365 / 7 / 12 — annualised then divided by 12 |
| `monthly`      | 1                | identity |
| `annual`       | 0.0833 (= 1/12)  | annual fee amortised across 12 months |

The CI validator (`scripts/recurring-payments/check-recurring-payments-readiness.ts`)
asserts this table verbatim.

---

## 8. Invariant matrix

| Invariant | Where the dashboard could break it | Mitigation here |
|-----------|------------------------------------|------------------|
| **I1 Non-Custodial** | Auto-pay button that creates a server-held authorization | Dashboard exposes no signing path — all signing happens in the user's wallet ([`WALLET_UX.md` §3](./WALLET_UX.md)). |
| **I2 NFT Authority** | Server-side override of `merchant_address` | `merchant_address` is read from the dashboard DB row at executor dispatch — but the contract re-checks `validateOwnership` and `isOwner / is_merchant` (§5.1). |
| **I3 No Admin Control** | "Force-cancel" button | The dashboard has no such button — `CancelMandate` requires the user's signature (§6). |
| **I4 Atomic Transfers** | n/a | The dashboard does not custody funds. |
| **I5 Ledger Conservation** | n/a | The dashboard never writes balances. |

---

## 9. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | The dashboard surface is unaffected by A2 verdict, but executor §5 only dispatches against the **post-A2** contract artefact (see [`TESTNET_DEPLOYMENT.md` §3](./TESTNET_DEPLOYMENT.md)). |
| AC-2 | `SPECIFICATION.md` written | This document refers back to §3 / §4 / §5 / §6 of the spec for every numerical value. |
| AC-4 | Merchant dashboard subscription section | This document (§§3, 4, 5, 6, 7). |
| AC-6 | User notification system | §6 mentions the `subscription.cancelled` webhook that feeds [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) §4. |
| AC-8 | Dashboard tests (47) pass | §3.1 latency + §5 executor pattern + §7 MRR maths form the dashboard test surface; budget asserted in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 10. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Off-chain adapter      | [`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| Invariants             | [`docs/invariants.md`](../invariants.md) |

---

## 11. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
