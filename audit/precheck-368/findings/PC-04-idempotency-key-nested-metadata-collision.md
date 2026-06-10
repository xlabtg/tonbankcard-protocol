---
title: generateIdempotencyKey ignores nested metadata, so requests differing only in metadata collide
severity: Medium
area: api
priority: medium
stage: 3-medium
labels:
  - bug
  - type:backend
  - priority:medium
  - audit
  - stage:3-medium
---

## Summary

`api/src/utils/helpers.ts` builds an idempotency key with `JSON.stringify(data, Object.keys(data).sort())`. The second argument is a **replacer array**, which JSON.stringify applies recursively — so only the top-level keys listed survive and all **nested** object keys (notably `metadata.*`) are dropped. Two requests that differ only inside `metadata` therefore produce the same idempotency key and the second is incorrectly treated as a duplicate.

## Severity & Category

- Severity: Medium
- Category: Correctness / Idempotency

## Affected Code

- `api/src/utils/helpers.ts:51-61` (`generateIdempotencyKey`)
- `api/src/utils/helpers.ts:73` (`hashMetadata` uses the same pattern but is correct because its keys are all top-level)

## Description

```ts
const sorted = JSON.stringify(data, Object.keys(data).sort());
```

`Object.keys(data).sort()` yields only the top-level field names. When passed as the replacer array, `JSON.stringify` keeps only properties whose names appear in that array — at every nesting level. So `metadata: { orderId: "A" }` and `metadata: { orderId: "B" }` both serialize identically (the nested `orderId` is not in the top-level key list), yielding identical keys.

Reproduction confirmed: two payloads differing only in `metadata.orderId` produce `keyA === keyB`.

## Impact

- Distinct requests that legitimately differ only in `metadata` collide, so the second request is rejected/served as a replay of the first.
- For invoice/payment creation this can return the wrong stored result or silently drop a legitimate second operation.

## Suggested Fix

- Use a stable canonical serialization that recurses into nested objects (deep key sort) instead of the replacer-array shortcut, e.g. a small `canonicalize(obj)` that sorts keys at every level, then hash that.
- Add a regression test asserting that payloads differing only in nested metadata produce different keys, and identical payloads produce identical keys regardless of key order.

## Acceptance Criteria

- [ ] Requests differing in any nested field (including `metadata.*`) produce distinct idempotency keys.
- [ ] Requests identical up to key ordering produce the same key.
- [ ] Regression test covers nested-difference and key-order-invariance.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
