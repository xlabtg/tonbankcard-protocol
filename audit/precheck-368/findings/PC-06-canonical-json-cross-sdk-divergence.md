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

The TypeScript, Go, and Python SDKs each implement a "canonical JSON" used to compute invoice IDs and payload hashes that must match byte-for-byte across languages. Two divergences break that contract: (1) the line/paragraph separators U+2028/U+2029 are emitted as raw UTF-8 bytes by Node and Python but escaped as `\u2028`/`\u2029` by Go; (2) floating-point numbers are formatted differently (`2` vs `2.0`, `1e+16` vs `10000000000000000`, `1e-7` vs `1e-07`) between Python and Node/Go. Either divergence yields a different SHA-256 and therefore a non-matching invoice ID / payload hash.

## Severity & Category

- Severity: Medium (U+2028/U+2029) / Low (float formatting)
- Category: Cross-implementation correctness / Integrity

## Affected Code

- `sdk/src/utils.ts:38-78` (TS canonical JSON)
- `sdk-python/.../hashing.py:14-22` (Python)
- `sdk-go/hashing.go:64-79` (Go)

## Description

**U+2028 / U+2029.** When a string field contains U+2028 (line separator) or U+2029 (paragraph separator), Node `JSON.stringify` and Python `json.dumps` emit the raw bytes `e2 80 a8` / `e2 80 a9`, while Go's `encoding/json` escapes them to `\u2028` / `\u2029`. Byte comparison of the two outputs differs, so the SHA-256 differs.

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

## Resolution

**RESOLVED ✅ (Issue #375 / PC-06)** — PR
[#389](https://github.com/xlabtg/tonbankcard-protocol/pull/389), branch
`issue-375-cd20389da54e`.

A single canonical serialization policy is now specified and enforced
identically by all three SDKs:

1. **U+2028 / U+2029 are always escaped** to `\u2028` / `\u2029` (the form Go's
   `encoding/json` already produced). The TypeScript SDK
   (`canonicalJson`, `sdk/src/utils.ts`) and Python SDK (`canonical_json`,
   `sdk-python/.../hashing.py`) post-process their JSON output to escape these
   two code points, which `JSON.stringify` / `json.dumps` otherwise emit as raw
   UTF-8. The escape is unambiguous: `2028`/`2029` are digit-only, so the
   lowercase/uppercase distinction does not arise, and the sequences never
   appear inside an ASCII escape already emitted by the encoders.
2. **Floating-point numbers are forbidden** in hashed payloads. Each SDK throws
   (`TypeError` in TS/Python, `error` in Go) rather than emitting a
   language-dependent float rendering (`2` vs `2.0`, `1e+16` vs
   `10000000000000000`, `1e-7` vs `1e-07`).
3. **Only safe integers** in `[-(2^53 - 1), 2^53 - 1]` are accepted and are
   emitted as plain decimals (byte-identical across languages). Larger or
   fractional amounts must be supplied as a decimal string (or a
   `bigint` / `big.Int`, which serialize to strings) — the existing on-chain
   `amount_tbc` and `timestamp` fields already are strings, so the invoice-ID
   and payload-hash paths are unaffected.

**Shared conformance vectors** —
`tests/fixtures/pc-06-canonical-conformance.json` defines the policy, 13 string
vectors (including U+2028/U+2029, raw DEL, and other separators), 8 object
payloads (two with key-reordered twins), 8 accepted safe integers, and the
rejected float / unsafe-integer forms, each pinned to its canonical bytes and
SHA-256. Numbers travel as decimal strings so that no JSON parser silently
coerces them to a float on the way in; each harness parses them into the native
type before exercising its canonical encoder.

**CI-enforced cross-SDK coverage** — the same fixture drives a conformance suite
in every SDK, so identical logical inputs are proven to yield identical
canonical bytes and SHA-256 digests:

- TypeScript: `sdk/tests/utils.spec.ts`, `describe('PC-06 cross-SDK canonical
  conformance')` (job *Test SDK*, `.github/workflows/ci.yml`).
- Python: `sdk-python/tests/test_hashing.py`, the `test_pc06_*` parametrized
  vectors (job *Python SDK*, `.github/workflows/sdk-python.yml`).
- Go: `sdk-go/conformance_test.go`, the `TestPC06*` functions (job *Go SDK*,
  `.github/workflows/sdk-go.yml`).

The Go and Python workflows' `paths` filters were extended with
`tests/fixtures/**` so a change to the shared vectors re-runs all three SDK
jobs. A standalone before/after reproduction lives in
`experiments/issue-375-canonical-json/`.

## Acceptance Criteria

- [x] Identical logical inputs produce identical canonical bytes (and SHA-256) in TS, Go, and Python.
- [x] Test vectors include U+2028/U+2029 and the divergent numeric forms.
- [x] Cross-SDK conformance vectors run in CI for all three SDKs.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
