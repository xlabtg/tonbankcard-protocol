# B3 — Implementation Runbook

**Engagement:** [B3](./ENGAGEMENT.md)
**Audience:** Monitoring operator + maintainer
**Last Updated:** 2026-05-16

---

## 1. Pre-flight

Before executing any step in this runbook:

1. Confirm every upstream gate in [`STATUS.md`](./STATUS.md) §2 is ✅.
2. Confirm the monitoring vendor is recorded in [`STACK_SELECTION.md`](./STACK_SELECTION.md) §4.
3. Confirm the on-call rotation is populated in [`../on-call.md`](../on-call.md) §2.
4. Confirm the staging environment has both an indexer and a Merchant API running with `/metrics` enabled per [`METRICS_INSTRUMENTATION.md`](./METRICS_INSTRUMENTATION.md) §5.

The runbook is **idempotent**: every step can be re-run without side effects beyond the obvious (a re-scrape, a re-import). The only non-idempotent operation is the cutover from staging to production, which is gated behind §7.

---

## 2. Scrape configuration (Prometheus)

If the chosen stack is Grafana / Prometheus, drop the following job into the operator's `prometheus.yml` (do not commit secrets):

```yaml
scrape_configs:
  - job_name: indexer
    metrics_path: /metrics
    scheme: https
    bearer_token_file: /var/secrets/indexer-metrics-token
    static_configs:
      - targets: [ 'indexer-staging.example:443' ]
        labels:
          env: staging
  - job_name: merchant-api
    metrics_path: /metrics
    scheme: https
    bearer_token_file: /var/secrets/api-metrics-token
    static_configs:
      - targets: [ 'merchant-api-staging.example:443' ]
        labels:
          env: staging
```

For Datadog, the equivalent is an `OpenMetrics` check pointed at the same URLs. The bearer token must live in the Datadog agent's secret file, not in `datadog.yaml`.

The `env` label distinguishes staging from production. Alert routing in [`provisioning/alertmanager/routes.yml`](./provisioning/alertmanager/routes.yml) uses this label to suppress paging from staging.

---

## 3. Loading alert + recording rules

```bash
# Validate the alert rules file before reloading Prometheus
promtool check rules docs/production/B3-monitoring/provisioning/prometheus/alerts.yml
promtool check rules docs/production/B3-monitoring/provisioning/prometheus/recording.yml

# Copy into Prometheus rules directory (operator-specific path)
cp docs/production/B3-monitoring/provisioning/prometheus/alerts.yml      /etc/prometheus/rules/
cp docs/production/B3-monitoring/provisioning/prometheus/recording.yml   /etc/prometheus/rules/

# Reload Prometheus
curl -X POST https://prometheus.example/-/reload
```

The reload is non-disruptive; in-flight scrapes complete normally.

---

## 4. Provisioning dashboards

```bash
# Validate dashboard JSON
jq empty docs/production/B3-monitoring/provisioning/grafana/operational-dashboard.json
jq empty docs/production/B3-monitoring/provisioning/grafana/security-dashboard.json

# Push via the operator's Grafana provisioning pipeline (e.g., sidecar that
# watches a directory, or a one-shot import via the HTTP API).
```

Access controls are applied at import time per [`DASHBOARDS.md`](./DASHBOARDS.md) §5.

---

## 5. Alertmanager routing

`provisioning/alertmanager/routes.yml` is the source of truth for how alerts reach Slack / PagerDuty. The file is structured so that:

- `severity=critical` → PagerDuty + `#tonbankcard-oncall` Slack.
- `severity=critical` AND `category=security` → also `#tonbankcard-security` Slack.
- `severity=warning` → `#tonbankcard-oncall` Slack only.
- `severity=info` → low-noise Slack channel.
- `env=staging` → muted (no paging, Slack delivery to a synthetic channel only).

Webhooks and integration keys are referenced as environment variables — the YAML file in this repo is intentionally a template.

---

## 6. Persistence

| Component | Persistence policy |
|-----------|--------------------|
| Prometheus TSDB | ≥ 30-day retention. Stored on a managed volume. |
| Recording-rule output | Same retention as raw metrics. |
| Alertmanager silences | Persisted across restarts (Alertmanager `--storage.path`). |
| Grafana dashboards | Provisioned from this repository — no manual edits in the UI without committing back to repo. |
| On-call schedule | Source of truth is [`../on-call.md`](../on-call.md); mirrored into PagerDuty / OpsGenie. |

