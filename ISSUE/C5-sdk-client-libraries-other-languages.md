---
name: "[C5] SDK Client Libraries for Other Languages"
about: Python and Go SDK equivalents for backend merchant integrations
labels: type:backend
track: C
priority: low
---

## 1. Goal

Create SDK client libraries in Python (priority) and Go for merchants who prefer backend-first integrations or whose tech stack is not JavaScript/TypeScript.

## 2. Context

The current `@tonbankcard/merchant-sdk` is TypeScript-only. Many merchants run Python-based backend stacks (Django, FastAPI) or Go-based microservices. Providing native language SDKs reduces integration friction and increases protocol adoption.

The SDKs should be auto-generated from an OpenAPI specification where possible, to avoid maintaining multiple implementations.

Related to: [DEVELOPMENT_ROADMAP.md — Track C, C5](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### OpenAPI Specification
- Create `docs/openapi.yaml` (or `openapi.json`) for the Merchant API
- Covers all endpoints in `docs/merchant-api-spec.md`
- Validated with a linter (e.g., `spectral`)

### Python SDK
- Package: `tonbankcard-merchant` on PyPI
- Wraps the Merchant API REST endpoints
- Supports: invoice creation, status polling, webhook verification
- Type annotations (PEP 484 compatible)
- Async support (`asyncio` / `httpx`)
- `pip install tonbankcard-merchant`

### Go SDK (stretch goal)
- Module: `github.com/xlabtg/tonbankcard-go`
- Wraps the Merchant API REST endpoints
- Idiomatic Go (context support, error wrapping)
- `go get github.com/xlabtg/tonbankcard-go`

## 4. Out of Scope

- Smart contract interaction from Python/Go (use the TypeScript SDK or direct TON SDK)
- Frontend widget (Python/Go are server-side integrations only)
- Mobile SDKs

## 5. Functional Requirements

1. OpenAPI spec covers 100% of documented Merchant API endpoints
2. Python SDK:
   - `MerchantClient(api_key="...", base_url="...")` constructor
   - `create_invoice(amount, currency, callback_url)` method
   - `get_invoice(invoice_id)` method
   - `verify_webhook(signature, payload)` method
3. Python SDK published to PyPI with CI/CD automation
4. All SDK methods have type hints and docstrings
5. Example usage in `examples/python-integration/`

## 6. Non-Functional Requirements

- Python SDK: Python >= 3.9 support
- Go SDK: Go >= 1.21 support
- Both SDKs: must pass their own test suites in CI
- SDK versions must stay in sync with API version changes

## 7. Security Requirements

- API keys passed via constructor, never via URL parameters
- Webhook verification must use constant-time comparison (prevent timing attacks)
- No credentials committed to examples (use environment variables)
- Published packages must include checksums (`pip` / `go module` checksum verification)

## 8. Acceptance Criteria

- [ ] `docs/openapi.yaml` created and validated by OpenAPI linter
- [ ] Python SDK created in `sdk-python/` or as a separate repository
- [ ] Python SDK published to PyPI
- [ ] Python SDK: all three core methods implemented with tests
- [ ] `examples/python-integration/` working example
- [ ] (Stretch) Go SDK created and published
- [ ] CI runs tests for Python SDK on each PR

## 9. References

- [Merchant API Spec](../docs/merchant-api-spec.md)
- [SDK (TypeScript)](../sdk/)
- [Examples](../examples/)
- OpenAPI spec generator for Express: `express-openapi` or `tsoa`
- Issue C1: [C1-public-documentation-site.md](./C1-public-documentation-site.md)
