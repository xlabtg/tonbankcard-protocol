# B1 — Testnet Deployment Plan

**Engagement:** [B1](./ENGAGEMENT.md)
**Status:** Preparation — addresses populated after deploy
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document is the per-contract deployment recipe for the TON testnet. It specifies:

- The deterministic order in which contracts are deployed.
- The exact init parameters each contract requires.
- Cross-contract address wiring (where a downstream contract must learn the address of an upstream one).
- The trust assumptions for pre-existing testnet artefacts (TBC jetton, NFT collections, TONCO pool).

It is read together with the operational [`RUNBOOK.md`](./RUNBOOK.md). The runbook describes *how* to deploy; this document describes *what* is deployed.

---

## 2. Authoritative source

The deterministic order encoded in [`scripts/deploy/deploy.ts`](../../../scripts/deploy/deploy.ts) (`DEPLOYMENT_ORDER` constant) is the canonical sequence. This document mirrors that order and may not diverge from it. Any change in deployment topology requires a parallel change to `deploy.ts` and a re-published manifest template.

---

## 3. Deployment order (Phase 2)

Contracts are deployed in dependency order so that each downstream contract receives the upstream addresses at construction time. Idempotency is guaranteed by deterministic addressing — re-running `deploy.ts` on the same commit produces the same addresses (see [`RUNBOOK.md`](./RUNBOOK.md) §4).

```
1. AccountLocks                (no dependencies)
2. NFTAccountResolver          (no dependencies)
3. AccountStateMachine         (depends on AccountLocks)
4. PaymentHub                  (depends on AccountLocks, NFTAccountResolver, AccountStateMachine)
5. MerchantPaymentHub          (depends on PaymentHub)
6. CollateralSignal            (no dependencies)
7. PublicCollateralLookup      (depends on CollateralSignal)
8. ProposalRegistry            (no dependencies — governance group)
9. SnapshotVerifier            (no dependencies — governance group)
10. TransparencyRegistry       (no dependencies — governance group)
```

### 3.1 Per-contract init parameters

| # | Contract | Init parameter | Source | Notes |
|---|----------|----------------|--------|-------|
| 1 | `AccountLocks` | `admin` | `ADMIN_ADDRESS` env var (testnet multi-sig) | Owner for `set_lock` / `clear_lock` only. Cannot move user funds (I3). |
| 1 | `AccountLocks` | `risk_authority` | `RISK_AUTHORITY_ADDRESS` env var | Independent custody from `admin`. |
| 2 | `NFTAccountResolver` | `nft_collection_series7777` | Pre-existing mainnet address `EQAjH...` resolves on mainnet only. Testnet collection address is provisioned at kickoff and recorded in [`STATUS.md`](./STATUS.md) §7. |
| 2 | `NFTAccountResolver` | `nft_collection_series8888` | Same as above |
| 3 | `AccountStateMachine` | `account_locks` | Address from step 1 |
| 3 | `AccountStateMachine` | `admin` | `ADMIN_ADDRESS` env var |
| 4 | `PaymentHub` | `account_locks` | Address from step 1 |
| 4 | `PaymentHub` | `nft_account_resolver` | Address from step 2 |
| 4 | `PaymentHub` | `account_state_machine` | Address from step 3 |
| 4 | `PaymentHub` | `admin` | `ADMIN_ADDRESS` env var — strictly limited to allow-listing NFT collections (no fund authority — I3) |
| 5 | `MerchantPaymentHub` | `payment_hub` | Address from step 4 |
| 5 | `MerchantPaymentHub` | `admin` | `ADMIN_ADDRESS` env var |
| 6 | `CollateralSignal` | `admin` | `ADMIN_ADDRESS` env var |
| 7 | `PublicCollateralLookup` | `collateral_signal` | Address from step 6 |
| 8 | `ProposalRegistry` | `admin` | `ADMIN_ADDRESS` env var |
| 9 | `SnapshotVerifier` | `admin` | `ADMIN_ADDRESS` env var |
| 10 | `TransparencyRegistry` | `admin` | `ADMIN_ADDRESS` env var |

