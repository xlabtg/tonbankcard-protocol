---
title: "[FRONTEND-M1] Float precision loss in money formatting/parsing"
severity: medium
area: frontend
priority: medium
stage: 3
labels: ["bug","audit","type:frontend","type:security","priority:medium","stage:3-medium"]
---

## Summary

Across the frontends, nanocoin amounts are converted to a human-readable string by dividing a JavaScript `number` (IEEE-754 double). For values above `2^53` nanocoins, and for many fractional values, this loses precision and can display or derive an incorrect amount.

## Severity & Category

- Severity: Medium
- Category: Correctness / Numeric precision (financial)

## Affected Code

- `dashboard/src/utils.ts:18-21` — `formatTBC`
- `dashboard/src/utils.ts:60-65` — `formatCurrency`
- `wallet-ui/src/utils.ts:18-21` — `formatTBC`
- `mobile/src/utils.ts:14-17` — `formatTBC`

## Description

All variants route the amount through `Number(...) / 1e9`:

```ts
// dashboard/src/utils.ts:18-21
export function formatTBC(nanocoins: string, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
}
```

```ts
// dashboard/src/utils.ts:60-65
export function formatCurrency(nanocoins: string): string {
  const tbc = Number(nanocoins) / 1e9;
  const parts = tbc.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${integerPart}.${parts[1]} TBC`;
}
```

`Number` can represent integers exactly only up to `Number.MAX_SAFE_INTEGER` (`2^53 - 1 = 9007199254740991`), which is roughly `9,007,199` TBC in nanocoins. Beyond that, the conversion silently rounds. The subsequent floating-point division by `1e9` introduces additional representation error even for in-range values. Amounts originate as integer strings precisely to avoid this; converting through `number` discards that guarantee.

## Impact

- Large balances/amounts (> ~9M TBC in nanocoins) are displayed inaccurately.
- Fractional rounding can show an amount that differs from the on-chain value, which is misleading in a financial UI.
- Any derived value computed from the float (e.g. for re-encoding into a link) could carry the error forward.

## Suggested Fix

- Format directly from the integer string using `BigInt` (or string slicing): split the nanocoin string into integer and fractional parts at the 9th digit from the right, then apply display rounding/grouping on the string representation.
- Never route token amounts through `number`/float for formatting, parsing, or re-encoding.
- This is a display-layer correctness fix only and does not alter the non-custodial design.

## Acceptance Criteria

- [ ] `formatTBC`/`formatCurrency` (and mobile/wallet-ui equivalents) format from the integer string without converting through `number`/float.
- [ ] Amounts above `Number.MAX_SAFE_INTEGER` nanocoins format exactly.
- [ ] Fractional display rounding is performed on the string/`BigInt` representation, not a float.
- [ ] The fix introduces no key handling or signing in the frontend (non-custodial property preserved).
- [ ] Regression test: formatting a large nanocoin string (e.g. `"90071992547409910"`) and edge fractional values produces the exact expected output, verified against a `BigInt` reference.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#287](https://github.com/xlabtg/tonbankcard-protocol/issues/287)
