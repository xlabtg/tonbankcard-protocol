# TONBANKCARD Protocol — Monitoring & Observability

**Document Type:** Production Operations
**Issue Reference:** [#74 — Improvements / Phase 14 — Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_14_production.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Objectives](#1-objectives)
2. [Component Architecture](#2-component-architecture)
3. [Metrics](#3-metrics)
4. [Alerts](#4-alerts)
5. [Logging](#5-logging)
6. [Dashboards](#6-dashboards)
7. [Health Checks](#7-health-checks)
8. [Implementation Guide](#8-implementation-guide)

---

## 1. Objectives

The monitoring strategy for TONBANKCARD follows the protocol's non-custodial design principles:

- **Observability without custody** — monitoring cannot interfere with fund flows
- **On-chain truth** — blockchain metrics are authoritative; off-chain metrics are operational
- **Defense-in-depth** — monitoring detects anomalies early for manual review
- **Minimal false positives** — alerts must be actionable and specific

**Critical principle:** Monitoring can detect problems but cannot take automated action on user funds. All remediation requires manual review and user-initiated action.

---

## 2. Component Architecture

### Monitored Components

| Component | Type | Monitoring Scope |
|-----------|------|-----------------|
| TON Blockchain | External | Block production, payment events |
| Payment Hub Contract | On-chain | Transaction success rate, event emission |
| Merchant Payment Hub | On-chain | Settlement events, rejection rates |
| Indexer (`backend/indexer/`) | Service | Sync lag, error rate, uptime |
| Merchant API (`api/`) | Service | Request rate, latency, error rate |
| SDK | Library | Not directly monitored (client-side) |
| External Adapters | External | Availability, response time |

### Monitoring Stack (Recommended)

| Function | Recommended Tool | Alternative |
|----------|-----------------|-------------|
| Metrics | Prometheus | InfluxDB |
| Visualization | Grafana | Datadog |
| Log aggregation | Pino → Loki | CloudWatch |
| Alerting | PagerDuty / OpsGenie | Grafana Alerts |
| Uptime monitoring | UptimeRobot / Pingdom | Grafana Synthetic |

---

## 3. Metrics

### 3.1 On-Chain Metrics

These metrics are derived from the TON blockchain (authoritative source of truth):

| Metric Name | Type | Description | Source |
|-------------|------|-------------|--------|
| `tonbankcard_payment_events_total` | Counter | Total MerchantPaymentHub settlement events | Blockchain events |
| `tonbankcard_transfer_events_total` | Counter | Total PaymentHub internal transfer events | Blockchain events |
| `tonbankcard_fraud_locks_active` | Gauge | Number of accounts with FRAUD_LOCK set | Contract state query |
| `tonbankcard_collateral_locks_active` | Gauge | Number of accounts with COLLATERAL_LOCK set | Contract state query |
| `tonbankcard_contract_paused` | Gauge | PaymentHub paused state (0 = normal, 1 = paused) | Contract state query |
| `tonbankcard_block_height_observed` | Gauge | Latest TON block height observed by indexer | Indexer |
| `tonbankcard_block_height_chain` | Gauge | Latest TON block height on chain | TON API |

### 3.2 Indexer Metrics

| Metric Name | Type | Description | Alert Threshold |
|-------------|------|-------------|----------------|
| `indexer_sync_lag_seconds` | Gauge | Seconds behind chain tip | > 60s (WARN), > 300s (CRIT) |
| `indexer_events_indexed_total` | Counter | Total events indexed | Unexpected drop → WARN |
| `indexer_db_write_errors_total` | Counter | Database write errors | Any > 0 → WARN |
| `indexer_reorg_detected_total` | Counter | Chain reorganizations detected | Any → INFO |
| `indexer_reorg_reverted_events_total` | Counter | Events reverted due to reorg | Any > 0 → WARN |
| `indexer_up` | Gauge | Indexer process health (1 = up) | = 0 → CRIT |

### 3.3 API Metrics

| Metric Name | Type | Description | Alert Threshold |
|-------------|------|-------------|----------------|
| `api_request_total` | Counter | Total API requests | — |
| `api_request_duration_seconds` | Histogram | Request latency (p50, p95, p99) | p99 > 5s → WARN |
| `api_error_rate` | Gauge | % of requests returning 5xx | > 1% → WARN, > 5% → CRIT |
| `api_invoice_created_total` | Counter | Total invoices created | — |
| `api_settlement_verified_total` | Counter | Total settlement verifications | — |
| `api_up` | Gauge | API process health (1 = up) | = 0 → CRIT |

### 3.4 External Adapter Metrics

| Metric Name | Type | Description | Alert Threshold |
|-------------|------|-------------|----------------|
| `adapter_changenow_up` | Gauge | ChangeNOW API reachable | = 0 → WARN |
| `adapter_nowpayments_up` | Gauge | NOWPayments API reachable | = 0 → WARN |
| `adapter_coinrabbit_up` | Gauge | CoinRabbit API reachable | = 0 → WARN |
| `adapter_request_duration_seconds` | Histogram | External API response time | p99 > 10s → WARN |
| `adapter_error_rate` | Gauge | External API error rate | > 5% → WARN |

---

## 4. Alerts

### 4.1 Critical Alerts (Immediate Response)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Protocol Paused** | `tonbankcard_contract_paused == 1` | Immediate investigation; contact admin key holder |
| **Indexer Down** | `indexer_up == 0` for > 1 minute | Page on-call engineer; restart indexer service |
| **API Down** | `api_up == 0` for > 1 minute | Page on-call engineer; restart API service |
| **Chain Sync Stopped** | `indexer_sync_lag_seconds > 300` | Page on-call; check TON node, indexer logs |
| **Abnormal Lock Surge** | `tonbankcard_fraud_locks_active` increases by > 10 in 1 hour | Immediate investigation; potential admin key compromise |

### 4.2 High Severity Alerts (Response within 1 hour)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Indexer Lag High** | `indexer_sync_lag_seconds > 60` | Investigate indexer performance; check TON node latency |
| **API Error Rate High** | `api_error_rate > 5%` | Check API logs; investigate root cause |
| **Reorg Detected** | `indexer_reorg_detected_total` increases | Review reverted events; verify settlement records |
| **All Adapters Down** | All `adapter_*_up == 0` | Investigate network connectivity; notify users |

### 4.3 Warning Alerts (Response within 24 hours)

| Alert | Condition | Action |
|-------|-----------|--------|
| **API Latency High** | `api_request_duration_seconds{p99} > 5s` | Profile API performance |
| **Single Adapter Down** | One `adapter_*_up == 0` | Monitor; notify if extended downtime |
| **DB Write Errors** | `indexer_db_write_errors_total > 0` | Check disk space and database health |

### 4.4 Alert Configuration Example (Prometheus AlertManager)

```yaml
# alerting_rules.yml
groups:
  - name: tonbankcard_critical
    interval: 30s
    rules:
      - alert: ProtocolPaused
        expr: tonbankcard_contract_paused == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "TONBANKCARD PaymentHub is paused"
          description: "Admin has paused the Payment Hub contract. No transfers possible."

      - alert: IndexerDown
        expr: indexer_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "TONBANKCARD Indexer is down"

      - alert: ChainSyncStopped
        expr: indexer_sync_lag_seconds > 300
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Indexer is more than 5 minutes behind chain"
          description: "Current lag: {{ $value }}s"

  - name: tonbankcard_warnings
    interval: 60s
    rules:
      - alert: IndexerLagHigh
        expr: indexer_sync_lag_seconds > 60
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Indexer sync lag > 60 seconds"

      - alert: APIErrorRateHigh
        expr: api_error_rate > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API error rate > 5%"
          description: "Current rate: {{ $value | humanizePercentage }}"
```

---

## 5. Logging

### 5.1 Log Levels

| Level | Use Case | Retention |
|-------|----------|-----------|
| `ERROR` | Unexpected failures, unhandled exceptions | 90 days |
| `WARN` | Degraded state, retryable failures | 30 days |
| `INFO` | Normal operational events (startup, key events) | 14 days |
| `DEBUG` | Detailed diagnostic info (disabled by default) | 7 days |

Debug logging must be disabled by default and enabled only for targeted investigation.

### 5.2 Required Log Events

#### Indexer

```typescript
// Required INFO events
logger.info({ blockHeight, eventsCount }, 'Sync complete');
logger.info({ reorgDepth, revertedEvents }, 'Reorg detected and handled');

// Required WARN events
logger.warn({ lag: syncLagSeconds }, 'Sync lag exceeds 60 seconds');
logger.warn({ error }, 'Failed to process block, will retry');

// Required ERROR events
logger.error({ error, blockHeight }, 'Unrecoverable block processing error');
```

#### API

```typescript
// Required INFO events
logger.info({ invoiceId, merchantNft }, 'Invoice created');
logger.info({ invoiceId, txHash }, 'Settlement verified on-chain');

// Required WARN events
logger.warn({ invoiceId }, 'Settlement verification failed - not found on-chain');
logger.warn({ provider, statusCode }, 'External adapter returned error');

// Required ERROR events
logger.error({ error, route }, 'Unhandled API error');
```

### 5.3 Log Format

All logs use structured JSON format (via Pino):

```json
{
  "level": "info",
  "time": "2026-03-19T12:00:00.000Z",
  "service": "indexer",
  "component": "sync",
  "blockHeight": 12345678,
  "eventsCount": 3,
  "msg": "Sync complete"
}
```

### 5.4 What NOT to Log

- User private keys (must never appear in logs)
- Wallet seed phrases or mnemonics
- Full NFT addresses in DEBUG level (use short form)
- API keys for external providers
- Any personally identifiable information (PII)

---

## 6. Dashboards

### 6.1 Operational Dashboard

Primary dashboard for on-call engineers. Must show:

| Panel | Metric | Visualization |
|-------|--------|---------------|
| Protocol Status | `tonbankcard_contract_paused` | Status indicator (green/red) |
| Block Sync Lag | `indexer_sync_lag_seconds` | Time series |
| Payment Events (24h) | `tonbankcard_payment_events_total` rate | Counter |
| Transfer Events (24h) | `tonbankcard_transfer_events_total` rate | Counter |
| API Request Rate | `api_request_total` rate | Time series |
| API Error Rate | `api_error_rate` | Time series with threshold |
| Active Fraud Locks | `tonbankcard_fraud_locks_active` | Gauge |
| Adapter Status | All `adapter_*_up` | Status table |

### 6.2 Security Dashboard

Dashboard for security monitoring:

| Panel | Metric | Purpose |
|-------|--------|---------|
| Fraud Lock Changes | Delta of `tonbankcard_fraud_locks_active` | Detect unusual lock activity |
| Admin Actions | Custom event (protocol_admin_action) | Track all admin operations |
| Failed Transfer Attempts | Custom event | Detect attack patterns |
| Reorg Events | `indexer_reorg_detected_total` | Detect potential double-spend attempts |

---

## 7. Health Checks

### 7.1 Indexer Health Endpoint

```
GET /health
Response: 200 OK
{
  "status": "healthy",
  "syncLagSeconds": 5,
  "lastBlockIndexed": 12345678,
  "dbStatus": "connected"
}

GET /health
Response: 503 Service Unavailable (if lag > 300s or DB disconnected)
{
  "status": "degraded",
  "reason": "sync_lag",
  "syncLagSeconds": 450
}
```

### 7.2 API Health Endpoint

```
GET /health
Response: 200 OK
{
  "status": "healthy",
  "version": "1.0.0",
  "indexerConnected": true
}
```

### 7.3 Kubernetes / Container Probes

```yaml
# Liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

# Readiness probe (uses sync lag check)
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 8. Implementation Guide

### 8.1 Adding Prometheus Metrics to Indexer

```typescript
// backend/indexer/src/metrics.ts
import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const register = new Registry();

export const syncLagGauge = new Gauge({
  name: 'indexer_sync_lag_seconds',
  help: 'Seconds behind chain tip',
  registers: [register],
});

export const eventsIndexedCounter = new Counter({
  name: 'indexer_events_indexed_total',
  help: 'Total events indexed',
  registers: [register],
});

// In indexer-service.ts, after each sync:
syncLagGauge.set(lagSeconds);
eventsIndexedCounter.inc(newEventsCount);
```

### 8.2 Metrics Endpoint

Add to the indexer API server:

```typescript
// In api/routes.ts
import { register } from './metrics';

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## References

- **SLA:** [`docs/production/SLA.md`](SLA.md)
- **Incident Response:** [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md)
- **Indexer Architecture:** [`backend/indexer/docs/ARCHITECTURE.md`](../../backend/indexer/docs/ARCHITECTURE.md)
- **Full System Audit:** [`docs/audit/FULL_SYSTEM_AUDIT.md`](../audit/FULL_SYSTEM_AUDIT.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
