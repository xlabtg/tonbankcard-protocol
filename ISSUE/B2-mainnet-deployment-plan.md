---
name: "[B2] Mainnet Deployment Plan"
about: Create deployment runbook and execute phased mainnet deployment of core contracts
labels: type:backend
track: B
priority: high
---

## 1. Goal

Define the mainnet deployment order, create a comprehensive deployment runbook, set up multi-sig deployment keys, and execute the phased mainnet deployment of Phase 2 core contracts after A1 audit completion.

## 2. Context

Mainnet deployment requires:
- A1 audit completed and all Critical/High findings remediated
- B1 testnet deployment validated
- Multi-sig deployer key setup (single-key deployment is unacceptable for mainnet)
- On-chain state verification after each deployment step

The deployment must follow the dependency order: NFT resolver → Payment Hub → Merchant Hub.

Related to: [DEVELOPMENT_ROADMAP.md — Track B, B2](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Deployment Order (dependency-driven)
1. `contracts/nft-resolver/` — Must be deployed first (dependency for PaymentHub)
2. `contracts/payments/PaymentHub.tact` — Core payment routing
3. `contracts/payments/account-locks.fc` — Account lock flags (initialized by PaymentHub)
4. `contracts/collateral-lookup/PublicCollateralLookup.tact`
5. `contracts/MerchantPaymentHub.tact` — Depends on PaymentHub address
6. Governance contracts (after Phase 2 contracts stable)

### Deployment Infrastructure
- Multi-sig deployer wallet setup
- Deployment verification scripts
- On-chain state checks post-deployment
- Immutability verification (confirm no upgrade paths)

## 4. Out of Scope

- Phase 4 contracts (CrossChainBridge, MultiSigCard, RecurringPayments, LendingCoordinator) — require A2 audit
- Testnet deployment (covered by B1)
- Production monitoring setup (covered by B3)

## 5. Functional Requirements

1. **Deployment runbook** at `scripts/deploy/MAINNET_RUNBOOK.md`:
   - Step-by-step deployment instructions
   - Required environment variables
   - Verification steps after each contract deployment
   - Rollback procedures (if possible given immutability)

2. **Multi-sig deployer setup**:
   - Minimum 2-of-3 multi-sig for deployer keys
   - Key holders documented (not key values)
   - Signing ceremony documented

3. **Post-deployment verification**:
   - Contract code hash verified against repository
   - Initial state (owner, whitelist, locks) verified
   - At least one test transaction executed on mainnet before public announcement
   - If D6 approves Acton for Tolk-based modules, include Acton verifier dry-run output where applicable; otherwise keep existing verification scripts authoritative

4. **Contract address registry**:
   - `docs/existing-contracts.md` updated with mainnet addresses
   - Addresses also published in `README.md` for discoverability

## 6. Non-Functional Requirements

- Deployment runbook must be executable by any team member (not dependent on single person)
- All steps must be logged and auditable
- No single point of failure in deployer key management
- Deployment idempotency: re-running safe steps must not create duplicate contracts

## 7. Security Requirements

- **Zero tolerance** for single-key mainnet deployment
- Deployer keys must use hardware wallets (Ledger or equivalent) for multi-sig signers
- No private keys committed to the repository or CI/CD environment at any point
- Immutability verification: confirm `set_code()` is not present in deployed contracts
- Post-deployment: verify deployer cannot move user funds (invariant I3)

## 8. Acceptance Criteria

- [ ] A1 audit completed (prerequisite)
- [ ] B1 testnet deployment validated (prerequisite)
- [ ] Multi-sig deployer wallet created with minimum 2-of-3 threshold
- [ ] Deployment runbook written at `scripts/deploy/MAINNET_RUNBOOK.md`
- [ ] All Phase 2 contracts deployed to TON mainnet in correct order
- [ ] On-chain state verified post-deployment for each contract
- [ ] Contract addresses published in `docs/existing-contracts.md` and `README.md`
- [ ] Immutability verification passed (no upgrade proxy, no `set_code()`)
- [ ] Test transaction executed on mainnet to verify end-to-end flow

## 9. References

- [Deployment Scripts](../scripts/deploy/)
- [Existing Contracts](../docs/existing-contracts.md)
- [Architecture](../docs/architecture.md)
- [Key Management](../docs/security/KEY_MANAGEMENT.md)
- Issue A1: [A1-formal-security-audit-core-contracts.md](./A1-formal-security-audit-core-contracts.md)
- Issue B1: [B1-testnet-deployment-and-validation.md](./B1-testnet-deployment-and-validation.md)
- Acton/Tolk tooling evaluation: [D6](./D6-acton-toolchain-evaluation.md)
