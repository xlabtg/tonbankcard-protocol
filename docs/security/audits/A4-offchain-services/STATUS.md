# Engagement A4 — Status

**Engagement ID:** `A4`
**Issue:** [#115](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Workflow:** [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md)
**Phase:** Engagement preparation — awaiting D4 hardening and firm selection
**Gating verdict:** ⏳ Pending — D4 must land and firm must be selected
**Production deployment of in-scope off-chain services:** ❌ Blocked until verdict = READY (or READY WITH ACCEPTED RISKS)
**Last Updated:** 2026-05-16

---

## 1. Engagement parties

| Role | Identity | Channel |
|------|----------|---------|
| Maintainer (owner) | `@konard` | GitHub issues + private email TBD at kickoff |
| Triage owner | `@konard` | GitHub issues |
| Pentester (firm) | — | TBD |
| Pentester (lead) | — | TBD |
| Application-security lead (pentester side) | — | TBD — required per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1 (web-app pentest depth weighted highest) |
| Supply-chain reviewer (pentester side) | — | TBD — required per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1 (npm dependency review) |
| Staging environment owner | TBD | Provisions isolated staging stack per [`PENTEST_PLAN.md`](./PENTEST_PLAN.md) §1.2 |

Add additional rows as required when the contract is signed.

---

## 2. Upstream gates

Per issue #115 §2 and [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1, A4 should run against the post-D4 hardened state. D5 (npm-audit-in-CI) is recommended so the supply-chain baseline is reproducible.

| Item | Source | Status |
|------|--------|--------|
| D4: Rate limiting merged | [Issue D4](../../../../ISSUE/D4-rate-limiting-ddos-protection.md) | ⏳ Pending — partial baseline from PR [#104](https://github.com/xlabtg/tonbankcard-protocol/pull/104) (Redis limiter) is live |
| D4: API-key authentication merged | [Issue D4](../../../../ISSUE/D4-rate-limiting-ddos-protection.md) | ⏳ Pending — reference scaffold exists in [`api/src/services/ApiKeyService.ts`](../../../../api/src/services/ApiKeyService.ts) |
| D4: HMAC-SHA256 webhook signatures merged | [Issue D4](../../../../ISSUE/D4-rate-limiting-ddos-protection.md) | ⏳ Pending |
| D5: `npm audit` baseline in CI | [Issue D5](../../../../ISSUE/D5-dependency-audit-and-updates.md) | ⏳ Pending |
| CORS allow-list active | PR [#109](https://github.com/xlabtg/tonbankcard-protocol/pull/109) | ✅ Merged |
| Indexer fetch timeout + retry | PR [#108](https://github.com/xlabtg/tonbankcard-protocol/pull/108) | ✅ Merged |
| Indexer keyset pagination | PR [#107](https://github.com/xlabtg/tonbankcard-protocol/pull/107) | ✅ Merged |

The pentester is informed of any unmerged D4 item at kickoff; gaps are either remediated before freeze or documented as known limitations the pentester must explicitly evaluate.

---

## 3. Audited commit

| Field | Value |
|-------|-------|
| Audited commit hash | TBD at kickoff |
| Audited tag | TBD |
| Node.js version | TBD (pin to `.nvmrc` if present) |
| `@tonbankcard/merchant-api` version | `1.0.0` ([`api/package.json`](../../../../api/package.json)) |
| `@tonbankcard/payment-indexer` version | `1.0.0` ([`backend/indexer/package.json`](../../../../backend/indexer/package.json)) |
| `@tonbankcard/merchant-sdk` version | `1.0.0` ([`sdk/package.json`](../../../../sdk/package.json)) |
| Lock-file digests | TBD — capture SHA-256 of all three `package-lock.json` at freeze |
| Staging environment URL | TBD |
| Staging TON network | testnet — TBD which TON HTTP API endpoint |

The audited commit is frozen at kickoff and cannot be modified retroactively. Any change to in-scope off-chain code after that point invalidates the engagement.

The audited commit **should be at or after** the D4 remediation tag so that the pentester reviews the post-hardening surface, not the reference scaffolding.

---

## 4. Phase tracker

| Phase | Owner | Target date | Status |
|-------|-------|-------------|--------|
| 0. D4 hardening (upstream gate) | D4 work track | T-D4 | ⏳ Pending — see §2 |
| 1. Prepare A4 engagement plan | `@konard` | 2026-05-16 | ✅ Done (this directory) |
| 2. Long-list candidate firms | `@konard` | T+1w | ⏳ Pending |
| 3. RFP & shortlist (≤3 firms) | `@konard` | T+1w | ⏳ Pending |
| 4. Proposal evaluation (with web-app / supply-chain weighting) | `@konard` | T+3w | ⏳ Pending |
| 5. Contract signed & kickoff (commit freeze + staging access) | `@konard` | T+4w | ⏳ Pending |
| 6. Pentest execution (with OWASP & npm coverage) | Pentester | T+8w | ⏳ Pending |
| 7. Mid-pentest checkpoint (OWASP walkthrough) | Pentester + `@konard` | T+6w | ⏳ Pending |
| 8. Draft report received | Pentester | T+8w | ⏳ Pending |
| 9. Remediation PRs | `@konard` | T+11w | ⏳ Pending |
| 10. Re-test by pentester | Pentester | T+12w | ⏳ Pending |
| 11. Final report published | `@konard` | T+12w | ⏳ Pending |
| 12. Disclosure (CHANGELOG, public channels) | `@konard` | T+13w | ⏳ Pending |

`T` is the A4 engagement kickoff date and will be filled in once the contract is signed. `T-D4` is the D4 completion date and is outside A4's control.

---

## 5. Firm long list

The following firms are candidates. Scores will be populated once RFPs return. The list intentionally differs from A1/A2 §4–§5 because A4 favours **web-app / supply-chain depth** over Tact/FunC depth.

| Firm | Web-app pentest depth | **Supply-chain / npm depth** | Crypto / fintech context | Methodology | References | Re-test policy | Cost / timeline | Communication | Weighted score | Decision |
|------|-----------------------|------------------------------|--------------------------|-------------|------------|----------------|------------------|----------------|----------------|----------|
| NCC Group | — | — | — | — | — | — | — | — | — | Pending RFP |
| Cure53 | — | — | — | — | — | — | — | — | — | Pending RFP |
| Doyensec | — | — | — | — | — | — | — | — | — | Pending RFP |
| Trail of Bits (apps-security desk) | — | — | — | — | — | — | — | — | — | Pending RFP |
| Halborn (apps division) | — | — | — | — | — | — | — | — | — | Pending RFP |
| OtterSec (web-app desk) | — | — | — | — | — | — | — | — | — | Pending RFP |
| Quarkslab | — | — | — | — | — | — | — | — | — | Pending RFP |
| CertiK (TON desk apps-side) | — | — | — | — | — | — | — | — | — | Pending RFP |
| TonGuard | — | — | — | — | — | — | — | — | — | Pending RFP |
| Veridise (apps-side) | — | — | — | — | — | — | — | — | — | Pending RFP |

Weights and scoring rubric are defined in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.1.

### 5.1 Conflict-of-interest disclosures

| Firm | Discloses TBC / NFT holdings? | Prior engagement? | Vendor financial interest (webhook / observability)? | Other COI | Status |
|------|-------------------------------|---------------------|------------------------------------------------------|-----------|--------|
| — | — | — | — | — | Pending RFP |

If the same firm performed A1 or A2, an additional disclosure line must record whether A4 findings were re-derived independently or carried over from the smart-contract review (per [`ENGAGEMENT.md`](./ENGAGEMENT.md) §6.2).

---

## 6. Findings ledger

Populated after the pentester's draft report is received. Severity values follow [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) §2. The "Threat ref" column links each finding back to the threat IDs in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4 (API-, IDX-, SDK-, OFF-). The "OWASP" column links to the OWASP Top 10 category from [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) where applicable.

| Finding ID | Severity | Title | Component | Threat ref | OWASP | GitHub issue | PR | Status | Notes |
|------------|----------|-------|-----------|------------|-------|--------------|----|--------|-------|
| _no findings yet — pentest not started_ | — | — | — | — | — | — | — | — | — |

---

## 7. OWASP Top 10:2021 coverage matrix

Populated by the pentester at the mid-pentest checkpoint (T+6w) and finalised in the report. The mapping below is initialised from [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) §3 and updated in place; do not duplicate rationale here.

| Category | Status | Notes |
|----------|--------|-------|
| A01 — Broken Access Control | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a01) |
| A02 — Cryptographic Failures | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a02) |
| A03 — Injection | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a03) |
| A04 — Insecure Design | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a04) |
| A05 — Security Misconfiguration | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a05) |
| A06 — Vulnerable and Outdated Components | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a06) |
| A07 — Identification and Authentication Failures | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a07) |
| A08 — Software and Data Integrity Failures | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a08) |
| A09 — Security Logging and Monitoring Failures | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a09) |
| A10 — Server-Side Request Forgery (SSRF) | ⏳ Pending | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md#a10) |

