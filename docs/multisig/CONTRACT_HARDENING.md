# Multi-Sig Card — Contract Hardening Track (post-A2)

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **no contract code shipped until A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document collects every contract-level change planned for the
multi-sig card module as part of production hardening. The
changes are intentionally **deferred** past the A2 audit baseline —
landing any of them before A2 returns verdict `READY` would
invalidate the audit scope and reset the engagement clock.

The pattern mirrors the F3 PR #206 (cross-chain bridge, issue #138)
and F4 PR #207 (recurring payments, issue #139) approaches:
governance documents, off-chain validators, and tests land now under
issue #140; contract code lands later, in a follow-up PR that
explicitly cites this document and the A2 verdict.

Every other multi-sig production-readiness document
([`SPECIFICATION.md`](./SPECIFICATION.md),
[`WALLET_UX.md`](./WALLET_UX.md),
[`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md),
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md),
[`MONITORING.md`](./MONITORING.md),
[`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md),
[`BUG_BOUNTY.md`](./BUG_BOUNTY.md)) references **MS-CH-N** items by
ID from §3 below — this is the single source of truth for the
contract changes the multi-sig production launch depends on.

---

## 2. Why deferred (not "future-work")

Issue #140 §8 names A2 as a **hard prerequisite**:

> _"AC-1: A2 audit complete (prerequisite). Phase 4 contract audit
> (`A2-phase4-contracts`) returns verdict `READY`; no critical or
> high finding remains open against `MultiSigCard.tact`."_

