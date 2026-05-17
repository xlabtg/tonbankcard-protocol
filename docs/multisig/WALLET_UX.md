# Multi-Sig Card — Wallet-UI UX

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the user-facing wallet flows for creating a
multi-sig configuration, viewing pending approvals, signing or
rejecting a proposal, and managing the signer set on an NFT card.
It is the source of truth for Issue #140 acceptance criteria:

- **AC-4** _"Multi-sig approval flow UX in wallet: multi-sig
  creation flow, pending approvals screen, sign/reject UI, signer
  management"_.
- **AC-5** _"Pending approvals screen with one-tap sign/reject"_.

The UX preserves invariants **I1 (Non-Custodial)**, **I2 (NFT
Authority)**, **I3 (No Admin Control)**. The wallet **never**
auto-signs multi-sig messages; every state-changing action emits a
fresh TON Connect signature prompt.

---

## 2. Acceptance criteria this artifact satisfies

Issue #140 §8 — _"AC-4 Multi-sig approval flow UX"_ and
_"AC-5 Pending approvals screen"_.

Indirectly informs AC-2 (multi-sig creation is the on-chain entry
to the config format in [`SPECIFICATION.md` §3](./SPECIFICATION.md))
and AC-8 (wallet-ui test bar of **28 tests** asserted in
[`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md), backed by
[`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts)).

---

## 3. Create multi-sig flow (TON Connect)

### 3.1 Entry point

`Wallet → My cards → <NFT card> → Enable multi-sig` opens
`wallet-ui/MultiSigCreatePage`. The card must be owned by the
connected wallet; otherwise the action is greyed out.

### 3.2 Threshold wizard

The wizard surfaces three presets and one custom path. The presets
mirror [`SPECIFICATION.md` §4](./SPECIFICATION.md):

| Preset | Required signatures | Total signers | Audience | Spec ref |
|--------|---------------------|---------------|----------|----------|
| **Personal** | 2 | 3 | Default for individual users | [§4.1](./SPECIFICATION.md) |
| **Corporate** | 3 | 5 (target — capped at 3 until MS-CH-4) | Treasury teams | [§4.2](./SPECIFICATION.md) |
| **Custom** | 1..N | up to 10 (capped at 3 until MS-CH-4) | Power users | [§4.3](./SPECIFICATION.md) |

Until MS-CH-4 ([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md))
lands, the wizard caps the slider at **3** signers and shows an
inline note:

> "Up to 10 signers is coming with the next protocol update. The
> current contract limit is 3."

### 3.3 Signer entry

After choosing a threshold, the user enters signer addresses one by
one. Each entry is validated:

1. Must be a syntactically valid TON address.
2. Must not duplicate the NFT owner unless the user explicitly opts
   into "owner is also a signer".
3. Must not duplicate another signer in the same list (wallet-ui
   surfaces an inline error before submission).

When the slider is at 3, the user must provide 3 signer addresses;
the wizard refuses to advance otherwise.

### 3.4 Signature

The user taps **"Create multi-sig"**. TON Connect surfaces the
`ConfigureMultiSig` message with the threshold and signer list
mapped into the [`SPECIFICATION.md` §3.1
MultiSigConfig](./SPECIFICATION.md) struct. The user signs in
their wallet (Tonkeeper, MyTonWallet, etc.). The wallet-ui
**never** holds a session-scoped key — there is no "remember this
card" toggle on the creation surface.

### 3.5 Failure modes (post-signature)

| On-chain error code | Source line | UX reaction |
|---------------------|-------------|-------------|
| `ERROR_MS_NOT_OWNER = 1` | [contract line 126](../../contracts/MultiSigCard.tact) | "This wallet does not own the selected NFT card. Switch wallets and retry." |
| `ERROR_MS_INVALID_THRESHOLD = 3` | [contract line 128](../../contracts/MultiSigCard.tact) | "Threshold must be between 1 and 3. Adjust and retry." (Bound flips to 10 after MS-CH-4.) |
| `ERROR_MS_NFT_NOT_REGISTERED = 7` | [contract line 132](../../contracts/MultiSigCard.tact) | "Your NFT card is not yet registered with the multi-sig contract. Tap to register before enabling multi-sig." |

The numeric codes match `contracts/MultiSigCard.tact` lines 125–134
and the registry in [`docs/error-codes.md`](../error-codes.md)
section _`MultiSigCard.tact` — response error codes_.

---

## 4. Pending approvals screen

