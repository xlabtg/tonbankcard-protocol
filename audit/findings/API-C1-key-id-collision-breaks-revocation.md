---
title: "[API-C1] key_id collides for every live/test key, breaking revocation correctness"
severity: critical
area: backend
priority: critical
stage: 1
labels: ["bug","audit","type:backend","type:security","priority:critical","stage:1-critical"]
---

## Summary

The `key_id` used to address an API key is derived from a fixed-length prefix of the plaintext key. Because every canonical key shares one of exactly two 8-character prefixes (`tbc_live` / `tbc_test`), all live keys collapse to the same `key_id` and all test keys collapse to another. Lookups and revocations therefore operate on an arbitrary key rather than the intended one.

## Severity & Category

- Severity: Critical
- Category: Access Control / Key Management correctness

## Affected Code

- `api/src/services/ApiKeyService.ts:64`
- `api/src/utils/apiKeyGenerator.ts:46-50`
- `api/src/services/ApiKeyService.ts:215-220` (`findByKeyId`)
- `api/src/services/ApiKeyService.ts:228-233` (`revokeByKeyId`)
- `api/src/routes/apiKeyRoutes.ts:248` (`DELETE /v1/keys/:key_id`)

## Description

The `key_id` is generated from the first 8 characters of the plaintext key:

```ts
const keyId = `key_${plaintextKey.substring(0, 8)}`;
```

All canonical keys are formatted as `tbc_live_<hex>` or `tbc_test_<hex>` (`api/src/utils/apiKeyGenerator.ts:46-50`), and the prefixes `tbc_live` and `tbc_test` are each exactly 8 characters long. Consequently:

- Every live key produces `key_id` = `key_tbc_live`.
- Every test key produces `key_id` = `key_tbc_test`.

`findByKeyId` returns the first stored record whose id matches, and `revokeByKeyId` revokes whatever that lookup returns first:

```ts
// findByKeyId (ApiKeyService.ts:215-220) returns the FIRST match
// revokeByKeyId (ApiKeyService.ts:228-233) revokes the first match
```

When `DELETE /v1/keys/:key_id` (`api/src/routes/apiKeyRoutes.ts:248`) is invoked, it revokes an arbitrary, unintended key that happens to share the colliding prefix.

## Impact

- Revocation targets the wrong key: a caller intending to revoke a compromised key may instead revoke an unrelated, still-trusted key while the compromised one remains active.
- Key lookups are non-deterministic and effectively meaningless for any account holding more than one live (or test) key.
- This undermines a core security operation (revocation), which is essential for incident response.

## Suggested Fix

- Derive `key_id` from a unique, non-guessable value (e.g. `crypto.randomBytes`) or from the stored key hash, rather than from the shared plaintext prefix.
- Persist the `key_id` -> key-record mapping at creation time and look up strictly by that unique id.
- Ensure `key_id` is stable across restarts and never reconstructed from the plaintext key.

## Acceptance Criteria

- [ ] `key_id` is unique per key and cannot collide across keys sharing a prefix.
- [ ] `findByKeyId` resolves exactly the intended key record.
- [ ] `revokeByKeyId` and `DELETE /v1/keys/:key_id` revoke only the targeted key, leaving all others active.
- [ ] Regression test: create two live keys, revoke one by its `key_id`, and assert the other remains valid and usable.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#243](https://github.com/xlabtg/tonbankcard-protocol/issues/243)
