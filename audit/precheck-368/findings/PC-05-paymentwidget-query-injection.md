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

## Resolution

**RESOLVED ✅ (Issue #374 / PC-05)** — PR
[#388](https://github.com/xlabtg/tonbankcard-protocol/pull/388), branch
`issue-374-7271c4b2bc1f`.

`generatePaymentLink` (`sdk/src/widget/PaymentWidget.ts:174-196`) now **validates
then percent-encodes** every interpolated component, so a crafted value can no
longer inject or override query parameters:

```ts
const merchantNft = assertMerchantNft(this.config.merchantNft);
const amount = assertAmount(this.config.amountTbc);
// ...
let link = `ton://transfer/${encodeURIComponent(
  merchantNft
)}?amount=${encodeURIComponent(amount)}&text=${text}`;
```

Two dependency-free validators back the fix:

- `assertAmount` (`sdk/src/amount.ts:90-95`) rejects anything that is not a
  non-negative integer string (`/^\d+$/`), blocking `10&bin=evil`, `-100`,
  `NaN`, and decimals.
- `assertMerchantNft` (`sdk/src/widget/PaymentWidget.ts:39-47`) accepts only a
  well-formed TON address — user-friendly base64url (48 chars) or raw
  `workchain:account_hex` — via
  `/^(?:-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{48})$/`.

The validator is a deliberate **regex format check** rather than a
`@ton/core` `Address.parse` checksum: the widget ships in the `<script>`-tag
browser/IIFE bundle (`src/browser.ts`, `dist/index.global.js`) which must stay
free of `@ton/core` / `@ton/crypto`. Combined with `encodeURIComponent` the
format check is sufficient to stop query injection; the build artifacts were
verified to contain **zero** `@ton/*` references. This mirrors the sibling
mobile fix (`mobile/src/services/PaymentService.ts`, FRONTEND-H2).

**Regression coverage** — CI-enforced suite
(`sdk/tests/widget.spec.ts`, `describe('generatePaymentLink security (PC-05)')`,
job *Test SDK*), 10 tests: injection through `amountTbc` (`10&bin=evil`) throws
and emits no `bin=evil`; non-numeric/negative amounts rejected; an invalid
`merchantNft` (`not-an-address&injected=1`) throws and emits no `bin=evil`;
raw-form addresses are percent-encoded in the path (`:` → `%3A`); exactly one
`[?&]amount=` parameter for a valid request; and reserved characters injected
via `orderId` (`1&amount=999`) / `description` (`gift&bin=evil`) are encoded
once inside the `text` field rather than becoming standalone parameters.

## Acceptance Criteria

- [x] All deep-link components are percent-encoded.
- [x] `merchantNft`/`amount` are format-validated before use.
- [x] Regression test: a value containing `&amount=` cannot inject/override query params.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
- Prior related findings: #264, #265
