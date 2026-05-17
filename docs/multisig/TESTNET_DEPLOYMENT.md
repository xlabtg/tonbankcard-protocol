# Multi-Sig Card — Testnet Deployment & End-to-End Verification

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **testnet deployment blocked until A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the **testnet
deployment plan**, the **end-to-end multi-sig flow** that exercises
the deployed contract, and the **test bar** (28 wallet-ui tests)
required by Issue #140 §8 acceptance criteria **AC-3**, **AC-7**, and
**AC-8**.

It binds the previously-documented surfaces ([`SPECIFICATION.md`](./SPECIFICATION.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`MONITORING.md`](./MONITORING.md),
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md)) to a single
rollout sequence so that the testnet milestone is a verifiable,
reproducible artefact the auditor and the operator can both replay.

The mainnet rollout is **not** in scope for this document. Mainnet
gates on A2 `READY` + the post-A2 hardening bundle in
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) and a separate
deployment runbook will be written under that follow-up issue.

Unlike the F4 (Recurring Payments) testnet rollout, F5 has **no
dashboard surface** — Issue #140 §3 only mandates the wallet flows
(creation, pending approvals, sign/reject, signer management). The
AC-8 test bar therefore reduces to the **wallet-ui (28)** count,
without the F4 dashboard (47) group.

---

## 2. Acceptance criteria this artifact satisfies

| AC  | Requirement | Where in this document |
|-----|-------------|------------------------|
| AC-3 | `MultiSigCard.tact` deployed to testnet | §3 deployment manifest, §4 deployment steps |
| AC-7 | End-to-end multi-sig flow tested on testnet | §5 e2e plan (configure → propose → approve → settle → recover) |
| AC-8 | Wallet-ui tests (28) pass | §6 test bar |

AC-1 (A2 audit) is treated as a **strict prerequisite** in §3.1.

---

## 3. Deployment manifest

### 3.1 Gating preconditions

| Precondition | Source | State required |
|--------------|--------|----------------|
| A2 audit verdict | [`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) → `STATUS.md` | `verdict: READY`, zero critical/high open on `MultiSigCard.tact` |
| Contract bytecode | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) | Compiled hash matches the value the auditor signed off on |
| Deployer wallet | `docs/deployments/multisig-testnet/deployer.txt` | Address known, ≥ 5 TON balance on testnet |
| Wallet-ui build | `wallet-ui` package | Create / pending / sign / reject / signer-management flows wired ([`WALLET_UX.md` §§3–6](./WALLET_UX.md)) |
| Notifications adapter | [`NOTIFICATIONS.md` §3](./NOTIFICATIONS.md) | MS-N01..MS-N08 wired to the same dispatcher F4 uses; opt-in defaults documented |
| Monitoring adapter | [`MONITORING.md` §3](./MONITORING.md) | MS-M01..MS-M18 dashboards stood up against the testnet contract address |
| CI green | `scripts/multisig/check-multisig-readiness.ts` | `OK` on the deployment commit |

If any precondition is red, the testnet deployment is **postponed**;
the deployment runbook does not allow waiver-by-comment.

### 3.2 Deployment artefacts

The deployment produces the following artefacts, each committed to
the repository under `docs/deployments/multisig-testnet/`:

| Artefact | Contents |
|----------|----------|
| `manifest.json` | Contract address, deployer address, bytecode hash, `init_data` blob, deployment block height, deployment tx hash. |
| `deploy-tx.boc` | Raw BOC of the deployment message (for reproducible re-verify). |
| `verify.txt` | Output of the on-chain code-hash retrieval matching the local build. |
| `seed-script.ts` | Script that seeds testnet NFT owners via `RegisterNFTOwnerMultiSig` (test-only; removed in mainnet per [`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md)). |
| `multisig-flow.log` | End-to-end log of the §5 happy path. |
| `recovery-drill.log` | End-to-end log of the §5.5 guardian recovery drill (off-chain pre-MS-CH-6). |

