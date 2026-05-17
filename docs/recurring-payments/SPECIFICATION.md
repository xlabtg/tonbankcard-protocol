# Recurring Payments — Production Specification

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **deployment gated on A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the production
behaviour of `contracts/RecurringPayments.tact` (Phase 4 implementation
code) and the surrounding off-chain coordination plane:

- the **on-chain mandate format** auditors must reason about,
- the **subscription tier formats** the merchant dashboard creates,
- the **payment schedule** the executor (merchant or NFT owner)
  triggers,
- the **grace period** between a missed period and an automatic
  mandate transition,
- the **security model** that the user signs onto when subscribing.

The contract itself is **not modified** by Issue #139 — the only
admissible mutation is the documented test-only handler removal
(`RegisterNFTOwnerRecurring`, see §10) which is gated on A2 verdict
`READY` per Issue #139 §7.

> **Why a specification first.** Issue #139 §8 acceptance criterion
> **AC-1** marks A2 as a **strict prerequisite**: until A2 returns
> `READY`, no deployment of `RecurringPayments.tact` to mainnet may
> occur, and no contract-side fix may land. The specification therefore
> documents the **frozen** state at engagement kickoff so that auditors
> have an unambiguous oracle for "what should this do" while the
> contract is reviewed.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §8 — _"`docs/recurring-payments/SPECIFICATION.md` written"_ (**AC-2**).

The specification additionally provides the contract-side anchor that
the dashboard integration (AC-4), wallet-ui UX (AC-5), notification
system (AC-6), end-to-end testnet flow (AC-7), and dashboard / wallet-ui
test suites (AC-8) refer to. Drift between this document and the
contract source `contracts/RecurringPayments.tact` is itself a
CI-blocking defect — `scripts/recurring-payments/check-recurring-payments-readiness.ts`
asserts the binding.

---

## 3. On-chain mandate format

The contract storage is a single map keyed by
`mandateKey(nft_address, mandate_id) = sha256(nft_address.asSlice()) + mandate_id`
(see [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact)
function `mandateKey`).

### 3.1 `MandateInfo` struct (canonical)

| Field | Type | Stored value | Set by | Mutability |
|-------|------|--------------|--------|-----------:|
| `status` | `uint8` | `0=ACTIVE`, `1=CANCELLED`, `2=COMPLETED` | `receive(CreateMandate)` → `ACTIVE`; `receive(CancelMandate)` → `CANCELLED`; `receive(ExecuteRecurringPayment)` → `COMPLETED` (final exec) | Status-only (no field overwrite); transitions are one-way |
| `merchant_address` | `Address` | Payee's NFT account | `receive(CreateMandate)` from `msg.merchant_address` | Immutable after creation |
| `amount_per_period` | `coins` | TBC amount per execution | `receive(CreateMandate)` | Immutable |
| `period_seconds` | `uint32` | Period between executions | `receive(CreateMandate)` | Immutable |
| `max_executions` | `uint32` | `0 = unlimited`, else upper bound | `receive(CreateMandate)` | Immutable |
| `execution_count` | `uint32` | Number of confirmed executions | `receive(ExecuteRecurringPayment)` `+= 1` | Monotonic |
| `last_executed_at` | `uint32` | `now()` at last successful execution | `receive(ExecuteRecurringPayment)` | Monotonic |
| `created_at` | `uint32` | `now()` at creation | `receive(CreateMandate)` | Immutable |

**Invariant (M-1, immutability):** for any storage key `k`, once
`mandates[k].status` leaves `ACTIVE` it cannot re-enter `ACTIVE`. The
contract enforces this by only writing the post-state in the same
receive frame — there is no `ResumeMandate` handler in the current
freeze (see §6 below on pause/resume).

### 3.2 Composite-key collision posture