Per-contract `notes` in the table reference the protocol invariants `I1`–`I7` ([`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md)). The deploy step must include an attestation that each downstream `admin` field can only operate parameters the invariants permit.

---

## 4. Deployment order (Phase 4 — testnet only)

Phase 4 deployment is gated on Phase 2 sign-off ([`ENGAGEMENT.md`](./ENGAGEMENT.md) §6). The manifest produced by Phase 4 sets `"environment": "testnet-only"` and is never referenced from mainnet manifests until A2 verdict = `READY`.

```
11. CrossChainBridge              (no on-chain dependencies; off-chain validator set)
12. MultiSigCard                  (no on-chain dependencies)
13. RecurringPayments             (depends on PaymentHub)
14. LendingProtocolCoordinator    (depends on PaymentHub; trust-bound to CoinRabbit testnet adapter)
```

### 4.1 Per-contract init parameters (Phase 4)

| # | Contract | Init parameter | Source | Notes |
|---|----------|----------------|--------|-------|
| 11 | `CrossChainBridge` | `validator_set_root` | Hash of the bridge-validator set agreed at kickoff | Testnet validator set must NEVER overlap with mainnet validators |
| 11 | `CrossChainBridge` | `chain_id` | Static — `-3` for TON testnet | |
| 12 | `MultiSigCard` | `signers` | Hardware-wallet addresses agreed at kickoff | Threshold recorded in [`STATUS.md`](./STATUS.md) §3 |
| 12 | `MultiSigCard` | `threshold` | Default `2-of-3` | Must be ≥ 2 |
| 13 | `RecurringPayments` | `payment_hub` | Address from step 4 |
| 13 | `RecurringPayments` | `admin` | `ADMIN_ADDRESS` env var |
| 14 | `LendingProtocolCoordinator` | `payment_hub` | Address from step 4 |
| 14 | `LendingProtocolCoordinator` | `lending_adapter` | `LENDING_ADAPTER_ADDRESS` env var — points at CoinRabbit-testnet adapter |
| 14 | `LendingProtocolCoordinator` | `admin` | `ADMIN_ADDRESS` env var |

---

## 5. Address registration

After every contract is deployed and verified:

1. The manifest file (`deployments/testnet/<timestamp>.json`) is updated by `scripts/deploy/deploy.ts` with `address`, `codeHash`, `deployTx`, and `deployBlock`.
2. `scripts/deploy/verify.ts` is executed against the manifest. It must return `allPassed: true` before the next contract proceeds.
3. The deployed address is appended to:
   - [`STATUS.md`](./STATUS.md) §7 (Phase 2) or §8 (Phase 4),
   - [`docs/existing-contracts.md`](../../existing-contracts.md) under the **TON Testnet** section,
   - [`docs/deployments/network-matrix.md`](../network-matrix.md) under **TON Testnet**.
4. The same PR commits the updated manifest and the documentation updates atomically.

Re-runs of `deploy.ts` on the same commit must be no-ops: the script reads the latest manifest, detects identical code hashes, and skips already-deployed contracts (idempotency requirement NFR-1 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §8).

---

## 6. Trust assumptions — pre-existing testnet artefacts

The following artefacts are treated as out-of-scope dependencies. Their testnet addresses are provisioned at kickoff and recorded in [`STATUS.md`](./STATUS.md) §3.

| Artefact | Mainnet address | Testnet provisioning | Trust property |
|----------|-----------------|----------------------|----------------|
| TBC Jetton | `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq` | Testnet jetton (separate, NOT the mainnet token) | Standard TON jetton, immutable |
| NFT Series 7777 collection | `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le` | Testnet NFT collection mock (mints test cards) | Provides NFT ownership oracle for `NFTAccountResolver` |
| NFT Series 8888 collection | `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7` | Testnet NFT collection mock | Same |
| TONCO TBC/TON pool | `EQCUUQ4JkETDPTRLlNaMBx5vGFhMn0OC1184AfdnBKKaGK2M` | Not deployed on testnet | Adapter validation uses sandbox/quote endpoints only (see [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md)) |

Testnet TBC and testnet NFT collections **must not** share addresses or code with their mainnet counterparts. Cross-environment confusion is the single most common deployment hazard and is explicitly checked by `verify.ts` (rejects mainnet-addressed jettons in a testnet manifest).

---

## 7. Code hash matrix

`scripts/deploy/verify.ts` computes the SHA-256 of each deployed cell and compares it to the expected hash. The expected hashes are derived from the `audit/FREEZE_METADATA.md` build artefacts. Discrepancy aborts the deployment.

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
| `CrossChainBridge` | `contracts/CrossChainBridge.tact` | `verify.ts` §`verifyCodeHash` |
| `MultiSigCard` | `contracts/MultiSigCard.tact` | `verify.ts` §`verifyCodeHash` |
| `RecurringPayments` | `contracts/RecurringPayments.tact` | `verify.ts` §`verifyCodeHash` |
| `LendingProtocolCoordinator` | `contracts/LendingProtocolCoordinator.tact` | `verify.ts` §`verifyCodeHash` |

Code hashes are recorded in the manifest produced by the deploy run and copied into [`STATUS.md`](./STATUS.md) §7 / §8 alongside the addresses.

---

## 8. Initialisation invariant checks

After every contract is deployed, `verify.ts` runs the source-level invariant scan defined in `verifyInvariants` against the contract. The following patterns MUST NOT appear in any deployed contract:

- `adminWithdraw` — admin withdrawal function
- `emergencyDrain` — emergency drain function
- `forcedTransfer` — forced-transfer function
- `set_code(` — code upgrade function

Any match aborts the deployment with a non-zero exit and rolls back the manifest entry. The behaviour is required by issue #117 §7 ("Phase 4 contracts deployed for testing only — not to be treated as production-ready"): even on testnet, no contract may expose a back-door fund-control path. This mirrors invariant I3 ("No Admin Fund Control").

---

## 9. Post-deploy state machine

Once every contract row in [`STATUS.md`](./STATUS.md) §7 has `Verified = ✅`, the deployment is treated as **Provisional**. The state transitions are:

```
Provisional  →  Validated   →  Signed-off
     ⏬             ⏬               ⏬
   addresses    end-to-end         STATUS verdict
   recorded     tests pass         = READY-FOR-B2
```

- **Provisional → Validated** requires every scenario in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §2 (E2E-1 … E2E-7) green, every adapter row in [`GATEWAY_VALIDATION.md`](./GATEWAY_VALIDATION.md) green, and every check in [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md) green.
- **Validated → Signed-off** requires explicit maintainer attestation in [`STATUS.md`](./STATUS.md) §1.

A roll-back from `Validated` to `Provisional` is permitted only if a Critical or High issue is discovered post-validation. The roll-back is logged in [`STATUS.md`](./STATUS.md) §14.

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Operational runbook](./RUNBOOK.md)
- [Validation plan](./VALIDATION_PLAN.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Deploy script](../../../scripts/deploy/deploy.ts)
- [Verify script](../../../scripts/deploy/verify.ts)
- [Network matrix](../network-matrix.md)
- [Formal invariants](../../../audit/INVARIANTS.md)
- [Freeze metadata](../../../audit/FREEZE_METADATA.md)
- [Build instructions](../../../audit/BUILD_INSTRUCTIONS.md)