---

## 8. Accepted risks

Populated only when High / Medium findings are not remediated. Each row requires maintainer sign-off plus one independent reviewer for High severity.

| Finding ID | Severity | Rationale | Compensating control | Sign-off | Date |
|------------|----------|-----------|----------------------|----------|------|
| _none_ | — | — | — | — | — |

Any entry here must be mirrored in [`docs/audit-notes.md`](../../../audit-notes.md) per workflow §3.4.

---

## 9. Artifacts

| Artifact | Path | SHA-256 | Notes |
|----------|------|---------|-------|
| Engagement plan | [`ENGAGEMENT.md`](./ENGAGEMENT.md) | — | This engagement |
| OWASP checklist | [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) | — | Required coverage |
| Pentest plan | [`PENTEST_PLAN.md`](./PENTEST_PLAN.md) | — | Test cases & PoC expectations |
| `api/` package-lock at freeze | _pending freeze_ | — | Capture `api/package-lock.json` digest |
| `backend/indexer/` package-lock at freeze | _pending freeze_ | — | Capture `backend/indexer/package-lock.json` digest |
| `sdk/` package-lock at freeze | [`sdk/package-lock.json`](../../../../sdk/package-lock.json) | _pending freeze_ | Already present; record SHA-256 at kickoff |
| `npm audit --json` baseline (sdk) | _pending_ | — | Save as `npm-audit-sdk-v0.json` |
| `npm audit --json` baseline (api) | _pending_ | — | Save as `npm-audit-api-v0.json` |
| `npm audit --json` baseline (indexer) | _pending_ | — | Save as `npm-audit-indexer-v0.json` |
| Staging environment access record | _pending_ | — | Stored as `staging-access-v0.md` (NDA gated) |
| Draft report | _pending_ | — | Save as `report-v0-draft.pdf` |
| Final report | _pending_ | — | Save as `report-v1-final.pdf` |
| Re-test letter | _pending_ | — | Save as `retest-v1.pdf` |
| Replay-protection memo | _pending_ | — | Optional dedicated webhook-replay analysis |
| PoC bundle (curl / scripts) | _pending_ | — | Save as `pocs-v1.tar.gz` (NDA gated for any sensitive artefacts) |

