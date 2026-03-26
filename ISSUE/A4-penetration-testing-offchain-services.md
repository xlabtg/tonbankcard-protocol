---
name: "[A4] Penetration Testing — Off-Chain Services"
about: Security review of API, indexer, and SDK off-chain components
labels: type:security
track: A
priority: high
---

## 1. Goal

Conduct a security penetration test of all off-chain services (`api/`, `backend/indexer/`, `sdk/`) focusing on OWASP Top 10, authentication weaknesses, data integrity, and supply-chain risks.

## 2. Context

While the protocol's on-chain contracts enforce non-custody guarantees, the off-chain services are the primary attack surface for most adversaries. The Merchant API handles invoice creation and webhook dispatch; the indexer reads and caches blockchain state; the SDK is consumed by merchant developers and can be a supply-chain vector.

This pentest should be conducted after Track D rate-limiting improvements (D4) are implemented, so that the test validates the final hardened state.

Related to: [DEVELOPMENT_ROADMAP.md — Track A, A4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

- **`api/`** (`@tonbankcard/merchant-api` v1.0.0)
  - All REST endpoints defined in `docs/merchant-api-spec.md`
  - Authentication and authorization logic
  - Webhook signature generation and delivery
  - Rate limiting and input validation

- **`backend/indexer/`** (`@tonbankcard/payment-indexer` v1.0.0)
  - Blockchain event ingestion pipeline
  - SQLite/PostgreSQL data integrity
  - API endpoints exposed by the indexer

- **`sdk/`** (`@tonbankcard/merchant-sdk` v1.0.0)
  - npm package supply chain: dependency tree, pinning, audit
  - Client-side widget security (XSS, clickjacking)
  - Sensitive data handling in browser context

## 4. Out of Scope

- Smart contracts (covered by A1, A2)
- Formal verification (covered by A3)
- Third-party gateway APIs (ChangeNOW, NOWPayments, CoinRabbit) — their security is their own responsibility
- Private key storage — the system must not store private keys off-chain at all (this is a correctness check, not a pentest target)

## 5. Threat Model

### Merchant API (`api/`)
1. **Unauthenticated invoice manipulation** — Creating or modifying invoices without valid API key
2. **IDOR (Insecure Direct Object Reference)** — Accessing another merchant's invoices by guessing IDs
3. **Webhook replay** — Replaying old webhook events to credit payments twice
4. **CORS misconfiguration** — Cross-origin requests from untrusted domains
5. **Rate limit bypass** — Flooding invoice creation to exhaust quota or cause DoS
6. **SQL injection** — Malformed inputs reaching database queries
7. **Path traversal** — Accessing files outside intended directories

### Indexer (`backend/indexer/`)
1. **Data integrity tampering** — Injecting fraudulent payment records into the local cache
2. **API exposure** — Indexer internal API endpoints reachable without authentication
3. **Replay attack** — Processing the same blockchain event twice
4. **TON API trust** — Accepting tampered data from a malicious TON HTTP API endpoint

### SDK (`sdk/`)
1. **Supply chain compromise** — Malicious dependency in npm dependency tree
2. **XSS in payment widget** — User-controlled data rendered unsafely in the widget iframe/DOM
3. **Sensitive data leakage** — API keys or merchant secrets exposed in browser DevTools or logs
4. **Clickjacking** — Payment widget embedded in malicious context

## 6. Mitigations Already Planned

- Rate limiting to be implemented in D4
- HMAC-SHA256 webhook signature verification (D4)
- API key authentication for merchant endpoints (D4)
- `npm audit` in CI (D5)

## 7. Acceptance Criteria

- [ ] Pentest scope agreed with security team and tested against staging environment
- [ ] All **Critical** findings remediated before production launch
- [ ] All **High** findings remediated or formally accepted
- [ ] OWASP Top 10 checklist completed for `api/`
- [ ] `npm audit` shows zero high/critical vulnerabilities in `sdk/`
- [ ] Webhook signature verification confirmed resistant to replay attacks
- [ ] Pentest report published in `docs/security/pentests/`
- [ ] Remediation PR(s) merged and re-tested

## 8. References

- [Merchant API Spec](../docs/merchant-api-spec.md)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- [Security Policy](../SECURITY.md)
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Issue D4: [D4-rate-limiting-ddos-protection.md](./D4-rate-limiting-ddos-protection.md)
- Issue D5: [D5-dependency-audit-and-updates.md](./D5-dependency-audit-and-updates.md)