The current `mandateKey` combinator is integer addition
(`sha256(nft_address.asSlice()) + intent_id`) — identical in shape to
the bridge contract's `intentKey` pre-CH-2 finding. **The same
composite-key collision posture applies here** and is mirrored in the
hardening backlog as **RP-CH-1** (§10). Until RP-CH-1 lands, two
mandates can in principle share a storage slot if `(nft_address₁, id₁)`
and `(nft_address₂, id₂)` hash-collide on the addition. The
operational mitigation in the current code is the
`require(self.nft_owners.get(msg.nft_address) == null)` guard on the
test-only seeding receiver (§10) plus the off-chain mandate-ID
generator in
[`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts)
that uses `Date.now()` + 8 random base-36 chars — drawing collisions
beneath cryptographic feasibility for the current user base.

---

## 4. Subscription tier formats

The dashboard surface (Issue #139 §3 "Production Specification" and
§3 "Merchant Dashboard Integration") creates plans that the user
subscribes to. The plan is **off-chain**: it is a database row in the
merchant's account that pre-populates the on-chain `CreateMandate`
message when the user accepts subscription.

### 4.1 Plan format

| Field | Type | Range | Maps to on-chain |
|-------|------|-------|------------------|
| `plan_id` | `string` (UUID v4) | non-empty | n/a (off-chain only) |
| `merchant_nft_address` | `Address` | TBC-whitelisted NFT account | `CreateMandate.merchant_address` |
| `name` | `string` | 1 … 64 chars | n/a |
| `description` | `string` | 0 … 512 chars | n/a |
| `amount_per_period` | `bigint` (TBC, base units) | `> 0`, `≤ 2¹²⁰−1` | `CreateMandate.amount_per_period` |
| `billing_period` | enum | `daily` / `weekly` / `monthly` / `annual` | `CreateMandate.period_seconds` (via §4.2 table) |
| `max_executions` | `uint32` | `0 = unlimited` or `1 … 2³²−1` | `CreateMandate.max_executions` |
| `currency` | enum | `TBC` (only) | n/a (Phase 4 freeze, see §4.3) |

### 4.2 Billing-period seconds (off-chain to on-chain binding)

The dashboard MUST translate the human-friendly billing period to the
exact `period_seconds` below. The CI validator
(`check-recurring-payments-readiness.ts`) asserts this table verbatim
because it is also embedded in the user-facing description shown by
`wallet-ui/` during the TON Connect signature prompt.

| Billing period | `period_seconds` | Justification |
|----------------|-----------------:|---------------|
| `daily`        | `86400`          | 24 h × 3600 s |
| `weekly`       | `604800`         | 7 × 86400 s |
| `monthly`      | `2592000`        | 30 × 86400 s (calendar-agnostic; deliberately fixed) |
| `annual`       | `31536000`       | 365 × 86400 s (no leap-year adjustment; fixed) |

**Rationale for calendar-agnostic months / years.** The on-chain
contract has no calendar arithmetic (`now()` returns Unix epoch
seconds). Calendar months drift by 0–3 days; encoding 30 / 365 day
fixed periods keeps the contract logic deterministic and removes the
need for an oracle. The dashboard explicitly warns the merchant that
"monthly" means "every 30 days" and "annual" means "every 365 days"
during plan creation.

**Floor / ceiling on-chain.** The contract enforces
`period_seconds >= MIN_PERIOD_SECONDS = 3600` (1 hour, see
`contracts/RecurringPayments.tact` line 109). The adapter layer
[`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts)
adds an upper bound of `MAX_PERIOD_SECONDS = 365 × 24 × 3600`
(1 year) to keep the off-chain mandate state from going stale beyond
the audit horizon.

### 4.3 Currency

`Phase 4 freeze: TBC only.` Fiat currency subscriptions and
non-TBC token subscriptions are **explicitly out of scope** per
Issue #139 §4. The dashboard MUST reject any plan creation that
passes a `currency` value other than `TBC` with HTTP 400
`INVALID_CURRENCY`.

---

## 5. Payment schedule

The contract is **pull-based with an upper bound**: each execution
must be triggered by an external message
(`ExecuteRecurringPayment`); the contract does **not** schedule
itself. This preserves invariant I1 (non-custodial) — the contract
cannot move funds without an external trigger.

### 5.1 Allowed triggerer

Per `contracts/RecurringPayments.tact` lines 296–302 (`receive(ExecuteRecurringPayment)`),
the sender of the execute message must be **either** the NFT owner
**or** the merchant address stored in the mandate. No other party
may trigger execution.

### 5.2 Schedule enforcement

The contract enforces the period at execution time:

```tact
// contracts/RecurringPayments.tact lines 313–319
if (m.last_executed_at > 0) {
    let next_allowed: Int = m.last_executed_at + m.period_seconds;
    if (current_time < next_allowed) {
        self.sendResponse(sender, false, ERROR_RP_TOO_EARLY, msg.nft_address, msg.mandate_id);
        return;
    }
}
```

Concretely:

