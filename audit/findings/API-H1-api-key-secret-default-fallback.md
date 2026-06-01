---
title: "[API-H1] API_KEY_SECRET silently falls back to a hardcoded default"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

The HMAC secret used to hash API keys defaults to a hardcoded literal when `API_KEY_SECRET` is unset or empty. There is no startup guard, so a misconfigured production deployment will compute every API-key HMAC using a publicly known constant, defeating the "store only the HMAC" design.

## Severity & Category

- Severity: High
- Category: Cryptographic Configuration / Secrets Management

## Affected Code

- `api/src/utils/helpers.ts:181`
- `api/src/services/ApiKeyService.ts:6-11` (HMAC-at-rest design)
- `.env.example:27` (ships a placeholder)

## Description

The secret resolution falls back to a constant:

```ts
secret: string = process.env.API_KEY_SECRET || 'default-dev-secret'
```

If `API_KEY_SECRET` is unset or empty in production, all API-key HMACs are derived from the publicly known literal `'default-dev-secret'`. No boot-time validation rejects this state. Because `.env.example:27` ships a placeholder value, an operator can easily deploy without setting a real secret.

This defeats the purpose of storing only the HMAC of keys (`ApiKeyService.ts:6-11`): an attacker who knows the constant can recompute the stored HMAC for any candidate key.

## Impact

- API-key hashes become forgeable/predictable, undermining authentication.
- The at-rest protection of stored key hashes is nullified.
- The failure is silent — no error or warning surfaces the insecure configuration.

## Suggested Fix

- On boot, if `NODE_ENV === 'production'` and the secret is unset, empty, or matches a known weak/default value, refuse to start (fail fast with a clear error).
- Never use a literal fallback outside of test environments.
- Optionally enforce a minimum entropy/length requirement on the secret.

## Acceptance Criteria

- [ ] Startup aborts in production when `API_KEY_SECRET` is missing, empty, or a known default.
- [ ] No hardcoded secret fallback is used outside test code.
- [ ] Regression test: app boot in production mode without `API_KEY_SECRET` fails fast; boot with a valid secret succeeds.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#250](https://github.com/xlabtg/tonbankcard-protocol/issues/250)
