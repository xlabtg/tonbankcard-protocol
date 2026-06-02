---
title: "[API-H2] trust proxy is never configured on the production app"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

The production Express app never sets `trust proxy`, even though the rate limiter documents that it is required when running behind a load balancer so that `req.ip` reflects the true client. As a result the per-IP limiter sees the proxy's address, collapsing all clients into one bucket — and any later trust of a forwarding header would allow spoofing.

## Severity & Category

- Severity: High
- Category: Rate Limiting / Network Configuration

## Affected Code

- `api/src/index.ts:19-36` (missing `app.set('trust proxy', ...)`)
- `api/src/middleware/rateLimiter.ts:130-132` (documents the requirement)
- `api/src/__tests__/rateLimiter.test.ts:54,102` (tests set it; production does not)

## Description

`rateLimiter.ts:130-132` documents that `trust proxy` must be configured behind a load balancer so `req.ip` resolves to the real client. The tests set it (`rateLimiter.test.ts:54,102`), but `src/index.ts` (lines 19-36) never calls `app.set('trust proxy', ...)`.

Behind a proxy/LB:

- The per-IP limiter and the per-key limiter's IP fallback observe the proxy IP rather than the client IP. All clients share a single bucket, causing denial of service / global lockout.
- Conversely, if a forwarding header (e.g. `X-Forwarded-For`) is later trusted without restricting trusted hops, clients can spoof the header to bypass limits.

## Impact

- Shared-bucket behavior enables one client to exhaust the limit for everyone (DoS / lockout).
- Misapplied trust opens header-spoofing bypass of rate limits.

## Suggested Fix

- Set `trust proxy` to the specific hop count or trusted-proxy CIDR matching the deployment topology (not blanket `true`).
- Document the configured value alongside the deployment instructions.

## Acceptance Criteria

- [ ] Production app sets `trust proxy` to a deployment-appropriate hop count / trusted CIDR.
- [ ] `req.ip` reflects the real client behind the configured proxy.
- [ ] Configured value is documented for operators.
- [ ] Regression test: with a simulated proxy hop, distinct client IPs receive distinct rate-limit buckets.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/BUILD_INSTRUCTIONS.md`

---

**Tracking issue:** [#251](https://github.com/xlabtg/tonbankcard-protocol/issues/251)
