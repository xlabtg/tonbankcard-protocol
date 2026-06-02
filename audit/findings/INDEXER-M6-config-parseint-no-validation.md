---
title: "[INDEXER-M6] Config numeric parsing accepts garbage with no validation"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","priority:medium","stage:3-medium"]
---

## Summary

`getEnvNumber` parses numeric configuration with `parseInt` and no NaN or range checking. Invalid or out-of-range values (e.g. non-numeric confirmation depth, zero or negative batch size) silently stall the sync or cause infinite/backwards looping.

## Severity & Category

- Severity: Medium
- Category: Input validation / robustness

## Affected Code

- `backend/indexer/src/types/config.ts:73-76` (`getEnvNumber`)
- `backend/indexer/src/types/config.ts:105-110` (config assembly)

## Description

```ts
// backend/indexer/src/types/config.ts:73-76
return parseInt(value, 10); // no NaN check, no range check
```

Examples of unsafe inputs:

- `INDEXER_CONFIRMATION_BLOCKS=foo` -> `NaN` -> `endBlock` `NaN` -> sync loop never runs (stalls silently).
- `INDEXER_BATCH_SIZE=0` -> potential infinite loop (no progress).
- `INDEXER_BATCH_SIZE=-1` -> backwards/never-terminating progression.

## Impact

- Misconfiguration silently halts or breaks indexing with no clear error.

## Suggested Fix

- Validate that parsed values are finite and within sane ranges (`batchSize >= 1`, `confirmationBlocks >= 0`).
- Fail fast at startup with a descriptive error on invalid configuration.

## Acceptance Criteria

- [ ] `getEnvNumber` (or config validation) rejects non-finite and out-of-range values.
- [ ] `batchSize >= 1` and `confirmationBlocks >= 0` are enforced at startup.
- [ ] Invalid config produces a clear startup error rather than a silent stall.
- [ ] A regression test asserts invalid env values are rejected at config load.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `backend/indexer/docs/REORG_HANDLING.md`

---

**Tracking issue:** [#278](https://github.com/xlabtg/tonbankcard-protocol/issues/278)
