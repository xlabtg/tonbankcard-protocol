---
title: "[API-M3] helmet declared as a dependency but never applied"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","type:security","priority:medium","stage:3-medium"]
---

## Summary

`helmet` is listed as a dependency but is never registered as middleware. The app applies only CORS and `express.json`, so standard security response headers (HSTS, no-sniff, frame options) are absent.

## Severity & Category

- Severity: Medium
- Category: Security Headers / Defense in Depth

## Affected Code

- `api/package.json:40` (helmet dependency)
- `api/src/index.ts:19-36` (only `cors` + `express.json`; no `app.use(helmet())`)

## Description

`helmet` appears in `package.json:40`, but the app setup in `index.ts:19-36` registers only `cors` and `express.json()`. There is no `app.use(helmet())`, so the standard hardening headers helmet provides (HSTS, `X-Content-Type-Options: nosniff`, frame options, etc.) are not sent.

## Impact

- Responses lack baseline security headers, reducing defense-in-depth against clickjacking, MIME sniffing, and downgrade attacks.

## Suggested Fix

- Apply `app.use(helmet())` early in the middleware chain, or remove the unused dependency if it is intentionally not used.

## Acceptance Criteria

- [ ] Either helmet is applied early in the middleware chain or the dependency is removed.
- [ ] If applied, responses include the expected security headers.
- [ ] Regression test: a sample response asserts the presence of helmet-provided headers (e.g. `X-Content-Type-Options: nosniff`).

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#271](https://github.com/xlabtg/tonbankcard-protocol/issues/271)
