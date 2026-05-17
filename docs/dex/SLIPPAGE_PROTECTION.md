# Slippage Protection — Tolerance, Depth Warning & Revert

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Status:** Draft — frozen at engagement kickoff; **rollout gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the three-layer slippage protection envelope
enforced by the aggregator and surfaced to the user by the wallet:

1. **User-configurable tolerance** (§2) — what the user signs onto.
2. **Pre-trade depth warning** (§3) — what the wallet escalates to a
   confirmation modal before signing.
3. **Automatic revert** (§4) — what the venue does if the realised
   output is below the user's floor.

## 2. Acceptance criterion this artifact satisfies

Issue #141 §8 — _"Slippage tolerance configurable and enforced"_
(**AC-5**) and Issue #141 §5 FR-4 _"Slippage tolerance configurable
by user"_.

---

## 3. Tolerance configuration

| Constant | Value | Source |
|----------|-------|--------|
| `DEFAULT_SLIPPAGE_BPS` | `50` (0.50 %) | Issue #141 §3 |
| `MAX_SLIPPAGE_BPS` | `500` (5.00 %) | Issue #141 §3 |
| `MIN_SLIPPAGE_BPS` | `10` (0.10 %) | UX floor — below 0.10 % nearly every trade reverts |
| `LIQUIDITY_WARN_THRESHOLD_BPS` | `100` (1 % of pool depth) | Issue #141 §3 |

### 3.1 Wallet surface

The wallet exposes a slippage slider on the swap confirmation sheet
(see [`WALLET_UX.md`](./WALLET_UX.md) §3). The slider is anchored at
`DEFAULT_SLIPPAGE_BPS` and clamped to `[MIN_SLIPPAGE_BPS,
MAX_SLIPPAGE_BPS]`. Values outside the range are NEVER accepted —
attempts to manually edit the basis-point input above 500 trigger a
non-dismissible warning and are silently clamped on submit.

### 3.2 Persistence

User-selected tolerance persists per device (local storage) but
NEVER syncs to the indexer or backend — slippage is a personal risk
budget, not a protocol parameter.

### 3.3 Per-call override

The wallet can override the persisted value on a single swap (e.g.
"use 1 % just this once"). Overrides do not mutate the persisted
default.

---

## 4. Pre-trade depth warning

### 4.1 Trigger condition

```text
if amountIn > poolDepthIn * LIQUIDITY_WARN_THRESHOLD_BPS / 10000
    warnings.push('LARGE_TRADE_VS_POOL')
```

The aggregator computes the warning during `quote()` (per
[`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) §4) and the wallet
escalates it into a modal. The default 1 % threshold matches Issue
#141 §3 ("warn user if trade size > 1% of pool depth"). The threshold
is overridable by the user only **upwards** (more conservative, e.g.
0.5 %); it cannot be set above the issue ceiling.

### 4.2 Wallet treatment

The warning modal:

1. Renders the projected slippage from `effectivePriceBps` against
   the user-configured tolerance.
2. Forces a 1-second delay before the "Sign" button activates (no
   muscle-memory bypass).
3. Records `confirmation_id` so the indexer can attribute the
   override in the audit log (`dex_swap_log.large_trade_ack = true`).

### 4.3 Failure modes

| Code | Reached when | User message |
|------|---|---|
| `ERROR_DEX_INVALID_AMOUNT` | `amountIn == 0` or above `MAX_SWAP_AMOUNT_TON` | "Amount out of range" |
| `ERROR_DEX_INSUFFICIENT_LIQUIDITY` | `poolDepthIn < MIN_POOL_DEPTH_TON` on every venue | "Liquidity too thin to swap right now" |
| `ERROR_DEX_FLOOR_REJECT` | Every venue worse than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS` | "Both DEXes are quoting an unsafe price; try again later" |

---

## 5. Automatic revert

### 5.1 `amountOutMin` derivation

```ts
function deriveAmountOutMin(quote: SwapQuote, slippageBps: number): bigint {
    return (quote.amountOut * BigInt(10000 - slippageBps)) / 10000n;
}
```

The aggregator embeds `amountOutMin` into the user-signed swap
transaction. Venues honour it natively: if the realised output is
below `amountOutMin`, the swap reverts on-chain (TONCO pool
implements this via the `min_amount_out` parameter; DeDust V2 via
the swap step `min_out`).

### 5.2 Revert surfaces

| Surface | Behaviour |
|---------|-----------|
| `executeSwap()` return | `errorCode = ERROR_DEX_SLIPPAGE_EXCEEDED` (7) |
| Wallet | Toast "Swap reverted — try a higher slippage or smaller amount" |
| Indexer | Row with `error_code = 7` and `slippage_bps` recorded |
| Alert (`DEX-M07`) | Pager severity P3 if revert rate over 5 min > `SLIPPAGE_REVERT_RATE_THRESHOLD = 10 %` |

### 5.3 Replay safety

A reverted swap consumes no funds beyond gas. The user's wallet may
retry the same `requestId` per [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md)
§5.4; the aggregator's idempotency log returns the cached
`ERROR_DEX_SLIPPAGE_EXCEEDED` for `IDEMPOTENCY_WINDOW_SECONDS = 600 s`
to prevent accidental double-spend on slow networks.

---

## 6. Cross-document invariants

The slippage envelope is referenced by every other DEX document:

| Document | Reference |
|----------|-----------|
| [`SPECIFICATION.md`](./SPECIFICATION.md) | §3.3 (re-quote on submit), §5 (envelope summary) |
| [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) | §5.1 (happy path), §5.2 (fallback trigger) |
| [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) | §3 alert `DEX-M07` (revert spike) |
| [`WALLET_UX.md`](./WALLET_UX.md) | §3 (slider), §4 (large-trade modal) |
| [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) | §5 (error-path coverage for code 7) |

The validator (`scripts/dex/check-dex-readiness.ts`) enforces that
each of these references stays in place.

---

## 7. References

- [`docs/dex/SPECIFICATION.md`](./SPECIFICATION.md) §5
- [`docs/dex/PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) §5
- [`docs/dex/LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) §3
- [`docs/dex/WALLET_UX.md`](./WALLET_UX.md) §3
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
