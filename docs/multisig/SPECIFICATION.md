# Multi-Sig Card — Production Specification

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff; **deployment gated on A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the single source of truth for the production
behaviour of `contracts/MultiSigCard.tact` (Phase 4 implementation
code) and the surrounding off-chain coordination plane:

- the **on-chain configuration and proposal format** auditors must reason about,
- the **M-of-N threshold models** the wallet exposes to personal and corporate
  account holders,
- the **signing ceremony** that drives a proposal from `PENDING` to executed,
- the **signer addition / removal** flow (always quorum-gated),
- the **guardian recovery** mechanism (independent of the signer set),
- the **security model** that every signer signs onto when joining a card.

The contract itself is **not modified** by Issue #140 — the only
admissible mutation is the documented test-only handler removal
(`RegisterNFTOwnerMultiSig`, see §10) which is gated on A2 verdict
`READY` per Issue #140 §7.

> **Why a specification first.** Issue #140 §8 acceptance criterion
> **AC-1** marks A2 as a **strict prerequisite**: until A2 returns
> `READY`, no deployment of `MultiSigCard.tact` to mainnet may
> occur, and no contract-side fix may land. The specification therefore
> documents the **frozen** state at engagement kickoff so that auditors
> have an unambiguous oracle for "what should this do" while the
> contract is reviewed.

The internal pre-audit
([`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md))
already raised the following findings against `MultiSigCard.tact`:

- **C-MSC-C1 / X-1** — test-only `RegisterNFTOwnerMultiSig` handler (mitigated by deployer gate)
- **C-MSC-H1** — proposals do not settle on-chain (informational; design freeze, see §3.4)
- **C-MSC-H2 / X-5** — `proposalKey` / `approvalKey` collision posture
- **C-MSC-M1** — zero-address signer slot abuse
- **C-MSC-M2** — orphaned pending proposals after `RemoveMultiSig`

This document mirrors these findings into the **T-MSC-N** threat
catalogue (§9) and the **MS-CH-N** hardening backlog (§10), where
they remain operationally mitigated until the A2 verdict permits a
contract diff.

---

## 2. Acceptance criterion this artifact satisfies

Issue #140 §8 — _"`docs/multisig/SPECIFICATION.md` written"_ (**AC-2**).

The specification additionally provides the contract-side anchor that
the wallet-ui creation flow (AC-4), pending-approvals screen (AC-5),
guardian recovery flow (AC-6), end-to-end testnet flow (AC-7), and
wallet-ui test suite (AC-8) refer to. Drift between this document and
the contract source `contracts/MultiSigCard.tact` is itself a
CI-blocking defect — `scripts/multisig/check-multisig-readiness.ts`
asserts the binding.

---

## 3. On-chain configuration and proposal format

The contract storage is organised around four maps (see
[`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact)
lines 187–196):

| Map | Key | Value | Purpose |
|-----|-----|-------|---------|
| `multisig_configs` | `Address` (NFT) | `MultiSigConfig` | One config per card |
| `proposals` | `Int` (composite) | `PaymentProposal` | Pending / decided proposals |
| `approvals` | `Int` (composite) | `Bool` | Per-signer approval bit per proposal |
| `nft_owners` | `Address` (NFT) | `Address` (owner) | Ownership mirror (test-seeded, see §7.1) |

### 3.1 `MultiSigConfig` struct (canonical)

Source: `contracts/MultiSigCard.tact` lines 142–149, defaulted by
`defaultMultiSigConfig()` lines 159–168.

| Field | Type | Stored value | Set by | Mutability |
|-------|------|--------------|--------|-----------:|
| `is_active` | `Bool` | `true` while card is multi-sig-protected; `false` after `RemoveMultiSig` | `receive(ConfigureMultiSig)` → `true`; `receive(RemoveMultiSig)` → `false` | Status-only; toggled in place |
| `required_signatures` | `uint8` | `1 … MAX_SIGNERS` (current `MAX_SIGNERS = 3`) | `receive(ConfigureMultiSig)` | Immutable while `is_active` |
| `signer_1` | `Address` | First co-signer | `receive(ConfigureMultiSig)` | Immutable while `is_active` |
| `signer_2` | `Address` | Second co-signer (`newAddress(0,0)` if unused) | `receive(ConfigureMultiSig)` | Immutable while `is_active` |
| `signer_3` | `Address` | Third co-signer (`newAddress(0,0)` if unused) | `receive(ConfigureMultiSig)` | Immutable while `is_active` |
| `created_at` | `uint32` | `now()` at activation | `receive(ConfigureMultiSig)` | Immutable while `is_active` |

