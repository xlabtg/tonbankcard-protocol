# B2 — Mainnet Post-Deploy Verification Plan

**Engagement:** [B2](./ENGAGEMENT.md)
**Runbook reference:** [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §9
**Status:** Procedure frozen — followed verbatim after the ceremony
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document specifies the post-deployment checks that must pass before the engagement verdict flips to `MAINNET-LIVE`. It addresses the three categories required by issue #118 §5(3):

1. **Code-hash verification** — the deployed bytecode matches the audited source.
2. **Initial-state verification** — on-chain state matches the init parameters in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.1.
3. **End-to-end test transaction** — a small, real mainnet tx exercises the happy path on the deployed contracts.

All checks are gated on the 24-hour soak window (§4) before public announcement.

---

## 2. On-chain state checks

These checks run immediately after each contract row is deployed; they are also re-run as a batch once the full deployment is complete. Results are recorded in [`STATUS.md`](./STATUS.md) §9.1.

| ID | Check | How | Pass criterion |
|----|-------|-----|----------------|
| V-1 | Deployed code hash matches `audit/FREEZE_METADATA.md` | `scripts/deploy/verify.ts --manifest <path>` § `verifyCodeHash` | Every contract reports `codeHashMatch: true` |
| V-2 | `admin` field equals `ADMIN_ADDRESS` env var | TonClient `getContractState` + decode `admin` field | Exact equality |
| V-3 | `risk_authority` on `AccountLocks` equals `RISK_AUTHORITY_ADDRESS`, distinct from `admin` | TonClient state read | Exact equality + inequality |
| V-4 | Cross-contract wiring matches [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.1 | Read `account_locks` / `nft_account_resolver` / `account_state_machine` / `payment_hub` / `collateral_signal` fields on each downstream contract | Each address equals the upstream contract's deploy address |
| V-5 | Pre-existing mainnet artefacts (TBC, NFT 7777, NFT 8888, TONCO) match [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §6 | Compare addresses in `NFTAccountResolver` against the constants in `DEPLOYMENT_PLAN.md` §6 | Exact match; mainnet ↔ testnet swap rejected |
| V-6 | Governance contracts deployed but `activated = false` | `STATUS.md` §8 inspection | All rows `activated = no` until 7-day soak completes |

V-1 … V-5 are run by `scripts/deploy/verify.ts` as part of the runbook flow. V-6 is a manual gate that prevents premature client-code references to the governance contracts.

### 2.1 Block / tx receipts

For each deploy, the manifest records:

- `deployTx` — the multi-sig wrapper tx hash.
- `deployBlock` — the masterchain seqno where the tx landed.
- `deployedAt` — ISO-8601 timestamp.
- TONviewer URL — appended to [`STATUS.md`](./STATUS.md) §7 / §8 for human auditors.

All three values are pulled by `verify.ts` from the TonClient response and persisted in the manifest. The block height is checked against `getMasterchainInfo` to confirm finality (≥ 8 blocks after the deploy block).

---

## 3. End-to-end test transaction

A **single end-to-end test transaction** confirms that the deployed contracts behave per the audited semantics on the live network. The test tx exercises the happy path defined in [B1 VALIDATION_PLAN](../B1-testnet/VALIDATION_PLAN.md) §2 (E2E-1, E2E-2, E2E-5) but on **mainnet** with **minimum-value** transfers.

The end-to-end test tx is **always** funded from the deployment operator's hot test wallet (NOT from the multi-sig). The test wallet holds **just enough** TBC and TON for the test scenarios — a few cents' worth. Even if the test wallet were entirely lost, the loss is bounded.

| ID | Scenario | Pre-conditions | Action | Pass criterion |
|----|----------|----------------|--------|----------------|
| V-7 | NFT ownership resolution via `PaymentHub` | Test wallet holds an NFT from Series 7777 *or* 8888 | Send a `resolve_account` query to `PaymentHub` and read the result | Returned account equals the test wallet's resolved account |
| V-8 | Internal TBC transfer (debit + credit atomic) | Sender and recipient both hold valid Series cards; sender has 1 µTBC | Send a `transfer` message via `PaymentHub` with the minimum amount | Sender balance decreased, recipient balance increased, single tx, no orphaned debit (invariants I4 + I5 attested) |
| V-9 | Account-lock blocks outgoing transfer | Sender lock set by `risk_authority` | Attempt a transfer; expect rejection | Transfer rejected with the documented bounce code (invariant I7 attested) |

After V-9 the test lock is cleared by the `risk_authority` key and the test wallet is documented in [`STATUS.md`](./STATUS.md) §9.2. The test transactions are recorded by tx hash and TONviewer URL.

---

## 4. 24-hour soak window

After the end-to-end test transaction completes and the atomic doc-update PR is merged, a **24-hour soak window** begins. During the soak:

- No public marketing announcement is published.
- No merchant onboarding flow is enabled.
- The protocol contracts are observable on TONviewer and the addresses are in `docs/existing-contracts.md`, but the audience is limited to the deployment team and reviewers.
- A monitoring dashboard (engagement B3 — out of scope of B2) watches for unusual tx patterns on the deployed contracts.

If a Critical or High finding surfaces during the soak, the verdict is **not** flipped and [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §3 is followed.

Public announcement gating is a hard rule — see [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) AF-6.

---

## 5. Verifier outputs

Every run of `scripts/deploy/verify.ts` produces a verification report at:

```
deployments/mainnet/<manifest-timestamp>.verification.json
```

The report carries:

- The manifest filename it verifies.
- The list of `VerificationResult` entries (one per contract).
- The boolean `allPassed`.
- A timestamp.

The verification report is committed to git in the same PR as the manifest. The verification report path is referenced from the manifest under each contract's `verification.report` field.

---

## 6. Re-verification policy

The post-deploy verification report is **not a one-shot artifact**. The following triggers re-verification:

- Compiler-toolchain upgrade in `audit/FREEZE_METADATA.md` — re-verify code-hash against the new build artefacts.
- Discovery of a new forbidden pattern in `verify.ts` `verifyInvariants` — re-run the source scan against deployed contracts.
- A roll-back / supersede event in [`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) — generates a fresh verification report against the new manifest.
- A 90-day cadence — verifier is re-run quarterly even if no triggers fired. Result archived under `deployments/mainnet/<original-timestamp>.verification.<re-run-timestamp>.json`.

The cadence is enforced by a CI job (engagement B3 — out of scope of B2 but referenced here).

---

## 7. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Mainnet runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Multi-sig ceremony](./MULTISIG_CEREMONY.md)
- [Immutability verification](./IMMUTABILITY_VERIFICATION.md)
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Verify script](../../../scripts/deploy/verify.ts)
- [B1 validation plan (testnet)](../B1-testnet/VALIDATION_PLAN.md)
- [Formal invariants](../../../audit/INVARIANTS.md)
