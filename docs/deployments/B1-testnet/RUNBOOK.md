# B1 — Testnet Deployment Runbook

**Engagement:** [B1](./ENGAGEMENT.md)
**Status:** Procedure frozen — followed verbatim at kickoff
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document is the procedural runbook for the testnet deployment. The operator follows it step-by-step. It pairs with [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) (which contracts and parameters) and [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) (post-deploy validation).

Roll-back guidance is recorded inline. The runbook intentionally separates *operations* (this file) from *gating decisions* (recorded in [`STATUS.md`](./STATUS.md)).

---

## 2. Pre-deployment checklist

Run this checklist before issuing any signing key. Each row links to the doc / artefact that proves the check has passed.

- [ ] **Git state**: `git status` clean, current branch matches `audit/FREEZE_METADATA.md`'s freeze commit, no uncommitted changes.
- [ ] **Reproducible build**: `npx blueprint build` succeeds; build artefacts present in `build/`. Procedure: [`audit/BUILD_INSTRUCTIONS.md`](../../../audit/BUILD_INSTRUCTIONS.md).
- [ ] **Tests green on deploy commit**: `npm test` and the invariant suite (`tests/invariants/`) pass on the same commit. Procedure: [`audit/TEST_COVERAGE_REPORT.md`](../../../audit/TEST_COVERAGE_REPORT.md).
- [ ] **Pre-audit findings closed**: F-CRIT-1 … F-CRIT-5 in [`docs/audit/FULL_SYSTEM_AUDIT.md`](../../audit/FULL_SYSTEM_AUDIT.md) marked remediated.
- [ ] **Key separation**: testnet deployer multi-sig is *distinct* from any mainnet key (procedure: [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md) §"Per-environment separation").
- [ ] **Cold storage**: every multi-sig signer key is in a hardware wallet (Ledger / Trezor / cold air-gap). No hot wallets.
- [ ] **Faucet balance**: deployer testnet balance ≥ estimated cost in [`STATUS.md`](./STATUS.md) §4.
- [ ] **Env vars set**: `ADMIN_ADDRESS`, `RISK_AUTHORITY_ADDRESS`, optional `LENDING_ADAPTER_ADDRESS` populated in the operator's shell only.
- [ ] **No secrets in repo**: `git ls-files | xargs grep -l 'mnemonic\\|secret\\|private_key' || true` returns no real secrets — only documentation references.
- [ ] **Manifest target writable**: `deployments/testnet/` exists and is writable.

If any row is unchecked the operator MUST stop and resolve the row before touching a signing key.

---

## 3. Key management

### 3.1 Required keys

| Role | Owner | Storage | Used for |
|------|-------|---------|----------|
| Deployer multi-sig signer #1 | `@konard` | Hardware wallet, cold storage | Multi-sig deploy approve |
| Deployer multi-sig signer #2 | TBD | Hardware wallet, cold storage | Multi-sig deploy approve |
| Deployer multi-sig signer #3 | TBD | Hardware wallet, cold storage | Multi-sig deploy approve (3-of-3 quorum; 2-of-3 fallback per [`STATUS.md`](./STATUS.md) §3) |
| Admin address (testnet) | `@konard` | Multi-sig | Owner of `ADMIN_ADDRESS` env var |
| Risk authority (testnet) | TBD | Separate multi-sig — must NOT equal Admin | Owner of `RISK_AUTHORITY_ADDRESS` env var |
| Gateway sandbox API keys | `@konard` | Encrypted environment file, never committed | `backend/adapters/` only |

### 3.2 Anti-foot-gun rules

1. The deployer signer key MUST NOT equal any mainnet signer key. The operator confirms this in writing in [`STATUS.md`](./STATUS.md) §3 before kickoff.
2. The deployer multi-sig MUST NOT control mainnet contracts. The verification step in §6 confirms this.
3. A single-key deployment is permitted only for purely-experimental contracts whose addresses will not appear in `docs/existing-contracts.md`. For every Phase 2 contract a multi-sig deploy is **required** (NFR-4 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §8).
4. Phase 4 contracts deployed on testnet must inherit the same key constraints. The fact that Phase 4 is `testing-only` does NOT relax key separation.

---

## 4. Idempotency contract

The deployment must be safe to re-run. Idempotency is enforced at two layers:

- **Deterministic addressing**: the constructor parameters in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.1 and §4.1 produce a deterministic address per (contract, deployer, init data). Re-deploy of the same contract on the same commit and same deployer recomputes the same address.
- **Manifest comparison**: `scripts/deploy/deploy.ts` loads the latest manifest at `deployments/testnet/`, compares each contract's computed address against the manifest, and **skips** the deploy step if (address, codeHash) match. A mismatch (different codeHash for the same address) aborts the run and prints the diff.

Practical consequence: an operator can run `deploy.ts` as many times as needed without producing duplicate deployments. Each re-run produces an audit-trail manifest pointing at the same addresses, with `deployedAt` reflecting the original deploy timestamp.

---

## 5. Dry run

A dry run is mandatory before any signing key is touched. The operator runs:

```bash
# Phase 2 dry run
npx ts-node scripts/deploy/deploy.ts --network testnet --dry-run

# Phase 4 dry run
npx ts-node scripts/deploy/deploy.ts --network testnet --dry-run --phase4
```

