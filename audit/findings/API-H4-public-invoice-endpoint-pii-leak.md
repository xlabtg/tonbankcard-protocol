---
title: "[API-H4] Public invoice endpoint leaks merchant data / PII with no authentication"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

`GET /v1/invoice/:invoice_id` is unauthenticated and returns the full invoice object, including merchant identity and arbitrary metadata that may contain customer PII (email, order id). Anyone who has or guesses an invoice id can read merchant and customer details.

## Severity & Category

- Severity: High
- Category: Broken Access Control / Information Disclosure (PII)

## Affected Code

- `api/src/routes/invoiceRoutes.ts:87-95,207`
- `api/src/services/InvoiceService.ts:218-238`
- `api/src/types/invoice.ts:24` (metadata may hold `customer_email`)

## Description

The public endpoint `GET /v1/invoice/:invoice_id` (`invoiceRoutes.ts:87-95,207`) is unauthenticated and returns the full `Invoice` as produced by `InvoiceService.ts:218-238`. This includes `merchant_nft`, `amount_tbc`, and arbitrary `metadata`, which may contain `customer_email` (`types/invoice.ts:24`) and `order_id`.

Anyone with or guessing an invoice id can read the merchant's identity, transaction amounts, and embedded customer PII.

## Impact

- Disclosure of merchant identity (`merchant_nft`) and transaction amounts to unauthenticated parties.
- Disclosure of customer PII (email, order id) stored in metadata.
- Enables enumeration/correlation of merchant activity if invoice ids are guessable.

## Suggested Fix

- For the public (payer-facing) view, return only the fields a payer needs: amount, currency, status, expiry, and payment URL.
- Strip merchant metadata and PII from the public response.
- Require authentication for any detailed/merchant view of an invoice.

## Acceptance Criteria

- [ ] The unauthenticated endpoint returns only payer-required fields (amount, currency, status, expiry, payment URL).
- [ ] `merchant_nft` and arbitrary/PII-bearing metadata are not exposed without authentication.
- [ ] An authenticated route exists for full invoice detail (if needed).
- [ ] Regression test: an unauthenticated `GET /v1/invoice/:invoice_id` response contains no `merchant_nft`, `customer_email`, or `order_id`.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#253](https://github.com/xlabtg/tonbankcard-protocol/issues/253)
