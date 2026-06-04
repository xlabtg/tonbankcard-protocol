# A4 — OWASP Top 10:2021 Coverage Checklist

**Engagement ID:** `A4`
**Issue:** [#115](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
**Plan:** [`ENGAGEMENT.md`](./ENGAGEMENT.md)
**Status:** Awaiting pentest execution
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document operationalises the OWASP Top 10:2021 coverage requirement from issue #115 §7. It enumerates, for each Top 10 category:

- the **TONBANKCARD off-chain surface** that maps to the category,
- the **threat IDs** from [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4 (API-, IDX-, SDK-, OFF-) that the pentester must exercise,
- the **must-do tests** (minimum bar), and
- the **evidence the pentester must record** in the final report.

The pentester populates the Status column at the mid-pentest checkpoint (T+6w) and finalises it in the report. Status values: `pass`, `pass-with-notes`, `fail`, `n/a`, `out-of-scope` (with rationale).

The categories below follow OWASP Top 10:2021 — https://owasp.org/Top10/. The companion **OWASP API Security Top 10:2023** (https://owasp.org/API-Security/editions/2023/en/0x00-header/) is referenced inline where it adds API-specific guidance not covered by the application Top 10.

---

## 2. How to use this checklist

For each category section below:

1. Read the **In-scope surface** to know which files / endpoints / packages are being evaluated.
2. Run every item in **Required tests**. None is optional.
3. Record the outcome in **Findings & evidence** with: status, finding ID(s) if any, link to PoC, and a one-line rationale.
4. Cross-reference any finding into [`STATUS.md`](./STATUS.md) §6 (Findings ledger) with the matching `OWASP` column entry.

If a category is genuinely **not applicable**, mark it `n/a` with a one-line rationale; if it is **out of scope** (e.g., the test target lives in the smart contracts or in operator-controlled infrastructure), mark it `out-of-scope` and link to the engagement that covers it.

---

## 3. Coverage matrix (summary)

| Category | In-scope surface | Required tests | Status |
|----------|------------------|----------------|--------|
| [A01 — Broken Access Control](#a01) | `api/` routes, indexer endpoints | API-1, API-2, IDX-2 | ⏳ Pending |
| [A02 — Cryptographic Failures](#a02) | Webhook HMAC (D4), API keys, TLS posture | API-3, API-10, OFF-2 | ⏳ Pending |
| [A03 — Injection](#a03) | `PostgresStorage`, validation utils, SDK widget DOM | API-6, IDX-7, SDK-3 | ⏳ Pending |
| [A04 — Insecure Design](#a04) | Non-custody architecture, idempotency, rate-limit design | API-8, IDX-1, OFF-1 | ⏳ Pending |
| [A05 — Security Misconfiguration](#a05) | CORS, headers, Express defaults, error verbosity | API-4, IDX-6, OFF-3 | ⏳ Pending |
| [A06 — Vulnerable and Outdated Components](#a06) | `npm audit` for all three packages | SDK-1, SDK-2 | ⏳ Pending |
| [A07 — Identification and Authentication Failures](#a07) | API key issuance, scope enforcement, indexer auth | API-1, API-8, IDX-2 | ⏳ Pending |
| [A08 — Software and Data Integrity Failures](#a08) | Lock-file integrity, build provenance, SDK bundles | SDK-1, SDK-2, SDK-7 | ⏳ Pending |
| [A09 — Security Logging and Monitoring Failures](#a09) | Pino redaction, secret echo, audit-trail completeness | IDX-6, OFF-2, OFF-4 | ⏳ Pending |
| [A10 — Server-Side Request Forgery (SSRF)](#a10) | Indexer's outbound TON HTTP API calls; webhook delivery | IDX-4, API-3 (post-D4 outbound webhook) | ⏳ Pending |

---

## A01 — Broken Access Control <a id="a01"></a>

**Primary mapping:** OWASP API Security Top 10:2023 — API1 (Broken Object Level Authorization), API5 (Broken Function Level Authorization).

### In-scope surface

- All mutating endpoints in [`api/src/routes/invoiceRoutes.ts`](../../../../api/src/routes/invoiceRoutes.ts)
- API-key scope enforcement in [`api/src/services/ApiKeyService.ts`](../../../../api/src/services/ApiKeyService.ts)
- Indexer read endpoints in [`backend/indexer/src/api/routes.ts`](../../../../backend/indexer/src/api/routes.ts) — every endpoint must justify why it does not need an auth boundary, or fail this category

### Required tests

1. **Missing-credential probe** — for every API route, send a request with no `Authorization` header. The route must respond `401 Unauthorized` (mutating routes) or expose only public data (read routes). _Maps to API-1._
2. **Wrong-scope probe** — issue an API key with `invoices:read` and attempt every `invoices:write` operation. Must respond `403 Forbidden`. _Maps to API-1._
3. **Cross-tenant IDOR** — create invoice X under merchant A, then attempt `GET /invoices/X` under merchant B's API key. Must respond `404 Not Found` (not `200` and not `403` that reveals existence). _Maps to API-2._
4. **Invoice enumeration** — attempt sequentially-derived invoice IDs (off-by-one, predictable nonces). Confirm IDs cannot be guessed from prior responses or from system clock. _Maps to API-2._
5. **Indexer endpoint exposure** — from a host that is not on the operator's internal network, attempt every indexer endpoint enumerated in `routes.ts`. Document whether each endpoint is reachable; reachable endpoints with sensitive data (e.g., account history for non-public accounts) are a finding. _Maps to IDX-2._
6. **Vertical-privilege escalation** — confirm there is no "admin" API key class that can read across tenants; if such a class is introduced post-D4, audit its use sites.
7. **HTTP method tampering** — for each route, try `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD` against `GET`-only routes; must respond `405 Method Not Allowed` (not silently succeed).

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Missing-credential probe | ⏳ Pending | — | — | — |
| 2. Wrong-scope probe | ⏳ Pending | — | — | — |
| 3. Cross-tenant IDOR | ⏳ Pending | — | — | — |
| 4. Invoice enumeration | ⏳ Pending | — | — | — |
| 5. Indexer endpoint exposure | ⏳ Pending | — | — | — |
| 6. Vertical escalation | ⏳ Pending | — | — | — |
| 7. HTTP method tampering | ⏳ Pending | — | — | — |

---

## A02 — Cryptographic Failures <a id="a02"></a>

### In-scope surface

- Post-D4 HMAC-SHA256 webhook signing & verification (delivery side and reference verifier in [`docs/merchant-api-security.md`](../../../merchant-api-security.md) §6)
- API-key generation, format (`tbc_<env>_<32 hex>`), and storage (hashed at rest per spec)
- TLS posture for `api/` and `backend/indexer/` endpoints (deployment defaults + recommendations)
- SDK transport — deep links must not carry secrets

### Required tests

1. **Webhook signature presence** — verify every webhook payload includes `X-Tonbankcard-Signature`, `X-Tonbankcard-Timestamp`, and a monotonic nonce. _Maps to API-3._
2. **Replay window** — replay a captured webhook 5 seconds after delivery (within window) and 10 minutes after delivery (outside window). Within-window replay must be rejected by the nonce store; outside-window replay must be rejected by the timestamp window.
3. **Signature tampering** — flip a single bit in the payload after signing; the verifier must reject.
4. **Signing-secret rotation** — confirm the verifier supports concurrent old + new secrets for a documented overlap window.
5. **API-key storage** — confirm at-rest storage hashes API keys (e.g., HMAC or bcrypt) and never logs them in plaintext. _Maps to API-8, OFF-2._
6. **API-key entropy** — sample 1000 generated keys; confirm `generateIdempotencyKey` and the API-key generator produce ≥128 bits of entropy.
7. **TLS posture** — confirm deployed endpoints redirect HTTP→HTTPS, set HSTS, and offer TLS 1.2+ only. _Maps to API-10._
8. **Sensitive-field encryption** — confirm webhook signing secret is read from env, not from a checked-in default; no plaintext storage on disk under default configuration.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Signature presence | ⏳ Pending | — | — | — |
| 2. Replay window | ⏳ Pending | — | — | — |
| 3. Signature tampering | ⏳ Pending | — | — | — |
| 4. Secret rotation | ⏳ Pending | — | — | — |
| 5. API-key storage | ⏳ Pending | — | — | — |
| 6. API-key entropy | ⏳ Pending | — | — | — |
| 7. TLS posture | ⏳ Pending | — | — | — |
| 8. Sensitive-field encryption | ⏳ Pending | — | — | — |

---

## A03 — Injection <a id="a03"></a>

### In-scope surface

- All SQL query construction in [`api/src/storage/PostgresStorage.ts`](../../../../api/src/storage/PostgresStorage.ts) and [`backend/indexer/src/db/`](../../../../backend/indexer/src/db/)
- Input validation in [`api/src/utils/validation.ts`](../../../../api/src/utils/validation.ts)
- SDK widget DOM rendering in [`sdk/src/widget/PaymentWidget.ts`](../../../../sdk/src/widget/PaymentWidget.ts) (XSS injection class)
- Metadata sanitisation in [`api/src/utils/helpers.ts`](../../../../api/src/utils/helpers.ts) `sanitizeMetadata`

### Required tests

1. **SQL injection (`api/`)** — fuzz every query parameter with classical SQLi payloads (`' OR 1=1 --`, UNION SELECT, time-based delays). Every PG query path must use parameterised statements; any string concatenation is a finding. _Maps to API-6._
2. **SQL injection (`backend/indexer/`)** — same fuzz against indexer read endpoints; pay particular attention to `accountAddress` and pagination cursor parameters (post PR #107). _Maps to IDX-7._
3. **NoSQL / Redis injection** — for the Redis idempotency store ([`api/src/storage/RedisIdempotencyStorage.ts`](../../../../api/src/storage/RedisIdempotencyStorage.ts)), confirm Redis commands are not built from raw user input (no `EVAL` with user-controlled script).
4. **Command injection** — search for `child_process` / `execSync` use sites in any in-scope file; none should accept user-controlled arguments.
5. **JSON-schema bypass** — submit oversized / deeply-nested JSON payloads to every endpoint; confirm Express body limit is enforced; confirm validator rejects unknown fields.
6. **XSS via widget** — instantiate `PaymentWidget` with `description = '<img src=x onerror=alert(1)>'`, `orderId = '"><script>...`, `returnUrl = javascript:...`. None should execute. _Maps to SDK-3._
7. **XSS via API metadata** — create an invoice whose metadata contains XSS payloads; confirm `sanitizeMetadata` strips them, and that downstream UIs would receive sanitised content. _Maps to API-9._
8. **Open redirect via `returnUrl`** — confirm the SDK widget validates `returnUrl` is `https://` (or the merchant's allow-listed scheme) and refuses `javascript:` or `data:` URIs.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. SQLi (api) | ⏳ Pending | — | — | — |
| 2. SQLi (indexer) | ⏳ Pending | — | — | — |
| 3. NoSQL / Redis | ⏳ Pending | — | — | — |
| 4. Command injection | ⏳ Pending | — | — | — |
| 5. JSON-schema bypass | ⏳ Pending | — | — | — |
| 6. XSS via widget | ⏳ Pending | — | — | — |
| 7. XSS via metadata | ⏳ Pending | — | — | — |
| 8. Open redirect | ⏳ Pending | — | — | — |

---

## A04 — Insecure Design <a id="a04"></a>

### In-scope surface

- Non-custodial guarantees recorded in [`docs/merchant-api-security.md`](../../../merchant-api-security.md) §2 and [`sdk/SECURITY.md`](../../../../sdk/SECURITY.md)
- Idempotency design ([`api/src/utils/helpers.ts`](../../../../api/src/utils/helpers.ts) `generateIdempotencyKey`, TTL `IDEMPOTENCY_TTL_MS`)
- Rate-limit design (Redis-backed, per PR #104)
- Indexer event-deduplication design (`(tx_hash, lt)` keys, per IDX-3)

### Required tests

1. **Non-custody verification** — confirm by code review that `api/`, `backend/indexer/`, and `sdk/` contain no private-key storage, no transaction signing, no fund-moving call. Any deviation is a Critical finding. _Maps to OFF-1._
2. **Idempotency replay** — submit the same `CreateInvoiceRequest` twice with the same idempotency key; second response must be the original, not a new invoice.
3. **Idempotency-key collision attack** — attempt to reuse another merchant's idempotency key. Must be scoped per-tenant. _Maps to API-8._
4. **Rate-limit design soundness** — confirm the limiter algorithm cannot be bypassed by clock skew, by IP rotation through residential proxies (within the documented threat model), or by tenant rotation. _Maps to API-5._
5. **Webhook delivery design** — confirm at-least-once delivery is documented and that the verifier handles duplicates idempotently.
6. **Indexer dedup design** — replay a captured TON block to the indexer; payment events must dedupe on `(tx_hash, lt)` and not double-credit. _Maps to IDX-1, IDX-3._
7. **Failure-mode review** — confirm Postgres / Redis outages degrade gracefully (rate limiter falls open on Redis failure is documented; verify the documented behaviour matches actual behaviour, and that "fail-open" is the explicit, accepted design — or change it).

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Non-custody verification | ⏳ Pending | — | — | — |
| 2. Idempotency replay | ⏳ Pending | — | — | — |
| 3. Idempotency collision | ⏳ Pending | — | — | — |
| 4. Rate-limit design | ⏳ Pending | — | — | — |
| 5. Webhook delivery | ⏳ Pending | — | — | — |
| 6. Indexer dedup | ⏳ Pending | — | — | — |
| 7. Failure-mode review | ⏳ Pending | — | — | — |

---

## A05 — Security Misconfiguration <a id="a05"></a>

### In-scope surface

- CORS configuration (post PR #109 allow-list)
- HTTP security headers (Helmet defaults in [`api/src/index.ts`](../../../../api/src/index.ts))
- Express defaults: `x-powered-by`, error verbosity, stack traces
- Indexer environment configuration ([`backend/indexer/src/types/config.ts`](../../../../backend/indexer/src/types/config.ts))
- Reference-only in-memory adapters: confirm production deployments do not pick them up by default

### Required tests

1. **CORS allow-list** — request from an off-list origin with `withCredentials: true`; must be blocked. Confirm wildcard fallback was actually removed (regression test of PR #109). _Maps to API-4._
2. **Security headers** — confirm Helmet sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`) and that no header is overridden by application code.
3. **Error verbosity** — submit malformed JSON, oversized bodies, missing headers; response bodies must not include stack traces, file paths, or library version disclosures.
4. **`x-powered-by` removal** — must be absent.
5. **Default credentials** — confirm no example `.env` ships with credentials that would be functional in production.
6. **Reference adapters not picked up** — start the API with no `STORAGE_BACKEND` set; confirm it fails to start (or warns loudly) rather than silently selecting the in-memory adapter. _Maps to STATUS Q-7._
7. **Indexer secret logging** — start the indexer with verbose logging; confirm `TON_API_KEY`, DB DSN, webhook secret never appear in stdout / stderr / structured logs. _Maps to IDX-6, OFF-2._
8. **Open ports** — on staging, run `nmap` against the deployed hosts; confirm only documented ports are reachable.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. CORS allow-list | ⏳ Pending | — | — | — |
| 2. Security headers | ⏳ Pending | — | — | — |
| 3. Error verbosity | ⏳ Pending | — | — | — |
| 4. `x-powered-by` | ⏳ Pending | — | — | — |
| 5. Default credentials | ⏳ Pending | — | — | — |
| 6. Reference adapters | ⏳ Pending | — | — | — |
| 7. Secret logging | ⏳ Pending | — | — | — |
| 8. Open ports | ⏳ Pending | — | — | — |

---

## A06 — Vulnerable and Outdated Components <a id="a06"></a>

### In-scope surface

- `api/package.json` + `package-lock.json`
- `backend/indexer/package.json` + `package-lock.json`
- `sdk/package.json` + `package-lock.json` (the supply-chain headliner — published to npm)

### Required tests

1. **`npm audit` baseline** — run `npm audit --omit=dev --json` against each package at the audited commit; record output as `npm-audit-<pkg>-v0.json` in [`STATUS.md`](./STATUS.md) §9. Acceptance bar: zero High / Critical for `sdk/`; document any High / Critical for `api/` and `backend/indexer/` with remediation plan. _Maps to SDK-1._
2. **`npm audit` including devDependencies** — record but do not block on dev-only findings; flag any dev dependency that touches the published bundle.
3. **Direct dependency review** — for each direct dependency, confirm pinning style. `^` and `>=` on production deps are findings; recommend exact pinning or `package-lock.json` enforcement in CI. _Maps to SDK-2._
4. **Transitive risk** — generate dependency graph (`npm ls --all`); flag any deprecated, unmaintained (>2y since last release), or single-maintainer-owned packages in the production tree.
5. **Lock-file integrity** — re-run `npm ci` in a clean checkout; confirm output matches the published `package-lock.json` digest captured at freeze.
6. **License surface** — confirm no GPL / AGPL contamination in the SDK bundle (this is a publication concern for npm consumers).
7. **`@ton/*` version alignment** — the SDK uses `>=` ranges for `@ton/core` and `@ton/ton`; confirm peer-dependency declarations match documented compatibility and recommend tightening.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. `npm audit` baseline | ⏳ Pending | — | — | — |
| 2. `npm audit` (dev) | ⏳ Pending | — | — | — |
| 3. Pinning style | ⏳ Pending | — | — | — |
| 4. Transitive risk | ⏳ Pending | — | — | — |
| 5. Lock-file integrity | ⏳ Pending | — | — | — |
| 6. License surface | ⏳ Pending | — | — | — |
| 7. `@ton/*` alignment | ⏳ Pending | — | — | — |

---

## A07 — Identification and Authentication Failures <a id="a07"></a>

### In-scope surface

- API-key issuance + format + validation in [`api/src/services/ApiKeyService.ts`](../../../../api/src/services/ApiKeyService.ts)
- Scope model and permission enforcement
- Indexer authentication boundary (if any) per IDX-2
- SDK does not authenticate — confirm it never accepts credentials from merchant code paths that would echo to the browser

### Required tests

1. **Brute-force resistance** — confirm rate limiter caps repeated failed-auth attempts per IP and per `Authorization` header prefix. _Maps to API-1, API-5._
2. **Timing oracle on API-key check** — confirm `ApiKeyService` uses constant-time comparison; sample 1000 requests with valid vs. near-valid keys and confirm response-time distributions are indistinguishable.
3. **Long-lived key compromise** — confirm there is a documented procedure to revoke a key without server restart; confirm revocation propagates within ≤60 seconds.
4. **Scope-confusion test** — issue a key with `invoices:read`; attempt operations that span scopes (e.g., read with side effects); none should succeed.
5. **Missing rotation policy** — confirm a published rotation policy exists or document the gap.
6. **SDK secret echo** — instantiate the SDK with a hypothetical API key in browser context; confirm the SDK never sends it from the browser, never echoes it via `onError`, and that the integration pattern in [`sdk/README.md`](../../../../sdk/README.md) places API-key usage server-side. _Maps to SDK-4._

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Brute-force | ⏳ Pending | — | — | — |
| 2. Timing oracle | ⏳ Pending | — | — | — |
| 3. Revocation | ⏳ Pending | — | — | — |
| 4. Scope confusion | ⏳ Pending | — | — | — |
| 5. Rotation policy | ⏳ Pending | — | — | — |
| 6. SDK secret echo | ⏳ Pending | — | — | — |

---

## A08 — Software and Data Integrity Failures <a id="a08"></a>

### In-scope surface

- `package-lock.json` integrity in all three packages
- SDK build provenance — does the published npm tarball match what the source produces? See [`sdk/VERIFICATION.md`](../../../../sdk/VERIFICATION.md)
- Webhook payload integrity (HMAC; cross-references A02)
- Indexer-database integrity ([`backend/indexer/src/db/`](../../../../backend/indexer/src/db/)) — schema migrations, foreign keys

### Required tests

1. **Lock-file tamper** — modify `package-lock.json` to point at a yanked / typosquat package version; confirm `npm ci` fails integrity check.
2. **Reproducible SDK build** — follow [`sdk/VERIFICATION.md`](../../../../sdk/VERIFICATION.md); confirm rebuilt artefact matches what is published on npm at the corresponding version tag. Any mismatch is a finding. _Maps to SDK-1, SDK-2._
3. **`mock.ts` exclusion** — inspect the published SDK bundle (`dist/index.js`, `dist/index.mjs`) for any artefact from [`sdk/src/mock.ts`](../../../../sdk/src/mock.ts). Mocks reaching production is a Critical finding. _Maps to SDK-7._
4. **Update-channel integrity** — confirm SDK consumers cannot be downgraded to an earlier vulnerable version via semver tricks; recommend `npm audit signatures` (when available).
5. **Database migrations** — every migration in [`backend/indexer/scripts/migrate.js`](../../../../backend/indexer/scripts/) must be deterministic, transactional, and rollbackable.
6. **Webhook payload integrity** — covered under A02; cross-reference findings.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Lock-file tamper | ⏳ Pending | — | — | — |
| 2. Reproducible build | ⏳ Pending | — | — | — |
| 3. `mock.ts` exclusion | ⏳ Pending | — | — | — |
| 4. Update channel | ⏳ Pending | — | — | — |
| 5. DB migrations | ⏳ Pending | — | — | — |
| 6. Webhook integrity | ⏳ Pending | — | — | (see A02) |

---

## A09 — Security Logging and Monitoring Failures <a id="a09"></a>

### In-scope surface

- Pino logger configurations in `api/`, `backend/indexer/`
- SDK error callbacks
- Audit trail completeness: every authenticated mutating action must be logged

### Required tests

1. **Secret redaction** — confirm Pino redaction (or equivalent) suppresses `TON_API_KEY`, `Authorization`, `X-Tonbankcard-Signature`, DB DSN passwords. Re-run with `LOG_LEVEL=debug` and re-verify. _Maps to IDX-6, OFF-2._
2. **Authentication-failure logging** — confirm every 401/403 emits a structured log entry that is reachable by ops without exposing the offending credential.
3. **Audit-trail completeness** — every mutation through `api/` (create invoice, cancel invoice, deliver webhook) must produce a log entry with `request_id`, `merchant_id`, `route`, `outcome`.
4. **Tamper resistance** — confirm logs are written to a destination ops can isolate (stdout aggregated via SIEM, not solely on disk on the application host).
5. **PII leakage** — confirm logs do not include user wallet addresses, deep-link parameters, or merchant-supplied metadata beyond what the operator needs. _Maps to OFF-4._
6. **Alerting baseline** — document which log signals should trigger alerts (e.g., spike in 401s, webhook signature failures, indexer fetch errors). Absence of alerting on Critical signals is a Medium finding.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. Secret redaction | ⏳ Pending | — | — | — |
| 2. Auth-failure logging | ⏳ Pending | — | — | — |
| 3. Audit trail | ⏳ Pending | — | — | — |
| 4. Tamper resistance | ⏳ Pending | — | — | — |
| 5. PII leakage | ⏳ Pending | — | — | — |
| 6. Alerting baseline | ⏳ Pending | — | — | — |

---

## A10 — Server-Side Request Forgery (SSRF) <a id="a10"></a>

### In-scope surface

- Indexer outbound calls to TON HTTP API
- Post-D4 outbound webhook delivery from `api/`
- Any URL-fetching utility that accepts merchant-controlled URLs (e.g., `returnUrl` from SDK config — confirm it is never fetched server-side)

### Required tests

1. **TON HTTP API endpoint hardening** — confirm the indexer's TON HTTP API endpoint is configured via env (not merchant input), and that it cannot be swapped at request-time. _Maps to IDX-4._
2. **Webhook target allow-list** — confirm webhooks fired from `api/` only target the merchant's registered webhook URL (validated at registration time); refuse loopback / link-local / RFC1918 addresses unless explicitly whitelisted in dev mode.
3. **Webhook URL validation** — at registration time, refuse schemes other than `https://`; refuse `localhost`, `127.0.0.1`, `169.254.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, IPv6 link-local.
4. **`returnUrl` server-side fetch** — confirm no server-side component fetches `returnUrl`; it is purely a browser redirect target.
5. **DNS-rebinding** — submit a webhook URL whose DNS resolves to a public IP at registration but a private IP at delivery; the resolver wrapper must re-validate at delivery time.

### Findings & evidence

| Test | Status | Finding(s) | PoC | Notes |
|------|--------|------------|-----|-------|
| 1. TON endpoint pinning | ⏳ Pending | — | — | — |
| 2. Webhook allow-list | ⏳ Pending | — | — | — |
| 3. Webhook URL validation | ⏳ Pending | — | — | — |
| 4. `returnUrl` server fetch | ⏳ Pending | — | — | — |
| 5. DNS rebinding | ⏳ Pending | — | — | — |

---

## 4. Sign-off

The pentester signs off this checklist as part of the final report. A category may not be marked `pass` without recorded evidence in §A0x → Findings & evidence.

| Category | Pentester verdict | Date | Lead |
|----------|-------------------|------|------|
| A01 | — | — | — |
| A02 | — | — | — |
| A03 | — | — | — |
| A04 | — | — | — |
| A05 | — | — | — |
| A06 | — | — | — |
| A07 | — | — | — |
| A08 | — | — | — |
| A09 | — | — | — |
| A10 | — | — | — |

---

## 5. References

- [Engagement plan](./ENGAGEMENT.md)
- [Engagement status](./STATUS.md)
- [Pentest plan](./PENTEST_PLAN.md)
- [Remediation workflow](../REMEDIATION_WORKFLOW.md)
- [Merchant API specification](../../../merchant-api-spec.md)
- [Merchant API security architecture](../../../merchant-api-security.md)
- [Protocol Threat Model](../../THREAT_MODEL.md)
- [Issue #115](https://github.com/xlabtg/tonbankcard-protocol/issues/115)
- OWASP Top 10:2021 — https://owasp.org/Top10/
- OWASP API Security Top 10:2023 — https://owasp.org/API-Security/editions/2023/en/0x00-header/
- OWASP ASVS v4.0.3 — https://owasp.org/www-project-application-security-verification-standard/
