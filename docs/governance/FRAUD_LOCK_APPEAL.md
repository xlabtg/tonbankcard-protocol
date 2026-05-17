# FRAUD_LOCK Appeal Procedure

**Engagement:** [E3 — Risk Authority Decentralization](https://github.com/xlabtg/tonbankcard-protocol/issues/134)
**Companion documents:**
- [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) — Risk Authority governance and lock procedure
- [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) — incident playbook (referenced for fast-track triggers)
- [`SNAPSHOT.md`](./SNAPSHOT.md) — voter snapshot methodology (governs the DAO adjudication path)

**Status:** Proposed — to be ratified alongside `E3-PROP-001` (see [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §6.4).
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** A `FRAUD_LOCK` is a single bit on an NFT account that disables outgoing TBC transfers from that account. It does **not** confiscate funds, change ownership, or block incoming TBC (INVARIANT I6, Lock ≠ Confiscation; see [`contracts/payments/ACCOUNT_LOCKS.md`](../../contracts/payments/ACCOUNT_LOCKS.md)). This document describes the procedure by which a holder, or anyone acting on a holder's behalf, can challenge a lock and have it reviewed by parties **other than** the Risk Authority that originally signed it.

---

## Table of contents

1. [Who can appeal and what an appeal can achieve](#1-who-can-appeal-and-what-an-appeal-can-achieve)
2. [How to file an appeal](#2-how-to-file-an-appeal)
3. [Standard appeal — 7-business-day SLA](#3-standard-appeal--7-business-day-sla)
4. [Fast-track appeal](#4-fast-track-appeal)
5. [Required artifacts](#5-required-artifacts)
6. [Decision outcomes](#6-decision-outcomes)
7. [Audit trail & TransparencyRegistry logging](#7-audit-trail--transparencyregistry-logging)
8. [Edge cases & FAQ](#8-edge-cases--faq)
9. [References](#9-references)

---

## 1. Who can appeal and what an appeal can achieve

### 1.1 Eligible appellants

| Appellant | Required proof | Notes |
|-----------|----------------|-------|
| The current holder of the locked NFT | A signed message from the NFT's holding key over the incident ID | Standard path. The signature must be verifiable against the NFT's `owner_address` at the time of the appeal. |
| A previous holder whose key was compromised before the lock | A signed message from a holder-controlled recovery key (BIP-39 backup) + a chain trace of the compromise | Triggers the FC-5 review path in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3.1 and the fast-track in §4 below. |
| Counsel of record for the holder | A power of attorney scan (hash anchored on-chain via `TransparencyRegistry.RecordSnapshot`) + a signed message from the holder | Appeal proceeds in writing; legal correspondence is encrypted to the operations key. |
| Any community member, **only** to raise a procedural defect | Public message citing a violation of [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3 (e.g. missing evidence anchor, missing summary) | Procedural-defect appeals are reviewed but cannot themselves clear a lock; they may trigger an indexer alarm and a Risk Authority internal review. |

Anonymous appeals are accepted only via the procedural-defect channel (last row). All other paths require a verifiable signature linked to the locked NFT.

### 1.2 What an appeal can achieve

A successful appeal can produce one of three outcomes (§6):

1. **Overturn** — the FRAUD_LOCK is cleared on-chain via `op::clear_fraud_lock` (3-of-5 ceremony from the Risk Authority, mandated by the appeal decision).
2. **Uphold** — the lock remains in place; the appellant is notified of the reasoning and the next-review timestamp from [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3.4.
3. **Extend with conditions** — the lock remains but is bounded by a new (shorter) maximum duration, additional reporting from the Risk Authority, or a follow-up appeal slot. Extension is itself signed off by the appeal adjudicator (§3.4).

An appeal **cannot**:

- Move funds, change balances or transfer the NFT (no such on-chain capability exists in `account-locks.fc`; INVARIANT I3).
- Pre-empt a court order that produced the lock under FC-1 — the appellant must vacate the underlying order through the issuing court; the appeal in this document can only verify that the on-chain action matches the order.
- Bypass the 7-day timelock on the `risk_authority` role itself ([`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §2.4).

---

## 2. How to file an appeal

### 2.1 Channels

| Channel | URL / contact | When to use |
|---------|----------------|-------------|
| **Wallet UI in-app appeal flow** | The "Appeal" button on the locked-account banner, which deep-links to `https://tonbankcard.com/appeal/<incident-id>` (also linked from the `AccountLocked` event surfaced by the wallet) | Default for holders. Pre-fills the incident ID, NFT address, and a fresh signing nonce. |
| **Web appeal form** | `https://tonbankcard.com/appeal/<incident-id>` | When the holder uses a wallet without the in-app integration. |
| **Encrypted email** | `appeal@tonbankcard.com` (PGP key published at `docs/security/contacts/appeal.asc`) | For appellants who require correspondence in writing (legal counsel; FC-1 ground; jurisdiction-specific cases). |
| **Indexer JSON RPC** | `POST https://api.tonbankcard.com/v1/appeals` | For programmatic integrations (e.g. third-party custody operators acting for many holders). |
| **Procedural-defect channel** | A public GitHub issue under `xlabtg/tonbankcard-protocol` with label `appeal:procedural` | Community members raising defects per §1.1, last row. |

All channels feed into the same intake queue and produce the same on-chain receipt (§2.3).

### 2.2 What to include in the appeal

The appellant submits, in addition to the items in §5:

1. The **incident ID** as it appears in the `AccountLocked` event payload (`uint256`, see [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §4.2).
2. The **NFT address** of the locked account (the appeal form pre-fills this from the incident ID, but the field is required so that the signed message ties to a specific account).
3. The **appellant signature** over a `keccak256(incident_id || nft_address || nonce || channel_id)` message, where `nonce` is a fresh 256-bit random number returned by the form and `channel_id` identifies the intake channel.
4. The **grounds for appeal** chosen from §3.2 (or §4.1 for fast-track), e.g. "evidence-bundle mismatch", "duration-cap exceeded", "self-reported clearance under FC-5".
5. Any **supporting artifacts** (PDFs, screenshots, chain traces) — see §5 for the canonical list per ground.

A submission missing any required field is auto-replied within 1 business day with a checklist of missing items; the SLA clock in §3.3 starts only once the submission is complete.

### 2.3 On-chain receipt

Within 1 business day of a complete submission, the operations team anchors `SHA-256(appeal_packet)` on-chain via `TransparencyRegistry.RecordSnapshot`. The returned `tx_hash` is the appellant's receipt; it proves both that the appeal was filed and the exact contents that were filed (post-hoc edits would change the hash). The receipt is also emailed back to the appellant (if email was provided) and surfaced in the wallet UI as the "Appeal filed" badge.

> **Confidentiality.** The on-chain anchor records only the SHA-256 of the appeal packet; the contents of the packet are not on-chain. KYC artifacts, holder identity, and any PII remain encrypted on the operations side and are disclosed only to the adjudicator under §3.4.

---

## 3. Standard appeal — 7-business-day SLA

### 3.1 SLA

The non-functional requirement NFR-2 of [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) is "Lock appeal decisions must be reachable within 7 business days". This document interprets that requirement as follows:

- **T+1 business day** — intake review complete (§2.2); missing items requested.
- **T+3 business days** — Risk Authority briefing prepared (the original signers explain the lock decision to the adjudicator; the appellant is **not** present at this step).
- **T+5 business days** — appellant hearing (asynchronous, in writing, via the encrypted channel; sync video conference offered if the appellant requests it).
- **T+7 business days** — written decision published per §6 and on-chain clearance / extension transaction signed (where the outcome is Overturn / Extend).

The SLA covers business days in the Risk Authority's primary operating jurisdiction (Singapore until further notice). Holidays in the appellant's jurisdiction do not pause the SLA — the procedure is asynchronous and written, so holiday timing affects only optional sync hearings.

### 3.2 Standard grounds

The standard appeal path covers the following grounds. (Fast-track grounds are listed separately in §4.1.)

| Code | Ground | Typical evidence |
|------|--------|------------------|
| AG-1 | The lock was set under FC-2 / FC-3 / FC-5 but the underlying evidence is incorrect or has been superseded | Chain trace contradicting the indexer query; updated explorer status; fresh holder recovery proof |
| AG-2 | The lock was set on a wrong account (NFT address mismatch in the evidence) | Original evidence bundle vs. on-chain setter payload diff |
| AG-3 | The duration cap in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3.4 has expired and no renewal vote occurred | Block-height comparison; absence of a renewal `TransparencyRegistry.RecordSnapshot` for the incident |
| AG-4 | The summary (§4.5 of `RISK_AUTHORITY.md`) was not published within 24 h | Indexer alarm `ra.summary-missing` raised against the incident |
| AG-5 | The Risk Authority signer set at the time of the lock contained an undisclosed conflict of interest | Disclosure record from the encrypted ops registry vs. signer identity |

For an appeal under AG-1 / AG-2 the burden of proof rests with the appellant; for AG-3 / AG-4 / AG-5 the on-chain audit trail and the indexer alarms are themselves sufficient evidence and the Risk Authority must rebut.

### 3.3 Adjudicator

The standard appeal is adjudicated by a **rotating two-member panel** drawn from the following pool, none of whom signed the lock under review:

| Pool member | Default role | Constraint |
|-------------|--------------|------------|
| RA-5 — Independent Adjudicator (`RISK_AUTHORITY.md` §2.1) | Standing adjudicator | Mandatory in the panel; serves as the chair |
| One Diamond holder drawn at random from the snapshot at the time of the lock | Community adjudicator | Must not have voted on `E3-PROP-001` against the Risk Authority composition; selection is randomised on-chain via a `RandomBeacon` query and the seed is recorded in the appeal artefact |

If RA-5 has a conflict of interest with the incident (e.g. they previously held the NFT), the Diamond DAO appoints an interim chair from the same pool by a 24-h voting window. The panel composition for each appeal is recorded in the public decision (§6.3).

### 3.4 Decision authority

The two-member panel produces a written decision (§6.3). The decision is **binding** on the Risk Authority — the original signers must sign the corresponding `op::clear_fraud_lock` (Overturn) or the renewal packet (Extend with conditions) within the 7-business-day SLA. Failure to comply is itself an incident under [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) §3 and triggers replacement under [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §2.4.

### 3.5 Cost

Filing an appeal is **free**. The intake channel is operationally subsidised by the protocol treasury; this is a non-negotiable requirement of the engagement ("Appeal process … accessible to users", AC-5). The protocol does not require KYC to file an appeal — only proof that the appellant controls (or controlled) the NFT.

---

## 4. Fast-track appeal

### 4.1 Triggers

The fast-track applies whenever **any** of the following is true:

| Code | Trigger | Source |
|------|---------|--------|
| FT-1 | Indexer alarm `ra.lock-without-anchor` raised against the incident | [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.3 |
| FT-2 | Indexer alarm `ra.unknown-signer-set` raised against the incident | [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.3 |
| FT-3 | An emergency-path lock under [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §4.6 (48-h cap) and the appellant disputes the FC-2 reduction | This document |
| FT-4 | A Risk Authority signer is found, after the lock, to have an undisclosed material conflict of interest ([`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §2.2 step 5) | This document, AG-5 + post-hoc disclosure |
| FT-5 | The appellant produces a fresh holder recovery proof under FC-5 within the FC-5 maximum duration | [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3.1 |

### 4.2 SLA

The fast-track SLA is **48 hours** end-to-end, counting from the moment the intake is complete (§2.2). The procedure compresses §3.1 as follows:

- **T+4 h** — intake confirmed; the fast-track trigger code (FT-1…FT-5) recorded; the appellant notified of the fast-track classification.
- **T+12 h** — Risk Authority briefing collected (asynchronous, written).
- **T+24 h** — appellant hearing window (written; optional sync).
- **T+48 h** — written decision published per §6 and any on-chain clearance signed.

### 4.3 Adjudicator on fast-track

For FT-1, FT-2, FT-4 the adjudicator is **RA-5 alone** (the rotating community adjudicator is omitted to compress timing). For FT-3, FT-5 the standard two-member panel applies unless the appellant requests fast-track adjudication by RA-5 alone — in which case the appellant explicitly waives the community adjudicator.

### 4.4 Mandatory cross-check

Every fast-track decision is published with a one-paragraph rationale and is **re-reviewed** by the standard two-member panel within the next 14 calendar days as a non-binding post-hoc audit. The post-hoc audit publishes a short note that either confirms or critiques the fast-track decision; it cannot reverse the decision (decisions are final at T+48 h) but may trigger replacement of the adjudicator under [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §2.4 if the fast-track decision is found to have ignored available evidence.

---

## 5. Required artifacts

| Ground | Required artifacts |
|--------|--------------------|
| AG-1 — Incorrect underlying evidence (FC-2/FC-3/FC-5) | Chain trace (block range + tx hashes) contradicting the indexer query; updated explorer manifest (FC-3); holder recovery proof (FC-5) |
| AG-2 — Wrong-account lock | Diff of the evidence bundle NFT address vs. the on-chain setter NFT address |
| AG-3 — Duration cap expired without renewal | Block-height comparison + absence of renewal `RecordSnapshot` for the incident ID |
| AG-4 — Missing public summary | Indexer alarm `ra.summary-missing` (or proof that no `summary.md` exists at the expected path after 24 h) |
| AG-5 — Conflict of interest of a signer | Disclosure-registry record (decrypted by the appellant's counsel only if a court order is obtained, or by the adjudicator under §3.4) |
| FT-1 — No evidence anchor | Block-height comparison: setter tx block vs. `RecordSnapshot` from the same wallet in the prior 1 h |
| FT-2 — Unknown signer set | Wallet signer config on-chain vs. signers recovered from the setter tx signatures |
| FT-3 — Disputed FC-2 reduction | The appellant's account history showing absence of FC-2 pattern |
| FT-4 — Post-hoc disclosed conflict | Same as AG-5 |
| FT-5 — Fresh recovery proof | A signed message from a recovery key (BIP-39 or social-recovery) over the incident ID |

All artifacts are hashed and the hash is included in the appeal packet that is anchored on-chain (§2.3). The raw artifacts remain off-chain in the appeal's encrypted folder `docs/governance/fraud-lock-evidence/<incident-id>/appeal/<appeal-id>/` (encrypted with the appeal team's GPG key; the adjudicator and RA-2 are the only roles with read access until the decision is published).

---

## 6. Decision outcomes

### 6.1 Overturn

The adjudicator concludes that the FRAUD_LOCK was set without sufficient on-chain evidence (§3.2) or that the conditions in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §3 were not met. The Risk Authority signs `op::clear_fraud_lock` within the SLA window, citing the appeal's `<appeal-id>` in the message payload (same backward-compatible mechanism as §4.2 of `RISK_AUTHORITY.md`: the 256-bit `appeal_id` is appended after the NFT address; the indexer derives it from the raw payload).

The `AccountUnlocked` event is mirrored to `TransparencyRegistry` and the wallet UI updates the account state automatically.

### 6.2 Uphold

The adjudicator concludes that the FRAUD_LOCK was correctly set and remains warranted. The decision document explains the reasoning, cites the criterion FC-x that was met, and references the next-review timestamp from `RISK_AUTHORITY.md` §3.4. The appellant may file a new appeal once new evidence becomes available; serial appeals on the same grounds without new evidence are rejected at intake under §2.2.

### 6.3 Extend with conditions

The adjudicator concludes that the lock should remain but the conditions warrant adjustment. Possible adjustments include:

- Shortening the maximum duration cap from the default in `RISK_AUTHORITY.md` §3.4.
- Requiring an additional `TransparencyRegistry` anchor of new evidence by a specified deadline.
- Granting the appellant a guaranteed next-appeal slot at a specified date (e.g. "automatic re-review at T+14 days").

Extension decisions are signed by the adjudicator and by the Risk Authority (the latter then performs the renewal packet under the standard ceremony of `RISK_AUTHORITY.md` §4.3).

### 6.4 Publication

Every decision (Overturn / Uphold / Extend) is published at `docs/governance/fraud-lock-evidence/<incident-id>/appeal/<appeal-id>/decision.md` and the SHA-256 of the decision is anchored on-chain via `TransparencyRegistry.RecordSnapshot`. The decision contains:

- Appeal ID, incident ID, NFT address.
- Ground(s) cited (AG-x / FT-x).
- Panel composition (role only, not identity; matches `RISK_AUTHORITY.md` §2.1 disclosure model).
- Findings and reasoning (≤ 1500 words).
- Outcome and any on-chain follow-up actions (`tx_hash` of clearance / renewal).
- A redacted version of the appellant's submission (the holder may waive redaction).

The redacted decision is also surfaced in the quarterly transparency report ([`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.4) and in the public dashboard (E4).

---

## 7. Audit trail & TransparencyRegistry logging

The appeal lifecycle leaves three on-chain anchors:

```
T0  appeal filed                 TransparencyRegistry.RecordSnapshot(SHA-256(appeal_packet))     §2.3
T1  decision published           TransparencyRegistry.RecordSnapshot(SHA-256(decision.md))       §6.4
T2  on-chain follow-up           op::clear_fraud_lock or renewal packet, with <appeal-id>        §6.1 / §6.3
       payload trailing the NFT address
```

The indexer joins these anchors via the `<incident-id>` and `<appeal-id>` keys and updates the counters in [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) §7.2 — `fraud_lock_appeals_filed_30d`, `fraud_lock_appeals_upheld_30d`, `fraud_lock_appeals_overturned_30d`.

Indexer alarms for the appeal lifecycle:

| Alarm | Trigger | Severity |
|-------|---------|----------|
| `ra.appeal-sla-breach` | Decision not published within 7 business days (or 48 h on fast-track) | HIGH — incident under `INCIDENT_RESPONSE.md` §3 |
| `ra.appeal-no-anchor` | Decision published but no `RecordSnapshot` within 24 h | MEDIUM — operations follow-up |
| `ra.appeal-clearance-mismatch` | `op::clear_fraud_lock` signed without a matching Overturn decision | CRITICAL — Risk Authority review and signer replacement under `RISK_AUTHORITY.md` §2.4 |

These alarms are published to the security ops channel and mirrored to the public dashboard with a 24-h delay (matching the lock-side alarms in `RISK_AUTHORITY.md` §7.3).

---

## 8. Edge cases & FAQ

### 8.1 The holder lost both the holding key and the recovery key

The standard appeal path requires a signature linked to the NFT. If both keys are lost, the appellant cannot prove control and the FC-5 recovery path cannot be initiated. The available routes are:

1. **Wait out the duration cap.** Locks set under FC-2/FC-3/FC-5 expire automatically (`RISK_AUTHORITY.md` §3.4) unless renewed by a fresh vote. Renewal requires fresh evidence; absent the holder's continued misuse pattern, renewal typically fails.
2. **Court order against the protocol.** A court of competent jurisdiction may order clearance; the order is processed under FC-1 and the lock is cleared. The protocol team will cooperate with valid orders.
3. **NFT marketplace recovery flow.** Some marketplaces offer key-recovery insurance products; these are out-of-protocol and not endorsed here.

### 8.2 The appellant disputes the lock but cannot reveal evidence publicly (e.g. legal privilege)

Submit via the encrypted email channel (§2.1, row 3). The adjudicator receives the evidence under §3.4 confidentiality terms. The decision published under §6.4 will reference "confidential evidence reviewed by the panel" without disclosing contents.

### 8.3 The lock was set under FC-1 (judicial order); can the protocol clear it without the order being vacated?

No — the Risk Authority must verify that the order remains in force at the time of any clearance attempt. The appeal mechanism in this document cannot, by itself, overturn an FC-1 lock; it can only verify that the on-chain action matches the order and that the duration in `RISK_AUTHORITY.md` §3.4 (FC-1 row) has not been exceeded.

### 8.4 The appellant suspects collusion among Risk Authority signers

File under AG-5 (standard) or FT-4 (fast-track) with the disclosure-registry record as evidence. RA-5 (Independent Adjudicator) is structurally independent of the operational signers RA-1…RA-4; if RA-5 themselves is suspected, the Diamond DAO appoints an interim chair under §3.3.

### 8.5 The protocol is paused (`op::set_paused = true`) when the appeal completes

`op::clear_fraud_lock` is **not** gated by the pause flag (lines 227–241 of `account-locks.fc` do not check the pause bit; the pause flag in PaymentHub affects transfers, not lock administration). The Risk Authority can sign the clearance during a pause. The wallet UI surfaces the cleared state immediately even if transfers remain paused for other reasons.

### 8.6 The lock was emergency-set (`RISK_AUTHORITY.md` §4.6) and the appellant files within the 48-h cap

The fast-track path (FT-3) is the appropriate vehicle. If the 48-h cap expires during the fast-track procedure and the Risk Authority has not signed a renewal, the lock auto-clears at T+48 h regardless of the appeal status; the appeal continues to a decision but the operational outcome is already Overturn-by-expiration. The decision document records this outcome with the rationale "expiration".

### 8.7 Can a third party file an appeal on the holder's behalf?

Yes — see §1.1 row "Counsel of record". The third party must produce a power of attorney (hash anchored on-chain) and a holder signature authorising the appeal. Pseudonymous counsel is acceptable only if the holder's signature is verifiable; the holder retains the right to revoke the authorisation in writing.

### 8.8 Appeals fee — is there ever a charge?

No (§3.5). Any future change to make appeals paid would itself require a `RISK_DISCLOSURE` governance proposal of category 3, because it would limit accessibility — a non-functional requirement of the engagement.

---

## 9. References

- [`RISK_AUTHORITY.md`](./RISK_AUTHORITY.md) — governance structure, lock procedure, signer roster (RA-1…RA-5), §§ 3.4, 4.4, 4.6, 5, 7
- [`PARAMETER_CHANGES.md`](./PARAMETER_CHANGES.md) — proposal template (Extension-with-conditions uses a parameter-change form for the duration cap)
- [`SNAPSHOT.md`](./SNAPSHOT.md) — Diamond DAO voter snapshot methodology (basis for the random-community-adjudicator draw in §3.3)
- [`../security/KEY_MANAGEMENT.md`](../security/KEY_MANAGEMENT.md) §§ 4, 7 — Risk Authority key class and rotation procedure
- [`../security/INCIDENT_RESPONSE.md`](../security/INCIDENT_RESPONSE.md) — incident playbook (SLA breaches and clearance-mismatch alarms route here)
- [`../security/THREAT_MODEL.md`](../security/THREAT_MODEL.md) §§ 7, 8 — T4 (admin abuse), T8 (Risk Authority key compromise) — the threat models that motivated this procedure
- `contracts/payments/account-locks.fc` lines 130–145 (set/clear), 167 (`AccountLocked`), 182 (`AccountUnlocked`), 210–241 (handlers) — on-chain enforcement
- `contracts/payments/ACCOUNT_LOCKS.md` — operator-facing contract documentation
- `contracts/governance/TransparencyRegistry.tact` — on-chain receipt mechanism (`RecordSnapshot`)
- Issue [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134) — E3 engagement (AC-5 + NFR-2)
- Issue [#96](https://github.com/xlabtg/tonbankcard-protocol/issues/96) — Two-phase role transfer (constrains adjudicator authority over `risk_authority` itself)
