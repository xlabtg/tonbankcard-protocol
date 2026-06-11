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

## Resolution

**RESOLVED ✅ (Issue #373 / PC-04)** — PR
[#387](https://github.com/xlabtg/tonbankcard-protocol/pull/387), branch
`issue-373-7158f5ed25fa`.

A new exported helper `canonicalize(value)`
(`api/src/utils/helpers.ts:53-83`) replaces the replacer-array shortcut. It
recurses into nested objects, **sorting keys at every level** (arrays keep their
order), with `JSON.stringify` semantics for values that have no JSON form
(`undefined`/function/symbol are omitted from objects, rendered as `null` inside
arrays):

```ts
const record = value as Record<string, unknown>;
const parts: string[] = [];
for (const key of Object.keys(record).sort()) {
  const serialized = canonicalize(record[key]);
  if (serialized === undefined) continue;          // drop undefined props
  parts.push(`${JSON.stringify(key)}:${serialized}`);
}
return `{${parts.join(',')}}`;
```

`generateIdempotencyKey` (`:122`) now hashes `canonicalize(data)` instead of
`JSON.stringify(data, Object.keys(data).sort())`, so nested `metadata.*`
differences survive and two requests differing only inside `metadata` no longer
collide. The key stays **invariant to metadata key ordering**, so genuine
idempotent retries still de-duplicate.

`hashMetadata` (`:142`) was migrated to the same `canonicalize` so the buggy
replacer-array pattern lives nowhere in the codebase. For the **flat** metadata
it hashes, `canonicalize` is **byte-for-byte identical** to the previous
`JSON.stringify(metadata, sortedKeys)` (verified across primitives, integer-like
keys, `undefined` values, and special characters), so on-chain payload-hash
matching is unchanged — pinned by a golden-vector regression test.

**Regression coverage:**

- CI-enforced suite (`api/tests/helpers.test.ts`, job *Test API*) — 13 tests:
  distinct keys for every differing nested field (`order_id`, `description`,
  `customer_email`, arbitrary/numeric/boolean fields), key-order invariance
  (metadata and top-level), key-id/`expires_at` scoping, `canonicalize` unit
  tests (recursive sort, nested-difference survival with a buggy-pattern
  counter-example, array order, `undefined`→omit/`null`, flat-object
  byte-equivalence), and a `hashMetadata` golden vector
  (`89f36b35…551f9bf5`) proving no behavioural change.
- Standalone before/after reproduction
  (`experiments/issue-373-idempotency-key/idempotency-key-collision.repro.spec.ts`,
  5 tests) inlines the exact pre-fix implementation (collision + proof that
  `metadata` serialises to `{}`) and drives the real fixed code (distinct keys,
  order invariance).

## Acceptance Criteria

- [x] Requests differing in any nested field (including `metadata.*`) produce distinct idempotency keys.
- [x] Requests identical up to key ordering produce the same key.
- [x] Regression test covers nested-difference and key-order-invariance.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
