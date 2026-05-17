# Multi-Sig Card — Notification System

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Status:** Draft — frozen at engagement kickoff
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document specifies the multi-sig user notification system: the
**signer-approval-needed** pushes mandated by Issue #140 §3 _"pending
approvals screen"_ (the user must learn that a new proposal is
waiting), plus the post-quorum receipts, the rejection / expiration
acknowledgements, and the guardian-recovery alerts.

It is the source of truth for the multi-sig analogue of Issue #140
§3 _"signer approval flow"_ and AC-5 _"pending approvals screen"_,
and it feeds the wallet-ui push registration documented in
[`WALLET_UX.md` §8](./WALLET_UX.md).

---

## 2. Acceptance criterion this artifact satisfies

Issue #140 §8 — _"AC-5 Pending approvals screen with one-tap
sign/reject"_ depends on the user receiving a push the moment a new
proposal lands. AC-6 _"Guardian recovery flow"_ depends on the
owner being paged when a recovery is initiated by their guardians.

Indirectly informs AC-7 / AC-8 by providing the notification surface
the testnet rollout in [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md)
exercises end-to-end.

---

## 3. Notification catalogue

Each notification below has a unique ID (`MS-Nxx`), a trigger, the
delivery channels, and an opt-in/opt-out posture.

### 3.1 Signer-approval-needed notifications

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **MS-N01** | `PaymentProposalSubmitted` observed by indexer; recipient is each signer in `getMultiSigConfig(nft_address)` who has not yet approved | Push (wallet-ui) + email (if user provided) | Opt-in by default at first ConfigureMultiSig ([`WALLET_UX.md` §8](./WALLET_UX.md)) |
| **MS-N02** | Proposal still `PENDING` and `now() - created_at ∈ [86400, 90000)` (T-24h before the off-chain 7-day TTL window expires) | Push | Opt-out — surfaced only on the **first** MS-N01 alert with a "Also remind me 1 day before expiry" prompt |

