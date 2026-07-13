---
title: wallet-ui generateConnectLink interpolates paymentHubAddress into a ton:// deep link without validation or encoding
severity: Medium
area: wallet-ui
priority: medium
stage: 3-medium
labels:
  - bug
  - audit
  - type:frontend
  - type:security
  - priority:medium
  - stage:3-medium
  - package:wallet-ui
  - track:A
---

## Summary

`WalletApp.generateConnectLink()` builds a `ton://transfer/...` deep link by
directly interpolating `this.config.paymentHubAddress` into the URL path with a
template literal — **no `Address.parse` validation and no URL encoding**:

```ts
return `ton://transfer/${this.config.paymentHubAddress}?text=${text}`;
```

The result is assigned to an anchor's `href` (`link.href =
this.generateConnectLink()`). A `paymentHubAddress` that is attacker-influenced
or simply malformed can inject extra query parameters (e.g. `...?amount=...&`)
or otherwise reshape the deep link, changing what the user's wallet pre-fills.
This is the same class of deep-link injection already fixed for the mobile
surfaces in FRONTEND-H1 (#264) and FRONTEND-H2 (#265); wallet-ui was not covered
then. The repo already ships the correct hardened helper — `buildTonTransferLink`
in `wallet-ui/src/tonconnect/deepLink.ts` — which this method fails to use.

## Severity & Category

- Severity: Medium
- Category: Input validation / deep-link (URL) injection

## Affected Code

- `wallet-ui/src/components/WalletApp.ts:214-217` (`generateConnectLink` — raw
  interpolation of `paymentHubAddress`, no validation, no `encodeURIComponent`).
- `wallet-ui/src/components/WalletApp.ts:725` (`link.href =
  this.generateConnectLink()` — consumed into an anchor `href`).
- `wallet-ui/src/components/WalletApp.ts:84-98` (constructor — checks
  `paymentHubAddress` is present but never validates it as a TON address).
- Correct helper to reuse: `wallet-ui/src/tonconnect/deepLink.ts:98-120`
  (`buildTonTransferLink` — `assertValidAddress` via `Address.parse` +
  `encodeURIComponent(address)`).

## Description

`generateConnectLink` is already imported alongside `buildTonTransferLink`
(the file uses `buildTonTransferLink` elsewhere, e.g. line 302), so the safe
path exists but is bypassed here. Because the address is dropped into the URL
path unencoded, a value containing `?`, `&`, `#`, or path separators is
interpreted as URL structure rather than as an address, letting a caller inject
query parameters into the `ton://transfer` link the user is about to open.
Even absent an active attacker, a malformed address produces a broken link with
no early error — the constructor accepts any non-empty string.

## Impact

- A crafted or misconfigured `paymentHubAddress` can inject parameters into the
  wallet deep link (e.g. force an `amount`, append fields), altering the
  transaction the wallet pre-fills for the user.
- Inconsistent with the already-hardened mobile deep-link builders (#264/#265),
  leaving wallet-ui as the last unguarded surface of this class.

## Suggested Fix

- Rebuild `generateConnectLink` on top of `buildTonTransferLink({ address:
  this.config.paymentHubAddress, text: 'TONBANKCARD Wallet Connection' })`, which
  validates the address with `Address.parse` and `encodeURIComponent`s it.
- Validate `paymentHubAddress` once in the constructor (via `Address.parse`) so
  a bad value fails fast at construction rather than at link-generation time.

## Acceptance Criteria

- [ ] `generateConnectLink()` produces a link with a validated, encoded address.
- [ ] Constructing `WalletApp` with an invalid `paymentHubAddress` throws.
- [ ] A regression test asserts an injection-style address (`...?amount=1&`) is
      rejected / encoded, and that a valid address still yields a working link.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- Prior art (same class, mobile): FRONTEND-H1 (#264), FRONTEND-H2 (#265).
- Hardened helper: `wallet-ui/src/tonconnect/deepLink.ts`.

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/410