A restart of Prometheus, Alertmanager, or Grafana MUST NOT lose data the runbook depends on. If managed instances are used, the persistence policy is the vendor's default with retention re-confirmed in [`STATUS.md`](./STATUS.md) §3.

---

## 7. Production cutover

Staging → production cutover is a single step but gated.

### 7.1 Cutover preconditions

- All three drills in [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3 recorded `PASS` under [`drills/`](./drills/).
- Notification SLA (≤ 120s) verified in every drill.
- No Critical-severity false-positive alerts fired in the last 24 staging hours.
- B2 verdict = `MAINNET-LIVE` (gate G-1).

### 7.2 Cutover steps

1. Add the production indexer + API targets to `prometheus.yml` with `env: production` label.
2. Reload Prometheus (§3).
3. Confirm scrape success on both targets (no scrape errors for ≥ 5 minutes).
4. Verify Alertmanager routes — synthetic test alert (use `amtool` or send a request to `/api/v1/alerts`) reaches PagerDuty.
5. Update [`STATUS.md`](./STATUS.md) §3 with the cutover commit hash and date.
6. Start the 24-hour soak window. **Do not** announce the engagement as live until the window closes.
7. After 24 hours with no Critical false-positives, flip [`STATUS.md`](./STATUS.md) gating verdict to `MONITORING-LIVE`.
8. Post the dashboard access procedure (not the URL) in the on-call channel and the [`../on-call.md`](../on-call.md) document.

### 7.3 What "MONITORING-LIVE" does NOT mean

- It does **not** authorise any automated remediation. Pause / lock decisions still follow [`../../security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md).
- It does **not** enable bridge alerts (R-013) until A2 verdict + mainnet bridge deployment.
- It does **not** replace `docs/production/MONITORING.md` — that document remains the higher-level monitoring strategy.

---

## 8. Kill-switch

If monitoring becomes a problem (false-positive storm, vendor outage, cost spike, accidental exposure of sensitive metrics):

1. **Mute** all Critical alerts via Alertmanager silence (`amtool silence add ...`). Maximum silence: 1 hour.
2. **Communicate** in `#tonbankcard-oncall` Slack — note the silence and the follow-up issue.
3. **Decide** within the silence window:
   - If the issue is a noisy rule → trim the rule in `provisioning/prometheus/alerts.yml`, validate with `promtool`, reload.
   - If the issue is vendor-side → switch to the rollback plan in [`STACK_SELECTION.md`](./STACK_SELECTION.md) §5.
   - If the issue is exposure of sensitive metrics → rotate the bearer token, audit recent scrape sources, update `METRICS_INSTRUMENTATION.md` §4.
4. **Re-enable** the alert path and lift the silence.

The kill-switch never disables on-call paging — it only disables a specific noisy rule. If on-call paging itself is the problem, switch to the secondary contact path in [`../on-call.md`](../on-call.md) §4.

---

## 9. Weekly maintenance

| Cadence | Task | Output |
|---------|------|--------|
| Weekly | Review false-positive rate per rule; trim thresholds | PR against `provisioning/prometheus/alerts.yml` |
| Weekly | Review dashboard load times; remove unused panels | PR against `provisioning/grafana/*.json` |
| Monthly | Verify access lists in Grafana + PagerDuty + Slack channels | Note in `#tonbankcard-oncall` |
| Quarterly | Run a fresh incident drill (rotate scenarios in [`INCIDENT_DRILL.md`](./INCIDENT_DRILL.md) §3) | New report under [`drills/`](./drills/) |

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Stack selection](./STACK_SELECTION.md)
- [Alert rules](./ALERT_RULES.md)
- [Dashboards](./DASHBOARDS.md)
- [Metrics instrumentation](./METRICS_INSTRUMENTATION.md)
- [Incident drill](./INCIDENT_DRILL.md)
- [On-call rotation](../on-call.md)
- [Existing monitoring catalogue](../MONITORING.md)
- [SLA](../SLA.md)
