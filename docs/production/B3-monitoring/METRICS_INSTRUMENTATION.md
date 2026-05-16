# B3 — Metrics Instrumentation Contract

**Engagement:** [B3](./ENGAGEMENT.md)
**Last Updated:** 2026-05-16

---

## 1. Why this document exists

The dashboards and alert rules in [`DASHBOARDS.md`](./DASHBOARDS.md) and [`ALERT_RULES.md`](./ALERT_RULES.md) only work if the indexer and Merchant API export specific metric names with specific types and label sets. This document is the contract between the monitoring stack and the application code.

The contract is **append-only**: a metric listed here may be added, but never silently renamed or removed. Renames require a B3.x follow-up engagement that updates the dashboards and alert rules atomically.

---

## 2. Exposition format

- **Format:** OpenMetrics / Prometheus text exposition (`text/plain; version=0.0.4`).
- **Endpoint:** `/metrics` on each service, served from the same HTTP port as the existing API. No new ports are opened.
- **Authentication:** Bearer token (`AUTH_BEARER` env var). The token lives in the operator's secret store per [`STATUS.md`](./STATUS.md) §5. Unauthenticated `/metrics` is forbidden in production.
- **Scrape interval:** 30 seconds (Prometheus default; tuned per [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §3).
- **Library:** [`prom-client`](https://github.com/siimon/prom-client) — already aligned with [`../MONITORING.md`](../MONITORING.md) §8.

---

## 3. Required metrics

### 3.1 Indexer service (`backend/indexer/`)

Exporter location: `backend/indexer/src/api/routes.ts` (new `GET /metrics` handler) backed by a `backend/indexer/src/services/metrics.ts` module that owns the `Registry`.

| Metric name | Type | Labels | Source | Used by |
|-------------|------|--------|--------|---------|
| `up` | Gauge | `job` | Set to `1` on startup, `0` on shutdown via process-exit hook | R-001, D-1 |
| `indexer_sync_lag_seconds` | Gauge | — | `IndexerService.getSyncStatus()` lag in seconds | R-002, R-003, D-1 |
| `indexer_events_indexed_total` | Counter | `event_type` | Increment after each successful DB write in `IndexerService` | D-1 |
| `indexer_db_write_errors_total` | Counter | `error_class` | Catch block of DB writes | R-019 |
| `indexer_reorg_detected_total` | Counter | — | Reorg detection in `IndexerService` | R-016 |
| `indexer_reorg_reverted_events_total` | Counter | — | Per-event revert counter | D-2 |
| `indexer_last_chain_head_timestamp_seconds` | Gauge | — | Unix timestamp of the latest block timestamp seen by the indexer | R-015, D-1 |
| `tonbankcard_payment_events_total` | Counter | `contract` (always `MerchantPaymentHub`) | Parsed event | D-1 |
| `tonbankcard_transfer_events_total` | Counter | `contract` (always `PaymentHub`) | Parsed event | D-1 |
| `tonbankcard_transfer_volume_tbc_5m` | Gauge | — | Rolling sum of TBC moved in the last 5 minutes — set on each sync loop | R-012, D-1 |
| `tonbankcard_outgoing_transfer_tbc` | Gauge | `payer_nft` | Per-event spot value of outgoing transfer (highest seen in the last 1m window) | R-008, D-2 |
| `tonbankcard_fraud_locks_active` | Gauge | — | Count from the indexer state cache | R-009, D-1, D-2 |
| `tonbankcard_collateral_locks_active` | Gauge | — | Count from the indexer state cache | R-011, D-1 |
| `tonbankcard_fraud_lock_events_total` | Counter | `action` (`set`, `clear`) | Per-event counter on `AccountLocks.SetLock` / `ClearLock` events with `category=FRAUD_LOCK` | R-010, D-2 |
| `tonbankcard_risk_authority_actions_total` | Counter | `action` | Mirrors risk-authority signed messages | D-2 |
| `tonbankcard_admin_actions_total` | Counter | `action` | Mirrors admin signed messages | D-2 |
| `tonbankcard_governance_proposal_events_total` | Counter | `kind` (`proposal_created`, `vote`, `executed`) | Parsed governance events | R-014, D-2 |
| `tonbankcard_transparency_report_writes_total` | Counter | — | Parsed `TransparencyRegistry` events | D-2 |
| `tonbankcard_bridge_events_total` | Counter | `kind` | **Inert until A2** — recorded once the bridge contract is deployed and added to the indexer | R-013, D-2 |
| `tonbankcard_contract_paused` | Gauge | `contract` | `0` / `1` — derived from the periodic contract-state cache | D-1 |
| `tonbankcard_transfer_attempt_failed_total` | Counter | `reason` | Parsed `PaymentHub` failure events | D-2 |
| `adapter_up` | Gauge | `adapter` | Result of the adapter health probe | R-017, R-018, D-1 |
| `adapter_request_duration_seconds` | Histogram | `adapter` | Wrapping fetch in the adapter clients | D-1 |

### 3.2 Merchant API (`api/`)

Exporter location: `api/src/` (new `/metrics` handler) backed by an `api/src/metrics.ts` module.

| Metric name | Type | Labels | Source | Used by |
|-------------|------|--------|--------|---------|
| `up` | Gauge | `job` | Set on startup / shutdown | R-004, D-1 |
| `api_request_total` | Counter | `route`, `method`, `code` | Express middleware | R-005, R-006, D-1 |
| `api_request_duration_seconds` | Histogram | `route`, `method` | Express middleware (buckets: 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10) | R-007, D-1 |
| `api_invoice_created_total` | Counter | — | After successful invoice creation | D-1 |
| `api_settlement_verified_total` | Counter | — | After successful settlement verification | D-1 |

Histogram buckets are deliberately coarse — the dashboard only cares about P50 / P95 / P99. Adding more buckets without an explicit need is cost-only.

### 3.3 Process metrics

`prom-client` exposes default Node.js process metrics (`process_*`, `nodejs_*`). These are included on both endpoints to support generic node-health panels.

---

## 4. Architectural invariants

The instrumentation contract must preserve the following invariants. They are non-negotiable per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7 #1 and `CONTRIBUTING.md` §3.

1. **No contract calls from the metrics path.** The exporter reads from the indexer's local cache and the application's in-process counters. It never issues a `runMethod`, a `sendInternalMessage`, or any other on-chain action.
2. **No private keys touched.** The metrics module never sees mnemonics, seed phrases, or admin / risk-authority keys. Reading from the indexer DB is sufficient.
3. **No PII or wallet-seed material in label values.** Allowed labels are listed per-metric above. Free-form labels (e.g., user-controlled NFT names) MUST be sanitised before becoming label values to avoid cardinality explosion and metadata leakage.
4. **Bounded cardinality.** Per-NFT labels are forbidden except on `tonbankcard_outgoing_transfer_tbc` where the cardinality is bounded by a recording rule that only emits the top-N values per minute. Recording rule defined in [`provisioning/prometheus/recording.yml`](./provisioning/prometheus/recording.yml).
5. **`/metrics` is authenticated.** The endpoint requires a bearer token in production. Returning metrics to anonymous callers is forbidden because some metric names (e.g., `tonbankcard_fraud_locks_active`) can leak operational state.

---

## 5. Implementation notes

### 5.1 Indexer

1. Add `prom-client` to `backend/indexer/package.json` (already an implicit dependency of [`../MONITORING.md`](../MONITORING.md) §8).
2. Create `backend/indexer/src/services/metrics.ts` that owns the `Registry` and exports a single `register` constant.
3. Add `GET /metrics` to `backend/indexer/src/api/routes.ts` guarded by bearer-token middleware (reuse the existing `requireAuth` middleware if available; otherwise add a minimal one).
4. Hook gauges and counters into the existing services:
   - `IndexerService` — set `indexer_sync_lag_seconds`, increment `indexer_events_indexed_total`, etc.
   - `IndexerDatabase` — wrap write paths to increment `indexer_db_write_errors_total` on catch.
5. Add a periodic state-snapshot job that refreshes gauges (`tonbankcard_fraud_locks_active`, `tonbankcard_collateral_locks_active`, `tonbankcard_contract_paused`) every 30 seconds from the indexed state.

### 5.2 Merchant API

1. Add `prom-client` to `api/package.json` if not already present.
2. Create `api/src/metrics.ts` analogous to the indexer module.
3. Add a request-instrumentation middleware that increments `api_request_total` and observes `api_request_duration_seconds` for every request.
4. Bump existing route handlers to increment `api_invoice_created_total` and `api_settlement_verified_total` at the success path.

The two services share no code — they have independent Registries — but the metric names are coordinated through this document.

### 5.3 Code-not-yet-shipped guard

The metrics module emits **all** metric names listed above on startup with value `0`, even when the application has not yet observed the underlying event. This avoids dashboards rendering as "No data" before the first real event. The guard is implemented via the `prom-client` `register.getSingleMetric()` API, which auto-creates the metric on first access.

---

## 6. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Alert rules](./ALERT_RULES.md)
- [Dashboards](./DASHBOARDS.md)
- [Implementation runbook](./IMPLEMENTATION_RUNBOOK.md)
- [Existing monitoring catalogue](../MONITORING.md)
- `backend/indexer/src/api/routes.ts`
- `backend/indexer/src/services/indexer-service.ts`
- `api/src/` (entry point — `index.ts`)
- Recording rules: [`provisioning/prometheus/recording.yml`](./provisioning/prometheus/recording.yml)
