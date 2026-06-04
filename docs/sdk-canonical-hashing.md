# SDK canonical hashing

Issue #295 fixes `generateInvoiceId` and `createPayloadHash` drift across the
TypeScript, Go, and Python SDKs by defining one canonical byte serialization.

## Canonical JSON

SDK hash helpers encode JSON-compatible values as UTF-8 JSON with:

- object keys sorted lexicographically;
- no insignificant whitespace;
- arrays kept in their original order;
- `BigInt` / arbitrary-precision integer values that represent protocol
  integers encoded as decimal strings;
- TON addresses normalized to raw `workchain:account_hex` form before they are
  included in invoice-id input.

Unsupported values such as functions, symbols, non-finite numbers, or
non-string object keys are rejected instead of being silently coerced.

## Invoice ID payload

`generateInvoiceId` hashes this canonical JSON object:

```json
{
  "amount_tbc": "<decimal nanocoins>",
  "merchant_nft": "<raw TON address>",
  "order_id": "<order id or empty string>",
  "timestamp": "<unix timestamp seconds>"
}
```

The SHA-256 digest is returned as a 64-character lowercase hex string.

## Payload hash

`createPayloadHash` hashes the canonical JSON representation of the provided
payload object and returns the SHA-256 digest as an integer.

The shared regression fixture lives at
`tests/fixtures/sdk-m5-canonical-hashes.json` and is consumed by all three SDK
test suites.
