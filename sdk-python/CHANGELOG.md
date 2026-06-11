# Changelog

All notable changes to `tonbankcard-merchant` (Python SDK) are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.1.2] - 2026-06-11

### Fixed

- **Cross-SDK canonical JSON now matches the TypeScript and Go SDKs
  byte-for-byte.** `canonical_json` escapes the line/paragraph separators
  U+2028/U+2029 to their `\u2028`/`\u2029` forms (previously emitted as raw
  UTF-8, unlike Go) and forbids floating-point numbers and integers outside the
  53-bit safe range `[-(2**53 - 1), 2**53 - 1]` (which Python formatted
  differently from Node/Go, e.g. `2.0` vs `2`, `1e+16` vs `10000000000000000`).
  Out-of-range or fractional amounts must be supplied as a decimal string, so
  invoice IDs and payload hashes now match across SDKs. (PC-06, #375)
- Reconciled the exported `__version__` with the packaged project version; it
  was stale at `1.1.0` since the 1.1.1 release.

### Added

- Shared cross-SDK conformance vectors
  (`tests/fixtures/pc-06-canonical-conformance.json`), covering U+2028/U+2029
  and the divergent numeric forms, run in CI for the Python, TypeScript, and Go
  SDKs.

## [1.1.1] - 2026-06-04

### Fixed

- Merchant NFT validation now accepts TON friendly addresses in both standard
  base64 and base64url alphabets, accepts raw `workchain:hex` addresses, and
  rejects friendly addresses whose CRC16 checksum is corrupt. (SDK-M1, #291)

## [1.1.0] - 2026-06-02

### Fixed

- **Webhook verification now matches the server signature scheme.** Previously
  the verifier hashed the raw body alone and compared it against the entire
  header, so every genuinely signed delivery (`t=<ts>,v1=<hex>`) was rejected.
  `verify_webhook` now parses the structured header, recomputes
  `HMAC-SHA256(secret, f"{t}.{raw_body}")`, and constant-time compares the `v1`
  digest. (SDK-C1, #249)

### Added

- Replay protection: `verify_webhook` rejects deliveries whose timestamp falls
  outside a configurable freshness window (`tolerance`, default 300 s). A `now`
  override is exposed for deterministic tests.
- `SIGNATURE_VERSION` and `DEFAULT_TOLERANCE_SECONDS` constants.

### Changed (breaking)

- `compute_signature(secret, payload)` → `compute_signature(secret, timestamp, payload)`;
  the digest is now taken over `f"{timestamp}.{payload}"`.
- The obsolete `sha256=` header prefix is no longer accepted (the server never
  emitted it).

## [1.0.0] - 2025-12-27

### Added

- Initial release of the Python Merchant SDK.
- `MerchantClient` (sync) and `AsyncMerchantClient` (async) wrapping the
  Merchant API (`POST /invoice/create`, `GET /invoice/{id}`, `GET /invoice/{id}/status`).
- Strict client-side validators for merchant NFT addresses, amounts and metadata.
- HMAC-SHA256 webhook verification using `hmac.compare_digest` (constant-time).
- Typed exception hierarchy (`AuthenticationError`, `InvoiceNotFoundError`,
  `RateLimitError`, …).
- `py.typed` marker for PEP 561 type-hint distribution.
- Generated from [`docs/openapi.yaml`](../docs/openapi.yaml) schemas.
