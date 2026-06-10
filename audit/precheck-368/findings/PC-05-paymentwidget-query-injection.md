---
title: PaymentWidget builds ton:// deep link with raw, unencoded merchantNft and amount (query injection)
severity: Medium
area: sdk
priority: medium
stage: 3-medium
labels:
  - bug
  - type:sdk
  - type:security
  - priority:medium
  - audit
  - stage:3-medium
---

## Summary

`sdk/src/widget/PaymentWidget.ts` constructs the wallet deep link by interpolating `merchantNft`, `amount`, and `text` directly into the URL with no percent-encoding or validation. A crafted value can inject additional query parameters (e.g. override `amount`, append `bin`/`text`), the same defect class previously fixed in audit findings #264/#265.

## Severity & Category

- Severity: Medium
- Category: Input validation / URL/query injection

## Affected Code

- `sdk/src/widget/PaymentWidget.ts:136-155` (link construction)
- `sdk/src/widget/PaymentWidget.ts:81-97` (constructor validates only truthiness)

## Description

```ts
const link = `ton://transfer/${this.config.merchantNft}?amount=${amount}&text=${text}`;
```

`merchantNft` and `amount` are interpolated raw. The constructor only checks that the fields are present (truthy), not that they are well-formed or safe to embed. A `merchantNft` or `amount` containing `&`, `?`, `#`, or whitespace can introduce or override query parameters in the generated link.

For contrast, the sibling mobile app (`mobile-app/src/services/PaymentService.ts`) already wraps each interpolated component in `encodeURIComponent`.

## Impact

- A malicious or mistaken merchant/integration value can alter the payment parameters the user's wallet receives (e.g. redirect amount/text), undermining payment integrity.

## Suggested Fix

- Wrap every interpolated component in `encodeURIComponent(...)`.
- Validate `merchantNft` against the expected TON address format and `amount` as a non-negative numeric string before building the link.

## Acceptance Criteria

- [ ] All deep-link components are percent-encoded.
- [ ] `merchantNft`/`amount` are format-validated before use.
- [ ] Regression test: a value containing `&amount=` cannot inject/override query params.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- Prior related findings: #264, #265
