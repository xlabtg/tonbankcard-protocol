---
title: "[DEVOPS-M4] Sandbox API_KEY_SECRET hardcoded to a default value"
severity: medium
area: devops
priority: medium
stage: 3
labels: ["bug","audit","type:tooling","type:security","priority:medium","stage:3-medium"]
---

## Summary

The sandbox compose file sets `API_KEY_SECRET` to a fixed literal default when `SANDBOX_API_KEY_SECRET` is unset. Any environment that reuses this compose file inherits a publicly known HMAC secret, undermining the integrity of API-key hashing.

## Severity & Category

- Severity: Medium
- Category: Secrets Management / Cryptographic Configuration

## Affected Code

- `docker-compose.sandbox.yml:44` (`API_KEY_SECRET: ${SANDBOX_API_KEY_SECRET:-sandbox-do-not-use-in-production-32-bytes}`)

## Description

The sandbox API service falls back to a committed literal secret:

```yaml
      API_KEY_SECRET: ${SANDBOX_API_KEY_SECRET:-sandbox-do-not-use-in-production-32-bytes}
```

The default value is committed to the repository and therefore public. The API uses `API_KEY_SECRET` as the HMAC key for hashing API keys at rest (see `audit/findings/API-H1-api-key-secret-default-fallback.md`). A known secret lets anyone recompute the stored HMAC for any candidate key, defeating the at-rest protection — even in sandbox, and worse if the file is copied to a non-sandbox environment.

This compounds the application-level default fallback documented in API-H1: the infrastructure layer also supplies a weak default, so two independent layers must be misconfigured to be safe.

## Impact

- The API-key HMAC secret is publicly known wherever this default is used, making stored key hashes forgeable/predictable.
- The insecure default can silently leak into staging or other reused environments.

## Suggested Fix

- Source `API_KEY_SECRET` from the environment with no committed default, and fail if `SANDBOX_API_KEY_SECRET` is unset:

```yaml
      API_KEY_SECRET: ${SANDBOX_API_KEY_SECRET:?SANDBOX_API_KEY_SECRET must be set}
```

- Document generating a strong random secret (for example `openssl rand -base64 32`) in the sandbox setup docs and `.env.sandbox.example`.

## Acceptance Criteria

- [ ] `docker-compose.sandbox.yml` no longer ships a literal `API_KEY_SECRET` default.
- [ ] The stack fails to start when `SANDBOX_API_KEY_SECRET` is unset.
- [ ] Setup docs/`.env.sandbox.example` describe generating a strong random secret.
- [ ] CI/verification: a compose-config lint asserts no hardcoded secret default for `API_KEY_SECRET`.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/findings/API-H1-api-key-secret-default-fallback.md`

---

**Tracking issue:** [#286](https://github.com/xlabtg/tonbankcard-protocol/issues/286)
