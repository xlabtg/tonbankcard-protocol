# TONBANKCARD — Audit Remediation Workflow

**Document Type:** Process Reference
**Issue Reference:** [#112 — A1 Formal Security Audit](https://github.com/xlabtg/tonbankcard-protocol/issues/112)
**Status:** Active
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document defines a single, repeatable workflow for processing findings from any external audit listed in [`README.md`](./README.md). It exists so that:

- Every finding has a tracked GitHub issue
- Every fix has a reviewable pull request
- Auditors can re-verify fixes against a stable artifact
- Public disclosure follows a predictable timeline

It applies to engagements A1, A2, A4, future re-audits, and any out-of-band advisories.

---

## 2. Severity Classification

The protocol uses the severity scale already established in [`audit/SMART_CONTRACTS_SECURITY_AUDIT.md`](../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md) and issue #110:

| Severity | Definition | Response Time | Mandatory Action |
|----------|------------|---------------|------------------|
| 🔴 **CRITICAL** | Threat to user funds or non-custodial guarantee | 24h triage / 7-day fix target | **Must be remediated**. Mainnet deployment blocked until re-verified. |
| 🟠 **HIGH** | Serious logic error that can lead to loss of funds or privilege escalation under plausible conditions | 72h triage / 14-day fix target | Remediated **or** formally accepted in `STATUS.md` with rationale and compensating control |
| 🟡 **MEDIUM** | Bug or deviation that produces incorrect behaviour without direct fund loss | 1-week triage / 30-day fix target | Remediated or documented as accepted risk in `docs/audit-notes.md` |
| 🟢 **LOW** | Style, documentation, or hardening issue | Best-effort | Addressed in batches; tracked but non-blocking |
| ℹ️ **INFORMATIONAL** | Notes, suggestions, design observations | Optional | Logged in `STATUS.md` if not actioned |

Mainnet deployment is gated on the rules in [`README.md`](./README.md) §4.

---

## 3. Workflow

```
Auditor delivers report
        │
        ▼
1. Intake          ─►  Hash + commit report to audits/<ID>/report-vN.pdf
        │
        ▼
2. Triage          ─►  Open one GitHub issue per finding (label: audit:<ID>, severity:<level>)
        │
        ▼
3. Remediation     ─►  Branch issue-<n>-<slug>, PR linked back to the finding issue
        │
        ▼
4. Re-verification ─►  Auditor confirms fix on remediation commit hash
        │
        ▼
5. Disclosure      ─►  STATUS.md flipped to COMPLETED; AUDIT_READINESS.md updated; public note
```

Each step is described below in detail.

### 3.1 Intake

When an audit report is received:

1. Save the report as `docs/security/audits/<ID>/report-v<N>.pdf` (or `.md`) — keep the original filename in `STATUS.md`.
2. Record SHA-256 of the file in `STATUS.md` for tamper evidence.
3. Confirm the audited commit hash matches the freeze recorded in `audit/FREEZE_METADATA.md`. If it does not, raise this with the auditor before triage.
4. Commit the report on a branch named `audit/<ID>-report-intake`. **Do not modify the report after this commit.**

### 3.2 Triage

For every finding:

1. Open a GitHub issue titled `[audit-<ID>] <finding-id>: <short title>`.
2. Apply labels:
   - `audit:<ID>` (e.g., `audit:A1`)
   - `severity:critical` / `severity:high` / `severity:medium` / `severity:low` / `severity:informational`
   - `type:security`
3. Copy the auditor's description, evidence, and recommendation verbatim into the issue body.
4. Cross-link the issue from the corresponding row in `audits/<ID>/STATUS.md` §"Findings ledger".

The triage owner is the maintainer named in `audits/<ID>/STATUS.md` §"Engagement parties". Triage SLAs:

- Critical: triage within 24 hours of intake
- High: 72 hours
- Medium / Low / Informational: 7 days

### 3.3 Remediation

For every finding that will be remediated:

1. Create a branch named `issue-<n>-<slug>` per the contributing guidelines.
2. Reproduce the finding in a test case before applying the fix. The test must fail on the audited commit.
3. Implement the fix and run the full test suite (`npx blueprint test`).
4. Open a pull request with the description fields below:

```markdown
## Audit Finding
Engagement: <A1 / A2 / …>
Finding ID: <auditor-assigned ID>
Severity: <Critical / High / Medium / Low / Informational>
Auditor recommendation: <one line>

## Fix Summary
<what changed and why>

## Verification
- [ ] Reproducing test added (link)
- [ ] Full suite passes
- [ ] Invariant tests (I1–I7) unchanged or strengthened
- [ ] No changes to public ABI without coordinator sign-off
```

5. Request review from the maintainer named in the engagement's `STATUS.md`.
6. After merge, append the merge commit to the finding row in `STATUS.md`.

### 3.4 Findings That Will Not Be Remediated

When a finding is accepted as residual risk:

1. Record the acceptance in `audits/<ID>/STATUS.md` §"Accepted risks" with:
   - Finding ID
   - Severity
   - Justification (technical + business)
   - Compensating control
   - Sign-off (maintainer GitHub handle + date)
2. Mirror the entry into `docs/audit-notes.md`.
3. Inform the auditor; request explicit acknowledgement in the re-verification letter.

High-severity findings may only be accepted with maintainer + at least one independent reviewer sign-off recorded in the table.

### 3.5 Re-verification

After all remediation PRs are merged:

1. Tag the remediation head commit (`audit-<ID>-remediation-v<N>`).
2. Provide the auditor with:
   - The tag
   - A diff against the audited commit
   - Test results
3. Receive the auditor's re-verification letter. Save it under `audits/<ID>/reverification-v<N>.pdf`.
4. Flip the engagement status in `STATUS.md` and `README.md` §3 to `COMPLETED` (or `ACCEPTED WITH RISKS` if any High items were accepted).

### 3.6 Disclosure

Within 14 days of re-verification:

1. Update `docs/security/AUDIT_READINESS.md` §"Audit completion status" with a one-line summary and a link to the report.
2. Add an entry to `CHANGELOG.md` under the next release.
3. Publish a short summary on the project's public channels referencing this directory.
4. Ensure no remediation PR is left in draft state.

---

## 4. Bookkeeping Templates

The two structured fields below are reused across every engagement's `STATUS.md`. Copy them as-is and fill in.

### 4.1 Findings ledger row

```markdown
| <finding-id> | <severity> | <one-line title> | <github-issue> | <pr> | <status> | <notes> |
```

`<status>` values: `triage`, `in-progress`, `merged`, `re-verified`, `accepted`, `wont-fix-with-rationale`.

### 4.2 Accepted-risk row

```markdown
| <finding-id> | <severity> | <rationale> | <compensating-control> | <sign-off> | <date> |
```

---

## 5. Communication Channels

- **Auditor ↔ Maintainers:** private channel agreed at engagement kickoff (recorded in `STATUS.md`).
- **Internal triage:** GitHub issues labelled `audit:<ID>`.
- **Public communication:** delayed until §3.6 disclosure, except for already-public information already disclosed by the auditor.

Out-of-band advisories (responsible-disclosure reports outside an engagement) follow the same workflow starting from §3.2, with §3.1 replaced by saving the advisory to `docs/security/audits/_advisories/<date>-<short>.md`.

---

## 6. References

- [Audits index](./README.md)
- [Audit Readiness](../AUDIT_READINESS.md)
- [Internal Per-Contract Audit](../../../audit/SMART_CONTRACTS_SECURITY_AUDIT.md)
- [Security Policy](../../../SECURITY.md)
- [Audit Notes — Known Limitations](../../audit-notes.md)
- [Contributing Guidelines](../../../CONTRIBUTING.md)
