# TONBANKCARD Protocol — Unified Security Framework

**Document Type:** Security Chapter (Unified Framework)
**Version:** 1.0
**Status:** Active
**Issue Reference:** [#64 — Issue 10.6 — Implement Unified Security Framework](https://github.com/xlabtg/tonbankcard-protocol/issues/64)
**Last Updated:** 2026-03-05

---

## Table of Contents

1. [Security Philosophy](#1-security-philosophy)
2. [System Overview](#2-system-overview)
3. [Threat Model Summary](#3-threat-model-summary)
4. [Trust Boundaries](#4-trust-boundaries)
5. [Invariants](#5-invariants)
6. [Audit Readiness Summary](#6-audit-readiness-summary)
7. [Incident Response Overview](#7-incident-response-overview)
8. [Key Management Principles](#8-key-management-principles)
9. [Supply Chain Security](#9-supply-chain-security)
10. [Explicit Non-Goals](#10-explicit-non-goals)

---

## 1. Security Philosophy

TONBANKCARD is built on five structural security principles. These are not policies — they are enforced through architecture.

**Non-Custodial.** The protocol never holds user funds. All balances live in TBC jetton wallets owned by users. The Payment Hub routes requests but holds nothing.

**Immutable-First.** All protocol smart contracts are deployed without upgrade proxies. Deployed code cannot be modified. This eliminates governance attacks targeting contract upgrades.

**Explicit Trust Boundaries.** Every component has a declared trust level. The blockchain is the single source of truth. All other layers are convenience or orchestration.

**Minimal Admin Power.** Admin roles exist only for operational safety (emergency pause, fraud flagging). No admin role can move funds, override ownership, or modify contract logic.

**Deterministic Settlement.** All transfers are deterministic. No randomness, no oracle-dependent execution, no off-chain inputs influence on-chain settlement.

For the full security architecture, see [THREAT_MODEL.md](THREAT_MODEL.md).

---

## 2. System Overview

### On-Chain Components

The protocol consists of the following smart contract groups:

| Group | Components | Status |
|-------|------------|--------|
| Payment routing | Payment Hub (FunC + Tact), Merchant Payment Hub (Tact) | Implemented, pre-deployment |
| Account control | Account Locks (FunC), Account State Machine (Tact) | Implemented, pre-deployment |
| NFT resolution | NFT Account Resolver (FunC + Tact) | Implemented, pre-deployment |
| Collateral | Collateral Signal (Tact), Public Collateral Lookup (Tact + FunC) | Implemented, pre-deployment |
| Governance | Proposal Registry, Snapshot Verifier, Transparency Registry, Diamond Resolver | Implemented, pre-deployment |
| External (deployed) | TBC Jetton, NFT Series 7777/8888, TBC Diamonds, TBC/TON Pool | Deployed, immutable |

### Off-Chain Components

| Component | Role | Trust Level |
|-----------|------|-------------|
| Backend Indexer (`backend/indexer/`) | Read-only blockchain cache | Convenience, not authoritative |
| Merchant API (`api/src/`) | Invoice management and orchestration | Convenience, not authoritative |
| Merchant SDK (`sdk/src/`) | TypeScript integration library | Informational, read-only |
| External adapters (ChangeNOW, NOWPayments, CoinRabbit) | Third-party swap/payment/lending | Untrusted, never authoritative |

For full component descriptions, see [THREAT_MODEL.md — Section 2](THREAT_MODEL.md#2-system-components-in-scope).

---

## 3. Threat Model Summary

### Primary Adversary Classes

The protocol is designed to defend against seven adversary classes:

| Class | Capabilities | Primary Vectors | Key Defense |
|-------|-------------|-----------------|-------------|
| External attacker | Arbitrary on-chain transactions, contract analysis | Access control bypass, reentrancy, crafted messages | Structural enforcement of ownership checks |
| Malicious merchant | Registered NFT account, invoice generation | Double settlement, replay attacks | User signature required for all payments |
| Compromised NFT holder | Private key access, NFT transfer capability | Balance drain, NFT capture | Non-custodial design; funds safe if protocol is intact |
| Compromised external provider | False API data, webhook replay | False confirmations, rate manipulation | On-chain verification is authoritative |
| Malicious indexer operator | Stale/false indexed data | Payment status misrepresentation | Blockchain is single source of truth |
| Governance attacker | Diamond NFT ownership, vote submission | Proposal spam, snapshot manipulation | Non-executable governance; gas rate-limiting |
| Network-level attacker | Validator stake, reorg capability | Double-spend, finality manipulation | TON BFT consensus; reorg detection in indexer |

### Pre-Production Issues Requiring Remediation

The following issues are documented and must be resolved before mainnet deployment:

| Issue | Component | Risk | Reference |
|-------|-----------|------|-----------|
| Test-only functions have no access control | `MerchantPaymentHub.tact` | HIGH | [THREAT_MODEL.md §4.1.5](THREAT_MODEL.md#415-access-control-bypass) |
| `RegisterNFTOwner` has no access control | `CollateralSignal.tact` | HIGH | [THREAT_MODEL.md §4.1.5](THREAT_MODEL.md#415-access-control-bypass) |
| TransparencyRegistry record messages unprotected | `TransparencyRegistry.tact` | HIGH | [THREAT_MODEL.md §4.1.5](THREAT_MODEL.md#415-access-control-bypass) |
| Governance proposal/vote NFT ownership unverified | `ProposalRegistry.tact` | HIGH | [THREAT_MODEL.md §4.1.5](THREAT_MODEL.md#415-access-control-bypass) |
| FunC Payment Hub missing lock check | `payment-hub.fc` | HIGH | [THREAT_MODEL.md §4.3.2](THREAT_MODEL.md#432-locked-account-bypass) |

For the complete threat analysis, see [THREAT_MODEL.md](THREAT_MODEL.md).

---

## 4. Trust Boundaries

The protocol defines four trust levels:

**Level 1 — Absolute Trust:** TON blockchain consensus, TVM execution, cryptographic primitives (Ed25519, SHA-256). These are structural guarantees, not assumptions.

**Level 2 — High Trust (Immutable):** Deployed smart contracts executing on TVM. Once deployed, contract behavior is fixed. This level includes both protocol contracts (pre-deployment) and external contracts (already deployed and immutable).

**Level 3 — Medium Trust (Off-Chain):** Protocol off-chain components — indexer, Merchant API, SDK. These components cannot modify on-chain state. Their data is verifiable against the blockchain independently. An operator controlling these systems can disrupt UX but cannot move funds.

**Level 4 — Low Trust (External):** Third-party services — ChangeNOW, NOWPayments, CoinRabbit. These systems are untrusted. They may return false data, be unavailable, or be compromised. All their outputs require on-chain confirmation before acting on them.

**Rules:**
- The blockchain is the single source of truth. If the indexer disagrees with the blockchain, the blockchain is correct.
- Merchant backends are untrusted. Only on-chain settlement is proof of payment.
- No external provider response is authoritative over protocol state.
- Users must verify transaction details in their wallet — frontends can be spoofed.

For the full trust boundary diagram, see [THREAT_MODEL.md — Section 5](THREAT_MODEL.md#5-trust-boundaries).

---

## 5. Invariants

The protocol is governed by seven formal invariants. Any violation is a critical security vulnerability.

| ID | Name | Statement |
|----|------|-----------|
| **I1** | Non-Custodial Ownership | No protocol component may move funds without explicit NFT owner signature |
| **I2** | NFT = Account Authority | Account control transfers atomically with NFT ownership; no secondary authority mechanism exists |
| **I3** | No Admin Fund Control | No admin role may withdraw, transfer, or drain user funds |
| **I4** | Atomic Transfers | All balance updates are atomic within a single transaction; no partial state |
| **I5** | Ledger Conservation | Every debit has an equal credit; total supply does not change during transfers |
| **I6** | Lock Is Not Confiscation | Account locks prevent sending but never seize funds; locked accounts can always receive; locks are reversible |
| **I7** | Adapter Isolation | External adapters have no direct smart contract authority; all fund-moving operations require user signature |

For formal definitions and contract-level mappings, see [docs/invariants.md](../invariants.md).

---

## 6. Audit Readiness Summary

### Scope

The audit covers five critical on-chain components:

| Component | File | Priority |
|-----------|------|----------|
| Merchant Payment Hub | `contracts/MerchantPaymentHub.tact` | Critical |
| Payment Hub | `contracts/payments/PaymentHub.tact` | Critical |
| NFT Account Resolver | `contracts/nft-resolver/nft_account_resolver.fc` + `.tact` | Critical |
| Account State Machine | `contracts/payment-hub/account-state.tact` | Critical |
| Account Locks | `contracts/payments/account-locks.fc` | High |

External contracts (TBC Jetton, NFT collections) are out of scope — they are already deployed and immutable.

### Known Pre-Production Issues

Auditors are expected to find and verify the following documented issues:

- FunC Payment Hub (`payment-hub.fc`) does not check Account Locks before transfers — this is a known HIGH risk
- Test-only functions in `MerchantPaymentHub.tact` have no access control — must be removed before deployment
- NFT ownership verification not implemented in `ProposalRegistry.tact` and `CollateralSignal.tact`

### Audit Readiness Status

| Criterion | Status |
|-----------|--------|
| Contracts frozen (no logic changes during audit) | Required before audit engagement |
| Invariants documented | Complete — [docs/invariants.md](../invariants.md) |
| Threat model documented | Complete — [THREAT_MODEL.md](THREAT_MODEL.md) |
| Audit scope defined | Complete — [docs/audit-scope.md](../audit-scope.md) |
| Test coverage | Defined in [docs/audit-scope.md](../audit-scope.md) |
| External engagement plan (A1 — Core Contracts) | Complete — [audits/A1-core-contracts/ENGAGEMENT.md](audits/A1-core-contracts/ENGAGEMENT.md) |
| External audit firm | Not yet selected — see [audits/A1-core-contracts/STATUS.md](audits/A1-core-contracts/STATUS.md) |

For the complete audit checklist, scope definitions, and auditor expectations, see [AUDIT_READINESS.md](AUDIT_READINESS.md) and [docs/audit-scope.md](../audit-scope.md).

---

## 7. Incident Response Overview

### Core Principles

No incident may cause the protocol to violate invariants I1–I7. Emergency powers do not exist at the protocol layer.

The following are permanently forbidden, regardless of incident severity:
- Admin withdrawal from any account
- Account seizure or forced fund transfers
- Silent contract mutation or retroactive settlement changes
- Bypassing any protocol invariant

### Severity Levels

| Severity | Examples | Response Timeline |
|----------|----------|-------------------|
| LOW | Indexer lag, minor API errors | No public notice required; post-mortem within 30 days |
| MEDIUM | Adapter downtime, off-chain sync delay | Public update within 24 hours; post-mortem within 14 days |
| HIGH | Unconfirmed vulnerability, partial adapter compromise | Public advisory within 12 hours; preliminary post-mortem within 7 days |
| CRITICAL | Active exploit, confirmed invariant violation | Public warning within 2 hours; full post-mortem within 14 days |

### Emergency Response Approach

The protocol has no kill-switch — by design. A kill-switch would require a trusted administrator with elevated authority, inconsistent with non-custodial design.

When a vulnerability is confirmed:
1. The compromised contract continues operating immutably.
2. A patched contract is deployed at a new address.
3. Governance formally declares the new version as recommended.
4. Users receive migration guidance; migration is voluntary and user-initiated.

For security-specific incident types and key compromise procedures, see [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). For full governance escalation, communication, and post-mortem requirements, see [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md).

---

## 8. Key Management Principles

### Key Hierarchy

The protocol operates four on-chain authority key classes:

| Key | Authority | Fund Risk | Current State |
|-----|-----------|-----------|---------------|
| Admin Key (Payment Hub) | Protocol pause, account flagging | None — cannot move funds | Single key (temporary; HIGH RISK) |
| Risk Authority Key | Fraud lock set/clear | None — cannot move funds | Single key (HIGH RISK) |
| Lending Adapter Key | Collateral lock set/clear | None — cannot move funds | Not yet deployed |
| Deployment Key | Contract deployment | None after deployment | Cold storage required |

### Structural Guarantee

No single key compromise results in loss of user funds. Key compromise can cause operational disruption (pause, censorship) but cannot seize or transfer user assets. This is architectural, not policy-based.

### Governance Roadmap for Admin Keys

| Phase | Timeline | State |
|-------|----------|-------|
| Phase 1 (Current) | Now | Single admin key — acknowledged HIGH RISK |
| Phase 2 | Q1 2026 | Multi-sig 3-of-5 admin key |
| Phase 3 | Q2 2026 | Time-locked governance with 48-hour delay |
| Phase 4 | Q3 2026 | Full DAO governance, removal of manual admin keys |

### Storage Requirements

- On-chain authority keys: hardware wallet (Ledger, Trezor) or HSM — software wallets prohibited
- Governance majority custody (>33 TBC Diamonds): hardware wallet or MPC threshold — hot wallets prohibited
- Deployment keys: cold storage (air-gapped)
- CI/CD secrets: encrypted secrets (GitHub Actions or Vault) — plaintext in repositories prohibited

For the complete key classification, storage requirements, rotation schedules, compromise scenarios, and prohibited practices, see [KEY_MANAGEMENT.md](KEY_MANAGEMENT.md).

---

## 9. Supply Chain Security

### Dependency Management

All production dependencies are pinned to exact versions. Lock files (`package-lock.json`) are committed and kept current. No floating version specifiers (`^`, `~`) are permitted in production dependencies.

`npm audit` runs on every CI build. HIGH and CRITICAL vulnerability findings block merges.

### Build Integrity

Smart contract builds are reproducible: a specific git tag produces a deterministic contract bytecode. Auditors and users can verify deployed contracts match the published source.

```bash
git checkout <release-tag>
npm ci
npx blueprint build
sha256sum build/PaymentHub.cell  # compare with deployment manifest
```

### CI/CD Isolation

CI runners have no access to mainnet keys or production infrastructure. Each run starts from a clean ephemeral environment. Secrets are injected at runtime only for the specific job that requires them.

### SDK Publication

Before any npm package publication: build on a clean machine, review `npm pack` contents for unexpected files, publish with 2FA, tag the corresponding git commit, and verify published package contents match the local build.

For pinning policies, verified sources, CI environment requirements, and SDK publication security, see [KEY_MANAGEMENT.md — Section 10](KEY_MANAGEMENT.md#10-supply-chain-security).

---

## 10. Explicit Non-Goals

This framework does not:

**Guarantee zero risk.** All systems have residual risks. This document enumerates known risks and mitigations. New risks will emerge as the protocol evolves.

**Eliminate blockchain-level attacks.** Attacks on TON consensus (validator collusion, BFT failures) are outside protocol scope. If TON consensus fails, all TON-based protocols are affected.

**Protect against user self-custody mistakes.** Users who lose private keys, share seed phrases, or fall for phishing lose account access. Non-custodial architecture means the protocol cannot recover funds from lost keys.

**Eliminate merchant operational risk.** Merchants are responsible for their own key management, server security, API authentication, and fulfillment logic.

**Provide insurance.** The protocol does not insure user funds against any loss scenario.

**Prevent external service failures.** ChangeNOW, NOWPayments, and CoinRabbit are third-party services. Their availability and security are their own responsibility.

**Guarantee TBC token price stability.** The TBC token trades on TONCO DEX. Its price is determined by market supply and demand.

---

## Document References

| Document | Location | Content |
|----------|----------|---------|
| Threat Model | [THREAT_MODEL.md](THREAT_MODEL.md) | Full threat analysis, adversary model, attack surface classification, mitigation mapping |
| Key Management | [KEY_MANAGEMENT.md](KEY_MANAGEMENT.md) | Key classification, storage requirements, rotation policy, compromise scenarios, prohibited practices |
| Incident Response | [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | Security-focused incident classification, key compromise response, escalation paths |
| Governance Incident Response | [docs/governance/INCIDENT_RESPONSE.md](../governance/INCIDENT_RESPONSE.md) | Full governance escalation, communication, post-mortem requirements |
| Audit Readiness | [AUDIT_READINESS.md](AUDIT_READINESS.md) | Audit package location, contracts under audit, known limitations, auditor engagement |
| External Audits | [audits/README.md](audits/README.md) | Index of external engagements (A1, A2, A4, A5), gating rules, report storage |
| Remediation Workflow | [audits/REMEDIATION_WORKFLOW.md](audits/REMEDIATION_WORKFLOW.md) | Triage → fix → re-verification → disclosure process for audit findings |
| Audit Report Template | [audits/REPORT_TEMPLATE.md](audits/REPORT_TEMPLATE.md) | Canonical report layout used by every external auditor |
| Invariants | [docs/invariants.md](../invariants.md) | Formal invariant definitions and contract mappings |
| Audit Scope | [docs/audit-scope.md](../audit-scope.md) | In-scope contracts, auditor expectations, test requirements, freeze policy |
| Architecture | [docs/architecture.md](../architecture.md) | Protocol architecture and component responsibilities |
