# TONBANKCARD — Incident Response & Emergency Governance

**Version:** 1.0
**Status:** Active
**Release date:** 2025-01
**Applies to:** TONBANKCARD Protocol (Mainnet & Testnet)

---

## 1. Core Principles

Emergency response in TONBANKCARD is governed by the same principles that govern the protocol itself.

No incident, regardless of severity, may cause the protocol to violate its invariants. Emergency powers do not exist in the protocol layer. Crisis response is limited to communication, coordination, and guidance.

**Non-custodial design:** No emergency action may result in admin control over user funds.

**No forced fund control:** No scenario permits account seizure, forced transfers, or admin withdrawal.

**Transparency-first:** Every incident, decision, and resolution must be publicly documented.

**Immutable audit trail:** All incident records and governance decisions are permanent and publicly verifiable.

**Governance accountability:** All emergency governance actions must reference an incident ID and be recorded on-chain or in the governance registry.

The following are **permanently forbidden**, regardless of incident severity:

* admin withdrawal from any account
* account seizure
* forced fund transfers
* silent contract mutation
* retroactive settlement changes
* transaction censorship
* bypassing protocol invariants I1–I7

---

## 2. Scope of Incidents

### 2.1 Smart Contract Vulnerabilities

Incidents originating within deployed contract logic:

* logic flaws in Payment Hub or account state machine
* signature validation errors
* state machine inconsistencies
* lock bypass vulnerabilities
* replay attack vectors
* NFT resolver manipulation

### 2.2 External Integration Failures

Incidents originating in off-chain or third-party components:

* payment provider compromise (ChangeNOW, NOWPayments, CoinRabbit)
* lending adapter manipulation
* oracle or price data integrity failure
* external API exploitation

### 2.3 Infrastructure Failures

Incidents affecting off-chain services only:

* indexer desynchronization with on-chain state
* API service downtime
* backend system compromise
* database integrity failure

### 2.4 Governance-Level Incidents

Incidents targeting the governance layer:

* proposal spam or governance griefing
* social engineering targeting TBC Diamond holders
* governance NFT compromise
* manipulation of proposal registry inputs

### 2.5 Network-Level Events

Incidents at the TON network layer:

* blockchain reorganization affecting confirmed transactions
* finality disruption
* network partition
* validator-level anomalies affecting TONBANKCARD state

---

## 3. Incident Severity Classification

Each incident is assigned a severity level at detection time. Severity determines escalation path, communication requirements, and response timeline.

| Severity | Description | Examples |
|----------|-------------|---------|
| **LOW** | Limited impact, no funds at risk, degraded non-critical service | Indexer lag, minor API errors, documentation errors |
| **MEDIUM** | Operational degradation, no direct fund risk, user-visible disruption | Adapter downtime, governance UI failure, off-chain sync delay |
| **HIGH** | Potential economic or protocol risk, possible exploit vector identified | Unconfirmed vulnerability report, partial adapter compromise, governance registry inconsistency |
| **CRITICAL** | Active exploit, confirmed fund risk, or systemic protocol failure | Confirmed lock bypass, active contract exploit, governance NFT mass compromise |

### 3.1 LOW Severity

**Detection criteria:** Reported operational anomaly with no confirmed fund exposure or protocol invariant risk.

**Escalation path:** Core team internal review. No emergency governance action required.

**Communication requirement:** Public post-mortem within 30 days of resolution.

### 3.2 MEDIUM Severity

**Detection criteria:** Confirmed service disruption affecting user experience or off-chain reliability, with no confirmed protocol-layer risk.

**Escalation path:** Core team review within 24 hours. Governance notification via public channel.

**Communication requirement:** Public status update within 24 hours of detection. Post-mortem within 14 days of resolution.

### 3.3 HIGH Severity

**Detection criteria:** Credible vulnerability report or partial compromise with potential to escalate to fund risk or protocol invariant violation.

**Escalation path:** Immediate core team response. Emergency governance proposal may be submitted. Third-party auditor notification recommended.

**Communication requirement:** Public advisory within 12 hours of classification. Preliminary post-mortem within 7 days. Full post-mortem within 30 days.

### 3.4 CRITICAL Severity

**Detection criteria:** Confirmed active exploit, confirmed invariant violation, or confirmed systemic failure with direct fund risk.