**Invariant (MS-1, owner authority):** the NFT owner is the **primary
authority**; the signer set adds approvers but never removes the
owner's veto. The contract enforces this by:

1. Only the owner may call `ConfigureMultiSig` (lines 214–222, via
   `validateOwnership`).
2. Only the owner may call `SubmitPaymentProposal` (lines 258–266).
3. The owner is always implicitly accepted as a rejecter
   (`RejectPaymentProposal`, lines 403–413).

**Invariant (MS-2, threshold range):** `required_signatures ∈ [1, MAX_SIGNERS]`.
Source: `contracts/MultiSigCard.tact` lines 225–228 (`ERROR_MS_INVALID_THRESHOLD`
on out-of-range).

### 3.2 `PaymentProposal` struct (canonical)

Source: `contracts/MultiSigCard.tact` lines 151–157, defaulted by
`defaultPaymentProposal()` lines 170–178.

| Field | Type | Stored value | Set by | Mutability |
|-------|------|--------------|--------|-----------:|
| `status` | `uint8` | `0=PENDING`, `1=APPROVED`, `2=REJECTED`, `3=EXECUTED` | `SubmitPaymentProposal` → `PENDING`; `ApprovePaymentProposal` → `APPROVED` (when quorum reached); `RejectPaymentProposal` → `REJECTED`; off-chain settlement → `EXECUTED` (see §3.4) | Status-only; transitions are one-way |
| `recipient` | `Address` | Payment recipient | `SubmitPaymentProposal` | Immutable |
| `amount` | `coins` | TBC amount | `SubmitPaymentProposal` | Immutable |
| `approval_count` | `uint8` | Number of distinct signer approvals collected | `ApprovePaymentProposal` `+= 1` | Monotonic up to `required_signatures` |
| `created_at` | `uint32` | `now()` at submission | `SubmitPaymentProposal` | Immutable |

**Invariant (MS-3, transition monotonicity):** once `status` leaves
`PENDING`, it cannot re-enter `PENDING`. The contract enforces this
by guarding every state-changing receive with
`require(p.status == PROPOSAL_PENDING, ERROR_MS_PROPOSAL_NOT_PENDING)`
(lines 336, 425).

### 3.3 Composite-key collision posture

**MS-CH-1 has landed** (§10). The `proposalKey` and `approvalKey`
combinators now derive each storage key from the representation hash
of a single cell that packs every component field, instead of the old
integer-addition of separate `sha256` digests:

```tact
fun proposalKey(nft_address: Address, proposal_id: Int): Int {
    return beginCell()
        .storeAddress(nft_address)
        .storeUint(proposal_id, 64)
        .endCell()
        .hash();
}

fun approvalKey(nft_address: Address, proposal_id: Int, signer: Address): Int {
    return beginCell()
        .storeAddress(nft_address)
        .storeUint(proposal_id, 64)
        .storeAddress(signer)
        .endCell()
        .hash();
}
```

This closes the same composite-key collision posture that the bridge
contract's `intentKey` and the recurring-payments contract's
`mandateKey` received as the `X-5` finding in the internal pre-audit.
Packing the fields into one cell and taking `Cell.hash()` binds all
components into a single 256-bit key, so distinct
`(nft_address, proposal_id)` (and, for approvals, `signer`) tuples can
no longer share a storage slot through an additive hash collision.

The previous combinator was, additionally, **non-functional on-chain**
and had to be replaced for the multi-sig flow to work at all:

1. `sha256(nft_address.asSlice())` hashes a 267-bit `Address` slice.
   `sha256` over a slice requires byte-aligned (multiple-of-8-bit)
   input, so the call reverted with a cell-underflow (exit 9) — every
   proposal handler (`submit`, `approve`, `execute`) and the
   `getProposalStatus` getter failed before this fix.
