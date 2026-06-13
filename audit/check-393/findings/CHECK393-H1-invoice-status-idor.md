---
title: GET /v1/invoice/:id/status authenticates the API key but never binds it to the invoice owner (cross-merchant IDOR)
severity: High
area: api
priority: high
stage: 2-high
labels:
  - bug
  - audit
  - type:backend
  - type:security
  - priority:high
  - stage:2-high
  - package:api
  - track:A
---

## Summary

`InvoiceService.getInvoiceStatus` is reachable through the authenticated
`GET /v1/invoice/:invoice_id/status` route (scope `invoice:status`). The
handler validates that the caller presents a valid, permitted API key, but it
**never checks that the key belongs to the merchant that owns the invoice**.
Any merchant with a valid key can therefore read the status — including the
full `settlement` object (payer NFT, merchant NFT, amount, tx hash, payload
hash, on-chain verification URL) — of **any other merchant's invoice** by id.
This is a classic IDOR / broken object-level authorization.

The sibling method `getInvoiceDetail` (same file) does perform the binding via
`isAuthorizedMerchant`; `getInvoiceStatus` was left with only a commented-out
`TODO`.

## Severity & Category

- Severity: High
- Category: Access Control (IDOR / broken object-level authorization) / PII &
  settlement-data disclosure

A valid API key authenticates *who is calling*; it does not authorize *which
invoice they may read*. Authorization correctness is a core protocol invariant,
and settlement records expose counterparties and amounts across merchants.

## Affected Code

- `api/src/services/InvoiceService.ts:454-499` (`getInvoiceStatus` — no
  `isAuthorizedMerchant` call; only a commented-out TODO at 458-464; returns
  `settlement: invoice.settlement` at 497)
- `api/src/services/InvoiceService.ts:403-422` (`getInvoiceDetail` — the
  correct sibling that *does* bind the key to `invoice.merchant_nft`)
- `api/src/routes/invoiceRoutes.ts:139-151` (status handler)
- `api/src/routes/invoiceRoutes.ts:275-280` (route wiring:
  `authenticateWithPermission('invoice:status')` + rate limiter — validates the
  key and permission, but not ownership)

## Description

`getInvoiceStatus` looks the invoice up by id and returns its status and
settlement with no authorization gate:

```ts
// api/src/services/InvoiceService.ts:454-499 (abridged)
async getInvoiceStatus(invoiceId: string, merchantApiKey: string) {
  // TODO: In production, validate merchantApiKey
  // if (!this.isValidApiKey(merchantApiKey)) { ... }   // <-- still commented out
  validateInvoiceId(invoiceId);
  const invoice = await this.invoiceStorage.get(invoiceId);
  if (!invoice) { throw new ValidationError(ErrorCode.INVOICE_NOT_FOUND, ...); }
  // ...expiry transition...
  return {
    invoice_id: invoice.invoice_id,
    status: invoice.status,
    created_at: invoice.created_at,
    expires_at: invoice.expires_at,
    settlement: invoice.settlement,   // <-- full Settlement, any caller
  };
}
```

Compare the correct sibling, which binds the caller's key to the invoice's
merchant before returning anything:

```ts
// api/src/services/InvoiceService.ts:403-422 (getInvoiceDetail)
if (!this.apiKeyService.isAuthorizedMerchant(merchantApiKey, invoice.merchant_nft)) {
  throw new ValidationError(ErrorCode.UNAUTHORIZED_MERCHANT,
    'API key not authorized for this invoice');
}
```

The route middleware `authenticateWithPermission('invoice:status')` only
guarantees the key is valid and carries the `invoice:status` permission; it has
no knowledge of which invoice is being requested, so it cannot enforce
ownership. The ownership check must happen in the service, exactly as
`getInvoiceDetail` does.

This is **distinct** from the already-tracked `API-H4` (#253), which concerns
the *unauthenticated* public `GET /v1/invoice/:invoice_id` endpoint leaking PII
to anyone; that remediation added the authenticated `/detail` route with an
ownership check but left the pre-existing `/status` endpoint with
authentication-but-no-authorization.

## Impact

- Any merchant holding a valid `invoice:status`-scoped key can enumerate or
  look up other merchants' invoice ids and read their settlement records:
  payer NFT, merchant NFT, settled amount, transaction hash, payload hash and
  on-chain verification URL.
- Cross-merchant disclosure of commercial counterparties, amounts and on-chain
  references — a confidentiality breach and a competitive-intelligence vector.

## Suggested Fix

- In `getInvoiceStatus`, after loading the invoice, enforce the same binding as
  `getInvoiceDetail`:
  `if (!this.apiKeyService.isAuthorizedMerchant(merchantApiKey, invoice.merchant_nft)) throw new ValidationError(ErrorCode.UNAUTHORIZED_MERCHANT, ...)`.
- Return `INVOICE_NOT_FOUND` (rather than `UNAUTHORIZED_MERCHANT`) for invoices
  the caller does not own if you wish to avoid id-existence oracles — pick one
  policy and apply it consistently with `/detail`.
- Remove the misleading commented-out `TODO` so the security control is real,
  not aspirational.

## Acceptance Criteria

- [ ] `getInvoiceStatus` rejects a valid key that does not own the invoice.
- [ ] A key that *does* own the invoice still receives the status + settlement.
- [ ] Regression test: merchant A's key requesting merchant B's invoice
      `/status` is rejected; merchant A's key on its own invoice succeeds.
- [ ] No commented-out authorization TODO remains in the handler.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/393
- Related but distinct: `audit/findings/API-H4-public-invoice-endpoint-pii-leak.md` (#253)
- `audit/THREAT_MODEL.md`, `audit/INVARIANTS.md`

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/395