**Escalation path:** Immediate public disclosure. Emergency governance proposal submitted within 24 hours. Coordinated public audit response.

**Communication requirement:** Immediate public warning (within 2 hours of confirmation). Incident ID assigned and recorded. Full post-mortem within 14 days.

---

## 4. Detection & Reporting

### 4.1 Monitoring Sources

On-chain monitoring:

* Payment Hub state transitions
* Account lock state changes
* NFT resolver resolution patterns
* Governance contract event logs

Off-chain monitoring:

* Indexer synchronization health
* API response integrity
* Adapter availability and response consistency

### 4.2 Reporting Channels

**External disclosures:** Any party may report an incident via:

* GitHub Issues in the TONBANKCARD repository (public)
* Responsible disclosure process (private, for pre-disclosure)

**Bug bounty integration:** Critical and HIGH severity disclosures submitted through responsible disclosure receive acknowledgment before public disclosure. Reporters are credited in the public post-mortem unless anonymity is requested.

### 4.3 Responsible Disclosure Policy

Reporters who identify a vulnerability and submit a private disclosure prior to public reporting will be given reasonable time to allow a response before the issue is made public. The expected timeline:

* Acknowledgment within 48 hours
* Severity assessment within 5 business days
* Public disclosure after remediation or after maximum 90 days, whichever comes first

### 4.4 Disclosure Requirements

All incident reports, regardless of origin, must be:

* logged with a unique incident ID
* timestamped at first detection
* publicly disclosed after remediation is complete
* linked from the governance registry post-mortem record

No incidents may be closed silently. No private resolutions are permitted.

---

## 5. Governance Response Model

### 5.1 Emergency Governance Is Transparent

All emergency governance decisions must be:

* recorded on-chain in the ProposalRegistry or TransparencyRegistry
* publicly auditable before and after resolution
* tagged with the relevant incident ID
* referencing the specific affected contract or component

Private governance resolution is explicitly prohibited. No emergency decision affecting the protocol or its public communication may be made without a corresponding public record.

### 5.2 Emergency Proposal Path

During a HIGH or CRITICAL severity incident, an emergency governance proposal may be submitted using the `RISK_DISCLOSURE` (3) or `DEPRECATION_NOTICE` (4) categories in the ProposalRegistry.

Emergency proposals follow an accelerated timeline:

* Voting period: minimum 24 hours (vs. standard 7 days)
* Quorum threshold: standard threshold applies (22 of 222); no reduction permitted

All emergency proposals must include:

* incident ID reference
* severity classification
* scope of affected components
* proposed response action
* explicit statement of what the proposal does NOT authorize

### 5.3 Limits of Emergency Governance Powers

Emergency governance powers are limited to:

* publishing public warnings and advisories
* recommending adapter or integration suspension
* declaring a new contract version as the recommended deployment
* coordinating public audit response

Emergency governance powers must NOT include:

* any form of parameter mutation in deployed contracts
* any form of fund custody or movement
* hidden or unpublicized contract upgrades
* retroactive changes to settled state
* any action not explicitly listed as allowed in Section 6

---

## 6. Allowed and Forbidden Emergency Actions

### 6.1 Allowed Actions

| Action | Description |
|--------|-------------|
| Public warning | Publish a public advisory about a confirmed or suspected incident |
| Merchant advisory | Notify merchants of degraded service or integration risk |
| Adapter suspension | Recommend or execute suspension of a compromised off-chain adapter |
| New version declaration | Announce a new contract version as the community-recommended deployment |
| Freeze of off-chain services | Suspend indexer, API, or backend services to prevent propagation of corrupted state |
| Public audit coordination | Coordinate with auditors for emergency review of affected components |
| Migration guidance | Publish guidance for users to migrate from a compromised contract to a new deployment |

### 6.2 Forbidden Actions

| Action | Reason |
|--------|--------|
| Contract upgrade without versioning | Violates immutability and audit trail requirements |
| Asset seizure | Violates invariant I1 (Non-Custodial Ownership) and I3 (No Admin Fund Control) |
| Retroactive settlement | Violates invariant I4 (Atomic Transfers) and I5 (Ledger Conservation) |
| Transaction censorship | Violates user sovereignty and non-custodial design |
| Admin withdrawal | Violates invariant I3 (No Admin Fund Control) |
| Forced fund transfer | Violates invariant I1 (Non-Custodial Ownership) |
| Silent contract mutation | Violates transparency-first principle and governance accountability |
| Hidden governance resolution | Prohibited — all decisions must be public |

