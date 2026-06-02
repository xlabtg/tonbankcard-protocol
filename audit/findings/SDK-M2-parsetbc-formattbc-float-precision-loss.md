---
title: "[SDK-M2] parseTBC/formatTBC lose precision by routing amounts through JS float"
severity: medium
area: sdk
priority: medium
stage: 3
labels: ["bug","audit","type:sdk","priority:medium","stage:3-medium"]
---

## Summary

`formatTBC` and `parseTBC` convert nanoton amounts through the JavaScript `number` type, which is an IEEE-754 double. Values above 2^53 lose precision, so large amounts are formatted or parsed incorrectly.

## Severity & Category

- Severity: Medium
- Category: Numeric correctness

## Affected Code

- `sdk/src/utils.ts:69-86` (`formatTBC`, `parseTBC`)

## Description

```ts
// sdk/src/utils.ts:69-72
export function formatTBC(nanocoins: bigint, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
}
```

```ts
// sdk/src/utils.ts:80-86
export function parseTBC(tbc: string): bigint {
  const num = parseFloat(tbc);
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid TBC amount');
  }
  return BigInt(Math.floor(num * 1e9));
}
```

`Number(nanocoins)` and `parseFloat(tbc)` both produce doubles. For amounts beyond `Number.MAX_SAFE_INTEGER` (2^53 - 1) — well within the protocol's documented 2^120-1 range — the conversion is lossy, so round-tripping a value through these helpers does not preserve it.

## Impact

- Large TBC amounts are mis-formatted and mis-parsed, producing incorrect displayed values and incorrect nanoton conversions.
- Loss of precision in monetary values can cause under/over-charging when these helpers feed invoice or display logic.

## Suggested Fix

- Use BigInt arithmetic end-to-end.
- Format by integer division/modulo against `10^9` and assemble the decimal string from integer parts.
- Parse by splitting on the decimal point and combining integer string operations, without ever constructing a float.

## Acceptance Criteria

- [ ] `formatTBC` and `parseTBC` perform no float conversion; all arithmetic is BigInt/integer-string based.
- [ ] A regression test round-trips a value greater than 2^53 nanotons through `parseTBC`/`formatTBC` and asserts exact preservation.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#292](https://github.com/xlabtg/tonbankcard-protocol/issues/292)
