---
title: "[SDK-M5] generateInvoiceId/createPayloadHash use non-canonical serialization, breaking cross-SDK hash matching"
severity: medium
area: sdk
priority: medium
stage: 3
labels: ["bug","audit","type:sdk","priority:medium","stage:3-medium"]
---

## Summary

`generateInvoiceId` and `createPayloadHash` hash a string/JSON concatenation whose field order, whitespace, and encoding are not canonicalized. The same logical invoice can therefore hash to different values across the TypeScript, Go, and Python SDKs, breaking cross-SDK payload-hash matching.

## Severity & Category

- Severity: Medium
- Category: Cross-implementation consistency / determinism

## Affected Code

- `sdk/src/utils.ts:32-60` (`generateInvoiceId`, `createPayloadHash`)

## Description

```ts
// sdk/src/utils.ts:36-44
const data = [
  merchantNft.toString(),
  amountTbc.toString(),
  orderId || '',
  timestamp.toString(),
].join('|');

const hash = sha256_sync(data);
```

```ts
// sdk/src/utils.ts:56-59
export function createPayloadHash(payload: Record<string, any>): bigint {
  const data = JSON.stringify(payload);
  const hash = sha256_sync(data);
  return BigInt('0x' + Buffer.from(hash).toString('hex'));
}
```

`createPayloadHash` relies on `JSON.stringify`, whose key order follows insertion order and whose whitespace/encoding are not specified for cross-language equivalence. `generateInvoiceId` uses a `|`-joined string whose exact field order, address rendering, and integer formatting must be matched byte-for-byte by every other SDK to produce the same hash — there is no shared canonical specification guaranteeing that.

## Impact

- The same logical invoice/payload can hash differently in TS vs Go vs Python, so a payload hash computed by one SDK will not match the value expected on-chain or by another SDK.
- Cross-SDK and SDK-vs-server payload-hash comparisons silently fail, undermining settlement matching.

## Suggested Fix

- Define a single canonical byte serialization shared by all SDKs: fixed field order, fixed field encodings (e.g. address raw form, BigInt as decimal string), and no incidental whitespace.
- Document the canonical form and implement it identically in TypeScript, Go, and Python.
- For object payloads, sort keys and use a deterministic encoding rather than language-default JSON serialization.

## Acceptance Criteria

- [ ] A canonical serialization (fixed field order, fixed encodings, BigInt as decimal string) is defined and documented.
- [ ] TypeScript, Go, and Python implementations produce byte-identical serialization for the same logical input.
- [ ] A cross-SDK regression test (shared fixtures) asserts that `generateInvoiceId`/`createPayloadHash` produce identical hashes across all three SDKs.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/INVARIANTS.md`

---

**Tracking issue:** [#295](https://github.com/xlabtg/tonbankcard-protocol/issues/295)
