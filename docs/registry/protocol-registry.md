# TONBANKCARD Public Protocol Registry

**Version:** v1.0.0
**Registry Status:** ACTIVE
**Last Updated:** 2025-01
**Document Type:** Public Protocol Registry (Read-Only, Verifiable, Canonical)

---

## Purpose

This registry serves as the **single public, canonical reference** for the current state of the TONBANKCARD protocol in a human- and machine-readable form.

The registry answers, unambiguously:

- What version of the protocol exists?
- What is deployed and where?
- What is frozen?
- What is governed?
- What is audited?

---

## Trust Model

> **IMPORTANT:** This registry is a **map, not the territory**.

- This registry is **non-authoritative** and **read-only**
- The **blockchain** remains the single source of truth
- Consumers **MUST** verify addresses independently on-chain
- This registry exists to reduce ambiguity, not replace verification
- No executable logic is introduced by this registry

---

## 1. Protocol Identity

| Property | Value |
|----------|-------|
| **Protocol Name** | TONBANKCARD |
| **Short Description** | Non-custodial virtual bank protocol built on TON blockchain |
| **Canonical Repository** | [https://github.com/xlabtg/tonbankcard-protocol](https://github.com/xlabtg/tonbankcard-protocol) |
| **Official Documentation** | [docs/](../README.md) |
| **Architecture Reference** | [docs/architecture.md](../architecture.md) |
| **Invariants Reference** | [docs/invariants.md](../invariants.md) |
| **Threat Model Reference** | [docs/threat-model.md](../threat-model.md) |

### Core Principles

1. **User Sovereignty**: No admin controls over user funds
2. **On-Chain Truth**: Blockchain as single source of truth
3. **Maximum Decentralization**: Immutable smart contracts
4. **Transparency**: All operations auditable on-chain

---

## 2. Protocol Version

| Property | Value |
|----------|-------|
| **Current Protocol Version** | `v1.0.0` |
| **Version Status** | `ACTIVE` |
| **Release Date** | 2025-01 |
| **Versioning Policy** | [docs/versioning-policy.md](../versioning-policy.md) |
| **Version Notes** | Initial protocol release |

### Versioning Model

TONBANKCARD uses semantic versioning: `MAJOR.MINOR.PATCH`

| Component | When to Increment |
|-----------|------------------|
| **MAJOR** | Breaking changes, new security model, fundamental architecture changes |
| **MINOR** | New features, additional contracts, non-breaking extensions |
| **PATCH** | Documentation updates, tooling improvements, non-contract changes |

### Protocol Version Scope

A protocol version applies to:

- **Contract set**: All smart contracts in the release
- **Invariants**: Security guarantees
- **Security assumptions**: Trust boundaries and threat model
- **Interfaces**: Public API contracts between components

---

## 3. Deployment Summary

### Deployment Matrix Reference

Full deployment details: [docs/deployments/network-matrix.md](../deployments/network-matrix.md)

### Active Mainnet Deployments

| Contract | Address | Status |
|----------|---------|--------|
| **TBC Token** | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | FROZEN |
| **NFT Collection (Series 7777)** | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | FROZEN |
| **NFT Collection (Series 8888)** | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | FROZEN |
| **TBC Diamonds (Governance)** | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` | FROZEN |

### External Infrastructure (Not Frozen)

| Contract | Address | Provider | Status |
|----------|---------|----------|--------|
| **TBC/TON Liquidity Pool** | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` | TONCO DEX | NOT FROZEN (external) |

### Active Testnet Deployments

| Contract | Address | Status |
|----------|---------|--------|
| *No testnet deployments registered* | — | — |

### Pending Deployments

The following contracts are implemented but not yet deployed:

- Payment Hub (`contracts/payments/PaymentHub.tact`)
- Merchant Payment Hub (`contracts/MerchantPaymentHub.tact`)
- NFT Account Resolver (`contracts/nft-resolver/`)
- Account State Machine (`contracts/payment-hub/account-state.tact`)
- Collateral Signal Contract (`contracts/CollateralSignal.tact`)

---

## 4. Governance State

| Property | Value |
|----------|-------|
| **Governance Version** | `v1` |
| **Governance Status** | `FROZEN` |
| **Governance Asset** | TBC Diamonds NFT |
| **Asset Supply** | 222 (fixed, immutable) |
| **Asset Contract** | `EQAtTkI7c4iEJJr3oIdKWY3egjOoGPFu1ynj3a33nDqMF-aU` |
| **Voting Power** | 1 NFT = 1 vote |
| **Governance Release Notes** | [docs/governance/release-notes-v1.md](../governance/release-notes-v1.md) |

### Governance Powers (Explicitly Limited)

Governance v1 holders **CAN**:

- Submit proposals
- Vote on proposals
- Publish recommendations
- Express social consensus
- Request audits or reviews
- Signal protocol direction

Governance v1 holders **CANNOT**:

- Execute transactions
- Modify smart contracts
- Pause or freeze the protocol
- Control funds
- Override protocol invariants
- Force upgrades or migrations

> **Code is law. Governance is commentary.**

### Governance Properties

- **Non-Executive**: No on-chain execution authority
- **Non-Custodial**: No fund control
- **Advisory Only**: Recommendations are informational
- **Frozen**: No implicit governance upgrades permitted

---

## 5. Audit Status

| Property | Value |
|----------|-------|
| **Audit Readiness Status** | `READY` |
| **Audit Scope Reference** | [docs/audit-scope.md](../audit-scope.md) |
| **Freeze Date** | 2025-12-29 |
| **Freeze Commit** | `4027b9d` |
| **Freeze Status** | FROZEN |
| **External Audit Firm** | Not yet selected |
| **Audit Engagement** | Pending |

### Contracts Under Audit Scope

| Contract | Priority | Status |
|----------|----------|--------|
| MerchantPaymentHub.tact | CRITICAL | Frozen |
| PaymentHub.tact | CRITICAL | Frozen |
| nft_account_resolver.fc | CRITICAL | Frozen |
| nft_account_resolver.tact | CRITICAL | Frozen |
| account-state.tact | CRITICAL | Frozen |
| account-locks.fc | HIGH | Frozen |
| Type definitions | MEDIUM | Frozen |
| Interfaces | MEDIUM | Frozen |

### Audit Checklist Status

- [x] Audit scope explicitly defined
- [x] All in-scope contracts frozen
- [x] Invariants documented
- [x] Threat model documented
- [x] Tests cover critical paths
- [ ] External audit firm selected
- [ ] Audit engagement started
- [ ] Draft report received
- [ ] All Critical findings resolved
- [ ] Final audit report published

### Invariants Reference

Full invariants documentation: [docs/invariants.md](../invariants.md)

Key protocol invariants:

1. **I1 — Non-Custodial Ownership**: Only NFT owners can authorize transactions
2. **I2 — NFT Ownership Finality**: Ownership checked at execution, not signing time
3. **I3 — No Admin Fund Control**: No admin/operator can move user funds
4. **I4 — Atomic Transfers**: All transfers are atomic (all-or-nothing)
5. **I5 — Balance Conservation**: Sum of all balances is constant
6. **I6 — Lock Enforcement**: Locks prevent sending, allow receiving

---

## 6. Integration Surface

### External Guarantees Reference

Full guarantees documentation: [docs/integrations/external-guarantees.md](../integrations/external-guarantees.md)

### Merchant API

| Property | Value |
|----------|-------|
| **Status** | `SPECIFICATION` |
| **Specification** | [docs/merchant-api-spec.md](../merchant-api-spec.md) |
| **Security Model** | [docs/merchant-api-security.md](../merchant-api-security.md) |
| **Implementation** | Pending |

### SDK Availability

| SDK | Status | Repository |
|-----|--------|------------|
| **Merchant SDK** | `SPECIFICATION` | [sdk/README.md](../../sdk/README.md) |
| **TypeScript SDK** | Planned | — |

### Lending Adapter

| Property | Value |
|----------|-------|
| **Status** | `SPECIFICATION` |
| **Specification** | [docs/lending-adapter.md](../lending-adapter.md) |
| **Implementation** | Pending |
| **External Partner** | CoinRabbit |

### Indexer

| Property | Value |
|----------|-------|
| **Status** | `SPECIFICATION` |
| **Architecture** | [backend/indexer/docs/ARCHITECTURE.md](../../backend/indexer/docs/ARCHITECTURE.md) |
| **Implementation** | Pending |
| **Trust Level** | Low-trust (read-only) |

### External Payment Providers

| Provider | Integration Type | Status |
|----------|------------------|--------|
| ChangeNOW | Swap gateway | Planned |
| NOWPayments | Payment processing | Planned |
| CoinRabbit | Collateral lending | Planned |
| TONCO DEX | Liquidity provider | Active |

### Core Guarantees for Integrators

TONBANKCARD guarantees to all external integrators:

1. **Non-Custodial Integrity**: Protocol never custodies user funds
2. **Protocol Immutability**: Core contracts are immutable once frozen
3. **Backward Compatibility**: Existing interfaces remain stable
4. **Deterministic Behavior**: Contract logic is deterministic

### Explicit Non-Guarantees

TONBANKCARD does NOT guarantee:

- Uptime of off-chain services
- Availability of indexers
- Price stability of TBC
- Liquidity depth
- Merchant solvency
- Lending approval decisions
- Governance outcomes

---

## Immutability Rules

### Registry Immutability

- Each protocol version has a dedicated registry snapshot
- Historical entries **MUST NOT** be modified
- Corrections **MUST** be additive with clear supersession notes

### Registry Changes

| Action | Permitted |
|--------|-----------|
| Add new version entries | Yes |
| Add new deployment records | Yes |
| Modify historical entries | No |
| Delete entries | No |
| Correct errors | Yes (additive only, with notes) |

---

## Version History

| Date | Version | Change Description |
|------|---------|-------------------|
| 2025-01 | v1.0.0 | Initial protocol registry publication |

---

## Cross-References

### Related Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| **Network Deployment Matrix** | Detailed deployment registry | [docs/deployments/network-matrix.md](../deployments/network-matrix.md) |
| **Versioning Policy** | Version and deployment rules | [docs/versioning-policy.md](../versioning-policy.md) |
| **External Guarantees** | Integration guarantees | [docs/integrations/external-guarantees.md](../integrations/external-guarantees.md) |
| **Governance Release Notes** | Governance v1 specification | [docs/governance/release-notes-v1.md](../governance/release-notes-v1.md) |
| **Audit Scope** | Security audit scope | [docs/audit-scope.md](../audit-scope.md) |
| **Invariants** | Formal protocol guarantees | [docs/invariants.md](../invariants.md) |
| **Threat Model** | Attack surface analysis | [docs/threat-model.md](../threat-model.md) |
| **Architecture** | System architecture | [docs/architecture.md](../architecture.md) |

---

## Explicit Non-Goals

This registry **MUST NOT**:

- Act as a contract registry with authority
- Introduce new trust assumptions
- Imply custody or control
- Auto-update from on-chain state
- Replace independent verification

---

## Final Statement

> *Any external party can independently verify the protocol's state without trusting a human explanation.*

The Public Protocol Registry is a **transparency artifact**, not a control mechanism.

The blockchain remains the **single source of truth**.

**Verify, do not trust.**

---

**Document Status:** ACTIVE
**Last Updated:** 2025-01
**Maintainers:** TONBANKCARD Protocol Team
