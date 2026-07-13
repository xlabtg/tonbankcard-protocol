# Mainnet Deployment Runbook — TONBANKCARD Protocol

**Engagement:** [B2 — Mainnet Deployment Plan](../../docs/deployments/B2-mainnet/ENGAGEMENT.md)
**Issue:** [#118 — B2 Mainnet Deployment Plan](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
**Roadmap track:** B — Production Deployment & Operations
**Status:** Procedure frozen — followed verbatim at kickoff
**Owner:** `@konard`
**Last Updated:** 2026-05-16

> ⚠️ **Mainnet is irreversible.** Every step in this runbook is a one-way door. Do not skip, summarise, or "speed run" any check. The operator MUST stop and escalate at the first deviation from this procedure.

---

## 1. Purpose

This document is the procedural runbook for the **TON mainnet** deployment of the Phase 2 core contracts. The operator follows it step-by-step. It pairs with:

- [`docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md`](../../docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md) — *what* is deployed (contracts, init parameters, deterministic order).
- [`docs/deployments/B2-mainnet/VERIFICATION_PLAN.md`](../../docs/deployments/B2-mainnet/VERIFICATION_PLAN.md) — post-deploy on-chain state checks and end-to-end test transaction.
- [`docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) — multi-sig signer roster and signing ceremony.
- [`docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md`](../../docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md) — confirmation that no upgrade paths exist in the deployed code.
- [`docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md`](../../docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md) — pause / supersede procedure given mainnet immutability.
- [`docs/deployments/B2-mainnet/STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) — gating verdict ledger.

Roll-back guidance is recorded inline AND in the linked document above. The runbook intentionally separates *operations* (this file) from *gating decisions* (recorded in `STATUS.md`).

---

## 2. Scope

In scope for the mainnet deployment governed by this runbook (issue #118 §3):

1. `contracts/nft-resolver/` — Must be deployed first (dependency for `PaymentHub`).
2. `contracts/payments/PaymentHub.tact` — Core payment routing.
3. `contracts/payments/account-locks.fc` — Account-lock flags (initialised by `PaymentHub`).
4. `contracts/collateral-lookup/PublicCollateralLookup.tact`.
5. `contracts/MerchantPaymentHub.tact` — `init()` takes the `AccountLocks` **and** `NFTAccountResolver` addresses (both deployed earlier in the order). The resolver is the only authority that can register NFT accounts via `ResolveNFTOwner`; without it `nft_owners` / `account_states` stay empty and every payment fails (Issues #363, #397).
6. Governance contracts (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`) — deployed only after Phase 2 contracts are stable in production and observed for ≥ 7 days without Critical findings (see §10).

**Explicitly out of scope** of this runbook (issue #118 §4):

- Phase 4 contracts (`CrossChainBridge`, `MultiSigCard`, `RecurringPayments`, `LendingProtocolCoordinator`) — blocked on engagement A2 verdict = `READY`.
- Testnet deployment — governed by [B1-testnet/RUNBOOK.md](../../docs/deployments/B1-testnet/RUNBOOK.md).
- Production monitoring & alerting — governed by engagement B3.

---

## 3. Upstream gates

Every row below MUST be ✅ before the operator touches any signing device. The live state of each gate is mirrored in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §2 and reviewed at kickoff.

| # | Gate | Owner | Evidence |
|---|------|-------|----------|
| G-1 | **A1 audit verdict = `READY`** | `@konard` | [`docs/security/audits/A1-core-contracts/STATUS.md`](../../docs/security/audits/A1-core-contracts/STATUS.md) §"Final verdict" |
| G-2 | All A1 Critical / High findings remediated | `@konard` | [`docs/security/audits/A1-core-contracts/REMEDIATION.md`](../../docs/security/audits/A1-core-contracts/REMEDIATION.md) |
| G-3 | **B1 testnet verdict = `READY-FOR-B2`** | `@konard` | [`docs/deployments/B1-testnet/STATUS.md`](../../docs/deployments/B1-testnet/STATUS.md) §"Gating verdict" |
| G-4 | Formal invariant suite (I1–I7) passes on deploy commit | `@konard` | `tests/invariants/` green; report in [`audit/TEST_COVERAGE_REPORT.md`](../../audit/TEST_COVERAGE_REPORT.md) |
| G-5 | Reproducible build succeeds on the frozen commit | `@konard` | `npx blueprint build` matches `audit/FREEZE_METADATA.md` hashes |
| G-6 | Deployer multi-sig provisioned (≥ 2-of-3 hardware-wallet signers) | `@konard` | [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3 |
| G-7 | Mainnet deployer key separation confirmed (no overlap with testnet, infra, or governance signers) | `@konard` | [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §4 |
| G-8 | Mainnet treasury funded for deployer | `@konard` | [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §4 |
| G-9 | D6 Acton/Tolk verdict referenced (supplements vs replaces the canonical `scripts/deploy/` path) | `@konard` | [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §6 |
| G-10 | Incident response on-call rota staffed for the 72 h post-deploy window | `@konard` | [`docs/security/INCIDENT_RESPONSE.md`](../../docs/security/INCIDENT_RESPONSE.md) §"Mainnet readiness" |

If any gate is ❌ the deployment is paused and the unmet gate is owned in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §11.

---

## 4. Pre-deployment checklist

Run this checklist before issuing any signing device. Each row links to the doc / artefact that proves the check has passed.

- [ ] **Git state**: `git status` clean, current branch matches `audit/FREEZE_METADATA.md`'s freeze commit, no uncommitted changes, tag `v1.0.0-mainnet-b2` proposed in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §3.
- [ ] **Reproducible build**: `npx blueprint build` succeeds; build artefacts present in `build/`. Code hashes equal those recorded in [`DEPLOYMENT_PLAN.md`](../../docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md) §7. Procedure: [`audit/BUILD_INSTRUCTIONS.md`](../../audit/BUILD_INSTRUCTIONS.md).
- [ ] **Tests green on deploy commit**: `npm test` and the invariant suite (`tests/invariants/`) pass on the same commit. Procedure: [`audit/TEST_COVERAGE_REPORT.md`](../../audit/TEST_COVERAGE_REPORT.md).
- [ ] **A1 audit findings closed**: every Critical / High finding in [`docs/security/audits/A1-core-contracts/FINDINGS.md`](../../docs/security/audits/A1-core-contracts/FINDINGS.md) marked remediated and re-verified.
- [ ] **Key separation**: mainnet deployer multi-sig is *distinct* from any testnet, infra, governance, or pre-existing key (procedure: [`docs/security/KEY_MANAGEMENT.md`](../../docs/security/KEY_MANAGEMENT.md) §"Per-environment separation"; ceremony: [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §4).
- [ ] **Hardware wallets only**: every multi-sig signer key is on a hardware wallet (Ledger / Trezor / air-gapped). Hot wallets are forbidden ([`docs/security/KEY_MANAGEMENT.md`](../../docs/security/KEY_MANAGEMENT.md) §3).
- [ ] **Treasury balance**: deployer mainnet balance ≥ estimated cost recorded in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §4.
- [ ] **Env vars set**: `ADMIN_ADDRESS`, `RISK_AUTHORITY_ADDRESS`, optional `LENDING_ADAPTER_ADDRESS` populated in the operator's shell only — never committed, never in CI.
- [ ] **No secrets in repo**: `git ls-files | xargs grep -l 'mnemonic\|secret\|private_key' || true` returns no real secrets — only documentation references.
- [ ] **Manifest target writable**: `deployments/mainnet/` exists and is writable on the operator workstation.
- [ ] **Existing-contracts doc prepared**: a working copy of [`docs/existing-contracts.md`](../../docs/existing-contracts.md) is staged with placeholder rows for each Phase 2 contract under a new **TON Mainnet — Phase 2 Core** section; addresses are filled in after each deploy.
- [ ] **Network matrix prepared**: [`docs/deployments/network-matrix.md`](../../docs/deployments/network-matrix.md) and [`network-matrix.json`](../../docs/deployments/network-matrix.json) ready to accept the new mainnet entries (append-only — never overwrite existing rows).
- [ ] **Incident response paged**: on-call signers and the maintainer reachable for 72 hours after each deploy.

If any row is unchecked the operator MUST stop and resolve the row before touching a signing key.

---

## 5. Key management

### 5.1 Required keys

| Role | Owner | Storage | Used for |
|------|-------|---------|----------|
| Deployer multi-sig signer #1 | `@konard` | Hardware wallet, cold storage | Mainnet multi-sig deploy approval |
| Deployer multi-sig signer #2 | TBD (key holder documented in [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3) | Hardware wallet, cold storage | Mainnet multi-sig deploy approval |
| Deployer multi-sig signer #3 | TBD (key holder documented in [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3) | Hardware wallet, cold storage | Mainnet multi-sig deploy approval — 2-of-3 quorum |
| Admin address (mainnet) | DAO-elected multi-sig (≥ 2-of-3) | Hardware wallet ([`docs/security/KEY_MANAGEMENT.md`](../../docs/security/KEY_MANAGEMENT.md) §2.1) | Owner of `ADMIN_ADDRESS` env var; parameter-only authority |
| Risk authority (mainnet) | Separate multi-sig (NOT equal to Admin) | Hardware wallet | Owner of `RISK_AUTHORITY_ADDRESS` env var |
| Lending adapter (mainnet) | Reserved — populated only when LendingProtocolCoordinator passes A2 | Multi-sig | Owner of `LENDING_ADAPTER_ADDRESS` env var (Phase 4, out of scope here) |

### 5.2 Anti-foot-gun rules

1. **No single-key deployment.** A single-key deploy of any contract whose address will appear in `docs/existing-contracts.md` is rejected by [`scripts/deploy/deploy.ts`](./deploy.ts) and by review. Multi-sig deploy is mandatory for every Phase 2 contract (NFR-3 in issue #118 §6).
2. **Mainnet ≠ testnet keys.** The deployer signer key MUST NOT equal any testnet signer key. The operator confirms this in writing in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §3.
3. **Deployer ≠ Admin ≠ Risk-Authority.** The deployer multi-sig controls only deployment transactions and must NOT be the same address as `ADMIN_ADDRESS` or `RISK_AUTHORITY_ADDRESS`. Verified by [`scripts/deploy/verify.ts`](./verify.ts) §"Configuration sanity" before any signing.
4. **No private keys in repo / CI.** No private key, mnemonic, or seed phrase is ever committed to the repository, the CI environment, or any shared dotenv. `scripts/deploy/deploy.ts` reads addresses only via env vars. Compromise checks in [`docs/security/KEY_MANAGEMENT.md`](../../docs/security/KEY_MANAGEMENT.md) §11 apply.
5. **Hardware-wallet attestation.** Every signer attests in [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §5 that their key was generated on the hardware device and never exported. Signed entries are stored alongside the manifest.

---

## 6. Idempotency contract

The deployment must be safe to re-run. Idempotency is enforced at three layers:

- **Deterministic addressing.** The constructor parameters in [`DEPLOYMENT_PLAN.md`](../../docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md) §3.1 produce a deterministic address per (contract, deployer, init data). Re-deploy of the same contract on the same commit and same deployer recomputes the same address.
- **Manifest comparison.** `scripts/deploy/deploy.ts` loads the latest manifest at `deployments/mainnet/`, compares each contract's computed address against the manifest, and **skips** the deploy step if (address, codeHash) match. A mismatch aborts the run and prints the diff.
- **Append-only manifest history.** Every run produces a new manifest file. Re-runs reference the prior manifest via `supersedes`. Existing manifests are never edited in place (mirrors [`network-matrix.md`](../../docs/deployments/network-matrix.md) preamble).

Practical consequence: the operator may re-run `deploy.ts --network mainnet` as many times as required without producing duplicate deployments. The script will simply re-verify the existing addresses against the on-chain state and exit cleanly.

---

## 7. Dry run

A dry run is **mandatory** before any signing device is touched.

```bash
# Pre-flight: sanity-check configuration without touching the network
npx ts-node scripts/deploy/deploy.ts --network mainnet --dry-run
```

Expected output:

1. The script prints every Phase 2 contract in the configured `DEPLOYMENT_ORDER` with `[DRY RUN] Would deploy: <ContractName>`.
2. Every pre-deployment check in `checkPreDeploymentRequirements()` passes (or surfaces the specific failure with a remediation link).
3. A dry-run manifest is written to `deployments/mainnet/<timestamp>.dryrun.json`. **The dry-run file is NOT committed.**
4. `verify.ts` is invoked against the dry-run manifest and reports configuration sanity (no blockchain queries).

The operator records the dry-run timestamp and the on-chain budget estimate in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §4 and §5 before proceeding.

---

## 8. Real deployment

### 8.1 Phase 2 — sequential mainnet deploy

Phase 2 deploys exactly one contract per signing ceremony. The ceremony is fully described in [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md). The order matches `scripts/deploy/deploy.ts` (`DEPLOYMENT_ORDER`) and issue #118 §3:

```
1. AccountLocks            (no dependencies)
2. NFTAccountResolver      (no dependencies)
3. AccountStateMachine     (depends on AccountLocks)
4. PaymentHub              (depends on AccountLocks, NFTAccountResolver, AccountStateMachine)
5. PublicCollateralLookup  (depends on CollateralSignal — deployed at step 6 of B1; mainnet uses the deployed address)
6. MerchantPaymentHub      (init() takes the AccountLocks + NFTAccountResolver addresses — both deployed earlier; the resolver registers NFT accounts via ResolveNFTOwner. Issues #363, #397)
```

> The issue lists `contracts/payments/account-locks.fc` separately from `contracts/nft-resolver/`. Internally the deploy script enforces `AccountLocks` first (no deps) and treats `account-locks` initialisation as the first ceremony so that downstream init parameters resolve cleanly. `PublicCollateralLookup` requires `CollateralSignal` which is deployed in the same ceremony chain to satisfy issue scope item §3(4).

For each contract:

1. Confirm every row in §3 and §4 is ✅.
2. Run the live deploy:

   ```bash
   npx ts-node scripts/deploy/deploy.ts --network mainnet --confirm
   ```

   The script:
   - Re-reads the latest mainnet manifest and skips contracts already deployed on the current commit.
   - Calculates the deterministic address for the next contract in `DEPLOYMENT_ORDER`.
   - Prints the **exact deploy transaction payload** for the operator to compare against the signer-side display.
3. The operator opens a signing ceremony per [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md):
   - Each signer reviews the payload on their hardware-wallet screen.
   - Quorum approves (minimum 2-of-3).
   - The signed transaction is broadcast to mainnet via `toncenter.com`.
4. After each contract:
   - The manifest at `deployments/mainnet/<timestamp>.json` gains a new entry (`address`, `codeHash`, `deployTx`, `deployBlock`, `deployedAt`).
   - `scripts/deploy/verify.ts --manifest deployments/mainnet/<timestamp>.json` is executed. It must return `allPassed: true` before the next contract is signed. See [`VERIFICATION_PLAN.md`](../../docs/deployments/B2-mainnet/VERIFICATION_PLAN.md) for the full check list.
   - The immutability scan is run per [`IMMUTABILITY_VERIFICATION.md`](../../docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md). It must return `passed: true`.
   - The deployed address is copied into [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §7, [`docs/existing-contracts.md`](../../docs/existing-contracts.md), [`docs/deployments/network-matrix.md`](../../docs/deployments/network-matrix.md), and [`README.md`](../../README.md) §"Mainnet Deployments".
   - The address change is committed in a separate PR titled `chore(deploy): mainnet B2 — <Contract> deployed`.

Phase 2 sign-off is recorded in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §5 once every Phase 2 row has `Verified = ✅` and the post-deploy end-to-end test transaction (§9) is green.

### 8.2 Governance contracts

Governance contracts (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`) deploy **only after Phase 2 is signed off and observed in production for ≥ 7 days** with zero Critical findings logged in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §13. The same ceremony rules apply, and the manifest carries a `phase: governance` marker.

### 8.3 Single-source ordering

The order encoded in `scripts/deploy/deploy.ts` (`DEPLOYMENT_ORDER`) is the canonical source. This runbook mirrors it and cannot diverge. Any change in deployment topology requires a parallel change to `deploy.ts`, a new manifest schema bump, and a re-review of this runbook.

---

## 9. Post-deploy verification

For every deployed contract:

1. **Code-hash check** — `verify.ts` queries the on-chain code hash and compares against the locally compiled cell. Discrepancy aborts further deploys until resolved.
2. **Initial-state check** — `verify.ts` queries the contract get-methods (`owner`, `risk_authority`, `whitelist`, lock flags) and compares against the values from [`DEPLOYMENT_PLAN.md`](../../docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md) §3.1. See [`VERIFICATION_PLAN.md`](../../docs/deployments/B2-mainnet/VERIFICATION_PLAN.md) §3.
3. **Immutability scan** — both `verify.ts` (`verifyInvariants`) and the dedicated three-layer scanner [`check-immutability.ts`](./check-immutability.ts) confirm `set_code(`, `adminWithdraw`, `emergencyDrain`, `forcedTransfer` are absent in source, that no `SETCODE` opcode appears in the compiled disassembly, and that no upgrade-shaped state field is declared. See [`IMMUTABILITY_VERIFICATION.md`](../../docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md).
4. **Invariant attestation** — `verify.ts` runs the source-level scan against the corresponding source file in `contracts/`. Required by issue #118 §7 ("verify deployer cannot move user funds — invariant I3").
5. **D6 verifier dry-run** — if [D6](../../ISSUE/D6-acton-toolchain-evaluation.md) approves Acton for Tolk-based modules, include the Acton verifier output in `<manifest>.acton-verifier.json`. Otherwise the existing scripts remain authoritative (issue #118 §5.3).

### 9.1 End-to-end test transaction

After the full Phase 2 deploy:

1. Mint a fresh NFT card from the official Series-7777 testnet collection (test environment only — production users are NOT used as guinea pigs). Mint (or reuse) a second card for the merchant account.
2. Confirm the **NFT Account Resolver registers both the payer and merchant NFT accounts** in `MerchantPaymentHub` via `ResolveNFTOwner` (binds `nft_owners` and marks `account_states = ACTIVE`, write-once). Until this runs the hub returns `ERROR_PAYER_NOT_EXISTS` / `ERROR_MERCHANT_NOT_EXISTS` and every payment fails (Issue #397). Verify with the `accountExists` / `getNFTResolver` get-methods.
3. **Stop unless Issue #414's dedicated contract follow-up has shipped and been reviewed.** The current contract has no production handler that can credit a freshly registered payer; describing an external settlement/ledger flow here does not make one exist on-chain. The approved replacement must preserve Invariant I3 and be recorded in this runbook before deployment.
4. Through that approved non-custodial path, fund the payer with ≤ 0.1 TBC and record the funding transaction hash.
5. Use the [Merchant SDK](../../sdk/) to issue a low-value (≤ 0.1 TBC) invoice against the freshly deployed `MerchantPaymentHub`.
6. Pay the invoice from a hardware-wallet-controlled NFT card account.
7. Observe the indexer (`backend/indexer`) records the settlement and the merchant API returns `paid` status.

The test transaction hash is recorded in [`VERIFICATION_PLAN.md`](../../docs/deployments/B2-mainnet/VERIFICATION_PLAN.md) §4 and required by issue #118 §5.3 ("At least one test transaction executed on mainnet before public announcement").

### 9.2 Public-announcement gate

No public announcement of mainnet availability is made until:

- Every Phase 2 row in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §7 has `Verified = ✅`.
- The end-to-end test transaction in §9.1 succeeded.
- [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) gating verdict is flipped to `MAINNET-READY`.

---

## 10. Update documentation atomically

In the same PR that ships the manifest:

1. [`docs/existing-contracts.md`](../../docs/existing-contracts.md) — append the deployed mainnet addresses under the **TON Mainnet — Phase 2 Core** section. Existing rows (TBC token, NFT collections, pool) are NOT touched.
2. [`docs/deployments/network-matrix.md`](../../docs/deployments/network-matrix.md) and [`network-matrix.json`](../../docs/deployments/network-matrix.json) — populate the `## TON Mainnet` block; preserve the **append-only** rule from the matrix preamble.
3. [`README.md`](../../README.md) — populate the `## Mainnet Deployments` section with the same addresses for discoverability (issue #118 §5.4).
4. [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) — populate §7 / §8, attach SHA-256 of the manifest in §10.
5. [`CHANGELOG.md`](../../CHANGELOG.md) — add an `### Added — B2 Mainnet Deployment` entry with the contract names and a link back to this runbook.

Commit message format: `chore(deploy): mainnet B2 — <contract or batch> deployed`.

---

## 11. Roll-back

Mainnet contracts are immutable. A "roll-back" therefore never deletes a deployment — it pauses operations and supersedes the address registry. The detailed procedure is in [`ROLLBACK_PROCEDURES.md`](../../docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md). High-level:

1. **Pause** — mark the manifest with `paused: true` and add a row in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §13 explaining the trigger.
2. **Stop downstream** — instruct the indexer, the merchant API, and the SDK to stop emitting deposit addresses derived from the paused manifest.
3. **Public disclosure** — file a `SECURITY ADVISORY` per [`SECURITY.md`](../../SECURITY.md) and update [`docs/security/INCIDENT_RESPONSE.md`](../../docs/security/INCIDENT_RESPONSE.md) timeline.
4. **Remediate** — file a GitHub issue using the standard workflow ([`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../docs/security/audits/REMEDIATION_WORKFLOW.md) §3.2). Land the fix on a new commit.
5. **Re-deploy** — run `deploy.ts --network mainnet --confirm` on the new commit. The new addresses replace the paused ones in [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) §7. The old addresses remain in the matrix with `Superseded` markers — never deleted.
6. **Re-verify** — run §9 end-to-end against the new addresses before re-opening public traffic.

A roll-back **never** mutates an already-emitted manifest in place. If the trigger is a Critical security finding the operator activates [`docs/security/INCIDENT_RESPONSE.md`](../../docs/security/INCIDENT_RESPONSE.md) §"Mainnet incident" alongside the steps above.

---

## 12. Security requirements traceability

Mirror of issue #118 §7:

| Requirement | Where enforced |
|-------------|----------------|
| Zero tolerance for single-key mainnet deployment | §5.2 rule 1 and `scripts/deploy/deploy.ts` `--confirm` guard |
| Deployer keys must use hardware wallets | §5.2 rule 5 and [`MULTISIG_CEREMONY.md`](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3 |
| No private keys in repo / CI | §5.2 rule 4 and `scripts/deploy/deploy.ts` env-var-only configuration |
| Immutability verification (no `set_code()`) | §9 and [`IMMUTABILITY_VERIFICATION.md`](../../docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md) |
| Deployer cannot move user funds (I3) | §9 invariant attestation; source scan in `verify.ts` |

---

## 13. CI integration

The post-deploy verification suite is wired into the planned `.github/workflows/mainnet-verify.yml` workflow (engagement **B3**). Until that workflow ships, the operator runs the suite manually:

```bash
# After every mainnet deploy
npx ts-node scripts/deploy/verify.ts --manifest deployments/mainnet/<timestamp>.json
npm run test:integration:mainnet
```

The green CI badge is a prerequisite for flipping [`STATUS.md`](../../docs/deployments/B2-mainnet/STATUS.md) gating verdict to `MAINNET-READY`.

---

## 14. References

- [Engagement plan](../../docs/deployments/B2-mainnet/ENGAGEMENT.md)
- [Deployment plan](../../docs/deployments/B2-mainnet/DEPLOYMENT_PLAN.md)
- [Multi-sig ceremony](../../docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md)
- [Verification plan](../../docs/deployments/B2-mainnet/VERIFICATION_PLAN.md)
- [Immutability verification](../../docs/deployments/B2-mainnet/IMMUTABILITY_VERIFICATION.md)
- [Roll-back procedures](../../docs/deployments/B2-mainnet/ROLLBACK_PROCEDURES.md)
- [Manifest template](../../docs/deployments/B2-mainnet/MANIFEST_TEMPLATE.json)
- [Engagement status](../../docs/deployments/B2-mainnet/STATUS.md)
- [Deploy script README](./README.md)
- [Deploy script](./deploy.ts)
- [Verify script](./verify.ts)
- [Build instructions](../../audit/BUILD_INSTRUCTIONS.md)
- [Key management](../../docs/security/KEY_MANAGEMENT.md)
- [Incident response](../../docs/security/INCIDENT_RESPONSE.md)
- [Network matrix](../../docs/deployments/network-matrix.md)
- [Existing contracts](../../docs/existing-contracts.md)
- [Engagement A1](../../docs/security/audits/A1-core-contracts/ENGAGEMENT.md)
- [Engagement B1](../../docs/deployments/B1-testnet/ENGAGEMENT.md)
- [D6 — Acton/Tolk evaluation](../../ISSUE/D6-acton-toolchain-evaluation.md)
- [Issue #118 — B2 Mainnet Deployment Plan](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