| Condition | Behaviour |
|-----------|-----------|
| First execution (`last_executed_at == 0`) | Immediate, no waiting |
| Subsequent execution before `last_executed_at + period_seconds` | Rejected with `ERROR_RP_TOO_EARLY` |
| Subsequent execution at or after the threshold | Accepted; `last_executed_at` is set to **the current `now()`**, not the theoretical threshold |

**Drift semantics.** Because `last_executed_at` is set to the actual
`now()` and not the scheduled threshold, late executions push the
next scheduled time forward by the same amount. This is the
**"earliest pull"** model (the next execution can land no earlier
than `now() + period_seconds`). The alternative (resetting to
`scheduled_at + period_seconds`) would let a merchant catch up missed
periods in burst, which violates the user's authorized cadence.

### 5.3 Maximum executions

`max_executions == 0` means unlimited (until `CancelMandate`). For
`max_executions > 0`, the contract transitions the mandate to
`MANDATE_COMPLETED` immediately on the execution that brings
`execution_count == max_executions` (lines 326–328). Subsequent
`ExecuteRecurringPayment` returns `ERROR_RP_MAX_REACHED`.

---

## 6. Grace period and missed-payment behaviour

The contract has **no** auto-cancel-on-missed-payment logic. A mandate
remains `ACTIVE` indefinitely until either (a) the merchant or NFT
owner triggers a successful execution, (b) `CancelMandate` is signed
by the NFT owner, or (c) `max_executions` is reached.

To satisfy Issue #139 §3 ("Define grace period: time after missed
payment before subscription cancels") **without changing contract
logic**, the grace period is implemented entirely off-chain in
**dashboard** + **indexer**:

| Step | Surface | Trigger |
|------|---------|---------|
| 1. Payment misses by `> period_seconds + grace_seconds` | Off-chain indexer | `now() - last_executed_at > period_seconds + grace_seconds` |
| 2. Dashboard marks plan-subscription `lapsed` | Dashboard DB | Indexer event `MandateGracePeriodLapsed` |
| 3. User receives "Subscription paused" notification | Notifications | Dashboard webhook → notifications service |
| 4. Merchant calls `CancelMandate` (signed by user, see §6.1) **or** retries `ExecuteRecurringPayment` once user signs a new authorization | Wallet-UI / Merchant API | Per merchant policy |

### 6.1 Default grace period

The default grace period is **7 days** (`grace_seconds = 604800`).
Merchants MAY override this per plan in the range `[0, 30 days]`.
The CI validator asserts that the default appears in
`docs/recurring-payments/SPECIFICATION.md` §6.1 and is also referenced
in `docs/recurring-payments/DASHBOARD_INTEGRATION.md` §4.

### 6.2 Cancel still requires the user signature

Critically, the grace-period lapse does **not** authorize the
merchant to call `CancelMandate` unilaterally. `CancelMandate`
requires `sender() == owner(nft_address)` per
`contracts/RecurringPayments.tact` line 228
(`self.validateOwnership(sender, msg.nft_address)`). The off-chain
grace-period logic is therefore **advisory** — it stops the dashboard
from showing the subscription as active, but the on-chain mandate
remains `ACTIVE` until the user signs `CancelMandate` themselves.

This is required by Issue #139 §7: _"Cancel/pause must require user
signature (not callable by merchant unilaterally)"_.

---

## 7. Security model

The contract enforces the following authorization matrix
(`contracts/RecurringPayments.tact` lines 32–51 and the ownership
helper `validateOwnership` at line 382):

| Operation | Authorized signer | Failure code |
|-----------|------------------|-------------:|
| `CreateMandate` | NFT owner only | `ERROR_RP_NOT_OWNER` (1), `ERROR_RP_NFT_NOT_REGISTERED` (8) |
| `CancelMandate` | NFT owner only | `ERROR_RP_NOT_OWNER` (1) |
| `ExecuteRecurringPayment` | NFT owner **or** stored `merchant_address` | `ERROR_RP_NOT_AUTHORIZED` (9) |
| `RegisterNFTOwnerRecurring` | `deployer` only (test-only, §10) | revert: `Unauthorized: only deployer (test-only)` |

The error code numeric mapping is mirrored in
[`docs/error-codes.md`](../error-codes.md) §1 and asserted by the CI
validator.

### 7.1 Invariant I3 — no admin fund control

