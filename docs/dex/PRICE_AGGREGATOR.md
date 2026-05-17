# Price Aggregator — Routing & Fallback Specification

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Status:** Draft — frozen at engagement kickoff; **rollout gated on A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the multi-DEX price aggregator module that
lives at `backend/adapters/priceAggregator.ts` and is the **only**
entry point through which the protocol's higher layers (Payment Hub,
dashboard, wallet) obtain swap quotes and execute swaps. Centralising
quoting through the aggregator is the closure for threat T-DEX-3
(single-venue price manipulation) and the foundation for fallback
routing (T-DEX-2).

## 2. Acceptance criterion this artifact satisfies

Issue #141 §8 — _"Price aggregator module created"_ (**AC-3**),
_"Fallback routing tested (TONCO mock failure → routes to DeDust)"_
(**AC-4**), and the non-functional budget _"Price aggregator adds <
500 ms to swap quote time"_ (Issue #141 §6).

---

## 3. Module surface

The aggregator exports a single class plus a factory:

```ts
export class PriceAggregator {
    quote(req: SwapRequest): Promise<AggregatedQuote>;
    execute(quote: AggregatedQuote, signer: SignerEnvelope): Promise<SwapResult>;
    listVenues(): VenueStatus[];
}

export function createPriceAggregator(opts: AggregatorOptions): PriceAggregator;
```

| Type | Field | Meaning |
|------|-------|---------|
| `SwapRequest` | `amountIn: bigint` | Input amount in smallest unit of `tokenIn` |
|  | `tokenIn: TokenSymbol` | `'TBC' \| 'TON'` |
|  | `tokenOut: TokenSymbol` | `'TBC' \| 'TON'` |
|  | `slippageBps: number` | User-configured slippage in basis points (§5 of SPECIFICATION) |
| `AggregatedQuote` | `winner: SwapQuote` | The quote chosen by the ranker (§4) |
|  | `losers: SwapQuote[]` | Other surviving quotes, retained for fallback |
|  | `warnings: AggregatorWarning[]` | Pre-trade warnings (e.g. `LARGE_TRADE_VS_POOL`) |
|  | `expiresAt: number` | Latest `expiresAt` among contributing quotes |
| `SwapResult` | `errorCode: number` | One of the codes in [`SPECIFICATION.md`](./SPECIFICATION.md) §7.2 |
|  | `venue?: VenueId` | Venue that ultimately settled the swap (may differ from `winner.venue` after fallback) |
|  | `amountOut?: bigint` | Final output amount on the success path |

## 4. Query strategy

### 4.1 Parallel fan-out

Both adapters are queried via `Promise.allSettled` so that a single
venue timeout cannot block the call:

```text
quote(req)
  ├── tonco.getSwapQuote(req)        ─┐
  └── dedust.getSwapQuote(req)        ┴── 500 ms budget
                ▼
        survivors = quotes that returned within budget
                ▼
        rank by amountOut (§4.2)
                ▼
        floor-price guard (§4.3)
                ▼
        warnings ← depth check (§5.2 of SPECIFICATION)
                ▼
        AggregatedQuote
```

The budget `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms` is fixed by Issue
#141 §6 ("Price aggregator adds < 500 ms to swap quote time") and is
asserted by the readiness validator (§6).

### 4.2 Best-quote ranking

Given the surviving quotes `[q1, ..., qN]`:

1. **Primary key:** `amountOut` (descending). Higher output for the
   same `amountIn` ranks higher; this implicitly nets venue fees
   because adapters MUST include fees in `amountOut` (§3.2 of
   SPECIFICATION).
2. **Tie-break:** quotes whose `amountOut` are within `TIE_BREAK_BPS
   = 5` of the leader are considered equal and broken
   deterministically by venue priority order `['TONCO', 'DEDUST']`.
3. **Outcome:** the highest-ranked quote becomes `winner`; the rest
   become `losers` (ordered by rank).

### 4.3 Floor-price guard

If every surviving quote has `effectivePriceBps >
MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500` (5 % worse than mid), the
aggregator rejects the swap with `ERROR_DEX_FLOOR_REJECT` (code 8).
This is the **only** acceptance check that can trip even when both
venues respond healthily, and it is the closure for threat T-DEX-3.

### 4.4 Empty-survivor fallback

If `Promise.allSettled` yields zero survivors, the aggregator returns
`ERROR_DEX_VENUE_DOWN` (code 2) and emits alert `DEX-M01` (per
[`MONITORING.md`](./LIQUIDITY_MONITORING.md) §3). The caller is expected
to retry after `RETRY_AFTER_SECONDS = 5 s`; the wallet renders a
visible "DEX layer unavailable" toast.

---

## 5. Execution & fallback routing

### 5.1 Happy path

`execute(quote, signer)` does:

1. Re-query `quote.winner.venue` for an up-to-the-second quote.
2. Compute `amountOutMin = winner.amountOut * (10000 - slippageBps) / 10000`.
3. If `requote.amountOut < amountOutMin`, return
   `ERROR_DEX_SLIPPAGE_EXCEEDED` (code 7) without forwarding the
   transaction. The user's signature is **not** consumed.
4. Pass the user-signed transaction envelope to the venue adapter's
   `executeSwap` and surface the venue's `SwapResult`.

### 5.2 Fallback trigger

If step 4 returns a venue-level failure (`ERROR_DEX_VENUE_DOWN`,
`ERROR_DEX_TIMEOUT`, `ERROR_DEX_INSUFFICIENT_LIQUIDITY`, or
`ERROR_DEX_STALE_PRICE`), the aggregator iterates through
`quote.losers` in rank order and retries the first one whose
`quotedAt + FALLBACK_REQUOTE_WINDOW_SECONDS >= now()` with
`FALLBACK_REQUOTE_WINDOW_SECONDS = 5 s` to keep fallback predictable
for the user (the wallet UX treats fallback as a single user action
even if two venues are attempted).

### 5.3 Fallback exhaustion

If every fallback candidate is either expired or fails, the
aggregator returns the **original** error code from the winner
adapter and emits alert `DEX-M01` (catastrophic) plus pager severity
P0. This is the only path that triggers a pager wake.

### 5.4 Idempotency

Each `execute` call carries a `requestId` (16-byte hex) generated by
the wallet. The aggregator stores `(requestId, errorCode, venue)` in
the indexer's `dex_swap_log` (§7.3 of SPECIFICATION) for
`IDEMPOTENCY_WINDOW_SECONDS = 600 s`; replays within the window
return the cached result unchanged. This is the closure for
threat T-DEX-1 in the off-chain envelope.

---

## 6. Performance budget

| Operation | Budget | Source |
|-----------|--------|--------|
| Aggregator overhead per quote (excluding network) | `<= 5 ms` | This document |
| End-to-end `quote()` latency (P50) | `<= 250 ms` | Issue #141 §6 |
| End-to-end `quote()` latency (P95) | `<= 500 ms` | Issue #141 §6 |
| Aggregator overhead on indexer (peak) | `<= 10 %` of baseline CPU | Issue #141 §6 |

The validator (`scripts/dex/check-dex-readiness.ts`) asserts that
this document records the 500 ms ceiling and that
[`MONITORING.md`](./LIQUIDITY_MONITORING.md) §3 includes alert
`DEX-M05` (latency exceeds budget).

---

## 7. Venue demotion & recovery

### 7.1 Demotion

A venue that fails `HEALTH_PROBE_FAILURE_THRESHOLD = 3` consecutive
health checks (§3.4 of SPECIFICATION) is moved to status `DEGRADED`.
While `DEGRADED`, the aggregator:

- omits it from `quote()` fan-out;
- emits alert `DEX-M03` (venue demoted) once per transition;
- continues probing it every `HEALTH_PROBE_INTERVAL_SECONDS = 60 s`
  via `healthCheck()`.

### 7.2 Recovery

After `VENUE_DEMOTION_COOLDOWN_SECONDS = 120 s` of consecutive
successful health checks, the venue is restored to `HEALTHY`. The
restoration emits `DEX-M04` (venue restored) so on-call sees the
matching pair of events.

### 7.3 Maintenance window

Operators can manually pin a venue to `MAINTENANCE` via
`backend/adapters/aggregator-cli.ts pin-venue --venue=DEDUST
--reason='planned'`. While `MAINTENANCE`, the aggregator behaves as
in §7.1 but suppresses `DEX-M03` so on-call is not paged.

---

## 8. Configuration

Aggregator options carry environment-tunable parameters. Defaults are
the Issue #141 §6 anchors.

```ts
export interface AggregatorOptions {
    venues: DexAdapter[];
    timeoutMs?: number;                         // default 500
    tieBreakBps?: number;                       // default 5
    floorDeviationBps?: number;                 // default 500
    healthProbeIntervalSeconds?: number;        // default 60
    healthProbeFailureThreshold?: number;       // default 3
    demotionCooldownSeconds?: number;           // default 120
    fallbackRequoteWindowSeconds?: number;      // default 5
    idempotencyWindowSeconds?: number;          // default 600
}
```

The validator asserts that the `priceAggregator.ts` source — once it
lands — exposes these defaults verbatim, so accidental relaxation
(e.g. raising `floorDeviationBps` to disable T-DEX-3 protection)
trips the CI gate.

---

## 9. References

- [`docs/dex/SPECIFICATION.md`](./SPECIFICATION.md) §4 (query strategy) and §7.1 (threats)
- [`docs/dex/SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) §3 (depth guard)
- [`docs/dex/LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) §3 (alert wiring)
- [`docs/dex/ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) §3 (DEX-AH-2 third-venue, DEX-AH-3 TWAP)
- [Issue #141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
