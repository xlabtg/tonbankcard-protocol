# Multi-Sig Card — Bug-Bounty Category

**Document Type:** Multi-Sig Card Production Readiness Artifact
**Issue Reference:** [#140 — F5 Multi-Sig Card Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/140)
**Engagement Prerequisite:** [A2 Phase 4 Audit](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) — verdict `READY`
**Program Brief:** [A5 Bug Bounty](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
**Status:** Draft — frozen at engagement kickoff; **activation gated on A2 verdict `READY`**
**Last Updated:** 2026-05-17
**Version:** 1.0

---

## 1. Purpose

This document is the multi-sig-specific addendum to the protocol bug
bounty program ([A5 PROGRAM_BRIEF.md](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)).
It enumerates the **multi-sig-specific scope, severity uplifts, and
out-of-scope clarifications** that the multi-sig card surface needs
in addition to the protocol-wide rules.

The [A5 program brief](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
§3.1 already lists `MultiSigCard.tact` as **Pending A2** — bounty
submissions against it are rerouted to the A2 intake until A2 returns
verdict `READY`. This document defines what the multi-sig category
**will activate as** once A2 unblocks it; it does **not** activate
the category prematurely.

---

## 2. Acceptance criterion this artifact satisfies

Issue #140 §8 — _"AC-7: End-to-end multi-sig flow tested on testnet"_
relies on the bounty surface being articulated even before activation,
so that researchers studying the testnet artefact know which bands
are in flight; full activation arrives only after A2.

Activation is **conditional**: the multi-sig category is satisfied
when (a) this document exists, (b) A2 reaches `READY`, (c)
[`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md)
records the category transition from `Pending A2` to `Active`, and
(d) the multi-sig readiness CI check
([`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts))
asserts (a)–(c) every PR.

---

## 3. In-scope assets

| Asset | Severity ceiling | Notes |
|-------|------------------|-------|
| [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) | **Critical** (per [A5 SEVERITY_RUBRIC.md §2.1](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)) — Critical reward band, eligible for the open-ended uplift per [A5 STATUS.md §10](../security/audits/A5-bug-bounty/STATUS.md). | Direct contract findings on threshold, approval, rejection, configuration paths. |
| [`backend/services/multisig-coordinator/`](../../backend/services/) *(planned, per [`SPECIFICATION.md` §6.1](./SPECIFICATION.md))* | **High** (off-chain) | Off-chain quorum coordinator — proposal queue, signer-set diff staging, MS-CH-2 substitute. |
| [`backend/services/notification-scheduler.ts`](../../backend/services/notification-scheduler.ts) *(planned, per [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md))* | **Medium** (off-chain) | Scheduler — MS-N01..MS-N08 dispatch, dedup key, retry policy. |
| [`backend/indexer/`](../../backend/indexer/) (multi-sig event subset only) | **High** (off-chain) | Proposal-state derivation per [`SPECIFICATION.md` §3.2](./SPECIFICATION.md); audit-log materialisation per [`SPECIFICATION.md` §7.3](./SPECIFICATION.md). |
| [`scripts/multisig/check-multisig-readiness.ts`](../../scripts/multisig/check-multisig-readiness.ts) *(planned)* | **Medium** | CI gate that prevents misconfigured releases. |
| Wallet-ui create / pending / sign / reject / signer-management surface | **High** (off-chain) | Authorization-sheet tampering, signature-prompt corruption, auto-sign exploit, signer-set diff staging bypass. |
| Wallet-ui guardian recovery surface | **High** (off-chain) | Off-chain cooldown enforcement, guardian-set membership check, cooldown-bypass paths pre-MS-CH-6. |

Off-chain coordinator / indexer / scheduler / wallet-ui findings stay
in the **off-chain** reward column of the A5 program brief.
Smart-contract findings against `MultiSigCard.tact` use the
**smart-contract** column, with the multi-sig-specific severity
uplifts in §4.

---

## 4. Multi-sig-specific severity uplifts

The protocol-wide rubric in
[`SEVERITY_RUBRIC.md` §2](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md)
maps to the multi-sig surface as follows. Where the rubric is generic
across invariants, the table below names the multi-sig-specific
realisation so triage stays unambiguous.

### 4.1 Critical — `I1` Non-Custodial / `I2` NFT Authority / `I3` No Admin break

| Trigger | Realisation on multi-sig | Reward band |
|---------|---------------------------|-------------|
| Forced fund movement | Any path through `MultiSigCard.tact` that moves TBC from a user without the user (NFT owner) having signed `SubmitPaymentProposal` and the required quorum having signed `ApprovePaymentProposal`. **Cannot exist by construction (the contract is non-custodial; settlement routes off-chain through `PaymentHub.tact`)** — but any payload that tricks `PaymentHub.tact` into transferring user funds via the multi-sig path qualifies. | Smart-contract Critical (open-ended) |
| Sub-quorum execution (I3 break) | Any path that lets `status` flip from `PENDING` to `APPROVED` with `approval_count < required_signatures`. | Smart-contract Critical |
| Configuration without NFT-owner signature (I2 break) | Any path that lets `sender() != owner(nft_address)` call `ConfigureMultiSig` or `SubmitPaymentProposal`. | Smart-contract Critical |
| Forced signer rotation by a non-owner (I2 break) | A `ConfigureMultiSig` accepted from a sender that does not own `nft_address`, replacing the signer set. | Smart-contract Critical |
| Guardian recovery seizing the owner key without the recovery quorum (I2 break) | Any path that rotates the `nft_owners` mapping for `nft_address` without `≥ guardian_quorum` approvals and the cooldown elapsing, per [`GUARDIAN_RECOVERY.md` §4](./GUARDIAN_RECOVERY.md). | Smart-contract Critical |

### 4.2 High — `I3` admin escape, replay, collision

| Trigger | Realisation on multi-sig | Reward band |
|---------|---------------------------|-------------|
| Replay of `ApprovePaymentProposal` for the same `(card, proposal, signer)` (T-MSC-1) | A PoC that bypasses the `approvals.get(approvalKey) == null` gate at [contract lines 343–347](../../contracts/MultiSigCard.tact). | Smart-contract High |
| Composite-key collision (T-MSC-6 / X-5) demonstrated with two distinct `(nft_address, proposal_id)` pairs | Known A2-class issue per [`SPECIFICATION.md` §3.3](./SPECIFICATION.md). PoC against the **current** combinator `sha256(addr.asSlice()) + id` at [contract lines 536–544](../../contracts/MultiSigCard.tact) earns the High band even though documented; PoC against the **post-MS-CH-1** combinator earns Critical. | High (current) / Critical (post-MS-CH-1) |
| Quorum manipulation (T-MSC-2) — a PoC where the owner re-runs `ConfigureMultiSig` without the off-chain signer-set diff staging quorum signing off | Operationally mitigated by the wallet's quorum-gated diff staging today; on-chain after MS-CH-2. PoC against either layer qualifies. | High → Critical (if it lets a single key replace all signers) |
| Test-only handler `RegisterNFTOwnerMultiSig` ([contract lines 569–573](../../contracts/MultiSigCard.tact)) reachable from a non-deployer sender | Already caught by the deployer guard; any PoC bypassing the guard earns Critical (I2 break) before mainnet, High after the handler is removed per [`CONTRACT_HARDENING.md` MS-CH-2](./CONTRACT_HARDENING.md). | High → Critical |
| Recovery cooldown bypass (T-MSC-5) — a `recovery_execute` accepted before `RECOVERY_COOLDOWN_SECONDS` elapses (post-MS-CH-6) | Direct contract issue. Pre-MS-CH-6 the cooldown is enforced off-chain; a wallet-ui PoC that fast-forwards the cooldown banner qualifies as Off-chain High. | Smart-contract High (post-MS-CH-6) / Off-chain High (pre-MS-CH-6) |
| Orphaned-proposal exploitation (C-MSC-M2) — a PoC where a proposal pending under a now-deactivated config (after `RemoveMultiSig`) still reaches `APPROVED` and triggers an off-chain settlement | Direct contract issue against the orphan-state semantics in [`SPECIFICATION.md` §6.2](./SPECIFICATION.md). | Smart-contract High |

### 4.3 High — off-chain coordinator / indexer / wallet

| Trigger | Realisation on multi-sig | Reward band |
|---------|---------------------------|-------------|
| Off-chain coordinator accepts a signer-set diff without the documented quorum | A PoC where the wallet's quorum-gated staging in [`WALLET_UX.md` §6](./WALLET_UX.md) accepts a single-key diff. | Off-chain High |
| Indexer mis-derivation of `status` (`PENDING` shown as `APPROVED`, etc.) under a deterministic edge case | Indexer bug per [`SPECIFICATION.md` §3.2](./SPECIFICATION.md). | Off-chain High |
| Notification-scheduler dedup-key collision — two distinct push notifications arrive for the same `(user_id, nft_address, proposal_id, MS-Nxx)` | Direct scheduler bug per [`NOTIFICATIONS.md` §5](./NOTIFICATIONS.md). | Off-chain Medium → High if it reveals PII (e.g. signer addresses outside the card's signer set). |
| Wallet-ui authorization sheet renders a stale recipient / amount after the owner re-submitted the proposal | UX freshness gap that could mis-inform signers in the approval queue. | Off-chain High (because it influences a quorum vote). |
| Wallet-ui auto-signs `ApprovePaymentProposal` on schedule, bypassing the per-action TON Connect prompt (I1 break) | Direct wallet-ui issue against the I1 invariant from [`WALLET_UX.md` §1](./WALLET_UX.md). | Off-chain Critical (I1 break, escalated above the off-chain High default). |

### 4.4 Medium — monitoring gaps, status divergence

| Trigger | Realisation on multi-sig | Reward band |
|---------|---------------------------|-------------|
| MS-Mxx alert ([`MONITORING.md` §3](./MONITORING.md)) fails to fire under a deterministic trigger | Alerting gap. | Off-chain Medium |
| Wallet-ui pending queue mis-categorises an `APPROVED` proposal as still pending for > 1 indexed block | Status-divergence issue per [`WALLET_UX.md` §4](./WALLET_UX.md). | Off-chain Medium |
| Guardian-set membership UI permits a guardian to also be a signer on the same card | Constraint violation per [`GUARDIAN_RECOVERY.md` §3.2](./GUARDIAN_RECOVERY.md). | Off-chain Medium |
| Audit-log materialisation misses an `ApprovePaymentProposal` event (signer's approval not recorded against the proposal) | Audit-log gap per [`SPECIFICATION.md` §7.3](./SPECIFICATION.md). | Off-chain Medium |

### 4.5 Low / Informational

Same as protocol-wide rubric. No multi-sig-specific uplift.

---

## 5. Multi-sig-specific out-of-scope clarifications

The following items extend the protocol-wide out-of-scope list in
[`PROGRAM_BRIEF.md` §3.4](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md):

| Item | Rationale |
|------|-----------|
| Findings that require the NFT owner to sign a malicious `SubmitPaymentProposal` payload after explicit confirmation in the wallet | Out-of-scope per the user-consent rule. The wallet always shows the proposal sheet field-by-field per [`WALLET_UX.md` §5](./WALLET_UX.md); an owner who confirms a hostile payload is not a protocol bug. |
| Findings that require all signers to collude (or all guardians to collude) to defeat the M-of-N model | Out-of-scope per [`SPECIFICATION.md` §4](./SPECIFICATION.md). The M-of-N model **assumes** that fewer than the quorum's worth of signers are malicious. A finding that requires the quorum to be malicious is not a protocol bug. |
| Findings on test-only handler `RegisterNFTOwnerMultiSig` ([contract lines 569–573](../../contracts/MultiSigCard.tact)) post-removal | Out of scope post-removal — MS-CH-2 removes this handler before mainnet per [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md). Pre-mainnet findings against the deployer-gate qualify (§4.2). |
| A signer fails to approve a pending proposal before the 7-day TTL lapses | By design — non-custodial M-of-N model. The proposal lapses and the owner can re-submit; this is correct behaviour, not a finding. |
| Proposal `recipient` / `amount` is on-chain public per the protocol's transparency posture ([`SPECIFICATION.md` §3.2](./SPECIFICATION.md)) | Out-of-scope — public chain state is not a privacy violation by itself. |
| Wallet-ui rendering glitches that do not lead to a mis-signed payload | Off-chain Low at most; not a multi-sig-specific bounty band. |
| Findings against third-party push services (FCM / APNS) or transactional-email providers (Postmark) | Out-of-scope per the third-party-dependency rule. Report to the provider's own program. |

---

## 6. Threat-catalogue cross-reference

The A2 threat catalogue in
[`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md` §4.2](../security/audits/A2-phase4-contracts/ENGAGEMENT.md)
maps to bug-bounty bands as follows. The T-MSC-N IDs match the
threat catalogue in
[`SPECIFICATION.md` §9](./SPECIFICATION.md):

| A2 threat | Description | Bounty band |
|-----------|-------------|-------------|
| **T-MSC-1** | Signature replay across proposals or signers | High (§4.2 here) |
| **T-MSC-2** | Quorum manipulation (owner unilaterally rewriting signer set) | High → Critical (§4.2 here) |
| **T-MSC-3** | Partial execution (approved proposal not settled) | Out-of-scope unless it produces fund loss, in which case Critical (§4.1) |
| **T-MSC-4** | Guardian recovery takeover | Critical when it lands without the recovery quorum (§4.1); High for off-chain cooldown bypass pre-MS-CH-6 (§4.2) |
| **T-MSC-5** | Recovery cooldown bypass | High (§4.2 here) |
| **T-MSC-6** | Composite-key collision (`proposalKey` / `approvalKey`) | High (current combinator) / Critical (post-MS-CH-1) (§4.2 here) |
| **T-MSC-7** | Test-only `RegisterNFTOwnerMultiSig` reaches mainnet | High → Critical pre-removal; out-of-scope post-MS-CH-2 (§4.2 / §5 here) |

---

## 7. Activation timeline

The multi-sig bounty category activates only after:

1. **A2 verdict `READY`** — recorded in
   [`docs/security/audits/A2-phase4-contracts/STATUS.md`](../security/audits/A2-phase4-contracts/STATUS.md).
2. **MS-CH-1..MS-CH-6 landed** — per
   [`CONTRACT_HARDENING.md` §3](./CONTRACT_HARDENING.md).
   (MS-CH-2 in particular — removal of the test-only handler — is
   required so that researchers don't waste cycles finding
   pre-removal issues. MS-CH-6 in particular — on-chain guardian
   recovery — closes the off-chain cooldown gap before researchers
   begin probing the recovery path.)
3. **PROGRAM_BRIEF.md update** — the §3.1 row for
   `MultiSigCard.tact` transitions from `Pending A2` to `Active`
   and references this document for the multi-sig-specific scope.
4. **STATUS.md note** — the bug-bounty `STATUS.md` records the
   category activation date and the multi-sig-specific intake URL.

Activation **must not** precede A2. A premature activation would
expose the protocol to a bounty-payout obligation for findings that
the A2 audit would have caught for a flat audit fee.

---

## 8. Triage SLA (multi-sig findings)

The protocol-wide SLA in
[`PROGRAM_BRIEF.md` §6](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md)
applies to multi-sig submissions. Multi-sig-specific refinements:

| Severity | Initial response | Triage decision | Notes |
|----------|-----------------:|----------------:|-------|
| Critical | 4 h              | 24 h            | Critical multi-sig findings invoke the auto-pause lever in [`MONITORING.md` §3.5 MS-M18](./MONITORING.md) with reason-code `RC-BOUNTY-CRITICAL`. The pause refuses **new** `SubmitPaymentProposal` while triage is in progress; in-flight proposals continue to honour their quorum so that legitimate signers can still reject or approve the queue. |
| High     | 8 h              | 72 h            | High multi-sig findings page the on-call (P1 per [`MONITORING.md` §3.6](./MONITORING.md)). |
| Medium   | 24 h             | 7 days          | Standard triage queue. |
| Low      | 7 days           | 14 days         | Standard triage queue. |

The Critical multi-sig SLA is **tighter** than the protocol-wide
default because a Critical finding's payload can drain funds from
every card whose proposal queue is in flight. The
`RC-BOUNTY-CRITICAL` pause is a defence-in-depth lever — the
alternative is hoping the discoverer withholds disclosure during the
standard triage window.

---

## 9. Acceptance criteria mapping (Issue #140 §8)

| AC  | Requirement | This document's contribution |
|-----|-------------|------------------------------|
| AC-1 | A2 audit complete (prerequisite) | §7 — gates activation on A2. |
| AC-2 | `SPECIFICATION.md` written | §6 — bounty bands track the T-MSC-N catalogue in [`SPECIFICATION.md` §9](./SPECIFICATION.md). |
| AC-4 | Wallet-ui multi-sig approval flow | §4.3 — off-chain bounty bands cover the wallet-ui surfaces from [`WALLET_UX.md`](./WALLET_UX.md). |
| AC-5 | Pending approvals screen | §4.3 — auto-sign / freshness findings categorised. |
| AC-6 | Guardian recovery flow | §4.1 / §4.2 — guardian-recovery seizure and cooldown-bypass categorised. |
| AC-7 | End-to-end flow tested on testnet | this document, activation per §7. |

---

## 10. Reference Mapping

| Reference | Path |
|-----------|------|
| Contract source        | [`contracts/MultiSigCard.tact`](../../contracts/MultiSigCard.tact) |
| Specification          | [`SPECIFICATION.md`](./SPECIFICATION.md) |
| Wallet UX              | [`WALLET_UX.md`](./WALLET_UX.md) |
| Guardian recovery      | [`GUARDIAN_RECOVERY.md`](./GUARDIAN_RECOVERY.md) |
| Notifications          | [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Monitoring             | [`MONITORING.md`](./MONITORING.md) |
| Contract hardening     | [`CONTRACT_HARDENING.md`](./CONTRACT_HARDENING.md) |
| Testnet deployment     | [`TESTNET_DEPLOYMENT.md`](./TESTNET_DEPLOYMENT.md) |
| A2 audit engagement    | [`docs/security/audits/A2-phase4-contracts/ENGAGEMENT.md`](../security/audits/A2-phase4-contracts/ENGAGEMENT.md) |
| A5 program brief       | [`docs/security/audits/A5-bug-bounty/PROGRAM_BRIEF.md`](../security/audits/A5-bug-bounty/PROGRAM_BRIEF.md) |
| A5 severity rubric     | [`docs/security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md`](../security/audits/A5-bug-bounty/SEVERITY_RUBRIC.md) |
| A5 status              | [`docs/security/audits/A5-bug-bounty/STATUS.md`](../security/audits/A5-bug-bounty/STATUS.md) |
| Invariants             | [`audit/INVARIANTS.md`](../../audit/INVARIANTS.md) |

---

## 11. Version History

| Version | Date       | Author   | Notes |
|---------|-----------|----------|-------|
| 1.0     | 2026-05-17 | @konard | Initial drafting under issue #140 (F5). |
