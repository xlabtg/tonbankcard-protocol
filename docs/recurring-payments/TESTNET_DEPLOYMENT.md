# Recurring Payments — Testnet Deployment & End-to-End Verification

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **testnet deployment blocked until A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the **testnet
deployment plan**, the **end-to-end subscription flow** that
exercises the deployed contract, and the **test bar** (47 dashboard
tests + 28 wallet-ui tests) required by Issue #139 §8 acceptance
criteria **AC-3**, **AC-7**, and **AC-8**.

It binds the previously-documented surfaces ([`SPECIFICATION.md`](./SPECIFICATION.md),
[`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`MONITORING.md`](./MONITORING.md)) to a single rollout sequence so
that the testnet milestone is a verifiable, reproducible artefact
the auditor and the operator can both replay.

The mainnet rollout is **not** in scope for this document. Mainnet
gates on A2 `READY` + the post-A2 hardening bundle in
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) and a separate
deployment runbook will be written under that follow-up issue.

---

## 2. Acceptance criteria this artifact satisfies

| AC  | Requirement | Where in this document |
|-----|-------------|------------------------|
| AC-3 | `RecurringPayments.tact` deployed to testnet | §3 deployment manifest, §4 deployment steps |
| AC-7 | End-to-end subscription tested on testnet | §5 e2e plan (subscribe → execute → cancel) |
| AC-8 | Dashboard tests (47) + wallet-ui tests (28) pass | §6 test bar |

AC-1 (A2 audit) is treated as a **strict prerequisite** in §3.1.

---

## 3. Deployment manifest

### 3.1 Gating preconditions

| Precondition | Source | State required |
|--------------|--------|----------------|
| A2 audit verdict | [`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) → `STATUS.md` | `verdict: READY`, zero critical/high open on `RecurringPayments.tact` |
| Contract bytecode | `contracts/RecurringPayments.tact` | Compiled hash matches the value the auditor signed off on |
| Deployer wallet | `docs/deployments/recurring-payments-testnet/deployer.txt` | Address known, ≥ 5 TON balance on testnet |
| Backend adapter | [`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts) | `MIN_PERIOD_SECONDS = 3600`, `MAX_PERIOD_SECONDS = 365 × 24 × 3600` (matches contract line 109) |
| Wallet-ui build | `wallet-ui` package | Subscribe + cancel flows wired ([`WALLET_UX.md` §§3–4](./WALLET_UX.md)) |
| Dashboard build | `dashboard` package | Plan / Subscribers / Analytics / Lifecycle wired ([`DASHBOARD_INTEGRATION.md` §§3–6](./DASHBOARD_INTEGRATION.md)) |
| CI green | `scripts/recurring-payments/check-recurring-payments-readiness.ts` | `OK` on the deployment commit |

If any precondition is red, the testnet deployment is **postponed**;
the deployment runbook does not allow waiver-by-comment.

### 3.2 Deployment artefacts

The deployment produces the following artefacts, each committed to
the repository under `docs/deployments/recurring-payments-testnet/`:

| Artefact | Contents |
|----------|----------|
| `manifest.json` | Contract address, deployer address, bytecode hash, `init_data` blob, deployment block height, deployment tx hash. |
| `deploy-tx.boc` | Raw BOC of the deployment message (for reproducible re-verify). |
| `verify.txt` | Output of the on-chain code-hash retrieval matching the local build. |
| `seed-script.ts` | Script that seeds testnet NFT owners via `RegisterNFTOwnerRecurring` (test-only; removed in mainnet per [`CONTRACT_HARDENING.md` RP-CH-2](./CONTRACT_HARDENING.md)). |
| `subscribe-flow.log` | End-to-end log of the §5 happy path. |

The manifest is the single artefact that downstream documents
([`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`MONITORING.md`](./MONITORING.md)) point at for the testnet
contract address.

### 3.3 Network selection

Testnet is **TON testnet** (`testnet.toncenter.com` / `t.me/testgiver_ton_bot`).
The dashboard, wallet-ui, and indexer all switch network via the
existing env-var pattern (`TON_NETWORK=testnet`); no
recurring-payments-specific switch is added.

---

## 4. Deployment steps

The deployment runs **once** per A2-approved bytecode hash. A
subsequent re-deploy (after RP-CH-N hardening) is a separate
ceremony documented in its own runbook.

