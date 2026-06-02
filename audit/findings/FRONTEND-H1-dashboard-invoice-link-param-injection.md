---
title: "[FRONTEND-H1] Query-parameter injection in dashboard generateInvoiceLink"
severity: high
area: frontend
priority: high
stage: 2
labels: ["bug","audit","type:frontend","type:security","priority:high","stage:2-high"]
---

## Summary

`generateInvoiceLink` in the merchant dashboard builds a `ton://transfer` payment URL by string-concatenating user-controlled fields without URL-encoding them. A value containing `&` (or `=`) lets an attacker inject additional query parameters into the generated link, potentially overriding the recipient, binary payload, expiration, or other intended parameters.

## Severity & Category

- Severity: High
- Category: Security / Query-parameter (deep-link) injection

## Affected Code

- `dashboard/src/utils.ts:91-112` — `generateInvoiceLink`, specifically the unencoded `amount` interpolation at `dashboard/src/utils.ts:104`.

## Description

The amount and recipient are concatenated directly into the query string. Only the human-readable `text` is encoded:

```ts
// dashboard/src/utils.ts:103-111
const text = encodeURIComponent(textParts);
let link = `ton://transfer/${merchantNft}?amount=${params.amountTbc}&text=${text}`;

if (params.expirationMinutes !== undefined) {
  const expiresAt = Math.floor(Date.now() / 1000) + params.expirationMinutes * 60;
  link += `&exp=${expiresAt}`;
}

return link;
```

Because `params.amountTbc` (and `merchantNft`) are interpolated verbatim, a crafted value such as `amountTbc = "10&bin=<attacker-payload>"` produces:

```
ton://transfer/<merchantNft>?amount=10&bin=<attacker-payload>&text=...
```

This injects a `bin` (or any other) parameter that the wallet will parse. Depending on the value, an attacker can append parameters the dashboard never intended (e.g. a binary payload, a different recipient via a path/scheme trick, or a conflicting `amount`), changing what the user is asked to sign.

## Impact

- A merchant or upstream caller passing attacker-influenced amount/address values can emit a payment link whose parameters differ from what the dashboard intended.
- The user's wallet renders the injected parameters as legitimate, undermining the integrity of the payment request that the user is asked to approve.
- This does not breach the non-custodial guarantee (no keys are handled here and the wallet still requires explicit user consent), but it degrades the integrity of the payment intent the user signs.

## Suggested Fix

- Build the query string with `URLSearchParams` (or `encodeURIComponent` per field) so every field is escaped exactly once.
- Validate field shapes before encoding: require `amountTbc` to match a non-negative integer/decimal pattern and reject otherwise; validate `merchantNft` as a TON address.
- This fix is purely in link construction and preserves the non-custodial design: signing remains entirely inside the user's wallet.

```ts
const query = new URLSearchParams();
query.set('amount', assertAmount(params.amountTbc));
query.set('text', textParts);
if (params.expirationMinutes !== undefined) {
  query.set('exp', String(Math.floor(Date.now() / 1000) + params.expirationMinutes * 60));
}
return `ton://transfer/${encodeURIComponent(merchantNft)}?${query.toString()}`;
```

## Acceptance Criteria

- [ ] Every field interpolated into the link is encoded exactly once (via `URLSearchParams`/`encodeURIComponent`).
- [ ] `amountTbc` is validated against a non-negative numeric pattern before encoding; invalid values are rejected.
- [ ] `merchantNft` is validated as a TON address before use.
- [ ] No additional query parameters can be injected through any input field.
- [ ] The fix introduces no key handling or signing in the frontend (non-custodial property preserved).
- [ ] Regression test: `generateInvoiceLink({ amountTbc: '10&bin=evil', ... })` yields a single `amount` parameter equal to the encoded literal value (or is rejected), with no injected `bin`/`amount` parameter.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-H2-mobile-payment-link-param-injection.md`
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#264](https://github.com/xlabtg/tonbankcard-protocol/issues/264)
