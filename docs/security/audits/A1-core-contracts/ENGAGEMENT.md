# Engagement A1 — Formal Security Audit of Core Contracts

**Engagement ID:** `A1`
**Issue:** [#112 — A1 Formal Security Audit — Core Contracts](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
**Roadmap track:** A — Security & Audit
**Status:** Engagement preparation complete — awaiting firm selection
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Objective

Procure a **formal external security audit** of the Phase 2 core smart contracts by a TON-specialist firm. Successfully completing this engagement is a mandatory gate before any TONBANKCARD mainnet deployment touching the in-scope contracts.

Success criteria (mirror of issue #112 acceptance criteria):

- [ ] Audit firm engaged and scope signed
- [ ] Frozen audit package delivered (see §5)
- [ ] All Critical findings remediated and re-verified
- [ ] All High findings remediated, or formally accepted with rationale in [`STATUS.md`](./STATUS.md)
- [ ] All Medium findings addressed (remediated or documented as accepted risk in `docs/audit-notes.md`)
- [ ] Audit report published in this directory
- [ ] Remediation PR(s) merged and re-verified by auditor
- [ ] `docs/security/AUDIT_READINESS.md` updated with completion status

---

## 2. In-Scope Contracts

The audit covers exactly the contracts listed in issue #112 §3:

| # | Contract | File | Language | Reason |
|---|----------|------|----------|--------|
| 1 | PaymentHub | `contracts/payments/PaymentHub.tact` | Tact | Core payment routing, NFT account abstraction |
| 2 | MerchantPaymentHub | `contracts/MerchantPaymentHub.tact` | Tact | Merchant-facing payment processing |
| 3 | Account Locks | `contracts/payments/account-locks.fc` | FunC | FRAUD_LOCK and COLLATERAL_LOCK flag logic |
| 4 | NFT Account Resolver (FunC) | `contracts/nft-resolver/nft_account_resolver.fc` | FunC | On-chain NFT ownership resolver |
| 5 | NFT Account Resolver (Tact) | `contracts/nft-resolver/nft_account_resolver.tact` | Tact | Tact wrapper for the resolver |
| 6 | Public Collateral Lookup | `contracts/collateral-lookup/PublicCollateralLookup.tact` | Tact | Collateral signal read interface |
| 7 | Collateral Signal | `contracts/CollateralSignal.tact` | Tact | Collateral signal emission |

Supporting types and interfaces (`contracts/types/`, `contracts/interfaces/`) are in scope **for context only** — they are reviewed insofar as they affect the contracts above. They have already been covered by the internal per-contract audit in [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md).

---

## 3. Out of Scope

Explicitly **not** part of this engagement (per issue #112 §4):

- Phase 4 contracts (`CrossChainBridge.tact`, `MultiSigCard.tact`, `RecurringPayments.tact`, `LendingProtocolCoordinator.tact`) — covered by engagement **A2**
- Off-chain services (`api/`, `backend/`, `sdk/`) — covered by engagement **A4**
- Governance contracts (`contracts/governance/*`) — covered in **Track E**
- Frontend, dashboard, wallet UI

External pre-deployed contracts (TBC jetton, NFT collections, TONCO DEX pool) are treated as trust assumptions; their audits are referenced via [`audit/SCOPE.md`](../../../../audit/SCOPE.md) §"Out-of-Scope Components".

---

## 4. Threat Model — Required Coverage

The audit must explicitly evaluate every attack class enumerated in issue #112 §5, mapped to the protocol-level threat model in [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md):

| # | Class | Where to look |
|---|-------|---------------|
| T1 | Re-entrancy / message ordering | `PaymentHub.tact` reentrancy guard (lines 149–150), all `receive(...)` handlers |
| T2 | NFT ownership spoofing | `nft-resolver/*`, `MerchantPaymentHub.checkOwnership` (lines 90–96) |
| T3 | Lock bypass | `account-locks.fc` `get_can_send` / `get_can_receive`, all fund-moving paths |
| T4 | Admin key abuse | search for `deployer`, `admin`, `risk_authority`, `lending_adapter` — verify invariant I3 |
| T5 | Atomicity failure | `PaymentHub.executeTransfer` (lines 196–202), debit/credit pairing |
| T6 | Integer overflow / underflow | All `Int as uintN` casts, balance arithmetic |
| T7 | Replay attacks | Message uniqueness, on-chain vs. off-chain replay protection |
| T8 | Gas griefing | `receive` handler gas costs, refund paths, message storage |

Invariant attestation in the final report must cover **I1–I7** as defined in [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md).

---

## 5. Audit Package (Frozen Hand-off)

The protocol team will deliver the following package to the selected firm at engagement kickoff. The audited commit is frozen at the kickoff and recorded in [`STATUS.md`](./STATUS.md) §"Audited commit".

| Artifact | Location | Notes |
|----------|----------|-------|
| Audit intro pack | [`docs/audit/external-audit-intro.md`](../../../audit/external-audit-intro.md) | Protocol intent, trust model, intentional design constraints |
| Scope | [`audit/SCOPE.md`](../../../../audit/SCOPE.md) | Contracts, focus areas, out-of-scope list |
| Threat model | [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md) | T1–T8 attack classes with mitigations |
| Formal invariants | [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md) | I1–I7 with contract-line mapping |
| Freeze metadata | [`audit/FREEZE_METADATA.md`](../../../../audit/FREEZE_METADATA.md) | Compiler versions, file hashes, frozen commit |
| Build instructions | [`audit/BUILD_INSTRUCTIONS.md`](../../../../audit/BUILD_INSTRUCTIONS.md) | Reproducible build & test commands |
| Test coverage | [`audit/TEST_COVERAGE_REPORT.md`](../../../../audit/TEST_COVERAGE_REPORT.md) | Coverage breakdown per contract |
| Internal pre-audit | [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) | Internal findings already mitigated or known |
| Full system audit | [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../../audit/FULL_SYSTEM_AUDIT.md) | System-wide context |
| Audit readiness | [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) | Entry-point navigation document |
| Audit notes | [`docs/audit-notes.md`](../../../audit-notes.md) | Known accepted limitations |

The auditor receives **read access** to the public GitHub repository at the frozen commit, plus a direct contact channel agreed at kickoff.

---

## 6. Candidate Firms

Three firm classes are acceptable per the roadmap and issue #112:

1. **Top-tier general smart-contract auditors with TON experience**, e.g., Trail of Bits, OtterSec, Halborn.
2. **Layer-1-agnostic auditors with proven non-EVM track record**, e.g., CertiK, Quantstamp.
3. **TON-ecosystem specialists**, e.g., CertiK TON desk, TonGuard, scalebit (TON), Veridise TON desk.

A non-exhaustive long list is maintained in [`STATUS.md`](./STATUS.md) §"Firm long list".

### 6.1 Evaluation Matrix

Each shortlisted firm is scored on the following criteria. Numeric scores 1–5 (5 = excellent). Final score = weighted sum.

| Criterion | Weight | Notes |
|-----------|--------|-------|
| TON / Tact / FunC depth | 25% | Prior TON engagements, in-house TON expertise, Tact language coverage |
| Methodology rigor | 20% | Manual review hours per LOC, fuzzing/property testing, formal methods readiness |
| Reputation & references | 15% | Publicly available audit reports, ecosystem feedback |
| Re-audit / remediation policy | 15% | Verified re-test included, follow-up support |
| Cost & timeline fit | 15% | Total cost, calendar window, latest available start |
| Communication & transparency | 10% | Daily-stand-up cadence, willingness to publish, NDA flexibility |

### 6.2 Conflict-of-interest screen

Firms must disclose any prior engagement with TONBANKCARD operators, TON Foundation grant overlap, holding of TBC token / TBC Diamonds / Series 7777/8888 NFTs, or other potential conflicts. Disqualifying conditions are recorded in [`STATUS.md`](./STATUS.md).

---

## 7. Engagement Process

```
T-0   Issue published                                       ✅
T+0   Firm long list assembled                              ⏳
T+1w  Shortlist (3 firms) + RFP sent
T+3w  Proposals received, evaluation matrix populated
T+4w  Firm selected, contract signed
T+4w  Audit kickoff:  freeze commit + package handover
T+8w  Mid-audit checkpoint (preliminary findings)
T+10w Draft report delivered
T+11w Remediation PRs opened (per REMEDIATION_WORKFLOW.md)
T+13w Remediation merged
T+14w Re-verification by auditor
T+14w Final report published in this directory
T+14w STATUS.md flipped to COMPLETED
T+15w Disclosure summary in CHANGELOG.md + public channels
```

All dates are anchored to the kickoff and tracked in [`STATUS.md`](./STATUS.md). The remediation phase follows [`REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) verbatim.

---

## 8. Deliverables From Auditor

The signed engagement must require the following deliverables (mirrored in the report template):

1. **Audit report**, structured per [`REPORT_TEMPLATE.md`](../REPORT_TEMPLATE.md):
   - Findings categorised by severity
   - Each finding references file:line, invariant(s), and threat-model class
   - Reproduction steps for every Critical and High
   - Suggested fixes where applicable
   - Explicit attestation per invariant I1–I7
2. **Reproducible PoCs** for every Critical and High finding.
3. **Re-verification letter** signed after remediation against a specific commit hash.
4. **Right to publish** the report in this repository.

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All eight checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `READY` or `READY WITH ACCEPTED RISKS`.
- [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) §"Audit completion status" is updated.
- `CHANGELOG.md` carries a disclosure entry referencing the report.

A verdict of `BLOCKED` keeps mainnet deployment paused per [`README.md`](../README.md) §4.

---

## 10. References

- [Issue #112](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
- [Audits index](../README.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Report template](../REPORT_TEMPLATE.md)
- [Engagement status](./STATUS.md)
- [Audit Readiness](../../AUDIT_READINESS.md)
- [Audit Scope](../../../../audit/SCOPE.md)
- [Formal Invariants](../../../../audit/INVARIANTS.md)
- [Threat Model](../../../../audit/THREAT_MODEL.md)
- [Freeze Metadata](../../../../audit/FREEZE_METADATA.md)
- [Build Instructions](../../../../audit/BUILD_INSTRUCTIONS.md)
- [Test Coverage Report](../../../../audit/TEST_COVERAGE_REPORT.md)
- [Internal Per-Contract Audit](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md)
- [Full System Audit](../../../audit/FULL_SYSTEM_AUDIT.md)
- [External Audit Intro Pack](../../../audit/external-audit-intro.md)
- [Development Roadmap — Track A](../../../../TEMP/DEVELOPMENT_ROADMAP.md)
