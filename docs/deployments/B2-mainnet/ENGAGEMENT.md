# Engagement B2 — TON Mainnet Deployment Plan

**Engagement ID:** `B2`
**Issue:** [#118 — B2 Mainnet Deployment Plan](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
**Roadmap track:** B — Production Deployment & Operations
**Status:** Engagement preparation complete — awaiting all upstream gates (A1 READY, B1 READY-FOR-B2, D6 verdict)
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

> ⚠️ **Mainnet is irreversible.** Every artifact in this engagement is written under the assumption that no contract can be upgraded, paused remotely, or rolled back after deployment. The acceptance gate (§9) is strictly more conservative than B1.

---

## 1. Objective

Produce a complete, frozen mainnet deployment plan for the **Phase 2 core contracts** of the TONBANKCARD protocol and execute the deployment under a multi-sig ceremony. The engagement publishes:

- A step-by-step [operational runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md) that is followed verbatim at kickoff.
- A frozen [per-contract deployment plan](./DEPLOYMENT_PLAN.md) (init parameters, deterministic order, code-hash matrix).
- A [multi-sig signing ceremony](./MULTISIG_CEREMONY.md) — minimum **2-of-3 hardware-wallet signers**, distinct from testnet signers, with documented recovery procedure.
- A [post-deploy verification plan](./VERIFICATION_PLAN.md) — code-hash, on-chain state, end-to-end test transaction.
- An [immutability verification record](./IMMUTABILITY_VERIFICATION.md) — confirmation that no upgrade path (`set_code(`, admin withdrawal, forced transfer, emergency drain) exists in the deployed bytecode.
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md) — pause / supersede semantics given mainnet immutability.
- A [mainnet manifest schema](./MANIFEST_TEMPLATE.json) — append-only history.

The engagement is the **first activity** of roadmap track **B-Phase-2** and follows B1 testnet validation. Phase 4 contracts (`CrossChainBridge`, `MultiSigCard`, `RecurringPayments`, `LendingProtocolCoordinator`) are **explicitly out of scope** of B2 and remain blocked on engagement **A2** ([engagement A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)).

Success criteria mirror the acceptance criteria in issue #118 §8:

- [ ] Mainnet deployment runbook published ([`scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md))
- [ ] Multi-sig deployer documented (minimum 2-of-3 hardware-wallet signers)
- [ ] Post-deployment verification steps documented ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md))
- [ ] `docs/existing-contracts.md` and `README.md` updated with mainnet addresses after deploy
- [ ] Immutability of deployed contracts verified ([`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md))
- [ ] Roll-back procedures documented for failed deployments ([`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md))

---

## 2. In-Scope Contracts

Exactly the contract sets enumerated in issue #118 §3. All ten Phase 2 contracts are deployed in a single deterministic order — governance contracts (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`) follow the payment-core block but use the same multi-sig ceremony.

### 2.1 Phase 2 — Core protocol (mainnet)

| # | Contract | File | Language | Dependencies |
|---|----------|------|----------|--------------|
| 1 | `AccountLocks` | `contracts/payments/account-locks.fc` | FunC | — |
| 2 | `NFTAccountResolver` (FunC + Tact) | `contracts/nft-resolver/nft_account_resolver.fc` / `.tact` | FunC, Tact | — |
| 3 | `AccountStateMachine` | `contracts/payment-hub/account-state.tact` | Tact | `AccountLocks` |
| 4 | `PaymentHub` | `contracts/payments/PaymentHub.tact` | Tact | `AccountLocks`, `NFTAccountResolver`, `AccountStateMachine` |
| 5 | `MerchantPaymentHub` | `contracts/MerchantPaymentHub.tact` | Tact | `PaymentHub` |
| 6 | `CollateralSignal` | `contracts/CollateralSignal.tact` | Tact | — |
| 7 | `PublicCollateralLookup` | `contracts/collateral-lookup/PublicCollateralLookup.tact` | Tact | `CollateralSignal` |
| 8 | `ProposalRegistry` | `contracts/governance/ProposalRegistry.tact` | Tact | — |
| 9 | `SnapshotVerifier` | `contracts/governance/SnapshotVerifier.tact` | Tact | — |
| 10 | `TransparencyRegistry` | `contracts/governance/TransparencyRegistry.tact` | Tact | — |

Governance contracts (rows 8–10) are deployed in the **same ceremony** but only **activated** (i.e. referenced by client code) after the Phase-2 payment block has been observed in production for ≥ 7 days without Critical findings. The activation policy is recorded in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.2.

The deterministic deployment order is canonicalised in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3 and enforced by [`scripts/deploy/deploy.ts`](../../../scripts/deploy/deploy.ts) (`DEPLOYMENT_ORDER` constant). B2 mirrors the same constant — divergence between this engagement and `deploy.ts` is a CI-blocking defect.

### 2.2 External pre-deployed mainnet artefacts (trust assumptions)

The following mainnet artefacts are **not redeployed** by this engagement. Their canonical mainnet addresses are recorded as trust assumptions in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §6 and cross-referenced from [`docs/existing-contracts.md`](../../existing-contracts.md).

| Artefact | Mainnet address |
|----------|-----------------|
| TBC Jetton | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` |
| NFT Series 7777 collection | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` |
| NFT Series 8888 collection | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` |
| TONCO TBC/TON pool | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` |

---

## 3. Out of Scope

Explicitly **not** part of B2 (issue #118 §4):

- **Phase 4 contracts** (`CrossChainBridge`, `MultiSigCard`, `RecurringPayments`, `LendingProtocolCoordinator`) — blocked on engagement [A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md). The mainnet manifest schema explicitly rejects Phase 4 entries until A2 verdict = `READY`.
- **Testnet deployment** — governed by [B1-testnet/RUNBOOK.md](../B1-testnet/RUNBOOK.md).
- **Production monitoring & alerting** — covered by engagement **B3**.
- **Faucet / public testers** — out of scope, planned under roadmap **C3** (Test Sandbox Environment).
- **Operational keys for production gateways** (NOWPayments, ChangeNOW, CoinRabbit production credentials) — handled by adapter onboarding under engagement **B3**.

External pre-deployed mainnet contracts (TBC jetton, Series 7777/8888 NFT collections, TONCO TBC/TON pool) are not redeployed and remain trust assumptions of the protocol.

---

## 4. Upstream Gates

The engagement may begin once all rows below are ✅. The live state of each gate is mirrored in [`STATUS.md`](./STATUS.md) §2.

| # | Gate | Owner | Evidence |
|---|------|-------|----------|
| G-1 | A1 verdict = `READY` for Phase 2 contracts | Auditor `@A1` | [`docs/security/audits/A1-core-contracts/STATUS.md`](../../security/audits/A1-core-contracts/STATUS.md) |
| G-2 | B1 verdict = `READY-FOR-B2` | `@konard` | [`docs/deployments/B1-testnet/STATUS.md`](../B1-testnet/STATUS.md) §1 |
| G-3 | Contracts build cleanly on the frozen commit | `@konard` | `npx blueprint build` succeeds on commit recorded in [`audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md) |
| G-4 | Internal pre-audit findings remediated (F-CRIT-1 … F-CRIT-5) | `@konard` | [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../audit/FULL_SYSTEM_AUDIT.md) §"Status" |
| G-5 | Formal invariant suite passes (I1–I7) | `@konard` | [`tests/invariants/`](../../../tests/invariants/) green on the deploy commit |
| G-6 | Mainnet deployer multi-sig provisioned (≥ 2-of-3 hardware-wallet signers, **distinct from B1 testnet signers**) | `@konard` | [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) §2 |
| G-7 | Mainnet treasury funded for deployment + buffer | `@konard` | [`STATUS.md`](./STATUS.md) §4 |
| G-8 | Immutability scan of the freeze commit passes (no `set_code(`, no admin withdrawal / drain / forced-transfer) | `@konard` | [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) §3 |
| G-9 | Roll-back procedure rehearsed against the latest B1 manifest | `@konard` | [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §5 |
| G-10 | D6 Acton/Tolk evaluation note recorded (mainnet path remains `scripts/deploy/`, regardless of D6 verdict) | `@konard` | [`STATUS.md`](./STATUS.md) §6 |

If any gate is ❌ at kickoff the engagement is paused and the unmet gate is owned in [`STATUS.md`](./STATUS.md) §12 ("Open questions / blockers"). **No partial mainnet deployment is permitted** — the ceremony is all-or-nothing per contract row.

---

## 5. Engagement Package

The deployment operator receives the following frozen package at kickoff. SHA-256 hashes and locations are tracked in [`STATUS.md`](./STATUS.md) §10.

| Artifact | Location | Purpose |
|----------|----------|---------|
| Operational runbook | [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) | Step-by-step deploy procedure (multi-sig, idempotent) |
| Deployment plan | [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) | Per-contract initialisation parameters, dependency order |
| Multi-sig ceremony | [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) | Signer roster, signing flow, recovery procedure |
| Verification plan | [`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) | Code-hash, on-chain state, end-to-end test tx |
| Immutability verification | [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) | Static + bytecode confirmation that no upgrade path exists |
| Roll-back procedures | [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) | Pause / supersede flows (mainnet is immutable) |
| Manifest template | [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json) | Canonical layout for `deployments/mainnet/<timestamp>.json` |
| Network matrix | [`../network-matrix.md`](../network-matrix.md) | Authoritative registry — updated after deploy |
| Existing contracts | [`../../existing-contracts.md`](../../existing-contracts.md) | Public summary — updated after deploy |
| README mainnet section | [`../../../README.md`](../../../README.md) | Public landing page — updated after deploy |
| Key management policy | [`../../security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md) | Authoritative key classification & custody |
| Build instructions | [`../../../audit/BUILD_INSTRUCTIONS.md`](../../../audit/BUILD_INSTRUCTIONS.md) | Reproducible build commands |
| Freeze metadata | [`../../../audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md) | Compiler versions and frozen commit |

The deploy commit is recorded in [`STATUS.md`](./STATUS.md) §3 and **must match** `audit/FREEZE_METADATA.md`, A1 frozen commit, and the B1 testnet manifest. Any divergence is a CI-blocking defect.

---

## 6. Engagement Process

```
T-0   Engagement plan committed                                            ✅ (this directory)
T+0   All upstream gates G-1 … G-10 closed                                  ⏳
T+0d  Phase 2 dry run (`scripts/deploy/deploy.ts --network mainnet --dry-run`) ⏳
T+0d  Dry-run manifest reviewed by second person                            ⏳
T+1d  Multi-sig ceremony begins (cold-storage signing)                      ⏳
T+1d  Per-contract deploy + manifest written + `verify.ts` passes           ⏳
T+1d  Post-deploy state checks (VERIFICATION_PLAN.md §2)                    ⏳
T+1d  End-to-end test transaction executed (VERIFICATION_PLAN.md §3)        ⏳
T+1d  Immutability scan of deployed bytecode (IMMUTABILITY_VERIFICATION.md §4) ⏳
T+1d  Atomic doc update PR: existing-contracts + network-matrix + README + CHANGELOG ⏳
T+2d  24-hour soak window — no governance activation, no public marketing   ⏳
T+2d  STATUS.md verdict flipped to MAINNET-LIVE                             ⏳
T+9d  Governance activation review (≥ 7-day soak without Critical findings) ⏳
```

`T` is the kickoff date — populated once all upstream gates close. The 24-hour soak window enforces a deliberate delay between deployment and public announcement so anomalies have time to surface.

A `BLOCKED` outcome at any step pauses the engagement; the next ceremony retries from the **first not-yet-deployed contract** (idempotency guarantee — see [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §6).

---

## 7. Security Requirements

The following constraints from issue #118 §7 are non-negotiable:

1. **Multi-sig only.** Mainnet deployer is a **multi-sig with ≥ 2-of-3 hardware-wallet signers**. Single-key mainnet deployment is rejected by `verify.ts` and forbidden by [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md). Zero tolerance.
2. **Distinct from testnet.** No mainnet signer may overlap with any B1 testnet signer. `verify.ts` reads the B1 manifest signer list and aborts on overlap.
3. **Hardware wallets only.** Mainnet signing keys live exclusively on Ledger (or equivalent) cold-storage devices. Software wallets and hot keys are forbidden. See [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md).
4. **No secret material in the repo / CI.** Deployer mnemonics, recovery phrases, and admin private keys MUST NOT appear in `.env`, GitHub Actions secrets, or any file under version control. Only **addresses** (public values) appear in manifests.
5. **Auditable trail.** Every deployment writes a manifest to `deployments/mainnet/<timestamp>.json` and is verified by [`scripts/deploy/verify.ts`](../../../scripts/deploy/verify.ts) before the next ceremony step.
6. **Append-only manifests.** Mainnet manifests are **never edited or deleted** — corrections add a new manifest that references the old one via `supersedes`. Pause is recorded via `paused = true` on the superseded entry. See [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §3.
7. **Immutability attestation.** Every deployed contract is scanned for forbidden patterns (`adminWithdraw`, `emergencyDrain`, `forcedTransfer`, `set_code(`). The scan is recorded in [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) §4 and gates `STATUS.md` verdict promotion.

---

## 8. Non-Functional Requirements

Mirror of issue #118 §6:

| # | Requirement | Where enforced |
|---|-------------|----------------|
| NFR-1 | Deployment scripts idempotent (re-run produces no-op once a contract is committed) | [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §6 |
| NFR-2 | All deployed addresses documented and committed atomically | Post-deploy step in [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §10 |
| NFR-3 | Multi-sig deployment for every mainnet contract | [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) §3 — single-key deployment is rejected |
| NFR-4 | Manifests append-only — mainnet history is never rewritten | [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §3 |
| NFR-5 | Verification report committed alongside every manifest | `verify.ts` writes `<manifest>.verification.json` |
| NFR-6 | Public announcement gated on a 24-hour soak window | [`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §4 |

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All six checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `MAINNET-LIVE` or `MAINNET-LIVE WITH ACCEPTED RISKS`.
- [`docs/existing-contracts.md`](../../existing-contracts.md), [`docs/deployments/network-matrix.md`](../network-matrix.md), and [`README.md`](../../../README.md) carry the mainnet addresses.
- `CHANGELOG.md` carries a disclosure entry referencing the deployed addresses and the mainnet manifest filename.
- The 24-hour soak window has elapsed with no Critical or High-severity post-deploy findings.

A verdict of `BLOCKED` or `PAUSED` keeps the mainnet rollout halted per the same gating rule as audits A1 / A2 ([`docs/security/audits/README.md`](../../security/audits/README.md) §4). Governance contract **activation** requires an additional 7-day soak window with no Critical findings (see §6 timeline).

---

## 10. D6 — Acton / Tolk Toolchain Evaluation

Per issue #118 §5(5): mainnet deployment path is **`scripts/deploy/deploy.ts`** (Blueprint / Tact / FunC) **regardless of D6 verdict**. If engagement **D6** approves Acton for any Tolk-based mainnet workflow at a future date, that decision is recorded in a follow-up engagement and does not unlock a parallel mainnet path in B2.

Until D6 produces a verdict, the canonical deployment path remains `scripts/deploy/deploy.ts` driven by `@ton/blueprint`. Mainnet is **never** in scope of any D6 prototype before A1 / A2 are signed off.

---

## 11. References

- [Issue #118](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
- [Engagement status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Operational runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Multi-sig ceremony](./MULTISIG_CEREMONY.md)
- [Verification plan](./VERIFICATION_PLAN.md)
- [Immutability verification](./IMMUTABILITY_VERIFICATION.md)
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Network matrix](../network-matrix.md)
- [Existing contracts](../../existing-contracts.md)
- [Deployment scripts](../../../scripts/deploy/)
- [Key management](../../security/KEY_MANAGEMENT.md)
- [Engagement A1](../../security/audits/A1-core-contracts/ENGAGEMENT.md)
- [Engagement A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
- [Engagement B1 — Testnet](../B1-testnet/ENGAGEMENT.md)
- [Audit Readiness](../../security/AUDIT_READINESS.md)
- [Freeze Metadata](../../../audit/FREEZE_METADATA.md)
- [Development Roadmap — Track B](../../../TEMP/DEVELOPMENT_ROADMAP.md)