The manifest is the single artefact that downstream documents
([`WALLET_UX.md`](./WALLET_UX.md),
[`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md),
[`MONITORING.md`](./MONITORING.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md)) point at for the testnet
contract address.

### 3.3 Network selection

Testnet is **TON testnet** (`testnet.toncenter.com` / `t.me/testgiver_ton_bot`).
The wallet-ui and indexer switch network via the existing env-var
pattern (`TON_NETWORK=testnet`); no multi-sig-specific switch is
added.

---

## 4. Deployment steps

The deployment runs **once** per A2-approved bytecode hash. A
subsequent re-deploy (after MS-CH-N hardening) is a separate ceremony
documented in its own runbook.

1. **Verify gating preconditions** (§3.1). The CI validator
   [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
   is the canonical green-light.
2. **Build the contract** at the exact commit the auditor signed:
   `npx tact --config tact.config.json` produces
   `build/MultiSigCard/tact_MultiSigCard.code.boc`.
3. **Compute and record the bytecode hash**. Append to
   `docs/deployments/multisig-testnet/verify.txt`.
4. **Deploy** via the existing deployment helper
   (`scripts/deploy.ts --contract MultiSigCard --network testnet`).
   The deployer wallet is the only key that holds the test-only
   `RegisterNFTOwnerMultiSig` authority — this is the same key
   recorded in `manifest.json` under `deployer`
   ([contract lines 198–208](../../contracts/MultiSigCard.tact)).
5. **Seed NFT owners.** Run `seed-script.ts` to wire up the test
   wallets registered for the §5 e2e flow. Each invocation goes
   through the gated test-only handler at
   [contract lines 569–573](../../contracts/MultiSigCard.tact),
   which refuses to overwrite an already-registered owner.
6. **Smoke check.** Call the read-only getters (`getMultiSigConfig`,
   `getPaymentProposal`, `nft_owners`) from a console to confirm the
   contract is live and the seed worked.
7. **Wire downstream surfaces.** Patch the contract address into the
   `wallet-ui` config files. Trigger the staging indexer and
   notification scheduler to start consuming the new contract
   address.
8. **Publish.** Commit the deployment artefacts (§3.2) to the
   repository under `docs/deployments/multisig-testnet/`. Open a
   status comment on issue #140 referencing the `manifest.json`
   blob.

Step 5 (seeding) is **testnet-only** per MS-CH-2 — mainnet does not
allow `RegisterNFTOwnerMultiSig` at all
([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

---

## 5. End-to-end multi-sig flow (AC-7)

The e2e flow is run **immediately** after step 8 above. It produces
`multisig-flow.log` (§§5.2–5.4) and `recovery-drill.log` (§5.5) and
serves as the visible artefact for AC-7.

### 5.1 Fixture

| Actor | Wallet | Role |
|-------|--------|------|
| Owner | `test-owner.tonconnect.json` | Holds Diamond NFT #T-card (seeded in step 5); calls `ConfigureMultiSig`, `SubmitPaymentProposal`. |
| Signer 1 | `test-signer-1.tonconnect.json` | Listed as `signer_1` in `MultiSigConfig`; approves proposals. |
| Signer 2 | `test-signer-2.tonconnect.json` | Listed as `signer_2`; second approver. |
| Signer 3 | `test-signer-3.tonconnect.json` | Listed as `signer_3`; used for the 3-of-3 negative case in §5.3. |
| Recipient | `test-recipient.tonconnect.json` | Receives the post-quorum off-chain TBC transfer. |
| Guardian A / B / C | three separate keys, stored off-chain only ([`GUARDIAN_RECOVERY.md` §3.3](./GUARDIAN_RECOVERY.md)) | Used by §5.5 recovery drill. |

### 5.2 Happy path (golden)

Configuration model: **2-of-3 personal** preset
([`SPECIFICATION.md` §4.1](./SPECIFICATION.md)) — `required_signatures = 2`,
three signer slots filled.

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | Owner taps **Create multi-sig** in wallet-ui, fills the threshold form (2-of-3), and signs `ConfigureMultiSig`. | Wallet-ui ([`WALLET_UX.md` §3](./WALLET_UX.md)) | On-chain `MultiSigConfigured` event observed; `MultiSigConfig{is_active: true, required_signatures: 2, signer_1/2/3}` returned by the getter. |
| 2 | Owner taps **New proposal**, fills recipient + amount, and signs `SubmitPaymentProposal`. | Wallet-ui ([`WALLET_UX.md` §5](./WALLET_UX.md)) | On-chain `PaymentProposalSubmitted` event observed; `PaymentProposal{status: PENDING, recipient, amount, approval_count: 0}` returned by the getter. MS-N01 dispatched to Signer 1 and Signer 2 per [`NOTIFICATIONS.md` §3.1](./NOTIFICATIONS.md). |
| 3 | Signer 1 taps **Approve** on the pending row, signs `ApprovePaymentProposal`. | Wallet-ui ([`WALLET_UX.md` §4](./WALLET_UX.md)) | `PaymentProposalApproved` event observed with `approval_count: 1`; proposal still `PENDING`. |
| 4 | Signer 2 taps **Approve**, signs `ApprovePaymentProposal`. | Wallet-ui ([`WALLET_UX.md` §4](./WALLET_UX.md)) | `PaymentProposalApproved` event observed with `approval_count: 2` and `quorum_reached: true`; status flips to `APPROVED`. MS-N03 dispatched to Owner + all signers per [`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md). |
| 5 | Owner triggers the off-chain settlement leg (Payment Hub TBC transfer) per [`SPECIFICATION.md` §3.4](./SPECIFICATION.md). | Wallet-ui post-quorum sheet | TBC transfer succeeds; owner balance decreases, recipient balance increases (I4 atomic, I5 conservation). MS-N05 dispatched per [`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md). |

### 5.3 Error-path coverage

Each error code at [contract lines 125–134](../../contracts/MultiSigCard.tact)
is exercised by at least one e2e case:

| Error | Cause | Triggering input | Surface check |
|-------|-------|------------------|---------------|
| `ERROR_MS_NOT_OWNER = 1` | Non-owner calls `ConfigureMultiSig` or `SubmitPaymentProposal`. | Sign `ConfigureMultiSig` from a wallet that does not own the NFT card. | Wallet-ui shows "This wallet does not own the selected NFT card. Switch wallets and retry." ([`WALLET_UX.md` §3](./WALLET_UX.md)). |
| `ERROR_MS_NOT_SIGNER = 2` | A non-signer wallet calls `ApprovePaymentProposal` / `RejectPaymentProposal`. | Sign `ApprovePaymentProposal` from a wallet not in `signer_1/2/3`. | Wallet-ui shows "This wallet is not a signer on the selected card." ([`WALLET_UX.md` §4.4](./WALLET_UX.md)); MS-M06 fires ([`MONITORING.md` §3.2](./MONITORING.md)). |
| `ERROR_MS_INVALID_THRESHOLD = 3` | `required_signatures < 1` or `> MAX_SIGNERS = 3`. | Submit `ConfigureMultiSig` with `required_signatures = 0` or `4`. | Wallet-ui shows "This threshold is outside the supported 1–3 range." Server validation rejects pre-flight per [`WALLET_UX.md` §3.4](./WALLET_UX.md). |
| `ERROR_MS_PROPOSAL_NOT_FOUND = 4` | Approve / reject against a never-submitted proposal. | Approve with an unknown `proposal_id`. | Wallet-ui surfaces "Proposal not found — it may have been cancelled." MS-M05 fires ([`MONITORING.md` §3.2](./MONITORING.md)). |
| `ERROR_MS_ALREADY_APPROVED = 5` | Same signer approves the same proposal twice. | Signer 1 replays `ApprovePaymentProposal`. | Wallet-ui shows "You have already approved this proposal."; `approval_count` does not double-count (MS-3 monotonicity, [`SPECIFICATION.md` §3.2](./SPECIFICATION.md)). |
| `ERROR_MS_PROPOSAL_NOT_PENDING = 6` | Approve / reject a proposal that is already `APPROVED`, `REJECTED`, or `EXECUTED`. | Run step 3 after step 4 in §5.2. | Wallet-ui shows "This proposal is no longer pending."; pending row disappears from the queue. |
| `ERROR_MS_NFT_NOT_REGISTERED = 7` | `ConfigureMultiSig` or `SubmitPaymentProposal` against an NFT not yet seeded. | Skip step 5 for one of the test wallets. | Wallet-ui shows "Your NFT card is not yet registered with the protocol." ([`WALLET_UX.md` §3.4](./WALLET_UX.md)). |
| `ERROR_MS_NO_CONFIG = 8` | `SubmitPaymentProposal` against a card that never ran `ConfigureMultiSig`. | Skip step 1 of §5.2. | Wallet-ui shows "Multi-sig is not configured for this card. Run setup first." |
| `ERROR_MS_INVALID_AMOUNT = 9` | `amount == 0` in `SubmitPaymentProposal`. | Bypass wallet-ui validation; submit raw `SubmitPaymentProposal`. | Wallet-ui shows "Payment amount must be greater than zero." |

The post-A2 hardening codes (none currently allocated beyond
`ERROR_MS_INVALID_AMOUNT = 9`) are **not** part of the testnet e2e —
they will be added under the relevant MS-CH-N hardening item
([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

### 5.4 Notifications integration

The e2e run exercises one notification cycle for each lifecycle
transition:

1. After §5.2 #2, the notification scheduler dispatches MS-N01 to
   each pending signer ([`NOTIFICATIONS.md` §3.1](./NOTIFICATIONS.md)).
2. After §5.2 #4 (quorum reached), the scheduler dispatches MS-N03
   to Owner and all signers
   ([`NOTIFICATIONS.md` §3.2](./NOTIFICATIONS.md)).
3. After §5.2 #5 (off-chain settlement), the scheduler dispatches
   MS-N05 to Owner and recipient
   ([`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md)).
