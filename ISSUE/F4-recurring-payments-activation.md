---
name: "[F4] Recurring Payments Activation"
about: Production readiness spec and merchant dashboard integration for RecurringPayments.tact
labels: type:contract
track: F
priority: low
---

## 1. Goal

Define the production specification for `RecurringPayments.tact`, integrate subscription management into the merchant dashboard, build user notifications for upcoming payments, and implement cancel/pause/resume subscription UX.

## 2. Context

`RecurringPayments.tact` exists as Phase 4 implementation code and is not yet audited or deployed. Once the A2 audit is complete, the contract can be deployed, but the merchant-facing and user-facing experience still needs to be built on top of it.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Production Specification
- Define subscription tier formats: billing period (daily/weekly/monthly/annual), amount, currency
- Define payment schedule: how `RecurringPayments.tact` determines when to trigger
- Define grace period: time after missed payment before subscription cancels
- Document in `docs/recurring-payments/SPECIFICATION.md`

### Merchant Dashboard Integration (`dashboard/`)
- New section: Subscriptions
  - View active subscriptions (subscriber address, plan, next billing date)
  - Create subscription plans
  - Cancel subscriptions
  - View subscription revenue analytics

### User Notifications
- Upcoming payment notification (3 days before next billing)
- Notification channels: push (if mobile app) or email
- User must be able to opt-in/opt-out of notifications

### Subscription Management UX (`wallet-ui/`)
- Cancel subscription from wallet UI
- Pause subscription (if supported by contract)
- Resume paused subscription
- View subscription history

## 4. Out of Scope

- Changes to `RecurringPayments.tact` contract logic (only integration work, not contract changes)
- Fiat currency subscriptions (TBC-denominated only)
- Free trial management

## 5. Functional Requirements

1. Merchant can create a subscription plan with: amount, billing period, description
2. User can subscribe to a plan from their wallet UI
3. `RecurringPayments.tact` automatically processes payments on schedule
4. User receives notification 3 days before each billing
5. User can cancel their subscription at any time before the next billing date
6. Merchant dashboard shows subscription MRR (Monthly Recurring Revenue) metric

## 6. Non-Functional Requirements

- Subscription plan creation: < 5 seconds end-to-end
- Payment processing: automatic, no user action required after initial subscription
- Cancellation: effective before the next billing cycle

## 7. Security Requirements

- A2 audit must be complete before production deployment of `RecurringPayments.tact`
- User must confirm subscription authorization via TON Connect on initial subscribe
- Cancel/pause must require user signature (not callable by merchant unilaterally)
- No recurring payment should exceed the user's authorized amount

## 8. Acceptance Criteria

- [ ] A2 audit complete (strict prerequisite)
- [ ] `docs/recurring-payments/SPECIFICATION.md` written
- [ ] `RecurringPayments.tact` deployed to testnet
- [ ] Merchant dashboard subscription section implemented
- [ ] User cancel/pause/resume UX implemented in `wallet-ui/`
- [ ] User notification system implemented
- [ ] End-to-end subscription flow tested on testnet
- [ ] All dashboard and wallet-ui tests pass (47 and 28 tests respectively)

## 9. References

- [RecurringPayments.tact](../contracts/RecurringPayments.tact)
- [Merchant Dashboard](../dashboard/)
- [Wallet UI](../wallet-ui/)
- Issue A2: [A2-formal-security-audit-phase4-contracts.md](./A2-formal-security-audit-phase4-contracts.md)
