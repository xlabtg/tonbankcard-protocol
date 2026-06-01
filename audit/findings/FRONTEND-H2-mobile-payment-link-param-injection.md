---
title: "[FRONTEND-H2] Query-parameter injection in mobile PaymentService.generatePaymentLink"
severity: high
area: frontend
priority: high
stage: 2
labels: ["bug","audit","type:frontend","type:security","priority:high","stage:2-high"]
---

## Summary

`PaymentService.generatePaymentLink` in the mobile core builds a `ton://transfer` deep link by string-concatenating user-controlled fields (`merchantNft`, `amountTbc`) without URL-encoding them. This allows query-parameter injection identical to FRONTEND-H1: a value containing `&` or `=` injects additional parameters into the generated deep link.

## Severity & Category

- Severity: High
- Category: Security / Query-parameter (deep-link) injection

## Affected Code

- `mobile/src/services/PaymentService.ts:44-61` — `generatePaymentLink`, specifically the unencoded interpolation at `mobile/src/services/PaymentService.ts:54`.

## Description

`merchantNft` and `amountTbc` are interpolated verbatim into the query string; only `text` and `returnUrl` are encoded:

```ts
// mobile/src/services/PaymentService.ts:53-60
const text = encodeURIComponent(parts);
let link = `ton://transfer/${request.merchantNft}?amount=${request.amountTbc}&text=${text}`;

if (request.returnUrl) {
  link += `&return=${encodeURIComponent(request.returnUrl)}`;
}

return link;
```

A crafted `amountTbc = "10&bin=<attacker-payload>"` produces:

```
ton://transfer/<merchantNft>?amount=10&bin=<attacker-payload>&text=...
```

injecting an arbitrary parameter the caller never intended. The same applies to `merchantNft`, which is also used downstream in `mobile-app/src/lib/tonconnect/deepLink.ts` to construct universal wallet links (`buildPaymentDeepLink`), widening the affected surface.

## Impact

- A caller passing attacker-influenced amount/address values can emit a deep link whose parameters differ from those intended.
- The injected parameters are presented to the user's wallet as legitimate, undermining the integrity of the payment request shown for approval.
- The non-custodial guarantee is intact (no keys are touched and the wallet still requires explicit consent), but the integrity of the payment intent is degraded.

## Suggested Fix

- Build the query string with `URLSearchParams`/`encodeURIComponent` so every field is encoded exactly once.
- Validate `amountTbc` (non-negative numeric string) and `merchantNft` (TON address) before encoding; reject malformed input. Note that `isValidTonAddress` already exists in `mobile/src/utils.ts` and should gate `merchantNft`.
- The fix is confined to link construction and preserves the non-custodial design.

```ts
const query = new URLSearchParams();
query.set('amount', assertAmount(request.amountTbc));
query.set('text', parts);
if (request.returnUrl) query.set('return', request.returnUrl);
return `ton://transfer/${encodeURIComponent(request.merchantNft)}?${query.toString()}`;
```

## Acceptance Criteria

- [ ] Every field interpolated into the deep link is encoded exactly once.
- [ ] `amountTbc` is validated against a non-negative numeric pattern before encoding; invalid values are rejected.
- [ ] `merchantNft` is validated via `isValidTonAddress` before use.
- [ ] No additional query parameters can be injected through any input field.
- [ ] The fix introduces no key handling or signing in the frontend (non-custodial property preserved).
- [ ] Regression test: `generatePaymentLink({ amountTbc: '10&bin=evil', merchantNft: <valid> })` yields a single encoded `amount` parameter (or is rejected), with no injected `bin`/`amount` parameter.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-H1-dashboard-invoice-link-param-injection.md`
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#265](https://github.com/xlabtg/tonbankcard-protocol/issues/265)
