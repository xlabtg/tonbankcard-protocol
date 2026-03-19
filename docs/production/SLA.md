# TONBANKCARD Protocol — SLA Definition

**Document Type:** Production Operations
**Issue Reference:** [#74 — Improvements / Phase 14 — Production Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_14_production.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [SLA Scope and Philosophy](#1-sla-scope-and-philosophy)
2. [On-Chain Availability (Foundational)](#2-on-chain-availability-foundational)
3. [Off-Chain Service SLAs](#3-off-chain-service-slas)
4. [Failure Handling Procedures](#4-failure-handling-procedures)
5. [Incident Classification](#5-incident-classification)
6. [Maintenance Windows](#6-maintenance-windows)
7. [SLA Exclusions](#7-sla-exclusions)

---

## 1. SLA Scope and Philosophy

### 1.1 What TONBANKCARD Can Guarantee

TONBANKCARD's availability characteristics are shaped by its non-custodial, on-chain-first architecture:

1. **On-chain availability** — depends on TON blockchain (outside our control, but extremely reliable)
2. **Off-chain service availability** — indexer and API (within our operational control)
3. **External adapter availability** — depends on third-party providers (not guaranteed)

### 1.2 What Cannot Be Guaranteed

- TBC token price stability (determined by market)
- External provider availability (ChangeNOW, NOWPayments, CoinRabbit)
- TON blockchain availability (foundation layer, 99.9%+ historically but not our SLA)
- User private key security (user responsibility)

### 1.3 Non-Custodial Uptime Property

**Critical insight:** Even during complete off-chain service outages, user funds are never at risk. The TBC jetton and TON blockchain continue operating independently of any TONBANKCARD infrastructure.

This means:
- A 100% outage of all TONBANKCARD services = service degradation, not fund loss
- Users retain full custody and blockchain access even when our services are unavailable
- Recovery from any outage does not require user action to "protect" funds

---

## 2. On-Chain Availability (Foundational)

### 2.1 Smart Contract Availability

Smart contracts deployed on TON blockchain are available as long as TON blockchain is producing blocks.

| Component | Availability Target | Notes |
|-----------|--------------------|----|
| PaymentHub contract | ≥ 99.9% | Limited by TON blockchain uptime |
| MerchantPaymentHub contract | ≥ 99.9% | Limited by TON blockchain uptime |
| TBC Jetton (external, deployed) | ≥ 99.9% | TON blockchain uptime |
| NFT Collections (external, deployed) | ≥ 99.9% | TON blockchain uptime |

**Historical context:** TON blockchain has maintained >99.9% uptime since launch. Block time is ~5 seconds.

### 2.2 Transaction Finality

| Event | Time Target |
|-------|-------------|
| Transaction inclusion in block | < 30 seconds |
| Practical finality (low reorg risk) | 1 block (~5 seconds) |
| High-value transaction safety | 5 blocks (~25 seconds) |

---

## 3. Off-Chain Service SLAs

### 3.1 Indexer Service

The indexer is a read-only cache of blockchain state. Its unavailability does not affect on-chain operations.

| Metric | Target | Definition |
|--------|--------|-----------|
| **Uptime** | ≥ 99.5% monthly | Service responds to /health with 200 |
| **Sync Lag (steady state)** | < 30 seconds | Seconds behind chain tip in normal conditions |
| **Sync Lag (maximum)** | < 120 seconds | Maximum acceptable lag before alert |
| **Sync Lag (SLA breach)** | > 300 seconds sustained for > 5 minutes | Service considered unavailable |
| **Database write latency** | p99 < 100ms | Time to write indexed event to DB |
| **API response latency** | p99 < 500ms | Time for GET /events, GET /status |

**Degradation definition:** Indexer is "degraded" when sync lag > 60 seconds. Data is still available but may be stale.

**Unavailable definition:** Indexer is "unavailable" when sync lag > 300 seconds sustained for > 5 minutes, or when the process is not responding.

### 3.2 Merchant API

| Metric | Target | Definition |
|--------|--------|-----------|
| **Uptime** | ≥ 99.5% monthly | Service responds to /health with 200 |
| **Request success rate** | ≥ 99% | Percentage of requests returning non-5xx |
| **P50 latency** | < 200ms | Median request latency |
| **P95 latency** | < 1,000ms | 95th percentile latency |
| **P99 latency** | < 5,000ms | 99th percentile latency |
| **Error rate** | < 1% | Rate of 5xx responses |

**Degradation definition:** API is "degraded" when error rate > 1% or p99 > 5,000ms.

**Unavailable definition:** API is "unavailable" when health check fails for > 1 minute.

### 3.3 External Adapters

External adapters are third-party services and are **not covered by TONBANKCARD SLA**.

| Adapter | Expected Availability | Fallback |
|---------|----------------------|---------|
| ChangeNOW | Third-party SLA applies | NOWPayments if available |
| NOWPayments | Third-party SLA applies | ChangeNOW if available |
| CoinRabbit | Third-party SLA applies | None (unique service) |

**When all adapters are unavailable:** Internal TBC-to-TBC operations continue unaffected. Only external crypto swaps and fiat ramps are unavailable.

---

## 4. Failure Handling Procedures

### 4.1 Indexer Failure

| Scenario | Detection | Response | Recovery Time Target |
|----------|-----------|----------|---------------------|
| Process crash | `indexer_up == 0` | Auto-restart via supervisor | < 2 minutes |
| Database corruption | Write errors + lag increase | Manual repair from backup | < 1 hour |
| Chain sync stuck | Lag > 5 minutes | Restart sync from latest checkpoint | < 15 minutes |
| Full reindex needed | Manual detection | Wipe DB, reindex from genesis | < 4 hours |

**Sync re-initialization procedure:**
```bash
# Stop indexer
systemctl stop tonbankcard-indexer

# Clear stale state (keeps DB schema)
npm run db:clear-events

# Restart from latest checkpoint
SYNC_FROM_BLOCK=latest systemctl start tonbankcard-indexer

# Monitor sync progress
journalctl -u tonbankcard-indexer -f | grep "Sync complete"
```

### 4.2 API Failure

| Scenario | Detection | Response | Recovery Time Target |
|----------|-----------|----------|---------------------|
| Process crash | Health check fails | Auto-restart via supervisor | < 2 minutes |
| Memory leak | High memory + slow responses | Graceful restart | < 5 minutes |
| Database connection lost | 5xx errors | Reconnect with backoff | < 1 minute (automatic) |
| Dependency (indexer) unavailable | 503 from indexer calls | Return degraded response | Immediate (soft dependency) |

### 4.3 External Adapter Failure

| Scenario | Response |
|----------|----------|
| Single adapter unavailable | Log WARN, continue with other adapters |
| All adapters unavailable | Log ERROR, return appropriate error to merchant, notify on-call |
| Adapter returning incorrect data | Log WARN, require on-chain verification before acting |

**Critical:** External adapter failures must never result in settlements being credited without on-chain confirmation.

---

## 5. Incident Classification

### 5.1 Severity Levels

| Severity | Definition | Response Time | Communication |
|----------|------------|---------------|---------------|
| **SEV-1 (Critical)** | Protocol paused, admin key suspected compromise, active exploit | < 15 minutes | Immediate public notice, all team notified |
| **SEV-2 (High)** | Complete off-chain service outage, confirmed vulnerability | < 1 hour | Public advisory within 12 hours |
| **SEV-3 (Medium)** | Significant degradation, single service unavailable | < 4 hours | Public update within 24 hours |
| **SEV-4 (Low)** | Minor degradation, slow sync, single adapter down | < 24 hours | No public notice required |

### 5.2 Escalation Path

```
On-call Engineer (detect)
       ↓ [if SEV-2+]
Engineering Lead (coordinate)
       ↓ [if SEV-1]
Security Lead + Protocol Team (all hands)
       ↓ [if funds at risk or invariant violation]
Legal + Communications (public statement)
```

### 5.3 Incident Response Steps

For any SEV-1 or SEV-2 incident:

1. **Detect** — Alert fires or user report received
2. **Acknowledge** — On-call confirms receipt within target time
3. **Assess** — Determine severity, scope, and root cause hypothesis
4. **Communicate** — Notify stakeholders per severity level
5. **Mitigate** — Implement immediate mitigation (restart, configuration change)
6. **Resolve** — Root cause fix and verification
7. **Post-Mortem** — Document timeline, root cause, and prevention measures

---

## 6. Maintenance Windows

### 6.1 Planned Maintenance

Off-chain services (indexer, API) may require planned maintenance for upgrades.

| Service | Maintenance Window | Maximum Duration | Frequency |
|---------|-------------------|-----------------|-----------|
| Indexer | Tuesdays 02:00–04:00 UTC | 2 hours | Monthly |
| Merchant API | Tuesdays 02:00–04:00 UTC | 2 hours | Monthly |

**Notice:** Planned maintenance must be announced at least 48 hours in advance in the protocol's communication channels.

**Smart contracts:** Smart contracts do not have maintenance windows — they are immutable.

### 6.2 Emergency Maintenance

If emergency maintenance is required outside the maintenance window:
- Notify all stakeholders as soon as possible (minimum 15 minutes notice)
- Post status update at start and end of maintenance
- Conduct post-mortem for any emergency maintenance event

---

## 7. SLA Exclusions

The following are explicitly excluded from SLA guarantees:

| Exclusion | Reason |
|-----------|--------|
| TON blockchain unavailability | Foundation layer, outside our control |
| External adapter downtime | Third-party services |
| Network-level attacks (DDoS) against infrastructure | Force majeure |
| Events caused by user error | Non-custodial responsibility |
| Changes required by regulatory order | Legal compliance |
| Force majeure events (natural disasters, etc.) | Uncontrollable |
| Security incidents requiring emergency maintenance | Safety takes priority over SLA |

---

## References

- **Monitoring:** [`docs/production/MONITORING.md`](MONITORING.md)
- **Incident Response:** [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md)
- **Governance Incident Response:** [`docs/governance/INCIDENT_RESPONSE.md`](../governance/INCIDENT_RESPONSE.md)
- **Architecture:** [`docs/architecture.md`](../architecture.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
