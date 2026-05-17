# Recurring Payments — Bug-Bounty Category

**Document Type:** Recurring Payments Production Readiness Artifact
**Issue Reference:** [#139 — F4 Recurring Payments Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/139)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Program Brief:** [A5 Bug Bounty](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
**Status:** Draft — frozen at engagement kickoff; **activation gated on A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the recurring-payments-specific addendum to the
protocol bug bounty program ([A5
PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)).
It enumerates the **recurring-payments-specific scope, severity
uplifts, and out-of-scope clarifications** that the recurring-payments
surface needs in addition to the protocol-wide rules.

The [A5 program brief](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§3.1 already lists `RecurringPayments.tact` as **Pending A2** —
bounty submissions against it are rerouted to the A2 intake until A2
returns verdict `READY`. This document defines what the
recurring-payments category **will activate as** once A2 unblocks
it; it does **not** activate the category prematurely.

---

## 2. Acceptance criterion this artifact satisfies

Issue #139 §8 — _"AC-7: End-to-end subscription tested on testnet"_
relies on the bounty surface being articulated even before activation,
so that researchers studying the testnet artefact know which bands
are in flight; full activation arrives only after A2.

Activation is **conditional**: the recurring-payments category is
satisfied when (a) this document exists, (b) A2 reaches `READY`, (c)
[`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md)
records the category transition from `Pending A2` to `Active`, and
(d) the recurring-payments readiness CI check
([`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts))
asserts (a)–(c) every PR.

---

## 3. In-scope assets

| Asset | Severity ceiling | Notes |
|-------|------------------|-------|
| [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) | **Critical** (per [A5 SEVERITY_RUBRIC.md §2.1](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)) — Critical reward band, eligible for the open-ended uplift per [A5 STATUS.md §10](../security/audits/A5-bug-bounty/STATUS.md). | Direct contract findings. |
| [`backend/adapters/recurring.ts`](../../backend/adapters/recurring.ts) | **High** (off-chain auth-break severity tier) | Adapter logic — period bounds, mandate-id generation, status derivation. |
| [`backend/services/recurring-executor/`](../../backend/services/recurring-executor/) *(planned, per [`DASHBOARD_INTEGRATION.md` §5](./DASHBOARD_INTEGRATION.md))* | **High** (off-chain) | Merchant-side cron executor — idempotency, backoff, signing-key custody. |
| [`backend/services/notification-scheduler.ts`](../../backend/services/notification-scheduler.ts) *(planned, per [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md))* | **Medium** (off-chain) | Scheduler — dedup key, retry policy. |
| [`backend/indexer/`](../../backend/indexer/) (recurring-payments event subset only) | **High** (off-chain) | Mandate lifecycle status derivation per [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md). |
| [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts) *(planned)* | **Medium** | CI gate that prevents misconfigured releases. |
| Dashboard plan / subscriber / analytics views | **High** (off-chain auth-break tier) | Forced-mutate on a plan record, force-cancel admin path, or MRR mis-aggregation. |
| Wallet-ui subscribe / cancel / pause surface | **High** (off-chain) | Plan-link tampering, signature-prompt corruption, auto-sign exploit. |

Off-chain adapter / indexer / dashboard / wallet-ui findings stay in
the **off-chain** reward column of the A5 program brief.
Smart-contract findings against `RecurringPayments.tact` use the
**smart-contract** column, with the recurring-payments-specific
severity uplifts in §4.

---

## 4. Recurring-payments-specific severity uplifts

The protocol-wide rubric in
[`SEVERITY_RUBRIC.md` §2](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
maps to the recurring-payments surface as follows. Where the rubric
is generic across invariants, the table below names the
recurring-payments-specific realisation so triage stays unambiguous.

### 4.1 Critical — `I1` Non-Custodial / `I2` NFT Authority break

| Trigger | Realisation on recurring-payments | Reward band |
|---------|------------------------------------|-------------|
| Forced fund movement | Any path through `RecurringPayments.tact` that moves TBC from a user without the user having signed `CreateMandate`. **Cannot exist by construction (the contract is non-custodial; transfers route through `PaymentHub.tact`)** — but any payload that tricks `PaymentHub.tact` into transferring user funds via the recurring-payments path qualifies. | Smart-contract Critical (open-ended) |
| Mandate creation without NFT-owner signature (I2 break) | Any path that lets `sender() != owner(nft_address)` create a mandate, including a forged `RegisterNFTOwnerRecurring` precondition that the test-only handler accepted under non-deployer authority. | Smart-contract Critical |
| Forced cancellation by a non-owner (I2 break, withdraw direction) | A `CancelMandate` accepted from a sender that does not own `nft_address`. Effectively a denial-of-service on the user but counted as I2 because the user lost control. | Smart-contract Critical |
| Forced execution past `max_executions` (Ledger Conservation I5 break) | A sequence of `ExecuteRecurringPayment` that succeeds past `max_executions`, charging the user more than they signed for. | Smart-contract Critical |

### 4.2 High — `I3` admin escape, replay, collision

| Trigger | Realisation on recurring-payments | Reward band |
|---------|------------------------------------|-------------|
| Replay of `ExecuteRecurringPayment` for the same execution number (T-RP-2) | A PoC that bypasses the `last_executed_at + period_seconds > now()` gate at [contract lines 296–302](../../contracts/RecurringPayments.tact). | Smart-contract High |
| Mandate-key collision (T-RP-1 / X-5) demonstrated with two distinct `(nft_address, mandate_id)` pairs | Known A2-class issue per [`SPECIFICATION.md` §9](./SPECIFICATION.md). PoC against the **current** combinator `sha256(addr.asSlice()) + id` at [contract line 402](../../contracts/RecurringPayments.tact) earns the High band even though documented; PoC against the **post-RP-CH-1** combinator earns Critical. | High (current) / Critical (post-RP-CH-1) |
| Merchant-address substitution (T-RP-4) — a PoC where the wallet renders one merchant in the authorization sheet but the on-chain `CreateMandate` carries a different `merchant_address` | Operationally mitigated by the dashboard plan signature today; on-chain after RP-CH-5. PoC against either layer qualifies. | High → Critical (if it routes funds to attacker) |
| Test-only handler `RegisterNFTOwnerRecurring` ([contract lines 428–432](../../contracts/RecurringPayments.tact)) reachable from a non-deployer sender | Already caught by the deployer guard; any PoC bypassing the guard earns Critical (I2 break) before mainnet, High after the handler is removed per [`CONTRACT_HARDENING.md` RP-CH-2](./CONTRACT_HARDENING.md). | High → Critical |
| Auto-pause RP-CH-3 bypass — a `CreateMandate` or `ExecuteRecurringPayment` that succeeds while `self.paused == true` (post-RP-CH-3) | Direct contract issue. | Smart-contract High |

### 4.3 High — off-chain executor / indexer

| Trigger | Realisation on recurring-payments | Reward band |
|---------|------------------------------------|-------------|
| Executor key leak via dashboard logs / monitoring exhaust | A PoC where the merchant executor's signing key reaches an external service through dashboard plain-text logs, error pages, or webhook payloads. | Off-chain High |
| Indexer mis-derivation of `status` (lapsed / cancelled / expired) under a deterministic edge case | Indexer bug per [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md). | Off-chain High |
| Notification-scheduler dedup-key collision — two distinct push notifications arrive for the same `(user_id, mandate_id, RP-Nxx, t_next)` | Direct scheduler bug per [`NOTIFICATIONS.md` §5.1](./NOTIFICATIONS.md). | Off-chain Medium → High if it reveals PII. |
| Webhook HMAC-SHA256 forgery — accept a webhook payload from a non-merchant origin | Direct webhook auth issue per [`NOTIFICATIONS.md` §4.3](./NOTIFICATIONS.md). | Off-chain High |

### 4.4 Medium — monitoring gaps, status divergence

| Trigger | Realisation on recurring-payments | Reward band |
|---------|------------------------------------|-------------|
| SUB-Mxx alert ([`MONITORING.md` §3](./MONITORING.md)) fails to fire under a deterministic trigger | Alerting gap. | Off-chain Medium |
| Dashboard subscriber list mis-categorises a cancelled mandate as active for > 1 indexed block | Status-divergence issue per [`DASHBOARD_INTEGRATION.md` §4.1](./DASHBOARD_INTEGRATION.md). | Off-chain Medium |
| Wallet-ui authorization sheet renders a stale plan amount after the merchant updated the plan on the dashboard | UX freshness gap; not a fund-loss path but mis-informs the signer. | Off-chain Medium |

### 4.5 Low / Informational

Same as protocol-wide rubric. No recurring-payments-specific uplift.

---

## 5. Recurring-payments-specific out-of-scope clarifications

The following items extend the protocol-wide out-of-scope list in
[`PROGRAM_BRIEF.md` §3.4](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md):

| Item | Rationale |
|------|-----------|
| Findings that require the user to sign a malicious `CreateMandate` payload after explicit confirmation in the wallet | Out-of-scope per the user-consent rule. The wallet always shows the authorization sheet field-by-field per [`WALLET_UX.md` §3.2](./WALLET_UX.md); a user who confirms a hostile payload is not a protocol bug. |
| Findings on test-only handler `RegisterNFTOwnerRecurring` ([contract lines 428–432](../../contracts/RecurringPayments.tact)) | Out of scope post-removal — RP-CH-2 removes this handler before mainnet per [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md). Pre-mainnet findings against the deployer-gate qualify (§4.2). |
| Merchant fails to dispatch `ExecuteRecurringPayment` before the grace window lapses | By design — non-custodial pull model. The user is not charged when the merchant fails to act; this is correct behaviour, not a finding. |
| Dashboard "subscriber list export" leaks the user's NFT address | Out-of-scope — NFT addresses are on-chain public per the protocol's transparency posture ([`SPECIFICATION.md` §3](./SPECIFICATION.md)). |
| Wallet-ui rendering glitches that do not lead to a mis-signed payload | Off-chain Low at most; not a recurring-payments-specific bounty band. |
| Findings against third-party push services (FCM / APNS) or transactional-email providers (Postmark) | Out-of-scope per the third-party-dependency rule. Report to the provider's own program. |

---

## 6. Threat-catalogue cross-reference

The A2 threat catalogue in
[`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md` §4.1](../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
maps to bug-bounty bands as follows. The T-RP-N IDs match the
threat catalogue in
[`SPECIFICATION.md` §9](./SPECIFICATION.md):

| A2 threat | Description | Bounty band |
|-----------|-------------|-------------|
| **T-RP-1** | Mandate-key collision (X-5) | High (current combinator) / Critical (post-RP-CH-1) (§4.2 here) |
| **T-RP-2** | Replay of `ExecuteRecurringPayment` past the period gate | High (§4.2 here) |
| **T-RP-3** | Mandate freeze (DoS) by repeated `MandateCancelled` against a recovering mandate | Out-of-scope unless the cancel succeeds without owner signature, in which case Critical (§4.1 I2 break) |
| **T-RP-4** | Merchant-address substitution | High → Critical per impact (§4.2 here) |
| **T-RP-5** | Indexer / dashboard status divergence | Medium (§4.4 here) |
| **T-RP-6** | Test-only `RegisterNFTOwnerRecurring` reaches mainnet | High → Critical pre-removal; out-of-scope post-RP-CH-2 (§4.2 / §5 here) |

---

## 7. Activation timeline

The recurring-payments bounty category activates only after:

1. **A2 verdict `READY`** — recorded in
   [`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md).
2. **RP-CH-1..RP-CH-5 landed** — per
   [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md).
   (RP-CH-2 in particular — removal of the test-only handler — is
   required so that researchers don't waste cycles finding
   pre-removal issues.)
3. **PROGRAM_BRIEF.md update** — the §3.1 row for
   `RecurringPayments.tact` transitions from `Pending A2` to `Active`
   and references this document for the recurring-payments-specific
   scope.
4. **STATUS.md note** — the bug-bounty `STATUS.md` records the
   category activation date and the recurring-payments-specific
   intake URL.

Activation **must not** precede A2. A premature activation would
expose the protocol to a bounty-payout obligation for findings that
the A2 audit would have caught for a flat audit fee.

---

## 8. Triage SLA (recurring-payments findings)

The protocol-wide SLA in
[`PROGRAM_BRIEF.md` §6](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
applies to recurring-payments submissions. Recurring-payments-specific
refinements:

| Severity | Initial response | Triage decision | Notes |
|----------|-----------------:|----------------:|-------|
| Critical | 4 h              | 24 h            | Critical recurring-payments findings invoke `PauseRecurringPayments` while triage is in progress (post-RP-CH-3). The pause is automatic per the [`MONITORING.md` §3.6 SUB-M18](./MONITORING.md) auto-trigger with reason-code `RC-BOUNTY-CRITICAL`. |
| High     | 8 h              | 72 h            | High recurring-payments findings page the on-call (P1 per [`MONITORING.md` §3.7](./MONITORING.md)). |
| Medium   | 24 h             | 7 days          | Standard triage queue. |
| Low      | 7 days           | 14 days         | Standard triage queue. |

The Critical recurring-payments SLA is **tighter** than the
protocol-wide default because a Critical finding's payload can drain
funds from every active mandate within the period window. The
`RC-BOUNTY-CRITICAL` pause is a defence-in-depth lever — the
alternative is hoping the discoverer withholds disclosure during the
standard triage window.

---

## 9. Acceptance criteria mapping (Issue #139 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §7 — gates activation on A2. |
| AC-2 | `SPECIFICATION.md` written | §6 — bounty bands track the T-RP-N catalogue in [`SPECIFICATION.md` §9](./SPECIFICATION.md). |
| AC-4 | Dashboard subscription section | §4.3 / §4.4 — off-chain bounty bands cover the dashboard surfaces from [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md). |
| AC-5 | Wallet cancel/pause/resume UX | §4.1 / §4.4 — wallet-ui findings categorised. |
| AC-6 | User notification system | §4.3 — webhook + scheduler bounty bands cover [`NOTIFICATIONS.md`](./NOTIFICATIONS.md). |
| AC-7 | End-to-end subscription tested on testnet | this document, activation per §7. |

---

## 10. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/RecurringPayments.tact`](../../contracts/RecurringPayments.tact) |
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Dashboard integration  | [`DASHBOARD_INTEGRATION.md`](./DASHBOARD_INTEGRATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| A5 program brief       | [`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md) |
| A5 severity rubric     | [`docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md`](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md) |
| A5 status              | [`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md) |
| Invariants             | [`audit/INVARIANTS.md`](../../audit/INVARIANTS.md) |

---

## 11. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #139 (F4). |
