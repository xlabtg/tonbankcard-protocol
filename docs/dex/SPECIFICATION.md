# DEX Adapter & Price Aggregator — Production Specification

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Engagement Prerequisite:** [A4 Off-Chain Services Audit](../security/audits/A4-offchain-services/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **adapter rollout gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the production
behaviour of the two TBC/TON liquidity adapters (`backend/adapters/toncoAdapter.ts`,
`backend/adapters/dedustAdapter.ts`) and the surrounding off-chain
routing plane (`backend/adapters/priceAggregator.ts`):

- the **shared `DexAdapter` interface** every venue implements,
- the **DeDust adapter** behaviour (the second venue introduced by Issue #141),
- the **multi-DEX aggregator** that queries both venues and routes to the best
  output amount after fees,
- the **slippage protection** envelope (user tolerance + pre-trade pool depth
  warning + automatic revert),
- the **liquidity monitoring** posture wired into the B3 alerting stack,
- the **security model** every adapter signs onto when joining the aggregator.

The on-chain TONCO pool contracts are **not modified** by Issue #141 — TONCO
remains an external trust assumption per
[`docs/deployments/network-matrix.md`](../deployments/network-matrix.md)
§125–142. Issue #141 only introduces *off-chain* adapter modules and the
aggregator coordinator.

> **Why a specification first.** Issue #141 §7 requires that the aggregator
> not be susceptible to price manipulation via a single venue, and that the
> protocol reject swaps whose price falls below a floor threshold. Those
> properties are easier to audit against a written specification than
> against drifting TypeScript. This document therefore freezes the contract
> the adapters and aggregator must honour while the A4 review is in
> progress.

---

## 2. Acceptance criterion this artifact satisfies

Issue #141 §8 — _"`docs/dex/SPECIFICATION.md` written"_ (**AC-1**) and
_"DeDust adapter created in `backend/adapters/dedustAdapter.ts`"_ (**AC-2**
landing prerequisite).

The specification additionally provides the interface anchor that the
price aggregator (AC-3), fallback routing (AC-4), slippage tolerance
(AC-5), and liquidity monitoring (AC-6) acceptance criteria refer to.
Drift between this document and the adapter sources is itself a
CI-blocking defect — `scripts/dex/check-dex-readiness.ts` asserts the
binding.

---

## 3. Shared `DexAdapter` interface

Every venue MUST implement the four methods below. The interface lives
in `backend/adapters/types.ts` next to the existing
`PaymentProviderAdapter` and `LendingAdapter` interfaces and is exported
from `backend/adapters/index.ts`.

### 3.1 `getCurrentPrice(tokenIn, tokenOut)` — read-only spot price

Returns the **mid-market price** the venue currently quotes for one
unit of `tokenIn` denominated in `tokenOut`, in canonical 18-decimal
fixed-point. Adapters MUST refuse to return a stale price (last sample
older than `PRICE_STALENESS_SECONDS = 30 s`) and MUST surface
`ERROR_DEX_STALE_PRICE` instead.

### 3.2 `getSwapQuote(amountIn, tokenIn, tokenOut)` — pre-trade quote

Returns a `SwapQuote` carrying:

| Field | Type | Meaning |
|-------|------|---------|
| `venue` | `'TONCO' \| 'DEDUST'` | The venue that produced the quote |
| `amountIn` | `bigint` | Input amount in `tokenIn` smallest unit |
| `amountOut` | `bigint` | Output amount in `tokenOut` smallest unit (after fees) |
| `effectivePriceBps` | `number` | Effective price relative to mid, in basis points (≥0 = worse) |
| `poolDepthIn` | `bigint` | Pool depth of `tokenIn` at quote time |
| `poolDepthOut` | `bigint` | Pool depth of `tokenOut` at quote time |
| `feeBps` | `number` | Venue fee in basis points (TONCO fee tier 3000 = 0.30 %, DeDust V2 fee = 0.30 %) |
| `quotedAt` | `number` | Quote sampling time (Unix seconds) |
| `expiresAt` | `number` | Quote validity end (Unix seconds) |

Quotes are **idempotent**: invoking `getSwapQuote` MUST NOT mutate any
adapter state and MUST NOT cost gas. Adapters MUST honour
`PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms` per Issue #141 §6 and surface
`ERROR_DEX_TIMEOUT` if the venue does not answer within that window.

### 3.3 `executeSwap(params)` — settling a quote

Executes the swap previously quoted via `getSwapQuote`. The adapter
MUST:

1. Re-quote the venue immediately before submission to detect price
   drift greater than the user-configured slippage tolerance (§5).
2. Reject submission with `ERROR_DEX_SLIPPAGE_EXCEEDED` if the
   re-quoted output is below `amountOutMin = amountOut * (10000 - slippageBps) / 10000`.
3. Pass the user-signed transaction envelope through to the venue;
   adapters NEVER hold funds (the user's wallet signs the swap call).
4. Return a `SwapResult` envelope (§7) describing the outcome.

### 3.4 `healthCheck()` — venue liveness probe

Polled every `HEALTH_PROBE_INTERVAL_SECONDS = 60 s`. Returns
`{ healthy: bool, latencyMs: number, reasonCode?: string }`. The
aggregator demotes a venue to `DEGRADED` after `HEALTH_PROBE_FAILURE_THRESHOLD = 3`
consecutive failures (§4.4).

---

## 4. Multi-DEX Price Aggregator

The aggregator lives in `backend/adapters/priceAggregator.ts` and is
the **only** module that exposes swap quoting / execution to higher
layers (Payment Hub, dashboard, wallet). No higher layer is allowed to
talk to a single adapter directly — this guarantee anchors threat
T-DEX-3 (single-venue price manipulation).

### 4.1 Query strategy

The aggregator queries **both** venues **in parallel** via
`Promise.all(...)` with a hard `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms`
budget. Per Issue #141 §6 the aggregator MUST NOT add more than 500 ms
to swap quote time, so the parallel fan-out is the only admissible
strategy: serial queries would compound to ≈ 1 s on the median path.

### 4.2 Best-quote ranking

Of the quotes that return successfully within the timeout, the
aggregator picks the one with the **highest `amountOut`** — fees are
already netted into `amountOut` by §3.2 so no additional ranking is
required. Ties (delta ≤ `TIE_BREAK_BPS = 5`) are broken
deterministically by venue priority order (`TONCO`, `DEDUST`) to keep
behaviour reproducible across runs.

### 4.3 Floor-price guard

If **every** venue returns a quote whose effective price is worse
than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500` (5 %), the aggregator
rejects the swap with `ERROR_DEX_FLOOR_REJECT`. The floor protects
users from manipulated quotes during temporary cross-venue stress
(threat T-DEX-3).

### 4.4 Fallback routing

If the primary venue (the highest-ranked quote per §4.2) errors during
`executeSwap`, the aggregator automatically retries the swap against
the **next-best** quote that is still within `FALLBACK_REQUOTE_WINDOW_SECONDS = 5 s`
of its `quotedAt`. The fallback MUST be transparent (no user
intervention required) per Issue #141 §5 FR-5 and is the closure for
threat T-DEX-2.

### 4.5 Venue demotion

A venue that fails `HEALTH_PROBE_FAILURE_THRESHOLD` consecutive
health checks (§3.4) is demoted to `DEGRADED`: the aggregator stops
quoting it for `VENUE_DEMOTION_COOLDOWN_SECONDS = 120 s` and emits
`DEX-M03`. Demotion is the closure for threat T-DEX-4.

---

## 5. Slippage protection

Three layers, all enforced by the aggregator, none of which require
a contract change:

### 5.1 User-configurable tolerance

| Constant | Value | Source |
|----------|-------|--------|
| `DEFAULT_SLIPPAGE_BPS` | `50` (0.50 %) | Issue #141 §3 |
| `MAX_SLIPPAGE_BPS` | `500` (5.00 %) | Issue #141 §3 |
| `MIN_SLIPPAGE_BPS` | `10` (0.10 %) | UX floor to prevent revert-prone trades |

The wallet surfaces the slippage slider in basis points; see
[`WALLET_UX.md`](./WALLET_UX.md) §3.

### 5.2 Pre-trade depth warning

If `amountIn > poolDepthIn * LIQUIDITY_WARN_THRESHOLD_BPS / 10000` (default
`100` bps = 1 % of pool depth), the aggregator returns the quote with
`warning: 'LARGE_TRADE_VS_POOL'` and the wallet displays an explicit
confirmation modal before submission. This is the closure for threat
T-DEX-5.

### 5.3 Automatic revert

The user-signed transaction includes `amountOutMin` computed from
slippage tolerance (§3.3). If the venue's actual output is below
`amountOutMin`, the swap reverts on-chain and the adapter surfaces
`ERROR_DEX_SLIPPAGE_EXCEEDED`. Reverts are categorised by
[`MONITORING.md`](./MONITORING.md) §3 alert `DEX-M07`.

---

## 6. Liquidity monitoring

Full design lives in [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md).
The relevant **specification-level constraints** are:

| Constraint | Value | Source |
|------------|-------|--------|
| Poll interval | 60 s per venue | Issue #141 §3 |
| Alert threshold (depth) | `MIN_POOL_DEPTH_TON = 50_000` TON | B3 monitoring SLO |
| Alert threshold (drop) | `−25 %` 24-hour drop | B3 monitoring SLO |
| Aggregator overhead budget | `<= 10 %` of baseline indexer CPU | Issue #141 §6 |
| Threat coverage | **T-DEX-6** (liquidity drain) and **T-DEX-7** (oracle stale) | This document |

The monitoring channel is wired into [B3 production monitoring](../production/B3-monitoring/ENGAGEMENT.md)
so on-call rotation receives alerts identically to other off-chain
services.

---

## 7. Security model

This is the F6-specific threat catalogue that the A4 off-chain audit
must clear. Each entry maps to one or more `T-DEX-N` threats from the
engagement scope and one or more `DEX-AH-N` hardening items from
[`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) §3.

### 7.1 Threat catalogue

| ID | Threat | Operational mitigation | Final closure |
|----|--------|------------------------|---------------|
| **T-DEX-1** | Quote replay (cached `SwapQuote` used after price moves) | `quotedAt` / `expiresAt` envelope; aggregator rejects quotes past `expiresAt` (§3.2) | DEX-AH-1 (signed-quote integration) |
| **T-DEX-2** | Single venue downtime collapses swap functionality | Parallel fan-out (§4.1) and automatic fallback (§4.4) | DEX-AH-2 (third-venue spike) |
| **T-DEX-3** | Single-venue price manipulation (e.g. flash-loan twap skew) | Floor-price guard (§4.3) and dual-venue minimum (§4.2) | DEX-AH-3 (TWAP oracle) |
| **T-DEX-4** | Adapter return-value tampering (compromised venue API) | Health probe demotion (§4.5) + structured error envelope (§7.2) | DEX-AH-4 (signed-response verification) |
| **T-DEX-5** | Large trade pumping pool against trader | Pre-trade depth warning (§5.2) + automatic revert (§5.3) | DEX-AH-5 (route-splitting) |
| **T-DEX-6** | Liquidity drain (sudden pool depth collapse) | 60 s poll + threshold alert (§6); aggregator rejects swap when remaining venues all below `MIN_POOL_DEPTH_TON` | DEX-AH-6 (auto-pause hook) |
| **T-DEX-7** | Stale price feed (venue ticker frozen) | `PRICE_STALENESS_SECONDS = 30 s` reject (§3.1) | DEX-AH-7 (heartbeat enforcement) |

### 7.2 Error registry

Adapter entry points (`getCurrentPrice`, `getSwapQuote`, `executeSwap`,
`healthCheck`) do **not** throw on validation failure; instead they
return a structured `SwapResult` / `QuoteResult` carrying a numeric
`error_code`. This keeps the aggregator's routing logic deterministic
and lets the wallet surface the precise failure to the user
(F6 / Issue #141). Codes are stable; consumers MUST map by numeric
value.

| Code | Symbol | Meaning |
|---:|---|---|
| `0` | `ERROR_DEX_NONE` | Operation accepted (success path). |
| `1` | `ERROR_DEX_TIMEOUT` | Adapter exceeded `PRICE_AGGREGATOR_TIMEOUT_MS` (§4.1). |
| `2` | `ERROR_DEX_VENUE_DOWN` | Health probe demoted the venue (§4.5). |
| `3` | `ERROR_DEX_INVALID_TOKEN` | Token pair not supported by the venue. |
| `4` | `ERROR_DEX_INVALID_AMOUNT` | `amountIn` is zero or above `MAX_SWAP_AMOUNT_TON`. |
| `5` | `ERROR_DEX_INSUFFICIENT_LIQUIDITY` | Pool depth below `MIN_POOL_DEPTH_TON` (§6). |
| `6` | `ERROR_DEX_STALE_PRICE` | Spot price older than `PRICE_STALENESS_SECONDS` (§3.1). |
| `7` | `ERROR_DEX_SLIPPAGE_EXCEEDED` | Re-quote violated user slippage tolerance (§3.3 / §5.3). |
| `8` | `ERROR_DEX_FLOOR_REJECT` | Every venue worse than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS` (§4.3). |
| `9` | `ERROR_DEX_QUOTE_EXPIRED` | Quote past `expiresAt`; aggregator refuses to forward (T-DEX-1). |

The full error registry is reproduced in
[`docs/error-codes.md`](../error-codes.md) §`DEX Adapter Layer` and
consumed by the wallet directly.

### 7.3 Audit log (off-chain)

Issue #141 §3 requires that liquidity monitoring be wired into the
indexer (per B3). The indexer captures every successful and rejected
swap into the `dex_swap_log` table with `(timestamp, user_addr,
venue, amount_in, token_in, amount_out, token_out, error_code,
slippage_bps)`. Retention follows
[`docs/governance/TRANSPARENCY_REPORTING.md`](../governance/TRANSPARENCY_REPORTING.md).

### 7.4 Replay protection (T-DEX-1)

Two-layer:

1. **Quote envelope.** `quotedAt` / `expiresAt` (§3.2) bound the
   validity window. The aggregator rejects expired quotes with
   `ERROR_DEX_QUOTE_EXPIRED`.
2. **Re-quote on submit.** `executeSwap` always re-quotes the venue
   immediately before forwarding the transaction (§3.3) and refuses
   to submit if the new quote violates the user's slippage tolerance.

---

## 8. Hardening backlog

Each item below is **designed but not landed** under Issue #141 —
landing requires A4 verdict `READY` and a follow-up PR (per
[`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) §4). The IDs are the
single source of truth referenced by every other DEX integration
document.

| ID | Title | Closes threat | Shape of change |
|----|-------|---------------|-----------------|
| **DEX-AH-1** | Signed-quote integration | T-DEX-1 | Replace `quotedAt`/`expiresAt` with venue-signed quote envelopes (EIP-712-style) to prevent in-flight tampering |
| **DEX-AH-2** | Third-venue spike (STON.fi) | T-DEX-2 | Add STON.fi adapter so the aggregator survives simultaneous TONCO + DeDust outage |
| **DEX-AH-3** | TWAP oracle for price floor | T-DEX-3 | Replace instantaneous floor (§4.3) with a 30-minute TWAP gated reject |
| **DEX-AH-4** | Signed-response verification | T-DEX-4 | Require venue HTTPS responses to include a verifiable signature over the quote bytes |
| **DEX-AH-5** | Route splitting across venues | T-DEX-5 | Allow large trades to be split between TONCO and DeDust to halve effective slippage |
| **DEX-AH-6** | Auto-pause hook on liquidity drain | T-DEX-6 | Wire `DEX-M02` to `RC-LIQUIDITY-DRAIN` reason code so the merchant hub auto-pauses TBC/TON swaps |
| **DEX-AH-7** | Heartbeat enforcement | T-DEX-7 | Replace passive staleness check with active heartbeat — any venue silent for >30 s is auto-demoted |

Each item maps to a CI guardrail (`R-DEX-AH-1 … R-DEX-AH-5`) defined
in [`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) §5.

---

## 9. References

- [`backend/adapters/types.ts`](../../backend/adapters/types.ts) (`PaymentProviderAdapter` / `LendingAdapter` patterns)
- [`backend/adapters/README.md`](../../backend/adapters/README.md)
- [`docs/dex/PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md)
- [`docs/dex/SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md)
- [`docs/dex/LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md)
- [`docs/dex/WALLET_UX.md`](./WALLET_UX.md)
- [`docs/dex/ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md)
- [`docs/dex/TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md)
- [`docs/dex/BUG_BOUNTY.md`](./BUG_BOUNTY.md)
- [`docs/error-codes.md`](../error-codes.md) §`DEX Adapter Layer`
- [`docs/deployments/network-matrix.md`](../deployments/network-matrix.md) §125–142 (TONCO trust assumption)
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
