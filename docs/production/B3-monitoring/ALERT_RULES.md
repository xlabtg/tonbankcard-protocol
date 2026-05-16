# B3 — Alert Rules

**Engagement:** [B3](./ENGAGEMENT.md)
**Issue reference:** [#119 §5 — Functional Requirements](https://github.com/xlabtg/tonbankcard-protocol/issues/119)
**Source of truth (machine-readable):** [`provisioning/prometheus/alerts.yml`](./provisioning/prometheus/alerts.yml)
**Last Updated:** 2026-05-16

---

## 1. Scope

This document is the human-readable catalogue of every alert rule shipped by B3. Each rule is identified by a stable `R-NNN` ID (mirrored in [`STATUS.md`](./STATUS.md) §7) and a Prometheus rule name. The Prometheus rule file is the single source of truth for thresholds and expressions; this document explains **why** each rule exists and **what** the on-call engineer is expected to do when it fires.

---

## 2. Severity model

| Severity | Definition | Routing target | SLA (acknowledge) |
|----------|------------|----------------|-------------------|
| `critical` | Active impact or imminent risk (fund-risk pattern, service outage, security signal) | PagerDuty / OpsGenie page + `#tonbankcard-oncall` Slack + `#tonbankcard-security` Slack (for security signals) | 15 minutes (per [`../SLA.md`](../SLA.md) §5.1) |
| `warning` | Degraded state, no immediate fund risk, manual triage required within business day | `#tonbankcard-oncall` Slack | 4 hours (per [`../SLA.md`](../SLA.md) §5.1) |
| `info` | Notable event, no action required by default | `#tonbankcard-oncall` Slack (low-noise channel) | None |

Severity is a property of the rule, not of the firing instance. If a rule needs both a warning and a critical threshold (e.g., indexer lag), there are two rules with two different IDs.

---

## 3. Rule catalogue

### 3.1 Indexer health

#### R-001 · `IndexerDown` — critical

- **Expression:** `up{job="indexer"} == 0`
- **For:** `1m`
- **Why:** The indexer is the data source for every other rule and dashboard panel. If it is unreachable, the protocol is effectively unobservable.
- **Action:** Page on-call. On-call investigates per [`docs/security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md) (severity 2). Restart the service if no crash-loop pattern is observed.
- **Maps to issue:** §5 indirect — required to underpin every other on-chain alert.

#### R-002 · `ChainSyncStopped` — critical

- **Expression:** `indexer_sync_lag_seconds > 500 * 5`  (500 blocks × ~5s per block, expressed in seconds for SLA consistency)
- **For:** `5m`
- **Why:** Issue #119 §5 requirement: indexer lag > 500 blocks = critical, page on-call.
- **Action:** Page on-call. Inspect TON HTTP API health, indexer logs, and the upstream RPC provider.
- **Notes:** Threshold is recorded in `provisioning/prometheus/alerts.yml` as `500_blocks_to_seconds` so it can be re-tuned per chain conditions without touching this document.

#### R-003 · `IndexerLagHigh` — warning

- **Expression:** `indexer_sync_lag_seconds > 100 * 5`  (100 blocks × ~5s)
- **For:** `5m`
- **Why:** Issue #119 §5: indexer lag > 100 blocks = warning.
- **Action:** Triage during business hours. If the lag rises monotonically, escalate before R-002 fires.

#### R-015 · `BlockTimeStalled` — warning

- **Expression:** `(time() - indexer_last_chain_head_timestamp_seconds) > 60`
- **For:** `2m`
- **Why:** Detect a chain outage independent of indexer health.
- **Action:** Cross-check TON Status (https://status.ton.org or equivalent). If the chain is healthy and our indexer is the only one stuck, escalate to R-001 / R-002.

#### R-016 · `ReorgDetected` — warning

- **Expression:** `increase(indexer_reorg_detected_total[10m]) > 0`
- **For:** `0m`
- **Why:** A reorg can revert settlement records and is operationally important even though the protocol is invariant-safe.
- **Action:** Inspect `indexer_reorg_reverted_events_total`. If any settlement event was reverted, follow [`../MONITORING.md`](../MONITORING.md) §6.2 ("Reorg Events").

#### R-019 · `DBWriteErrors` — warning

- **Expression:** `increase(indexer_db_write_errors_total[10m]) > 0`
- **For:** `0m`
- **Why:** A DB write error means an indexed event is at risk of being silently dropped.
- **Action:** Check disk space, DB process, and the indexer logs for the failing write.

### 3.2 Merchant API health

#### R-004 · `APIDown` — critical

- **Expression:** `up{job="merchant-api"} == 0`
- **For:** `1m`
- **Why:** Merchants cannot create invoices or verify settlements. While funds are safe, the user-facing surface is broken.
- **Action:** Page on-call. Restart the service; verify the dependency (indexer) is healthy.

#### R-005 · `APIErrorRateHigh` — warning

- **Expression:** `sum(rate(api_request_total{code=~"5.."}[5m])) / sum(rate(api_request_total[5m])) > 0.05`
- **For:** `5m`
- **Why:** Issue #119 §5: API error rate > 5% over 5 minutes = warning.
- **Action:** Inspect API logs for the dominant error class.

#### R-006 · `APIErrorRateCritical` — critical

- **Expression:** `sum(rate(api_request_total{code=~"5.."}[5m])) / sum(rate(api_request_total[5m])) > 0.20`
- **For:** `5m`
- **Why:** A sustained 20% 5xx rate is indistinguishable from an outage from the merchant's perspective.
- **Action:** Page on-call.

#### R-007 · `APILatencyP99High` — warning

- **Expression:** `histogram_quantile(0.99, sum(rate(api_request_duration_seconds_bucket[5m])) by (le)) > 2`
- **For:** `5m`
- **Why:** Issue #119 §5: API P99 latency > 2 seconds = warning. Merchant integrations time out at higher latencies.
- **Action:** Profile the slowest route. Inspect indexer query latency.

### 3.3 Blockchain — funds-risk signals

#### R-008 · `LargeOutgoingTransfer` — critical

- **Expression:** `tonbankcard_outgoing_transfer_tbc > ${LARGE_TRANSFER_TBC_THRESHOLD}`
- **For:** `0m`
- **Why:** Issue #119 §3: large outgoing-transfer alerts (threshold-based, e.g., > $10K equivalent in TBC).
- **Threshold parameter:** `LARGE_TRANSFER_TBC_THRESHOLD` — initial value derived from the TBC/TON price feed at provisioning time; recorded in [`STATUS.md`](./STATUS.md) §11 Q-2.
- **Action:** Notify `#tonbankcard-security`. **No on-chain action.** The protocol cannot stop the transfer (immutability). The notification triggers human review of the source NFT and the destination address.
- **Notes:** The protocol cannot block the transfer post-hoc — alert is a detection signal, not a remediation trigger.

#### R-009 · `FraudLockBurst` — critical

- **Expression:** `increase(tonbankcard_fraud_locks_active[1h]) > 10`
- **For:** `0m`
- **Why:** Existing rule from [`../MONITORING.md`](../MONITORING.md) §4.1 ("Abnormal Lock Surge"). A burst of fraud locks may indicate risk-authority key compromise or an automation error.
- **Action:** Page on-call. Treat as potential risk-authority compromise per [`../../security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md) §2 ("Key Compromise").

#### R-010 · `AnyFraudLockEvent` — critical

- **Expression:** `increase(tonbankcard_fraud_lock_events_total[1m]) > 0`
- **For:** `0m`
- **Why:** Issue #119 §5: "Any FRAUD_LOCK event: immediate notification."
- **Action:** Notify `#tonbankcard-security`. Validate against the risk-authority's expected operations. If the action was not authorised, treat as a key-compromise incident.

#### R-011 · `CollateralLockBurst` — warning

- **Expression:** `increase(tonbankcard_collateral_locks_active[1h]) > 20`
- **For:** `0m`
- **Why:** A surge of `COLLATERAL_LOCK` events likely reflects a lending-adapter signal. While not fund-risk, it warrants triage.
- **Action:** Notify `#tonbankcard-oncall`. Confirm with the lending-adapter operator.

#### R-012 · `UnusualTBCVolume` — critical

- **Expression:** `tonbankcard_transfer_volume_tbc_5m > ${UNUSUAL_VOLUME_MULTIPLIER} * avg_over_time(tonbankcard_transfer_volume_tbc_5m[24h])`
- **For:** `10m`
- **Parameter:** `UNUSUAL_VOLUME_MULTIPLIER` — initial value `2` per issue #119 §5; documented in [`STATUS.md`](./STATUS.md) §11 Q-3.
- **Why:** Issue #119 §5: "Unusual TBC volume (> 2x 24h average): critical."
- **Action:** Page on-call. Cross-reference with `R-008` to determine whether a single large transfer dominates the volume.
- **Notes:** The expression uses a 5-minute window so a sustained 10-minute breach is required (the `for: 10m`) — this avoids spurious paging during legitimate spikes.

### 3.4 Governance & bridge

#### R-014 · `GovernanceProposalCreated` — info

- **Expression:** `increase(tonbankcard_governance_proposal_events_total[5m]) > 0`
- **For:** `0m`
- **Why:** Issue #119 §3: governance event monitoring (proposals, votes, transparency reports).
- **Action:** None automatic. Surfaced on the security dashboard as a low-noise audit trail.

#### R-013 · `BridgeEventDetected` — critical (inert until A2 + bridge deploy)

- **Expression:** `increase(tonbankcard_bridge_events_total[1m]) > 0`
- **For:** `0m`
- **Why:** Issue #119 §3 + §5: "Any bridge event (CrossChainBridge) after Phase 4 deployment: immediate notification."
- **Action:** Page on-call **and** `#tonbankcard-security`. **No reactive on-chain action.** Per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7 #5, bridge events trigger a security review before any manual intervention.
- **Inert gate:** The Prometheus rule is wrapped in a `gate: phase4_active` label and the corresponding scrape job is disabled in `provisioning/prometheus/alerts.yml` until A2 verdict = `READY` and `docs/existing-contracts.md` carries a mainnet bridge address.

### 3.5 External adapters

#### R-017 · `AdapterUnreachable` — warning

- **Expression:** `adapter_up{adapter=~"changenow|nowpayments|coinrabbit"} == 0`
- **For:** `5m`
- **Why:** Issue #119 §3: gateway adapter health.
- **Action:** Confirm via the third-party status page. Notify the relevant ops contact. The protocol does not have an SLA on third-party uptime.

#### R-018 · `AllAdaptersUnreachable` — critical

- **Expression:** `sum(adapter_up) == 0`
- **For:** `5m`
- **Why:** If every adapter is unreachable, the merchant on-ramp surface is broken end-to-end. Internal TBC operations continue unaffected (see [`../SLA.md`](../SLA.md) §3.3).
- **Action:** Page on-call. Verify TONBANKCARD's network egress (DNS, outbound firewall) before contacting providers.

---

## 4. Acknowledgement path

Every alert pages or notifies a specific channel. The on-call engineer's first 5 minutes:

1. **Acknowledge** in PagerDuty / OpsGenie to suppress repeated pages.
2. **Acknowledge** in the Slack channel — react with `:eyes:` so the team sees the alert is owned.
3. **Open the operational dashboard** ([`DASHBOARDS.md`](./DASHBOARDS.md) §2) and the relevant time range.
4. **Decide** per [`docs/security/INCIDENT_RESPONSE.md`](../../security/INCIDENT_RESPONSE.md): is this a security signal or an operational one?
5. **Communicate** progress in Slack every 15 minutes until the alert clears or is escalated.

If the alert is a known false positive, silence it in Alertmanager (max 1 hour) and open a follow-up issue to re-tune the rule.

---

## 5. Suppression / silencing policy

- Critical-severity rules **may not** be silenced for more than 1 hour without an explicit follow-up issue.
- Warning-severity rules may be silenced for ≤ 24 hours.
- Info-severity rules may be silenced indefinitely (they exist for the audit trail; silencing only hides notifications, never the event in the dashboard).
- Silences are logged in `#tonbankcard-oncall` Slack with the silencing engineer's name.
- A persistent silence (> 7 days) becomes a deletion of the rule via a B3.x follow-up engagement.

---

## 6. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Dashboards](./DASHBOARDS.md)
- [Incident drill](./INCIDENT_DRILL.md)
- [Existing monitoring catalogue](../MONITORING.md)
- [SLA](../SLA.md)
- [Incident response](../../security/INCIDENT_RESPONSE.md)
- [Key management](../../security/KEY_MANAGEMENT.md)
- Prometheus rules: [`provisioning/prometheus/alerts.yml`](./provisioning/prometheus/alerts.yml)
- Recording rules: [`provisioning/prometheus/recording.yml`](./provisioning/prometheus/recording.yml)
- Alertmanager routes: [`provisioning/alertmanager/routes.yml`](./provisioning/alertmanager/routes.yml)
