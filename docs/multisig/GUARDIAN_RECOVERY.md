# Multi-Sig Card — Guardian Recovery

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the guardian recovery flow mandated by
Issue #140 §3 _"guardian recovery flow"_:

- The current NFT owner nominates **3 guardian addresses**.
- Recovery is initiated by any guardian.
- Recovery executes only when **2 of 3** guardians approve.
- Recovery has a **72 h cooldown** between initiation and execution.
- The current owner can cancel the recovery at any time during the
  cooldown.

The flow is intentionally **off-chain until MS-CH-6**
([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)). The wallet
UI, the indexer, and the notification scheduler together enforce
the cooldown and quorum off-chain; the legitimate owner is paged
via MS-N08 ([`NOTIFICATIONS.md` §3.4](./NOTIFICATIONS.md)) and
MS-M12/M14 ([`MONITORING.md` §3.3](./MONITORING.md)). MS-CH-6 turns
those off-chain rules into on-chain receivers without changing the
external semantics.

---

## 2. Acceptance criterion this artifact satisfies

Issue #140 §8 — _"AC-6 Guardian recovery flow: lost-key recovery via
guardian quorum, configurable guardian set, recovery cooldown
period"_.

Indirectly informs AC-2 (the recovery struct is defined here, the
contract-side shape is in [`CONTRACT_HARDENING.md`
MS-CH-6](./CONTRACT_HARDENING.md)), AC-4 (the wallet surface is in
[`WALLET_UX.md` §7](./WALLET_UX.md)), and AC-7 / AC-8 (the testnet
recovery drill is in [`TESTNET_DEPLOYMENT.md`
§5.3](./TESTNET_DEPLOYMENT.md) and exercises the
`MS_RECOVERY_COOLDOWN_SECONDS` constant).

---

## 3. Guardian set

### 3.1 Composition

The guardian set is **per NFT card** and contains exactly **3
guardian addresses**:

| Field | Type | Notes |
|-------|------|-------|
| `nft_address` | `Address` | The card being protected (same key as `MultiSigConfig`). |
| `guardian_1` | `Address` | First guardian. |
| `guardian_2` | `Address` | Second guardian. |
| `guardian_3` | `Address` | Third guardian. |
| `created_at` | `uint32` | Unix-seconds. |

The quorum is hard-coded at **2 of 3**; configurable threshold
support is **not** in scope under Issue #140 (it stays a
documentation-level note for the post-A2 follow-up).

### 3.2 Constraints

