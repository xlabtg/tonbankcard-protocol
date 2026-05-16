# B3 — Monitoring Stack Selection

**Engagement:** [B3](./ENGAGEMENT.md)
**Issue reference:** [#119 — Production Monitoring & Alerting](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Status:** Decision pending — vendor recorded in §4 once chosen
**Last Updated:** 2026-05-16

---

## 1. Why this decision is recorded explicitly

Issue #119 §3 "Dashboard" says **"Grafana or Datadog"** without prescribing one. The choice has long-term operational, financial, and privacy implications, so it is recorded as a first-class engagement artefact rather than left implicit.

The decision is reversible — the kill-switch in [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §8 leaves both options viable up to the moment the dashboard URLs are published in the on-call channel.

---

## 2. Constraints

The chosen stack MUST:

1. Scrape Prometheus-format `/metrics` endpoints (the indexer + API only export Prometheus exposition format — see [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §2). Anything else would require code changes elsewhere.
2. Support PagerDuty / OpsGenie integration for paging on Critical alerts.
3. Support Slack webhook delivery for Critical + Warning alerts.
4. Enforce SSO-gated dashboard access (no public dashboards; access controls per [`STATUS.md`](./STATUS.md) §4).
5. Store no on-chain private keys, mnemonics, or PII. Indexer-derived metrics only.
6. Provide a 2-minute end-to-end notification path (scrape → rule eval → routing → page).
7. Be operable by ≤ 1 engineer once provisioned (no full-time SRE assumed).

The stack SHOULD:

- Provide alert routing with severity-based silencing.
- Support recording rules / aggregated metrics to keep dashboard queries cheap.
- Have a defined data-retention contract (≥ 30 days for raw metrics; ≥ 90 days for aggregated metrics).

The stack MUST NOT:

- Require write access to the protocol (no contract calls).
- Require shipping wallet seeds, NFT private keys, or merchant secrets to the vendor.
- Charge per ingested log line in a way that would couple monitoring cost to attack volume.

---

## 3. Option matrix

| Dimension | Grafana stack (self-hosted) | Grafana Cloud | Datadog |
|-----------|-----------------------------|---------------|---------|
| Prometheus scrape | ✅ Native | ✅ Native | ✅ via OpenMetrics integration |
| PagerDuty / OpsGenie | ✅ Alertmanager | ✅ Built-in | ✅ Built-in |
| Slack webhooks | ✅ Alertmanager | ✅ Built-in | ✅ Built-in |
| SSO-gated dashboards | ✅ via reverse proxy / Grafana SSO | ✅ Built-in | ✅ Built-in |
| Data residency | ✅ Operator-controlled | ⚠️ Vendor cloud | ⚠️ Vendor cloud |
| Operational cost (1 engineer) | Medium (self-managed Prom + AM + Grafana) | Low | Low |
| Financial cost (estimated, low traffic) | $0 infra + $0 license | ~$8/mo Free tier; paid for retention | ~$15+/host/mo + ingestion |
| Lock-in risk | Low — open-source | Medium — Grafana-hosted | High — proprietary |
| Time-series retention default | Operator-defined | 14 days Free / 30+ days paid | 15 months metrics |
| Anomaly detection / forecasting | Manual / Loki + ML | Available | Native, easier |
| Alert-as-code | ✅ YAML in repo | ✅ YAML in repo | ⚠️ Terraform / API |
| Aligns with repo convention | ✅ Already references Prometheus throughout `docs/production/MONITORING.md` | ✅ Same exposition format | ⚠️ Requires OpenMetrics adapter |
| Bridge / fraud alert privacy | ✅ Self-hosted = no third-party sees event stream | ⚠️ Vendor sees alert metadata | ⚠️ Vendor sees alert metadata |

---

## 4. Decision

**Recorded by:** TBD
**Decision date:** TBD
**Vendor selected:** ☐ Grafana stack (self-hosted) — Prometheus + Alertmanager + Grafana
                    ☐ Grafana Cloud — managed
                    ☐ Datadog — managed
**Rationale:** _Fill in once decided._

> The default recommendation is the **self-hosted Grafana stack**: it requires no third-party access to fraud-lock or bridge event metadata, aligns with the Prometheus exposition format already referenced throughout `docs/production/MONITORING.md`, keeps alert configuration as code in this repository, and has zero financial floor. The trade-off is a higher operational baseline (self-managed Prometheus + Alertmanager + Grafana). The default is overridden if the operator team confirms that the operational cost is unacceptable or that anomaly-detection features are required from day one.

The decision is locked once recorded above. A change requires a new B3 cycle (or a follow-up engagement, e.g., `B3.1`).

### 4.1 Provisioning files

Regardless of the chosen vendor, the canonical alert + dashboard definitions live under [`provisioning/`](./provisioning/) in Prometheus / Grafana JSON formats:

- `provisioning/prometheus/alerts.yml`
- `provisioning/prometheus/recording.yml`
- `provisioning/alertmanager/routes.yml`
- `provisioning/grafana/operational-dashboard.json`
- `provisioning/grafana/security-dashboard.json`

If Datadog is selected, the operator generates Datadog equivalents from these files at provisioning time. The Prometheus / Grafana files remain the source of truth in this repository.

---

## 5. Rollback plan

If the chosen stack becomes untenable (cost, reliability, vendor lock-in), the kill-switch in [`IMPLEMENTATION_RUNBOOK.md`](./IMPLEMENTATION_RUNBOOK.md) §8 specifies:

1. Stop the scrape job (Prometheus) or disconnect the agent (Datadog).
2. Keep the alert rule YAML in this repository — they are vendor-neutral except for routing.
3. Re-provision the alternate vendor using the same `provisioning/` files.
4. Update [`STATUS.md`](./STATUS.md) §3 with the new vendor and the date of rollback.

Time budget for rollback: ≤ 4 hours from decision to fully provisioned alternate stack. During that window, paging falls back to the secondary contact path in [`../on-call.md`](../on-call.md) §4.

---

## 6. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Existing monitoring catalogue](../MONITORING.md)
- [SLA](../SLA.md)
- [Issue #119](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