The A2 engagement
([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
§4.2) locks the contract artefact at a specific commit hash so that
the auditor can sign off on a single bytecode. Changing any line of
[`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact)
ahead of the audit:

1. Invalidates the auditor's bytecode hash.
2. Resets the clock on the threat-catalogue review (MSC-1..MSC-7,
   X-1, X-5 from the A2 engagement scope).
3. Disqualifies the deployment manifest from the multi-sig mainnet
   ceremony documented in
   [`TESTNET_DEPLOYMENT.md` §7](./TESTNET_DEPLOYMENT.md).

Therefore each MS-CH-N item below is **designed but not landed**
under issue #140. Landing happens in a follow-up issue referencing
this document, gated by the conditions in §4.

---

## 3. Hardening Backlog

Each row below has the same shape: the threat it closes, the
contract diff in shape (not in literal code), and the cross-document
references that flip from "operationally mitigated" to "closed
on-chain" once the change ships.

### MS-CH-1 — Composite-key hardening (`proposalKey` / `approvalKey`)

**Status: LANDED** (issue #259 / CONTRACTS-H2). The composite-key
hardening shipped alongside the multi-sig execution path, because the
old combinator did not merely risk collisions — it reverted on-chain
and made the entire proposal flow non-functional, so it had to be
fixed for an approved payment to be executable at all.

**Closes threat:** T-MSC-1 signature replay, T-MSC-6 composite-key
collision ([`SPECIFICATION.md` §9](./SPECIFICATION.md)), A2
§X-5 (structurally identical to the bridge CH-2 finding and the
F4 RP-CH-1 finding).

**Shape of change (as landed):**

| Element | Change |
|---------|--------|
| `proposalKey` | Replaced `sha256(nft_address.asSlice()) + proposal_id` with the representation hash of a packed cell: `beginCell().storeAddress(nft_address).storeUint(proposal_id, 64).endCell().hash()`. |
| `approvalKey` | Replaced `sha256(nft_address.asSlice()) + proposal_id * 1000 + sha256(signer.asSlice())` with `beginCell().storeAddress(nft_address).storeUint(proposal_id, 64).storeAddress(signer).endCell().hash()`. |
| Implementation note | The originally-proposed `sha256(beginCell()…endCell().asSlice())` form was **not** used: `sha256` over a slice requires byte-aligned input, and a cell containing a 267-bit `Address` is not byte-aligned, so that form would itself revert with cell-underflow (exit 9). `Cell.hash()` (the representation hash) is well-defined for any cell, always returns a 256-bit value, and needs no domain-separation string because the field layout (`Address` + `uint64` [+ `Address`]) is already unambiguous and distinct between the two functions. |
| Root cause closed | The old form reverted on-chain twice over: (1) `sha256(Address.asSlice())` underflowed on the non-byte-aligned 267-bit slice (exit 9); (2) summing two 256-bit digests in `approvalKey` overflowed TVM's 257-bit signed integer range (exit 4). Both are eliminated. |
| Storage shape | No change to `proposals` or `approvals` map shapes (still `map<Int, PaymentProposal>` / `map<Int, Bool>`); only the key derivation functions change. |
| Backwards compatibility | None required — the contract has not gone live, so no pre-existing proposals to migrate. |
| Error code | No new code required — collision attempts already fall through to `ERROR_MS_PROPOSAL_NOT_FOUND = 4` or `ERROR_MS_NOT_SIGNER = 2`. |
| Getters | Existing `getProposal(nft_address, proposal_id)` and `hasApproved(nft_address, proposal_id, signer)` are unchanged at the ABI level (they still re-derive the key internally). |

**Migration:** None — the testnet-only deployment from
[`TESTNET_DEPLOYMENT.md` §4](./TESTNET_DEPLOYMENT.md) is throwaway
state.

**Tests at landing:** the multi-sig execution regression suite
(`contracts/multisig/MultiSigExecution.spec.ts`) exercises the full
submit → approve → execute lifecycle end-to-end in a sandbox VM, which
only succeeds because the hardened keys no longer revert. The
`CT.proposalKey.hardened` / `CT.approvalKey.hardened` checks in
`scripts/multisig/check-multisig-readiness.ts` guard against a
regression back to the broken integer-addition combinator.

**Doc references that update:** [`SPECIFICATION.md`
§9 T-MSC-1, T-MSC-6](./SPECIFICATION.md) flip to closed on-chain;
[`MONITORING.md` §3.2 MS-M05](./MONITORING.md) drops the
collision-suspect L1 alert (kept as defence in depth at L1).

### MS-CH-2 — Remove test-only `RegisterNFTOwnerMultiSig`; add quorum-gated `UpdateMultiSigConfig`

**Closes threat:** T-MSC-2 quorum manipulation, T-MSC-7 test-only
handler reaches mainnet ([`SPECIFICATION.md` §9](./SPECIFICATION.md),
A2 §X-1).

**Shape of change:**

| Element | Change |
|---------|--------|
| `RegisterNFTOwnerMultiSig` handler ([contract lines 569–573](../../contracts/MultiSigCard.tact)) | Remove from mainnet build. Either delete unconditionally, or gate behind a Tact `#ifdef TESTING` equivalent if Tact gains conditional compilation by then. |
| Message type `RegisterNFTOwnerMultiSig` ([contract lines 577–581](../../contracts/MultiSigCard.tact)) | Remove from mainnet build. |
| `self.deployer` storage field | Remains for two-phase admin transfer used by MS-CH-7 (pause-flag follow-up); not removed by this item. |
| Production NFT-owner seeding | Replaced by integration with `DiamondMintingHub.tact` (NFT-card ownership flows directly from the mint-hub state) — see [`SPECIFICATION.md` §7.1](./SPECIFICATION.md) note on `nft_owners` source-of-truth. |
| New message `UpdateMultiSigConfig` | `message UpdateMultiSigConfig { nft_address: Address; new_signers: Cell; new_required: Int as uint8; quorum_signatures: Cell; }`. The `quorum_signatures` cell carries the M current-signer signatures over the canonical change blob. Receiver verifies the cell against the current `MultiSigConfig` and only then mutates `signer_1/2/3` and `required_signatures`. |
| Authority | Gated by quorum verification, **not** by `sender() == self.deployer` — there must be no admin path that bypasses the multi-sig itself (invariant I3). |
| Error code | New `ERROR_MS_QUORUM_NOT_REACHED = 10` for `UpdateMultiSigConfig` (distinct from the proposal-flow `ERROR_MS_ALREADY_APPROVED = 5` and `ERROR_MS_PROPOSAL_NOT_PENDING = 6` codes already used at [contract lines 130–131](../../contracts/MultiSigCard.tact)). |
| Events | `MultiSigConfigUpdated { nft_address, new_required, new_signers_hash, timestamp }`. |
| Getters | Existing `getMultiSigConfig(nft_address)` is unchanged at the ABI level. |

**Migration:** The mainnet deployment ceremony documented in
[`TESTNET_DEPLOYMENT.md` §7](./TESTNET_DEPLOYMENT.md) populates the
production `nft_owners` view via the integration handler, never via
the test-only register. Existing testnet `MultiSigConfig` rows
remain valid; the new `UpdateMultiSigConfig` flow only applies to
future signer-set changes.

**Tests required at landing:** assert the mainnet artefact does not
export `RegisterNFTOwnerMultiSig`; assert the test-suite uses the
production owner-resolution path (mirrored from the F3 CH-7 and F4
RP-CH-2 test patterns); quorum-blob verification happy path and
rejection cases (M-1 signatures, signatures from non-signers,
duplicate signatures, signatures over a wrong blob).

**Doc references that update:** [`SPECIFICATION.md` §7.1
Test-only handler](./SPECIFICATION.md) is removed entirely from the
mainnet doc set; [`SPECIFICATION.md` §6.1](./SPECIFICATION.md) flips
from "operationally enforced" to "on-chain enforced";
[`docs/governance/PARAMETERS.md` PP-40 MultiSigCard row](../governance/PARAMETERS.md)
is struck through.

### MS-CH-3 — On-chain settlement integration with Payment Hub

**Closes threat:** T-MSC-3 partial execution / approved-but-not-settled
([`SPECIFICATION.md` §9](./SPECIFICATION.md), A2 §C-MSC-H1).

**Shape of change:**

| Element | Change |
|---------|--------|
| `receive(ApprovePaymentProposal)` ([contract line 342](../../contracts/MultiSigCard.tact)) | When `status` transitions from `PENDING` to `APPROVED` (i.e. the M-th approval is recorded), emit a `PaymentExecuted` message to `self.payment_hub` carrying `nft_address`, `proposal_id`, `amount`, `recipient`, and `proposal_key`. |
| Storage | Add `payment_hub: Address` initialised at deploy time to the canonical `PaymentHub.tact` address; immutable. |
| Status transition | `APPROVED` becomes a terminal state on the multi-sig side; the Payment Hub independently emits `PaymentExecuted` events that the indexer consumes to flip the proposal from "approved" to "settled" in the dashboard view. |
| New status | `PROPOSAL_SETTLED = 4` — set by the multi-sig itself after receiving a `PaymentSettled` callback from the Payment Hub. |
| Idempotency | The `PaymentSettled` callback is gated by `require(sender() == self.payment_hub, ...)` and rejects re-entry for the same `proposal_id`. |
| Error code | New `ERROR_MS_SETTLEMENT_PENDING = 11` if a re-approval is attempted between `APPROVED` and `PROPOSAL_SETTLED` (this protects against the user thinking the approval failed and double-spending). |
| Events | `ProposalSettled { nft_address, proposal_id, amount, recipient, settled_at }`. |

**Migration:** Existing `PaymentProposal` rows with `status =
PROPOSAL_APPROVED` (testnet only) are migrated to
`PROPOSAL_SETTLED` via the deployment ceremony (single `SetSettled`
maintenance message — also removed post-migration).

**Tests required at landing:** approval flow happy path (M-1 then
M-th approval triggers `PaymentExecuted`); double-settlement
rejection; settlement callback from non-PaymentHub sender rejected;
indexer reconstructs the full APPROVED → SETTLED transition without
needing wall-clock polling.

**Doc references that update:** [`SPECIFICATION.md` §3.4
Settlement boundary](./SPECIFICATION.md) flips from "off-chain"
to "on-chain"; [`MONITORING.md` §3.3 MS-M09 stuck-approved
proposals](./MONITORING.md) flips from "manual escalation" to
"automated alert if SETTLED transition does not arrive within 5 min".

### MS-CH-4 — Expand `MAX_SIGNERS` from 3 to 10

**Closes:** the corporate-tier capacity gap noted in
[`SPECIFICATION.md` §4.3](./SPECIFICATION.md). Today the contract
only supports 3 signers; Issue #140 calls for up to 10.

**Shape of change:**

| Element | Change |
|---------|--------|
| Constant `MAX_SIGNERS` ([contract line 136](../../contracts/MultiSigCard.tact)) | Raise from `3` to `10`. |
| `MultiSigConfig` struct ([contract lines 142–149](../../contracts/MultiSigCard.tact)) | Replace the fixed `signer_1, signer_2, signer_3` fields with `signers: map<Int, Address>` (key = signer index 0..9). |
| `isSigner(nft_address, addr)` ([contract line 498](../../contracts/MultiSigCard.tact)) | Iterate the `signers` map instead of three explicit comparisons. |
| Approval check threshold | `required_signatures` validation in `receive(ConfigureMultiSig)` ([contract line 225](../../contracts/MultiSigCard.tact)) keeps the same bound check but the upper bound becomes 10. |
| Error code | No new code; `ERROR_MS_INVALID_THRESHOLD = 3` already covers the 1..N bound. |
| Getters | New `get fun getSigners(nft_address: Address): map<Int, Address>` for wallet-UI rendering. |

**Migration:** Existing testnet `MultiSigConfig` rows with three
filled signer slots are read with `signers[0..2]` and the higher
slots default to `null` per Tact map semantics. No data loss.

**Tests required at landing:** quorum check on a 7-of-10 config;
quorum check on a 1-of-10 config; `ConfigureMultiSig` with
`required_signatures = 11` rejected with
`ERROR_MS_INVALID_THRESHOLD`; existing 2-of-3 and 3-of-5 tests
re-run unchanged after the migration.

**Doc references that update:** [`SPECIFICATION.md` §4.3 Custom
M-of-N](./SPECIFICATION.md) flips from "wallet caps at 3" to "wallet
caps at 10"; [`WALLET_UX.md` §3 creation wizard](./WALLET_UX.md)
drops the conditional cap;
[`docs/governance/PARAMETERS.md` MS_MAX_SIGNERS](../governance/PARAMETERS.md)
flips from `3` to `10`.

### MS-CH-5 — On-chain proposal TTL enforcement

**Closes:** the stuck-proposal UX hazard documented in
[`SPECIFICATION.md` §5.4](./SPECIFICATION.md). Today proposals never
expire on-chain; the wallet hides anything older than 7 days, but an
attacker who controls the wallet UI could surface a stale proposal
and trick a signer into approving an obsolete payment.

**Shape of change:**

| Element | Change |
|---------|--------|
| Constant | `MS_PROPOSAL_TTL_SECONDS: Int = 604800` (7 days). |
| `receive(ApprovePaymentProposal)` ([contract line 328](../../contracts/MultiSigCard.tact)) | Insert `require(now() - p.created_at <= MS_PROPOSAL_TTL_SECONDS, ...)` returning `ERROR_MS_PROPOSAL_EXPIRED = 12`. |
| `receive(RejectPaymentProposal)` ([contract line 417](../../contracts/MultiSigCard.tact)) | Same TTL check — a rejection after expiry is a no-op (the proposal is already terminal). |
| Status transition | New terminal status `PROPOSAL_EXPIRED = 5` set lazily on the first observation past the TTL window. |
| New message | `PokeProposal { nft_address; proposal_id; }` zero-state-change message that **only** triggers the TTL check + status flip. Anyone can call it. |
| Error code | `ERROR_MS_PROPOSAL_EXPIRED = 12`. |
| Events | `ProposalExpired { nft_address, proposal_id, created_at, expired_at }`. |

**Migration:** Existing testnet proposals get `PROPOSAL_EXPIRED`
status on the first `PokeProposal` after the upgrade, which the
deployment ceremony schedules via a batch worker.

**Tests required at landing:** time-travel test asserting approval
is rejected at `t = 604801` with `ERROR_MS_PROPOSAL_EXPIRED`;
`PokeProposal` flips status exactly once; subsequent pokes are
no-ops; an in-flight approval at `t = 604799` succeeds.

**Doc references that update:** [`SPECIFICATION.md`
§5.4 Approval window](./SPECIFICATION.md) flips from "off-chain"
to "on-chain"; [`MONITORING.md` §3.4 MS-M11](./MONITORING.md)
drops the off-chain "TTL-suspect" alert.

### MS-CH-6 — On-chain guardian recovery receivers

**Closes threat:** T-MSC-4 guardian recovery takeover, T-MSC-5
recovery cooldown bypass
([`SPECIFICATION.md` §8](./SPECIFICATION.md),
[`GUARDIAN_RECOVERY.md` §4](./GUARDIAN_RECOVERY.md)).

**Shape of change:**

| Element | Change |
|---------|--------|
| Storage | Add `guardians: map<Address, map<Int, Address>>` (per-NFT guardian set, 2-of-3 quorum on the recovery flow). |
| Storage | Add `recovery_proposals: map<Int, RecoveryProposal>` keyed by `recoveryKey(nft_address, recovery_id)`. |
| New struct | `RecoveryProposal { nft_address; new_owner; created_at; approvals_count; status; }`. |
| Constant | `MS_RECOVERY_COOLDOWN_SECONDS: Int = 259200` (72 h). |
| New message | `InitiateRecovery { nft_address: Address; new_owner: Address; recovery_id: Int as uint64; }` — gated by `sender() ∈ guardians[nft_address]`; creates `RecoveryProposal` with `status = RECOVERY_PENDING`. |
| New message | `ApproveRecovery { nft_address: Address; recovery_id: Int as uint64; }` — gated by `sender() ∈ guardians[nft_address]`; idempotent per-guardian. |
| New message | `ExecuteRecovery { nft_address: Address; recovery_id: Int as uint64; }` — requires (a) 2-of-3 guardian approvals, (b) `now() - created_at >= MS_RECOVERY_COOLDOWN_SECONDS`. Triggers ownership transfer via the Payment Hub. |
| New message | `CancelRecovery { nft_address: Address; recovery_id: Int as uint64; }` — gated by `sender() == current_owner`. Lets the legitimate owner abort a malicious recovery within the cooldown window. |
| Error codes | `ERROR_MS_NOT_GUARDIAN = 13`, `ERROR_MS_RECOVERY_COOLDOWN_ACTIVE = 14`, `ERROR_MS_RECOVERY_ALREADY_EXECUTED = 15`. |
| Events | `RecoveryInitiated { nft_address, recovery_id, new_owner, initiated_by, initiated_at }`, `RecoveryApproved { ... }`, `RecoveryExecuted { ... }`, `RecoveryCancelled { ... }`. |
| Getters | `getRecoveryProposal(nft_address, recovery_id)`, `getGuardians(nft_address)`. |

**Migration:** Existing testnet `MultiSigConfig` rows get an empty
`guardians` map by default; the wallet UI surfaces a one-time
"add guardians" prompt as part of the post-A2 migration ceremony.

**Tests required at landing:** happy path 2-of-3 recovery after
72 h; rejection before cooldown elapses
(`ERROR_MS_RECOVERY_COOLDOWN_ACTIVE`); rejection from non-guardian
(`ERROR_MS_NOT_GUARDIAN`); cancel by current owner aborts the
proposal; double-execute rejected
(`ERROR_MS_RECOVERY_ALREADY_EXECUTED`); ownership transfer happens
exactly once.

**Doc references that update:** [`GUARDIAN_RECOVERY.md` §4
Recovery flow](./GUARDIAN_RECOVERY.md) flips from off-chain (wallet
+ indexer) to on-chain; [`MONITORING.md` §3.3
MS-M14 cooldown-bypass alert](./MONITORING.md) flips from
"manual escalation" to "redundant — enforced on-chain".

---

## 4. Sign-off Gating

MS-CH-N items may only land in a follow-up PR after **all** of the
following conditions hold:

1. **A2 verdict.** A2 audit
   ([`ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md))
   returns verdict `READY` and the corresponding `STATUS.md` is
   updated.
2. **No critical/high outstanding.** A2 final report lists zero
   open critical or high findings against
   `contracts/MultiSigCard.tact`.
3. **Mainnet ceremony scheduled.**
   `docs/deployments/multisig-mainnet/multisig.multisig.json`
   exists with `threshold >= 2` and `eoa: false` for every signer.
4. **Multi-sig readiness validator green.**
   [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
   reports `OK` on the proposed PR's branch.
5. **PR scope.** The follow-up PR contains **only** the MS-CH-N
   changes listed in this document (no new features). Each MS-CH-N is
   a separate commit; the PR body references the MS-CH-N IDs in 1:1
   correspondence with commits.

A PR that touches `contracts/MultiSigCard.tact` without satisfying
all five conditions must be rejected by the CI guardrail in §5.

---

## 5. CI Guardrail

The CI check at
[`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts)
(planned — issue #140, this PR) implements the following rules:

| Rule | Applies to | Action on violation |
|------|-----------|---------------------|
| **R-MS-CH-1** | Any PR touching `contracts/MultiSigCard.tact` | Verify `docs/security/audits/A2-phase4-contracts/STATUS.md` shows `verdict: READY` and `branch: <PR-base-branch>`. Fail otherwise. |
| **R-MS-CH-2** | Any PR touching `docs/multisig/*.md` | Verify every `MS-CH-N` reference resolves to a §3 row here. Fail on dangling refs. |
| **R-MS-CH-3** | Any PR touching `contracts/MultiSigCard.tact` | Verify a corresponding `MS-CH-N` entry exists in §3 (no surprise contract changes). Fail otherwise. |
| **R-MS-CH-4** | Release-tag workflow | Verify `RegisterNFTOwnerMultiSig` is absent from the mainnet artefact (PP-40 / MS-CH-2 enforcement). |
| **R-MS-CH-5** | Any PR touching `docs/governance/PARAMETERS.md` `MS_*` rows | Verify the values match this document's §3 rows (threshold bounds, proposal TTL, recovery cooldown). |

The validator is the analogue of
[`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts)
(F4) and
[`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts)
(F3); it runs on every PR touching the multi-sig surface.

---

## 6. Cross-reference summary

| MS-CH-N | Closes | Where it is referenced |
|---------|--------|------------------------|
| **MS-CH-1** | T-MSC-1, T-MSC-6 / X-5 | [`SPECIFICATION.md` §3.3, §9](./SPECIFICATION.md), [`MONITORING.md` §3.2](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **MS-CH-2** | T-MSC-2, T-MSC-7 / X-1 | [`SPECIFICATION.md` §6.1, §7.1, §9](./SPECIFICATION.md), [`docs/governance/PARAMETERS.md` PP-40](../governance/PARAMETERS.md) |
| **MS-CH-3** | T-MSC-3 / C-MSC-H1 | [`SPECIFICATION.md` §3.4](./SPECIFICATION.md), [`MONITORING.md` §3.3](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |
| **MS-CH-4** | Capacity (3 → 10 signers) | [`SPECIFICATION.md` §4.3](./SPECIFICATION.md), [`WALLET_UX.md` §3](./WALLET_UX.md), [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) |
| **MS-CH-5** | Proposal TTL enforcement | [`SPECIFICATION.md` §5.4](./SPECIFICATION.md), [`MONITORING.md` §3.4](./MONITORING.md), [`WALLET_UX.md` §4](./WALLET_UX.md) |
| **MS-CH-6** | T-MSC-4, T-MSC-5 | [`SPECIFICATION.md` §8](./SPECIFICATION.md), [`GUARDIAN_RECOVERY.md` §4](./GUARDIAN_RECOVERY.md), [`MONITORING.md` §3.3](./MONITORING.md), [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) |

---

## 7. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §2, §4 — gates every MS-CH-N on `verdict: READY`. |
| AC-2 | `SPECIFICATION.md` written | §3 MS-CH-N rows are the on-chain landing plan for the threats catalogued in [`SPECIFICATION.md` §9](./SPECIFICATION.md). |
| AC-4 | Multi-sig creation flow (wallet) | MS-CH-2 enables the on-chain `UpdateMultiSigConfig` that [`WALLET_UX.md` §6](./WALLET_UX.md) signer-management surface depends on. |
| AC-5 | Pending approvals screen | MS-CH-3 (settlement) and MS-CH-5 (TTL) make the on-chain status complete enough that the wallet pending list never desyncs from chain. |
| AC-6 | Guardian recovery flow | MS-CH-6 turns the off-chain recovery into on-chain receivers — closes the takeover threat T-MSC-4. |
| AC-7 | Testnet deployment | §4 condition (3) requires the mainnet manifest before MS-CH-N items land — the testnet ceremony in [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) precedes the audit. |
| AC-8 | 28-test wallet-ui bar | None — wallet-ui tests cover off-chain behaviour, which is invariant across MS-CH-N. |
| (cross) | PP-40 cleanup | MS-CH-2 removes test-only handlers per [`PARAMETERS.md` §8.6](../governance/PARAMETERS.md). |

---

## 8. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Parameter inventory    | [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) |
| Error code registry    | [`docs/error-codes.md`](../error-codes.md) |
| CI validator (planned) | [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts) |
| Pattern: F4 validator  | [`scripts/recurring-payments/check-recurring-payments-readiness.ts`](../../scripts/recurring-payments/check-recurring-payments-readiness.ts) |
| Pattern: F3 validator  | [`scripts/bridge/check-bridge-readiness.ts`](../../scripts/bridge/check-bridge-readiness.ts) |

---

## 9. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
