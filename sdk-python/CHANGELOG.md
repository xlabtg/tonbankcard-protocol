# Changelog

All notable changes to `tonbankcard-merchant` (Python SDK) are documented here.
This project follows [Semantic Versioning](https://semver.org/).

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
