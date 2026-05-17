# DEX Integration — Wallet UX

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Status:** Draft — frozen at engagement kickoff; **rollout gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the user-facing surface that the wallet
renders for TBC/TON swaps once the multi-DEX aggregator and slippage
envelope land. The wallet is the **only** application layer that
exposes slippage configuration and large-trade confirmation — the
dashboard / merchant surface only renders swap history and venue
status.

## 2. Acceptance criterion this artifact satisfies

Issue #141 §5 FR-4 ("Slippage tolerance configurable by user") and
the Acceptance Criteria implicit in §3 ("Pre-swap liquidity check:
warn user if trade size > 1% of pool depth").

---

## 3. Swap confirmation sheet

The swap confirmation sheet is the central UX object. Reached from
the wallet's `Swap TBC ↔ TON` action.

### 3.1 Sheet anatomy

| Region | Content |
|--------|---------|
| Header | `Swap` title + venue badge (`TONCO` / `DEDUST` / `Best price`) |
| Body  | Input amount, output amount (after fees), effective price vs. mid (BPS) |
| Quote details | Venue, fee BPS, pool depth, expires-in countdown |
| Slippage slider | `0.10 %`–`5.00 %`, default `0.50 %`, step `0.05 %` |
| Confirm button | `Sign & swap` — disabled while quote is loading |

### 3.2 Slippage slider

- Anchored at `DEFAULT_SLIPPAGE_BPS = 50` (0.50 %) per
  [`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) §3.
- Lower bound `MIN_SLIPPAGE_BPS = 10` (0.10 %).
- Upper bound `MAX_SLIPPAGE_BPS = 500` (5.00 %).
- Manual basis-point entry clamps silently to the bounds.

The slider's current value is persisted to local storage only — never
to the indexer or backend.

### 3.3 Quote refresh

Quotes auto-refresh every 5 s while the sheet is open. The
`expires-in` countdown displays the time remaining until `expiresAt`
(per [`SPECIFICATION.md`](./SPECIFICATION.md) §3.2). Once `expiresAt`
is reached, the confirm button greys out until the next refresh.

### 3.4 Failure modes

The wallet surfaces these failures as toasts (not modals) so the user
can adjust slippage / amount without losing context:

| Error code | Toast text | Suggested action |
|------------|-----------|------------------|
| `ERROR_DEX_TIMEOUT` (1) | "Quote took too long — refreshing" | Auto-retry |
| `ERROR_DEX_VENUE_DOWN` (2) | "DEX layer unavailable — try in a few seconds" | Auto-retry |
| `ERROR_DEX_INVALID_TOKEN` (3) | "Token pair not supported" | Cancel |
| `ERROR_DEX_INVALID_AMOUNT` (4) | "Amount out of range" | Edit amount |
| `ERROR_DEX_INSUFFICIENT_LIQUIDITY` (5) | "Liquidity too thin to swap right now" | Reduce amount |
| `ERROR_DEX_STALE_PRICE` (6) | "Price feed stale — refreshing" | Auto-retry |
| `ERROR_DEX_SLIPPAGE_EXCEEDED` (7) | "Swap reverted — increase slippage or reduce amount" | Adjust slippage |
| `ERROR_DEX_FLOOR_REJECT` (8) | "Both DEXes are quoting an unsafe price; try again later" | Cancel |
| `ERROR_DEX_QUOTE_EXPIRED` (9) | "Quote expired — refreshing" | Auto-retry |

---

## 4. Large-trade modal

Triggered when the aggregator returns `warnings = ['LARGE_TRADE_VS_POOL']`
(per [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) §4 and
[`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) §4.1).

### 4.1 Modal anatomy

| Region | Content |
|--------|---------|
| Title | `This trade is large vs. pool depth` |
| Body | Renders `amountIn / poolDepthIn` as a percentage and the projected slippage |
| Warning row | `T-DEX-5` (large-trade pumping) summary |
| Confirm | `Sign anyway` — disabled for 1 s after modal renders (no muscle-memory bypass) |
| Cancel  | Returns to the swap sheet |

### 4.2 Audit-log binding

Confirming the modal records `confirmation_id` in the swap envelope.
The indexer stores `dex_swap_log.large_trade_ack = true`. Support can
use this column to confirm that an unhappy user did explicitly
acknowledge the warning before submitting.

---

## 5. Venue status surface

A persistent "DEX status" pill renders at the bottom of the swap
sheet whenever any venue is in `DEGRADED` or `MAINTENANCE`. The pill
is the user-facing half of alert `DEX-M03` and notification
`DEX-N01`.

| Pill state | Trigger | Colour |
|------------|---------|--------|
| `All venues healthy` | Both adapters report `HEALTHY` | green |
| `TONCO degraded` | Only TONCO is `DEGRADED` | amber |
| `DeDust degraded` | Only DeDust is `DEGRADED` | amber |
| `DEX layer down` | Both venues `DEGRADED` (mirrors `DEX-M01`) | red |

Tap-through opens a detail sheet describing which venue is degraded
and the time of the last successful health probe.

---

## 6. Signer management hooks

For users using a [multi-sig card](../multisig/SPECIFICATION.md) the
swap sheet defers signature collection to the multi-sig signing
ceremony (MultiSig `ApproveProposal` flow). The DEX layer renders
the same confirmation sheet but the "Sign & swap" CTA reads
`Propose swap` and routes through the existing multi-sig pending
approvals screen. No new flow is introduced.

---

## 7. Invariant preservation

The wallet MUST preserve the following invariants:

1. The wallet NEVER submits a swap with `slippageBps`
   outside `[MIN_SLIPPAGE_BPS, MAX_SLIPPAGE_BPS]`.
2. The wallet NEVER bypasses the large-trade modal once
   `warnings` includes `LARGE_TRADE_VS_POOL`.
3. The wallet NEVER reuses a quote past `expiresAt`.
4. The wallet NEVER calls a venue adapter directly — only via
   `PriceAggregator.quote()` / `PriceAggregator.execute()`.

Drift from these invariants is a CI-blocking wallet-ui test failure
(see [`TESTNET_INTEGRATION.md`](./TESTNET_INTEGRATION.md) §6).

---

## 8. References

- [`docs/dex/SPECIFICATION.md`](./SPECIFICATION.md) §3.2 (quote envelope)
- [`docs/dex/PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) §4 (query strategy)
- [`docs/dex/SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) §3 (tolerance configuration)
- [`docs/dex/LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) §3.6 (alert ↔ pill mapping)
- [`docs/dex/NOTIFICATIONS.md`](./NOTIFICATIONS.md) (push / email / webhook channels)
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
