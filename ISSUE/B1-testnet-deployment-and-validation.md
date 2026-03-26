---
name: "[B1] Testnet Deployment & Validation"
about: Deploy all Phase 2 and Phase 4 contracts to TON testnet and run end-to-end integration tests
labels: type:backend
track: B
priority: high
---

## 1. Goal

Deploy all Phase 2 and Phase 4 smart contracts to TON testnet and validate end-to-end functionality against the deployed contracts, including all gateway adapters.

## 2. Context

Currently, all contracts exist in the repository as code but no live deployment exists. The testnet deployment is a prerequisite for A1/A2 audit preparation (auditors typically test against deployed testnet contracts) and a required step before mainnet deployment (B2).

The deployment scripts exist in `scripts/deploy/` and need to be validated against a live testnet environment.

Related to: [DEVELOPMENT_ROADMAP.md — Track B, B1](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Contracts to Deploy (Phase 2)
- `contracts/payments/PaymentHub.tact`
- `contracts/MerchantPaymentHub.tact`
- `contracts/payments/account-locks.fc`
- `contracts/nft-resolver/`
- `contracts/collateral-lookup/PublicCollateralLookup.tact`
- `contracts/governance/ProposalRegistry.tact`
- `contracts/governance/SnapshotVerifier.tact`
- `contracts/governance/TransparencyRegistry.tact`

### Contracts to Deploy (Phase 4 — testnet only, not mainnet until A2 audit)
- `contracts/CrossChainBridge.tact`
- `contracts/MultiSigCard.tact`
- `contracts/RecurringPayments.tact`
- `contracts/LendingProtocolCoordinator.tact`

### Services to Validate
- `backend/adapters/` — All gateway adapters against testnet sandbox endpoints
- `backend/indexer/` — Event indexing from testnet
- `api/` — Full invoice creation and settlement flow
- `sdk/` — SDK integration against testnet contracts

## 4. Out of Scope

- Mainnet deployment (covered by B2)
- Phase 4 mainnet deployment (requires A2 audit first)
- Gateway adapters for production API keys (use sandbox/testnet keys only)

## 5. Functional Requirements

1. All Phase 2 contracts deployed and initialized on TON testnet
2. Contract addresses recorded in `docs/existing-contracts.md` with testnet label
3. End-to-end payment flow working on testnet:
   - NFT card ownership verified by PaymentHub
   - Internal TBC transfer completed atomically
   - Merchant invoice created and settled via Merchant API
4. Gateway adapters validated against testnet/sandbox endpoints:
   - ChangeNOW sandbox mode
   - NOWPayments sandbox mode
   - CoinRabbit testnet

## 6. Non-Functional Requirements

- Deployment scripts must be idempotent (safe to re-run)
- All deployed contract addresses documented and committed to the repo
- Testnet deployment must pass CI integration tests
- Deployment must use multi-sig or equivalent (no single-key deployment for contract addresses that will be referenced in B2)

## 7. Security Requirements

- Testnet deployment keys must be separate from any mainnet keys
- Testnet keys stored in environment variables, never committed to the repo
- Phase 4 contracts deployed on testnet for testing ONLY — not to be treated as production-ready

## 8. Acceptance Criteria

- [ ] All Phase 2 contracts deployed to TON testnet
- [ ] Phase 4 contracts deployed to TON testnet (for testing only)
- [ ] `docs/existing-contracts.md` updated with all testnet contract addresses
- [ ] End-to-end integration test suite passes against testnet contracts
- [ ] All backend adapters validated against sandbox/testnet gateways
- [ ] Indexer correctly indexes testnet payment events
- [ ] Deployment script (`scripts/deploy/`) documented and validated

## 9. References

- [Deployment Scripts](../scripts/deploy/)
- [Existing Contracts](../docs/existing-contracts.md)
- [Architecture](../docs/architecture.md)
- [Backend Adapters](../backend/adapters/)
- TON Testnet: https://testnet.toncenter.com