---

## 7. Kill-Switch Philosophy

TONBANKCARD does not include a protocol-level kill switch.

This is a deliberate design decision, not a limitation.

**Rationale:** A kill switch would require a trusted administrator with elevated contract authority. This authority would constitute a hidden emergency power inconsistent with the non-custodial design and protocol invariants.

**Response to compromise instead:**

1. The compromised contract continues to operate immutably as deployed.
2. A patched contract version is deployed at a new address.
3. The governance layer formally declares the new version as the community-recommended deployment via a `DEPRECATION_NOTICE` proposal referencing the old contract address.
4. Users and merchants are provided migration guidance.
5. The old contract is publicly labeled as deprecated in the protocol registry.

Old contracts remain immutable and accessible. No funds are frozen. No user action is forced. Migration is voluntary and user-initiated.

---

## 8. Containment Strategy

### 8.1 Smart Contract Incident

1. Assign incident ID, classify severity.
2. Issue immediate public disclosure if severity is HIGH or CRITICAL.
3. Engage third-party auditors for independent validation.
4. Deploy patched contract at new address.
5. Submit `DEPRECATION_NOTICE` governance proposal for old contract.
6. Publish migration guide for users and merchants.
7. Update protocol registry with deprecated contract address.
8. Publish post-mortem within required timeline (see Section 3).

### 8.2 External Integration / Adapter Incident

1. Assign incident ID, classify severity.
2. Immediately suspend the affected adapter in off-chain services.
3. Issue public notice to affected merchants.
4. Engage affected provider for root cause.
5. Replace or reconfigure the adapter after remediation.
6. Resume adapter service only after independent verification.
7. Publish post-mortem.

### 8.3 Infrastructure Incident

1. Assign incident ID, classify severity.
2. Activate redundancy or degraded mode for affected services.
3. Issue public status update.
4. Restore services after root cause is confirmed and addressed.
5. Verify on-chain state consistency against indexer after restoration.
6. Publish post-mortem.

### 8.4 Governance-Level Incident

1. Assign incident ID, classify severity.
2. Issue public advisory if TBC Diamond holders or governance participants are at risk.
3. Document all affected proposal IDs in the governance registry.
4. Recommend affected NFT holders take protective action (e.g., transfer to secure wallet).
5. Publish post-mortem.

### 8.5 Network-Level Event

1. Monitor TON network status via official channels.
2. Suspend off-chain confirmation logic until finality is restored.
3. Issue public advisory for merchants regarding delayed settlements.
4. Reconcile indexer state against confirmed on-chain state after finality is restored.
5. Publish post-mortem if user impact is confirmed.

---

## 9. Communication Framework

### 9.1 Public Communication Channels

All incident communications are published through:

* GitHub repository (issues, announcements)
* Official public communication channels (as designated by the core team)
* Governance registry entries (on-chain)

### 9.2 Announcement Timeline

| Severity | First Public Notice | Status Updates | Post-Mortem |
|----------|--------------------|--------------------|-------------|
| LOW | Not required | Not required | Within 30 days |
| MEDIUM | Within 24 hours | As needed | Within 14 days |
| HIGH | Within 12 hours | Every 24 hours | Within 30 days (preliminary within 7 days) |
| CRITICAL | Within 2 hours | Every 6 hours | Within 14 days |

### 9.3 Communication Content Requirements

Each public communication must include at minimum:

* unique incident ID
* severity classification
* summary of what is known
* affected components or scope
* user impact statement
* current mitigation steps in progress
* residual risk (if any)
* next scheduled update (if incident is ongoing)

### 9.4 Transparency Obligations

* No incident may be resolved without a public record.
* No communication may misrepresent the scope or severity of an incident.
* No affected user group may be excluded from public disclosure.
* Auditors and institutional partners must be informed on the same timeline as the public.

### 9.5 Auditor Coordination

For HIGH and CRITICAL severity incidents, independent auditors are notified concurrent with public disclosure. Auditors receive:

* full incident report
* relevant contract addresses and deployment versions
* on-chain evidence (transaction hashes, block heights)
* preliminary root cause assessment

---

## 10. Post-Mortem Requirements

A post-mortem is mandatory for every incident at MEDIUM severity and above.

### 10.1 Post-Mortem Content

Each post-mortem must include:

* incident ID
* detection timestamp and first public disclosure timestamp
* severity classification (initial and final)
* root cause analysis
* full timeline of events
* affected components
* user impact assessment (confirmed, not estimated)
* mitigation steps taken
* preventive controls added or recommended
* governance review summary (if a governance proposal was submitted)
* outstanding residual risk (if any)

### 10.2 Post-Mortem Publication

* Post-mortems must be published at the path `docs/post-mortems/INCIDENT-{ID}.md` in the repository.
* Each post-mortem must be linked from the governance registry entry for the corresponding incident.
* Post-mortems are permanent and may not be deleted or retroactively modified.
* Corrections to a published post-mortem must be appended as versioned addenda, not in-place edits.

### 10.3 Governance Review

After each HIGH or CRITICAL incident, a governance review proposal must be submitted in the ProposalRegistry within 30 days of resolution:

* Category: `RISK_DISCLOSURE` (3)
* Proposal text: reference incident ID, root cause, and recommended preventive measures
* Outcome: non-binding, but permanently recorded

---

## 11. Audit & Institutional Expectations

TONBANKCARD's incident response framework is designed to meet the expectations of institutional partners, payment providers, and regulatory discussions.

This framework demonstrates:

* **Predictable crisis handling:** Every incident class has a documented, deterministic response path.
* **No central authority:** No single party holds emergency powers over the protocol or user funds.
* **Clear trust boundaries:** Emergency actions are bounded by explicit allow/forbid lists in Section 6.
* **Governance traceability:** All emergency governance decisions are on-chain and publicly auditable.

### 11.1 Required Audit Evidence

An auditor reviewing compliance with this framework should verify:

* [ ] Incident IDs are assigned and publicly recorded for all MEDIUM+ events
* [ ] All emergency governance proposals reference their incident ID
* [ ] No post-mortem has been deleted or silently modified
* [ ] All actions taken are within the allowed list in Section 6.1
* [ ] No forbidden actions from Section 6.2 were taken in any incident
* [ ] No protocol invariant (I1–I7) was violated during emergency response
* [ ] Communication timeline requirements in Section 9.2 were met

---

## 12. Explicit Non-Goals

This framework does NOT:

* guarantee rapid recovery from any incident
* prevent all exploits or vulnerabilities
* provide insurance or compensation to affected users
* eliminate user risk
* introduce any form of centralized emergency authority
* create any obligation on the core team to act within any specific timeframe
* supersede protocol invariants I1–I7 under any circumstances

---

## 13. Acceptance Criteria

This document satisfies Issue 10.3 when the following are all verifiable:

- [x] Incident classification defined (Section 3)
- [x] Governance escalation path defined (Section 5.2)
- [x] Allowed and forbidden actions documented (Section 6)
- [x] Transparency guarantees formalized (Sections 5.1, 9.4)
- [x] Communication process documented (Section 9)
- [x] Post-mortem process defined (Section 10)
- [x] No hidden emergency powers remain (Sections 5.3, 6.2, 7)

All criteria are verifiable against the content of this document.

---

## 14. References

* [Protocol Invariants](../invariants.md) — I1–I7 definitions
* [Governance Process](../governance-process.md) — ProposalRegistry categories and lifecycle
* [Governance Release Notes v1](./release-notes-v1.md) — Governance v1 powers and limitations
* [Threat Model](../threat-model.md) — Threat classes T1–T8
* [Versioning Policy](../versioning-policy.md) — Contract version declaration process

---

> **Emergencies do not justify centralization.**
> Crisis response remains aligned with TONBANKCARD's core principles: user sovereignty, transparency, immutability, and trust minimization.

---

**Document status:** Active
✅ Incident classification defined
✅ Governance escalation path defined
✅ Allowed and forbidden actions documented
✅ Transparency guarantees formalized
✅ Communication process documented
✅ Post-mortem process defined
✅ No hidden emergency powers
