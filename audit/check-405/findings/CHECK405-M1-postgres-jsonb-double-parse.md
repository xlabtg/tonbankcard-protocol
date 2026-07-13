---
title: PostgresInvoiceStorage double-parses JSONB columns, so every read of an invoice with metadata or settlement throws
severity: Medium
area: api
priority: medium
stage: 3-medium
labels:
  - bug
  - audit
  - type:backend
  - priority:medium
  - stage:3-medium
  - package:api
  - track:D
---

## Summary

`PostgresInvoiceStorage.rowToInvoice` reads the `metadata` and `settlement`
columns with `JSON.parse(row['metadata'] as string)`. The columns are declared
`JSONB` (see the class docstring's `CREATE TABLE`), and the `pg` driver
**already parses `jsonb`/`json` columns into JavaScript objects**. Calling
`JSON.parse` on an object coerces it to the string `"[object Object]"`, which is
invalid JSON, so `JSON.parse` throws `SyntaxError`. Every `get()` / `entries()`
of an invoice that has non-null `metadata` or `settlement` therefore throws,
surfacing as a 500. The write path stores the columns correctly with
`JSON.stringify`, so the corruption is purely on read.

## Severity & Category

- Severity: Medium (latent — this storage backend is a production stub not wired
  into the default `InMemory` path and has no test, so it will fail on first
  production use rather than in CI today)
- Category: Correctness / data-layer round-trip bug

## Affected Code

- `api/src/storage/PostgresStorage.ts:156-170` (`rowToInvoice`) —
  `JSON.parse(row['metadata'] as string)` and
  `JSON.parse(row['settlement'] as string)` on already-parsed `jsonb` values.
- `api/src/storage/PostgresStorage.ts:102-124` (`set`) — writes
  `JSON.stringify(invoice.metadata)` / `JSON.stringify(invoice.settlement)`,
  which `pg` correctly stores into the `jsonb` columns.
- `api/src/storage/PostgresStorage.ts:16-27` — the documented schema declaring
  `metadata JSONB`, `settlement JSONB`, `created_at TIMESTAMPTZ`,
  `expires_at TIMESTAMPTZ`.

## Description

```ts
// write path — correct
invoice.metadata   ? JSON.stringify(invoice.metadata)   : null,
invoice.settlement ? JSON.stringify(invoice.settlement) : null,

// read path — rowToInvoice — WRONG
metadata:   row['metadata']   ? JSON.parse(row['metadata']   as string) : undefined,
settlement: row['settlement'] ? JSON.parse(row['settlement'] as string) : undefined,
```

Because the column type is `JSONB`, `pg` returns `row['metadata']` as an
already-deserialised object. `JSON.parse(someObject)` first coerces the argument
to a string — `String({}) === "[object Object]"` — and then fails to parse it,
throwing `SyntaxError: Unexpected token o in JSON at position 1`. The read of any
invoice that carries metadata or a settlement therefore blows up.

A secondary, lower-severity issue on the same rows: `created_at` and
`expires_at` are `TIMESTAMPTZ`, which `pg` returns as JavaScript `Date` objects,
but `rowToInvoice` casts them `as string`. Downstream code that treats
`invoice.created_at` as an ISO string (e.g. string comparisons, direct API
serialisation) will instead receive a `Date`, producing inconsistent output
versus the `InMemory` backend which stores ISO strings.

## Impact

- Any deployment that swaps the default `InMemoryInvoiceStorage` for
  `PostgresInvoiceStorage` (the documented production path) will 500 on every
  read of an invoice that has metadata or a settled record — i.e. exactly the
  invoices merchants most need to read back.
- The timestamp type mismatch yields subtly different API responses between the
  two backends.

## Suggested Fix

- In `rowToInvoice`, stop re-parsing `jsonb`: assign the value through directly
  (optionally guarding for the legacy case where a column was stored as `text`,
  by only `JSON.parse`-ing when the value is a `string`).
- Normalise timestamps to ISO strings (`row['created_at'] instanceof Date ?
  row['created_at'].toISOString() : row['created_at'] as string`) so both
  backends return the same shape.
- Add a unit test with a fake `PoolLike` that returns `pg`-shaped rows (objects
  for `jsonb`, `Date` for `timestamptz`) and asserts a clean round-trip.

## Acceptance Criteria

- [ ] Reading an invoice with `metadata` and `settlement` returns the original
      objects (no throw).
- [ ] `created_at` / `expires_at` are ISO strings regardless of backend.
- [ ] A `PoolLike` fake-based test covers the `set` → `get` round-trip for an
      invoice with metadata + settlement.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- `node-postgres` type parsing — `json`/`jsonb` are parsed to objects by default.
