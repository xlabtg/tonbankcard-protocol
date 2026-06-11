# TONBANKCARD Protocol — Full System Audit

**Document Type:** Master Audit
**Issue Reference:** [#74 — Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/00_master_audit.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Objective & Scope](#1-objective--scope)
2. [Architecture Audit](#2-architecture-audit)
3. [Smart Contract Audit](#3-smart-contract-audit)
4. [Security Audit](#4-security-audit)
5. [Economic Audit](#5-economic-audit)
6. [Governance Audit](#6-governance-audit)
7. [Integration Audit](#7-integration-audit)
8. [Infrastructure Audit](#8-infrastructure-audit)
9. [Documentation Audit](#9-documentation-audit)
10. [Findings Summary](#10-findings-summary)
11. [Risk Classification](#11-risk-classification)
12. [Recommendations Roadmap](#12-recommendations-roadmap)

---

## 1. Objective & Scope

This document provides a full, system-wide audit of the TONBANKCARD protocol across eight layers: architecture, smart contracts, security, economics, governance, documentation, infrastructure, and integrations.

### 1.1 Audit Goals

- Identify missing components
- Identify inconsistencies between specification and implementation
- Uncover unverified assumptions
- Document production readiness gaps

### 1.2 Protocol Context

TONBANKCARD is a non-custodial virtual bank protocol built on the TON blockchain. It uses:
- NFT-based account abstraction (each NFT = one account)
- TBC token as internal settlement layer (zero-fee transfers)
- TONCO DEX for TBC/TON liquidity
- External gateways (ChangeNOW, NOWPayments, CoinRabbit) for on/off ramp

Core security property: **the protocol never takes custody of user funds**.

### 1.3 Components Reviewed

| Layer | Components |
|-------|------------|
| Smart Contracts | PaymentHub.tact, MerchantPaymentHub.tact, account-locks.fc, nft_account_resolver.fc/.tact, account-state.tact, CollateralSignal.tact, governance contracts |
| Off-chain | Indexer (backend/indexer), Merchant API (api/), SDK (sdk/) |
| External Adapters | ChangeNOW, NOWPayments, CoinRabbit |
| Documentation | All docs/ files |
| Infrastructure | CI/CD (.github/workflows/), deployment scripts |

---

## 2. Architecture Audit

### 2.1 Alignment with Architecture Baseline

**Finding: ALIGNED ✅**

The protocol implementation follows the Architecture Baseline documented in `docs/architecture.md`. The four-layer model (TON Blockchain → On-Chain Contracts → Off-Chain Services → External Integrations) is consistently applied throughout.

**Verified properties:**
- Payment Hub routes requests, does not hold balances — **verified** (no balance storage in hub)
- NFT ownership is the sole account authority — **verified** (all transfer functions check NFT owner)
- Off-chain components are read-only with respect to funds — **verified** (no signing keys in indexer/API)
- External adapters are untrusted — **verified** (I7 invariant enforced)

### 2.2 Trust Boundary Verification

**Finding: COMPLETE ✅**

Four trust levels are defined and enforced:

| Level | Components | Enforced By |
|-------|------------|-------------|
| L1 — Absolute | TON consensus, TVM, Ed25519 | Structural (cannot be bypassed) |
| L2 — High (Immutable) | Deployed smart contracts | Immutable deployment, no upgrade proxies |
| L3 — Medium | Indexer, Merchant API, SDK | Read-only by design; no signing keys |
| L4 — Low (External) | ChangeNOW, NOWPayments, CoinRabbit | Output treated as informational only |

**Gap identified:** The boundary between L3 (Merchant API) and L4 (External) is correctly documented, but the Merchant API's webhook validation for external providers lacks a formally specified test plan. See Section 7.3.

### 2.3 Non-Custodial Guarantee Verification

**Finding: STRUCTURALLY ENFORCED ✅**

The non-custodial guarantee is enforced at the architecture level:
- No `adminWithdraw`, `emergencyDrain`, or `forcedTransfer` functions exist in any contract (grep-verified)
- Admin roles are limited to pause, flag, and lock operations only
- All fund movements require current NFT owner signature at execution time

**Residual gap:** Admin can set FRAUD_LOCK without time-limit expiration. A sufficiently long lock approaches functional confiscation. This is documented in `audit/THREAT_MODEL.md` (R-CRIT-2) and is planned for remediation via DAO governance in Phase 2.

---

## 3. Smart Contract Audit

### 3.1 Code Correctness

**Finding: ADEQUATE WITH KNOWN GAPS ⚠️**

Contracts implement the specified behavior for all happy paths. The following known correctness gaps require remediation before mainnet deployment:

| Gap | Contract | Severity | Status |
|-----|----------|----------|--------|
| Test-only functions have no access control | `MerchantPaymentHub.tact` | HIGH | Known, documented |
| ~~`RegisterNFTOwner` has no access control~~ | `CollateralSignal.tact` | ~~HIGH~~ | **RESOLVED (Issue #364)** — handler removed; ownership registered only via the `nft_resolver`-gated `ResolveNFTOwner`, write-once (CONTRACTS-M1) |
| ~~`InitializeAccount` overwrites an existing account's owner/balance~~ | `PaymentHub.tact` | ~~HIGH~~ | **RESOLVED (Issue #371 / PC-02)** — `InitializeAccount` is create-once (`require(self.accounts.get(msg.nft_address) == null, "Account already initialized")`); a compromised admin can no longer re-initialize a funded slot to reassign `owner` and drain it (I1/I3). Account read path made side-effect free so a query cannot squat a slot |
| TransparencyRegistry record messages unprotected | `TransparencyRegistry.tact` | HIGH | Known, documented |
| Governance proposal/vote NFT ownership unverified | `ProposalRegistry.tact` | HIGH | Known, documented |
| FunC Payment Hub missing Account Locks check | `payment-hub.fc` | HIGH | Known, documented |

These gaps are documented in `docs/security/SECURITY.md` (Section 3) and `docs/security/THREAT_MODEL.md` (Section 4.1.5). None affect currently deployed contracts (all listed contracts are pre-deployment).

### 3.2 State Machine Integrity

**Finding: SOUND ✅**

The `account-state.tact` state machine correctly implements the five-state model: `UNINITIALIZED → ACTIVE → FROZEN → ACTIVE (after unfreeze) / SUSPENDED`. State transitions are validated before execution. No transition loop that bypasses access control was found.

### 3.3 Access Control

**Finding: PARTIALLY COMPLETE — PRE-PRODUCTION GAPS ⚠️**

For production-ready contracts (PaymentHub.tact, MerchantPaymentHub.tact, account-locks.fc):
- NFT ownership enforced at transfer execution time ✅
- Admin functions limited to operational flags only ✅
- risk_authority and lending_adapter roles are distinct and non-overlapping ✅

For pre-deployment contracts with documented gaps (see 3.1 above), access control must be added before deployment.

### 3.4 Invariant Enforcement

**Finding: ALL 7 INVARIANTS ENFORCED FOR IN-SCOPE CONTRACTS ✅**

| Invariant | Code Location | Test Coverage | Status |
|-----------|---------------|---------------|--------|
| I1 — Non-Custodial | PaymentHub:164, MerchantHub:90-96 | `tests/invariants/I1-*` | ✅ |
| I2 — NFT Authority | PaymentHub:36, nft_resolver:61-69 | `tests/invariants/I2-*` | ✅ |
| I3 — No Admin Control | account-locks:160-217 | `tests/invariants/I3-*` | ✅ |
| I4 — Atomic Transfers | PaymentHub:149-202 | `tests/invariants/I4-*` | ✅ |
| I5 — Conservation | PaymentHub:197-198 | `tests/invariants/I5-*` | ✅ |
| I6 — Lock ≠ Confiscation | account-locks:83-110 | `tests/invariants/I6-*` | ✅ |
| I7 — Adapter Isolation | All contracts (structural) | `tests/invariants/I7-*` | ✅ |

---

## 4. Security Audit

### 4.1 Threat Model Completeness

**Finding: COMPREHENSIVE — 8 THREAT CLASSES COVERED ✅**

The threat model (`docs/security/THREAT_MODEL.md`, `audit/THREAT_MODEL.md`) covers:

| Class | Coverage | Residual Risk |
|-------|----------|---------------|
| T1 — NFT Transfer Race | Mitigated (execution-time check) | LOW |
| T2 — Reentrancy & Callback Abuse | Mitigated (actor model + guard) | LOW |
| T3 — Ledger Desynchronization | Mitigated (jetton as truth) | LOW |
| T4 — Lock Bypass | Partial (advisory for direct jetton) | HIGH (documented) |
| T5 — Merchant Payment Abuse | Partial (no on-chain invoice uniqueness) | MEDIUM |
| T6 — External Adapter Exploits | Mitigated (informational only) | MEDIUM |
| T7 — Oracle / Price Manipulation | N/A (lending not implemented) | FUTURE |
| T8 — Admin Key Compromise | Partial (single admin key) | CRITICAL (documented) |

### 4.2 Key Management

**Finding: DOCUMENTED WITH KNOWN GAPS ⚠️**

Key management is formally specified in `docs/security/KEY_MANAGEMENT.md`. The primary operational risk is the use of single admin keys for Payment Hub and risk_authority.

**Current state (HIGH RISK — documented, accepted for Phase 1):**
- Admin key: Single address — DoS risk if compromised
- risk_authority key: Single address — Mass lock censorship risk if compromised

**Planned remediation (from roadmap):**
- Q1 2026: Multi-sig 3-of-5 admin key
- Q2 2026: Time-locked governance (48-hour delay)
- Q3 2026: Full DAO governance

### 4.3 Incident Response

**Finding: COMPLETE ✅**

Incident response procedures are defined in two complementary documents:
- `docs/security/INCIDENT_RESPONSE.md` — Security-specific (key compromise, exploit response)
- `docs/governance/INCIDENT_RESPONSE.md` — Governance escalation, communication, post-mortems

Four severity levels (LOW, MEDIUM, HIGH, CRITICAL) are defined with response timelines.

**Note:** No kill-switch exists by design. Emergency response uses the new-contract-deployment pattern, preserving the non-custodial guarantee.

### 4.4 Attack Surface Coverage

**Finding: COMPLETE FOR CURRENT SCOPE ✅**

Attack surface diagram is documented in `docs/attack-surface-diagram.md`. All identified surfaces are either mitigated, accepted (with documentation), or planned for future remediation.

---

## 5. Economic Audit

### 5.1 Incentive Alignment

**Finding: ALIGNED FOR CURRENT SCOPE ✅**

The protocol's fee structure is straightforward and documented:

| Operation | Fee | Economic Incentive |
|-----------|-----|--------------------|
| Internal TBC transfer | Zero (TON gas only) | Encourages on-chain settlement |
| DEX swap (TBC/TON) | ~0.3% TONCO pool fee | Standard AMM rate |
| External deposit | Gateway fee | Market rate; no protocol markup |
| External withdrawal | Gateway fee + slippage | Market rate; no protocol markup |

Zero-fee internal transfers create network effects (more users = more settlement value).

**Gap:** The economic model is informally documented in `docs/architecture.md` but lacks a formal economic model document. **Recommendation:** Create `docs/economics/ECONOMIC_MODEL.md` with formal game-theoretic analysis.

### 5.2 Fee Sustainability

**Finding: PROTOCOL LAYER IS ZERO-FEE BY DESIGN ✅**

The protocol deliberately charges no fees on internal transfers. Protocol sustainability is not fee-dependent — it depends on TBC token utility and adoption, which drives DEX liquidity depth.

### 5.3 Liquidity Assumptions

**Finding: SINGLE POOL DEPENDENCY ⚠️**

The protocol relies on a single TBC/TON pool on TONCO DEX. Key assumptions:
- Pool has sufficient depth for expected transaction volumes
- TONCO DEX remains operational
- TBC/TON price is discoverable via market

**Gap:** No formal liquidity floor specification exists. Under extreme conditions (>90% liquidity drop), external withdrawals may fail due to excessive slippage. See `docs/economics/SIMULATIONS.md` for detailed stress-test scenarios.

### 5.4 Attack Scenarios

**Finding: DOCUMENTED ⚠️**

The following economic attack vectors are documented:
- Merchant fraud (user must sign — medium risk)
- Fee exploitation (zero fees means no fee extraction attack surface)
- Liquidity drain via coordinated sell pressure (external, not protocol-level)

Full attack simulations are in `docs/economics/SIMULATIONS.md`.

---

## 6. Governance Audit

### 6.1 DAO Constraints

**Finding: GOVERNANCE IS NON-EXECUTABLE — SAFE ✅**

Current governance implementation (`contracts/governance/`) is read-only and advisory:
- `ProposalRegistry.tact` — Records proposals on-chain; no execution mechanism
- `SnapshotVerifier.tact` — Verifies NFT ownership snapshots; no fund access
- `TransparencyRegistry.tact` — Records governance metadata; no execution

No governance path can directly modify protocol behavior, transfer funds, or upgrade contracts. Any upgrade requires a new contract deployment and voluntary user migration.

### 6.2 NFT Distribution Risk

**Finding: KNOWN RISK — DOCUMENTED ⚠️**

TBC Diamonds (governance NFT): Fixed supply of 222 tokens. Concentration risk exists if a small number of holders accumulate a majority. This is documented and accepted for Phase 1.

**Mitigation in place:** Governance is advisory-only in Phase 1. Even a 100% Diamond holder cannot force protocol changes — they can only signal preferences.

### 6.3 Proposal System Integrity

**Finding: ACCESS CONTROL GAP — PRE-PRODUCTION ⚠️**

`ProposalRegistry.tact` does not verify that proposal submitters hold governance NFTs. This means anyone can submit proposals. Since governance is advisory-only in Phase 1, the practical impact is limited (spam proposals don't execute anything).

**Must be fixed before Phase 2** when governance gains executable authority.

### 6.4 Snapshot Eligibility Oracle Integrity

**Finding: SENDER-AUTHENTICATED — RESOLVED ✅ (Issue #370 / PC-01)**

`SnapshotVerifier.tact` is the eligibility oracle that `ProposalRegistry` consults (via the `EligibilityCheckRequest` / `EligibilityCheckResponse` exchange) to decide which Diamond NFTs may vote. Its `RegisterSnapshot` handler previously performed **no** `sender()` check, so any external address could register or overwrite the eligibility roll for any `proposal_id` — forging the electorate.

**Remediation (this audit cycle):**
- `RegisterSnapshot` now requires `sender() == trusted_indexer`. The `trusted_indexer` slot starts `null`, so the handler **fails closed** (rejects every registration) until the deployer designates the writer.
- The trusted indexer is set by the deployer-only, **rotatable** `SetTrustedIndexer` message (`require(sender() == deployer)`), with the deployer being the governance multi-sig in production.
- The companion `set_registry` binding was hardened from first-caller-wins to deployer-only (`require(sender() == deployer)`) while keeping the write-once guard.
- The `isEligible` default remains **fail-closed**: it returns `false` when no authorised snapshot is registered (audit L-2 — there is no permissive "all NFTs eligible" fallback).

Eligibility decisions therefore derive only from snapshots written by the authorised trusted indexer. Regression coverage: `contracts/governance/SnapshotVerifier.spec.ts` (non-indexer rejection, fail-closed-before-configuration, deployer-only configuration, authorised write, forged-overwrite rejection). Residual exposure is limited to a compromised trusted-indexer key, mitigated by the rotatable deployer-only setter and the multi-sig requirement (PARAMETERS.md PP-41).

---

## 7. Integration Audit

### 7.1 External Providers

**Finding: CORRECTLY ISOLATED ✅**

All three external providers (ChangeNOW, NOWPayments, CoinRabbit) are integrated at L4 (untrusted) trust level:
- Adapters in `backend/adapters/` are read-only (no signing capability)
- API responses are informational only — on-chain confirmation required before settlement
- No external adapter has direct smart contract call capability

### 7.2 Merchant Flows

**Finding: USER-PROTECTED, MERCHANT RESPONSIBILITY FOR REPLAY ⚠️**

Merchant payment flow is correctly designed: all payments require payer signature. Users cannot be charged without consent.

**Gap:** Invoice replay protection is off-chain only. Merchants are responsible for deduplication. This is a documented accepted risk (risk borne by merchants, not users).

**Update (Issue #373 / PC-04):** the off-chain idempotency itself was unreliable — `generateIdempotencyKey` serialised with `JSON.stringify(data, Object.keys(data).sort())`, whose replacer array recursively dropped every nested key, so two creates differing only inside `metadata` collided and the second was served as a replay of the first. The key is now built from a recursive `canonicalize` (`api/src/utils/helpers.ts`) that sorts keys at every level, so nested `metadata.*` differences produce distinct keys while staying order-invariant; `hashMetadata` shares the same helper (byte-identical for the flat payloads it hashes, so on-chain matching is unchanged). Locked by a CI regression suite (`api/tests/helpers.test.ts`, golden-vector pinned) and a standalone before/after reproduction (`experiments/issue-373-idempotency-key/`).

**Update (Issue #374 / PC-05):** the merchant PaymentWidget (`sdk/src/widget/PaymentWidget.ts`) built its `ton://transfer/<merchantNft>?amount=...&text=...` deep link from raw, unencoded `merchantNft`/`amount`, so a crafted value (e.g. `amountTbc = "10&bin=evil"`) could inject or override the query parameters the payer's wallet receives. `generatePaymentLink` now validates `merchantNft` against the TON address format and `amount` as a non-negative integer string, then percent-encodes every interpolated component, so reserved characters (`&`, `?`, `#`, `=`) can no longer break out of their field. Both validators are dependency-free regex checks (`assertMerchantNft` / `assertAmount`) so the `<script>`-tag browser/IIFE bundle (`dist/index.global.js`) stays free of `@ton/core` / `@ton/crypto` — build artifacts verified to contain zero `@ton/*` references; this mirrors the sibling mobile fix (`mobile/src/services/PaymentService.ts`, FRONTEND-H2). Locked by a CI regression suite (`sdk/tests/widget.spec.ts`, `generatePaymentLink security (PC-05)`, 10 tests).

**Update (Issue #375 / PC-06):** the three SDKs each implement a "canonical JSON" whose bytes must match so that an invoice ID / payload hash produced by one SDK verifies under another, but two divergences broke that contract: the line/paragraph separators U+2028/U+2029 were emitted as raw UTF-8 by Node/Python yet escaped to `\u2028`/`\u2029` by Go, and Python's float formatting differed from Node/Go (`2.0` vs `2`, `1e+16` vs `10000000000000000`), so any payload carrying those characters or a float hashed to a different SHA-256 per language. A single policy is now enforced identically in all three: U+2028/U+2029 are always escaped to `\u2028`/`\u2029`; floating-point numbers are rejected; only integers in the 53-bit safe range are accepted as plain decimals, with larger/fractional amounts required as decimal strings (the on-chain `amount_tbc`/`timestamp` fields already are strings, so invoice-ID and payload-hash paths are unchanged). Locked by a shared conformance vector set (`tests/fixtures/pc-06-canonical-conformance.json`, including U+2028/U+2029 and the divergent numeric forms) that drives a CI suite in every SDK — `sdk/tests/utils.spec.ts`, `sdk-python/tests/test_hashing.py`, `sdk-go/conformance_test.go` — proving identical logical inputs yield identical canonical bytes and SHA-256 digests; the Go/Python workflow `paths` filters were extended with `tests/fixtures/**` and a standalone reproduction lives in `experiments/issue-375-canonical-json/`.

### 7.3 API Trust Boundaries

**Finding: CORRECT ARCHITECTURE, INCOMPLETE WEBHOOK VALIDATION SPEC ⚠️**

The Merchant API correctly acts as an orchestration layer, not an authoritative one. However, the webhook validation specification for external providers (NOWPayments callbacks, ChangeNOW callbacks) lacks a formal test plan.

**Update (Issue #372 / PC-03):** the NOWPayments IPN path is now closed — `verifyCallback()` performs real HMAC-SHA512 verification (was a length-only placeholder) and is locked by a CI regression suite (`tests/nowpayments-adapter/`, golden-vector pinned) plus a standalone before/after reproduction (`experiments/issue-372-nowpayments-hmac/`). The residual gap is the ChangeNOW callback test plan.

**Recommendation:** Add formal webhook validation tests to the security testing strategy.

---

## 8. Infrastructure Audit

### 8.1 Indexer Correctness

**Finding: CORRECT DESIGN WITH KNOWN STALENESS ⚠️**

The indexer (`backend/indexer/`) is correctly designed as a read-only blockchain cache. Key properties:
- Reorg handling documented in `backend/indexer/docs/REORG_HANDLING.md`
- Data is advisory; blockchain is authoritative
- Polling-based sync with configurable interval

**Gap:** No formal specification of maximum acceptable staleness (lag) before the indexer is considered degraded. See `docs/production/SLA.md` for SLA definition.

### 8.2 API Statelessness

**Finding: STATELESS BY DESIGN ✅**

The Merchant API (`api/src/`) routes requests but holds no authoritative state. Invoice state is stored in merchant backends. Payment settlement state is authoritative on-chain.

### 8.3 Failure Modes

**Finding: PARTIALLY DOCUMENTED ⚠️**

Documented failure modes:
- Indexer downtime: UI shows stale data; no fund risk
- External adapter downtime: Off-ramp/on-ramp unavailable; no fund risk
- API downtime: Invoice creation unavailable; on-chain payments still work

**Gap:** No formal runbook for each failure mode. Recommendation: Create `docs/production/RUNBOOK.md` with operational procedures.

---

## 9. Documentation Audit

### 9.1 Consistency

**Finding: MOSTLY CONSISTENT — MINOR CROSS-REFERENCES MISSING ⚠️**

Core documentation is consistent across:
- Architecture docs and contract implementations align
- Invariant definitions match contract code comments
- Threat model references are correctly cross-linked

**Minor gaps:**
- `docs/litepaper/litepaper-v1.md` references some features not yet implemented (lending adapter) — appropriately marked as "planned"
- `docs/whitepaper/whitepaper-v1.md` economic section lacks formal model reference

### 9.2 Completeness

**Finding: COMPLETE FOR CURRENT SCOPE ✅**

All major components have documentation:
- Architecture: `docs/architecture.md`
- Security: `docs/security/` (5 documents)
- Governance: `docs/governance/` + `docs/governance*.md`
- Smart Contracts: Per-contract READMEs + `docs/contracts/`
- Integration: `docs/integrations/`
- Versioning: `docs/versioning-policy.md`
- Deployment: `docs/deployments/`

### 9.3 No Contradictions

**Finding: NO MATERIAL CONTRADICTIONS ✅**

Cross-reference audit found no material contradictions between:
- Invariant definitions and contract implementations
- Threat model mitigations and code evidence
- Architecture baseline and actual structure

Minor version discrepancies between individual doc timestamps are cosmetic.

---

## 10. Findings Summary

### 10.1 Critical Findings (Require Pre-Deployment Remediation)

| ID | Layer | Finding | Contract | Action Required |
|----|-------|---------|----------|----------------|
| F-CRIT-1 | Smart Contract | Test-only functions without access control | `MerchantPaymentHub.tact` | Remove or gate before deployment |
| F-CRIT-2 ✅ | Smart Contract | `RegisterNFTOwner` no access control — **RESOLVED (Issue #364)** | `CollateralSignal.tact` | ~~Add NFT ownership verification~~ — Done: handler removed; ownership registered only via the `nft_resolver`-gated `ResolveNFTOwner`, write-once (CONTRACTS-M1) |
| F-CRIT-3 | Smart Contract | TransparencyRegistry messages unprotected | `TransparencyRegistry.tact` | Add authorization check |
| F-CRIT-4 | Smart Contract | Governance proposals not NFT-gated | `ProposalRegistry.tact` | Add NFT ownership check |
| F-CRIT-5 | Smart Contract | FunC Payment Hub missing lock check | `payment-hub.fc` | Add Account Locks call |

### 10.2 High Risks (Documented, Accepted for Phase 1)

| ID | Layer | Finding | Mitigation Status |
|----|-------|---------|-------------------|
| F-HIGH-1 | Security | Single admin key (DoS, censorship risk) | Documented, DAO migration planned Q3 2026 |
| F-HIGH-2 | Security | Direct TBC jetton bypasses Account Locks | Architectural limitation, documented |
| F-HIGH-3 | Integration | No on-chain invoice replay protection | Off-chain merchant responsibility |

### 10.3 Medium Risks (Accept and Monitor)

| ID | Layer | Finding | Mitigation Status |
|----|-------|---------|-------------------|
| F-MED-1 | Infrastructure | No formal indexer staleness SLA | See `docs/production/SLA.md` |
| F-MED-2 | Infrastructure | No formal runbook for failure modes | Recommendation: create runbook |
| F-MED-3 | Integration | Webhook validation test plan incomplete | See `docs/security/TESTING_STRATEGY.md` |
| F-MED-4 | Economics | No formal liquidity floor specification | See `docs/economics/SIMULATIONS.md` |
| F-MED-5 | Governance | No NFT gate on proposals (Phase 1 only) | Advisory-only; fix before Phase 2 |

### 10.4 Low / Cosmetic Issues

| ID | Layer | Finding |
|----|-------|---------|
| F-LOW-1 | Documentation | Some doc timestamps lag behind code changes |
| F-LOW-2 | Documentation | Economic model not formally documented as standalone |
| F-LOW-3 | Infrastructure | No formal capacity planning documented |

---

## 11. Risk Classification

Risk scoring follows: **Severity × Likelihood**

| Risk ID | Severity | Likelihood | Score | Status |
|---------|----------|-----------|-------|--------|
| F-CRIT-1 to F-CRIT-5 | CRITICAL | HIGH (pre-deployment) | 🔴 CRITICAL | Must fix before deploy |
| F-HIGH-1 | HIGH | MEDIUM | 🟠 HIGH | Accepted Phase 1; roadmap exists |
| F-HIGH-2 | HIGH | LOW | 🟡 MEDIUM | Architectural, documented |
| F-HIGH-3 | MEDIUM | LOW | 🟡 MEDIUM | Merchant responsibility |
| F-MED-1 to F-MED-5 | MEDIUM | LOW | 🟡 MEDIUM | Monitor and improve |
| F-LOW-1 to F-LOW-3 | LOW | N/A | 🟢 LOW | Cosmetic |

---

## 12. Recommendations Roadmap

### Immediate (Before Any Mainnet Deployment)

1. Remove or properly gate test-only functions in `MerchantPaymentHub.tact`
2. ~~Add NFT ownership verification to `CollateralSignal.tact` → `RegisterNFTOwner`~~ — **DONE (Issue #364):** `RegisterNFTOwner` removed; ownership registered only via the `nft_resolver`-gated `ResolveNFTOwner`, write-once (CONTRACTS-M1)
3. Add authorization to `TransparencyRegistry.tact` record handlers
4. Add NFT ownership check to `ProposalRegistry.tact` proposal submission
5. Add Account Locks check to `payment-hub.fc` transfer path

### Short-Term (Phase 1 Completion, Q2 2026)

6. Implement multi-sig admin key (3-of-5) replacing single admin key
7. Add time-lock delay to admin pause operations
8. Create formal economic model documentation
9. Define liquidity floor and slippage tolerance specifications
10. Complete webhook validation test plan

### Medium-Term (Phase 2, Q3 2026)

11. Migrate admin keys to DAO governance
12. Add NFT gate to proposal submission in `ProposalRegistry.tact`
13. Implement invoice uniqueness tracking (optional on-chain or mandatory off-chain)
14. Add lock expiration timestamps to prevent indefinite locks
15. Expand security testing per `docs/security/TESTING_STRATEGY.md`

---

## References

- **Audit Package:** [`audit/`](../../audit/)
- **Threat Model:** [`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md)
- **Invariants:** [`docs/invariants.md`](../invariants.md)
- **Architecture:** [`docs/architecture.md`](../architecture.md)
- **Security Framework:** [`docs/security/SECURITY.md`](../security/SECURITY.md)
- **Key Management:** [`docs/security/KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md)
- **Incident Response:** [`docs/security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md)
- **Economic Simulations:** [`docs/economics/SIMULATIONS.md`](../economics/SIMULATIONS.md)
- **Security Testing:** [`docs/security/TESTING_STRATEGY.md`](../security/TESTING_STRATEGY.md)
- **Compliance Map:** [`docs/compliance/REGULATORY_MAP.md`](../compliance/REGULATORY_MAP.md)
- **SLA:** [`docs/production/SLA.md`](../production/SLA.md)
- **Monitoring:** [`docs/production/MONITORING.md`](../production/MONITORING.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