4. The rejection path (Signer 1 rejects in place of approve)
   dispatches MS-N04 per
   [`NOTIFICATIONS.md` §3.3](./NOTIFICATIONS.md).

The dedup key
`(user_id, nft_address, proposal_id, MS-Nxx)` from
[`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md) is asserted by re-running
the scheduler once after each step and verifying no duplicate push
lands.

### 5.5 Guardian recovery drill

Recovery is **off-chain** until MS-CH-6 ships
([`GUARDIAN_RECOVERY.md` §4.2](./GUARDIAN_RECOVERY.md)). The testnet
drill therefore exercises the documented off-chain ceremony and
captures it in `recovery-drill.log` for AC-7 traceability:

| # | Step | Surface | Asserted outcome |
|---|------|---------|------------------|
| 1 | Owner declares "key lost" in wallet-ui; selects two guardians (A, B) from the off-chain guardian set. | Wallet-ui guardian recovery entry ([`WALLET_UX.md` §7](./WALLET_UX.md)) | Recovery proposal opened with `state = PENDING`, `proposed_at = now()`. |
| 2 | Guardian A signs the recovery proposal off-chain via TON Connect. | Wallet-ui guardian sign sheet | Recovery proposal accumulates 1 of 2 required approvals. |
| 3 | Guardian B signs the recovery proposal off-chain. | Wallet-ui guardian sign sheet | Recovery proposal transitions `PENDING → APPROVED`; cooldown timer starts (72 h per [`GUARDIAN_RECOVERY.md` §4.1](./GUARDIAN_RECOVERY.md)). |
| 4 | Cooldown elapses (drill uses a 60-second skew on testnet; mainnet honours 72 h). | Wallet-ui cooldown banner | `state = APPROVED` and `cooldown_remaining = 0`; recovery now executable. |
| 5 | Owner executes the recovery, which **only** replaces the owner-side key reference in `nft_owners` via the seeded test-only path (testnet); the on-chain signer rotation is deferred to MS-CH-6. | Wallet-ui recovery completion sheet | New owner key observed on the next NFT-owner read; MS-N08 dispatched ([`NOTIFICATIONS.md` §3.4](./NOTIFICATIONS.md)); MS-M14 fires ([`MONITORING.md` §3.3](./MONITORING.md)). |

The drill explicitly asserts the **negative** case: a guardian who
is also a signer on the same card is rejected at step 1 per
[`GUARDIAN_RECOVERY.md` §3.2](./GUARDIAN_RECOVERY.md). The cooldown
override path (skipping step 4) is rejected with a wallet-ui block.

---

## 6. Test bar (AC-8)

AC-8 requires "wallet-ui (28 tests) pass". The breakdown below is
the **shape** of the test bar — each row is a test or a
tightly-coupled group of tests that collectively land on the listed
count.

### 6.1 Wallet-ui test bar (28 tests)

The wallet-ui repository's test runner (`vitest` + Playwright for
the smoke layer) groups tests against
[`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts)
as follows:

