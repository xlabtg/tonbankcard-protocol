---
title: Mobile client hardening — unencoded URL path interpolation, weak HTTPS prefix check, no-op Android autoVerify
severity: Low
area: frontend/mobile
priority: low
stage: 4-low
labels:
  - type:frontend
  - type:security
  - priority:low
  - audit
  - stage:4-low
---

## Summary

Three low-severity hardening issues in the mobile clients: (1) the `mobile/` app interpolates `nftAddress`/`txId` directly into request URLs without `encodeURIComponent`; (2) `mobile-app/`'s HTTPS enforcement uses a case-sensitive `startsWith('https://')` string check instead of real URL parsing; (3) `mobile-app/`'s Android manifest sets `autoVerify="true"` on a custom-scheme (`tonbankcard`) intent-filter, where `autoVerify` is a no-op (it only applies to http/https App Links).

## Severity & Category

- Severity: Low
- Category: Input validation / Defensive hardening

## Affected Code

- `mobile/src/services/PaymentService.ts:95` (`/transactions/${nftAddress}`)
- `mobile/src/services/PaymentService.ts:138` (`/transaction/${txId}`)
- `mobile/src/services/AccountService.ts:45` (`/account/${nftAddress}`)
- `mobile-app/src/lib/config.ts:28-36` (`assertHttpsEndpoint` uses `url.startsWith('https://')`)
- `mobile-app/android/app/src/main/AndroidManifest.xml:46-50` (`autoVerify="true"` on `android:scheme="tonbankcard"`)

## Description

**1. Unencoded path interpolation.** The `mobile/` services build fetch URLs by interpolating identifiers raw:

```ts
const response = await fetch(`${this.config.apiEndpoint}/transactions/${nftAddress}`);
```

If `nftAddress`/`txId` contain URL-significant characters, the request path/query can be altered. The sibling `mobile-app/` app already wraps interpolated components in `encodeURIComponent`, establishing the intended convention.

**2. Weak HTTPS check.** `assertHttpsEndpoint` only checks the literal lowercase prefix `https://`. It does not parse the URL, so it rejects valid uppercase schemes (`HTTPS://`) and does not validate host/structure. Using `new URL(url)` and checking `protocol === 'https:'` is more robust.

**3. No-op `autoVerify`.** Android's `android:autoVerify="true"` only triggers App Links verification for `http`/`https` data schemes. On a custom `tonbankcard` scheme it has no effect and can give a false sense of link-verification security.

## Impact

- Low: edge-case URL manipulation in the mobile client, brittle HTTPS validation, and a misleading manifest attribute. No direct fund-loss path identified.

## Suggested Fix

- Wrap `nftAddress`/`txId` in `encodeURIComponent` in `mobile/` services (mirror `mobile-app/`).
- Replace the prefix check with `new URL(url).protocol === 'https:'` (guarded by try/catch).
- Remove `autoVerify="true"` from the custom-scheme intent-filter, or move it to a real http/https App Links intent-filter with a verified `assetlinks.json`.

## Resolution

**RESOLVED ✅ (Issue #378 / PC-09)** — PR
[#392](https://github.com/xlabtg/tonbankcard-protocol/pull/392), branch
`issue-378-694838575fe6`.

All three hardening issues are fixed, each backed by a CI-enforced regression:

1. **Percent-encoded path interpolation (`mobile/`).** The three request-URL
   builders now wrap the caller-supplied identifier in `encodeURIComponent`,
   matching the convention already used by `mobile-app/`:
   `PaymentService.getTransactionHistory` →
   `/transactions/${encodeURIComponent(nftAddress)}`,
   `PaymentService.getTransactionById` →
   `/transaction/${encodeURIComponent(txId)}`, and
   `AccountService.getAccount` → `/account/${encodeURIComponent(nftAddress)}`. A
   crafted id such as `../admin?inject=1&x=2` can no longer traverse the path or
   smuggle query parameters; an ordinary base64url address (no reserved
   characters) is preserved byte-for-byte.
2. **HTTPS check parses the URL.** `assertHttpsEndpoint` now parses the value
   with the WHATWG `URL` constructor (guarded by try/catch) and asserts
   `parsed.protocol === 'https:'` instead of a case-sensitive
   `startsWith('https://')`. This accepts valid mixed-case schemes
   (`HTTPS://…`, normalized to `https:`) and rejects non-HTTPS schemes
   (`http:`, `ftp:`, `javascript:`) and malformed/schemeless input. Both
   failure paths keep the existing `must use HTTPS` message, mirroring the
   HTTPS-only guard already enforced by `HttpsClient.fetch`.
3. **No-op `autoVerify` removed.** The custom `tonbankcard`-scheme intent-filter
   in `AndroidManifest.xml` no longer carries `android:autoVerify="true"`; a
   comment documents that App Links verification only runs for http/https
   schemes and how to add a real verified filter (with a hosted
   `/.well-known/assetlinks.json`) if ever needed.

**CI-enforced regressions** (job *Test*, `.github/workflows/ci.yml`):

- *Test mobile-core* — `mobile/tests/payment-service.spec.ts`
  (`describe('request URL hardening (PC-09)')`) and
  `mobile/tests/account-service.spec.ts`
  (`describe('getAccount request URL hardening (PC-09)')`) spy on `fetch` and
  assert the requested URL equals the `encodeURIComponent`-encoded path for
  crafted identifiers, and is unchanged for an ordinary address.
- *Test mobile-app* — `mobile-app/tests/config/config.spec.ts` covers the
  mixed-case-accept and `ftp:`/`javascript:`/mixed-case-`http`/malformed-reject
  cases; `mobile-app/tests/android/manifest.spec.ts`
  (`describe('AndroidManifest deep-link intent-filters (PC-09)')`) parses the
  real manifest and asserts `autoVerify` never sits on a custom-scheme filter.

A standalone before/after reproduction of all three weaknesses lives in
`experiments/issue-378-mobile-client-hardening/`.

## Acceptance Criteria

- [x] `mobile/` request URLs percent-encode interpolated identifiers.
- [x] HTTPS enforcement parses the URL and checks the protocol.
- [x] `autoVerify` is only present on http/https App Links filters (or removed).

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
