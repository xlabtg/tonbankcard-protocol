# B3 — Dashboards

**Engagement:** [B3](./ENGAGEMENT.md)
**Issue reference:** [#119 §3 — Dashboard](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Provisioning source:** [`provisioning/grafana/`](./provisioning/grafana/)
**Last Updated:** 2026-05-16

---

## 1. Scope

Two dashboards ship with B3 — **operational** and **security**. A third (**adapter status**) is a stretch goal that may be deferred per [`STATUS.md`](./STATUS.md) §8.

All dashboards are read-only views over Prometheus-scraped metrics ([`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md)). They expose no contract state, no private keys, no PII, and no merchant secrets. Public exposure is forbidden — access is SSO-gated per [`STATUS.md`](./STATUS.md) §4.

Dashboard JSON committed under [`provisioning/grafana/`](./provisioning/grafana/) targets Grafana ≥ 10 and uses the canonical Prometheus data source variable `${datasource}`.

---

## 2. Operational dashboard (D-1)

Primary on-call dashboard. Opens on every page from `R-001`, `R-002`, `R-004`, `R-006`, `R-007`, `R-012`, `R-018`.

| Row | Panel | Visualisation | Query |
|-----|-------|---------------|-------|
| 1 | Protocol pause status | Stat (green/red) | `tonbankcard_contract_paused` |
| 1 | Indexer health | Stat (green/red) | `up{job="indexer"}` |
| 1 | Merchant API health | Stat (green/red) | `up{job="merchant-api"}` |
| 1 | Block-time freshness | Stat (seconds) | `time() - indexer_last_chain_head_timestamp_seconds` |
| 2 | Indexer sync lag (blocks) | Time series + threshold lines (100, 500) | `indexer_sync_lag_seconds / 5` |
| 2 | Indexer events indexed (rate) | Time series | `rate(indexer_events_indexed_total[5m])` |
| 3 | API request rate | Time series, stacked by `code` | `sum by (code) (rate(api_request_total[5m]))` |
| 3 | API P50/P95/P99 latency | Time series, 3 series | `histogram_quantile(0.5\|0.95\|0.99, ...)` |
| 3 | API error rate | Time series + threshold (5%, 20%) | `sum(rate(api_request_total{code=~"5.."}[5m])) / sum(rate(api_request_total[5m]))` |
| 4 | TBC transfer volume (5m) | Time series + 24h moving average | `tonbankcard_transfer_volume_tbc_5m` and `avg_over_time(... [24h])` |
| 4 | Settlement events (rate) | Time series | `rate(tonbankcard_payment_events_total[5m])` |
| 4 | Internal transfer events (rate) | Time series | `rate(tonbankcard_transfer_events_total[5m])` |
| 5 | Adapter reachability table | Stat table per adapter | `adapter_up{adapter=~"changenow\|nowpayments\|coinrabbit"}` |
| 5 | Adapter request duration (P99) | Time series per adapter | `histogram_quantile(0.99, rate(adapter_request_duration_seconds_bucket[5m]))` |
| 6 | Active fraud locks | Stat (number) | `tonbankcard_fraud_locks_active` |
| 6 | Active collateral locks | Stat (number) | `tonbankcard_collateral_locks_active` |
| 6 | Recent reorgs (1h) | Stat (number) | `increase(indexer_reorg_detected_total[1h])` |

Time range default: last 1 hour. Refresh: 30s.

---

## 3. Security dashboard (D-2)

Audit-trail view for the security lead. Opens on `R-009`, `R-010`, `R-013` (bridge, inert until activation), and during a forensic review.

| Row | Panel | Visualisation | Query |
|-----|-------|---------------|-------|
| 1 | Fraud-lock events (24h) | Bar chart by source NFT | `increase(tonbankcard_fraud_lock_events_total[1h])` |
| 1 | Active fraud locks delta (1h) | Stat | `delta(tonbankcard_fraud_locks_active[1h])` |
| 2 | Risk-authority actions | Table | `tonbankcard_risk_authority_actions_total` joined with action label |
| 2 | Admin actions | Table | `tonbankcard_admin_actions_total` |
| 3 | Large transfers (> threshold) | Bar chart | `tonbankcard_outgoing_transfer_tbc > LARGE_TRANSFER_TBC_THRESHOLD` |
| 3 | Failed transfer attempts | Time series | `rate(tonbankcard_transfer_attempt_failed_total[5m])` |
| 4 | Governance proposals (lifecycle) | Time series | `increase(tonbankcard_governance_proposal_events_total[1h])` |
| 4 | Transparency-report writes | Time series | `increase(tonbankcard_transparency_report_writes_total[1d])` |
| 5 | Bridge events (inert until activation) | Time series, hidden by default | `increase(tonbankcard_bridge_events_total[1m])` |
| 5 | Reorgs with reverted events | Time series | `rate(indexer_reorg_reverted_events_total[10m])` |

Time range default: last 24 hours. Refresh: 60s.

---

## 4. Adapter dashboard (D-3, stretch goal)

If shipped, this dashboard provides a fast view for support engineers triaging adapter-related issues. Tracked in [`STATUS.md`](./STATUS.md) §8 as `Deferred` and shipped under a follow-up engagement if the alert noise from R-017 / R-018 warrants it.

---

## 5. Access controls

| Role | Operational (D-1) | Security (D-2) | Adapter (D-3) |
|------|-------------------|----------------|---------------|
| Maintainer (`@konard`) | Editor | Editor | Editor |
| Primary on-call | Editor | Viewer | Viewer |
| Secondary on-call | Editor | Viewer | Viewer |
| Security lead | Viewer | Editor | Viewer |
| Team (read-only) | Viewer | — | Viewer |

Dashboards are never exposed publicly. Embedding into public websites is forbidden.

---

## 6. Provisioning

Dashboards are provisioned from JSON files committed under [`provisioning/grafana/`](./provisioning/grafana/). Updates are made by editing the JSON in this repository and re-applying via the operator's provisioning pipeline (e.g., `grafana-cli` or a sidecar container that watches `provisioning/grafana/`).

The JSON is a minimal skeleton — dashboards typically grow at the edges. The skeleton ensures every panel above renders against the documented metrics. Field cosmetics (colours, legend formatting) are left to the operator.

The `${datasource}` variable must be selected at first import — there is no hard-coded data-source UID, so the same JSON works against any Prometheus instance.

---

## 7. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Alert rules](./ALERT_RULES.md)
- [Metrics instrumentation](./METRICS_INSTRUMENTATION.md)
- [Existing monitoring catalogue](../MONITORING.md)
- Dashboard JSON: [`provisioning/grafana/operational-dashboard.json`](./provisioning/grafana/operational-dashboard.json), [`provisioning/grafana/security-dashboard.json`](./provisioning/grafana/security-dashboard.json)
