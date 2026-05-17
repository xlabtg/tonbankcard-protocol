# DEX Integration — Testnet Integration & End-to-End Verification

**Document Type:** DEX Integration Production Readiness Artifact
**Issue Reference:** [#141 — F6 Additional DEX Integrations](https://github.com/xlabtg/tonbankcard-protocol/issues/141)
**Engagement Prerequisite:** [A4 Off-Chain Services Audit](../security/audits/A4-offchain-services/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **staging rollout blocked until A4 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the **staging /
testnet integration plan**, the **end-to-end multi-DEX swap flow**
that exercises the deployed adapter bundle against TON testnet
TONCO and DeDust pools, and the **test bar** required by Issue #141
§8 acceptance criteria **AC-2**, **AC-4**, and **AC-7**.

It binds the previously-documented surfaces ([`SPECIFICATION.md`](./SPECIFICATION.md),
[`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md),
[`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md),
[`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md)) to a single
rollout sequence so that the testnet milestone is a verifiable,
reproducible artefact the auditor and the operator can both replay.

The mainnet rollout is **not** in scope for this document. Mainnet
gates on A4 `READY` + the post-A4 hardening bundle in
[`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) and a separate
deployment runbook will be written under that follow-up issue.

Unlike F5 (Multi-Sig Card), F6 has **no on-chain contract** — the
DEX integration is an off-chain adapter bundle
(`backend/adapters/{toncoAdapter,dedustAdapter,priceAggregator}.ts`)
running against TON testnet TONCO and DeDust pools that the protocol
does not own or modify. The "deployment manifest" therefore captures
the **adapter bundle hash + venue endpoint set + indexer schema
migration** rather than a contract address; the testnet ceremony is
an **integration exercise**, not an on-chain deployment.

---

## 2. Acceptance criteria this artifact satisfies

| AC  | Requirement | Where in this document |
|-----|-------------|------------------------|
| AC-2 | DeDust adapter created in `backend/adapters/dedustAdapter.ts` (testnet integration exercises the deployed adapter) | §3 deployment manifest, §4 deployment steps |
| AC-4 | Fallback routing tested (TONCO mock failure → routes to DeDust) | §5.4 fallback-routing drill |
| AC-7 | Performance budget met (aggregator < 500 ms; indexer overhead ≤ 10 %) | §5.6 budget assertions, §6 test bar |

AC-1 (A4 audit) is treated as a **strict prerequisite** in §3.1.
AC-3 (price aggregator module created), AC-5 (fallback routing
implementation), AC-6 (slippage tolerance configurable), and AC-7
(liquidity monitoring alerts configured) are exercised end-to-end
in §5 but are documented as primary deliverables in their respective
specification sections.

---

## 3. Deployment manifest

### 3.1 Gating preconditions

| Precondition | Source | State required |
|--------------|--------|----------------|
| A4 audit verdict | [`ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) → `STATUS.md` | `verdict: READY`, zero critical/high open on `backend/adapters/*` |
| Adapter bundle | `backend/adapters/{toncoAdapter,dedustAdapter,priceAggregator}.ts` | Compiled bundle hash matches the value the auditor signed off on (`docs/deployments/dex-testnet/bundle.txt`) |
| Wallet-ui build | `wallet-ui` package | Swap sheet, slippage slider, large-trade modal, venue-status pill wired ([`WALLET_UX.md` §§3–5](./WALLET_UX.md)) |
| Notifications dispatcher | [`NOTIFICATIONS.md` §3](./NOTIFICATIONS.md) | DEX-N01..DEX-N08 wired to the same dispatcher F4 uses; opt-in defaults documented |
| Monitoring | [`LIQUIDITY_MONITORING.md` §3](./LIQUIDITY_MONITORING.md) | DEX-M01..DEX-M18 dashboards stood up against the testnet venue set; alert rules registered with B3 |
| Indexer schema | [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md) | `dex_swap_log`, `dex_pool_depth`, `notification_log` migrations applied on staging |
| Operator wallet | `docs/deployments/dex-testnet/operator.txt` | Address known, ≥ 50 TON testnet balance, holds testnet TBC for swap fixtures |
| CI green | `scripts/dex/check-dex-readiness.ts` | `OK` on the integration commit |

If any precondition is red, the testnet integration is **postponed**;
the runbook does not allow waiver-by-comment.

### 3.2 Deployment artefacts

The integration produces the following artefacts, each committed to
the repository under `docs/deployments/dex-testnet/`:

| Artefact | Contents |
|----------|----------|
| `manifest.json` | Adapter bundle hash, operator address, TONCO pool address (testnet), DeDust pool address (testnet), indexer schema version, integration commit SHA, deployment timestamp. |
| `bundle.txt` | SHA-256 of the compiled adapter bundle (output of `pnpm --filter backend build && sha256sum dist/adapters.js`). |
| `venue-endpoints.json` | Per-venue endpoint pin (`tonco.testnet.tonco.io`, `api.testnet.dedust.io`) and the trust-anchor commitments referenced by [DEX-AH-4](./ADAPTER_HARDENING.md#dex-ah-4--signed-response-verification). |
| `aggregator-flow.log` | End-to-end log of the §5.2–§5.3 happy-path and best-price ranking. |
| `fallback-drill.log` | End-to-end log of the §5.4 mock-TONCO-down fallback drill. |
| `monitoring-drill.log` | End-to-end log of the §5.5 DR-1..DR-5 alert exercises ([`LIQUIDITY_MONITORING.md` §5](./LIQUIDITY_MONITORING.md)). |

The manifest is the single artefact that downstream documents
([`WALLET_UX.md`](./WALLET_UX.md),
[`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md)) point at for the testnet
venue set.

### 3.3 Network selection

Testnet is **TON testnet** (`testnet.toncenter.com`).

- TONCO testnet endpoint: `tonco.testnet.tonco.io` (TBC/TON pool address
  committed in `venue-endpoints.json`).
- DeDust testnet endpoint: `api.testnet.dedust.io` (TBC/TON pool address
  committed in `venue-endpoints.json`).

The wallet-ui and indexer switch network via the existing env-var
pattern (`TON_NETWORK=testnet`); no DEX-specific switch is added.

---

## 4. Deployment steps

The integration runs **once** per A4-approved adapter bundle hash. A
subsequent re-deploy (after DEX-AH-N hardening) is a separate
ceremony documented in its own runbook.

1. **Verify gating preconditions** (§3.1). The CI validator
   [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts)
   is the canonical green-light.
2. **Build the adapter bundle** at the exact commit the auditor
   signed: `pnpm --filter backend build` produces
   `dist/adapters.js`. Compute the SHA-256 and append to
   `docs/deployments/dex-testnet/bundle.txt`.
3. **Pin venue endpoints.** Commit `venue-endpoints.json` with the
   testnet TONCO and DeDust pool addresses and trust-anchor
   commitments. Endpoints are pinned — the adapter refuses any
   endpoint not listed in this file.
4. **Apply indexer schema migrations.** Run
   `pnpm --filter indexer migrate up` on the staging indexer to
   create `dex_swap_log`, `dex_pool_depth`, and `notification_log`
   tables (idempotent — no-op if already applied).
5. **Wire downstream surfaces.** Patch the adapter bundle into the
   `wallet-ui` config files. Trigger the staging indexer and
   notification dispatcher to start consuming the new adapter
   bundle.
6. **Smoke check.** Call the read-only methods from a console:
   `PriceAggregator.quote({ amountIn: 1n * 10n**9n, tokenIn: 'TBC',
   tokenOut: 'TON' })` returns a non-empty `winner` envelope from
   one of the two venues within `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms`.
7. **Seed liquidity fixtures.** Use the operator wallet to deposit
   testnet TBC + TON into both pool fixtures so the e2e flow has
   non-trivial depth (≥ `MIN_POOL_DEPTH_TON × 2`). Fixture deposits
   are testnet-only and explicitly excluded from the mainnet runbook.
8. **Publish.** Commit the deployment artefacts (§3.2) to the
   repository under `docs/deployments/dex-testnet/`. Open a
   status comment on issue #141 referencing the `manifest.json`
   blob.

Step 7 (seeding) is **testnet-only** — mainnet liquidity is provided
by external market-makers per
[`docs/deployments/network-matrix.md`](../deployments/network-matrix.md) §125–142.

---

## 5. End-to-end multi-DEX flow (AC-4)

The e2e flow is run **immediately** after step 8 above. It produces
`aggregator-flow.log` (§§5.2–5.3), `fallback-drill.log` (§5.4), and
`monitoring-drill.log` (§5.5) and serves as the visible artefact for
AC-4.

### 5.1 Fixture

| Actor | Wallet | Role |
|-------|--------|------|
| User | `test-user.tonconnect.json` | Holds testnet TBC; initiates swaps via wallet-ui. |
| Operator | `test-operator.tonconnect.json` | Funded the testnet pools (step 7); used by §5.4 to suspend the mock TONCO endpoint. |
| Recipient | `test-recipient.tonconnect.json` | Receives the swapped TON. |
| Indexer | staging deployment | Consumes pool-depth poll, `dex_swap_log`, and `notification_log`. |
| B3 monitoring | staging dashboard | Receives DEX-M01..DEX-M18 alerts produced during the drills. |

### 5.2 Happy path — best-price ranking

Configuration: both venues healthy, TONCO marginally better price.

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | User opens the swap sheet for `100 TBC → TON`, leaves slippage at default `50 BPS`. | Wallet-ui ([`WALLET_UX.md` §3](./WALLET_UX.md)) | Aggregator returns `winner.venue = 'TONCO'`, `amountOut > 0`, `effectivePriceBps < 100`. Sheet renders venue badge `TONCO`. |
| 2 | User taps **Sign & swap**, signs the TON Connect message. | Wallet-ui ([`WALLET_UX.md` §3](./WALLET_UX.md)) | `executeSwap` re-quotes TONCO, slippage delta ≤ `slippageBps`, swap submitted; `dex_swap_log` row appended with `(venue='TONCO', error_code=0)`. |
| 3 | Indexer ingests the swap; balance check reconciles. | Indexer `dex_swap_log` | User TBC balance −100, recipient TON balance +`amountOut` (within `slippageBps`). |
| 4 | DEX-N05 (fallback informational) is **not** dispatched because the winner was the primary route. | Notification dispatcher ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)) | `notification_log` shows zero rows for `(user, request_id, DEX-N05)`. |

### 5.3 Happy path — DeDust wins

Configuration: pool fixture skew so that DeDust quotes 10 BPS better
than TONCO on `200 TBC → TON`.

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | User opens the swap sheet for `200 TBC → TON`. | Wallet-ui ([`WALLET_UX.md` §3](./WALLET_UX.md)) | Aggregator returns `winner.venue = 'DEDUST'`; tie-break order is not exercised (delta > `TIE_BREAK_BPS`). |
| 2 | User signs and swaps. | Wallet-ui | `dex_swap_log` row `(venue='DEDUST', error_code=0)` appended. |
| 3 | Aggregator flow log records both venue quotes and the chosen winner. | `aggregator-flow.log` | Both `quotes[]` entries serialised; `winner.venue = 'DEDUST'`; pick is reproducible from the log. |

### 5.4 Fallback-routing drill (AC-4 closure)

Configuration: same swap as §5.3, but the TONCO endpoint is
suspended **mid-execute** to exercise the
[`PRICE_AGGREGATOR.md` §4.4](./PRICE_AGGREGATOR.md) fallback path.

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | Operator stops the TONCO testnet endpoint (toxiproxy / iptables block). | Operator console | TONCO health probe records 3 consecutive failures within 180 s; `DEX-M03` (TONCO demoted) fires. |
| 2 | User opens the swap sheet for `200 TBC → TON`. | Wallet-ui | Aggregator fan-out: TONCO times out at `PRICE_AGGREGATOR_TIMEOUT_MS`, DeDust returns; `winner.venue = 'DEDUST'`. Venue-status pill renders `TONCO degraded` ([`WALLET_UX.md` §5](./WALLET_UX.md)). |
| 3 | User signs and swaps. | Wallet-ui | `dex_swap_log` row `(venue='DEDUST', error_code=0)` appended; `fallback_taken = true`. |
| 4 | DEX-N05 (fallback informational) is dispatched. | Notification dispatcher ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)) | `notification_log` row `(user, request_id, DEX-N05, status='DELIVERED')`. |
| 5 | Operator restores TONCO. | Operator console | TONCO health probe records 2 consecutive successes; venue returns to `HEALTHY` after `VENUE_DEMOTION_COOLDOWN_SECONDS = 120 s`; `DEX-M04` (recovery) fires. |
| 6 | A subsequent swap re-routes to TONCO. | Wallet-ui | `winner.venue = 'TONCO'`; no DEX-N05 dispatched. |

The drill explicitly asserts the **negative** case: with both venues
down (operator stops both endpoints), the aggregator returns
`ERROR_DEX_VENUE_DOWN` and `DEX-M01` (zero survivors) fires within
the same 5-minute window.

### 5.5 Error-path coverage

Each error code in [`SPECIFICATION.md` §7.2](./SPECIFICATION.md) is
exercised by at least one e2e case:

| Error | Cause | Triggering input | Surface check |
|-------|-------|------------------|---------------|
| `ERROR_DEX_TIMEOUT = 1` | A venue does not answer within `PRICE_AGGREGATOR_TIMEOUT_MS`. | Toxiproxy injects 600 ms latency on one venue endpoint. | Wallet-ui toast "Quote took too long — refreshing" ([`WALLET_UX.md` §3.4](./WALLET_UX.md)); aggregator surfaces winner from the other venue; `DEX-M05` (P95 latency) fires if sustained. |
| `ERROR_DEX_VENUE_DOWN = 2` | Health probe demoted both venues. | §5.4 step 6 negative case (both endpoints down). | Wallet-ui toast "DEX layer unavailable — try in a few seconds"; venue-status pill renders `DEX layer down` (red). |
| `ERROR_DEX_INVALID_TOKEN = 3` | Token pair not supported by either venue. | Submit `tokenIn = USDT-on-TON, tokenOut = TBC` (not in seed). | Wallet-ui toast "Token pair not supported"; no `dex_swap_log` row appended. |
| `ERROR_DEX_INVALID_AMOUNT = 4` | `amountIn = 0` or above `MAX_SWAP_AMOUNT_TON`. | Bypass wallet-ui validation; submit raw `executeSwap`. | Wallet-ui toast "Amount out of range"; aggregator rejects pre-fan-out. |
| `ERROR_DEX_INSUFFICIENT_LIQUIDITY = 5` | Pool depth below `MIN_POOL_DEPTH_TON`. | Operator drains the TONCO fixture below the floor; user submits a swap that touches that fixture. | Wallet-ui toast "Liquidity too thin to swap right now"; `DEX-M06` (TONCO depth below floor) fires. |
| `ERROR_DEX_STALE_PRICE = 6` | Spot price older than `PRICE_STALENESS_SECONDS = 30 s`. | Suspend the TONCO price-poll for 35 s. | Wallet-ui toast "Price feed stale — refreshing"; aggregator excludes TONCO from the fan-out until the next successful poll. |
| `ERROR_DEX_SLIPPAGE_EXCEEDED = 7` | Re-quote on submit violated user slippage tolerance. | Operator injects a 200 BPS price move between quote and submit on the chosen venue. | Wallet-ui toast "Swap reverted — increase slippage or reduce amount"; `dex_swap_log` row `(error_code=7)` appended; DEX-N03 dispatched ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)). |
| `ERROR_DEX_FLOOR_REJECT = 8` | Every venue worse than `MAX_EFFECTIVE_PRICE_DEVIATION_BPS = 500`. | Operator skews both fixtures 600 BPS off mid simultaneously. | Wallet-ui toast "Both DEXes are quoting an unsafe price; try again later"; `DEX-M02` (floor-reject rate) fires after 3 events in 5 min; DEX-N04 dispatched ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)). |
| `ERROR_DEX_QUOTE_EXPIRED = 9` | Quote past `expiresAt` is replayed. | Hold a quote, wait `QUOTE_TTL_SECONDS + 1 s`, submit. | Wallet-ui toast "Quote expired — refreshing"; `DEX-M14` (replay rate) ticks. |

The post-A4 hardening codes (`ERROR_DEX_QUOTE_UNSIGNED = 10`,
`ERROR_DEX_TWAP_REJECT = 11`, `ERROR_DEX_PARTIAL_FILL = 12`) are
**not** part of the testnet e2e — they will be added under the
relevant DEX-AH-N hardening item
([`ADAPTER_HARDENING.md` §3](./ADAPTER_HARDENING.md)).

### 5.6 Performance budget assertions (AC-7)

The §5.2–§5.4 runs are wired to record per-quote and per-execute
latencies. The exit gate for AC-7 is:

| Metric | Budget | Source |
|--------|--------|--------|
| Aggregator P95 quote latency | ≤ `PRICE_AGGREGATOR_TIMEOUT_MS = 500 ms` | Issue #141 §6 |
| Aggregator P99 quote latency | ≤ `750 ms` (one timeout retry allowed) | Issue #141 §6 |
| Indexer baseline overhead | ≤ `+10 %` of pre-DEX baseline CPU / memory | Issue #141 §6 |
| Pool-depth poll round-trip | ≤ `2 s` per venue per minute | [`LIQUIDITY_MONITORING.md` §4](./LIQUIDITY_MONITORING.md) |

Latencies are logged to `aggregator-flow.log` with the
`{ts, latency_ms, venue, error_code}` tuple. If any metric exceeds
its budget for 5 consecutive minutes, the testnet ceremony is
**aborted** and the responsible commit returns to engineering.

### 5.7 Notifications integration

The e2e run exercises one notification cycle for each lifecycle
transition:

1. After §5.4 step 1, the scheduler dispatches DEX-N01 (`venue_degraded`)
   to wallets that touched TBC/TON within the prior 24 h
   ([`NOTIFICATIONS.md` §3.1](./NOTIFICATIONS.md)).
2. After §5.4 step 4, the scheduler dispatches DEX-N05 (`fallback_taken`)
   to the user whose swap was rerouted
   ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)).
3. After §5.5 `ERROR_DEX_SLIPPAGE_EXCEEDED`, the scheduler dispatches
   DEX-N03 ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)).
4. After §5.5 `ERROR_DEX_INSUFFICIENT_LIQUIDITY`, the scheduler dispatches
   DEX-N06 ([`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md)).

The dedup key
`sha256(user_addr|event_type|request_id|epoch_bucket)` from
[`NOTIFICATIONS.md` §5.1](./NOTIFICATIONS.md) is asserted by
re-running the scheduler once after each step and verifying no
duplicate push lands.

---

## 6. Test bar (AC-2, AC-4, AC-7)

The exit bar consists of three test surfaces, each owning a
distinct artefact in CI:

### 6.1 Adapter unit tests (24 tests — AC-2)

The DeDust adapter MUST pass the same unit test bar that the
existing TONCO adapter passes (Issue #141 §8 AC-2). The shared
`backend/adapters/__tests__/dexAdapter.contract.spec.ts` exports
24 contract-level checks against every `DexAdapter` implementation:

| Group | Count | What it covers |
|-------|-------|----------------|
| `getCurrentPrice` | 5 | Returns mid-market price; staleness reject; canonical 18-decimal scaling; non-supported token pair; venue down propagates as `ERROR_DEX_STALE_PRICE` only when applicable. |
| `getSwapQuote` | 7 | Idempotent (no state mutation); honours `PRICE_AGGREGATOR_TIMEOUT_MS`; `effectivePriceBps` non-negative; `expiresAt > quotedAt`; respects `MAX_SWAP_AMOUNT_TON`; returns `feeBps` matching venue tier; `poolDepthIn/Out` non-zero. |
| `executeSwap` | 7 | Re-quote on submit; revert with `ERROR_DEX_SLIPPAGE_EXCEEDED` when re-quote violates tolerance; passes user-signed envelope; never holds funds (no internal balance state); idempotent on repeated `requestId`; emits `dex_swap_log` row; honours `tokenIn/tokenOut` ordering. |
| `healthCheck` | 5 | Returns within `HEALTH_PROBE_INTERVAL_SECONDS / 2 = 30 s`; `latencyMs` ≥ 0; `reasonCode` populated when `healthy=false`; demotion after `HEALTH_PROBE_FAILURE_THRESHOLD = 3` failures; recovery after 2 successes. |
| **Total** | **24** | |

Each adapter (`toncoAdapter`, `dedustAdapter`) instantiates the
same suite via `describe.each([TONCO, DEDUST])`. AC-2 is satisfied
when the DeDust adapter passes all 24 against the testnet pool
fixture.

### 6.2 Aggregator integration tests (12 tests — AC-4)

The integration suite at
`backend/adapters/__tests__/priceAggregator.integration.spec.ts`
exercises the multi-venue paths against the testnet pool fixture:

| Group | Count | What it covers |
|-------|-------|----------------|
| Best-price ranking | 3 | TONCO better → TONCO wins; DeDust better → DeDust wins; tied within `TIE_BREAK_BPS` → TONCO wins by priority order. |
| Fallback routing | 3 | TONCO times out, DeDust serves (matches §5.4); DeDust times out, TONCO serves; both time out, `ERROR_DEX_VENUE_DOWN` surfaces. |
| Floor-price guard | 2 | Both venues > `MAX_EFFECTIVE_PRICE_DEVIATION_BPS` → `ERROR_DEX_FLOOR_REJECT`; only one venue out of floor → other wins. |
| Idempotency | 2 | Duplicate `requestId` within `IDEMPOTENCY_WINDOW_SECONDS = 600 s` → returns cached result; same `requestId` past the window → new fan-out. |
| Performance | 2 | Aggregator P95 quote latency ≤ 500 ms across 100 quotes; aggregator P99 ≤ 750 ms. |
| **Total** | **12** | |

### 6.3 Readiness validator (1 spec — AC-7 wiring)

The ts-jest readiness validator at
[`tests/dex/DexReadinessValidator.spec.ts`](../../tests/dex/DexReadinessValidator.spec.ts)
runs alongside the contract suite and asserts drift-freeness
between this document, the adapter sources, and the wallet-ui spec
file. The validator is the analogue of F5's
[`tests/multisig/MultiSigReadinessValidator.spec.ts`](../../tests/multisig/MultiSigReadinessValidator.spec.ts).

The full AC-7 wiring (latency budgets, indexer overhead) is asserted
by the validator inspecting:

- `docs/dex/PRICE_AGGREGATOR.md` for the `< 500 ms` budget anchor;
- `docs/dex/LIQUIDITY_MONITORING.md` §4 for the data-source budget;
- the `aggregator-flow.log` schema (presence of `latency_ms`).

---

## 7. Mainnet rollout (out of scope)

For traceability, the mainnet rollout sequence is:

1. **A4 verdict `READY`** + no critical/high open on
   `backend/adapters/*`.
2. **Hardening bundle** — DEX-AH-1..DEX-AH-7 from
   [`ADAPTER_HARDENING.md` §3](./ADAPTER_HARDENING.md) ship under
   a separate issue and PR.
3. **Mainnet pool addresses pinned** — `docs/deployments/dex-mainnet/venue-endpoints.json`
   exists with the production TONCO and DeDust TBC/TON pool
   addresses; trust anchors rotated per DEX-AH-4 cadence.
4. **Re-deploy** — repeat §4 against mainnet with the hardened
   adapter bundle hash, **without** the test-only fixture-seeding
   step (§5 step 7).
5. **Mainnet runbook** — a dedicated runbook will be written under
   the post-A4 issue. This testnet document is **not** the source
   of truth for mainnet.

---

## 8. Acceptance criteria mapping (Issue #141 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A4 audit complete (prerequisite) | §3.1 declares the gating preconditions. |
| AC-2 | DeDust adapter created (testnet exercise) | §6.1 24-test contract bar against the deployed `dedustAdapter`. |
| AC-3 | Price aggregator module created | §3.2 manifest captures the aggregator bundle; §5 e2e exercises it. |
| AC-4 | Fallback routing tested | §5.4 fallback drill + §6.2 integration suite. |
| AC-5 | Slippage tolerance configurable and enforced | §5.5 `ERROR_DEX_SLIPPAGE_EXCEEDED` row + wallet-ui slippage slider exercised. |
| AC-6 | Liquidity monitoring alerts configured | §5.5 DEX-M06 trigger + §5 monitoring drill log. |
| AC-7 | Performance budget met | §5.6 latency assertions + §6.2 performance group. |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Price aggregator       | [`PRICE_AGGREGATOR.md`](./PRICE_AGGREGATOR.md) |
| Slippage protection    | [`SLIPPAGE_PROTECTION.md`](./SLIPPAGE_PROTECTION.md) |
| Liquidity monitoring   | [`LIQUIDITY_MONITORING.md`](./LIQUIDITY_MONITORING.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Adapter hardening      | [`ADAPTER_HARDENING.md`](./ADAPTER_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| TONCO adapter source   | [`backend/adapters/toncoAdapter.ts`](../../backend/adapters/toncoAdapter.ts) |
| DeDust adapter source  | [`backend/adapters/dedustAdapter.ts`](../../backend/adapters/dedustAdapter.ts) |
| Price aggregator source | [`backend/adapters/priceAggregator.ts`](../../backend/adapters/priceAggregator.ts) |
| Wallet-ui spec         | [`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts) |
| A4 audit engagement    | [`docs/security/audits/A4-offchain-services/ENGAGEMENT.md`](../security/audits/A4-offchain-services/ENGAGEMENT.md) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned) | [`scripts/dex/check-dex-readiness.ts`](../../scripts/dex/check-dex-readiness.ts) |
| Pattern: F5 testnet    | [`docs/multisig/TESTNET_DEPLOYMENT.md`](../multisig/TESTNET_DEPLOYMENT.md) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #141 (F6). |