1. **Verify gating preconditions** (§3.1). The CI validator
   [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
   is the canonical green-light.
2. **Build the contract** at the exact commit the auditor signed:
   `npx tact --config tact.config.json` produces
   `build/RecurringPayments/tact_RecurringPayments.code.boc`.
3. **Compute and record the bytecode hash**. Append to
   `docs/deployments/recurring-payments-testnet/verify.txt`.
4. **Deploy** via the existing deployment helper
   (`scripts/deploy.ts --contract RecurringPayments --network testnet`).
   The deployer wallet is the only key that holds the test-only
   `RegisterNFTOwnerRecurring` authority — this is the same key
   recorded in `manifest.json` under `deployer`.
5. **Seed NFT owners.** Run `seed-script.ts` to wire up the test
   wallets registered for the §5 e2e flow. Each invocation goes
   through the gated test-only handler at
   [contract lines 428–432](../../contracts/RecurringPayments.tact),
   which refuses to overwrite an already-registered owner.
6. **Smoke check.** Call the read-only getters (`getMandate`,
   `nft_owners`) from a console to confirm the contract is live and
   the seed worked.
7. **Wire downstream surfaces.** Patch the contract address into
   the `dashboard` and `wallet-ui` config files. Trigger the staging
   indexer to start consuming the new contract address.
8. **Publish.** Commit the deployment artefacts (§3.2) to the
   repository under `docs/deployments/recurring-payments-testnet/`.
   Open a status comment on issue #139 referencing the
   `manifest.json` blob.

Step 5 (seeding) is **testnet-only** per RP-CH-2 — mainnet does
not allow `RegisterNFTOwnerRecurring` at all
([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

---

## 5. End-to-end subscription flow (AC-7)

The e2e flow is run **immediately** after step 8 above. It produces
`subscribe-flow.log` and serves as the visible artefact for AC-7.

### 5.1 Fixture

| Actor | Wallet | NFT card |
|-------|--------|----------|
| Payer | `test-payer.tonconnect.json` | Diamond NFT #T-payer (seeded in step 5) |
| Merchant | `test-merchant.tonconnect.json` | Diamond NFT #T-merchant (seeded in step 5) |
| Executor | Backend cron (same key as Merchant for the testnet) | n/a |

### 5.2 Happy path (golden)

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | Merchant creates a plan in the dashboard (amount 10 TBC, period `monthly` = 30 days). | Dashboard ([`DASHBOARD_INTEGRATION.md` §3](./DASHBOARD_INTEGRATION.md)) | Plan `plan_id` returned; `https://pay.tonbankcard.com/sub/<plan_id>` resolvable. |
| 2 | Payer opens the link in TON Connect wallet, taps Authorize, signs `CreateMandate`. | Wallet-ui ([`WALLET_UX.md` §3](./WALLET_UX.md)) | On-chain `MandateCreated` event observed; `RecurringPaymentResponse{success: true, error_code: 0}` returned. |
| 3 | Time-advance fixture moves chain time forward by `period_seconds + 1`. | Sandbox helper (testnet uses a time-skew utility for the deterministic e2e run; on real testnet, this step waits the actual period) | Mandate becomes eligible for execution. |
| 4 | Executor dispatches `ExecuteRecurringPayment{ nft_address, mandate_id }`. | Backend cron ([`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md)) | `RecurringPaymentExecuted` event observed; payer balance decreases by 10 TBC, merchant balance increases by 10 TBC (I4 atomic, I5 conservation). |
| 5 | Payer taps Cancel in `Wallet → My subscriptions`. | Wallet-ui ([`WALLET_UX.md` §4.2](./WALLET_UX.md)) | `MandateCancelled` event observed; subsequent `ExecuteRecurringPayment` against the same `(nft_address, mandate_id)` returns `ERROR_RP_MANDATE_NOT_ACTIVE = 5`. |

### 5.3 Error-path coverage

Each error code at [contract lines 98–107](../../contracts/RecurringPayments.tact)
is exercised by at least one e2e case:

| Error | Cause | Triggering input | Surface check |
|-------|-------|------------------|---------------|
| `ERROR_RP_NOT_OWNER = 1` | Non-owner calls `CreateMandate`. | Sign `CreateMandate` from a wallet that does not own the NFT card. | Wallet-ui shows "This wallet does not own the selected NFT card. Switch wallets and retry." ([`WALLET_UX.md` §3.4](./WALLET_UX.md)). |
| `ERROR_RP_INVALID_AMOUNT = 2` | `amount_per_period == 0`. | Bypass dashboard validation; submit raw `CreateMandate`. | Wallet-ui shows "This plan has an invalid amount." ([`WALLET_UX.md` §3.4](./WALLET_UX.md)). |
| `ERROR_RP_INVALID_PERIOD = 3` | `period_seconds < 3600`. | Submit `period_seconds = 1800`. | Wallet-ui shows "This plan has an invalid billing period." |
| `ERROR_RP_MANDATE_NOT_FOUND = 4` | Execute against a never-created mandate. | Cron tries `ExecuteRecurringPayment` with an unknown `mandate_id`. | Dashboard surfaces a `dispatch.error` row keyed on `MANDATE_NOT_FOUND` ([`DASHBOARD_INTEGRATION.md` §5.2](./DASHBOARD_INTEGRATION.md)). |
| `ERROR_RP_MANDATE_NOT_ACTIVE = 5` | Execute after `MandateCancelled`. | Repeat step 5.2 #4 after #5. | Dashboard surfaces a `dispatch.error` row keyed on `MANDATE_NOT_ACTIVE`. |
| `ERROR_RP_TOO_EARLY = 6` | Execute before period elapses. | Cron tries `ExecuteRecurringPayment` immediately after the previous execution. | Monitoring alert SUB-M05 fires ([`MONITORING.md` §3.2](./MONITORING.md)); dashboard surfaces a `dispatch.error` row keyed on `TOO_EARLY`. |
| `ERROR_RP_MAX_REACHED = 7` | Execute after `max_executions` reached. | Create a `max_executions = 1` mandate; execute twice. | Indexer transitions the mandate to `completed`; subsequent execute returns the code. |
| `ERROR_RP_NFT_NOT_REGISTERED = 8` | Create mandate against an NFT that has not been seeded. | Skip step 4-5 for one of the test wallets. | Wallet-ui shows "Your NFT card is not yet registered with the protocol." ([`WALLET_UX.md` §3.4](./WALLET_UX.md)). |
| `ERROR_RP_NOT_AUTHORIZED = 9` | A third party (not owner, not merchant) calls `ExecuteRecurringPayment`. | A separate test wallet sends the execute message. | Dashboard surfaces a `dispatch.error` row keyed on `NOT_AUTHORIZED`. |

The post-A2 code `ERROR_RP_PAUSED = 10` is **not** part of the
testnet e2e — the corresponding `paused` flag does not exist until
RP-CH-3 ships ([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

### 5.4 Notifications integration

The e2e run exercises one notification cycle:

1. After step 5.2 #2, the notification scheduler dispatches a
   single RP-N03 (first-execution acknowledgement, always-on) per
   [`NOTIFICATIONS.md` §3.1](./NOTIFICATIONS.md).
2. After step 5.2 #4 (post-execution), the scheduler dispatches a
   single RP-N04 (post-billing receipt, opt-in default ON) per
   [`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md).
3. After step 5.2 #5 (post-cancellation), the scheduler dispatches
   a single RP-N06 (always-on cancellation ack) per
   [`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md).

The dedup key
`(user_id, mandate_id, RP-Nxx, t_next)` from
[`NOTIFICATIONS.md` §5.1](./NOTIFICATIONS.md) is asserted by
re-running the scheduler once after each step and verifying no
duplicate push lands.

---

## 6. Test bar (AC-8)

AC-8 requires "dashboard (47) + wallet-ui (28) tests pass". The
breakdown below is the **shape** of the test bar — each row is a
test or a tightly-coupled group of tests that collectively land on
the listed count.

### 6.1 Dashboard test bar (47 tests)

The dashboard repository's test runner (`vitest`) groups tests as
follows:

| Group | Count | What it covers |
|-------|-------|----------------|
| Plan creation | 8 | Field-level validation table from [`DASHBOARD_INTEGRATION.md` §3.1](./DASHBOARD_INTEGRATION.md); positive create; rejected amount/period/grace inputs; rejected duplicate plan slug. |
| Plan listing | 4 | Pagination, sort by created date / MRR / churn. |
| Subscriber list | 7 | Status derivation rules (active / lapsed / cancelled / expired / completed) per [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md); filter combinations; CSV export round-trip. |
| Subscriber detail | 5 | History list ordering newest-first; per-event tx-link rendering; absence of a "force-cancel" admin button (invariant I3, [`DASHBOARD_INTEGRATION.md` §6](./DASHBOARD_INTEGRATION.md)). |
| Executor cron | 9 | Five-step dispatch from [`DASHBOARD_INTEGRATION.md` §5.1](./DASHBOARD_INTEGRATION.md); idempotency via `(nft_address, mandate_id, execution_number)`; backoff schedule; failure-mode mapping table from [`DASHBOARD_INTEGRATION.md` §5.2](./DASHBOARD_INTEGRATION.md) against each `ERROR_RP_*` code 5/6/7/9. |
| MRR analytics | 6 | `monthly_factor` table values (daily=30, weekly=4.345, monthly=1, annual≈0.0833); roll-up across plans; churn rolling-30-day rate; revenue snapshot. |
| Webhook dispatch | 5 | HMAC-SHA256 auth; `event_id` UUID v4 uniqueness; retry policy on 5xx; rejection on missing webhook URL; replay rejection by `event_id` ([`NOTIFICATIONS.md` §4.3](./NOTIFICATIONS.md)). |
| Invariant guardrails | 3 | UI absence of force-cancel (I3); merchant cannot create mandate (I2); dashboard never holds the user's private key (I1). |
| **Total** | **47** | |

### 6.2 Wallet-ui test bar (28 tests)

The wallet-ui repository's test runner (`vitest` + Playwright for
the smoke layer):

| Group | Count | What it covers |
|-------|-------|----------------|
| Subscribe flow | 6 | Plan link resolution, dashboard signature check, authorization sheet field-by-field rendering ([`WALLET_UX.md` §3.2](./WALLET_UX.md)); TON Connect signature dispatch; `MandateCreated` round-trip. |
| Subscribe failure | 4 | Each on-chain error code 1/2/3/8 from [`WALLET_UX.md` §3.4](./WALLET_UX.md) surfaces the correct UX message. |
| Subscription list | 4 | Sort by name/amount/date/status; deduplication across multiple NFT cards; swipe menu reveals Cancel; tap expands detail sheet. |
| Cancel flow | 4 | Confirmation copy; signature dispatch; row transitions to `cancelled` on `MandateCancelled` event; pre-RP-CH-3 "Cancel and re-subscribe later" copy on the pause UX surface ([`WALLET_UX.md` §5](./WALLET_UX.md)). |
| History detail | 3 | Per-execution rows ordered newest-first; tx-link click-through; subscribe-again link visibility based on plan still active. |
| Notifications opt-in | 3 | One-time prompt copy ([`WALLET_UX.md` §6](./WALLET_UX.md)); preference roundtrip to backend; absence of an auto-sign toggle (I1). |
| Invariant guardrails | 4 | No auto-signed `ExecuteRecurringPayment` on schedule (I1); NFT picker filters to wallet-owned cards (I2); no admin "cancel-on-behalf" button (I3); cancel always reaches finality before the next period (`SPECIFICATION.md` §5.2). |
| **Total** | **28** | |

### 6.3 Contract test suite (existing, not part of AC-8)

The Tact contract test-suite in
`tests/recurring-payments/RecurringPayments.spec.ts` continues to
run on every PR. It is **not** part of the AC-8 count (AC-8
explicitly names "dashboard (47) + wallet-ui (28)"); it remains
green as a strict prerequisite via the existing CI.

---

## 7. Mainnet rollout (out of scope)

For traceability, the mainnet rollout sequence is:

1. **A2 verdict `READY`** + no critical/high open on
   `RecurringPayments.tact`.
2. **Hardening bundle** — RP-CH-1..RP-CH-5 from
   [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md) ship under
   a separate issue and PR.
3. **Mainnet multi-sig ceremony** —
   `docs/deployments/recurring-payments-mainnet/multisig.recurring.json`
   exists with `threshold >= 2`.
4. **Re-deploy** — repeat §4 against mainnet with the hardened
   bytecode hash, **without** the test-only `RegisterNFTOwnerRecurring`
   seeding step.
5. **Mainnet runbook** — a dedicated runbook will be written under
   the post-A2 issue. This testnet document is **not** the source
   of truth for mainnet.

---

## 8. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §3.1 declares the gating preconditions. |
| AC-3 | `RecurringPayments.tact` deployed to testnet | §3 manifest + §4 deployment steps. |
| AC-7 | End-to-end subscription tested on testnet | §5 happy path + §5.3 error-path coverage + §5.4 notifications integration. |
| AC-8 | Tests pass | §6.1 dashboard (47) + §6.2 wallet-ui (28). |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Adapter                | [`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned) | [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
