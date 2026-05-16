# Engagement A2 — Formal Security Audit of Phase 4 Contracts

**Engagement ID:** `A2`
**Issue:** [#113 — A2 Formal Security Audit — Phase 4 Contracts](https://github.com/xlabtg/tonbankcard-protocol/issues/113)
**Roadmap track:** A — Security & Audit
**Status:** Engagement preparation complete — awaiting A1 sign-off and firm selection
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Objective

Procure a **separate, dedicated formal external security audit** of the four Phase 4 advanced smart contracts (cross-chain bridge, multi-sig card, recurring payments, lending coordinator). Successfully completing this engagement is a mandatory gate before any TONBANKCARD mainnet deployment touching the in-scope contracts, and before the corresponding Phase 4 activation work in Track F (F3 — Cross-Chain Bridge Production Readiness, F4 — Recurring Payments Activation, F5 — Multi-Sig Card Activation).

Per issue #113 §2, this engagement **may only begin after engagement [A1](../A1-core-contracts/ENGAGEMENT.md) is complete** — i.e., A1's audited contracts are cleared (verdict `READY` or `READY WITH ACCEPTED RISKS`) and the audit firm has full context of the protocol invariants. This ordering exists because the Phase 4 contracts are authorised through the same `nft_owners` / ownership pattern as the core contracts and inherit their trust assumptions.

Success criteria (mirror of issue #113 acceptance criteria):

- [ ] A1 audit completed and core contracts cleared before this audit begins
- [ ] Separate audit engagement from the core contract audit (not bundled with A1)
- [ ] Cross-chain bridge receives **dedicated review** with replay and validator scenarios
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

The audit covers exactly the four Phase 4 advanced contracts listed in issue #113 §3:

| # | Contract | File | Language | Reason |
|---|----------|------|----------|--------|
| 1 | CrossChainBridge | `contracts/CrossChainBridge.tact` | Tact | Cross-chain asset transfers between TON and EVM chains (intent / confirm / cancel coordination) |
| 2 | MultiSigCard | `contracts/MultiSigCard.tact` | Tact | Multi-party account control (M-of-N signing, proposal lifecycle) |
| 3 | RecurringPayments | `contracts/RecurringPayments.tact` | Tact | Subscription and time-based recurring payment mandates |
| 4 | LendingProtocolCoordinator | `contracts/LendingProtocolCoordinator.tact` | Tact | External lending protocol coordination (opt-in lending intents) |

Supporting types and interfaces (`contracts/types/`, `contracts/interfaces/INFTResolver.tact`, `contracts/interfaces/ICollateralSignal.tact`) are in scope **for context only** — they are reviewed insofar as they affect the contracts above. They were covered by the internal per-contract audit in [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) and by engagement [A1](../A1-core-contracts/ENGAGEMENT.md).

The internal pre-audit also already raised findings for three of the four Phase 4 contracts (`C-CCB-*`, `C-LPC-*`, `C-MSC-*` and cross-cutting `X-1`/`X-2`/`X-5`). These findings — including the mitigations already applied in PR #109 (gating the test-only `RegisterNFTOwner…` handlers behind the contract deployer) — are the **starting baseline** for this engagement, not the ending state. The auditor is expected to **independently** re-evaluate each finding on the audited commit and to assess whether the remaining mitigations are sufficient. `RecurringPayments.tact` was explicitly flagged in §5 of the internal audit as not previously visited, so it requires fresh coverage.

---

## 3. Out of Scope

Explicitly **not** part of this engagement (per issue #113 §4):

- **Core Phase 2 contracts** (`PaymentHub.tact`, `MerchantPaymentHub.tact`, `account-locks.fc`, `nft-resolver/*`, `CollateralSignal.tact`, `PublicCollateralLookup.tact`) — covered by engagement [A1](../A1-core-contracts/ENGAGEMENT.md)
- **Off-chain services** (`api/`, `backend/`, `sdk/`) — covered by engagement **A4**
- **Bridge validator infrastructure** (off-chain relayers, ChangeNOW or other external adapters) — external to this repository
- **Governance contracts** (`contracts/governance/*`) — covered in **Track E**
- **Frontend, dashboard, wallet UI** — covered by Track F UX work
- **TBC jetton master**, NFT item / collection contracts, TONCO DEX pool — treated as trust assumptions (see [`audit/SCOPE.md`](../../../../audit/SCOPE.md) §"Out-of-Scope Components")

The cross-chain bridge's **external** verification path (ChangeNOW / relayers) is treated as an explicit trust assumption — the audit must surface every contract-side assumption about that trust, but the external infrastructure itself is not in scope.

---

## 4. Threat Model — Required Coverage

Per issue #113 §5, the auditor must explicitly evaluate every threat enumerated below, mapped to the protocol-level threat model in [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md) and the invariants in [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md).

### 4.1 `CrossChainBridge.tact`

| # | Threat | Where to look |
|---|--------|---------------|
| CCB-1 | **Cross-chain message replay** — identical message replayed on source or destination chain | `RegisterBridgeIntent` / `ConfirmBridgeExecution` (lines 159–214 / 217–266), `intentKey` (line 377) |
| CCB-2 | **Bridge validator compromise** — malicious or colluding relayer set approving invalid transfers | `authorized_relayers` map, `isAuthorizedRelayer` (lines 366–373), `RegisterRelayer` (lines 412–415), C-CCB-H1 |
| CCB-3 | **Double-spend on bridge** — asset credited on destination before confirmed burned on source | Status transitions `PENDING → CONFIRMED` (lines 246–256), atomicity of `confirmed_at` write |
| CCB-4 | **TVL drain via oracle manipulation** — incorrect price / amount conversion across chains | `amount` field (informational), absence of price oracles, validity of off-chain conversion assumptions |
| CCB-5 | **Chain reorganization handling** — source-chain reorg invalidating a bridged transfer | `external_tx_hash` provenance, absence of finality proofs, indexer responsibilities |
| CCB-6 | **Composite-key collision** — internal pre-audit C-CCB-H2 / X-5 | `intentKey` uses `sha256(addr) + intent_id` (Int addition, not concatenation) |
| CCB-7 | **Test-only backdoor residual risk** — C-CCB-C1 / cross-cutting X-1 | `RegisterNFTOwnerBridge` / `RegisterRelayer` deployer gating (lines 402–415) |

### 4.2 `MultiSigCard.tact`

| # | Threat | Where to look |
|---|--------|---------------|
| MSC-1 | **Signature replay** — reusing valid signatures from prior M-of-N approvals | `approvals` map keying (`approvalKey`, line 526), `ApprovePaymentProposal` idempotency (lines 327–337) |
| MSC-2 | **Quorum manipulation** — signer set modification without full quorum consent | `ConfigureMultiSig` allows owner to overwrite signer set unilaterally (lines 199–237); `RemoveMultiSig` (lines 441–463) |
| MSC-3 | **Partial execution** — partially completing a multi-sig operation leaving locked funds | C-MSC-H1 — proposals never settle on-chain; the contract emits events only |
| MSC-4 | **Zero-address signer slot abuse** — internal pre-audit C-MSC-M1 | `isSigner` comparing sender to `signer_3 == zero` (lines 514–520) |
| MSC-5 | **Orphaned pending proposals after `RemoveMultiSig`** — C-MSC-M2 | `RemoveMultiSig` does not finalise pending proposals (lines 441–463) |
| MSC-6 | **Composite-key collision** — C-MSC-H2 / X-5 | `proposalKey` and `approvalKey` use Int addition (lines 526–529) |
| MSC-7 | **Test-only backdoor residual risk** — C-MSC-C1 / cross-cutting X-1 | `RegisterNFTOwnerMultiSig` deployer gating (lines 555–561) |

### 4.3 `RecurringPayments.tact`

| # | Threat | Where to look |
|---|--------|---------------|
| RP-1 | **Time manipulation** — exploiting block timestamp for early / repeated payment triggers | `now()` usage in `ExecuteRecurringPayment` (lines 295–303), `MIN_PERIOD_SECONDS = 3600` (line 105) |
| RP-2 | **Subscription cancellation race** — payment executed during the cancellation window | `CancelMandate` / `ExecuteRecurringPayment` interleavings (lines 217–263 vs. 264–339) |
| RP-3 | **Balance exhaustion griefing** — forcing repeated failed payments to drain gas | Bouncing / refund paths, `sendResponse` with `SendRemainingValue` (lines 392–404) |
| RP-4 | **Settlement gap** — `ExecuteRecurringPayment` only emits an event; actual fund movement happens elsewhere | Lines 264–339 — verify Payment Hub integration assumption is explicit, documented, and matches deployed behaviour |
| RP-5 | **Mandate immutability** — header claims mandates are immutable, but `max_executions == 0` is treated as unlimited | Lines 28–38 (header), lines 308–317 (state transition logic) |
| RP-6 | **Test-only backdoor residual risk** — cross-cutting X-1 | `RegisterNFTOwnerRecurring` deployer gating (lines 415–422) |

### 4.4 `LendingProtocolCoordinator.tact`

| # | Threat | Where to look |
|---|--------|---------------|
| LPC-1 | **Collateral lock bypass** — releasing `COLLATERAL_LOCK` while a loan is active | Verify this contract does **not** call any lock-mutation paths; cross-check against `account-locks.fc` (covered by A1) |
| LPC-2 | **Oracle price manipulation** — exploiting stale collateral price signals | `collateral_signal_amount` is informational only; verify no contract path uses it for authorisation |
| LPC-3 | **Flash loan attack** — rapidly opening / closing collateral positions | `UpdateLendingIntent` resurrecting a `CANCELLED` intent (lines 240–278), C-LPC-M1 |
| LPC-4 | **Conflicting opcodes** — internal pre-audit C-LPC-H1 | `RegisterNFTOwner` (no opcode) vs. dead `message(0x7e8764ef) RegisterNFTOwnerLending` (line 359) |
| LPC-5 | **Test-only backdoor residual risk** — C-LPC-C1 / cross-cutting X-1 | `RegisterNFTOwner` deployer gating (lines 344–351) |

### 4.5 Cross-cutting

| # | Threat | Coverage |
|---|--------|----------|
| X-1 | Ungated `RegisterNFTOwner*` handlers (mitigation: gated by deployer + write-once) | All four Phase 4 contracts |
| X-2 | NFT ownership source-of-truth — local mirror vs. on-chain NFT item | All four Phase 4 contracts use the same mirror pattern |
| X-5 | Composite keys via Int addition | `CrossChainBridge.intentKey`, `MultiSigCard.proposalKey` / `approvalKey` |

Invariant attestation in the final report must cover **I1–I7** as defined in [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md), with particular emphasis on:

- **I1 (Non-Custodial)** — verify that none of the four contracts can move funds, despite their event-emitting flavour
- **I2 (NFT = Account Authority)** — verify the `nft_owners` mirror does not contradict on-chain NFT ownership (X-2)
- **I3 (No Admin Control)** — verify the deployer gating on `RegisterNFTOwner*` is the only privileged path, and that it cannot move funds
- **I6 (Lock ≠ Confiscation)** — verify `LendingProtocolCoordinator` never mutates lock state
- **I7 (External Adapter Isolation)** — verify `CrossChainBridge` and `LendingProtocolCoordinator` only signal to external adapters and never give them on-chain fund-moving authority

---

## 5. Audit Package (Frozen Hand-off)

The protocol team will deliver the following package to the selected firm at engagement kickoff. The audited commit is frozen at the kickoff and recorded in [`STATUS.md`](./STATUS.md) §"Audited commit".

| Artifact | Location | Notes |
|----------|----------|-------|
| Audit intro pack | [`docs/audit/external-audit-intro.md`](../../../audit/external-audit-intro.md) | Protocol intent, trust model, intentional design constraints |
| Scope | [`audit/SCOPE.md`](../../../../audit/SCOPE.md) | Contracts, focus areas, out-of-scope list |
| Threat model (protocol-wide) | [`audit/THREAT_MODEL.md`](../../../../audit/THREAT_MODEL.md) | T1–T8 attack classes with mitigations |
| Threat model (engagement-specific) | This document §4 | CCB-, MSC-, RP-, LPC- threats |
| Formal invariants | [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md) | I1–I7 with contract-line mapping |
| Freeze metadata | [`audit/FREEZE_METADATA.md`](../../../../audit/FREEZE_METADATA.md) | Compiler versions, file hashes, frozen commit |
| Build instructions | [`audit/BUILD_INSTRUCTIONS.md`](../../../../audit/BUILD_INSTRUCTIONS.md) | Reproducible build & test commands |
| Test coverage | [`audit/TEST_COVERAGE_REPORT.md`](../../../../audit/TEST_COVERAGE_REPORT.md) | Coverage breakdown per contract |
| Phase 4 test suites | `tests/cross-chain-bridge/`, `tests/multisig/`, `tests/recurring-payments/`, `tests/lending-adapter/` | Existing adapter test scaffolds |
| Internal pre-audit | [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) §2.15–§2.17 | Known internal findings for CCB / LPC / MSC + cross-cutting (X-1…X-5) |
| Prior mitigation PR | [#109](https://github.com/xlabtg/tonbankcard-protocol/pull/109) | Gating of test-only `RegisterNFTOwner…` handlers behind contract deployer |
| Full system audit | [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../../audit/FULL_SYSTEM_AUDIT.md) | System-wide context |
| Audit readiness | [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) | Entry-point navigation document |
| Audit notes | [`docs/audit-notes.md`](../../../audit-notes.md) | Known accepted limitations |
| A1 outcomes | [`../A1-core-contracts/STATUS.md`](../A1-core-contracts/STATUS.md), A1 final report | Re-verification letter + remediated commit; required gate per §1 |

The auditor receives **read access** to the public GitHub repository at the frozen commit, plus a direct contact channel agreed at kickoff.

---

## 6. Candidate Firms

The same three firm classes accepted for A1 apply (per the roadmap and issue #113 §1):

1. **Top-tier general smart-contract auditors with TON experience**, e.g., Trail of Bits, OtterSec, Halborn.
2. **Layer-1-agnostic auditors with proven non-EVM track record**, e.g., CertiK, Quantstamp, Veridise.
3. **TON-ecosystem specialists**, e.g., CertiK TON desk, TonGuard, scalebit (TON), Veridise TON desk.

A non-exhaustive long list is maintained in [`STATUS.md`](./STATUS.md) §"Firm long list".

For A2 specifically, **cross-chain bridge expertise weighs higher** than for A1 — firms with a demonstrated track record auditing bridge contracts (replay protection, validator set design, double-spend prevention) should be preferred. This is reflected in the evaluation matrix below.

If the same firm that performs A1 is contracted for A2, the engagement must still be **a separate signed scope** with separate deliverables (per issue #113 §7).

### 6.1 Evaluation Matrix

Each shortlisted firm is scored on the following criteria. Numeric scores 1–5 (5 = excellent). Final score = weighted sum. Compared to A1, the weights have been re-balanced to emphasise cross-chain / bridge depth.

| Criterion | Weight | Notes |
|-----------|--------|-------|
| TON / Tact / FunC depth | 20% | Prior TON engagements, in-house TON expertise, Tact language coverage |
| **Cross-chain bridge & multi-sig depth** | **20%** | Public bridge audit reports, replay-protection methodology, multi-sig design experience |
| Methodology rigor | 15% | Manual review hours per LOC, fuzzing / property testing, formal methods readiness |
| Reputation & references | 10% | Publicly available audit reports, ecosystem feedback |
| Re-audit / remediation policy | 15% | Verified re-test included, follow-up support |
| Cost & timeline fit | 10% | Total cost, calendar window, latest available start |
| Communication & transparency | 10% | Daily-stand-up cadence, willingness to publish, NDA flexibility |

### 6.2 Conflict-of-interest screen

Firms must disclose any prior engagement with TONBANKCARD operators, TON Foundation grant overlap, holding of TBC token / TBC Diamonds / Series 7777/8888 NFTs, financial interest in ChangeNOW or any candidate bridge relayer, or other potential conflicts. Disqualifying conditions are recorded in [`STATUS.md`](./STATUS.md).

A firm that audited A1 must additionally disclose whether they reused A1 findings verbatim or re-derived them independently — the A2 audit must produce an independent assessment of any in-scope contract, even if the same team performed A1.

---

## 7. Engagement Process

```
T-A1  A1 engagement reaches verdict READY or READY WITH ACCEPTED RISKS  (gate)
T-0   A2 issue published                                                ✅
T+0   Firm long list assembled (re-using / updating A1 list)            ⏳
T+1w  Shortlist (3 firms) + RFP sent
T+3w  Proposals received, evaluation matrix populated
T+4w  Firm selected, contract signed
T+4w  Audit kickoff:  freeze commit + package handover
T+9w  Mid-audit checkpoint (preliminary findings, with bridge focus)
T+11w Draft report delivered (includes bridge-specific replay scenarios)
T+12w Remediation PRs opened (per REMEDIATION_WORKFLOW.md)
T+15w Remediation merged
T+16w Re-verification by auditor
T+16w Final report published in this directory
T+16w STATUS.md flipped to COMPLETED
T+17w Disclosure summary in CHANGELOG.md + public channels
```

All dates are anchored to the A2 kickoff (`T`) and tracked in [`STATUS.md`](./STATUS.md). `T-A1` is not under A2's control; it is the upstream completion of engagement A1 and is the hard gate for starting A2.

A2 reserves one extra week of audit calendar (`T+9w` mid-audit checkpoint instead of A1's `T+8w`) to give the auditor more bandwidth for the cross-chain bridge review per issue #113 §1.

The remediation phase follows [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) verbatim.

---

## 8. Deliverables From Auditor

The signed engagement must require the following deliverables (mirrored in the report template):

1. **Audit report**, structured per [`../REPORT_TEMPLATE.md`](../REPORT_TEMPLATE.md):
   - Findings categorised by severity
   - Each finding references file:line, invariant(s), and threat-model class (CCB-, MSC-, RP-, LPC-, X-)
   - Reproduction steps for every Critical and High
   - Suggested fixes where applicable
   - Explicit attestation per invariant I1–I7
   - **Dedicated cross-chain bridge section** covering CCB-1 (replay), CCB-2 (validator compromise), and CCB-5 (chain reorg) per issue #113 §1 / §7
2. **Reproducible PoCs** for every Critical and High finding (on-chain test or scripted scenario).
3. **Re-verification letter** signed after remediation against a specific commit hash.
4. **Right to publish** the report in this repository.

If any of the in-scope contracts is recommended for **removal or non-deployment** (the internal audit's `C-MSC-H1` already raises this possibility for `MultiSigCard.tact`), the auditor's recommendation must be explicit — the protocol team will not interpret silence as approval.

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All eleven checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `READY` or `READY WITH ACCEPTED RISKS`.
- [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) §"Audit completion status" is updated with the A2 row populated.
- `CHANGELOG.md` carries a disclosure entry referencing the report.

A verdict of `BLOCKED` keeps **mainnet deployment of any Phase 4 contract** paused per [`../README.md`](../README.md) §4 and blocks the corresponding Track F activation work (F3 / F4 / F5).

---

## 10. References

- [Issue #113](https://github.com/xlabtg/tonbankcard-protocol/issues/113)
- [Issue #112 (A1)](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
- [A1 engagement plan](../A1-core-contracts/ENGAGEMENT.md)
- [A1 engagement status](../A1-core-contracts/STATUS.md)
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
- [Development Roadmap — Track A, A2](../../../../TEMP/DEVELOPMENT_ROADMAP.md)
- [Track F — F3 Cross-Chain Bridge Production Readiness](../../../../ISSUE/F3-crosschain-bridge-production-readiness.md)
- [Track F — F4 Recurring Payments Activation](../../../../ISSUE/F4-recurring-payments-activation.md)
- [Track F — F5 Multi-Sig Card Activation](../../../../ISSUE/F5-multisig-card-activation.md)
- [CrossChainBridge.tact](../../../../contracts/CrossChainBridge.tact)
- [MultiSigCard.tact](../../../../contracts/MultiSigCard.tact)
- [RecurringPayments.tact](../../../../contracts/RecurringPayments.tact)
- [LendingProtocolCoordinator.tact](../../../../contracts/LendingProtocolCoordinator.tact)
