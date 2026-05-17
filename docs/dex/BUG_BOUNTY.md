# DEX Integration — Bug-Bounty Category

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Engagement Prerequisite:** [A4 Off-Chain Services Audit](../security/audits/A4-offchain-services/ENGAGEMENT.md) — verdict `READY`
**Program Brief:** [A5 Bug Bounty](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
**Status:** Draft — frozen at engagement kickoff; **activation gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the DEX-integration-specific addendum to the
protocol bug bounty program
([A5 PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)).
It enumerates the **DEX-specific scope, severity uplifts, and
out-of-scope clarifications** that the multi-DEX adapter / aggregator
surface needs in addition to the protocol-wide rules.

The [A5 program brief](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§3.1 already lists `backend/adapters/{toncoAdapter,dedustAdapter,priceAggregator}.ts`
as **Pending A4** — bounty submissions against them are rerouted to
the A4 intake until A4 returns verdict `READY`. This document
defines what the DEX category **will activate as** once A4 unblocks
it; it does **not** activate the category prematurely.

---

## 2. Acceptance criterion this artifact satisfies

Issue #141 §8 — _"AC-4: Fallback routing tested"_ and _"AC-7:
Liquidity monitoring alerts configured"_ rely on the bounty surface
being articulated even before activation, so that researchers
studying the testnet integration artefact know which bands are in
flight; full activation arrives only after A4.

Activation is **conditional**: the DEX integration category is
satisfied when (a) this document exists, (b) A4 reaches `READY`,
(c) [`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md)
records the category transition from `Pending A4` to `Active`, and
(d) the DEX readiness CI check
([`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts))
asserts (a)–(c) every PR.

---

## 3. In-scope assets

| Asset | Severity ceiling | Notes |
|-------|------------------|-------|
| [`backend/adapters/priceAggregator.ts`](../../backend/adapters/priceAggregator.ts) *(planned per [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md))* | **Critical** (per [A5 SEVERITY_RUBRIC.md §2.1](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)) — Critical reward band, eligible for the open-ended uplift per [A5 STATUS.md §10](../security/audits/A5-bug-bounty/STATUS.md). | Direct findings on best-price ranking, floor-price guard, fallback routing, idempotency, slippage envelope. |
| [`backend/adapters/toncoAdapter.ts`](../../backend/adapters/toncoAdapter.ts) | **High** (off-chain) | Adapter contract for the TONCO venue. |
| [`backend/adapters/dedustAdapter.ts`](../../backend/adapters/dedustAdapter.ts) *(planned per [`SPECIFICATION.md` §3](./SPECIFICATION.md))* | **High** (off-chain) | Adapter contract for the DeDust venue. |
| [`backend/adapters/types.ts`](../../backend/adapters/types.ts) | **High** (off-chain) | Shared `DexAdapter` interface — a flaw in the typed boundary lets either adapter ship a non-compliant return. |
| [`backend/indexer/`](../../backend/indexer/) (DEX subset only) | **High** (off-chain) | `dex_swap_log` / `dex_pool_depth` materialisation per [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md); slippage / liquidity alert derivation. |
| [`backend/services/notification-scheduler.ts`](../../backend/services/notification-scheduler.ts) *(planned, per [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md))* | **Medium** (off-chain) | DEX-N01..DEX-N08 dispatch, dedup key, retry policy. |
| [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts) *(planned)* | **Medium** | CI gate that prevents misconfigured releases. |
| Wallet-ui swap-sheet / slippage-slider / large-trade-modal / venue-status-pill surfaces | **High** (off-chain) | Slippage-slider tampering, quote-display corruption, large-trade-modal bypass, venue-status pill staleness. |
| Venue-key store `backend/adapters/venue-keys.json` *(planned post-DEX-AH-1)* | **High** (off-chain) | Quote-signature trust anchor — a key store corruption defeats DEX-AH-1's quote-replay closure. |
| Venue-root store `backend/adapters/venue-roots.json` *(planned post-DEX-AH-4)* | **High** (off-chain) | Transport-signature trust anchor — a key store corruption defeats DEX-AH-4's tamper-detection. |

All DEX integration findings live in the **off-chain** reward column
of the A5 program brief — Issue #141 introduces no on-chain
contracts. The aggregator is granted a **Critical** ceiling
(unusual for off-chain code) because a flaw in routing or floor
guard maps 1:1 onto user fund loss via mis-priced swaps.

---

## 4. DEX-specific severity uplifts

The protocol-wide rubric in
[`SEVERITY_RUBRIC.md` §2](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
maps to the DEX surface as follows. Where the rubric is generic
across invariants, the table below names the DEX-specific
realisation so triage stays unambiguous.

### 4.1 Critical — aggregator-level fund-loss paths

| Trigger | Realisation on DEX integration | Reward band |
|---------|--------------------------------|-------------|
| Forced fund movement via mis-routing | Any path through `priceAggregator.ts` that lets `execute()` submit a venue transaction the user did not sign in the wallet, or with `amountOutMin` lower than the user's slippage envelope ([`PRICE_AGGREGATOR.md` §5](./PRICE_AGGREGATOR.md)). | Off-chain Critical (open-ended) |
| Single-venue price-manipulation defeating the floor (T-DEX-3 break) | A PoC that produces an effective price worse than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500` from a single venue and gets accepted because the floor guard misranks or excludes the second quote. | Off-chain Critical |
| Slippage-envelope break (T-DEX-5 escalation) | Any path that lets `executeSwap` settle with `actualOut < amountOutMin` on-chain (re-quote bypass at [`SPECIFICATION.md` §3.3](./SPECIFICATION.md)). | Off-chain Critical |
| Idempotency-key collision causing duplicate execution | A duplicate `requestId` within `IDEMPOTENCY_WINDOW_SECONDS = 600 s` settles **twice** because the aggregator's idempotency store misses the second request. | Off-chain Critical (double-spend equivalent) |
| Trust-anchor corruption (post-DEX-AH-1 / DEX-AH-4) | A PoC that accepts an unsigned quote / tampered transport response because `venue-keys.json` / `venue-roots.json` was reloaded from an attacker-controlled source. | Off-chain Critical |

### 4.2 High — replay, fallback, monitoring

| Trigger | Realisation on DEX integration | Reward band |
|---------|--------------------------------|-------------|
| Quote replay past `expiresAt` (T-DEX-1) | A PoC that bypasses the `quotedAt`/`expiresAt` gate at [`SPECIFICATION.md` §3.2](./SPECIFICATION.md). Pre-DEX-AH-1 this earns High; post-DEX-AH-1 (signed-quote integration) a PoC against the signature primitive earns Critical (§4.1). | High (pre-DEX-AH-1) / Critical (post-DEX-AH-1) |
| Fallback routing failure (T-DEX-2) | A scenario where one venue errors mid-execute and the aggregator fails to retry against the next-best quote that is still within `FALLBACK_REQUOTE_WINDOW_SECONDS = 5 s` ([`PRICE_AGGREGATOR.md` §4.4](./PRICE_AGGREGATOR.md)). | Off-chain High |
| Adapter return-value tampering (T-DEX-4) | A PoC that injects a `SwapQuote` with `amountOut` higher than the venue actually pays, and the aggregator rates it as winner. Pre-DEX-AH-4 (signed-response verification) this earns High; post-DEX-AH-4 a PoC against the transport signature earns Critical (§4.1). | High → Critical |
| Health-probe demotion bypass | A PoC where a venue stays healthy in the aggregator's view despite > `HEALTH_PROBE_FAILURE_THRESHOLD` consecutive failures ([`SPECIFICATION.md` §3.4](./SPECIFICATION.md)). | Off-chain High |
| Liquidity-monitor false-negative (T-DEX-6) | A PoC where pool depth drops below `MIN_POOL_DEPTH_TON` but `DEX-M06`/`DEX-M07` never fire ([`LIQUIDITY_MONITORING.md` §3.2](./LIQUIDITY_MONITORING.md)). | Off-chain High |
| Stale-price acceptance (T-DEX-7) | A PoC where a venue's spot price is older than `PRICE_STALENESS_SECONDS = 30 s` but the aggregator quotes against it anyway. Pre-DEX-AH-7 this earns High; post-DEX-AH-7 (heartbeat enforcement) a PoC against the heartbeat earns Critical (§4.1). | High → Critical |
| Indexer mis-derivation of `dex_swap_log` rows | An indexer bug where an executed swap is logged with a wrong `venue`, `amount_out`, or `error_code` per [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md). | Off-chain High |

### 4.3 High — wallet-ui surface

| Trigger | Realisation on DEX integration | Reward band |
|---------|--------------------------------|-------------|
| Slippage slider accepts a value outside `[MIN_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS]` | A wallet-ui PoC that submits a swap with `slippageBps > 500` or `< 10` and the aggregator does not clamp ([`WALLET_UX.md` §3.2](./WALLET_UX.md), [`SLIPPAGE_PROTECTION.md` §3](./SLIPPAGE_PROTECTION.md)). | Off-chain High |
| Large-trade modal bypass (T-DEX-5) | A wallet-ui PoC where a quote carrying `warnings = ['LARGE_TRADE_VS_POOL']` reaches the `Sign & swap` CTA without rendering the large-trade modal ([`WALLET_UX.md` §4](./WALLET_UX.md)). | Off-chain High |
| Quote-expiry display drift | The wallet renders a quote as still valid for > 1 s after `expiresAt`, allowing the user to sign a stale envelope. | Off-chain High (because it influences a signing decision). |
| Wallet auto-submits a swap without the user's TON Connect prompt (I1 break) | Direct wallet-ui issue against the user-consent invariant. | Off-chain Critical (I1 break, escalated above the off-chain High default). |
| Venue badge / pill renders the wrong venue for the executed swap | A PoC where the wallet shows `TONCO` while `dex_swap_log.venue = 'DEDUST'`. | Off-chain High (influences user trust / dispute resolution). |

### 4.4 Medium — monitoring gaps, status divergence

| Trigger | Realisation on DEX integration | Reward band |
|---------|--------------------------------|-------------|
| DEX-Mxx alert ([`LIQUIDITY_MONITORING.md` §3](./LIQUIDITY_MONITORING.md)) fails to fire under a deterministic trigger | Alerting gap. | Off-chain Medium |
| Notification-scheduler dedup-key collision — two distinct push notifications arrive for the same `sha256(user_addr|event_type|request_id|epoch_bucket)` tuple | Scheduler bug per [`NOTIFICATIONS.md` §5.1](./NOTIFICATIONS.md). | Off-chain Medium → High if it reveals PII (e.g. a counterparty wallet address). |
| Pool-depth poll skew — `dex_pool_depth` rows lag the on-chain pool state by > `60 s` | Polling-cadence violation per [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md). | Off-chain Medium |
| Audit-log materialisation misses a swap (`dex_swap_log` row absent for an observed swap) | Audit-log gap per [`SPECIFICATION.md` §7.3](./SPECIFICATION.md). | Off-chain Medium |
| Webhook retries exceed `MAX_WEBHOOK_RETRIES = 5` or stop earlier than documented | Notification-channel bug per [`NOTIFICATIONS.md` §5.2](./NOTIFICATIONS.md). | Off-chain Medium |

### 4.5 Low / Informational

Same as protocol-wide rubric. No DEX-specific uplift.

---

## 5. DEX-specific out-of-scope clarifications

The following items extend the protocol-wide out-of-scope list in
[`PROGRAM_BRIEF.md` §3.4](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md):

| Item | Rationale |
|------|-----------|
| Findings against the underlying TONCO or DeDust pool contracts themselves | Out-of-scope — those are external trust assumptions per [`docs/deployments/network-matrix.md`](../deployments/network-matrix.md) §125–142. Report directly to the venue's own bug-bounty program. The DEX integration scope is the adapter / aggregator surface. |
| Findings that require the user to sign a malicious swap payload after the wallet renders the venue + amount + slippage sheet | Out-of-scope per the user-consent rule. The wallet always shows the swap sheet field-by-field per [`WALLET_UX.md` §3](./WALLET_UX.md); a user who confirms a hostile payload is not a protocol bug. |
| Findings that require **both** venues to collude in returning the same biased quote | Out-of-scope per [`SPECIFICATION.md` §7.1 T-DEX-3](./SPECIFICATION.md). The dual-venue minimum **assumes** the venues are independent failure surfaces. Findings that defeat the floor guard with a single venue qualify (§4.1). Findings that demonstrate cross-venue collusion against the post-DEX-AH-3 TWAP oracle qualify (§4.1 trust-anchor item). |
| Price slippage caused by genuine market movement during the quote-validity window | By design — the user accepted `slippageBps`. A reverted swap that triggers `ERROR_DEX_SLIPPAGE_EXCEEDED` is correct behaviour, not a finding. |
| Quote expiry causing a user to lose access to a stale price | By design — `quotedAt`/`expiresAt` is the documented replay-protection envelope ([`SPECIFICATION.md` §7.4](./SPECIFICATION.md)). |
| Findings on the test-only fixture-seeding step ([`TESTNET_INTEGRATION.md` §4 step 7](./TESTNET_INTEGRATION.md)) post-mainnet | Out-of-scope — the testnet ceremony is explicit that fixture seeding is testnet-only. Mainnet liquidity is provided by external market-makers. |
| Findings against third-party push services (FCM / APNS) or transactional-email providers (Postmark) | Out-of-scope per the third-party-dependency rule. Report to the provider's own program. |
| Wallet-ui rendering glitches that do not lead to a mis-signed payload | Off-chain Low at most; not a DEX-specific bounty band. |

---

## 6. Threat-catalogue cross-reference

The A4 threat catalogue (mapped to the DEX subset in
[`SPECIFICATION.md` §7.1](./SPECIFICATION.md)) maps to bug-bounty
bands as follows. The T-DEX-N IDs match the threat catalogue in
[`SPECIFICATION.md` §7.1](./SPECIFICATION.md) and the closures in
[`ADAPTER_HARDENING.md` §3](./ADAPTER_HARDENING.md):

| A4 / DEX threat | Description | Closure | Bounty band |
|-----------------|-------------|---------|-------------|
| **T-DEX-1** | Quote replay (cached `SwapQuote` used after price moves) | DEX-AH-1 (signed-quote integration) | High (pre-DEX-AH-1) / Critical (post-DEX-AH-1) — §4.2 / §4.1 |
| **T-DEX-2** | Single venue downtime collapses swap functionality | DEX-AH-2 (third-venue spike) | High (§4.2 here) |
| **T-DEX-3** | Single-venue price manipulation (e.g. flash-loan twap skew) | DEX-AH-3 (TWAP oracle) | Critical (§4.1 here) |
| **T-DEX-4** | Adapter return-value tampering (compromised venue API) | DEX-AH-4 (signed-response verification) | High → Critical (§4.2 here) |
| **T-DEX-5** | Large trade pumping pool against trader | DEX-AH-5 (route splitting) | Critical for slippage-envelope break (§4.1); High for large-trade modal bypass (§4.3) |
| **T-DEX-6** | Liquidity drain (sudden pool depth collapse) | DEX-AH-6 (auto-pause hook) | High for liquidity-monitor false-negative (§4.2); Critical when paired with an aggregator-side fund-loss path (§4.1) |
| **T-DEX-7** | Stale price feed (venue ticker frozen) | DEX-AH-7 (heartbeat enforcement) | High (pre-DEX-AH-7) / Critical (post-DEX-AH-7) — §4.2 / §4.1 |

---

## 7. Activation timeline

The DEX integration bounty category activates only after:

1. **A4 verdict `READY`** — recorded in
   [`docs/security/audits/A4-offchain-services/STATUS.md`](../security/audits/A4-offchain-services/STATUS.md).
2. **DEX-AH-1..DEX-AH-7 landed** — per
   [`ADAPTER_HARDENING.md` §3](./ADAPTER_HARDENING.md).
   (DEX-AH-1 in particular — signed-quote integration — is required
   so that researchers can validate the post-hardening replay
   primitive rather than the pre-hardening envelope. DEX-AH-4 in
   particular — signed-response verification — closes the
   adapter-tampering gap so that researchers don't waste cycles
   probing transport-level forgery against an absent trust anchor.)
3. **PROGRAM_BRIEF.md update** — the §3.1 row for
   `backend/adapters/{toncoAdapter,dedustAdapter,priceAggregator}.ts`
   transitions from `Pending A4` to `Active` and references this
   document for the DEX-specific scope.
4. **STATUS.md note** — the bug-bounty `STATUS.md` records the
   category activation date and the DEX-specific intake URL.

Activation **must not** precede A4. A premature activation would
expose the protocol to a bounty-payout obligation for findings that
the A4 audit would have caught for a flat audit fee.

---

## 8. Triage SLA (DEX findings)

The protocol-wide SLA in
[`PROGRAM_BRIEF.md` §6](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
applies to DEX submissions. DEX-specific refinements:

| Severity | Initial response | Triage decision | Notes |
|----------|-----------------:|----------------:|-------|
| Critical | 4 h              | 24 h            | Critical DEX findings invoke the auto-pause lever in [`LIQUIDITY_MONITORING.md` §3.5 DEX-M18](./LIQUIDITY_MONITORING.md) with reason-code `RC-BOUNTY-CRITICAL`. The pause refuses **new** TBC/TON swap proposals while triage is in progress; in-flight swaps continue to honour their existing quotes so they can settle or revert cleanly. |
| High     | 8 h              | 72 h            | High DEX findings page the on-call (P1 per [`LIQUIDITY_MONITORING.md` §3.6](./LIQUIDITY_MONITORING.md)). |
| Medium   | 24 h             | 7 days          | Standard triage queue. |
| Low      | 7 days           | 14 days         | Standard triage queue. |

The Critical DEX SLA is **tighter** than the protocol-wide default
because a Critical finding's payload can drain funds from every
wallet whose swap is in flight against the affected venue. The
`RC-BOUNTY-CRITICAL` pause is a defence-in-depth lever — the
alternative is hoping the discoverer withholds disclosure during the
standard triage window.

---

## 9. Acceptance criteria mapping (Issue #141 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A4 audit complete (prerequisite) | §7 — gates activation on A4. |
| AC-2 | DeDust adapter created | §3 — bounty bands cover `dedustAdapter.ts` from first activation. |
| AC-3 | Price aggregator module created | §3 / §4.1 — aggregator is the Critical-ceiling asset. |
| AC-4 | Fallback routing tested | §4.2 — fallback failure is an Off-chain High band. |
| AC-5 | Slippage tolerance configurable and enforced | §4.1 (slippage-envelope break) / §4.3 (slippage slider bypass). |
| AC-6 | Liquidity monitoring alerts configured | §4.2 (liquidity-monitor false-negative) / §4.4 (alert miss). |
| AC-7 | Performance budget met | §4.4 — pool-depth poll skew categorised; performance-budget breaches surface as Off-chain Medium absent a fund-loss path. |

---

## 10. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Price aggregator       | [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) |
| Slippage protection    | [`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) |
| Liquidity monitoring   | [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Adapter hardening      | [`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) |
| Testnet integration    | [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) |
| A4 audit engagement    | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |
| A5 program brief       | [`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md) |
| A5 severity rubric     | [`docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md`](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md) |
| A5 status              | [`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md) |
| Invariants             | [`audit/INVARIANTS.md`](../../audit/INVARIANTS.md) |
| Pattern: F5 bug bounty | [`docs/multisig/BUG_BOUNTY.md`](../multisig/BUG_BOUNTY.md) |

---

## 11. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #141 (F6). |
