# Engagement B1 — TON Testnet Deployment & Validation

**Engagement ID:** `B1`
**Issue:** [#117 — B1 Testnet Deployment & Validation](https://github.com/xlabtg/tonbankcard-protocol/issues/117)
**Roadmap track:** B — Production Deployment & Operations
**Status:** Engagement preparation complete — awaiting deployer multi-sig and credentialed run
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Objective

Deploy all in-scope Phase 2 and Phase 4 smart contracts to **TON testnet**, populate the canonical contract registry with the resulting addresses, and run the full validation suite (end-to-end payment flow, gateway adapters, indexer) against those live testnet contracts.

The engagement is the **last gate before**:

- A1 / A2 auditors begin live testing — they typically point at deployed testnet contracts ([engagement A1](../../security/audits/A1-core-contracts/ENGAGEMENT.md), [engagement A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)).
- B2 mainnet deployment — testnet validation must succeed before any mainnet contract is initialised (see [`README.md` §4 gating rules](../../security/audits/README.md)).

Success criteria mirror the acceptance criteria in issue #117 §8:

- [ ] All Phase 2 contracts deployed to TON testnet
- [ ] Phase 4 contracts deployed to TON testnet (for testing only)
- [ ] [`docs/existing-contracts.md`](../../existing-contracts.md) updated with all testnet contract addresses
- [ ] End-to-end integration test suite passes against testnet contracts
- [ ] All backend adapters validated against sandbox/testnet gateways
- [ ] Indexer correctly indexes testnet payment events
- [ ] Deployment script (`scripts/deploy/`) documented and validated

---

## 2. In-Scope Contracts

Exactly the contract sets enumerated in issue #117 §3. Phase 2 and Phase 4 are deployed in two passes — Phase 2 first (it is a dependency for end-to-end validation and for A1), Phase 4 second (gated on Phase 2 validation passing).

### 2.1 Phase 2 — Core protocol

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

The deterministic deployment order is canonicalised in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3 and enforced by [`scripts/deploy/deploy.ts`](../../../scripts/deploy/deploy.ts).

### 2.2 Phase 4 — Advanced features (testnet only)

| # | Contract | File | Notes |
|---|----------|------|-------|
| 1 | `CrossChainBridge` | `contracts/CrossChainBridge.tact` | Testnet only; mainnet blocked on A2 |
| 2 | `MultiSigCard` | `contracts/MultiSigCard.tact` | Testnet only; mainnet blocked on A2 |
| 3 | `RecurringPayments` | `contracts/RecurringPayments.tact` | Testnet only; mainnet blocked on A2 |
| 4 | `LendingProtocolCoordinator` | `contracts/LendingProtocolCoordinator.tact` | Testnet only; mainnet blocked on A2 |

Phase 4 testnet deployments are explicitly labelled **`testing-only`** in [`STATUS.md`](./STATUS.md) and **must not** be referenced by any mainnet manifest before A2 sign-off (see [engagement A2 §1](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)).

### 2.3 Services & adapters validated against the testnet deployment

| Component | Path | Validation owner |
|-----------|------|------------------|
| Merchant API | [`api/`](../../../api/) | [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §3 |
| Payment indexer | [`backend/indexer/`](../../../backend/indexer/) | [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md) |
| Gateway adapters | [`backend/adapters/`](../../../backend/adapters/) | [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) |
| Merchant SDK | [`sdk/`](../../../sdk/) | [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §4 |

---

## 3. Out of Scope

Explicitly **not** part of this engagement:

- Mainnet deployment of any contract — covered by **B2** (`scripts/deploy/deploy.ts --network mainnet --confirm`).
- Mainnet deployment of Phase 4 contracts — additionally blocked on engagement [A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md).
- Production API keys for gateway adapters — sandbox/testnet keys only (see [§7](#7-security-requirements)).
- Faucet operation for public testers — out of scope here; planned as part of roadmap **C3** (Test Sandbox Environment).
- Production monitoring & alerting — covered by **B3**.

External pre-deployed mainnet contracts (TBC jetton, Series 7777/8888 NFT collections, TONCO TBC/TON pool) are not redeployed; their testnet equivalents are documented as **trust assumptions** in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §6.

---

## 4. Upstream Gates

The engagement may begin once all rows below are ✅. The live state of each gate is mirrored in [`STATUS.md`](./STATUS.md) §2.

| # | Gate | Owner | Evidence |
|---|------|-------|----------|
| G-1 | Contracts build cleanly on the frozen commit | `@konard` | `npx blueprint build` succeeds on commit recorded in [`audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md) |
| G-2 | Internal pre-audit findings remediated (F-CRIT-1 … F-CRIT-5) | `@konard` | [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../audit/FULL_SYSTEM_AUDIT.md) §"Status" |
| G-3 | Formal invariant suite passes (I1–I7) | `@konard` | [`tests/invariants/`](../../../tests/invariants/) green on the deploy commit |
| G-4 | Deployer multi-sig provisioned with at least 2-of-3 signers | `@konard` | Cold-storage signers documented in [`STATUS.md`](./STATUS.md) §3 |
| G-5 | Testnet faucet funded for deployer | `@konard` | Faucet balance ≥ deployment budget recorded in [`STATUS.md`](./STATUS.md) §4 |
| G-6 | D6 Acton/Tolk evaluation note recorded | `@konard` | See §10 — decision committed before kickoff |

If any gate is ❌ at kickoff the engagement is paused and the unmet gate is owned in [`STATUS.md`](./STATUS.md) §11 ("Open questions / blockers").

---

## 5. Engagement Package

The deployment operator receives the following frozen package at kickoff. Hashes and locations are tracked in [`STATUS.md`](./STATUS.md) §10.

| Artifact | Location | Purpose |
|----------|----------|---------|
| Deployment plan | [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) | Per-contract initialisation parameters, dependency order |
| Operational runbook | [`RUNBOOK.md`](./RUNBOOK.md) | Step-by-step deploy procedure (idempotent, multi-sig) |
| Validation plan | [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) | End-to-end payment flow scenarios on the live deployment |
| Gateway validation matrix | [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) | Per-adapter sandbox test cases |
| Indexer validation plan | [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md) | Event coverage, reorg handling, replay protection |
| Manifest template | [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json) | Canonical layout for `deployments/testnet/<timestamp>.json` |
| Network matrix | [`../network-matrix.md`](../network-matrix.md) | Authoritative registry — updated after deploy |
| Existing contracts | [`../../existing-contracts.md`](../../existing-contracts.md) | Public summary — updated after deploy |
| Build instructions | [`../../../audit/BUILD_INSTRUCTIONS.md`](../../../audit/BUILD_INSTRUCTIONS.md) | Reproducible build commands |
| Freeze metadata | [`../../../audit/FREEZE_METADATA.md`](../../../audit/FREEZE_METADATA.md) | Compiler versions and frozen commit |

The deploy commit is recorded in [`STATUS.md`](./STATUS.md) §3 and must match `audit/FREEZE_METADATA.md` so that the testnet addresses are auditable against the same source as A1/A2.

---

## 6. Engagement Process

```
T-0   Engagement plan committed                                            ✅ (this directory)
T+0   All upstream gates G-1 … G-6 closed                                   ⏳
T+0d  Phase 2 dry run on testnet sandbox (--dry-run, no signing)            ⏳
T+1d  Phase 2 multi-sig deploy + manifest written + post-deploy verify     ⏳
T+1d  Update `docs/existing-contracts.md` and `docs/deployments/network-matrix.md`
T+2d  End-to-end validation pass (VALIDATION_PLAN.md §2 — happy paths)      ⏳
T+2d  Gateway adapter validation pass (GATEWAY_VALIDATION.md)               ⏳
T+3d  Indexer validation pass (INDEXER_VALIDATION.md)                       ⏳
T+3d  Phase 2 sign-off recorded in STATUS.md                                ⏳
T+4d  Phase 4 dry run                                                       ⏳
T+4d  Phase 4 multi-sig deploy (testnet-only label)                         ⏳
T+5d  Phase 4 validation pass + sign-off                                    ⏳
T+5d  CI integration suite green against testnet (`tests/integration:testnet`) ⏳
T+5d  STATUS.md gating verdict flipped to READY-FOR-B2                      ⏳
```

Phase 4 testnet deployment is **only initiated after Phase 2 is signed off**. If any validation in Phase 2 reports a Critical or High failure, the engagement pauses and the issue is filed per the standard workflow before Phase 4 begins.

---

## 7. Security Requirements

The following constraints from issue #117 §7 are non-negotiable:

1. **Key separation.** Testnet deployer key MUST be a distinct multi-sig (or hardware wallet) separate from any mainnet key. See [`RUNBOOK.md`](./RUNBOOK.md) §2 for the key-provisioning checklist and [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md).
2. **No secret material in the repo.** Deployer mnemonics, API keys for gateways, and indexer credentials must be loaded via environment variables only. [`scripts/deploy/deploy.ts`](../../../scripts/deploy/deploy.ts) reads `ADMIN_ADDRESS`, `RISK_AUTHORITY_ADDRESS`, `LENDING_ADAPTER_ADDRESS` and refuses to deploy without them.
3. **Phase 4 contracts are testnet-only.** Each Phase 4 manifest entry carries `"environment": "testnet-only"` (see [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json)). They MUST NOT be referenced from any mainnet manifest before A2 verdict = `READY` (see [engagement A2 §9](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)).
4. **Gateway sandboxes only.** Adapter validation uses the providers' sandbox or testnet endpoints. Production API keys must not be loaded into the test environment ([`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) §2 documents the exact endpoints).
5. **Auditable trail.** Every deployment writes a manifest to `deployments/testnet/<timestamp>.json` and is verified by [`scripts/deploy/verify.ts`](../../../scripts/deploy/verify.ts) before sign-off.

---

## 8. Non-Functional Requirements

Mirror of issue #117 §6:

| # | Requirement | Where enforced |
|---|-------------|----------------|
| NFR-1 | Deployment scripts idempotent (safe to re-run) | [`RUNBOOK.md`](./RUNBOOK.md) §4 — re-run produces an identical manifest for the same commit |
| NFR-2 | All deployed addresses documented and committed | Post-deploy step in [`RUNBOOK.md`](./RUNBOOK.md) §6 updates the existing-contracts doc and network matrix in the same PR |
| NFR-3 | CI integration tests pass against testnet | `npm run test:integration:testnet` documented in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §6 |
| NFR-4 | Multi-sig deployment for mainnet-referenced addresses | [`RUNBOOK.md`](./RUNBOOK.md) §3.2 — single-key deployment is rejected for Phase 2 |

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All seven checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `READY-FOR-B2` or `READY-FOR-B2 WITH ACCEPTED RISKS`.
- [`docs/existing-contracts.md`](../../existing-contracts.md) and [`docs/deployments/network-matrix.md`](../network-matrix.md) carry the testnet addresses.
- `CHANGELOG.md` carries a disclosure entry referencing the deployed addresses.

A verdict of `BLOCKED` keeps mainnet deployment paused per the same gating rule as audits A1 / A2 ([`docs/security/audits/README.md`](../../security/audits/README.md) §4).

---

## 10. D6 — Acton / Tolk Toolchain Evaluation

Per issue #117 §5(5): if engagement **D6** (Acton/Tolk toolchain evaluation, see [`TEMP/DEVELOPMENT_ROADMAP.md`](../../../TEMP/DEVELOPMENT_ROADMAP.md)) approves Acton for any Tolk-based deployment prototype before B1 kickoff, the verdict must be recorded in [`STATUS.md`](./STATUS.md) §6 and explicitly state whether the prototype **supplements** or **replaces** the existing `scripts/deploy/` path for testnet only.

Until D6 produces a verdict, the canonical deployment path remains `scripts/deploy/deploy.ts` driven by `@ton/blueprint`. Mainnet is **never** in scope of any D6 prototype before A1 / A2 are signed off.

---

## 11. References

- [Issue #117](https://github.com/xlabtg/tonbankcard-protocol/issues/117)
- [Engagement status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Operational runbook](./RUNBOOK.md)
- [Validation plan](./VALIDATION_PLAN.md)
- [Gateway validation matrix](./GATEWAY_VALIDATION.md)
- [Indexer validation plan](./INDEXER_VALIDATION.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Network matrix](../network-matrix.md)
- [Existing contracts](../../existing-contracts.md)
- [Deployment scripts](../../../scripts/deploy/)
- [Backend adapters](../../../backend/adapters/)
- [Payment indexer](../../../backend/indexer/)
- [Merchant API](../../../api/)
- [Merchant SDK](../../../sdk/)
- [Engagement A1](../../security/audits/A1-core-contracts/ENGAGEMENT.md)
- [Engagement A2](../../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
- [Audit Readiness](../../security/AUDIT_READINESS.md)
- [Freeze Metadata](../../../audit/FREEZE_METADATA.md)
- [Development Roadmap — Track B](../../../TEMP/DEVELOPMENT_ROADMAP.md)
