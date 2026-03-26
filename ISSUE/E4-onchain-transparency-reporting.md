---
name: "[E4] On-Chain Transparency Reporting"
about: Implement regular on-chain transparency reports via TransparencyRegistry and a public dashboard
labels: type:contract
track: E
priority: low
---

## 1. Goal

Implement a regular on-chain transparency reporting process using the `TransparencyRegistry` contract, build a transparency dashboard using the existing indexer infrastructure, and publish quarterly public transparency reports.

## 2. Context

The `TransparencyRegistry.tact` contract exists in the governance suite. Transparency reporting is a key mechanism for maintaining community trust in the protocol's operation — it demonstrates that no admin abuse is occurring, and provides protocol health metrics to the community.

Related to: [DEVELOPMENT_ROADMAP.md — Track E, E4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### On-Chain Transparency Events
- Define standardized event format for TransparencyRegistry:
  - Total active accounts (monthly snapshot)
  - Total TBC volume transferred (monthly)
  - Lock activity: number of FRAUD_LOCKs set, unlocked, appeal outcomes
  - Governance votes: proposals submitted, passed, failed
  - Protocol parameter changes

### Indexer Integration
- Extend `backend/indexer/` to index TransparencyRegistry events
- Expose transparency metrics via Merchant API or a dedicated public read endpoint

### Transparency Dashboard
- Public-facing dashboard showing:
  - Protocol health metrics (active accounts, transaction volume, lock events)
  - Governance activity (recent proposals and votes)
  - Audit status (linked to audit reports)

### Quarterly Reports
- Document template for quarterly transparency reports at `docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md`
- First report published within 30 days of mainnet deployment

## 4. Out of Scope

- Real-time dashboard (monthly snapshots are sufficient for v1)
- Private user analytics (privacy-preserving aggregate only)
- Marketing content in transparency reports

## 5. Functional Requirements

1. `TransparencyRegistry.tact` used to log protocol events (extend if necessary)
2. Indexer reads and stores transparency events from the registry
3. Public API endpoint: `GET /v1/transparency/metrics` returns aggregate protocol stats
4. Transparency dashboard deployed at `transparency.tonbankcard.com` (or similar)
5. Quarterly report template available in `docs/governance/`
6. First quarterly report published within 30 days of mainnet launch

## 6. Non-Functional Requirements

- Dashboard must not expose individual user data (aggregate only)
- Transparency events must be permanently stored on-chain (not deletable)
- Dashboard must be readable without login or authentication
- Report template must be usable by any team member (not depend on single author)

## 7. Security Requirements

- Only authorized parties (multi-sig per E3) can write transparency events to the registry
- Transparency event data must be accurate — publishing false data is a governance violation
- Dashboard must clearly label data as on-chain verified vs. indexer-derived

## 8. Acceptance Criteria

- [ ] E1 and E3 complete (prerequisites)
- [ ] TransparencyRegistry used to log all required event types
- [ ] Indexer extended to read and store transparency events
- [ ] Public transparency API endpoint implemented
- [ ] Transparency dashboard deployed and accessible
- [ ] `docs/governance/TRANSPARENCY_REPORT_TEMPLATE.md` created
- [ ] First quarterly transparency report published

## 9. References

- [Transparency Registry](../contracts/governance/TransparencyRegistry.tact)
- [Indexer](../backend/indexer/)
- [DAO Governance](../docs/dao-governance.md)
- Issue E1: [E1-dao-governance-activation.md](./E1-dao-governance-activation.md)
- Issue E3: [E3-risk-authority-decentralization.md](./E3-risk-authority-decentralization.md)
