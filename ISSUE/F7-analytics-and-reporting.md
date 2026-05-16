---
name: "[F7] Analytics & Reporting"
about: Build merchant analytics, protocol-level analytics, and a public analytics dashboard
labels: type:backend
track: F
priority: low
---

## 1. Goal

Build an analytics layer on top of the payment indexer providing merchant-specific payment analytics (volume, conversion rates, chargebacks) and protocol-level analytics (total value transferred, active accounts, lock events), accessible via a public analytics dashboard.

## 2. Context

The payment indexer already captures all payment events on-chain. An analytics layer would transform this raw event data into actionable insights for merchants and the community. This is a value-add for merchant adoption (merchants can see their performance) and community transparency (public can see protocol health).

This should be built after the protocol is live in production and has meaningful transaction volume.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F7](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Merchant Analytics (authenticated)
- Payment volume: total TBC received per time period
- Transaction count: number of successful payments
- Conversion rate: paid invoices / total invoices created
- Average payment amount
- Top paying customer addresses (anonymized)
- Chargeback/lock rate: invoices with associated FRAUD_LOCK events
- Revenue trend: chart over last 30/90/365 days

### Protocol-Level Analytics (public, aggregate)
- Total value transferred (all-time, 30d, 7d)
- Active accounts (accounts with at least one transaction in the period)
- Lock events: FRAUD_LOCK and COLLATERAL_LOCK counts
- Total invoices created vs. settled
- DEX swap volume

### Public Analytics Dashboard
- Publicly accessible at `stats.tonbankcard.com` (or equivalent)
- Privacy-preserving: aggregate data only, no individual user tracking
- Real-time refresh: data updated every 10 minutes

## 4. Out of Scope

- Individual user transaction history in the public dashboard (privacy)
- Fiat value equivalents (requires price oracle — out of scope for v1)
- Advertising or tracking pixels

## 5. Functional Requirements

1. Analytics API endpoints:
   - `GET /v1/analytics/merchant` (authenticated) — returns merchant analytics
   - `GET /v1/analytics/protocol` (public) — returns protocol-level stats
2. Merchant analytics dashboards integrated into `dashboard/`
3. Public analytics site deployed and accessible
4. Data refreshed at least every 10 minutes
5. All data sourced from indexer (no direct RPC calls to blockchain)

## 6. Non-Functional Requirements

- Analytics queries must not degrade the main API performance (separate read replica or caching)
- Data retention: analytics aggregates kept for 3 years minimum
- Dashboard must load in < 2 seconds on broadband
- Analytics must be privacy-preserving: no individual wallet addresses in public dashboard

## 7. Security Requirements

- Merchant analytics must be scoped to the authenticated merchant's own data
- One merchant must not be able to query another merchant's analytics (IDOR prevention)
- Rate limiting on analytics endpoints (same as D4)
- No PII in analytics data

## 8. Acceptance Criteria

- [ ] B3 (production monitoring) complete (prerequisite — provides the data foundation)
- [ ] Analytics API endpoints implemented
- [ ] Merchant analytics section added to `dashboard/`
- [ ] Public analytics dashboard deployed
- [ ] All analytics sourced from indexer (not direct blockchain queries)
- [ ] Merchant analytics IDOR protection tested
- [ ] Public dashboard shows accurate protocol stats

## 9. References

- [Indexer](../backend/indexer/)
- [Merchant Dashboard](../dashboard/)
- [Merchant API](../api/)
- [Architecture](../docs/architecture.md)
- Issue B3: [B3-production-monitoring-and-alerting.md](./B3-production-monitoring-and-alerting.md)
- Issue D4: [D4-rate-limiting-ddos-protection.md](./D4-rate-limiting-ddos-protection.md)
