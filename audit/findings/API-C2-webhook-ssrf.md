---
title: "[API-C2] Webhook delivery has no SSRF protection"
severity: critical
area: backend
priority: critical
stage: 1
labels: ["bug","audit","type:backend","type:security","priority:critical","stage:1-critical"]
---

## Summary

Merchant-supplied webhook URLs are stored and later fetched with no validation. There is no scheme allowlist, no host/IP allowlist, no blocking of loopback, link-local, or private ranges, and `fetch` follows redirects. A merchant can direct the server to make requests to internal services or the cloud metadata endpoint (Server-Side Request Forgery).

## Severity & Category

- Severity: Critical
- Category: Server-Side Request Forgery (SSRF)

## Affected Code

- `api/src/services/WebhookService.ts:81-93` (register stores merchant-supplied URL with no validation)
- `api/src/services/WebhookService.ts:152-160` (deliver performs `fetch(endpoint.url)`)

## Description

Registration stores the URL verbatim with zero validation (`WebhookService.ts:81-93`), and delivery fetches it directly:

```ts
// WebhookService.ts:152-160
await fetch(endpoint.url, /* ... */);
```

There is:

- No scheme allowlist (HTTPS-only not enforced).
- No host/IP allowlist.
- No blocking of `localhost` / loopback, `169.254.169.254` (cloud metadata), or RFC1918 private ranges.
- No DNS-rebinding mitigation (the host is not re-resolved/validated at connection time).

Additionally, `fetch` follows redirects by default, so a benign-looking HTTPS endpoint can return a 302 redirecting to an internal address, bypassing any naive front-door check.

## Impact

- A merchant can point a webhook at internal-only services or the cloud metadata service (`169.254.169.254`), potentially exfiltrating credentials/tokens or reaching internal infrastructure.
- Redirect following lets an external HTTPS host pivot the request to internal targets.
- This is a server compromise vector independent of the non-custodial design.

## Suggested Fix

- Validate the URL both at registration and at delivery time:
  - Require `https:` scheme.
  - Resolve the host and reject loopback, link-local (`169.254.0.0/16`), multicast, and RFC1918 / private ranges (IPv4 and IPv6 equivalents).
  - Set `redirect: 'error'` (or re-validate every redirect hop against the same rules).
  - Optionally enforce an operator-configured allowlist of permitted hosts.
- Re-resolve and re-validate the destination at connection time to mitigate DNS rebinding.

## Acceptance Criteria

- [ ] Webhook registration rejects non-HTTPS URLs and URLs resolving to loopback/link-local/private/multicast addresses.
- [ ] Delivery refuses to follow redirects to disallowed destinations.
- [ ] Cloud metadata endpoint (`169.254.169.254`) is unreachable via webhook delivery.
- [ ] Regression test: attempts to register/deliver to `http://`, `http://localhost`, `http://169.254.169.254`, and an HTTPS endpoint that 302-redirects to a private IP are all blocked.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#244](https://github.com/xlabtg/tonbankcard-protocol/issues/244)
