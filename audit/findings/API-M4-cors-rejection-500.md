---
title: "[API-M4] CORS rejections surface as generic 500s"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","priority:medium","stage:3-medium"]
---

## Summary

The CORS origin callback rejects disallowed origins by passing an `Error`, which propagates as a generic 500 `INTERNAL_ERROR` instead of a deterministic CORS/4xx response.

## Severity & Category

- Severity: Medium
- Category: Error Handling / API Correctness

## Affected Code

- `api/src/routes/invoiceRoutes.ts:183-198` (origin callback invokes `callback(new Error('Not allowed by CORS'))`)
- `api/src/index.ts:22` (cors mounted at root, before request-id / error-handler middleware)

## Description

The CORS origin callback (`invoiceRoutes.ts:183-198`) signals a disallowed origin by calling `callback(new Error('Not allowed by CORS'))`. Because cors is mounted at the root before the request-id and error-handler middleware (`index.ts:22`), a disallowed origin produces a generic 500 `INTERNAL_ERROR` rather than a clear CORS / 4xx outcome.

## Impact

- Clients and operators cannot distinguish a CORS policy rejection from a genuine server fault.
- 500s on policy rejections pollute error metrics and obscure real failures.

## Suggested Fix

- Return `callback(null, false)` for disallowed origins (omitting CORS headers without throwing), or
- Map the CORS error to a deterministic 403 in the error handler.

## Acceptance Criteria

- [ ] A disallowed origin yields a deterministic, non-500 response (CORS rejection or 403).
- [ ] Genuine server faults remain distinguishable from CORS rejections.
- [ ] Regression test: a request from a disallowed origin does not return HTTP 500 / `INTERNAL_ERROR`.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#272](https://github.com/xlabtg/tonbankcard-protocol/issues/272)