2. Summing two 256-bit `sha256` digests in `approvalKey` overflowed
   the TVM 257-bit signed integer range (exit 4).

`Cell.hash()` avoids both: it always returns a 256-bit value that fits
the integer range and is computed over a well-formed cell regardless of
bit alignment. The off-chain wallet still generates `proposal_id` as
`Date.now()` × 1000 + 16 random bits as defence in depth, and the
`RegisterNFTOwnerMultiSig` test-only handler (§7.1) still refuses to
overwrite an already-registered owner
(`require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered")`).

### 3.4 Settlement boundary (C-MSC-H1)

`PaymentProposalExecuted` is **emitted** but the contract does **not**
move funds — settlement is performed off-chain after the wallet
indexer observes the event and the owner triggers a TBC transfer via
the Payment Hub. This is an intentional design choice: the contract
is a permission layer, not a custody layer (CONTRIBUTING §3, §4).
The C-MSC-H1 finding is mirrored in §9 as **T-MSC-3** (partial
execution) with an operational mitigation pending the **MS-CH-3**
on-chain settlement work (§10).

---

## 4. M-of-N threshold models

The wallet (`wallet-ui/`) exposes three named threshold presets plus a
"custom" path. All three presets fit within `MAX_SIGNERS = 3` (the
current contract limit, see `contracts/MultiSigCard.tact` line 136);
larger presets are **MS-CH-4** in §10 below.

### 4.1 Personal — 2-of-3 with guardian recovery

