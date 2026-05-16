# Engagement A4 — Penetration Test of Off-Chain Services

**Engagement ID:** `A4`
**Issue:** [#115 — A4 Penetration Testing — Off-Chain Services](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
**Roadmap track:** A — Security & Audit
**Status:** Engagement preparation complete — awaiting D4 hardening and firm selection
**Maintainer:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Objective

Commission an **independent third-party penetration test** of the TONBANKCARD off-chain services — the Merchant API (`api/`), the Payment Status Indexer (`backend/indexer/`), and the Merchant SDK (`sdk/`) — focusing on OWASP Top 10, authentication weaknesses, data integrity, replay protection, and supply-chain risks.

Per issue #115 §2, this engagement **should be conducted after Track D rate-limiting and webhook hardening (D4) lands**, so that the test exercises the production-grade hardened surface rather than the reference scaffolding currently in the repository. Engagements A1 (core contracts) and A2 (Phase 4 contracts) cover the on-chain surface and are out of scope here; this engagement is the matching off-chain counterpart and is a mandatory gate before mainnet exposure of the merchant-facing services.

Success criteria (mirror of issue #115 acceptance criteria):

- [ ] Pentest scope agreed with the security team and tested against a representative staging environment
- [ ] D4 rate-limiting, API-key authentication, and HMAC-SHA256 webhook signature work landed in the audited commit (or the residual gap is documented as a known limitation)
- [ ] All Critical findings remediated before any production launch
- [ ] All High findings remediated or formally accepted in [`STATUS.md`](./STATUS.md)
- [ ] OWASP Top 10 checklist (see [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md)) completed for `api/`
- [ ] `npm audit` reports zero High / Critical vulnerabilities in the `sdk/` dependency tree at the audited commit
- [ ] Webhook signature verification confirmed resistant to replay attacks
- [ ] Pentest report published in this directory (`docs/security/audits/A4-offchain-services/`)
- [ ] Remediation PR(s) merged and re-tested by the pentester
- [ ] [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) updated with the completion status

---

## 2. In-Scope Components

The pentest covers exactly the three off-chain packages enumerated in issue #115 §3.

### 2.1 Merchant API — `api/` (`@tonbankcard/merchant-api` v1.0.0)

| Surface | Location | Notes |
|---------|----------|-------|
| REST endpoints | [`api/src/routes/invoiceRoutes.ts`](../../../../api/src/routes/invoiceRoutes.ts) | Specification: [`docs/merchant-api-spec.md`](../../../merchant-api-spec.md) |
| Invoice service | [`api/src/services/InvoiceService.ts`](../../../../api/src/services/InvoiceService.ts) | Stateless invoice lifecycle |
| API key service | [`api/src/services/ApiKeyService.ts`](../../../../api/src/services/ApiKeyService.ts) | Authentication & scope enforcement |
| Storage adapters | [`api/src/storage/`](../../../../api/src/storage/) | `InMemoryStorage`, `PostgresStorage`, `RedisIdempotencyStorage` |
| Input validation | [`api/src/utils/validation.ts`](../../../../api/src/utils/validation.ts) | TON addresses, NFT whitelist, amounts, metadata |
| Helpers | [`api/src/utils/helpers.ts`](../../../../api/src/utils/helpers.ts) | Idempotency keys, payment URLs |
| Existing tests | [`api/tests/`](../../../../api/tests/) | Baseline coverage |
| Security guidance | [`docs/merchant-api-security.md`](../../../merchant-api-security.md) | Documented expectations |

### 2.2 Payment Status Indexer — `backend/indexer/` (`@tonbankcard/payment-indexer` v1.0.0)

| Surface | Location | Notes |
|---------|----------|-------|
| Express API | [`backend/indexer/src/api/server.ts`](../../../../backend/indexer/src/api/server.ts), [`routes.ts`](../../../../backend/indexer/src/api/routes.ts) | `/health`, `/payment/:id`, account history |
| Indexer service | [`backend/indexer/src/services/`](../../../../backend/indexer/src/services/) | Blockchain event ingestion pipeline |
| Event parsers | [`backend/indexer/src/parsers/`](../../../../backend/indexer/src/parsers/) | TON message → payment event translation |
| Database layer | [`backend/indexer/src/db/`](../../../../backend/indexer/src/db/) | SQLite (default) / PostgreSQL |
| Configuration | [`backend/indexer/src/types/config.ts`](../../../../backend/indexer/src/types/config.ts) | Environment variables, TON HTTP API key |
| Existing tests | [`backend/indexer/tests/`](../../../../backend/indexer/tests/) | Baseline coverage |

### 2.3 Merchant SDK — `sdk/` (`@tonbankcard/merchant-sdk` v1.0.0)

| Surface | Location | Notes |
|---------|----------|-------|
| Public entry | [`sdk/src/index.ts`](../../../../sdk/src/index.ts), [`sdk.ts`](../../../../sdk/src/sdk.ts) | Top-level TypeScript API |
| Browser widget | [`sdk/src/widget/PaymentWidget.ts`](../../../../sdk/src/widget/PaymentWidget.ts) | DOM rendering, deep-link generation |
| Type definitions | [`sdk/src/types.ts`](../../../../sdk/src/types.ts) | Public types — supply-chain consumers |
| Mock helpers | [`sdk/src/mock.ts`](../../../../sdk/src/mock.ts) | Verify mocks cannot be mistaken for real wallet flow |
| Examples | [`sdk/examples/`](../../../../sdk/examples/) | Integration patterns published to merchants |
| Dependency tree | [`sdk/package.json`](../../../../sdk/package.json), [`sdk/package-lock.json`](../../../../sdk/package-lock.json) | Supply chain — `npm audit` baseline |
| Existing security doc | [`sdk/SECURITY.md`](../../../../sdk/SECURITY.md) | Documented non-custodial guarantees |

Supporting documents (read-only context):

- [`docs/merchant-api-spec.md`](../../../merchant-api-spec.md) — protocol contract the API must implement
- [`docs/merchant-api-security.md`](../../../merchant-api-security.md) — pre-existing security architecture
- [`docs/security/THREAT_MODEL.md`](../../THREAT_MODEL.md) — protocol-level threat model
- [`docs/audit-notes.md`](../../../audit-notes.md) — known accepted limitations

---

## 3. Out of Scope

Explicitly **not** part of this engagement (per issue #115 §4):

- **Smart contracts** (`contracts/`) — covered by engagements [A1](../A1-core-contracts/ENGAGEMENT.md) and [A2](../A2-phase4-contracts/ENGAGEMENT.md)
- **Formal verification** of invariants I1–I7 — covered by [A3](https://github.com/xlabtg/tonbankcard-protocol/pull/146)
- **Third-party payment gateways** (ChangeNOW, NOWPayments, CoinRabbit) — security is the responsibility of those providers; their security claims are recorded as trust assumptions only
- **Private key storage** — the system must not store private keys off-chain at all; verifying that no such storage exists is a **correctness check**, not a pentest target
- **Wallet UI / mobile / dashboard** (`wallet-ui/`, `mobile/`, `dashboard/`) — separate review tracks (Track F UX)
- **Bug bounty operational tooling** — covered by [A5](https://github.com/xlabtg/tonbankcard-protocol/issues/) (separate engagement)
- **Underlying cloud infrastructure** (Kubernetes nodes, managed Postgres, Redis) — operator responsibility, exercised only insofar as it affects the application surface

External pre-deployed components (TBC jetton, TON public HTTP API, indexer's upstream `@ton/ton` client) are treated as trust assumptions; their security is referenced from [`audit/SCOPE.md`](../../../../audit/SCOPE.md) §"Out-of-Scope Components".

---

## 4. Threat Model — Required Coverage

The pentester must explicitly evaluate every threat enumerated below, mapped to the protocol-level threat model in [`docs/security/THREAT_MODEL.md`](../../THREAT_MODEL.md) and the off-chain security guidance in [`docs/merchant-api-security.md`](../../../merchant-api-security.md). Each row maps a threat to file/line evidence so the auditor can begin work without a discovery phase.

The detailed test plan that operationalises this table is [`PENTEST_PLAN.md`](./PENTEST_PLAN.md); the OWASP Top 10 surface is recorded in [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md).

### 4.1 Merchant API (`api/`)

| # | Threat | Where to look |
|---|--------|---------------|
| API-1 | **Unauthenticated invoice manipulation** — creating, listing, or cancelling invoices without a valid API key | `apiKeyService.requireScope` callers in [`api/src/routes/invoiceRoutes.ts`](../../../../api/src/routes/invoiceRoutes.ts); confirm every mutating endpoint checks scope before doing work |
| API-2 | **IDOR (Insecure Direct Object Reference)** — accessing another merchant's invoices by guessing the 32-char invoice ID | [`api/src/services/InvoiceService.ts`](../../../../api/src/services/InvoiceService.ts) `getInvoice` / `getInvoiceStatus`; verify ownership is enforced on every read |
| API-3 | **Webhook replay** — replaying old webhook events to credit payments twice (post-D4 the HMAC-SHA256 signature scheme must include a monotonic nonce + timestamp window) | Webhook generator & verifier hand-off; replay-window test must fail (see [`PENTEST_PLAN.md`](./PENTEST_PLAN.md) §3.3) |
| API-4 | **CORS misconfiguration** — cross-origin requests from arbitrary domains carrying API-key credentials | Confirm PR #109 mitigation (`Access-Control-Allow-Origin` allow-list) is in effect; no `*` with credentials |
| API-5 | **Rate-limit bypass** — flooding invoice creation to exhaust quota or cause DoS by spoofing `X-Forwarded-For` / `CF-Connecting-IP` | `getClientIp` extraction logic (Redis-backed limiter from PR #104); confirm proxy trust is bounded |
| API-6 | **SQL injection** — malformed inputs reaching `PostgresStorage` queries | [`api/src/storage/PostgresStorage.ts`](../../../../api/src/storage/PostgresStorage.ts); verify all queries are parameterised, no string concatenation |
| API-7 | **Path traversal** — accessing files outside intended directories via static-asset / log endpoints (none today; ensure none are introduced) | Express `static` middleware audit; default-deny posture |
| API-8 | **Idempotency-key abuse** — predicting or colliding idempotency keys to steal another merchant's pending invoice | [`api/src/utils/helpers.ts`](../../../../api/src/utils/helpers.ts) `generateIdempotencyKey`; entropy and storage scoping |
| API-9 | **Metadata injection / XSS via API response** — merchant-supplied metadata rendered unsanitised by downstream UIs | `sanitizeMetadata` in [`api/src/utils/helpers.ts`](../../../../api/src/utils/helpers.ts); confirm canonical sanitisation |
| API-10 | **TLS / transport stripping** — downgrade attacks on the API endpoint | Deployment defaults; HSTS posture per [`docs/merchant-api-security.md`](../../../merchant-api-security.md) §9 |

### 4.2 Indexer (`backend/indexer/`)

| # | Threat | Where to look |
|---|--------|---------------|
| IDX-1 | **Data-integrity tampering** — injecting fraudulent payment records into the local cache via a malicious upstream | [`backend/indexer/src/parsers/`](../../../../backend/indexer/src/parsers/), `IndexerService.ingestBlock`; verify on-chain hash provenance is preserved |
| IDX-2 | **Unauthenticated API exposure** — indexer internal endpoints reachable from the public internet without an auth boundary | `/health`, `/payment/:id` in [`backend/indexer/src/api/routes.ts`](../../../../backend/indexer/src/api/routes.ts); confirm deployment binds to internal interface or fronts with auth |
| IDX-3 | **Replay attack** — processing the same blockchain event twice (double-credit) | Event de-duplication keys in `db/database.ts`; idempotency over `(tx_hash, lt)` |
| IDX-4 | **TON HTTP API trust** — accepting tampered data from a malicious or compromised TON HTTP API endpoint | Indexer's TON client configuration; verify response signature checks where the protocol allows, and document residual trust |
| IDX-5 | **Rate-limit / DoS** — flooding the indexer's read API to starve legitimate merchants | `RateLimiterRedis` configuration in [`server.ts`](../../../../backend/indexer/src/api/server.ts); confirm production tuning, not memory-only fallback |
| IDX-6 | **Log / config secret exposure** — TON API key, DB credentials leaking via verbose error responses or structured logs | Pino redaction config; confirm `tonApiKey: '***'` redaction holds for all log sites |
| IDX-7 | **SQL injection** — same class as API-6, applied to the indexer's SQLite/PostgreSQL queries | `db/database.ts` query construction |
| IDX-8 | **Account-history pagination abuse** — keyset pagination from PR #107 must not leak entries across accounts or skip events | Re-verify cursors include account binding |

### 4.3 SDK (`sdk/`)

| # | Threat | Where to look |
|---|--------|---------------|
| SDK-1 | **Supply-chain compromise** — malicious or yanked transitive dependency reaching consumers | `sdk/package.json`, `sdk/package-lock.json`; `npm audit` baseline at the audited commit |
| SDK-2 | **Dependency pinning drift** — `^` / `>=` ranges allowing post-publication upgrades that ship unaudited code | Verify lock-file integrity; recommend exact-pinning or `npm shrinkwrap` |
| SDK-3 | **XSS in payment widget** — user-controlled inputs (description, orderId, returnUrl) rendered unsafely in the widget DOM | [`sdk/src/widget/PaymentWidget.ts`](../../../../sdk/src/widget/PaymentWidget.ts) `mount` / `render`; confirm DOM API usage (no `innerHTML` with untrusted strings) |
| SDK-4 | **Sensitive-data leakage** — API keys or merchant secrets exposed via browser DevTools, `console.log`, or error callbacks | SDK's `onError` callback contract; verify no credential echo in error payloads |
| SDK-5 | **Clickjacking** — embedding the widget in a malicious framing context to harvest deep-link clicks | Widget framing policy — `X-Frame-Options` guidance for merchant integrators, `sandbox` attributes when iframed |
| SDK-6 | **Deep-link tampering** — TON Connect deep links altered between SDK generation and wallet handoff | Confirm deep links carry on-chain-verifiable parameters only (NFT address, amount, comment); no off-chain trust |
| SDK-7 | **Mock-vs-real flow confusion** — `sdk/src/mock.ts` accidentally shipped in production bundles, masking real settlement failures | Bundling configuration in [`sdk/package.json`](../../../../sdk/package.json) `tsup` setup; tree-shaking guards |
| SDK-8 | **Type-confusion attacks via published `.d.ts`** — relaxed types allowing unsafe merchant code paths | Published types in `dist/index.d.ts`; verify they match documented contract |

### 4.4 Cross-cutting

| # | Threat | Coverage |
|---|--------|----------|
| OFF-1 | **Non-custody verification** — none of the off-chain components stores private keys, signs transactions, or moves funds | Verified across `api/`, `backend/indexer/`, `sdk/`; cross-check against documented guarantees in [`docs/merchant-api-security.md`](../../../merchant-api-security.md) §2 |
| OFF-2 | **Secret management** — environment variables (`TON_API_KEY`, DB credentials, webhook signing secret) never logged, never sent to the client | All three packages |
| OFF-3 | **Defaults are secure** — out-of-the-box configuration (no overrides) is safe to deploy to a production-shaped environment | All three packages |
| OFF-4 | **Telemetry & observability privacy** — no PII or transaction-tying identifiers exported to third-party observability services without explicit opt-in | Pino logger configurations, SDK callback wiring |
| OFF-5 | **OWASP Top 10:2021** — every A0x category explicitly visited for `api/` | See [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) |

Invariant attestation in the final report must confirm that **I1 (Non-Custodial)** and **I3 (No Admin Fund Control)** remain intact end-to-end through the off-chain surface — i.e., no off-chain bug should allow a privileged operator to move user funds. Full invariant definitions: [`audit/INVARIANTS.md`](../../../../audit/INVARIANTS.md).

---

## 5. Audit Package (Frozen Hand-off)

The protocol team will deliver the following package to the selected firm at engagement kickoff. The audited commit is frozen at the kickoff and recorded in [`STATUS.md`](./STATUS.md) §"Audited commit".

| Artifact | Location | Notes |
|----------|----------|-------|
| Audit intro pack | [`docs/audit/external-audit-intro.md`](../../../audit/external-audit-intro.md) | Protocol intent, trust model, intentional design constraints |
| Protocol-wide scope | [`audit/SCOPE.md`](../../../../audit/SCOPE.md) | Defines what is in / out of scope at the protocol level |
| Threat model (protocol-wide) | [`docs/security/THREAT_MODEL.md`](../../THREAT_MODEL.md) | T1–T8 attack classes with mitigations |
| Threat model (engagement-specific) | This document §4 | API-, IDX-, SDK-, OFF- threats |
| OWASP Top 10 checklist | [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) | Required category-by-category coverage for `api/` |
| Pentest plan | [`PENTEST_PLAN.md`](./PENTEST_PLAN.md) | Detailed per-component test cases and PoC expectations |
| Merchant API specification | [`docs/merchant-api-spec.md`](../../../merchant-api-spec.md) | Authoritative API contract |
| Merchant API security architecture | [`docs/merchant-api-security.md`](../../../merchant-api-security.md) | Documented expectations to verify against |
| SDK security guarantees | [`sdk/SECURITY.md`](../../../../sdk/SECURITY.md) | Non-custody claims to verify |
| SDK reproducible build | [`sdk/VERIFICATION.md`](../../../../sdk/VERIFICATION.md) | How to rebuild the published bundle |
| Build & run instructions | `api/README.md`, `backend/indexer/README.md`, `sdk/README.md` | Per-package developer setup |
| Existing test suites | `api/tests/`, `backend/indexer/tests/`, `sdk/tests/` | Baseline regression coverage |
| Internal pre-existing fixes | PR [#104](https://github.com/xlabtg/tonbankcard-protocol/pull/104) (Redis rate limiting), [#107](https://github.com/xlabtg/tonbankcard-protocol/pull/107) (indexer pagination), [#108](https://github.com/xlabtg/tonbankcard-protocol/pull/108) (indexer fetch retries), [#109](https://github.com/xlabtg/tonbankcard-protocol/pull/109) (CORS allow-list) | Mitigations already merged — starting baseline, not ending state |
| Audit readiness | [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) | Entry-point navigation document |
| Audit notes | [`docs/audit-notes.md`](../../../audit-notes.md) | Known accepted limitations |
| D4 hardening outputs (upstream gate) | Issue D4 PR(s) — TBD | Rate limiting + HMAC-SHA256 webhooks + API-key authentication |
| D5 dependency audit | Issue D5 PR(s) — TBD | `npm audit` baseline in CI |

The pentester receives **read access** to the public GitHub repository at the frozen commit, plus a representative **staging environment** (URL, isolated TON testnet endpoint, throwaway API keys with the same scopes the production service issues, an SDK consumer harness). Production-only secrets are never shared with the pentester.

---

## 6. Candidate Firms

Three firm classes are acceptable per the roadmap and issue #115:

1. **Application-security pentest specialists with cryptocurrency / fintech experience**, e.g., NCC Group, Cure53, Doyensec, Trail of Bits (apps-security desk).
2. **Web3-native pentest teams with web-app coverage**, e.g., Halborn (apps division), OtterSec (web-app desk), Sigma Prime (apps-side), Quarkslab.
3. **TON / non-EVM ecosystem specialists with apps-security capability**, e.g., CertiK (TON desk apps-side), TonGuard, scalebit (TON), Veridise (apps-side).

A non-exhaustive long list is maintained in [`STATUS.md`](./STATUS.md) §"Firm long list".

For A4 specifically, **web-app pentest depth and supply-chain experience** weigh higher than for A1/A2 — firms with a demonstrated track record running OWASP-driven engagements, plus npm / JavaScript ecosystem supply-chain reviews, should be preferred. This is reflected in the evaluation matrix below.

A firm that performed A1 or A2 may also bid for A4 only on a **separately signed scope** — code-level smart-contract expertise is not the same as app-layer pentest expertise, and bundling discourages cross-checking.

### 6.1 Evaluation Matrix

Each shortlisted firm is scored on the following criteria. Numeric scores 1–5 (5 = excellent). Final score = weighted sum. Compared to A1/A2, weights are re-balanced to emphasise application-security depth and supply-chain coverage over Tact/FunC depth.

| Criterion | Weight | Notes |
|-----------|--------|-------|
| **Web-app / API pentest depth** | **25%** | OWASP engagements run per year, OSCP / OSWE / GWAPT credentials on team |
| **Supply-chain / npm review experience** | **15%** | Prior public engagements on JavaScript dependency trees, SBOM review |
| Crypto / fintech context | 15% | Familiarity with merchant-payments flows, webhook design, replay-protection idioms |
| Methodology rigor | 15% | Documented testing methodology, manual review hours per endpoint, fuzzing tools |
| Reputation & references | 10% | Publicly available pentest reports, ecosystem feedback |
| Re-test / remediation policy | 10% | Verified re-test included after remediation, follow-up support |
| Cost & timeline fit | 5% | Total cost, calendar window, latest available start |
| Communication & transparency | 5% | Daily stand-up cadence, willingness to publish, NDA flexibility |

### 6.2 Conflict-of-interest screen

Firms must disclose any prior engagement with TONBANKCARD operators, TON Foundation grant overlap, holding of TBC token / TBC Diamonds / Series 7777/8888 NFTs, financial interest in any candidate webhook-delivery / observability vendor used by the protocol, or other potential conflicts. Disqualifying conditions are recorded in [`STATUS.md`](./STATUS.md).

A firm that audited A1 or A2 must additionally disclose whether A4 findings were re-derived independently or carry over from the smart-contract engagement; the A4 report must produce an independent assessment of the off-chain surface regardless of overlap.

---

## 7. Engagement Process

```
T-D4  D4 rate-limiting + webhook + API-key hardening merged              (gate)
T-D5  D5 npm-audit-in-CI merged                                          (recommended gate)
T-0   A4 issue published                                                 ✅
T+0   Firm long list assembled                                           ⏳
T+1w  Shortlist (3 firms) + RFP sent
T+3w  Proposals received, evaluation matrix populated
T+4w  Firm selected, contract signed
T+4w  Pentest kickoff: freeze commit + package handover + staging access
T+6w  Mid-pentest checkpoint (preliminary findings, OWASP coverage walk-through)
T+8w  Draft report delivered
T+9w  Remediation PRs opened (per REMEDIATION_WORKFLOW.md)
T+11w Remediation merged
T+12w Re-testing by pentester against remediation commit
T+12w Final report published in this directory
T+12w STATUS.md flipped to COMPLETED
T+13w Disclosure summary in CHANGELOG.md + public channels
```

All dates are anchored to the A4 kickoff (`T`) and tracked in [`STATUS.md`](./STATUS.md). `T-D4` and `T-D5` are not under A4's control; they are upstream completion gates for the hardening work that A4 is designed to validate.

A4 is intentionally shorter than A1/A2 (12 weeks total versus 14–16) because the off-chain surface is smaller in lines-of-code and the scope is well-bounded by the three packages. The mid-pentest checkpoint at T+6w explicitly walks through the OWASP Top 10 coverage matrix from [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md) so any uncovered class is escalated early.

The remediation phase follows [`../REMEDIATION_WORKFLOW.md`](../REMEDIATION_WORKFLOW.md) verbatim.

---

## 8. Deliverables From Pentester

The signed engagement must require the following deliverables (mirrored in the report template):

1. **Pentest report**, structured per [`../REPORT_TEMPLATE.md`](../REPORT_TEMPLATE.md), adapted for an off-chain pentest:
   - Findings categorised by severity (Critical / High / Medium / Low / Informational)
   - Each finding references file:line (or HTTP method + path), threat-model class (API-, IDX-, SDK-, OFF-), and OWASP Top 10 category where applicable
   - Reproduction steps for every Critical and High (HTTP request capture or scripted PoC)
   - Suggested fixes where applicable
   - **OWASP Top 10:2021 coverage table** — every A01–A10 category marked as Tested / Not applicable / Out of scope with rationale; the table must mirror [`OWASP_CHECKLIST.md`](./OWASP_CHECKLIST.md)
   - Explicit attestation that **I1** and **I3** invariants remain intact through the off-chain surface
   - **Supply-chain section** for `sdk/`: dependency tree summary, `npm audit` output at the audited commit, pinning recommendations
   - **Webhook replay analysis**: explicit confirmation that the post-D4 HMAC-SHA256 + nonce / timestamp window scheme cannot be replayed within the documented validity window
2. **Reproducible PoCs** for every Critical and High finding — provided as curl scripts, Postman collections, or short Node scripts. PoCs must run against the staging environment without modification.
3. **Re-test letter** signed after remediation against a specific commit hash, confirming whether each finding is Fixed / Mitigated / Accepted / Unresolved.
4. **Right to publish** the report in this repository (full report, or summary + redacted appendix if any sensitive infrastructure details require omission — the decision is documented in [`STATUS.md`](./STATUS.md) §"Disclosure decisions").

If any component is recommended for **redesign or removal** (e.g., the reference-only in-memory adapters in `api/src/storage/InMemoryStorage.ts`), the pentester's recommendation must be explicit — the protocol team will not interpret silence as approval.

---

## 9. Acceptance / Gating Decision

The engagement is closed when:

- All ten checkboxes in §1 are ticked.
- [`STATUS.md`](./STATUS.md) records the gating verdict as `READY` or `READY WITH ACCEPTED RISKS`.
- [`docs/security/AUDIT_READINESS.md`](../../AUDIT_READINESS.md) §"Audit completion status" is updated with the A4 row populated.
- `CHANGELOG.md` carries a disclosure entry referencing the report.

A verdict of `BLOCKED` keeps **production deployment of the merchant-facing off-chain surface** paused per [`../README.md`](../README.md) §4 and blocks the related Track B (production deployment) and Track C (developer-experience launches) work from going public-facing.

---

## 10. References

- [Issue #115](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
- [Issue #112 (A1)](https://github.com/xlabtg/tonbankcard-protocol/issues/112), [A1 engagement](../A1-core-contracts/ENGAGEMENT.md)
- [Issue #113 (A2)](https://github.com/xlabtg/tonbankcard-protocol/issues/113), [A2 engagement](../A2-phase4-contracts/ENGAGEMENT.md)
- [A3 — Formal Verification PR #146](https://github.com/xlabtg/tonbankcard-protocol/pull/146)
- [Audits index](../README.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Report template](../REPORT_TEMPLATE.md)
- [Engagement status](./STATUS.md)
- [OWASP checklist](./OWASP_CHECKLIST.md)
- [Pentest plan](./PENTEST_PLAN.md)
- [Audit Readiness](../../AUDIT_READINESS.md)
- [Merchant API specification](../../../merchant-api-spec.md)
- [Merchant API security architecture](../../../merchant-api-security.md)
- [Protocol Threat Model](../../THREAT_MODEL.md)
- [Formal Invariants](../../../../audit/INVARIANTS.md)
- [Security Policy](../../../../SECURITY.md)
- [Development Roadmap — Track A, A4](../../../../TEMP/DEVELOPMENT_ROADMAP.md)
- OWASP Top 10:2021 — https://owasp.org/Top10/
- OWASP API Security Top 10:2023 — https://owasp.org/API-Security/editions/2023/en/0x00-header/
- OWASP ASVS v4.0.3 — https://owasp.org/www-project-application-security-verification-standard/
- [`api/`](../../../../api/), [`backend/indexer/`](../../../../backend/indexer/), [`sdk/`](../../../../sdk/)
