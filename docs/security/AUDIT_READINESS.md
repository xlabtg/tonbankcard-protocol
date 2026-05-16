# TONBANKCARD Protocol — Audit Readiness

**Document Type:** Security Documentation
**Issue Reference:** [#62 — Issue 10.5 Security Documentation Structure](https://github.com/xlabtg/tonbankcard-protocol/issues/62)
**Related Audit Package:** [audit/SCOPE.md](../../audit/SCOPE.md)
**External Engagements:** [docs/security/audits/](./audits/README.md)
**Status:** Active
**Last Updated:** 2026-05-16

---

## Overview

This document summarizes the audit readiness state of the TONBANKCARD protocol. It serves as a navigation guide for external auditors and internal reviewers approaching the protocol for the first time.

For the complete frozen audit package (used by external auditors), see the [`audit/`](../../audit/) directory.

---

## Audit Package Location

The pre-audit package is located at:

```
audit/
├── SCOPE.md              — Audit boundaries, focus areas, and contract inventory
├── THREAT_MODEL.md       — Threat classes, attack vectors, and mitigations
├── INVARIANTS.md         — Formal invariants with contract-code mapping
├── FREEZE_METADATA.md    — Git hash, compiler versions, file checksums
├── BUILD_INSTRUCTIONS.md — How to reproduce builds and run tests
└── TEST_COVERAGE_REPORT.md — Coverage data and test organization
```

**Freeze status:** The audit package was frozen at commit `4027b9d` (2025-12-29). No contract logic changes are permitted to the frozen set. See [audit/FREEZE_METADATA.md](../../audit/FREEZE_METADATA.md).

---

## Contracts Under Audit

Full details in [audit/SCOPE.md](../../audit/SCOPE.md). Summary:

| Contract | File | Priority | Lines | Primary Concern |
|----------|------|----------|-------|-----------------|
| MerchantPaymentHub | `contracts/MerchantPaymentHub.tact` | Critical | 287 | Payment settlement, ownership, locks |
| PaymentHub | `contracts/payments/PaymentHub.tact` | Critical | 355 | Internal transfers, atomicity |
| NFT Account Resolver | `contracts/nft-resolver/nft_account_resolver.fc` | Critical | 149 | Ownership resolution |
| NFT Account Resolver | `contracts/nft-resolver/nft_account_resolver.tact` | Critical | 121 | Ownership resolution (Tact wrapper) |
| Account State Machine | `contracts/payment-hub/account-state.tact` | Critical | 285 | State management, balance integrity |
| Account Locks | `contracts/payments/account-locks.fc` | High | 269 | Lock authorization, lock semantics |

**Total lines under audit:** 1,466 (critical) + 269 (high) = **1,735 lines**

---

## Protocol Invariants

Seven formal invariants define the protocol's security guarantees. Any violation is a critical security finding.

| ID | Invariant | Key Guarantee |
|----|-----------|---------------|
| **I1** | Non-Custodial Ownership | Only NFT owner can initiate fund transfers |
| **I2** | NFT = Account Authority | NFT ownership is the single source of truth for account control |
| **I3** | No Admin Fund Control | No privileged role can move user funds |
| **I4** | Atomic Transfers | All transfers are all-or-nothing; no partial state possible |
| **I5** | Ledger Conservation | Sum of all balances is preserved across all operations |
| **I6** | Lock ≠ Confiscation | Locks restrict outgoing transfers; they do not seize funds |
| **I7** | External Adapter Isolation | External providers cannot directly invoke protocol operations |

Full formal definitions with contract-code mappings: [audit/INVARIANTS.md](../../audit/INVARIANTS.md)

---

## Test Coverage Summary

| Contract | Estimated Line Coverage | Estimated Branch Coverage |
|----------|------------------------|--------------------------|
| MerchantPaymentHub.tact | ~90%+ | ~85%+ |
| PaymentHub.tact | ~85%+ | ~80%+ |
| account-locks.fc | ~85%+ | ~80%+ |
| nft_account_resolver.fc | ~80%+ | ~75%+ |
| account-state.tact | ~90%+ | ~85%+ |

To obtain exact figures:

```bash
git checkout eb5dd593248a33a5a7517ae59b840827c140906a
npm install
npx blueprint test --coverage
```

See [audit/TEST_COVERAGE_REPORT.md](../../audit/TEST_COVERAGE_REPORT.md) for full test organization.

---

## Critical Audit Focus Areas

### 1. No Admin Fund Control (MUST verify)

Search the entire contract codebase for `withdraw`, `drain`, `emergency`, `admin_transfer`, `force_transfer`. Expected result: **zero matches** in fund-moving contexts.

Admin roles exist (`risk_authority`, `lending_adapter`) but are limited to setting/clearing lock flags. They cannot move funds.

### 2. NFT Ownership Enforcement (MUST verify)

Every fund-moving operation must verify the caller is the current on-chain NFT owner. No cached ownership. No secondary authorization paths.

### 3. Atomic Balance Updates (MUST verify)

All balance modifications must be atomic — both debit and credit in the same transaction. Reentrancy protection must be verified at:
- `PaymentHub.tact` lines 149–150 (reentrancy guard)
- `PaymentHub.tact` lines 196–202 (`executeTransfer`)

### 4. Lock Enforcement (MUST verify)

Locks prevent sending but must never seize funds. Verify:
- `account-locks.fc` `can_receive()` always returns 1
- Lock operations do not modify balances
- FRAUD_LOCK and COLLATERAL_LOCK both correctly gate `can_send()`

### 5. No Upgrade Paths (MUST verify)

Contracts are immutable. No upgradeable proxy patterns. No `setAdmin()` paths that could change invariants.

---

## Known Limitations (Auditor Notice)

| Limitation | Severity | Description |
|------------|----------|-------------|
| Invoice replay (off-chain only) | MEDIUM | Contract does not enforce invoice uniqueness on-chain; handled off-chain |
| DAO unlock not implemented | LOW | FROZEN → ACTIVE transition requires future DAO governance |
| Lending unlock not implemented | LOW | COLLATERAL_LOCKED → ACTIVE requires Lending Adapter (not yet deployed) |
| NFT ownership integration (partial) | MEDIUM | Some contracts rely on calling contract for ownership check |
| Single admin key (temporary) | HIGH | Admin key is single-key pending multi-sig migration (Q1 2026) |

These are documented accepted risks. Full details in [docs/audit-notes.md](../audit-notes.md).

---

## Auditor Engagement Process

### Access

- Repository: `https://github.com/xlabtg/tonbankcard-protocol`
- Audit freeze commit: `eb5dd593248a33a5a7517ae59b840827c140906a`
- Build instructions: [audit/BUILD_INSTRUCTIONS.md](../../audit/BUILD_INSTRUCTIONS.md)
- Contact for questions: via GitHub issues tagged `audit`

### Scope Confirmation

Before beginning, auditors must confirm:
- Which contracts are in scope (see [audit/SCOPE.md](../../audit/SCOPE.md))
- Which compiler versions to use (see [audit/FREEZE_METADATA.md](../../audit/FREEZE_METADATA.md))
- Which invariants to verify (see [audit/INVARIANTS.md](../../audit/INVARIANTS.md))

### Expected Deliverables

| Deliverable | Description |
|-------------|-------------|
| Audit Report | Findings categorized by severity (Critical, High, Medium, Low, Informational) |
| Finding References | Each finding references specific invariant(s) and contract line(s) |
| Reproduction Steps | Each finding includes steps to reproduce |
| Suggested Fixes | Where applicable |
| Invariant Attestation | Statement on whether each of I1–I7 holds |

The end-to-end engagement workflow (intake → triage → remediation → re-verification → disclosure) is canonicalised in [docs/security/audits/REMEDIATION_WORKFLOW.md](./audits/REMEDIATION_WORKFLOW.md). The auditor-facing report template is [docs/security/audits/REPORT_TEMPLATE.md](./audits/REPORT_TEMPLATE.md).

---

## External Engagement Status

This section tracks every external security audit engagement. Mainnet deployment of any in-scope contract requires the corresponding engagement to be `READY` (or `READY WITH ACCEPTED RISKS`).

| Engagement | Scope | Issue | Phase | Verdict | Plan / Status |
|------------|-------|-------|-------|---------|---------------|
| **A1 — Core Contracts** | PaymentHub, MerchantPaymentHub, account-locks, nft-resolver, collateral signal | [#112](https://github.com/xlabtg/tonbankcard-protocol/issues/112) | Engagement preparation complete — awaiting firm selection | ⏳ Pending | [Plan](./audits/A1-core-contracts/ENGAGEMENT.md) · [Status](./audits/A1-core-contracts/STATUS.md) |
| A2 — Phase 4 Contracts | CrossChainBridge, MultiSigCard, RecurringPayments, LendingProtocolCoordinator | TBD | Not started | — | — |
| A4 — Off-Chain Services | `api/`, `backend/`, `sdk/` | TBD | Not started | — | — |
| A5 — Bug Bounty | Public bug bounty program | TBD | Not started | — | — |

The directory [`docs/security/audits/`](./audits/README.md) is the canonical home for all external engagement artifacts (engagement plans, frozen packages, reports, re-verification letters).

---

## Audit Completion Status

| Engagement | Audited Commit | Report | Critical Open | High Open | Medium Open | Verdict | Completed |
|------------|----------------|--------|---------------|-----------|-------------|---------|-----------|
| A1 — Core Contracts | _pending kickoff_ | _pending_ | — | — | — | ⏳ Pending | — |

This table is updated immediately after each engagement's re-verification letter is filed.

---

## References

| Document | Location | Purpose |
|----------|----------|---------|
| Audit Scope | [audit/SCOPE.md](../../audit/SCOPE.md) | Contract inventory, focus areas |
| Formal Invariants | [audit/INVARIANTS.md](../../audit/INVARIANTS.md) | Full invariant definitions |
| Threat Model | [audit/THREAT_MODEL.md](../../audit/THREAT_MODEL.md) | Auditor-facing threat summary |
| Build Instructions | [audit/BUILD_INSTRUCTIONS.md](../../audit/BUILD_INSTRUCTIONS.md) | Environment setup |
| Test Coverage Report | [audit/TEST_COVERAGE_REPORT.md](../../audit/TEST_COVERAGE_REPORT.md) | Coverage data |
| Full Threat Model | [docs/security/THREAT_MODEL.md](./THREAT_MODEL.md) | Complete threat architecture |
| Key Management | [docs/security/KEY_MANAGEMENT.md](./KEY_MANAGEMENT.md) | Key security procedures |
| Audit Notes | [docs/audit-notes.md](../audit-notes.md) | Known limitations details |
| Security Index | [docs/security/SECURITY.md](./SECURITY.md) | Security documentation hub |

---

**TONBANKCARD: Non-Custodial. Auditable. Security-First.**
