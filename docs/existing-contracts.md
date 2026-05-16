# Existing Contracts (TON)

## TBC Token
- Address: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`
- Explorer: [TONViewer](https://tonviewer.com/EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq?section=code)
- Status: Deployed, immutable
- Description: Internal settlement token for Tonbankcard protocol

## NFT Card Collections
### Series 7777000077770000
- Address: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
- Explorer: [TONViewer](https://tonviewer.com/EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le?section=code)
- Status: Deployed
- Description: NFT card collection representing account abstraction

### Series 8888000088880000
- Address: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`
- Explorer: [TONViewer](https://tonviewer.com/EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7?section=code)
- Status: Deployed
- Description: NFT card collection representing account abstraction

## Liquidity Pools
### TBC/TON
- DEX: TONCO
- Pool Address: `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M`
- Explorer: [TONViewer](https://tonviewer.com/EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M?section=code)
- App: [TONCO DEX](https://app.tonco.io/#/explore/pools/EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M)
- Status: Active
- Description: Liquidity pool for TBC/TON trading pair

## External Integrations
### Payment Gateways
- ChangeNOW: External swap and payment gateway
- NOWPayments: Crypto payment processing
- CoinRabbit: Collateral-based lending platform

### TON Ecosystem
- TON Connect: [Documentation](https://docs.ton.org/ecosystem/ton-connect/overview)
- TONCO DEX: Primary liquidity provider for TBC token

## Protocol Contracts (TON Mainnet)

> **Status:** Awaiting B2 mainnet ceremony — engagement [B2](deployments/B2-mainnet/ENGAGEMENT.md) gates G-1 … G-10 must close before any address is published here.
>
> Addresses below are **placeholders** (`TBD`) and will be updated **atomically** in a single PR alongside the manifest commit, per [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3.4. Manifests are append-only; corrections add a new manifest with `supersedes` set, never edit an entry in place ([`ROLLBACK_PROCEDURES.md`](deployments/B2-mainnet/ROLLBACK_PROCEDURES.md) §3).

### Payment-block contracts (deterministic deploy order)

| # | Contract | Source | Address | Code hash | Deploy tx | Manifest |
|---|----------|--------|---------|-----------|-----------|----------|
| 1 | `AccountLocks` | `contracts/payments/account-locks.fc` | `TBD` | `TBD` | `TBD` | `TBD` |
| 2 | `NFTAccountResolver` | `contracts/nft-resolver/nft_account_resolver.tact` | `TBD` | `TBD` | `TBD` | `TBD` |
| 3 | `AccountStateMachine` | `contracts/payment-hub/account-state.tact` | `TBD` | `TBD` | `TBD` | `TBD` |
| 4 | `PaymentHub` | `contracts/payments/PaymentHub.tact` | `TBD` | `TBD` | `TBD` | `TBD` |
| 5 | `MerchantPaymentHub` | `contracts/MerchantPaymentHub.tact` | `TBD` | `TBD` | `TBD` | `TBD` |
| 6 | `CollateralSignal` | `contracts/CollateralSignal.tact` | `TBD` | `TBD` | `TBD` | `TBD` |
| 7 | `PublicCollateralLookup` | `contracts/collateral-lookup/PublicCollateralLookup.tact` | `TBD` | `TBD` | `TBD` | `TBD` |

### Governance group (deployed inert; activated after 7-day soak)

| # | Contract | Source | Address | Activated | Manifest |
|---|----------|--------|---------|-----------|----------|
| 8 | `ProposalRegistry` | `contracts/governance/ProposalRegistry.tact` | `TBD` | `no` | `TBD` |
| 9 | `SnapshotVerifier` | `contracts/governance/SnapshotVerifier.tact` | `TBD` | `no` | `TBD` |
| 10 | `TransparencyRegistry` | `contracts/governance/TransparencyRegistry.tact` | `TBD` | `no` | `TBD` |

The `activated` flag flips to `yes` only after the 7-day soak window completes per [`DEPLOYMENT_PLAN.md`](deployments/B2-mainnet/DEPLOYMENT_PLAN.md) §3.2.

### Immutability & non-custody guarantees

Every contract in this section is deployed under the **strong immutability** posture documented in [`IMMUTABILITY_VERIFICATION.md`](deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md):

- No `set_code()` primitive in the source.
- No `SETCODE` opcode in the compiled cell.
- No admin-controlled `code` / `pending_code` field in persistent state.
- No `adminWithdraw`, `emergencyDrain`, or `forcedTransfer` function.

Compliance with protocol invariants I3 ("No Admin Fund Control") and I7 ("Account Locks") is attested by **two independent reviewers** before any address is filled in above.
