---
name: "[D4] Rate Limiting & DDoS Protection"
about: Add request rate limiting, API key authentication, and webhook signature verification to the Merchant API
labels: type:backend
track: D
priority: high
---

## 1. Goal

Implement request rate limiting, API key authentication, and HMAC-SHA256 webhook signature verification in the Merchant API to protect against abuse, unauthorized access, and webhook replay attacks.

## 2. Context

The Merchant API currently lacks authentication and rate limiting. Any caller can create invoices, and webhook deliveries have no integrity verification. This is acceptable for development but unacceptable for production deployment.

This issue should be completed before A4 (penetration testing) so that the pentest validates the hardened API.

Related to: [DEVELOPMENT_ROADMAP.md — Track D, D4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Rate Limiting
- Add `express-rate-limit` middleware to all Merchant API routes
- Limits:
  - Invoice creation: 60 requests per minute per API key
  - Invoice status polling: 300 requests per minute per API key
  - Global unauthenticated: 10 requests per minute per IP
- Rate limit headers returned in responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

### API Key Authentication
- Merchants must authenticate with an API key on all endpoints
- API key format: `tbc_live_{32-char-random}` (production) / `tbc_test_{32-char-random}` (sandbox)
- API key storage: hashed (bcrypt or SHA-256) in the database, never stored in plain text
- API key management endpoints:
  - `POST /v1/keys` — create new API key
  - `DELETE /v1/keys/{keyId}` — revoke API key
- Authentication method: `Authorization: Bearer {api_key}` header

### Webhook Signature Verification
- All webhook deliveries include `X-Tonbankcard-Signature` header
- Signature: `HMAC-SHA256(secret_key, webhook_body)`
- Merchant registers a webhook URL and receives a signing secret on registration
- Replay protection: include timestamp in signature, reject requests older than 5 minutes
- Documentation in `docs/merchant-api-spec.md`

## 4. Out of Scope

- On-chain authentication (contracts use NFT-based ownership, no API keys)
- OAuth or OpenID Connect (API key model is sufficient for v1)
- DDoS infrastructure (CDN, anycast) — document recommended setup, don't implement

## 5. Functional Requirements

1. Unauthenticated requests to protected endpoints return `401 Unauthorized`
2. Rate-exceeded requests return `429 Too Many Requests` with `Retry-After` header
3. Webhook bodies are signed with HMAC-SHA256 before delivery
4. Merchant SDK provides a `verifyWebhook(signature, body, secret)` helper
5. Signature verification documented in `docs/merchant-api-spec.md`

## 6. Non-Functional Requirements

- Rate limiting must use Redis or an in-memory store with persistence (not per-process in-memory)
- API key hashing must use a secure algorithm (bcrypt or Argon2)
- Rate limit configuration must be adjustable via environment variables (not hardcoded)
- Webhook signature verification must use constant-time comparison

## 7. Security Requirements

- API keys must never appear in server logs (redact after first 8 characters)
- Webhook timestamp must be validated to prevent replay attacks (max 5-minute clock skew)
- HMAC computation must use the webhook body exactly as received (no re-serialization)
- Rate limits must be enforced per API key, not per IP (to support merchants behind NAT)

## 8. Acceptance Criteria

- [ ] `express-rate-limit` integrated with per-key and per-IP limits
- [ ] API key authentication required on all Merchant API endpoints
- [ ] API key creation and revocation endpoints implemented
- [ ] API keys stored as hashed values in the database
- [ ] Webhook delivery includes `X-Tonbankcard-Signature` header
- [ ] `verifyWebhook()` helper added to the SDK
- [ ] Timestamp-based replay protection on webhook signatures
- [ ] All existing API tests updated to include authentication
- [ ] `docs/merchant-api-spec.md` updated with auth and webhook verification docs

## 9. References

- [Merchant API](../api/)
- [SDK](../sdk/)
- [Merchant API Spec](../docs/merchant-api-spec.md)
- `express-rate-limit`: https://github.com/express-rate-limit/express-rate-limit
- Issue A4: [A4-penetration-testing-offchain-services.md](./A4-penetration-testing-offchain-services.md)