`Wallet → My cards → <NFT card> → Pending approvals` lists every
proposal whose `status == PROPOSAL_PENDING` and whose `created_at
+ MS_PROPOSAL_TTL_SECONDS > now()`. The wallet hides proposals
older than 7 days (off-chain TTL filter; the on-chain enforcement
is **MS-CH-5** in
[`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

### 4.1 List columns

| Column | Source | Sortable |
|--------|--------|----------|
| Recipient | `proposal.recipient` resolved via public profile (or short address) | by name |
| Amount | `proposal.amount` | by amount |
| Created | `proposal.created_at` formatted with `formatDate()` from `wallet-ui/utils` | by date |
| Approvals | `approvals_count / required_signatures` | by ratio |
| Status | `PENDING` / `APPROVED` / `REJECTED` / `EXECUTED` | by status |

Each row is tap-expandable to the detail sheet (§4.4).

### 4.2 One-tap sign

Sign is exposed as the **primary** action in the detail sheet.

1. User taps **"Sign proposal"**.
2. Wallet-ui shows a confirmation sheet with the verbatim payment
   summary: `Send {amount} TBC to {recipient}` plus the proposal's
   memo (if any).
3. On Confirm, wallet-ui constructs `ApprovePaymentProposal{
   nft_address, proposal_id }` and triggers TON Connect signature.
4. Once `PaymentProposalApproved` is observed by the indexer, the
   approval counter increments. If the new count `== required`, the
   status flips to `APPROVED` and the wallet surfaces a toast:
   "Quorum reached — payment is being settled."

The wallet **never** auto-signs; each approval requires a fresh
TON Connect signature.

### 4.3 One-tap reject

Reject sits next to **Sign** in the detail sheet:

1. User taps **"Reject proposal"**.
2. Wallet-ui shows a confirmation: "Reject this payment proposal?
   It can be re-submitted, but a fresh approval round will be
   needed."
3. On Confirm, wallet-ui constructs `RejectPaymentProposal{
   nft_address, proposal_id }` and triggers TON Connect signature.
4. Once `PaymentProposalRejected` is observed, the row transitions
   to `REJECTED` and is moved to the "History" tab.

### 4.4 Detail sheet

Tapping a row opens the detail sheet:

- Header: recipient short address + amount per
  [`shortAddress()` and `formatTBC()` utilities in
  `wallet-ui/utils`](../../wallet-ui/src/utils.ts).
- Status pill: PENDING / APPROVED / REJECTED / EXECUTED, coloured.
- Created at / TTL remaining.
- Approvals progress: e.g. **2 of 3 signers approved**, with each
  signer's address listed and a green tick where the approval has
  landed.
- Memo (if any).
- Footer:
  - if `PENDING` and current wallet is a signer **and** has not yet
    approved: **Sign** + **Reject** buttons.
  - if `PENDING` and current wallet has already approved: greyed-out
    **Already signed** badge.
  - if `APPROVED`: settlement link to the Payment Hub tx.
  - if `REJECTED` or `EXECUTED`: read-only history view.

### 4.5 Failure modes (post-signature)

| On-chain error code | Source line | UX reaction |
|---------------------|-------------|-------------|
| `ERROR_MS_NOT_SIGNER = 2` | [contract line 127](../../contracts/MultiSigCard.tact) | "This wallet is not in the signer set for this card. Sign-in with a different wallet." |
| `ERROR_MS_PROPOSAL_NOT_FOUND = 4` | [contract line 129](../../contracts/MultiSigCard.tact) | "Proposal not found — it may have been removed or expired. Refresh the list." |
| `ERROR_MS_ALREADY_APPROVED = 5` | [contract line 130](../../contracts/MultiSigCard.tact) | "You have already approved this proposal. No action needed." |
| `ERROR_MS_PROPOSAL_NOT_PENDING = 6` | [contract line 131](../../contracts/MultiSigCard.tact) | "This proposal is no longer pending. Refresh to see the latest status." |
| `ERROR_MS_NO_CONFIG = 8` | [contract line 133](../../contracts/MultiSigCard.tact) | "Multi-sig is not configured for this card. Enable multi-sig before signing." |

---

## 5. Submit-proposal flow (NFT owner)

The owner of the NFT card submits a payment proposal that the
signers then approve.

1. From the card detail page, the owner taps **"Propose payment"**.
2. Wallet-ui shows a form: recipient address, amount, optional memo.
3. The wallet-ui generates a `proposal_id` (64-bit nonce + Unix
   timestamp seconds, per [`SPECIFICATION.md` §3.3
   composite-key](./SPECIFICATION.md)) to avoid collisions.
4. On Confirm, wallet-ui constructs `SubmitPaymentProposal{
   nft_address, proposal_id, recipient, amount, memo }` and triggers
   TON Connect signature.
5. Once `PaymentProposalSubmitted` is observed, the proposal appears
   in the **Pending approvals** screen of every signer's wallet (via
   the notification path documented in [`NOTIFICATIONS.md`
   §4](./NOTIFICATIONS.md) and surfaced as **MS-N01** in
   [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md)).

Failure modes mirror §4.5; in addition `ERROR_MS_NOT_OWNER = 1` is
surfaced as "This wallet does not own the card; only the owner can
submit proposals." and `ERROR_MS_INVALID_AMOUNT = 9` as "Amount
must be greater than zero."

---

## 6. Signer management (post-MS-CH-2)

Issue #140 §3 names "signer addition / removal (quorum-required)" as
in-scope. The current contract has **no** on-chain receiver for
mutating the signer set after `ConfigureMultiSig`; the change is
**MS-CH-2** in
[`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md), gated on
A2 verdict `READY`.

Until MS-CH-2 lands, the wallet UI surfaces signer management as
**"Replace the multi-sig config"** with explicit copy:

> "Adding or removing signers is coming with the next protocol
> update. To change the signer set today, remove the multi-sig
> from this card and create a new one. All pending proposals will
> be discarded."

Post-MS-CH-2 the wallet-ui will surface a true **Add signer** /
**Remove signer** flow — each action requires `M` signatures from
the **current** signer set over the canonical change blob (see
[`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md)). The UX
wiring is specified here so the post-MS-CH-2 follow-up PR is just
an implementation diff against the **existing** documented surface:

| Action | Message constructed | Signature collection |
|--------|---------------------|----------------------|
| Add signer  | `UpdateMultiSigConfig { nft_address, new_signers, new_required, quorum_signatures }` | Wallet aggregates M signatures off-chain (one per current signer), packs them into the `quorum_signatures` cell, then submits as the M-th step |
| Remove signer | same message, with the target address dropped from `new_signers` | same flow |
| Rotate threshold | same message, with `new_required` updated | same flow |

The quorum-collection UI follows the same pending-approvals model
as §4: each current signer sees a **Sign signer-set change** card
that, on tap, surfaces TON Connect with the canonical blob; once `M`
signatures are collected the M-th signer submits the
`UpdateMultiSigConfig` transaction.

---

## 7. Guardian recovery hook

The wallet-ui exposes a **"Recover access"** entry on the card
detail page that opens the guardian recovery flow described in
[`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md). The action is
visible only when at least one guardian is configured (off-chain
metadata until **MS-CH-6**).

---

## 8. Notifications hook

The wallet-ui registers a notification token per
[`NOTIFICATIONS.md` §4](./NOTIFICATIONS.md). The token is
**opt-in**; the create-multi-sig flow surfaces an
enable-notifications prompt **once** after the first successful
`ConfigureMultiSig`. The prompt copy is:

> "Get a push when one of your cards needs a signature. We'll send
> one push per pending proposal. You can turn this off anytime in
> Settings."

The notification path is described in
[`NOTIFICATIONS.md` §§3–4](./NOTIFICATIONS.md). The wallet stores
the opt-in choice locally and pushes it to the notifications
backend via the existing user-preference endpoint.

---

## 9. Invariant preservation

| Invariant | Where the wallet UX could break it | Mitigation here |
|-----------|------------------------------------|------------------|
| **I1 Non-Custodial** | Auto-signed `ApprovePaymentProposal` on schedule or behind the user's back | The wallet **never** auto-signs anything — every approval is user-initiated and surfaced through a fresh TON Connect prompt (§4.2). |
| **I2 NFT Authority** | Approving without being in the signer set | `ApprovePaymentProposal` requires `sender() ∈ signers(nft_address)`; the wallet-ui filters the **Pending approvals** screen to proposals where the connected wallet is a signer. |
| **I3 No Admin Control** | "Approve-on-behalf" admin button or "force-cancel" admin | No such button exists; `ApprovePaymentProposal` is gated on the signer's signature (§4.2); the only path to mutate the signer set is the quorum-gated MS-CH-2 flow (§6). |

---

## 10. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-2 | `SPECIFICATION.md` written | §3.2 binds the on-chain config format display verbatim to [`SPECIFICATION.md` §3.1 / §4](./SPECIFICATION.md). |
| AC-4 | Multi-sig approval flow UX | This document (§§3, 4, 5, 6). |
| AC-5 | Pending approvals screen | §4 — list view, one-tap sign, one-tap reject, detail sheet. |
| AC-6 | Guardian recovery flow | §7 hooks the [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) UX entry. |
| AC-7 | Testnet deployment | §§3–5 form the happy path verified end-to-end in [`TESTNET_DEPLOYMENT.md` §5](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Wallet-ui tests (28) pass | §§3–7 form the surface the 28-test bar in [`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts) covers — see [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 11. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| Wallet UI source       | [`wallet-ui/`](../../wallet-ui/) |
| Wallet UI tests        | [`wallet-ui/tests/wallet-ui.spec.ts`](../../wallet-ui/tests/wallet-ui.spec.ts) |
| Error codes registry   | [`docs/error-codes.md`](../error-codes.md) |
| Wallet compatibility   | [`docs/wallet-compatibility.md`](../wallet-compatibility.md) |

---

## 12. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