The SHA-256 column is filled in immediately after intake per workflow §3.1.

---

## 10. Acceptance criteria progress

Mirrors issue #115 §7.

- [ ] Pentest scope agreed with security team and tested against staging environment
- [ ] All Critical findings remediated before production launch
- [ ] All High findings remediated or formally accepted
- [ ] OWASP Top 10 checklist completed for `api/`
- [ ] `npm audit` shows zero high/critical vulnerabilities in `sdk/`
- [ ] Webhook signature verification confirmed resistant to replay attacks
- [ ] Pentest report published in `docs/security/audits/A4-offchain-services/`
- [ ] Remediation PR(s) merged and re-tested

---

## 11. Open questions / blockers

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-1 | D4 completion timeline — gate for kickoff per §2 | `@konard` | Open |
| Q-2 | Whether HMAC-SHA256 webhook scheme will land with timestamp + monotonic nonce (required for API-3 replay test) | `@konard` | Open |
| Q-3 | Final selection of pentest firm | `@konard` | Open |
| Q-4 | Budget envelope and funding source for A4 | `@konard` | Open |
| Q-5 | Calendar window for pentest (T+4w → T+12w) | `@konard` | Open |
| Q-6 | Staging environment provisioning: who runs it, how production-shaped, throwaway API keys lifecycle | `@konard` | Open |
| Q-7 | Whether `InMemoryStorage` and `InMemoryIdempotencyStorage` reference adapters are removed before freeze, or remain as documented reference-only (any consumer mis-configuration is a finding) | `@konard` | Open |
| Q-8 | Whether SDK ships with bundled `mock.ts` or whether bundling excludes it (SDK-7 test depends on this) | `@konard` | Open |
| Q-9 | Disclosure decision: full report vs. summary + redacted appendix if pentester surfaces sensitive staging-infrastructure detail | `@konard` | Open |
| Q-10 | Whether A4 also covers the `backend/adapters/` lending adapter scaffolding, or that surface is deferred to a later engagement | `@konard` | Open |

Add new rows as blockers are discovered. Close rows by linking the resolving issue / commit.

---

## 12. Disclosure decisions

Recorded ahead of report publication. Defaults to "full publish unless redaction is requested by the pentester for safety reasons".

| Question | Decision | Rationale | Date |
|----------|----------|-----------|------|
| Publish full final report? | TBD | — | — |
| Publish all PoC scripts? | TBD | — | — |
| Stage public summary on the project blog? | TBD | — | — |

---

## 13. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-16 | Initial engagement plan committed (this file, `ENGAGEMENT.md`, `OWASP_CHECKLIST.md`, `PENTEST_PLAN.md`) | `@konard` |
