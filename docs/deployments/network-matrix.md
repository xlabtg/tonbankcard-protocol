# TONBANKCARD Network Deployment Matrix

**Version:** v1.0.0
**Status:** FROZEN
**Last Updated:** 2025-01
**Purpose:** Canonical registry of all deployed TONBANKCARD protocol contracts

---

## Overview

This document serves as the **single, authoritative, immutable registry** of all TONBANKCARD protocol deployments across networks.

### Trust Model

> **IMPORTANT:** This matrix is **informational only**. It does NOT:
> - Introduce authority
> - Act as a source of execution truth
> - Replace on-chain verification
>
> The blockchain remains the **single source of truth**. Any consumer MUST independently verify addresses on-chain.

### Immutability Rules

- This matrix is **append-only**
- Existing records MUST NOT be modified or removed
- Corrections MUST be added as new entries with explicit supersession notes
- No dynamic or programmatic mutation allowed

---

## TON Mainnet

**Chain ID:** -239
**Environment:** Mainnet
**Network:** TON Mainnet
**Block Explorer:** https://tonviewer.com

### Core Protocol

#### TBC Token (Jetton)

| Field | Value |
|-------|-------|
| **Contract Name** | TBC Token |
| **Contract Purpose** | Internal settlement token for TONBANKCARD protocol |
| **Network** | TON Mainnet |
| **Contract Address** | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` |
| **Protocol Version** | v1.0.0 |
| **Source File Path(s)** | `contracts/token/` (external, pre-deployed) |
| **Compiler & Version** | FunC (standard Jetton) |
| **Deployment Transaction Hash** | *Pre-existing deployment* |
| **Bytecode Hash** | Verify on-chain |
| **Frozen Status** | `FROZEN` |
| **Notes** | Immutable, standard TON Jetton implementation |

**Explorer Link:** [TONViewer](https://tonviewer.com/EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq?section=code)

---

#### NFT Account Collection — Series 7777000077770000

| Field | Value |
|-------|-------|
| **Contract Name** | NFT Account Collection (Series 7777) |
| **Contract Purpose** | NFT cards representing account abstraction for TONBANKCARD |
| **Network** | TON Mainnet |
| **Contract Address** | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` |
| **Protocol Version** | v1.0.0 |
| **Source File Path(s)** | `contracts/nft-cards/` (external, pre-deployed) |
| **Compiler & Version** | FunC (standard NFT) |
| **Deployment Transaction Hash** | *Pre-existing deployment* |
| **Bytecode Hash** | Verify on-chain |
| **Frozen Status** | `FROZEN` |
| **Notes** | Each NFT represents a unique TONBANKCARD account |