The `86400 s` (24 h) reminder window is the granularity of the
notification cron — see §5. The 7-day TTL itself is documented in
[`SPECIFICATION.md` §5.4](./SPECIFICATION.md) and becomes on-chain
post-MS-CH-5 ([`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md)).

### 3.2 Post-quorum receipts

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **MS-N03** | `PaymentProposalApproved` event observed by indexer for one of the user's NFT cards (the user is the proposer / owner) | Push | Always-on |
| **MS-N04** | Same, but to every signer who participated (acknowledgement that the quorum closed) | Push | Opt-in by default |

### 3.3 Status-change notifications

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **MS-N05** | `PaymentProposalRejected` event observed by indexer for one of the user's proposals | Push | Always-on (rejection is consequential — proposer must know to re-submit) |
| **MS-N06** | `MultiSigRemoved` event for the user's NFT card | Push | Always-on |
| **MS-N07** | Proposal observed past TTL (off-chain L1 alert before MS-CH-5; on-chain `ProposalExpired` event after) | Push | Always-on |

### 3.4 Guardian recovery notifications

| ID    | Trigger | Channels | Opt-in default |
|-------|---------|----------|----------------|
| **MS-N08** | `RecoveryInitiated` observed (off-chain alert until MS-CH-6; on-chain event after) — addressed to the current NFT owner and **all** signers | Push + email | Always-on (mandatory pager — owner must be able to abort via [`GUARDIAN_RECOVERY.md` §6 CancelRecovery](./GUARDIAN_RECOVERY.md)) |

The eight IDs MS-N01..MS-N08 form the full multi-sig notification
catalogue. The schedule and idempotency rules are in §5.

---

## 4. Channels

### 4.1 Push notifications

The wallet-ui registers a push token at first ConfigureMultiSig
([`WALLET_UX.md` §8](./WALLET_UX.md)). The notification service
stores `(user_id, push_token, platform)` in the
`notifications.subscriptions` table.

Push payload (FCM / APNS, normalized):

```json
{
  "title": "Signature requested",
  "body": "{{owner_short_address}} requested a payment of {{amount}} TBC to {{recipient_short}}.",
  "data": {
    "type": "MS-N01",
    "nft_address": "EQ...",
    "proposal_id": "1747987200001",
    "approvals_count": 0,
    "required_signatures": 2,
    "expires_at_unix": 1748591999
  }
}
```

The payload contains **no PII**. The owner short-address comes from
the indexer; the amount and recipient short-address come from the
on-chain `PaymentProposal` struct.

### 4.2 Email

For users who supply an email address (optional, captured at first
ConfigureMultiSig via a checkbox), the notification service
dispatches templated email via Postmark (existing transactional-email
infrastructure).

Email is **disabled by default** for MS-N01..MS-N06. Email is
**enabled by default** for MS-N08 (guardian recovery) because the
user has typically already missed the push by then and the action is
high-impact (transfers ownership of the card).

### 4.3 Webhook (signer integrations)

Corporate signers (e.g. a treasury team using a custom approval
workflow) configure a webhook URL in their wallet settings. The
notification service POSTs the following events:

- `multisig.proposal.submitted` — on `PaymentProposalSubmitted`.
- `multisig.proposal.approved` — on `PaymentProposalApproved`.
- `multisig.proposal.rejected` — on `PaymentProposalRejected`.
- `multisig.proposal.executed` — on `PaymentProposalExecuted`.
- `multisig.recovery.initiated` — on `RecoveryInitiated` (post-MS-CH-6).

Webhook auth uses the existing HMAC-SHA256 scheme from the merchant
API. Replay protection: payload includes `event_id` (UUID v4) and
`timestamp`; integrators reject duplicates by `event_id`.

---

## 5. Scheduling

The notification scheduler is a cron worker
(`backend/services/multisig-notification-scheduler.ts`, planned)
that runs every 5 minutes (signer-approval pushes need lower latency
than F4's 30-min cadence — a proposal can be approved in minutes)
and:

1. Scans `PaymentProposal` snapshots for proposals with
   `status == PROPOSAL_PENDING`.
2. For each, identifies signers not yet in the approvals map and
   dispatches MS-N01 to each (deduplicated per
   `(user_id, nft_address, proposal_id, MS-N01)`).
3. For each `(nft_address, proposal_id)` it has not yet sent MS-N02
   for, if `now() - p.created_at ∈ [86400, 90000)`, dispatch MS-N02.
4. For status transitions observed in DS-1 (`PaymentProposalApproved`,
   `PaymentProposalRejected`, `PaymentProposalExecuted`,
   `MultiSigRemoved`), dispatch the corresponding receipt
   (MS-N03..MS-N07).
5. Dedup via `notifications.delivery_log` keyed by
   `(user_id, nft_address, proposal_id, notification_id)`.

### 5.1 Idempotency

Each notification is identified by
`(user_id, nft_address, proposal_id, MS-Nxx)`. Re-running the
scheduler (crash recovery, manual replay) does **not** double-send
because the dedup key incorporates the specific proposal ID.

### 5.2 Failure modes

| Failure | Recovery |
|---------|----------|
| Push token expired (FCM 410, APNS 410) | Remove token from `notifications.subscriptions`; do not retry. Email fallback only if MS-Nxx has email enabled. |
| FCM 5xx / APNS 5xx | Retry with exponential backoff (1 m, 5 m, 15 m). After 3 failures, mark `(proposal_id, MS-Nxx)` row failed but proceed to other proposals still. |
| Email 5xx | Same retry policy via Postmark's existing scheduler. |
| Webhook 5xx | Existing merchant-webhook retry policy applies. |

---

## 6. Opt-in / opt-out controls

The wallet-ui exposes them in `Settings → Notifications → Multi-Sig`
to honour privacy norms:

| Toggle | Default | Persists |
|--------|---------|----------|
| Push (MS-N01) signer-approval-needed | ON | user-preference DB |
| Push (MS-N02) T-24h expiry reminder | OFF | user-preference DB |
| Push (MS-N03) quorum-reached receipt | ON (immutable) | n/a |
| Push (MS-N04) signer-acknowledgement | ON | user-preference DB |
| Push (MS-N05) proposal rejected | ON (immutable) | n/a |
| Push (MS-N06) multi-sig removed | ON (immutable) | n/a |
| Push (MS-N07) proposal expired | ON (immutable) | n/a |
| Push (MS-N08) recovery initiated | ON (immutable) | n/a |
| Email (all) | OFF (until address verified) | user-preference DB |

MS-N03, MS-N05, MS-N06, MS-N07, MS-N08 are **non-disable-able** for
the same reason F4 makes RP-N06/RP-N08 immutable: they are user-safety
acknowledgements and recovery-attempt alerts.

The wallet-ui synchronises the preference flags to the notification
service via the existing user-preference endpoint.

---

## 7. Privacy posture

The notification service stores:

- `(user_id, push_token, platform, opt_in_flags)` — required for
  delivery.
- `(user_id, nft_address, proposal_id, MS-Nxx, status)` — delivery
  log for idempotency and replay.

It does **not** store:

- The user's NFT private key (the protocol never sees it).
- Any signer's signing key (each signer's wallet holds it locally).
- TBC amounts beyond what the user sees on-screen in the proposal
  (the amount is **not** encrypted — it is part of the on-chain
  `PaymentProposal` by design; the notification payload contains the
  same on-chain-public value).

Delivery logs are retained 90 days for idempotency / debugging, then
purged. The retention is configurable per the existing
`docs/governance/TRANSPARENCY_REPORTING.md` retention policy.

---

## 8. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-2 | `SPECIFICATION.md` written | §3 MS-N07 ties proposal expiration to [`SPECIFICATION.md` §5.4](./SPECIFICATION.md). |
| AC-4 | Multi-sig approval flow UX | §3.1 MS-N01 surfaces every new proposal in the wallet-ui pending approvals screen ([`WALLET_UX.md` §4](./WALLET_UX.md)). |
| AC-5 | Pending approvals screen | MS-N01 drives the wallet-ui badge / push surface; MS-N03..MS-N07 keep the screen in sync with on-chain status. |
| AC-6 | Guardian recovery flow | §3.4 MS-N08 pages the owner and signers on `RecoveryInitiated`. |
| AC-7 | Testnet deployment | §5 scheduler exercised end-to-end in [`TESTNET_DEPLOYMENT.md` §5](./TESTNET_DEPLOYMENT.md). |
| AC-8 | Tests pass | The notification scheduler unit tests sit inside the wallet-ui test bar of 28 in [`TESTNET_DEPLOYMENT.md` §6](./TESTNET_DEPLOYMENT.md). |

---

## 9. Reference Mapping

| Reference | Path |
|-----------|------|
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| Bug bounty             | [`BUG_BOUNTY.md`](./BUG_BOUNTY.md) |
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| F4 notification pattern | [`docs/recurring-payments/NOTIFICATIONS.md`](../recurring-payments/NOTIFICATIONS.md) |
| Production monitoring  | [`docs/production/MONITORING.md`](../production/MONITORING.md) |

---

## 10. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