Expected output:

1. The script prints every contract in the configured order with the `[DRY RUN] Would deploy: <ContractName>` line.
2. Every pre-deployment check in `checkPreDeploymentRequirements()` passes (or surfaces the specific failure with a remediation link).
3. A dry-run manifest is written to `deployments/testnet/<timestamp>.json` with the `dryRun: true` flag. This file is *not* committed.

The operator records the dry-run timestamp in [`STATUS.md`](./STATUS.md) §5 (row 3 / row 11) before proceeding.

---

## 6. Real deployment

### 6.1 Phase 2

1. Confirm every row in §2 is ✅ and every row in §3.1 is provisioned.
2. From the dry-run output, copy the deployment-budget estimate to [`STATUS.md`](./STATUS.md) §4 and confirm the faucet balance covers it.
3. Run the deploy script live:

   ```bash
   npx ts-node scripts/deploy/deploy.ts --network testnet
   ```

4. Each contract's deploy transaction is signed by the deployer multi-sig. The operator approves each signer step from a separate hardware wallet.
5. After each contract:
   - The manifest at `deployments/testnet/<timestamp>.json` gains a new entry.
   - `scripts/deploy/verify.ts --manifest deployments/testnet/<timestamp>.json` is executed. The run must return `allPassed: true` before the next contract.
   - The deployed address is copied into [`STATUS.md`](./STATUS.md) §7, [`docs/existing-contracts.md`](../../existing-contracts.md), and [`docs/deployments/network-matrix.md`](../network-matrix.md).
6. Phase 2 sign-off is recorded in [`STATUS.md`](./STATUS.md) §5 row 10 once every Phase 2 row in §7 has `Verified = ✅` and the validation pass in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §2 is green.

### 6.2 Phase 4

Phase 4 is initiated **only after Phase 2 sign-off**. It writes a separate manifest:

```bash
npx ts-node scripts/deploy/deploy.ts --network testnet --phase4
```

The manifest produced by Phase 4 carries `"environment": "testnet-only"`. The verification step in §6 of [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) rejects this manifest if pointed at the mainnet RPC.

### 6.3 Post-deploy verification

After both phases:

```bash
# Combined verification — Phase 2
npx ts-node scripts/deploy/verify.ts --manifest deployments/testnet/<phase2-timestamp>.json

# Combined verification — Phase 4
npx ts-node scripts/deploy/verify.ts --manifest deployments/testnet/<phase4-timestamp>.json
```

Both runs must return `allPassed: true`. The verification report (`.verification.json`) is committed alongside the manifest.

---

## 7. Update documentation atomically

In the same PR that ships the manifest:

1. [`docs/existing-contracts.md`](../../existing-contracts.md) — add the deployed testnet addresses under the **TON Testnet** section.
2. [`docs/deployments/network-matrix.md`](../network-matrix.md) and [`network-matrix.json`](../network-matrix.json) — populate the `## TON Testnet` block with the same addresses; preserve the **append-only** rule from the matrix preamble.
3. [`STATUS.md`](./STATUS.md) — populate §7 / §8, attach SHA-256 of the manifest in §10.
4. `CHANGELOG.md` — add an Unreleased entry under `### Added — B1 Testnet Deployment` with the contract names and a link back to this engagement.

Commit message format: `chore(deploy): testnet B1 — <contract or batch> deployed`.

---

## 8. Roll-back

If a Critical/High issue is found between deploy and sign-off:

1. Pause: mark the manifest with `paused: true` and add a row in [`STATUS.md`](./STATUS.md) §13 ("Accepted deferrals" / "Open questions").
2. Do **not** delete the manifest. Manifests are append-only — corrections add new entries with explicit supersession notes (mirrors [`network-matrix.md`](../network-matrix.md) preamble).
3. File a GitHub issue using the standard workflow ([`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md) §3.2) — even though B1 is not a security audit, this workflow is the canonical finding-management process.
4. Once the remediation lands, re-run `deploy.ts` on the new commit. The new addresses replace the paused ones in [`STATUS.md`](./STATUS.md) §7 / §8 with the original entries kept for audit trail.
5. Validation must be re-run end-to-end against the new addresses.

A roll-back **never** mutates an already-emitted manifest in place.

---

## 9. CI integration

A separate workflow `.github/workflows/testnet-integration.yml` (planned in roadmap **B3**) runs the validation suite from [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §2 nightly against the latest testnet manifest. Until that workflow is wired, the operator runs the suite manually:

```bash
npm run test:integration:testnet
```

The CI green badge is a prerequisite for `READY-FOR-B2` (acceptance criterion 4 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1).

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Validation plan](./VALIDATION_PLAN.md)
- [Gateway validation matrix](./GATEWAY_VALIDATION.md)
- [Indexer validation plan](./INDEXER_VALIDATION.md)
- [Deploy script README](../../../scripts/deploy/README.md)
- [Deploy script](../../../scripts/deploy/deploy.ts)
- [Verify script](../../../scripts/deploy/verify.ts)
- [Build instructions](../../../audit/BUILD_INSTRUCTIONS.md)
- [Key management](../../security/KEY_MANAGEMENT.md)
- [Network matrix](../network-matrix.md)
