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

## Acceptance Criteria

- [ ] `mobile/` request URLs percent-encode interpolated identifiers.
- [ ] HTTPS enforcement parses the URL and checks the protocol.
- [ ] `autoVerify` is only present on http/https App Links filters (or removed).

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
