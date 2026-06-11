# Issue #373 / PC-04 — idempotency key must recurse into nested metadata

Minimal, self-contained reproduction of the **PC-04** finding:
`api/src/utils/helpers.ts`'s `generateIdempotencyKey()` built the key with

```ts
// pre-fix
const jsonString = JSON.stringify(data, Object.keys(data).sort());
```

The second argument of `JSON.stringify` is a **replacer array** — an allow-list
of property names that the serialiser applies **recursively at every nesting
level**. `Object.keys(data).sort()` lists only the *top-level* fields, so every
nested key is dropped. In particular `metadata` always serialises to `{}`. Two
invoice-create requests that differ **only** inside `metadata` (e.g.
`metadata.order_id = "A"` vs `"B"`) therefore hash to the **same** idempotency
key, and the second request is wrongly served as a replay of the first — the
caller gets back the first invoice (with the wrong `order_id`) or the legitimate
second operation is silently dropped.

## What `idempotency-key-collision.repro.spec.ts` proves

The spec inlines the **exact pre-fix implementation** (`oldGenerateIdempotencyKey`)
for the "before" column and drives the **real, fixed** `generateIdempotencyKey`
/ `canonicalize` imported from `api/src/utils/helpers.ts` for the "after"
column, so the contrast is against live code:

- **before — the bug:** two requests differing only in `metadata.order_id`
  produce the **same** key; a second test shows *why* — the payload serialises
  with `"metadata":{}` because the nested key is not in the top-level allow-list.
- **after — the fix:** the same two requests produce **distinct** keys;
  canonicalisation keeps the key **invariant to metadata key ordering** (so
  genuine idempotency still works); and `canonicalize` preserves the nested
  difference the replacer array lost.

| Two requests differing only in `metadata.order_id` | Same request, metadata keys reordered |
| --- | --- |
| **Before the fix** (replacer array) — **COLLIDE** ❌ | (n/a) |
| **After the fix** (recursive canonicalize) — distinct keys ✅ | same key ✅ |

## Run it

```bash
cd experiments/issue-373-idempotency-key
npm install
npm test
```

The CI-enforced regression lives in the API package itself
(`api/tests/helpers.test.ts`, job *Test API*); this directory is the
self-contained before/after demonstration that accompanies the audit finding.

## Notes

This is an authorized internal audit reproduction. No secrets or real customer
data are used; all inputs are synthetic.