The contract has **no admin / deployer-controlled receivers** beyond
`RegisterNFTOwnerRecurring` (test-only), which is constrained to
**write a new owner only when one is not already set** (`require(self.nft_owners.get(msg.nft_address) == null, ...)`).
This closes the X-1 audit finding referenced in the contract source
comment (lines 419–432).

### 7.2 Authorization initial subscribe (Issue #139 §7)

Issue #139 §7 mandates: _"User must confirm subscription authorization
via TON Connect on initial subscribe"_. The TON Connect flow is
specified in [`WALLET_UX.md`](./WALLET_UX.md) §3.1 and consists of:

1. Wallet-UI fetches the plan from the dashboard API.
2. Wallet-UI shows the user: merchant name + NFT address, amount,
   billing period, max executions, grace period default.
3. Wallet-UI builds a `CreateMandate` payload and asks the user to
   sign it via TON Connect.
4. Wallet-UI submits the signed transaction.

The wallet **never** auto-signs subscription messages. The dashboard
**never** submits `CreateMandate` on behalf of the user.

### 7.3 Authorized-amount ceiling (Issue #139 §7)

Issue #139 §7: _"No recurring payment should exceed the user's
authorized amount"_. The contract enforces this directly:
`amount_per_period` is **immutable** after `CreateMandate`
(§3.1, M-1). Any merchant attempt to charge a higher amount per
execution would require the user to sign a new `CreateMandate` with
the new amount — which is the user's explicit authorization step.

### 7.4 Error code registry

Numeric error codes returned via `RecurringPaymentResponse.error_code`
(see `contracts/RecurringPayments.tact` lines 98–107). The registry
below is mirrored in [`docs/error-codes.md`](../error-codes.md) §1,
in [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) §5.4, and
asserted by the CI validator
(`scripts/recurring-payments/check-recurring-payments-readiness.ts`).

| Code | Name | Returned when |
|-----:|------|---------------|
| 0 | `ERROR_RP_NONE` | Success sentinel; never returned on a failure path. |
| 1 | `ERROR_RP_NOT_OWNER` | `CreateMandate` / `CancelMandate` sender does not own the target NFT card. |
| 2 | `ERROR_RP_INVALID_AMOUNT` | `CreateMandate` with `amount_per_period == 0`. |
| 3 | `ERROR_RP_INVALID_PERIOD` | `CreateMandate` with `period_seconds < MIN_PERIOD_SECONDS` (3600 s). |
| 4 | `ERROR_RP_MANDATE_NOT_FOUND` | `ExecuteRecurringPayment` / `CancelMandate` references an unknown mandate. |
| 5 | `ERROR_RP_MANDATE_NOT_ACTIVE` | Operation against a mandate already in `MANDATE_CANCELLED` or `MANDATE_COMPLETED`. |
| 6 | `ERROR_RP_TOO_EARLY` | `ExecuteRecurringPayment` before `last_executed_at + period_seconds` (§5.2). |
| 7 | `ERROR_RP_MAX_REACHED` | `ExecuteRecurringPayment` after `execution_count == max_executions` (§5.3). |
| 8 | `ERROR_RP_NFT_NOT_REGISTERED` | `CreateMandate` for an NFT that the protocol has not yet seeded into `nft_owners`. |
| 9 | `ERROR_RP_NOT_AUTHORIZED` | `ExecuteRecurringPayment` sender is neither the NFT owner nor the stored `merchant_address` (§5.1). |

The post-A2 code `ERROR_RP_PAUSED = 10` is **out of scope** here and
is tracked under RP-CH-3 in §10.

---

## 8. Non-functional requirements

Mirrored from Issue #139 §6 and enforced by the surrounding
artifacts:

| NFR | Surface | Specification |
|-----|---------|---------------|
| Subscription plan creation < 5 s end-to-end | Dashboard | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) §6 (latency budget) |
| Payment processing automatic post-subscribe | Indexer + Merchant relayer | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) §5 (executor pattern) |
| Cancellation effective before next billing | Wallet-UI + Contract | §6.2 here + [`WALLET_UX.md`](./WALLET_UX.md) §4.2 |
| Upcoming-payment notification, 3 days before | Notifications | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) §3 |
| Dashboard MRR metric | Dashboard | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) §7 |
| Tests pass: 47 (dashboard) + 28 (wallet-ui) | CI | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) §6 (rollout gate) |

---

## 9. Threat catalogue (subscription-specific)

