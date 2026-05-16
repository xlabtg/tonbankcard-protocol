# Engagement B2 — Status

**Engagement ID:** `B2`
**Issue:** [#118](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Runbook:** [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md)
**Phase:** Engagement preparation
**Gating verdict:** ⏳ Pending — deployment not yet executed
**Public announcement:** ❌ Blocked until verdict = `MAINNET-LIVE` and 24-hour soak window has elapsed
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues |
| Deployment operator | `@konard` | GitHub issues |
| Multi-sig signer #1 (mainnet) | TBD | Hardware wallet — Ledger or equivalent |
| Multi-sig signer #2 (mainnet) | TBD | Hardware wallet — Ledger or equivalent |
| Multi-sig signer #3 (mainnet) | TBD | Hardware wallet — Ledger or equivalent |
| Risk authority custodian | TBD | Hardware wallet — distinct from deployer signers |
| Verification reviewer | TBD | GitHub PR review (mandatory second pair of eyes for mainnet PR) |
| Communications lead | TBD | Responsible for the announcement after 24-hour soak |

Multi-sig signer identities, key custody policy, and recovery procedure are documented in [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) and cross-referenced from [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md). The same identities are recorded in §3 once provisioned.

---

## 2. Upstream gates

Mirror of [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4. The deployment may not be initiated until all rows are ✅.

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G-1 | A1 verdict = `READY` for Phase 2 contracts | ⏳ Pending | [`docs/security/audits/A1-core-contracts/STATUS.md`](../../security/audits/A1-core-contracts/STATUS.md) |
| G-2 | B1 verdict = `READY-FOR-B2` | ⏳ Pending | [`docs/deployments/B1-testnet/STATUS.md`](../B1-testnet/STATUS.md) §1 |
| G-3 | Contracts build cleanly on the frozen commit | ⏳ Pending | `npx blueprint build` on `audit/FREEZE_METADATA.md` commit |
| G-4 | Internal pre-audit findings remediated (F-CRIT-1 … F-CRIT-5) | ⏳ Pending | `docs/audit/FULL_SYSTEM_AUDIT.md` §"Status" |
| G-5 | Formal invariant suite passes (I1–I7) | ⏳ Pending | `npm test --workspace tests/invariants` |
| G-6 | Mainnet deployer multi-sig provisioned (≥ 2-of-3 hardware-wallet signers, distinct from B1 testnet) | ⏳ Pending | See §3 of this doc + [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) §2 |
| G-7 | Mainnet treasury funded for deployment + buffer | ⏳ Pending | See §4 of this doc |
| G-8 | Immutability scan of the freeze commit passes | ⏳ Pending | [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) §3 |
| G-9 | Roll-back procedure rehearsed against the latest B1 manifest | ⏳ Pending | [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §5 |
| G-10 | D6 Acton/Tolk evaluation note recorded | ⏳ Pending | See §6 of this doc |

---

## 3. Deploy commit & key material

| Field | Value |
|-------|-------|
| Deploy commit hash | TBD at kickoff (must equal `audit/FREEZE_METADATA.md` and the B1 manifest commit) |
| Deploy tag | TBD (`v1.0.0-mainnet-b2` proposed) |
| Tact compiler version | TBD (must match `audit/FREEZE_METADATA.md`) |
| FunC compiler version | TBD (must match `audit/FREEZE_METADATA.md`) |
| Blueprint version | TBD (must match `audit/FREEZE_METADATA.md`) |
| Deployer multi-sig address (mainnet) | TBD |
| Deployer multi-sig signer #1 (hardware-wallet address) | TBD |
| Deployer multi-sig signer #2 (hardware-wallet address) | TBD |
| Deployer multi-sig signer #3 (hardware-wallet address) | TBD |
| Multi-sig threshold | TBD — must be ≥ 2 of ≥ 3 |
| Risk authority address (mainnet) | TBD — distinct hardware wallet from any deployer signer |
| Lending adapter address | `null` — not in scope of B2 (Phase 4) |
| Overlap with B1 testnet signers? | ❌ MUST be `no` |
| Overlap between deployer signers and risk authority? | ❌ MUST be `no` |
| Software wallet usage? | ❌ MUST be `no` |

The deploy commit is frozen at kickoff. Any change to in-scope contracts after that point requires a new B2 cycle.

---

## 4. Treasury / deployment budget

| Item | Value |
|------|-------|
| Mainnet TON balance (deployer multi-sig) | TBD ≥ deployment budget + 50% buffer |
| Deployment budget estimate (TON) | ~20 TON across Phase 2 (refined by dry run) |
| Treasury source | Project treasury wallet (documented at kickoff) |
| Last top-up | TBD |
| Buffer policy | Keep ≥ 50% extra balance to absorb gas price spikes during the ceremony |

The dry-run pass in [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §7 prints the exact required balance per contract.

---

## 5. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 1. Prepare engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Close upstream gates G-1 … G-10 | `@konard` | T+0 | ⏳ Pending |
| 3. Dry run on mainnet (`--dry-run`, no signing) | `@konard` | T+0d | ⏳ Pending |
| 4. Dry-run manifest reviewed by second person | TBD | T+0d | ⏳ Pending |
| 5. Multi-sig ceremony — payment block (steps 1–7) | `@konard` + signers | T+1d | ⏳ Pending |
| 6. Per-contract `verify.ts` pass after every deploy | `@konard` | T+1d | ⏳ Pending |
| 7. Multi-sig ceremony — governance block (steps 8–10) | `@konard` + signers | T+1d | ⏳ Pending |
| 8. Post-deploy state checks ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §2) | `@konard` | T+1d | ⏳ Pending |
| 9. End-to-end test transaction ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §3) | `@konard` | T+1d | ⏳ Pending |
| 10. Immutability scan of deployed bytecode | `@konard` | T+1d | ⏳ Pending |
| 11. Atomic doc-update PR (existing-contracts + network-matrix + README + CHANGELOG) | `@konard` | T+1d | ⏳ Pending |
| 12. 24-hour soak window — no public announcement | `@konard` | T+1d → T+2d | ⏳ Pending |
| 13. STATUS flipped to `MAINNET-LIVE` | `@konard` | T+2d | ⏳ Pending |
| 14. Governance activation review (≥ 7-day soak) | `@konard` | T+9d | ⏳ Pending |

`T` is the kickoff date — populated once all upstream gates close.

---

## 6. D6 Acton/Tolk decision

| Field | Value |
|-------|-------|
| D6 verdict referenced | TBD (link to D6 doc) |
| Mainnet path | **`scripts/deploy/deploy.ts`** — locked, regardless of D6 outcome |
| Does the prototype touch B2? | TBD (`yes` / `no`) — if `yes`, only as a post-deploy verification aid, never as a parallel deployer |
| Decision recorded by | `@konard` |
| Decision date | TBD |

Mainnet is **never** in scope of any D6 prototype before A1 / A2 sign-off and the first MAINNET-LIVE verdict on this engagement.

---

## 7. Mainnet — Phase 2 payment block ledger

The rows below are placeholders and are filled in **immediately after each contract is deployed and verified**. Source of truth is the manifest at `deployments/mainnet/<timestamp>.json` and the cross-references in [`../network-matrix.md`](../network-matrix.md).

| # | Contract | Mainnet address | Code hash | Deploy tx | TONViewer | Verified | Notes |
|---|----------|-----------------|-----------|-----------|-----------|----------|-------|
| 1 | `AccountLocks` | TBD | TBD | TBD | TBD | ⏳ | |
| 2 | `NFTAccountResolver` | TBD | TBD | TBD | TBD | ⏳ | |
| 3 | `AccountStateMachine` | TBD | TBD | TBD | TBD | ⏳ | |
| 4 | `PaymentHub` | TBD | TBD | TBD | TBD | ⏳ | |
| 5 | `MerchantPaymentHub` | TBD | TBD | TBD | TBD | ⏳ | |
| 6 | `CollateralSignal` | TBD | TBD | TBD | TBD | ⏳ | |
| 7 | `PublicCollateralLookup` | TBD | TBD | TBD | TBD | ⏳ | |

---

## 8. Mainnet — Governance group ledger (deferred activation)

Governance contracts are **deployed but inert** until the 7-day soak window (see [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.2). Each row carries an `activated` column that flips to `true` only after explicit maintainer attestation.

| # | Contract | Mainnet address | Code hash | Deploy tx | TONViewer | Verified | Activated | Notes |
|---|----------|-----------------|-----------|-----------|-----------|----------|-----------|-------|
| 8 | `ProposalRegistry` | TBD | TBD | TBD | TBD | ⏳ | no | |
| 9 | `SnapshotVerifier` | TBD | TBD | TBD | TBD | ⏳ | no | |
| 10 | `TransparencyRegistry` | TBD | TBD | TBD | TBD | ⏳ | no | |

---

## 9. Verification results

### 9.1 Code-hash + on-chain state ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §2)

| Check | Status | Tx hash(es) | Notes |
|-------|--------|-------------|-------|
| V-1: All deployed code hashes match `audit/FREEZE_METADATA.md` | ⏳ | — | |
| V-2: `admin` field on every contract = `ADMIN_ADDRESS` env var | ⏳ | — | |
| V-3: `risk_authority` on `AccountLocks` = `RISK_AUTHORITY_ADDRESS`, distinct from `admin` | ⏳ | — | |
| V-4: Cross-contract address wiring matches `DEPLOYMENT_PLAN.md` §3.1 | ⏳ | — | |
| V-5: Pre-existing mainnet artefact addresses (TBC, NFT 7777/8888, TONCO) match `DEPLOYMENT_PLAN.md` §6 | ⏳ | — | |

### 9.2 End-to-end test transaction ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §3)

| Scenario | Status | Tx hash(es) | Notes |
|----------|--------|-------------|-------|
| V-6: NFT ownership resolution via `PaymentHub` on mainnet | ⏳ | — | Smallest possible value, treasury-funded |
| V-7: Internal TBC transfer (debit + credit atomic) — invariants I4 / I5 | ⏳ | — | |
| V-8: Account-lock blocks outgoing transfer (invariant I7) | ⏳ | — | |

### 9.3 Immutability ([`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md))

| Check | Status | Notes |
|-------|--------|-------|
| Source-level forbidden-pattern scan passes | ⏳ | |
| Deployed-bytecode disassembly contains no `SETCODE` / `set_code` opcode | ⏳ | |
| No `adminWithdraw` / `emergencyDrain` / `forcedTransfer` symbol in source | ⏳ | |
| Verdict attestation by second reviewer | ⏳ | |

---

## 10. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| Deployment plan | [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) | — | |
| Operational runbook | [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) | — | |
| Multi-sig ceremony | [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) | — | |
| Verification plan | [`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) | — | |
| Immutability verification | [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) | — | |
| Roll-back procedures | [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) | — | |
| Manifest template | [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json) | — | |
| Mainnet deploy manifest | `deployments/mainnet/<timestamp>.json` | TBD | Written by `scripts/deploy/deploy.ts` |
| Mainnet verification report | `deployments/mainnet/<timestamp>.verification.json` | TBD | Written by `scripts/deploy/verify.ts` |

SHA-256 columns are filled at intake of each artifact.

---

## 11. Acceptance criteria progress

Mirror of issue #118 §8:

- [ ] Mainnet deployment runbook published ([`scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md)) — **created**, awaiting kickoff
- [ ] Multi-sig deployer documented (minimum 2-of-3 hardware-wallet signers) — [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) created, signers TBD
- [ ] Post-deployment verification steps documented ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md)) — created
- [ ] `docs/existing-contracts.md` and `README.md` updated with mainnet addresses — pending kickoff
- [ ] Immutability of deployed contracts verified ([`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md)) — process documented, execution pending kickoff
- [ ] Roll-back procedures documented for failed deployments ([`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md)) — created

