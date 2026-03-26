---
name: "[B3] Production Monitoring & Alerting"
about: Implement blockchain event monitoring, alerting, and operations dashboard for production
labels: type:backend
track: B
priority: medium
---

## 1. Goal

Implement production-grade monitoring and alerting for the deployed protocol, covering blockchain events, off-chain service health, and suspicious activity detection. Establish an on-call rotation and test incident response procedures.

## 2. Context

Once the protocol is deployed to mainnet (B2), the team needs observability into:
- Abnormal transaction volumes or patterns (potential exploits in progress)
- Off-chain service availability (indexer, API downtime)
- Critical events (large transfers, account lock activity, bridge events)

The incident response playbook exists at `docs/security/INCIDENT_RESPONSE.md` but needs a live monitoring system to trigger it.

Related to: [DEVELOPMENT_ROADMAP.md — Track B, B3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Blockchain Monitoring
- Block time monitoring (detect chain outages or congestion)
- Transaction failure rate monitoring on PaymentHub
- Large outgoing transfer alerts (threshold-based, e.g., > $10K equivalent in TBC)
- Account lock activity monitoring (FRAUD_LOCK, COLLATERAL_LOCK events)
- Bridge contract event monitoring (CrossChainBridge — after Phase 4 deployment)
- Governance event monitoring (proposals, votes, transparency reports)

### Off-Chain Service Monitoring
- Indexer service health (uptime, lag behind chain head)
- Merchant API response time and error rates
- Database health (SQLite/PostgreSQL connection and query time)
- Gateway adapter health (ChangeNOW, NOWPayments, CoinRabbit reachability)

### Dashboard
- Grafana or Datadog dashboard for indexer metrics
- Real-time transaction volume chart
- Active accounts counter
- Lock event timeline

## 4. Out of Scope

- Building new blockchain infrastructure (use existing TON HTTP API and indexer)
- Alerting for third-party gateway SLA (their responsibility)
- User-facing analytics (covered by F7)

## 5. Functional Requirements

1. **Alert rules** (PagerDuty or equivalent):
   - Indexer lag > 100 blocks: warning
   - Indexer lag > 500 blocks: critical (page on-call)
   - API error rate > 5% over 5 minutes: warning
   - API P99 latency > 2 seconds: warning
   - Unusual TBC volume (> 2x 24h average): critical
   - Any FRAUD_LOCK event: immediate notification
   - Any bridge event (CrossChainBridge) after Phase 4 deployment: immediate notification

2. **Incident response drill**:
   - Run one simulated incident drill using `docs/security/INCIDENT_RESPONSE.md`
   - Document drill results and update playbook if needed

3. **On-call rotation**:
   - Minimum 2 people on rotation
   - Documented in `docs/production/`

## 6. Non-Functional Requirements

- Monitoring system must not require private key access to blockchain data
- All metrics derived from read-only indexer queries (no direct contract calls)
- Alert notifications delivered within 2 minutes of threshold breach
- Dashboard accessible to team without exposing sensitive infrastructure

## 7. Security Requirements

- Monitoring credentials (API keys for PagerDuty, Grafana, etc.) stored in environment variables, never committed to the repo
- Alert channels (Slack, email) must use access controls (not public)
- Bridge event alerts must trigger a security review before any manual intervention

## 8. Acceptance Criteria

- [ ] At least one monitoring system deployed (Grafana or Datadog)
- [ ] All alert rules defined and tested in a staging environment
- [ ] On-call rotation documented in `docs/production/on-call.md`
- [ ] Incident response drill completed and playbook updated
- [ ] All alerts verified to fire correctly in a test scenario
- [ ] Dashboard accessible to all team members

## 9. References

- [Incident Response Playbook](../docs/security/INCIDENT_RESPONSE.md)
- [Production SLA](../docs/production/)
- [Indexer](../backend/indexer/)
- Issue B2: [B2-mainnet-deployment-plan.md](./B2-mainnet-deployment-plan.md)
