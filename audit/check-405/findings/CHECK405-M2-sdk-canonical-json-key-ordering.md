---
title: TS SDK canonicalJson sorts object keys by UTF-16 code unit, diverging from Go/Python code-point order for astral-plane keys
severity: Medium
area: sdk
priority: medium
stage: 3-medium
labels:
  - bug
  - audit
  - type:sdk
  - priority:medium
  - stage:3-medium
  - package:sdk
  - track:C
---

## Summary

The TypeScript SDK's `canonicalJson` (`sdk/src/utils.ts`) orders object keys
with `Object.keys(objectValue).sort()`. `Array.prototype.sort` with no
comparator sorts by **UTF-16 code unit**. The Go SDK (`encoding/json`, which
sorts map keys by their UTF-8 byte sequence) and the Python SDK
(`json.dumps(..., sort_keys=True)`, which sorts by Unicode **code point**) both
order keys by code point. For keys containing **astral-plane** characters
(U+10000 and above, encoded as surrogate pairs in UTF-16), UTF-16 code-unit
order disagrees with code-point order. The three SDKs then emit **different
canonical bytes** for the same object, and `createPayloadHash` /
`generateInvoiceId` produce **different SHA-256 hashes**. Cross-SDK hash
agreement is a protocol invariant (a payload hashed by a JS merchant must match
the same payload hashed by a Go/Python verifier or the on-chain record).

## Severity & Category

- Severity: Medium (requires an astral-plane character in an object key, which
  is legal JSON and legal metadata but uncommon; when it occurs the divergence
  is a silent, total settlement/verification mismatch)
- Category: Cross-SDK canonicalisation consistency / hashing correctness

## Affected Code

- `sdk/src/utils.ts:105-112` (`canonicalJson` — `Object.keys(objectValue).sort()`
  with the default comparator).
- Consumers: `sdk/src/utils.ts:132-141` (`canonicalInvoiceIdPayload`),
  `157-161` (`generateInvoiceId`), `169-173` (`createPayloadHash`).
- Cross-language references: Go `canonicaljson`/`encoding/json` key ordering;
  Python `json.dumps(sort_keys=True)`.

## Description

`String.prototype` comparison — and therefore the default `Array.sort` — orders
by UTF-16 code unit. A character above the BMP is a surrogate pair whose leading
code unit is in the range U+D800–U+DBFF (~55296+), which sorts **after** BMP
private-use characters like U+E000 (57344). By code point, U+1F600 (128512) is
greater than U+E000; by UTF-16 code unit, its lead surrogate U+D83D (55357)
sorts **before** U+E000. So for an object with keys `""` and `"\u{1F600}"`:

- TS (`sort()`): `["\u{1F600}", ""]`
- Go / Python (code point): `["", "\u{1F600}"]`

The serialised key order differs → the canonical string differs → the SHA-256
differs. This was confirmed by executing the three implementations against the
same input; Go and Python agreed with each other and disagreed with TS.

## Impact

- An invoice or payload whose metadata uses an astral-plane key hashed by the TS
  SDK will not match the hash computed by the Go/Python SDK or recorded
  on-chain, making the invoice silently **un-verifiable / un-settleable** across
  a mixed-SDK deployment.
- The failure is silent: no error is raised; the hashes simply differ.

## Suggested Fix

- Replace the default `.sort()` with an explicit **code-point** comparator so TS
  matches Go/Python, e.g. sort by comparing the arrays returned from
  `[...key]` / by `codePointAt`, or compare the UTF-8 byte encodings. A compact
  correct comparator: iterate code points of both keys and compare numerically.
- Add a cross-SDK golden-vector test covering astral-plane keys to pin the
  ordering across all three SDKs.

## Acceptance Criteria

- [ ] `canonicalJson({ '': 1, '\u{1F600}': 2 })` emits keys in code-point
      order (`` before `\u{1F600}`), matching Go/Python.
- [ ] Existing BMP-only golden vectors are unchanged.
- [ ] A regression test pins the astral-plane ordering.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- ECMAScript `Array.prototype.sort` default comparator (UTF-16 code units).
- Go `encoding/json` map key ordering; Python `json.dumps(sort_keys=True)`.

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/409
