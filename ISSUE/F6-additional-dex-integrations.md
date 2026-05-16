---
name: "[F6] Additional DEX Integrations"
about: Add DeDust DEX integration, multi-DEX price aggregation, and improved slippage protection
labels: type:backend
track: F
priority: low
---

## 1. Goal

Add DeDust DEX integration as a second liquidity source for TBC/TON swaps, implement multi-DEX price aggregation to route to the best price, improve slippage protection, and monitor liquidity depth across DEXes.

## 2. Context

Currently the protocol uses only TONCO DEX for TBC/TON liquidity. Single-DEX dependency creates risks:
- If TONCO has low liquidity, swaps incur high slippage
- If TONCO is exploited or goes offline, protocol swap functionality breaks
- Users cannot access better prices available on other DEXes

DeDust is the second-largest DEX on TON and is a natural second integration.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F6](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### DeDust DEX Integration
- New adapter: `backend/adapters/dedustAdapter.ts`
- Implements the same interface as the existing TONCO adapter
- Swap quote: `getSwapQuote(amountIn, tokenIn, tokenOut)`
- Execute swap: `executeSwap(params)`
- Price feed: `getCurrentPrice()`

### Multi-DEX Price Aggregation
- Price aggregator module: `backend/adapters/priceAggregator.ts`
- Queries both TONCO and DeDust for swap quotes
- Routes to the DEX offering the best output amount (after fees)
- Fallback: if primary DEX fails, route to secondary automatically

### Slippage Protection Improvements
- User-configurable slippage tolerance (default 0.5%, max 5%)
- Pre-swap liquidity check: warn user if trade size > 1% of pool depth
- Transaction reverts automatically if slippage exceeds tolerance

### Liquidity Monitoring
- Add liquidity depth monitoring to indexer
- Alert if TONCO or DeDust pool depth drops below threshold (per B3)

## 4. Out of Scope

- Smart contract changes for DEX integration (use existing DEX adapters pattern)
- Adding DEXes on chains other than TON
- Liquidity provision by the protocol itself

## 5. Functional Requirements

1. DeDust adapter implements the same interface as TONCO adapter
2. Price aggregator queries both DEXes and returns best quote
3. Swap routing uses best quote automatically
4. Slippage tolerance configurable by user
5. If primary DEX fails, fallback to secondary without user intervention

## 6. Non-Functional Requirements

- Price aggregator adds < 500ms to swap quote time
- Both adapters must handle DEX downtime gracefully (timeout + fallback)
- Liquidity monitoring must not increase indexer resource usage by > 10%

## 7. Security Requirements

- Price aggregator must not be susceptible to price manipulation via a single DEX
- Minimum price: if both DEXes give a price worse than a floor threshold, reject the swap
- All swap parameters validated before execution

## 8. Acceptance Criteria

- [ ] DeDust adapter created in `backend/adapters/dedustAdapter.ts`
- [ ] DeDust adapter passes the same unit tests as TONCO adapter
- [ ] Price aggregator module created
- [ ] Price aggregator routes to best price in integration tests
- [ ] Fallback routing tested (TONCO mock failure → routes to DeDust)
- [ ] Slippage tolerance configurable and enforced
- [ ] Liquidity monitoring alerts configured

## 9. References

- [Backend Adapters](../backend/adapters/)
- [Architecture](../docs/architecture.md)
- DeDust: https://dedust.io
- TONCO: https://tonco.io