The A2 engagement carries the full Phase-4 threat catalogue. This
section enumerates the **subscription-specific** threats that the
audit MUST consider — they extend (do not replace) the cross-cutting
threats in [`audit-scope.md`](../audit-scope.md).

| ID | Threat | Current mitigation |
|----|--------|---------------------|
| **T-RP-1** | Composite-key collision (§3.2) — two mandates share a storage slot via `sha256(addr) + id` collision | Operational: off-chain mandate-ID generator + write-once `nft_owners` guard. **On-chain mitigation deferred to RP-CH-1** (§10). |
| **T-RP-2** | Merchant unilaterally drains user — calls `ExecuteRecurringPayment` faster than the period allows | Closed by §5.2 schedule enforcement (`ERROR_RP_TOO_EARLY`). |
| **T-RP-3** | Merchant inflates `amount_per_period` after authorization | Closed by §3.1 immutability — fields cannot be re-written. |
| **T-RP-4** | Merchant calls `CancelMandate` to grief the user | Closed by §6.2 ownership requirement (sender must be NFT owner). |
| **T-RP-5** | Race condition on `last_executed_at` when two relayers submit at once | Closed by TON message-ordering semantics (contract is single-shard, messages are processed sequentially). |
| **T-RP-6** | Test-only `RegisterNFTOwnerRecurring` reaches mainnet | Mitigated by deployer-only guard + write-once owner check; removal is **RP-CH-2** (§10). |

---

## 10. Hardening backlog (post-A2)

The following items are **frozen** for the duration of the A2
engagement and may only land after A2 returns verdict `READY`. The
CI validator
(`scripts/recurring-payments/check-recurring-payments-readiness.ts`)
asserts the A2-gate annotation here at every PR.

| ID | Description | Gates on |
|----|-------------|----------|
| **RP-CH-1** | Replace `mandateKey = sha256(addr) + id` with a domain-separated keyed hash (`sha256("MANDATE_KEY_V1" \|\| addr \|\| id)`). | A2 `READY` |
| **RP-CH-2** | Remove (or compile-out) the test-only `RegisterNFTOwnerRecurring` receiver. | A2 `READY` |
| **RP-CH-3** | Add `paused: Bool` storage flag + governance-signed `PauseRecurringPayments` to honour the auto-pause auto-trigger from [`MONITORING.md`](./MONITORING.md) §3.6. | A2 `READY`, multi-sig artefact present |
| **RP-CH-4** | Emit a dedicated `MandateLapsed` event at the moment `now() - last_executed_at > period_seconds + grace_seconds` so the indexer no longer needs a polling worker for §6. | A2 `READY` |
| **RP-CH-5** | Replace `merchant_address: Address` immutable field with a write-once setter that accepts an explicit collection-whitelisted NFT, mirroring the bridge CH-7 hardening of the test-only seeding. | A2 `READY` |

**CI guardrails for RP-CH-*** are enumerated in
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) §5 as **R-RP-CH-1
… R-RP-CH-5**.

---

## 11. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | Where satisfied |
|-----|-------------|-----------------|
| AC-1 | A2 audit complete (prerequisite) | §1 / §10 — gates every contract change behind A2 `READY`. |
| AC-2 | `docs/recurring-payments/SPECIFICATION.md` written | This document. |
| AC-3 | `RecurringPayments.tact` deployed to testnet | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) §3 |
| AC-4 | Merchant dashboard subscription section | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) §§3–7 |
| AC-5 | Wallet cancel/pause/resume UX | [`WALLET_UX.md`](./WALLET_UX.md) §§3–5 |
| AC-6 | User notification system | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) §§3–5 |
| AC-7 | End-to-end subscription tested on testnet | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) §5 |
| AC-8 | Dashboard (47) and wallet-ui (28) tests pass | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) §6 |

---

## 12. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source           | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Off-chain adapter         | [`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts) |
| Existing adapter tests    | [`tests/recurring-payments/RecurringPaymentsAdapter.spec.ts`](../../tests/recurring-payments/RecurringPaymentsAdapter.spec.ts) |
| Dashboard integration     | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet-UI UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications             | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring                | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening        | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment        | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty addendum       | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement       | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Error codes registry      | [`docs/error-codes.md`](../error-codes.md) |
| Audit scope               | [`docs/audit-scope.md`](../audit-scope.md) |
| Invariants                | [`docs/invariants.md`](../invariants.md) |

---

## 13. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