| Group | Count | What it covers |
|-------|-------|----------------|
| Create multi-sig | 5 | Threshold form rendering, 2-of-3 / 3-of-5 / custom preset selection, ownership pre-flight against the NFT picker, signature dispatch, `MultiSigConfigured` round-trip ([`WALLET_UX.md` §3](./WALLET_UX.md)). |
| Configure failure | 3 | Each on-chain error code 1/3/7 from §5.3 surfaces the correct UX message; server pre-flight rejects out-of-range threshold before signature. |
| Pending approvals list | 4 | Per-signer queue derivation; one-tap approve / reject affordances ([`WALLET_UX.md` §4](./WALLET_UX.md)); sort by newest-first; dedup across multiple cards. |
| Approve / reject flow | 5 | Approve signature dispatch; reject signature dispatch; `approval_count` increments only after on-chain confirmation; double-approve blocked client-side (code 5); non-signer rejected (code 2). |
| Submit proposal | 3 | Recipient + amount fields validated; zero-amount rejected (code 9); `PaymentProposalSubmitted` round-trip. |
| Signer management (post-MS-CH-2) | 2 | "Add signer" and "Remove signer" entry points are quorum-gated ([`WALLET_UX.md` §6](./WALLET_UX.md)); rendered as **disabled** today with a banner pointing at MS-CH-2. |
| Guardian recovery hook | 3 | Recovery entry point gated on the off-chain guardian set ([`WALLET_UX.md` §7](./WALLET_UX.md)); cooldown banner shown; guardian-also-signer combination rejected. |
| Invariant guardrails | 3 | No auto-signed `ApprovePaymentProposal` on schedule (I1); NFT picker filters to wallet-owned cards (I2); no admin "force-execute" button (I3). |
| **Total** | **28** | |

