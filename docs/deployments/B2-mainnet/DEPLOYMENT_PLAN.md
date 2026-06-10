# B2 — Mainnet Deployment Plan

**Engagement:** [B2](./ENGAGEMENT.md)
**Issue:** [#118](https://github.com/xlabtg/tonbankcard-protocol/issues/118)
**Status:** Preparation — addresses populated only after the multi-sig ceremony
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document is the per-contract deployment recipe for **TON mainnet**. It specifies:

- The deterministic order in which contracts are deployed.
- The exact init parameters each contract requires.
- Cross-contract address wiring (where a downstream contract must learn the address of an upstream one).
- The trust assumptions for pre-existing mainnet artefacts (TBC jetton, NFT collections, TONCO pool).
- The code-hash matrix used by `verify.ts` to detect bytecode drift.

It is read together with the [operational runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md). The runbook describes *how* to deploy; this document describes *what* is deployed.

---

## 2. Authoritative source

The deterministic order encoded in [`scripts/deploy/deploy.ts`](../../../scripts/deploy/deploy.ts) (`DEPLOYMENT_ORDER` constant) is the canonical sequence. This document mirrors that order and **may not diverge** from it. Any change in deployment topology requires:

1. A parallel change to `scripts/deploy/deploy.ts`.
2. A new B2 cycle with regenerated manifest template and verification report.
3. A re-attestation against A1 / B1 verdicts.

CI fails the build if `DEPLOYMENT_ORDER` in `deploy.ts` diverges from §3 of this document.

---

## 3. Deployment order (Phase 2)

Contracts are deployed in dependency order so each downstream contract receives the upstream addresses at construction time. Idempotency is guaranteed by deterministic addressing — re-running `deploy.ts` on the same commit produces the same addresses (see [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §6).

```
1. AccountLocks                (no dependencies)
2. NFTAccountResolver          (no dependencies)
3. AccountStateMachine         (depends on AccountLocks)
4. PaymentHub                  (depends on AccountLocks, NFTAccountResolver, AccountStateMachine)
5. MerchantPaymentHub          (depends on PaymentHub)
6. CollateralSignal            (depends on NFTAccountResolver — Issue #364)
7. PublicCollateralLookup      (depends on CollateralSignal)
8. ProposalRegistry            (no dependencies — governance group, deferred activation)
9. SnapshotVerifier            (no dependencies — governance group, deferred activation)
10. TransparencyRegistry       (no dependencies — governance group, deferred activation)
```

> **Note on issue #118 §3 contract ordering.** The issue narrates the deployment as "NFT resolver → Payment Hub → account-locks → …". This narration emphasises functional onboarding; the canonical *technical* order above is the dependency order enforced by `deploy.ts`. `account-locks` is initialised first because it is a structural dependency of every payment path. Both orderings are equivalent post-deploy — the canonical order is the one used by the multi-sig ceremony.

### 3.1 Per-contract init parameters

| # | Contract | Init parameter | Source | Notes |
|---|----------|----------------|--------|-------|
| 1 | `AccountLocks` | `admin` | `ADMIN_ADDRESS` env var (mainnet multi-sig) | Owner for `set_lock` / `clear_lock` only. Cannot move user funds (invariant **I3**). |
| 1 | `AccountLocks` | `risk_authority` | `RISK_AUTHORITY_ADDRESS` env var | Independent custody from `admin`; **distinct hardware wallet**. |
| 2 | `NFTAccountResolver` | `nft_collection_series7777` | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` (mainnet Series 7777) | Pre-existing mainnet collection, treated as trust assumption (§6). |
| 2 | `NFTAccountResolver` | `nft_collection_series8888` | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` (mainnet Series 8888) | Same. |
| 3 | `AccountStateMachine` | `account_locks` | Address from step 1 | Recorded in manifest `contracts.AccountStateMachine.initParameters.account_locks`. |
| 3 | `AccountStateMachine` | `admin` | `ADMIN_ADDRESS` env var | Parameter authority only. |
| 4 | `PaymentHub` | `account_locks` | Address from step 1 | |
| 4 | `PaymentHub` | `nft_account_resolver` | Address from step 2 | |
| 4 | `PaymentHub` | `account_state_machine` | Address from step 3 | |
| 4 | `PaymentHub` | `admin` | `ADMIN_ADDRESS` env var | Strictly limited to NFT allow-listing — no fund authority (**I3**). |
| 5 | `MerchantPaymentHub` | `payment_hub` | Address from step 4 | |
| 5 | `MerchantPaymentHub` | `admin` | `ADMIN_ADDRESS` env var | Merchant onboarding only. |
| 6 | `CollateralSignal` | `nft_resolver` | Address from step 2 (`NFTAccountResolver`) | Issue #364 — ownership is pushed only by the trusted resolver via `ResolveNFTOwner`; no `admin`/`deployer` write path (I3). Emits read-only collateral state, no fund authority. |
| 7 | `PublicCollateralLookup` | `collateral_signal` | Address from step 6 | |
| 8 | `ProposalRegistry` | `admin` | `ADMIN_ADDRESS` env var | **Activation deferred** — see §3.2. |
| 9 | `SnapshotVerifier` | `admin` | `ADMIN_ADDRESS` env var | **Activation deferred** — see §3.2. |
| 10 | `TransparencyRegistry` | `admin` | `ADMIN_ADDRESS` env var | **Activation deferred** — see §3.2. |

Per-contract `notes` reference protocol invariants **I1–I7** ([`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md)). Each deploy step includes an attestation that the `admin` field can only operate parameters the invariants permit. Source-level verification of this property is performed by [`scripts/deploy/verify.ts`](../../../scripts/deploy/verify.ts) §`verifyInvariants` (§8 below).

### 3.2 Governance activation policy

Contracts `ProposalRegistry`, `SnapshotVerifier`, and `TransparencyRegistry` are deployed in the same ceremony as the payment block but **are not referenced by client code** until:

1. The payment block (`AccountLocks` … `PublicCollateralLookup`) has been observed live for **≥ 7 days**.
2. No Critical or High-severity finding has been raised against any in-scope contract during the soak.
3. The governance activation is recorded by appending a new manifest with `governance.activated = true` and a `supersedes` reference to the original deployment manifest.

The 7-day soak window matches the audit / engagement gating rule used elsewhere in the protocol (see [engagement A1 §6](../../security/audits/A1-core-contracts/ENGAGEMENT.md)). The default state of the governance contracts post-deploy is *deployed-but-inert*: the bytecode is on-chain, but no client SDK and no merchant onboarding flow routes through them.

---

## 4. Phase 4 is OUT OF SCOPE

Per issue #118 §4 and §3 of [`ENGAGEMENT.md`](./ENGAGEMENT.md), the following contracts are **NOT** deployed by this engagement:

- `CrossChainBridge`
- `MultiSigCard`
- `RecurringPayments`
- `LendingProtocolCoordinator`

The mainnet manifest schema (`MANIFEST_TEMPLATE.json`) rejects any entry for these contracts. `verify.ts` aborts if a Phase 4 contract address appears in a mainnet manifest with `phase = "phase4"` and `environment ≠ "testnet-only"`. These contracts remain in scope of engagement **A2** and a future engagement **B4** (Phase-4 mainnet rollout).

---

## 5. Address registration

After every contract is deployed and verified:

1. The manifest file (`deployments/mainnet/<timestamp>.json`) is updated by `scripts/deploy/deploy.ts` with `address`, `codeHash`, `deployTx`, `deployBlock`, `deployedAt`, and `initParameters`.
2. `scripts/deploy/verify.ts` is executed against the manifest. It must return `allPassed: true` before the next contract proceeds.
3. The deployed address is appended to:
   - [`STATUS.md`](./STATUS.md) §7 (Phase 2 — payment block) or §8 (governance group),
   - [`docs/existing-contracts.md`](../../existing-contracts.md) under the **TON Mainnet** section,
   - [`docs/deployments/network-matrix.md`](../network-matrix.md) under **TON Mainnet**,
   - [`README.md`](../../../README.md) §"Mainnet Deployment" section.
4. The same PR commits the updated manifest and the documentation updates atomically. The PR is marked `mainnet-deploy` and **requires two human reviewers** before merge — see [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §10.

Re-runs of `deploy.ts` on the same commit must be no-ops: the script reads the latest manifest, detects identical code hashes, and skips already-deployed contracts (idempotency requirement NFR-1 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §8).

---

## 6. Trust assumptions — pre-existing mainnet artefacts

The following mainnet artefacts are **not redeployed** by this engagement and are referenced as out-of-scope dependencies.

| Artefact | Mainnet address | Trust property |
|----------|-----------------|----------------|
| TBC Jetton | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | Standard TON jetton, immutable; long pre-deployed |
| NFT Series 7777 collection | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | Provides NFT ownership oracle for `NFTAccountResolver` |
| NFT Series 8888 collection | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | Same |
| TONCO TBC/TON pool | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` | DEX liquidity pool; quotes read-only |

Mainnet TBC and the NFT collections **must not** share addresses or code with their testnet counterparts. `verify.ts` rejects manifests that reuse a testnet jetton or testnet NFT collection address in a mainnet manifest, and vice versa. This is the single most common deployment hazard — explicitly guarded.

---

## 7. Code hash matrix

`scripts/deploy/verify.ts` computes the SHA-256 of each deployed cell and compares it to the expected hash. Expected hashes are derived from the `audit/FREEZE_METADATA.md` build artefacts. Any discrepancy aborts the deployment.

| Contract | Expected source | Verification step |
|----------|-----------------|-------------------|
| `AccountLocks` | `contracts/payments/account-locks.fc` | `verify.ts` §`verifyCodeHash` |
| `NFTAccountResolver` | `contracts/nft-resolver/nft_account_resolver.fc` + `.tact` | `verify.ts` §`verifyCodeHash` |
| `AccountStateMachine` | `contracts/payment-hub/account-state.tact` | `verify.ts` §`verifyCodeHash` |
| `PaymentHub` | `contracts/payments/PaymentHub.tact` | `verify.ts` §`verifyCodeHash` |
| `MerchantPaymentHub` | `contracts/MerchantPaymentHub.tact` | `verify.ts` §`verifyCodeHash` |
| `CollateralSignal` | `contracts/CollateralSignal.tact` | `verify.ts` §`verifyCodeHash` |
| `PublicCollateralLookup` | `contracts/collateral-lookup/PublicCollateralLookup.tact` | `verify.ts` §`verifyCodeHash` |
| `ProposalRegistry` | `contracts/governance/ProposalRegistry.tact` | `verify.ts` §`verifyCodeHash` |
| `SnapshotVerifier` | `contracts/governance/SnapshotVerifier.tact` | `verify.ts` §`verifyCodeHash` |
| `TransparencyRegistry` | `contracts/governance/TransparencyRegistry.tact` | `verify.ts` §`verifyCodeHash` |

Code hashes are recorded in the manifest produced by the deploy run and copied into [`STATUS.md`](./STATUS.md) §7 / §8 alongside the addresses. The expected hashes are populated by the dry-run pass before the ceremony begins.

---

## 8. Initialisation invariant checks

After every contract is deployed, `verify.ts` runs the source-level invariant scan defined in `verifyInvariants` against each in-scope contract. The following patterns MUST NOT appear in any deployed contract:

- `adminWithdraw` — admin withdrawal function
- `emergencyDrain` — emergency drain function
- `forcedTransfer` — forced-transfer function
- `set_code(` — code upgrade function

Any match aborts the deployment with a non-zero exit and rolls back the manifest entry. This is the **immutability gate** required by issue #118 §8: it mirrors invariant **I3** ("No Admin Fund Control") and ensures no upgrade path exists in deployed bytecode. The scan output is preserved in [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md) §4 alongside the deployed-code disassembly hash.

---

## 9. Post-deploy state machine

Once every contract row in [`STATUS.md`](./STATUS.md) §7 has `Verified = ✅`, the deployment is treated as **Live-Soak**. The state transitions are:

```
Live-Soak  →  Live-Verified  →  MAINNET-LIVE
   ⏬             ⏬                 ⏬
addresses    24h soak +         STATUS verdict
recorded     end-to-end test    = MAINNET-LIVE
             tx green
```

- **Live-Soak → Live-Verified** requires every scenario in [`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §3 (V-1 … V-7) green, no Critical or High findings during the 24-hour soak.
- **Live-Verified → MAINNET-LIVE** requires explicit maintainer attestation in [`STATUS.md`](./STATUS.md) §1 and the atomic doc-update PR (existing-contracts + network-matrix + README + CHANGELOG) merged.

A roll-back from `Live-Verified` to `Live-Soak` is permitted only if a Critical or High issue is discovered post-validation. The roll-back is logged in [`STATUS.md`](./STATUS.md) §14 and processed through [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §3 (pause / supersede — never delete).

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Operational runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Multi-sig ceremony](./MULTISIG_CEREMONY.md)
- [Verification plan](./VERIFICATION_PLAN.md)
- [Immutability verification](./IMMUTABILITY_VERIFICATION.md)
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Deploy script](../../../scripts/deploy/deploy.ts)
- [Verify script](../../../scripts/deploy/verify.ts)
- [Network matrix](../network-matrix.md)
- [Formal invariants](../../../audit/INVARIANTS.md)
- [Freeze metadata](../../../audit/FREEZE_METADATA.md)
- [Build instructions](../../../audit/BUILD_INSTRUCTIONS.md)
