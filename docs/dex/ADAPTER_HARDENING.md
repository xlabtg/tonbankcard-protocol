# DEX Integration — Adapter Hardening Track (post-A4)

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Engagement Prerequisite:** [A4 Off-Chain Services Audit](../security/audits/A4-offchain-services/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **no adapter code shipped until A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document collects every off-chain adapter / aggregator change
planned for the DEX integration layer as part of production
hardening. The changes are intentionally **deferred** past the A4
audit baseline — landing any of them before A4 returns verdict
`READY` would invalidate the audit scope and reset the engagement
clock.

The pattern mirrors the F3 PR #206 (cross-chain bridge, issue #138),
F4 PR #207 (recurring payments, issue #139), and F5 PR #208
(multi-sig card, issue #140) approaches: governance documents,
off-chain validators, and tests land now under issue #141; adapter
code lands later, in a follow-up PR that explicitly cites this
document and the A4 verdict.

Every other DEX production-readiness document
([`SPECIFICATION.md`](./SPECIFICATION.md),
[`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md),
[`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md),
[`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md),
[`BUG_BOUNTY.md`](./BUG_BOUNTY.md)) references **DEX-AH-N** items by
ID from §3 below — this is the single source of truth for the
adapter changes the DEX integration production launch depends on.

---

## 2. Why deferred (not "future-work")

Issue #141 §7 names the off-chain security model as a **hard
prerequisite** for production rollout:

> _"The price aggregator MUST NOT be susceptible to price
> manipulation via a single venue, and the protocol MUST reject
> swaps whose effective price falls below a floor threshold."_

The A4 engagement
([`ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md))
covers the off-chain surface (`api/`, `backend/indexer/`, `sdk/`)
that the DEX adapters extend. A4 §6 OWASP review and the supply-chain
review specifically cover the adapter-to-venue HTTP edge.

Changing any line of `backend/adapters/priceAggregator.ts`,
`backend/adapters/toncoAdapter.ts`, or
`backend/adapters/dedustAdapter.ts` ahead of the A4 audit:

1. Invalidates the auditor's review of the off-chain bytecode /
   bundle hash.
2. Resets the clock on the threat-catalogue review (T-DEX-1..T-DEX-7
   from [`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).
3. Disqualifies the deployment manifest from the testnet ceremony
   documented in
   [`TESTNET_INTEGRATION.md` §3](./TESTNET_INTEGRATION.md).

Therefore each DEX-AH-N item below is **designed but not landed**
under issue #141. Landing happens in a follow-up issue referencing
this document, gated by the conditions in §4.

---

## 3. Hardening Backlog

Each row below has the same shape: the threat it closes, the
adapter / aggregator diff in shape (not in literal code), and the
cross-document references that flip from "operationally mitigated"
to "closed in the adapter" once the change ships.

### DEX-AH-1 — Signed-quote integration

**Closes threat:** T-DEX-1 quote replay
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| `SwapQuote` envelope ([`SPECIFICATION.md` §3.2](./SPECIFICATION.md)) | Add `venueSignature: Hex` field carrying the venue's signature over `(venue, amountIn, tokenIn, tokenOut, amountOut, quotedAt, expiresAt)` using the venue's published quote key. |
| `getSwapQuote()` adapter contract | Each adapter MUST return a `venueSignature` whose key matches the rotation entry in `backend/adapters/venue-keys.json`. |
| Aggregator verification | `priceAggregator.quote()` rejects unsigned or stale-signature quotes with new code `ERROR_DEX_QUOTE_UNSIGNED = 10`. |
| Key-rotation policy | `backend/adapters/venue-keys.json` keyed by `(venue, version)`; rotation cadence ≤ 30 days; rotation events emit `DEX-M19` (informational). |
| Backwards compatibility | None required — adapters land together with the post-A4 follow-up. |

**Migration:** None — adapter code lands only after the follow-up
PR.

**Tests required at landing:** unit test that a tampered
`amountOut` invalidates the signature; replay of a valid signature
past `expiresAt` is rejected with `ERROR_DEX_QUOTE_EXPIRED` (not
the new unsigned code); key-rotation acceptance window matches the
documented cadence.

**Doc references that update:**
[`SPECIFICATION.md` §3.2 SwapQuote table](./SPECIFICATION.md) gains
`venueSignature`; [`SPECIFICATION.md` §7.1 T-DEX-1](./SPECIFICATION.md)
flips from "operationally mitigated" to "closed in adapter";
[`PRICE_AGGREGATOR.md` §4.1 query strategy](./PRICE_AGGREGATOR.md)
adds the signature-verify step to the pipeline.

### DEX-AH-2 — Third-venue spike (STON.fi)

**Closes threat:** T-DEX-2 single-venue downtime
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| New adapter `backend/adapters/stonfiAdapter.ts` | Implements `DexAdapter` against STON.fi v2 pools. |
| Aggregator fan-out ([`PRICE_AGGREGATOR.md` §4.1](./PRICE_AGGREGATOR.md)) | Extends from 2-venue to 3-venue parallel fan-out. Tie-break order becomes `['TONCO', 'DEDUST', 'STONFI']`. |
| Health-probe stream | Adds STON.fi probe at the same 60 s cadence; demotion alert `DEX-M03` widens to include STON.fi. |
| Configuration | `AggregatorOptions.venues` accepts the STON.fi adapter instance; default config stays at TONCO + DeDust until the post-A4 follow-up lands. |
| Performance budget | Aggregator P95 latency budget unchanged at `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms`; the third venue MUST honour the same budget. |

**Migration:** Existing `dex_swap_log` rows are unchanged; new
`venue = 'STONFI'` rows begin appearing once the adapter lands.

**Tests required at landing:** parallel fan-out against three
venues with one mock failure (STON.fi down, TONCO + DeDust serve);
parallel fan-out against three venues with two mock failures
(only STON.fi serves); fallback chain `winner → loser-1 → loser-2`
exercised end-to-end.

**Doc references that update:**
[`SPECIFICATION.md` §3.1](./SPECIFICATION.md) `venue` enum widens to
`'TONCO' | 'DEDUST' | 'STONFI'`;
[`PRICE_AGGREGATOR.md` §4.2 tie-break order](./PRICE_AGGREGATOR.md)
gains `'STONFI'`; [`LIQUIDITY_MONITORING.md` §3.1
DEX-M03](./LIQUIDITY_MONITORING.md) widens the demotion-source set.

### DEX-AH-3 — TWAP oracle for price floor

**Closes threat:** T-DEX-3 single-venue price manipulation
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| New module `backend/adapters/twapOracle.ts` | Maintains a 30-minute rolling TWAP per `(tokenIn, tokenOut)` pair sampled at 60 s. |
| Aggregator floor guard ([`PRICE_AGGREGATOR.md` §4.3](./PRICE_AGGREGATOR.md)) | Replaces the instantaneous `MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500` floor with a TWAP-gated check: a quote is rejected if `\|quote.midPrice / twap30m − 1\| > MAX_TWAP_DEVIATION_BPS = 300`. |
| Storage | TWAP samples persisted to the indexer `dex_twap` table with `(timestamp, token_in, token_out, mid_price_e18)`. |
| Configuration | `AggregatorOptions.twapWindowSeconds`, `AggregatorOptions.twapDeviationBps`. |
| Error code | New `ERROR_DEX_TWAP_REJECT = 11` (distinct from the instantaneous `ERROR_DEX_FLOOR_REJECT = 8`). |

**Migration:** First 30 min after landing the TWAP is bootstrapped
from cached indexer prices (per
[`PRICE_AGGREGATOR.md` §4.3](./PRICE_AGGREGATOR.md)); during
bootstrap the aggregator falls back to the instantaneous floor.

**Tests required at landing:** a flash-loan style mid-price spike
(both venues quote 10 % off mid for 30 s) is rejected with
`ERROR_DEX_TWAP_REJECT`; a sustained price move over 30 min is
accepted (TWAP catches up); bootstrap window correctly degrades to
the instantaneous floor.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-DEX-3](./SPECIFICATION.md) flips to
"closed in adapter"; [`PRICE_AGGREGATOR.md` §4.3
floor-price guard](./PRICE_AGGREGATOR.md) flips from "instantaneous"
to "TWAP-gated"; [`LIQUIDITY_MONITORING.md`
§3.1 DEX-M02](./LIQUIDITY_MONITORING.md) trigger source extends to
the TWAP module.

### DEX-AH-4 — Signed-response verification

**Closes threat:** T-DEX-4 adapter return-value tampering
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Adapter HTTP layer | Each venue HTTPS response is wrapped in a transport-level signature (e.g. `X-Signature: base64(ed25519(body))`). Adapters reject responses where the signature does not validate against the published venue key. |
| Trust anchor | Per-venue trust roots committed to `backend/adapters/venue-roots.json`; rotation cadence ≤ 90 days. |
| Aggregator surfacing | An invalid signature surfaces as `ERROR_DEX_VENUE_DOWN` (existing code 2) — externally indistinguishable from a venue outage so the fallback path remains identical. |
| Telemetry | A signature-validation failure increments `dex_adapter_signature_failure_total{venue=<venue>}` so operators can distinguish transport tampering from genuine outages without exposing it to the caller. |

**Migration:** None — adapters MUST validate from the first call
once the follow-up PR ships.

**Tests required at landing:** a valid response passes; a
body-tampered response is rejected; a stale-key response is
rejected; a missing-header response is rejected; the metric
increments exactly once per failure.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-DEX-4](./SPECIFICATION.md) flips to
"closed in adapter"; [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md)
gains data source `DS-5` (adapter signature-validation metric).

### DEX-AH-5 — Route splitting across venues

**Closes threat:** T-DEX-5 large-trade pumping
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Aggregator API | `quote()` returns `splitRoute: SplitLeg[]` (each leg `{venue, amountIn, amountOut}`) instead of a single `winner` whenever `amountIn > poolDepthIn * LIQUIDITY_WARN_THRESHOLD_BPS / 10000`. |
| Execute path | `execute(quote)` iterates over `splitRoute` and submits one signed leg per venue; each leg honours `amountOutMin` proportionally. |
| Wallet UX | The large-trade modal renders `splitRoute` to the user before sign — the same `Sign anyway` button signs all legs together. |
| Idempotency | Each leg carries a child `requestId = sha256(parentRequestId || venue)`; the aggregator's idempotency store keys on the child id. |
| Error semantics | If one leg fails the other legs are still settled; the failed leg returns its own `errorCode`. The aggregator surfaces `ERROR_DEX_PARTIAL_FILL = 12` to the caller carrying the per-leg breakdown. |

**Migration:** Existing single-leg swaps continue working — the
aggregator returns `splitRoute = [{venue: winner.venue, amountIn,
amountOut}]` so the call shape is unchanged for non-split trades.

**Tests required at landing:** a trade at exactly the warn
threshold returns a single-leg route; a trade 2× the threshold
returns a two-leg route across TONCO + DeDust; a three-venue split
exercises STON.fi (post-DEX-AH-2); per-leg revert is surfaced via
`ERROR_DEX_PARTIAL_FILL`.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-DEX-5](./SPECIFICATION.md) flips to
"closed in adapter"; [`SLIPPAGE_PROTECTION.md` §4
pre-trade depth warning](./SLIPPAGE_PROTECTION.md) gains the
split-route mitigation path; [`WALLET_UX.md` §4 large-trade
modal](./WALLET_UX.md) renders the split route.

### DEX-AH-6 — Auto-pause hook on liquidity drain

**Closes threat:** T-DEX-6 liquidity drain
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Monitoring → Hub bridge | `LIQUIDITY_MONITORING.md` alert `DEX-M02` (every venue below `MIN_POOL_DEPTH_TON`) fires the `RC-LIQUIDITY-DRAIN` reason code at the Merchant Payment Hub auto-pause lever. |
| Hub pause behaviour | The Hub refuses **new** TBC/TON swap proposals while the reason code is active; in-flight swaps continue to honour their existing quotes so they can settle or revert cleanly. |
| Notifications | `DEX-N08` (auto-pause acknowledgement) is dispatched to every wallet that touched a TBC/TON swap within the last 24 h. |
| Recovery | The Hub auto-resumes when **at least one** venue re-crosses `MIN_POOL_DEPTH_TON × 1.2` (20 % hysteresis) for 5 consecutive minutes; resumption emits `DEX-M21` (informational). |
| CLI | Operators can manually clear `RC-LIQUIDITY-DRAIN` via `scripts/dex/aggregator-cli.ts resume --reason=manual` after confirming sufficient liquidity. |

**Migration:** None — the Hub already supports reason-coded
pauses; this item adds a new reason code and the wiring.

**Tests required at landing:** a drained-pool scenario triggers
the pause; new swap proposals receive `ERROR_DEX_INSUFFICIENT_LIQUIDITY`
during the pause; in-flight swaps complete; auto-resume fires at the
correct hysteresis boundary; manual resume works.

**Doc references that update:**
[`SPECIFICATION.md` §7.1 T-DEX-6](./SPECIFICATION.md) flips to
"closed in adapter"; [`LIQUIDITY_MONITORING.md` §3.5
DEX-M18](./LIQUIDITY_MONITORING.md) flips from "documented"
to "wired"; [`NOTIFICATIONS.md` §3.4
DEX-N08](./NOTIFICATIONS.md) flips from "documented" to "active".

### DEX-AH-7 — Heartbeat enforcement

**Closes threat:** T-DEX-7 stale price feed
([`SPECIFICATION.md` §7.1](./SPECIFICATION.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Adapter contract | Each adapter MUST poll its venue's spot price every `HEARTBEAT_INTERVAL_SECONDS = 15 s` independently of caller-initiated quotes. A heartbeat failure is recorded into the health-probe stream identically to an explicit `healthCheck()` failure. |
| Aggregator demotion | After `HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive heartbeat misses (45 s of silence) the venue is demoted to `DEGRADED` — the same demotion path as `healthCheck()`. |
| Surfacing | Heartbeat failures emit `DEX-M20` (active-probe failure) alongside the existing `DEX-M03` (demotion alert). |
| Resource budget | The heartbeat respects the Issue #141 §6 indexer-overhead budget (≤ 10 %) — heartbeat samples reuse the same connection pool as `getCurrentPrice` and surface no new database writes. |

**Migration:** None — heartbeats start on adapter load.

**Tests required at landing:** a venue that stops responding to
heartbeats is demoted after exactly 3 misses; a venue that responds
to `getCurrentPrice` but not heartbeats is also demoted (so an
attacker cannot keep the venue "alive" by impersonating one channel);
heartbeat metric increments at the documented cadence.

**Doc references that update:**
[`SPECIFICATION.md` §3.1 stale-price reject](./SPECIFICATION.md)
flips from "passive" to "active heartbeat";
[`SPECIFICATION.md` §7.1 T-DEX-7](./SPECIFICATION.md) flips to
"closed in adapter"; [`LIQUIDITY_MONITORING.md` §3.1
DEX-M03 / DEX-M20](./LIQUIDITY_MONITORING.md) gains the heartbeat
source.

---

## 4. Sign-off Gating

DEX-AH-N items may only land in a follow-up PR after **all** of the
following conditions hold:

1. **A4 verdict.** A4 audit
   ([`ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md))
   returns verdict `READY` and the corresponding `STATUS.md` is
   updated.
2. **No critical/high outstanding.** A4 final report lists zero
   open critical or high findings against the DEX adapter / aggregator
   sub-scope.
3. **Testnet ceremony complete.** The deployment manifest from
   [`TESTNET_INTEGRATION.md` §3](./TESTNET_INTEGRATION.md) is committed
   and the end-to-end flow log captures both happy-path and
   error-path coverage.
4. **DEX readiness validator green.**
   [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts)
   reports `OK` on the proposed PR's branch.
5. **PR scope.** The follow-up PR contains **only** the DEX-AH-N
   changes listed in this document (no new features). Each DEX-AH-N
   is a separate commit; the PR body references the DEX-AH-N IDs in
   1:1 correspondence with commits.

A PR that touches `backend/adapters/priceAggregator.ts`,
`backend/adapters/toncoAdapter.ts`, or
`backend/adapters/dedustAdapter.ts` without satisfying all five
conditions must be rejected by the CI guardrail in §5.

---

## 5. CI Guardrail

The CI check at
[`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts)
(planned — issue #141, this PR) implements the following rules:

| Rule | Applies to | Action on violation |
|------|-----------|---------------------|
| **R-DEX-AH-1** | Any PR touching `backend/adapters/priceAggregator.ts` or `backend/adapters/{tonco,dedust}Adapter.ts` | Verify `docs/security/audits/A4-offchain-services/STATUS.md` shows `verdict: READY` and the audited commit matches the PR base. Fail otherwise. |
| **R-DEX-AH-2** | Any PR touching `docs/dex/*.md` | Verify every `DEX-AH-N` reference resolves to a §3 row here. Fail on dangling refs. |
| **R-DEX-AH-3** | Any PR touching `backend/adapters/priceAggregator.ts` or `backend/adapters/{tonco,dedust}Adapter.ts` | Verify a corresponding `DEX-AH-N` entry exists in §3 (no surprise adapter changes). Fail otherwise. |
| **R-DEX-AH-4** | Release-tag workflow | Verify `AggregatorOptions` defaults in `priceAggregator.ts` match the canonical anchors in [`PRICE_AGGREGATOR.md` §8](./PRICE_AGGREGATOR.md) — accidental relaxation of `floorDeviationBps`, `timeoutMs`, or `idempotencyWindowSeconds` trips this rule. |
| **R-DEX-AH-5** | Any PR touching `backend/adapters/venue-keys.json` (post-DEX-AH-1) | Verify rotation cadence ≤ 30 days and that the previous key remains valid in an overlap window per [DEX-AH-1](#dex-ah-1--signed-quote-integration). |

The validator is the analogue of
[`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
(F5),
[`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
(F4), and
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(F3); it runs on every PR touching the DEX integration surface.

---

## 6. Cross-reference summary

| DEX-AH-N | Closes | Where it is referenced |
|----------|--------|------------------------|
| **DEX-AH-1** | T-DEX-1 | [`SPECIFICATION.md` §3.2, §7.1, §7.4](./SPECIFICATION.md), [`PRICE_AGGREGATOR.md` §4.1](./PRICE_AGGREGATOR.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **DEX-AH-2** | T-DEX-2 | [`SPECIFICATION.md` §3.1, §7.1](./SPECIFICATION.md), [`PRICE_AGGREGATOR.md` §4.1, §4.2](./PRICE_AGGREGATOR.md), [`LIQUIDITY_MONITORING.md` §3.1](./LIQUIDITY_MONITORING.md) |
| **DEX-AH-3** | T-DEX-3 | [`SPECIFICATION.md` §7.1](./SPECIFICATION.md), [`PRICE_AGGREGATOR.md` §4.3](./PRICE_AGGREGATOR.md), [`LIQUIDITY_MONITORING.md` §3.1](./LIQUIDITY_MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **DEX-AH-4** | T-DEX-4 | [`SPECIFICATION.md` §7.1](./SPECIFICATION.md), [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **DEX-AH-5** | T-DEX-5 | [`SPECIFICATION.md` §7.1](./SPECIFICATION.md), [`SLIPPAGE_PROTECTION.md` §4](./SLIPPAGE_PROTECTION.md), [`WALLET_UX.md` §4](./WALLET_UX.md) |
| **DEX-AH-6** | T-DEX-6 | [`SPECIFICATION.md` §7.1](./SPECIFICATION.md), [`LIQUIDITY_MONITORING.md` §3.5](./LIQUIDITY_MONITORING.md), [`NOTIFICATIONS.md` §3.4](./NOTIFICATIONS.md) |
| **DEX-AH-7** | T-DEX-7 | [`SPECIFICATION.md` §3.1, §7.1](./SPECIFICATION.md), [`LIQUIDITY_MONITORING.md` §3.1](./LIQUIDITY_MONITORING.md) |

---

## 7. Acceptance criteria mapping (Issue #141 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A4 audit complete (prerequisite) | §2, §4 — gates every DEX-AH-N on `verdict: READY`. |
| AC-2 | DeDust adapter created | DEX-AH-2 extends the adapter set to a third venue (STON.fi) after A4. |
| AC-3 | Price aggregator module created | DEX-AH-1, DEX-AH-3, DEX-AH-4, DEX-AH-7 harden the aggregator's threat-model envelope. |
| AC-4 | Fallback routing tested | DEX-AH-2 widens the fallback chain to three venues. |
| AC-5 | Slippage tolerance configurable and enforced | DEX-AH-5 adds the route-split mitigation that lets users opt into a softer slippage profile on large trades. |
| AC-6 | Liquidity monitoring alerts configured | DEX-AH-6 wires the auto-pause hook to alert `DEX-M02`. |
| AC-7 | Performance budget met | §3 budgets each DEX-AH-N against the Issue #141 §6 ≤ 500 ms aggregator budget and ≤ 10 % indexer overhead. |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Price aggregator       | [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) |
| Slippage protection    | [`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) |
| Liquidity monitoring   | [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Testnet integration    | [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A4 audit engagement    | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |
| Error code registry    | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned) | [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts) |
| Pattern: F5 validator  | [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts) |
| Pattern: F4 validator  | [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts) |
| Pattern: F3 validator  | [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #141 (F6). |