**Explorer Link:** [TONViewer](https://tonviewer.com/EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le?section=code)

---

#### NFT Account Collection — Series 8888000088880000

| Field | Value |
|-------|-------|
| **Contract Name** | NFT Account Collection (Series 8888) |
| **Contract Purpose** | NFT cards representing account abstraction for TONBANKCARD |
| **Network** | TON Mainnet |
| **Contract Address** | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` |
| **Protocol Version** | v1.0.0 |
| **Source File Path(s)** | `contracts/nft-cards/` (external, pre-deployed) |
| **Compiler & Version** | FunC (standard NFT) |
| **Deployment Transaction Hash** | *Pre-existing deployment* |
| **Bytecode Hash** | Verify on-chain |
| **Frozen Status** | `FROZEN` |
| **Notes** | Each NFT represents a unique TONBANKCARD account |

**Explorer Link:** [TONViewer](https://tonviewer.com/EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7?section=code)

---

### Governance

#### TBC Diamonds (Governance NFT Collection)

| Field | Value |
|-------|-------|
| **Contract Name** | TBC Diamonds |
| **Contract Purpose** | Governance participation NFT collection (non-executive, non-custodial) |
| **Network** | TON Mainnet |
| **Contract Address** | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` |
| **Protocol Version** | Governance v1 |
| **Source File Path(s)** | External (standard NFT) |
| **Compiler & Version** | FunC (standard NFT) |
| **Deployment Transaction Hash** | *Pre-existing deployment* |
| **Bytecode Hash** | Verify on-chain |
| **Frozen Status** | `FROZEN` |
| **Notes** | Fixed supply of 222 NFTs. No minting or burn functionality. |

**Explorer Link:** [TONViewer](https://tonviewer.com/EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU?section=code)

---

### Supporting Infrastructure

#### TBC/TON Liquidity Pool (TONCO DEX)

| Field | Value |
|-------|-------|
| **Contract Name** | TBC/TON Liquidity Pool |
| **Contract Purpose** | DEX liquidity pool for TBC/TON trading pair |
| **Network** | TON Mainnet |
| **Contract Address** | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` |
| **Protocol Version** | External (TONCO) |
| **Source File Path(s)** | External (TONCO DEX) |
| **Compiler & Version** | External |
| **Deployment Transaction Hash** | External |
| **Bytecode Hash** | External |
| **Frozen Status** | `NOT FROZEN` (external, managed by TONCO) |
| **Notes** | External integration. Primary liquidity provider for TBC token. |

**Explorer Link:** [TONViewer](https://tonviewer.com/EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M?section=code)
**App Link:** [TONCO DEX](https://app.tonco.io/#/explore/pools/EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M)

---

## TON Testnet

**Chain ID:** -3
**Environment:** Testnet
**Network:** TON Testnet
**Block Explorer:** https://testnet.tonviewer.com

### Core Protocol

> **Note:** No testnet deployments have been registered at this time.
>
> Future testnet deployments of Payment Hub, Merchant Payment Hub, NFT Account Resolver, and other protocol contracts will be documented here once deployed.

---

## Protocol Contracts (Awaiting B2 Mainnet Ceremony)

The following contracts are specified in the protocol, audited under [A1-core-contracts](../security/audits/A1-core-contracts/ENGAGEMENT.md), and validated on testnet under [B1-testnet](B1-testnet/ENGAGEMENT.md). They are scheduled for mainnet deployment under engagement [B2-mainnet](B2-mainnet/ENGAGEMENT.md).

**Addresses are not yet populated.** They will be added in a single atomic PR alongside the manifest commit at kickoff, per [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](B2-mainnet/MULTISIG_CEREMONY.md) §3.4. Until the ceremony completes, every row below carries `TBD`.

> **Append-only contract.** Once an address is populated, it is **never** edited in place. Roll-backs are expressed via a new manifest with `supersedes` and a `paused = true` flag on the prior one, per [`ROLLBACK_PROCEDURES.md`](B2-mainnet/ROLLBACK_PROCEDURES.md) §3.

### Payment-block contracts (deterministic deploy order)

#### 1. AccountLocks

| Field | Value |
|-------|-------|
| **Contract Name** | AccountLocks |
| **Contract Purpose** | Risk-authority gated transfer-out blocking on a per-account basis (invariant I7) |
| **Source File Path(s)** | `contracts/payments/account-locks.fc` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` (will be `deployments/mainnet/<timestamp>.json`) |
| **Notes** | First contract in the deterministic deploy order; downstream contracts wire its address into init |

---

#### 2. NFTAccountResolver

| Field | Value |
|-------|-------|
| **Contract Name** | NFTAccountResolver |
| **Contract Purpose** | NFT ownership → account-address resolution for cards in Series 7777 & 8888 |
| **Source File Path(s)** | `contracts/nft-resolver/nft_account_resolver.tact`, `contracts/nft-resolver/nft_account_resolver.fc` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Wires the mainnet TBC and NFT collection addresses (§ "Core Protocol" above) into init |

---

#### 3. AccountStateMachine

| Field | Value |
|-------|-------|
| **Contract Name** | AccountStateMachine |
| **Contract Purpose** | Account-state transitions (ACTIVE → FROZEN → COLLATERAL_LOCKED → CLOSED) |
| **Source File Path(s)** | `contracts/payment-hub/account-state.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Reads `account_locks` upstream address from row 1 |

---

#### 4. PaymentHub

| Field | Value |
|-------|-------|
| **Contract Name** | PaymentHub |
| **Contract Purpose** | Core payment routing, NFT-bound account dispatch, internal TBC transfer settlement |
| **Source File Path(s)** | `contracts/payments/PaymentHub.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Reads `nft_account_resolver`, `account_state_machine`, `account_locks` from rows 1–3 |

---

#### 5. MerchantPaymentHub

| Field | Value |
|-------|-------|
| **Contract Name** | MerchantPaymentHub |
| **Contract Purpose** | Merchant-facing settlement in TBC; no custody of merchant funds |
| **Source File Path(s)** | `contracts/MerchantPaymentHub.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Reads `payment_hub` upstream address from row 4 |

---

#### 6. CollateralSignal

| Field | Value |
|-------|-------|
| **Contract Name** | CollateralSignal |
| **Contract Purpose** | Pure signaling layer for external lending; no custody or fund control |
| **Source File Path(s)** | `contracts/CollateralSignal.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Reads `nft_account_resolver` upstream address from row 2 |

---

#### 7. PublicCollateralLookup

| Field | Value |
|-------|-------|
| **Contract Name** | PublicCollateralLookup |
| **Contract Purpose** | Read-only on-chain lookup over the collateral signaling state |
| **Source File Path(s)** | `contracts/collateral-lookup/PublicCollateralLookup.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Bytecode Hash** | `TBD` |
| **Deployment Transaction Hash** | `TBD` |
| **Manifest Filename** | `TBD` |
| **Notes** | Reads `collateral_signal` upstream address from row 6 |

---

### Governance group (deployed inert; activated after 7-day soak)

The three governance contracts below are deployed during the same ceremony but **deliberately inert**. The `activated` flag flips to `yes` only after the 7-day soak window completes and the verification reviewer signs off in [`STATUS.md`](B2-mainnet/STATUS.md) §8, per [`DEPLOYMENT_PLAN.md`](B2-mainnet/DEPLOYMENT_PLAN.md) §3.2.

#### 8. ProposalRegistry

| Field | Value |
|-------|-------|
| **Contract Name** | ProposalRegistry |
| **Contract Purpose** | Governance proposal lifecycle anchor (non-custodial) |
| **Source File Path(s)** | `contracts/governance/ProposalRegistry.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Activated** | `no` (initial) |
| **Notes** | No fund-moving authority by design (invariant I3) |

---

#### 9. SnapshotVerifier

| Field | Value |
|-------|-------|
| **Contract Name** | SnapshotVerifier |
| **Contract Purpose** | TBC Diamonds NFT-ownership snapshot verification |
| **Source File Path(s)** | `contracts/governance/SnapshotVerifier.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Activated** | `no` (initial) |
| **Notes** | Pairs with the TBC Diamonds collection in § Governance above |

---

#### 10. TransparencyRegistry

| Field | Value |
|-------|-------|
| **Contract Name** | TransparencyRegistry |
| **Contract Purpose** | Anchor for documentation hashes and disclosures |
| **Source File Path(s)** | `contracts/governance/TransparencyRegistry.tact` |
| **Deployment Status** | **AWAITING B2 CEREMONY** |
| **Contract Address** | `TBD` |
| **Activated** | `no` (initial) |
| **Notes** | Off-chain consumers must treat this contract as informational only |

---

## Version History

| Date | Version | Author | Change Description |
|------|---------|--------|-------------------|
| 2025-01 | v1.0.0 | TONBANKCARD Protocol | Initial deployment matrix publication |

---

## Verification Guide

### For Auditors

To verify any deployment:

1. **Obtain the contract address** from this matrix
2. **Navigate to TONViewer** using the explorer link
3. **Verify bytecode** matches expected implementation
4. **Check deployment transaction** for original deployer
5. **Cross-reference** with protocol source files

### For Integrators

Before integrating:

1. **Always verify addresses on-chain** — do not trust this document alone
2. **Check freeze status** to understand mutability expectations
3. **Review protocol version** for compatibility
4. **Consult the source files** listed for implementation details

### For Indexers

When indexing protocol events:

1. Use the addresses listed under each network section
2. Filter transactions by contract addresses
3. Parse events according to contract specifications
4. Handle chain reorgs appropriately

---

## Security & Audit Notes

- All deployed contract addresses can be traced to source code via the file paths listed
- Bytecode hashes should be verified independently on-chain
- `FROZEN` status indicates the contract code is immutable
- `NOT FROZEN` status indicates the contract may be upgraded (external dependencies only)

---

## Appendix: Address Format Reference

All addresses in this document use the TON base64url-encoded format (EQ prefix for workchain 0).

**Validation:**
- Addresses are 48 characters long (including prefix)
- Format: `EQ` + 46 base64url characters
- Can be verified using any TON address validator

---

## Disclaimer

This deployment matrix is a **transparency artifact**, not a control mechanism.

The TONBANKCARD protocol:
- Remains non-custodial
- Has no admin controls over user funds
- Relies solely on NFT ownership for account authority

> **Code is law. This matrix is commentary.**
