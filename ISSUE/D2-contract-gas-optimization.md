---
name: "[D2] Contract Gas Optimization"
about: Profile and optimize gas usage for high-frequency contract operations
labels: type:contract
track: D
priority: medium
---

## 1. Goal

Profile gas consumption for all common protocol operations, optimize the highest-cost paths in `PaymentHub.tact`, and document gas costs per operation as part of the protocol specification.

## 2. Context

TON gas costs directly affect user experience (higher gas = higher fees for users) and protocol reliability (insufficient gas can cause transaction failures). The protocol performs high-frequency operations (internal transfers, NFT resolution, lock checks) that must be optimized for production viability.

No gas profiling has been performed yet. Optimization should happen before mainnet deployment (B2) to avoid deploying unoptimized immutable contracts.

Related to: [DEVELOPMENT_ROADMAP.md — Track D, D2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Gas Profiling
- All operations in `contracts/payments/PaymentHub.tact`:
  - Internal TBC transfer
  - Lock set (FRAUD_LOCK, COLLATERAL_LOCK)
  - Lock unset
  - NFT whitelist verification
- `contracts/MerchantPaymentHub.tact`:
  - Invoice settlement
- `contracts/nft-resolver/`:
  - NFT ownership resolution

### Optimization Targets
- High-frequency path: internal transfer in `PaymentHub.tact`
- NFT resolution call chain (reduces latency and gas for every payment)
- Lock check logic in `account-locks.fc`

### Documentation
- Gas cost table per operation in `docs/gas-costs.md`
- Gas budget targets per operation (maximum acceptable gas)
- Comparison before/after optimization

## 4. Out of Scope

- Optimization of Phase 4 contracts (requires A2 audit first)
- Changes to protocol semantics or invariants to save gas
- Off-chain service performance (covered by B3)

## 5. Functional Requirements

1. Gas profiling tool set up (using `@ton/sandbox` gas measurement or `blueprint` profiling)
2. Baseline gas measurements for all operations documented
3. Optimization PRs submitted for operations > 20% above target budget
4. All existing tests still pass after optimization
5. Gas cost documentation added to `docs/gas-costs.md`

## 6. Non-Functional Requirements

- Gas optimization must not change observable contract behavior
- All optimizations must maintain protocol invariants I1–I7
- Gas budget targets must be realistic for TON mainnet conditions (not just sandbox estimates)
- Optimized contracts must pass all existing tests

## 7. Security Requirements

- Any gas optimization that changes contract logic must be reviewed by at least one other developer
- Optimizations must not introduce new attack surfaces (e.g., removing bounds checks to save gas is not acceptable)
- Optimized contracts must be re-submitted for audit review if they change the code audited in A1

## 8. Acceptance Criteria

- [ ] Gas profiling script created in `scripts/gas-profile/`
- [ ] Baseline gas measurements documented for all in-scope operations
- [ ] `docs/gas-costs.md` created with operation → gas cost table
- [ ] At least one optimization implemented for the highest-cost path
- [ ] All existing tests pass after optimization
- [ ] Gas budget targets defined and documented

## 9. References

- [Contracts](../contracts/)
- [Architecture](../docs/architecture.md)
- [Tests — Payments](../tests/payments/)
- @ton/sandbox gas profiling utilities
- TON gas documentation: https://docs.ton.org/develop/smart-contracts/fees