| Field | Value |
|-------|-------|
| `required_signatures` | `2` |
| Total signers (M-of-N denominator) | `3` (owner + 2 co-signers) |
| Recovery mechanism | Guardian quorum 2-of-3 (separate from signer set, see [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md)) |
| Default approval window | 7 days (Issue #140 §6) |
| Default recovery cooldown | 72 h (Issue #140 §6) |

The 2-of-3 preset is the default user-facing flow in `wallet-ui/`
(`WALLET_UX.md` §3). It targets the "single user who wants stronger
account security than a hot wallet" persona.

### 4.2 Corporate — 3-of-5 small team

| Field | Value |
|-------|-------|
| `required_signatures` | `3` |
| Total signers (M-of-N denominator) | `5` (target — see MS-CH-4) |
| Recovery mechanism | Guardian quorum (optional, owner discretion) |
| Default approval window | 7 days |

Because the live contract only supports `MAX_SIGNERS = 3`, the
**effective** signer slot count is 3 + the owner's implicit veto. The
wallet UI presents the "3-of-5" preset as **"3 approvals required,
including the owner's own send"** and surfaces a banner explaining
that the on-chain config currently caps explicit signers at 3
(MS-CH-4 in §10 expands this to 10).

### 4.3 Custom M-of-N (up to 10 signers, MS-CH-4)

User-selected `M ∈ [1, N]`, `N ∈ [1, 10]`. The wallet enforces the
upper bound `N ≤ MAX_SIGNERS` on the active contract version and
disables the slider above the current limit until MS-CH-4 ships.
Custom presets must be confirmed by a TON Connect signature that
embeds the threshold values in the wallet-rendered prompt so the user
sees them before signing (`WALLET_UX.md` §3.2).

---

## 5. Signing ceremony

The contract is a **stateful approval coordinator**: proposals are
submitted by the owner, individual approvals are recorded per signer,
and once `approval_count` reaches `required_signatures` the proposal
flips to `APPROVED` and emits `PaymentProposalApproved`. Settlement
itself is off-chain (§3.4).

### 5.1 Proposal submission

- **Allowed sender:** NFT owner only (`validateOwnership`, lines
  510–519).
- **Pre-conditions:** card has `is_active == true`, `amount > 0`.
- **Result:** new `PaymentProposal{status: PENDING, …}` stored under
  `proposalKey(nft_address, proposal_id)`; `PaymentProposalCreated`
  event emitted.

| Failure | Error code |
|---------|-----------:|
| Sender not the NFT owner | `ERROR_MS_NOT_OWNER` (1) |
| NFT not yet seeded | `ERROR_MS_NFT_NOT_REGISTERED` (7) |
| Card has no active multi-sig config | `ERROR_MS_NO_CONFIG` (8) |
| `amount <= 0` | `ERROR_MS_INVALID_AMOUNT` (9) |

### 5.2 Approval flow

- **Allowed sender:** any address listed in
  `config.signer_1 / signer_2 / signer_3` (i.e. `isSigner(sender, config)`,
  lines 529–534).
- **Pre-conditions:** proposal exists and is `PENDING`; sender has not
  already approved this proposal (`approvalKey`, lines 541–544).
- **Result:** `approvals.set(approvalKey, true)`; `approval_count`
  incremented; when `approval_count >= required_signatures`, status
  flips to `APPROVED` and `PaymentProposalApproved` is emitted with
  the final count.

| Failure | Error code |
|---------|-----------:|
| Card has no active multi-sig config | `ERROR_MS_NO_CONFIG` (8) |
| Sender not in signer set | `ERROR_MS_NOT_SIGNER` (2) |
| Proposal unknown | `ERROR_MS_PROPOSAL_NOT_FOUND` (4) |
| Proposal not `PENDING` | `ERROR_MS_PROPOSAL_NOT_PENDING` (6) |
| Sender already approved | `ERROR_MS_ALREADY_APPROVED` (5) |

**Idempotency.** The `approvals` map is keyed by signer; a duplicate
approval from the same signer returns `ERROR_MS_ALREADY_APPROVED` and
does **not** increment `approval_count` (lines 343–347). This closes
signature-replay threat **T-MSC-1** (§9).

### 5.3 Rejection flow

- **Allowed sender:** NFT owner **or** any registered signer
  (`is_owner || is_signer`, lines 407–413).
- **Pre-conditions:** proposal exists and is `PENDING`.
- **Result:** status flips to `REJECTED`; `PaymentProposalRejected`
  emitted; no further approvals are accepted (§5.2 fails with
  `ERROR_MS_PROPOSAL_NOT_PENDING`).

### 5.4 Approval window

Issue #140 §6 requires _"at least 7 days before expiry"_. The
contract does **not** time-bound proposals on-chain; expiry is
enforced off-chain by the wallet/indexer using `created_at`.
The 7-day default is encoded in
[`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) as
`MS_PROPOSAL_TTL_SECONDS = 604800` and is mirrored in
[`WALLET_UX.md`](./WALLET_UX.md) §4 and
[`MONITORING.md`](./MONITORING.md) §3.4 (`MS-M11`).

On-chain enforcement is **MS-CH-5** in §10.

---

## 6. Signer addition / removal

Issue #140 §3 and §5 require: _"signer addition/removal requires
existing quorum"_ and _"signer removal must require quorum (owner
cannot remove all signers to regain sole control)"_.

### 6.1 Quorum-gated changes (operational, pending MS-CH-2)

The current contract exposes `ConfigureMultiSig` which **only the
owner** may call (lines 214–222). The contract therefore does not
on-chain-enforce signer quorum for signer-set changes. The wallet
mitigates this operationally:

1. `wallet-ui/` refuses to surface a signer-set diff unless the same
   quorum that would approve a payment has signed off on the change
   (see [`WALLET_UX.md`](./WALLET_UX.md) §5).
2. The change is **published as a proposal** in the off-chain queue
   first; once quorum-approved, the owner submits
   `ConfigureMultiSig` carrying the agreed signer set.
3. The audit log (§7.3) records every quorum signature on the change
   so any later dispute can reconstruct who approved what.

This is the structural equivalent of the bridge contract's circuit
breakers: the contract surface is intentionally narrow, while the
off-chain coordinator enforces the policy invariants. The on-chain
quorum-gated `UpdateMultiSigConfig` receiver is **MS-CH-2** in §10
and lands only after A2 verdict `READY`.

### 6.2 `RemoveMultiSig` posture

`RemoveMultiSig` (lines 456–478) allows the owner to deactivate the
multi-sig config unilaterally. Per Issue #140 §5 this is **also
quorum-gated operationally** by the wallet UI: the change is queued
as a proposal first, and `RemoveMultiSig` is only submitted after
the quorum approves. The contract-side enforcement is folded into
MS-CH-2.

Orphaned pending proposals (the C-MSC-M2 finding) remain in the
`proposals` map after `RemoveMultiSig`. Until **MS-CH-2** ships, the
indexer / wallet treats every proposal under a card with
`is_active == false` as effectively `REJECTED` (`WALLET_UX.md` §4.3).

---

## 7. Security model

### 7.1 Test-only `RegisterNFTOwnerMultiSig` handler

`contracts/MultiSigCard.tact` lines 569–573 ships a test-only handler
to seed the `nft_owners` mirror in deterministic invariant tests. Per
mitigation X-1 (PR #109), the handler is **gated** behind two checks:

```tact
require(sender() == self.deployer, "Unauthorized: only deployer (test-only)");
require(self.nft_owners.get(msg.nft_address) == null, "NFT owner already registered");
```

- The first check confines invocation to the contract's deployer
  (the local test harness account; not exposed to mainnet users).
- The second check makes the seed **write-once**, so even a
  compromised deployer cannot retroactively reassign ownership.

The handler is **MS-CH-2** in §10 — it is removed in a follow-up PR
gated on A2 verdict `READY`.

### 7.2 Response envelope (`MultiSigResponse`)

Every state-changing receive answers with a structured
`MultiSigResponse` (lines 64–69) carrying `(success, error_code,
nft_address, proposal_id)`. This keeps the wallet's failure-mode
table (`WALLET_UX.md` §4.4) deterministic and avoids the
"abort-the-transaction" failure mode that would burn gas without
informing the user of the cause.

The full error registry is reproduced in
[`docs/error-codes.md`](../error-codes.md) §`MultiSigCard.tact` and
consumed by the wallet directly.

### 7.3 Audit log (off-chain)

Issue #140 §3 requires _"all signers and their approval times
recorded"_. The on-chain `PaymentProposalApproved` event already
emits `(nft_address, proposal_id, approver, approval_count,
timestamp)` (lines 89–95); the indexer materialises these into a
per-card audit log surfaced by the wallet (`WALLET_UX.md` §4.3) and
the dashboard. Retention is governed by
[`docs/governance/TRANSPARENCY_REPORTING.md`](../governance/TRANSPARENCY_REPORTING.md).

### 7.4 Replay protection (T-MSC-1)

Two-layer:

1. **On-chain idempotency.** `approvalKey(nft, id, signer)` is unique
   per `(card, proposal, signer)` tuple. A duplicate approval from
   the same signer is rejected with `ERROR_MS_ALREADY_APPROVED`
   without state mutation.
2. **Off-chain nonce.** The wallet attaches a 64-bit `proposal_id`
   that includes a high-resolution timestamp; see §3.3 for the
   collision-window analysis.

---

## 8. Guardian recovery

Full design lives in [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md).
The relevant **specification-level constraints** are:

| Constraint | Value | Source |
|------------|-------|--------|
| Guardian quorum | 2-of-3 (default, configurable per card) | Issue #140 §3 |
| Cooldown | ≥ 72 hours between recovery proposal and execution | Issue #140 §6 |
| Authority | Guardians can rotate the **owner address** only — never move funds and never alter the signer set without going through §6 | Invariants I1, I3 |
| On-chain entry point | Not yet — handled off-chain via Payment Hub NFT transfer until **MS-CH-6** ships | §10 below |
| Threat coverage | **T-MSC-4** (recovery takeover) and **T-MSC-5** (cooldown bypass) in §9 | This document |

The guardian set is **disjoint** from the signer set (the wallet
prevents address re-use) so that compromise of the signer co-set
does not immediately compromise the recovery set, and vice versa.

---

## 9. Threat catalogue

This is the F5-specific threat catalogue that the A2 audit
(`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md` §4.2) must
clear. Each entry maps to one or more MSC-N threats from the
engagement scope and one or more MS-CH-N hardening items from §10.

| ID | Threat | A2 mapping | Operational mitigation | Final closure |
|----|--------|------------|------------------------|---------------|
| **T-MSC-1** | Signature replay across proposals or signers | MSC-1 | `approvalKey` uniqueness (§7.4); per-signer idempotency (§5.2) | MS-CH-1 (composite-key hardening) |
| **T-MSC-2** | Quorum manipulation (owner unilaterally rewriting signer set) | MSC-2 | Wallet refuses to submit `ConfigureMultiSig` without quorum signatures (§6.1) | MS-CH-2 (on-chain `UpdateMultiSigConfig`) |
| **T-MSC-3** | Partial execution (approved proposal not settled, funds appear "locked") | MSC-3 / C-MSC-H1 | Off-chain settlement boundary documented (§3.4); indexer reports stuck proposals | MS-CH-3 (on-chain settlement integration) |
| **T-MSC-4** | Guardian recovery takeover (guardians collude to seize ownership) | (new) | 72 h cooldown + signer notification + audit-log emission (`GUARDIAN_RECOVERY.md` §4) | MS-CH-6 (on-chain `InitiateRecovery` / `ExecuteRecovery`) |
| **T-MSC-5** | Recovery cooldown bypass (rushed social-engineering attack) | (new) | Cooldown enforced off-chain by wallet + indexer; pager alert MS-M14 (`MONITORING.md` §3.3) | MS-CH-6 |
| **T-MSC-6** | Composite-key collision (`proposalKey` / `approvalKey`) | MSC-6 / X-5 | Off-chain `proposal_id` generator uses 64-bit nonce + timestamp (§3.3) | MS-CH-1 |
| **T-MSC-7** | Test-only backdoor (`RegisterNFTOwnerMultiSig`) | MSC-7 / X-1 | Deployer gate + write-once (§7.1) | MS-CH-2 (handler removal) |

The cross-cutting `X-1`/`X-5` threats are tracked by the same items
above: **MS-CH-2** removes the test-only handler entirely, and
**MS-CH-1** replaces the addition combinator with cell concatenation.

---

## 10. Hardening backlog

Each item below is **designed but not landed** under Issue #140 —
landing requires A2 verdict `READY` and a follow-up PR (per
[`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) §4). The IDs are
the single source of truth referenced by every other multi-sig
document.

| ID | Title | Closes threat | Shape of change |
|----|-------|---------------|-----------------|
| **MS-CH-1** | Composite-key hardening (`proposalKey` / `approvalKey`) | T-MSC-1, T-MSC-6 | Replace integer addition with cell concatenation; keys become collision-resistant under cryptographic assumptions |
| **MS-CH-2** | Remove test-only `RegisterNFTOwnerMultiSig` handler; add quorum-gated `UpdateMultiSigConfig` | T-MSC-2, T-MSC-7 | Delete the handler; add a new receiver that consumes a multi-signature blob before mutating the signer set |
| **MS-CH-3** | On-chain settlement integration with Payment Hub | T-MSC-3 | Emit a `PaymentExecuted` message to the Payment Hub when `status` flips to `APPROVED`, removing the off-chain settlement gap |
| **MS-CH-4** | Expand `MAX_SIGNERS` from 3 to 10 | (capacity) | Replace fixed `signer_1/2/3` fields with a map-of-signers (10 entries) |
| **MS-CH-5** | On-chain proposal TTL enforcement | (UX) | Reject `ApprovePaymentProposal` when `now() - p.created_at > MS_PROPOSAL_TTL_SECONDS` |
| **MS-CH-6** | On-chain guardian recovery receivers (`InitiateRecovery`, `ExecuteRecovery`) | T-MSC-4, T-MSC-5 | Add receivers with cooldown timer enforced on-chain via `created_at + RECOVERY_COOLDOWN_SECONDS` |

Each item maps to a CI guardrail (`R-MS-CH-1 … R-MS-CH-5`) defined
in [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) §5.

---

## 11. References

- [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact)
- [`docs/multisig/CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md)
- [`docs/multisig/WALLET_UX.md`](./WALLET_UX.md)
- [`docs/multisig/GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md)
- [`docs/multisig/NOTIFICATIONS.md`](./NOTIFICATIONS.md)
- [`docs/multisig/MONITORING.md`](./MONITORING.md)
- [`docs/multisig/TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md)
- [`docs/multisig/BUG_BOUNTY.md`](./BUG_BOUNTY.md)
- [`docs/error-codes.md`](../error-codes.md) §`MultiSigCard.tact`
- [`docs/governance/PARAMETERS.md`](../governance/PARAMETERS.md) (`MS_*`)
- [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) §4.2
- [Issue #140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
