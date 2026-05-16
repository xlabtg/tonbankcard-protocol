---
name: "[D3] Error Handling Standardization"
about: Standardize error codes, response formats, and structured logging across contracts and services
labels: type:backend
track: D
priority: medium
---

## 1. Goal

Audit and standardize all error codes in Tact contracts, unify the error response format across the Merchant API, and ensure structured logging with consistent error context in the indexer service.

## 2. Context

Currently, error handling is inconsistent:
- Smart contracts use numeric exit codes without a central registry
- Merchant API error responses may use different formats across endpoints
- Indexer logging uses `pino` but error context fields may not be consistent

Standardization is important for:
- Merchant integration: predictable error responses are easier to handle in client code
- Auditor review: documented exit codes make contract behavior clearer
- Operations: consistent log fields enable reliable alerting and dashboards (B3)

Related to: [DEVELOPMENT_ROADMAP.md — Track D, D3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Smart Contract Error Codes
- Audit all `throw()` / `require()` calls in all Tact contracts
- Create a central error code registry at `docs/error-codes.md`
- Format: `code` (integer), `contract`, `condition`, `user-facing message`

### Merchant API Error Responses
- Standardize error response format across all `api/src/routes/`:
  ```json
  {
    "error": {
      "code": "INVOICE_NOT_FOUND",
      "message": "The requested invoice does not exist",
      "details": {}
    }
  }
  ```
- Map all error scenarios to HTTP status codes
- Error code enum defined in `api/src/types/errors.ts`

### Indexer Structured Logging
- All `pino` log entries in `backend/indexer/src/` must include:
  - `requestId` or `eventId` for tracing
  - `contractAddress` for blockchain event logs
  - `errorCode` for error-level entries
- Log level policy documented (debug/info/warn/error usage)

## 4. Out of Scope

- Changing contract behavior (only documenting existing exit codes)
- Frontend error display (covered by F1/F2)
- Third-party gateway error handling (their responsibility)

## 5. Functional Requirements

1. `docs/error-codes.md` documents all known contract exit codes with conditions
2. All `api/` endpoints return errors in the standardized format
3. API error codes are an exhaustive TypeScript enum (no magic strings)
4. Indexer logs include `requestId`/`eventId` on every log entry
5. Indexer error logs include enough context to diagnose the issue without reading the source code

## 6. Non-Functional Requirements

- API error responses must be consistent (same format, same field names) across all endpoints
- Contract exit codes must be unique across all contracts (no two contracts use the same numeric code for different errors)
- Logging changes must not increase log volume by more than 20%

## 7. Security Requirements

- Error messages must not expose internal implementation details (stack traces, file paths, SQL queries)
- Error responses must not reveal whether a resource exists when the user is not authorized to see it (avoid information leakage via 404 vs. 403)
- Contract exit codes must not be falsifiable by user input

## 8. Acceptance Criteria

- [ ] `docs/error-codes.md` created with all contract exit codes
- [ ] All `api/` endpoints return errors in the standardized JSON format
- [ ] Error code TypeScript enum defined in `api/src/types/errors.ts`
- [ ] Indexer `pino` logging updated to include `requestId`/`eventId` and `errorCode`
- [ ] All existing API tests updated to expect the new error format
- [ ] CI passes with new error format

## 9. References

- [Contracts](../contracts/)
- [Merchant API](../api/)
- [Indexer](../backend/indexer/)
- [Merchant API Spec](../docs/merchant-api-spec.md)
- pino documentation: https://getpino.io