### 6.2 Contract test suite (existing, not part of AC-8)

The Tact contract test-suite in
`tests/multisig/MultiSigCard.spec.ts` continues to run on every PR.
It is **not** part of the AC-8 count (AC-8 explicitly names
"wallet-ui (28)"); it remains green as a strict prerequisite via the
existing CI.

The ts-jest readiness validator
([`tests/multisig/MultiSigReadinessValidator.spec.ts`](../../tests/multisig/MultiSigReadinessValidator.spec.ts))
runs alongside the contract suite and asserts drift-freeness between
this document, the contract source, and the wallet-ui spec file.

---

## 7. Mainnet rollout (out of scope)

For traceability, the mainnet rollout sequence is:

1. **A2 verdict `READY`** + no critical/high open on
   `MultiSigCard.tact`.
2. **Hardening bundle** — MS-CH-1..MS-CH-6 from
   [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md) ship under
   a separate issue and PR.
3. **Mainnet multi-sig ceremony for the deployer key** —
   `docs/deployments/multisig-mainnet/multisig.deployer.json` exists
   with `threshold >= 2`. The deployer key remains custodial to the
   protocol-owned multi-sig wallet (I1 untouched: users' card keys
   remain non-custodial).
4. **Re-deploy** — repeat §4 against mainnet with the hardened
   bytecode hash, **without** the test-only `RegisterNFTOwnerMultiSig`
   seeding step.
5. **Mainnet runbook** — a dedicated runbook will be written under
   the post-A2 issue. This testnet document is **not** the source
   of truth for mainnet.

---

## 8. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §3.1 declares the gating preconditions. |
| AC-3 | `MultiSigCard.tact` deployed to testnet | §3 manifest + §4 deployment steps. |
| AC-6 | Guardian recovery flow tested | §5.5 guardian recovery drill. |
| AC-7 | End-to-end flow tested on testnet | §5 happy path + §5.3 error-path coverage + §5.4 notifications integration + §5.5 recovery drill. |
| AC-8 | Tests pass | §6.1 wallet-ui (28). |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| Wallet-ui spec         | [`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned) | [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
