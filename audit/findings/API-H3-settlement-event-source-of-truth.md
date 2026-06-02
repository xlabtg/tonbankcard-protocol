---
title: "[API-H3] processSettlementEvent can mark invoices settled without finality, making the API a source of truth"
severity: high
area: backend
priority: high
stage: 2
labels: ["bug","audit","type:backend","type:security","priority:high","stage:2-high"]
---

## Summary

`processSettlementEvent` accepts a caller-supplied event and marks an invoice `settled` with `on_chain_verified: true` on a field match, even when confirmations are absent. It does not verify the event originated from the chain, contradicting the protocol's non-custodial principle that the blockchain is the single source of truth and the API is informational only.

## Severity & Category

- Severity: High
- Category: Non-Custodial Integrity / Settlement Verification

## Affected Code

- `api/src/services/InvoiceService.ts:404-476`
- `api/src/index.ts:4-5` ("informational only — blockchain is the single source of truth")

## Description

The exported `processSettlementEvent` method takes a caller-supplied event and, on matching `merchant_nft` + `amount_tbc` + `payload_hash`, sets `invoice.status = 'settled'` with `on_chain_verified: true`. Confirmations are optional:

```ts
// InvoiceService.ts:444-451
// when currentBlockNumber is undefined,
// confirmations / is_final are undefined,
// yet the invoice is still marked settled
```

There is no verification that the event actually came from the chain (no trusted/authenticated indexer source, no proof). A forged or unconfirmed event is sufficient to flip an invoice to `settled`. This makes the API a de facto source of truth for settlement, which the project explicitly disclaims (`index.ts:4-5`).

## Impact

- A forged or premature event marks an invoice as settled, misleading merchants into releasing goods/services before on-chain finality.
- The API becomes authoritative for settlement state, violating the non-custodial design where the blockchain is the sole source of truth.

## Suggested Fix

- Never mark an invoice `settled` without verified confirmations `>= MIN_CONFIRMATIONS`.
- Require settlement events to originate from a trusted, authenticated indexer (or be backed by verifiable on-chain proof).
- Treat `is_final === false` (or undefined confirmations) as not settled.

## Acceptance Criteria

- [ ] An event with undefined/insufficient confirmations does not mark the invoice settled.
- [ ] Settlement requires confirmations `>= MIN_CONFIRMATIONS` and `is_final === true`.
- [ ] Events from untrusted/unauthenticated sources are rejected.
- [ ] The API never presents settlement as authoritative independent of chain state.
- [ ] Regression test: a forged event and an unconfirmed event each leave the invoice in a non-settled state.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#252](https://github.com/xlabtg/tonbankcard-protocol/issues/252)
