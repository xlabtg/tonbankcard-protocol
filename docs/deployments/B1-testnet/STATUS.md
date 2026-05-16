# Engagement B1 — Status

**Engagement ID:** `B1`
**Issue:** [#117](https://github.com/xlabtg/tonbankcard-protocol/issues/117)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Runbook:** [`RUNBOOK.md`](./RUNBOOK.md)
**Phase:** Engagement preparation
**Gating verdict:** ⏳ Pending — deployment not yet executed
**Mainnet deployment of in-scope contracts:** ❌ Blocked until B1 verdict = `READY-FOR-B2`, A1 verdict = `READY` (Phase 2), A2 verdict = `READY` (Phase 4)
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues |
| Deployment operator | `@konard` | GitHub issues |
| Multi-sig signer #1 | TBD | Hardware wallet, cold-storage |
| Multi-sig signer #2 | TBD | Hardware wallet, cold-storage |
| Multi-sig signer #3 | TBD | Hardware wallet, cold-storage |
| Validation reviewer | TBD | GitHub PR review |

Multi-sig signer details (key custodians, recovery procedure) are documented in [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md). The same identities are recorded in §3 once provisioned.

---

## 2. Upstream gates

Mirror of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4. The deployment may not be initiated until all rows are ✅.

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G-1 | Contracts build cleanly on the frozen commit | ⏳ Pending | `npx blueprint build` from `audit/FREEZE_METADATA.md` commit |
| G-2 | Internal pre-audit findings remediated (F-CRIT-1 … F-CRIT-5) | ⏳ Pending | `docs/audit/FULL_SYSTEM_AUDIT.md` §"Status" |
| G-3 | Formal invariant suite passes (I1–I7) | ⏳ Pending | `npm test --workspace tests/invariants` |
| G-4 | Deployer multi-sig provisioned (≥ 2-of-3 signers) | ⏳ Pending | See §3 of this doc |
| G-5 | Testnet faucet funded for deployer | ⏳ Pending | See §4 of this doc |
| G-6 | D6 Acton/Tolk evaluation note recorded | ⏳ Pending | See §6 of this doc |

---

## 3. Deploy commit & key material

| Field | Value |
|-------|-------|
| Deploy commit hash | TBD at kickoff (must equal `audit/FREEZE_METADATA.md`) |
| Deploy tag | TBD (`v1.0.0-testnet-b1` proposed) |
| Tact compiler version | TBD (must match `audit/FREEZE_METADATA.md`) |
| FunC compiler version | TBD (must match `audit/FREEZE_METADATA.md`) |
| Blueprint version | TBD (must match `audit/FREEZE_METADATA.md`) |
| Deployer multi-sig address (testnet) | TBD |
| Deployer multi-sig signer #1 | TBD |
| Deployer multi-sig signer #2 | TBD |
| Deployer multi-sig signer #3 | TBD |
| Risk authority address (testnet) | TBD |
| Lending adapter address (testnet) | `null` until LendingProtocolCoordinator is initialised |
| Mainnet key reuse? | ❌ MUST be `no` |

The deploy commit is frozen at kickoff. Any change to in-scope contracts after that point requires a new B1 cycle (see [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6).

---

## 4. Faucet / treasury

| Item | Value |
|------|-------|
| Testnet TON balance (deployer) | TBD ≥ deployment budget |
| Deployment budget estimate (TON) | ~50 TON across Phase 2 + Phase 4 (refined in dry run) |
| Faucet source | https://t.me/testgiver_ton_bot |
| Last top-up | TBD |

The dry-run pass in [`RUNBOOK.md`](./RUNBOOK.md) §5 prints the exact required balance per contract.

---

## 5. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 1. Prepare engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Close upstream gates G-1 … G-6 | `@konard` | T+0 | ⏳ Pending |
| 3. Phase 2 dry run (`--dry-run`) | `@konard` | T+0d | ⏳ Pending |
| 4. Phase 2 deploy + manifest | `@konard` | T+1d | ⏳ Pending |
| 5. Phase 2 verification (`verify.ts`) | `@konard` | T+1d | ⏳ Pending |
| 6. Update existing-contracts + network-matrix | `@konard` | T+1d | ⏳ Pending |
| 7. End-to-end validation pass | `@konard` | T+2d | ⏳ Pending |
| 8. Gateway adapter validation | `@konard` | T+2d | ⏳ Pending |
| 9. Indexer validation | `@konard` | T+3d | ⏳ Pending |
| 10. Phase 2 sign-off | `@konard` | T+3d | ⏳ Pending |
| 11. Phase 4 dry run | `@konard` | T+4d | ⏳ Pending |
| 12. Phase 4 deploy + manifest (`testing-only`) | `@konard` | T+4d | ⏳ Pending |
| 13. Phase 4 validation + sign-off | `@konard` | T+5d | ⏳ Pending |
| 14. CI integration suite green against testnet | `@konard` | T+5d | ⏳ Pending |
| 15. STATUS flipped to `READY-FOR-B2` | `@konard` | T+5d | ⏳ Pending |

`T` is the kickoff date — populated once all upstream gates close.

---

## 6. D6 Acton/Tolk decision

| Field | Value |
|-------|-------|
| D6 verdict referenced | TBD (link to D6 doc) |
| Does the prototype touch B1? | TBD (`yes` / `no`) |
| If yes — supplements or replaces `scripts/deploy/`? | TBD (`supplements` / `replaces` — `replaces` requires explicit sign-off) |
| Scope | `testnet only` — mainnet path is unchanged regardless of D6 |
| Decision recorded by | `@konard` |
| Decision date | TBD |

Until populated, the canonical deployment path remains `scripts/deploy/deploy.ts` (Blueprint / Tact).

---

## 7. Phase 2 — Deployed addresses ledger

The rows below are placeholders and are filled in **immediately after each contract is deployed and verified**. Source of truth is the manifest at `deployments/testnet/<timestamp>.json` and the cross-references in [`../network-matrix.md`](../network-matrix.md).

| # | Contract | Testnet address | Code hash | Deploy tx | TONViewer | Verified | Notes |
|---|----------|-----------------|-----------|-----------|-----------|----------|-------|
| 1 | `AccountLocks` | TBD | TBD | TBD | TBD | ⏳ | |
| 2 | `NFTAccountResolver` | TBD | TBD | TBD | TBD | ⏳ | |
| 3 | `AccountStateMachine` | TBD | TBD | TBD | TBD | ⏳ | |
| 4 | `PaymentHub` | TBD | TBD | TBD | TBD | ⏳ | |
| 5 | `MerchantPaymentHub` | TBD | TBD | TBD | TBD | ⏳ | |
| 6 | `CollateralSignal` | TBD | TBD | TBD | TBD | ⏳ | |
| 7 | `PublicCollateralLookup` | TBD | TBD | TBD | TBD | ⏳ | |
| 8 | `ProposalRegistry` | TBD | TBD | TBD | TBD | ⏳ | |
| 9 | `SnapshotVerifier` | TBD | TBD | TBD | TBD | ⏳ | |
| 10 | `TransparencyRegistry` | TBD | TBD | TBD | TBD | ⏳ | |

---

## 8. Phase 4 — Deployed addresses ledger (testnet only)

Each entry MUST carry the `testing-only` label and MUST NOT be referenced from any mainnet manifest until engagement A2 verdict = `READY`.

| # | Contract | Testnet address | Code hash | Deploy tx | TONViewer | Verified | Testing-only label |
|---|----------|-----------------|-----------|-----------|-----------|----------|---------------------|
| 1 | `CrossChainBridge` | TBD | TBD | TBD | TBD | ⏳ | yes |
| 2 | `MultiSigCard` | TBD | TBD | TBD | TBD | ⏳ | yes |
| 3 | `RecurringPayments` | TBD | TBD | TBD | TBD | ⏳ | yes |
| 4 | `LendingProtocolCoordinator` | TBD | TBD | TBD | TBD | ⏳ | yes |

---

## 9. Validation results

### 9.1 End-to-end payment flow ([`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md))

| Scenario | Status | Tx hash(es) | Notes |
|----------|--------|-------------|-------|
| E2E-1: NFT ownership resolution via `PaymentHub` | ⏳ | — | |
| E2E-2: Internal TBC transfer (debit + credit atomic) | ⏳ | — | I4 / I5 attestation |
| E2E-3: Merchant invoice creation via Merchant API | ⏳ | — | |
| E2E-4: Merchant invoice settlement via `MerchantPaymentHub` | ⏳ | — | |
| E2E-5: Account lock blocks outgoing transfer (I7) | ⏳ | — | |
| E2E-6: Collateral signal emit + lookup round-trip | ⏳ | — | |
| E2E-7: Governance proposal lifecycle (testnet) | ⏳ | — | |

### 9.2 Gateway adapters ([`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md))

| Adapter | Sandbox endpoint | Status | Findings |
|---------|------------------|--------|----------|
| ChangeNOW | sandbox API | ⏳ | — |
| NOWPayments | sandbox API | ⏳ | — |
| CoinRabbit | testnet | ⏳ | — |

### 9.3 Indexer ([`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md))

| Check | Status | Notes |
|-------|--------|-------|
| Indexes invoice creation events | ⏳ | |
| Indexes internal transfer events | ⏳ | |
| Indexes merchant settlement events | ⏳ | |
| Indexes account lock events | ⏳ | |
| Reorg handling on testnet | ⏳ | |
| Idempotent re-sync from genesis | ⏳ | |

### 9.4 Phase 4 (testnet only)

| Contract | Critical scenarios | Status | Notes |
|----------|--------------------|--------|-------|
| `CrossChainBridge` | Message issuance, validator-set replay protection | ⏳ | A2 gate for mainnet |
| `MultiSigCard` | M-of-N approve + cancel | ⏳ | A2 gate for mainnet |
| `RecurringPayments` | Schedule + cancel + missed-payment behaviour | ⏳ | A2 gate for mainnet |
| `LendingProtocolCoordinator` | Adapter handshake against CoinRabbit testnet | ⏳ | A2 gate for mainnet |

---

## 10. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| Deployment plan | [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) | — | |
| Operational runbook | [`RUNBOOK.md`](./RUNBOOK.md) | — | |
| Validation plan | [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) | — | |
| Gateway validation matrix | [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) | — | |
| Indexer validation plan | [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md) | — | |
| Manifest template | [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json) | — | |
| Phase 2 deploy manifest | `deployments/testnet/<timestamp>.json` | TBD | Written by `scripts/deploy/deploy.ts` |
| Phase 4 deploy manifest | `deployments/testnet/<timestamp>.json` | TBD | Separate manifest, `testing-only: true` |
| Phase 2 verification report | `deployments/testnet/<timestamp>.verification.json` | TBD | Written by `scripts/deploy/verify.ts` |
| Phase 4 verification report | `deployments/testnet/<timestamp>.verification.json` | TBD | |

SHA-256 columns are filled at intake of each artifact, mirroring the workflow used by audit engagements ([`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md) §3.1).

---

## 11. Acceptance criteria progress

Mirror of issue #117 §8:

- [ ] All Phase 2 contracts deployed to TON testnet
- [ ] Phase 4 contracts deployed to TON testnet (for testing only)
- [ ] `docs/existing-contracts.md` updated with all testnet contract addresses
- [ ] End-to-end integration test suite passes against testnet contracts
- [ ] All backend adapters validated against sandbox/testnet gateways
- [ ] Indexer correctly indexes testnet payment events
- [ ] Deployment script (`scripts/deploy/`) documented and validated

---

## 12. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | Final composition of deployer multi-sig (signers, threshold) | `@konard` | Open |
| Q-2 | Risk authority key custodian for testnet | `@konard` | Open |
| Q-3 | Calendar window — must not collide with A1 kickoff | `@konard` | Open |
| Q-4 | Whether D6 prototype lands before or after B1 kickoff | `@konard` | Open |
| Q-5 | Gateway sandbox key custody (separate from production credentials) | `@konard` | Open |

Add rows as blockers surface; close rows by linking the resolving issue / commit.

---

## 13. Accepted deferrals

If any validation scenario cannot be completed on testnet (for example a gateway sandbox is offline), the deferral is recorded here with an explicit mainnet impact statement. A deferral involving a Critical-severity scenario blocks `READY-FOR-B2`.

| Scenario | Reason | Compensating control | Mainnet impact | Sign-off | Date |
|----------|--------|----------------------|----------------|----------|------|
| _none yet_ | — | — | — | — | — |

---

## 14. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this file) | `@konard` |
| 2026-05-16 | Added `GATEWAY_VALIDATION.md`, `INDEXER_VALIDATION.md`, and `MANIFEST_TEMPLATE.json` to complete the engagement package referenced in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5 | `@konard` |
