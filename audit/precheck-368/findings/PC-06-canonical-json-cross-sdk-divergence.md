---
title: Cross-SDK canonical JSON diverges on U+2028/U+2029 and float formatting, breaking invoice-ID/payload-hash matching
severity: Medium
area: sdk
priority: medium
stage: 3-medium
labels:
  - bug
  - type:sdk
  - priority:medium
  - audit
  - stage:3-medium
---

## Summary

The TypeScript, Go, and Python SDKs each implement a "canonical JSON" used to compute invoice IDs and payload hashes that must match byte-for-byte across languages. Two divergences break that contract: (1) the line/paragraph separators U+2028/U+2029 are emitted as raw UTF-8 bytes by Node and Python but escaped as ` `/` ` by Go; (2) floating-point numbers are formatted differently (`2` vs `2.0`, `1e+16` vs `10000000000000000`, `1e-7` vs `1e-07`) between Python and Node/Go. Either divergence yields a different SHA-256 and therefore a non-matching invoice ID / payload hash.

## Severity & Category

- Severity: Medium (U+2028/U+2029) / Low (float formatting)
- Category: Cross-implementation correctness / Integrity

## Affected Code

- `sdk/src/utils.ts:38-78` (TS canonical JSON)
- `sdk-python/.../hashing.py:14-22` (Python)
- `sdk-go/hashing.go:64-79` (Go)

## Description

**U+2028 / U+2029.** When a string field contains U+2028 (line separator) or U+2029 (paragraph separator), Node `JSON.stringify` and Python `json.dumps` emit the raw bytes `e2 80 a8` / `e2 80 a9`, while Go's `encoding/json` escapes them to ` ` / ` `. Byte comparison of the two outputs differs, so the SHA-256 differs.

**Float formatting.** Python's `repr`/`json` float formatting differs from Node/Go for integers-as-floats and exponent notation: `2.0` vs `2`, `10000000000000000` vs `1e+16`, `1e-07` vs `1e-7`. Any amount or numeric metadata that round-trips through a float will hash differently across SDKs.

Both were reproduced by feeding identical logical inputs through each SDK and comparing raw output bytes.

## Impact

- An invoice created/signed by one SDK fails to verify when re-hashed by another, breaking cross-SDK interoperability for any payload that contains the affected characters or numeric forms.
- Subtle, data-dependent failures that are hard to diagnose in production.

## Suggested Fix

- Define one canonical serialization spec and conform all three SDKs to it:
  - Decide a single policy for U+2028/U+2029 (either always escape — recommended — or never) and apply it in every SDK.
  - Forbid floats in hashed payloads (require integer minor units / decimal strings), or specify an exact numeric formatting and implement it identically in all three SDKs.
- Add a shared cross-SDK conformance test vector set (same inputs → same hash) to CI.

## Acceptance Criteria

- [ ] Identical logical inputs produce identical canonical bytes (and SHA-256) in TS, Go, and Python.
- [ ] Test vectors include U+2028/U+2029 and the divergent numeric forms.
- [ ] Cross-SDK conformance vectors run in CI for all three SDKs.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