1. No guardian may coincide with the current NFT owner (otherwise
   the owner could initiate recovery against themselves, defeating
   the 72 h cooldown's purpose).
2. No guardian may coincide with another guardian in the same set.
3. No guardian may coincide with any signer in the
   [`MultiSigConfig`](./SPECIFICATION.md) signer set (otherwise a
   2-of-3 multi-sig collusion plus a single guardian = a 1-of-1
   recovery hijack — see threat **T-MSC-4** in [`SPECIFICATION.md`
   §9](./SPECIFICATION.md)).
4. Guardians may be EOAs **or** multi-sig wallets themselves — the
   protocol does not introspect their internal authorisation logic.

The wallet UI enforces (1), (2), (3) at submission time; the on-chain
receiver (post-MS-CH-6) re-enforces them.

### 3.3 Off-chain storage (pre-MS-CH-6)

Until MS-CH-6 lands, the guardian set lives in the wallet-ui's
indexed-DB record keyed by `nft_address`. The wallet-ui exports the
set as a portable JSON blob:

```json
{
  "version": 1,
  "nft_address": "EQ...",
  "guardians": ["EQ...", "EQ...", "EQ..."],
  "created_at": 1747987200,
  "signature": "ed25519(nft_owner_signs(canonical_blob))"
}
```

The `signature` is the NFT owner's signature over the canonical
blob; it lets the wallet-ui detect tampering even if an attacker
swaps the indexed-DB entry on the user's device. On-chain
attestation arrives with MS-CH-6.

---

## 4. Recovery flow

### 4.1 State machine

```
        ┌──────────────────┐
        │   RECOVERY_NONE  │
        └────────┬─────────┘
                 │  InitiateRecovery (any guardian, signs)
                 ▼
        ┌──────────────────┐
        │ RECOVERY_PENDING │  ← cooldown clock starts: created_at
        └────────┬─────────┘
                 │
       ┌─────────┴──────────┬────────────────────┐
       │                    │                    │
ApproveRecovery       CancelRecovery       (no action)
 (other guardian)      (current owner)
       │                    │                    │
       ▼                    ▼                    ▼
RECOVERY_APPROVED   RECOVERY_CANCELLED    waits until TTL = 30 d
       │                    │                    │
       │                    │                    └──→ auto-expires
       │                                            (off-chain, MS-N07-style)
       │
       │  ExecuteRecovery (any guardian, after cooldown)
       │  requires: approvals >= 2, now() - created_at >= 259200
       ▼
RECOVERY_EXECUTED
```

`MS_RECOVERY_COOLDOWN_SECONDS = 259200 s` (72 h) — the time between
`InitiateRecovery` and the earliest `ExecuteRecovery`.

### 4.2 Off-chain enforcement (pre-MS-CH-6)

Until MS-CH-6 lands, the cooldown and quorum are enforced by the
indexer + wallet-ui + notification scheduler:

1. **Initiation.** A guardian builds an `InitiateRecovery` blob in
   the wallet-ui (signs `(nft_address, new_owner, recovery_id,
   created_at)`), publishes it to a public broadcast channel (a
   storefront contract on the Payment Hub side, or an indexer-watched
   off-chain message queue). The indexer creates a `RecoveryProposal`
   record with `status = RECOVERY_PENDING`.
2. **Owner paged.** Notification scheduler dispatches MS-N08
   ([`NOTIFICATIONS.md` §3.4](./NOTIFICATIONS.md)) to the current
   owner and all signers. Monitoring fires MS-M12 ([`MONITORING.md`
   §3.3](./MONITORING.md)).
3. **Approval.** A second guardian signs an `ApproveRecovery` blob.
   The indexer increments `approvals_count`. The off-chain
   `quorum_reached` flag flips to `true` when `approvals_count >= 2`.
4. **Cooldown.** The wallet-ui shows a countdown of `72 h - (now() -
   created_at)`. The wallet-ui refuses to surface the **Execute**
   button until the countdown reaches zero.
5. **Cancellation.** The current owner signs a `CancelRecovery` blob
   at any time during the cooldown. The indexer flips `status` to
   `RECOVERY_CANCELLED`.
6. **Execution.** Once cooldown elapsed **and** quorum reached, any
   guardian signs an `ExecuteRecovery` blob. The wallet-ui surfaces
   the new-owner ownership transfer on the Payment Hub side
   (existing NFT-card ownership-transfer flow).

The off-chain enforcement is **soft**: a sufficiently determined
attacker who controls 2 guardian wallets could publish an
`ExecuteRecovery` blob before the cooldown elapses. The indexer
will surface it (and MS-M14 ([`MONITORING.md`
§3.3](./MONITORING.md)) pages P0); the wallet-ui will refuse to
render the transfer; but the Payment Hub will not on its own enforce
the cooldown. **MS-CH-6 is the on-chain remediation.**

### 4.3 On-chain enforcement (post-MS-CH-6)

MS-CH-6 in [`CONTRACT_HARDENING.md`
§3](./CONTRACT_HARDENING.md) lands the receivers `InitiateRecovery`,
`ApproveRecovery`, `ExecuteRecovery`, `CancelRecovery` directly in
`MultiSigCard.tact`. The on-chain semantics are 1-to-1 with §4.1:

- `InitiateRecovery` requires `sender() ∈ guardians[nft_address]`.
- `ApproveRecovery` requires `sender() ∈ guardians[nft_address]` and
  is idempotent per guardian.
- `ExecuteRecovery` requires
  `approvals_count >= 2 && now() - created_at >= 259200`.
- `CancelRecovery` requires `sender() == current_owner`.

Error codes (per [`CONTRACT_HARDENING.md` MS-CH-6](./CONTRACT_HARDENING.md)):
- `ERROR_MS_NOT_GUARDIAN = 13`
- `ERROR_MS_RECOVERY_COOLDOWN_ACTIVE = 14`
- `ERROR_MS_RECOVERY_ALREADY_EXECUTED = 15`

After MS-CH-6 lands, the off-chain flow above becomes a UX shim:
the wallet-ui collects the same blobs and submits them as on-chain
transactions; the indexer reads them from chain instead of from the
off-chain queue.

---

## 5. UX surface (wallet-ui)

### 5.1 Add / replace guardians

`Wallet → My cards → <NFT card> → Guardians` shows the current
guardian set (or an empty state with a **"Add 3 guardians"**
call-to-action).

| Action | Inputs | Signature |
|--------|--------|-----------|
| Add guardian set | 3 addresses | NFT owner signs the canonical blob (§3.3) |
| Replace guardian set | 3 new addresses | NFT owner signs the canonical blob; old set is invalidated by version bump |
| Remove guardian set | (no inputs) | NFT owner signs a `remove` blob; guardians revert to empty (no recovery possible) |

Adding or replacing the set requires a single NFT-owner signature;
no multi-sig quorum is required for the guardian configuration
itself (the user is the sole authority on who can recover their own
card).

### 5.2 Initiate recovery (from a guardian wallet)

A guardian opens `Wallet → Help a friend recover → Enter card
address`. After entering the `nft_address`, the wallet surfaces:

> "You are about to start a recovery for **{nft_short_address}**.
> The current owner will be notified immediately. The new owner
> will only take effect after a **72 h cooldown** and a **second
> guardian approval**. The current owner can cancel at any time
> during the cooldown."

The guardian then enters the new owner address, signs, and submits.

### 5.3 Cancel recovery (from the owner wallet)

The owner is paged via MS-N08. The notification deep-links to
`Wallet → My cards → <NFT card> → Recovery in progress`, which shows:

- Initiator guardian (short address).
- New owner (short address).
- Approvals so far (1 of 2 or 2 of 2).
- Time remaining on the cooldown.
- **Cancel recovery** button (primary, red).

Tapping **Cancel recovery** surfaces a confirmation:

> "Cancel the recovery attempt? The guardians will need to start
> over if you change your mind."

On Confirm, the wallet-ui signs and submits the cancel blob.

### 5.4 Execute recovery (from a guardian wallet, after cooldown)

The guardian who initiates (or any guardian who has approved)
returns to `Wallet → Help a friend recover → Pending` after the
cooldown elapses. The wallet shows the **Execute** button only
when (a) quorum reached, (b) cooldown elapsed, (c) status still
`RECOVERY_PENDING`. Tapping it dispatches the ownership transfer on
the Payment Hub.

---

## 6. Audit-log emission

Every state transition emits a structured event consumed by the
indexer (DS-1 in [`MONITORING.md` §4](./MONITORING.md)). The
event names align 1-to-1 with the §4.1 transitions:

| State change | Event name (post-MS-CH-6) | Off-chain equivalent (pre-MS-CH-6) |
|---|---|---|
| `RECOVERY_NONE → RECOVERY_PENDING` | `RecoveryInitiated` | indexed off-chain blob with `event_type = "RecoveryInitiated"` |
| (approval increment) | `RecoveryApproved` | indexed off-chain blob with `event_type = "RecoveryApproved"` |
| `RECOVERY_PENDING → RECOVERY_CANCELLED` | `RecoveryCancelled` | indexed off-chain blob |
| `RECOVERY_PENDING → RECOVERY_EXECUTED` | `RecoveryExecuted` | indexed off-chain blob; Payment Hub ownership-transfer tx |

The audit log is referenced by:

- [`NOTIFICATIONS.md` §3.4 MS-N08](./NOTIFICATIONS.md) — pages
  owner + signers on `RecoveryInitiated`.
- [`MONITORING.md` §3.3 MS-M12, MS-M13, MS-M14](./MONITORING.md) —
  pages bridge on-call + security on-call.
- [`BUG_BOUNTY.md` §3](./BUG_BOUNTY.md) — recovery-takeover
  bounty band.

---

## 7. Threat treatment

| Threat | Where treated | Status |
|--------|---------------|--------|
| **T-MSC-4** Guardian recovery takeover (collusion of 2 guardians + cooldown bypass) | 72 h cooldown (§4.1) + owner-cancel (§5.3) + MS-N08 pager (§6) + MS-M14 P0 alert (§6) | Mitigated off-chain; closed on-chain at MS-CH-6 |
| **T-MSC-5** Recovery cooldown bypass (rushed social-engineering attack) | Owner cancels via the always-on MS-N08 push; MS-M14 P0 alert | Mitigated off-chain; closed on-chain at MS-CH-6 |
| Guardian impersonation (someone signs `InitiateRecovery` claiming to be a guardian but is not in the set) | Signature verified against the published guardian set; non-guardians cannot produce a valid blob | Already closed |
| Guardian-set tampering (attacker rewrites the indexed-DB guardian set) | Wallet-ui verifies the owner's signature on the canonical blob (§3.3) | Already closed |

---

## 8. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-2 | `SPECIFICATION.md` written | §3 binds the guardian-set shape to the on-chain shape in [`CONTRACT_HARDENING.md` MS-CH-6](./CONTRACT_HARDENING.md). |
| AC-4 | Multi-sig approval flow UX | §5 specifies the guardian wallet-ui surfaces. |
| AC-6 | Guardian recovery flow | This document (§§3, 4, 5, 6, 7). |
| AC-7 | Testnet deployment | §4.2 + §5 form the off-chain recovery drill in [`TESTNET_DEPLOYMENT.md` §5.3](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Wallet-ui tests (28) pass | §§5 form the guardian-ui surface inside the wallet-ui 28-test bar in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| Issue #140             | [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
