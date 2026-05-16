# A5 Bug Bounty — Quarterly Transparency Report Template

**Document Type:** Public Reporting Template
**Engagement:** [A5](./ENGAGEMENT.md) · [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
**Status:** Active (used to draft `reports/YYYY-Qn.md` files quarterly)
**Last Updated:** 2026-05-16

---

## 1. Purpose

This template is the canonical source for the quarterly public transparency report mandated by [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §8 and acceptance criterion #5 of [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116). A new report is produced every calendar quarter while the program is active, stored at `docs/security/audits/A5-bug-bounty/reports/YYYY-Qn.md`, and linked from the root [`SECURITY.md`](../../../../SECURITY.md) and the program page on the chosen platform.

How to use:

1. Copy this file to `reports/YYYY-Qn.md` at the start of the reporting window (e.g., `reports/2026-Q3.md`).
2. Replace every `<…>` placeholder with the actual value from [`STATUS.md`](./STATUS.md) §6 (findings ledger) and §7 (SLA tracker).
3. Remove §10 (Internal Editor Notes) before publishing.
4. Open a PR titled `docs(security): A5 quarterly report <YYYY-Qn>` and request review from the maintainers listed in [`STATUS.md`](./STATUS.md) §1.

If a figure cannot be disclosed in the public report (e.g., undisclosed Critical finding still within the 90-day fix window), record `redacted (see §<n>)` and add a short rationale in §9.

---

## 2. Report Header (copy verbatim, fill placeholders)

```markdown
# A5 Bug Bounty — Quarterly Transparency Report — <YYYY>-<Qn>

**Report Window:** <YYYY-MM-DD> → <YYYY-MM-DD>
**Program Phase:** <Dry-Run / Soft-Launch / Public>
**Platform:** <Immunefi | HackenProof>
**Program Page:** <https://…>
**Maintainer Contact:** <security@…>
**Report Author:** <name / role>
**Reviewed By:** <name / role>
**Publication Date:** <YYYY-MM-DD>
**Previous Report:** [<YYYY-Q(n-1)>](./<YYYY-Q(n-1)>.md) (or "first quarterly report" if none)
```

---

## 3. Executive Summary

One to three sentences covering:

- whether the program operated normally during the window,
- the number of confirmed valid findings paid out,
- the total payout in USDC,
- any notable trend (e.g., spike in `sdk/` submissions following a release).

Example:

> "Between <YYYY-MM-DD> and <YYYY-MM-DD>, the A5 bug bounty program received `<n>` submissions, of which `<k>` were valid and resulted in a total payout of `<X>` USDC. No Critical findings were confirmed during the window. All SLAs were met."

---

## 4. Submission Counters

Numbers are sourced from [`STATUS.md`](./STATUS.md) §6 (findings ledger) for the reporting window only.

| Metric | Count |
|--------|-------|
| Submissions received | `<n>` |
| Out-of-scope | `<n>` |
| Duplicate | `<n>` |
| Confirmed valid — Critical | `<n>` |
| Confirmed valid — High | `<n>` |
| Confirmed valid — Medium | `<n>` |
| Confirmed valid — Low | `<n>` |
| Informational (credited only) | `<n>` |
| Withdrawn / closed by researcher | `<n>` |
| **Total confirmed valid (Critical + High + Medium + Low)** | `<n>` |

Notes:

- "Confirmed valid" means triage assigned a non-Informational severity per [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md). Disagreements with the researcher about severity are resolved by the team per [`SEVERITY_RUBRIC.md`](./SEVERITY_RUBRIC.md) §3 and reflected in this count.
- A submission that was valid but unpaid because of policy (e.g., self-XSS or third-party vendor scope per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3.4) is counted under "Out-of-scope" with a footnote.

---

## 5. Payouts

| Severity | Submissions paid | Total payout (USDC) |
|----------|------------------|---------------------|
| Critical (smart contract) | `<n>` | `<X>` |
| Critical (off-chain) | `<n>` | `<X>` |
| High (smart contract) | `<n>` | `<X>` |
| High (off-chain) | `<n>` | `<X>` |
| High (frontend, escalated) | `<n>` | `<X>` |
| Medium | `<n>` | `<X>` |
| Low | `<n>` | `<X>` |
| **Total** | `<n>` | `<X>` |

Disclose only paid amounts. Unpaid valid findings (e.g., researcher declined payout) are listed in §6 with the row payout column set to `declined`.

If a discretionary uplift above the baseline tier was paid (per [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §2.1), record the sign-off reference from [`STATUS.md`](./STATUS.md) §10 in a footnote.

---

## 6. Per-Finding Public Summaries

A row is added for every confirmed valid finding closed during the window. Critical / High rows are mandatory; Medium / Low rows are recommended.

Withhold the per-finding public summary only when the 90-day disclosure window from [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.4 has not elapsed; in that case, list the row with `Summary: pending coordinated disclosure (target: <YYYY-MM-DD>)`.

| Finding ID | Severity | Component | Invariant(s) | Threat class | Summary | Fix commit / PR | Researcher (handle) | Payout (USDC) |
|------------|----------|-----------|--------------|--------------|---------|------------------|---------------------|---------------|
| `<F-2026-001>` | 🔴 Critical | `<contracts/...>` | `<I1, I5>` | `<T2, T7>` | `<one-paragraph plain-language summary>` | [#<PR>](https://github.com/xlabtg/tonbankcard-protocol/pull/<PR>) | `<@handle or "anonymous on request">` | `<X>` |
| `<F-2026-002>` | 🟠 High | `<api/...>` | — | `<API-2>` | `<…>` | [#<PR>](https://github.com/xlabtg/tonbankcard-protocol/pull/<PR>) | `<…>` | `<X>` |

Researcher attribution policy:

- Public attribution is **default-on** for all paid findings, with the researcher's chosen handle.
- A researcher may opt out via the platform submission form; in that case the row reads `anonymous on request`.
- A researcher may opt out of attribution but still publish their own write-up; we link to it in §11 if shared.

---

## 7. SLA Performance

Numbers are sourced from [`STATUS.md`](./STATUS.md) §7 (SLA tracker) for the reporting window only.

| SLA Metric | Target ([`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §5.3) | Median | p95 | Breaches |
|------------|--------|--------|-----|----------|
| Time to acknowledge | 3 business days | `<…>` | `<…>` | `<n>` |
| Time to severity classification | 7 business days | `<…>` | `<…>` | `<n>` |
| Time to payout (after fix) | 30 days | `<…>` | `<…>` | `<n>` |
| Time to fix — Critical | 90 days (mainnet) / 60 days (testnet) | `<…>` | `<…>` | `<n>` |
| Time to fix — High | 90 days | `<…>` | `<…>` | `<n>` |
| Time to fix — Medium | 120 days | `<…>` | `<…>` | `<n>` |
| Time to fix — Low | 180 days (or `next minor`) | `<…>` | `<…>` | `<n>` |

A breach is any case where the actual time exceeded the target. Each breach must be listed in §9 with rationale and remedial action.

---

## 8. Scope Changes During the Window

List any scope adjustments that took effect during the reporting window. A scope change is anything that adds, removes, or re-bands a component listed in [`PROGRAM_BRIEF.md`](./PROGRAM_BRIEF.md) §3.

| Effective Date | Type | Component | Change | Reference |
|----------------|------|-----------|--------|-----------|
| `<YYYY-MM-DD>` | `Added / Removed / Re-banded` | `<path or domain>` | `<one line>` | [`STATUS.md`](./STATUS.md) §5 row `<…>` |

If no scope changes occurred, write `None.` and skip the table.

---

## 9. Notes, Caveats, and SLA Breaches

Free-form section. Disclose:

- every SLA breach from §7 with: which finding, by how much, why, and the remediation taken;
- any redacted figures from §4–§6 with the rationale and the date the data will become public;
- any program pause / un-pause events with reference to [`STATUS.md`](./STATUS.md) §11 and §13 (change log);
- methodology changes that affect comparability with previous reports (e.g., a re-banding of `sdk/` from frontend tier to off-chain tier).

If there is nothing to disclose, write `Nothing to disclose for this window.`

---

## 10. Internal Editor Notes (REMOVE BEFORE PUBLISHING)

A short checklist for the report author. Delete this section before the report is committed and merged.

- [ ] Every `<…>` placeholder in §2–§9 replaced with concrete value or explicitly marked `none`.
- [ ] Counters in §4 match [`STATUS.md`](./STATUS.md) §6 rows whose `resolution_date` falls inside the reporting window.
- [ ] Payouts in §5 reconcile to the platform's payout log.
- [ ] Each Critical / High row in §6 either has a public summary or a coordinated-disclosure target date.
- [ ] Every SLA breach in §7 has a corresponding entry in §9.
- [ ] Researcher handles in §6 match what each researcher selected on the platform (handle / anonymous / external write-up).
- [ ] Scope-change rows in §8 reference [`STATUS.md`](./STATUS.md) §5 entries that pre-existed this report.
- [ ] §10 deleted.
- [ ] PR for this report links the platform page and the previous quarterly report.

---

## 11. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md) (§6 findings ledger, §7 SLA tracker, §10 discretionary sign-offs)
- [Program brief](./PROGRAM_BRIEF.md) (§2.1 reward bands, §5.3 SLAs, §5.4 disclosure window, §8 transparency)
- [Severity rubric](./SEVERITY_RUBRIC.md)
- [Dry-run plan](./DRY_RUN.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Root security policy](../../../../SECURITY.md)
- [Formal invariants `I1`–`I7`](../../../../audit/INVARIANTS.md)
- [Threat model](../../../../audit/THREAT_MODEL.md)
- [Issue #116](https://github.com/xlabtg/tonbankcard-protocol/issues/116)