---

## 12. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | Final composition of deployer multi-sig (signers, threshold) | `@konard` | Open |
| Q-2 | Risk authority custodian — explicit attestation that they are not a deployer signer | `@konard` | Open |
| Q-3 | Mainnet treasury source + on-chain funding tx | `@konard` | Open |
| Q-4 | Calendar window — must not collide with A1 final review | `@konard` | Open |
| Q-5 | Second-reviewer roster for the atomic doc-update PR | `@konard` | Open |
| Q-6 | Recovery flow if 2-of-3 quorum is unreachable during the ceremony | `@konard` | Open |
| Q-7 | Announcement channels (Telegram / X / docs site) — copy gated on `MAINNET-LIVE` verdict | TBD | Open |

Add rows as blockers surface; close rows by linking the resolving issue / commit.

---

## 13. Accepted deferrals

If any verification scenario cannot be completed before the 24-hour soak completes (for example, a TONCO pool quote endpoint is offline), the deferral is recorded here with an explicit mainnet impact statement. A deferral involving a Critical-severity scenario blocks `MAINNET-LIVE`.

| Scenario | Reason | Compensating control | Mainnet impact | Sign-off | Date |
|----------|--------|----------------------|----------------|----------|------|
| _none yet_ | — | — | — | — | — |

---

## 14. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this file) | `@konard` |
| 2026-05-16 | Added `MULTISIG_CEREMONY.md`, `VERIFICATION_PLAN.md`, `IMMUTABILITY_VERIFICATION.md`, `ROLLBACK_PROCEDURES.md`, `MANIFEST_TEMPLATE.json` to complete the engagement package referenced in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §5 | `@konard` |
