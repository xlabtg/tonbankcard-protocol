# @tonbankcard/merchant-sdk — Changelog

All notable changes to the Merchant SDK are documented here.

This project follows [Semantic Versioning](https://semver.org/):
- `MAJOR` — Breaking API changes
- `MINOR` — New backward-compatible features
- `PATCH` — Backward-compatible bug fixes

---

## [1.0.0] — 2026-03-19

### Production Release

First stable, production-ready release of the TONBANKCARD Merchant SDK.

#### Stability Guarantees

Starting from 1.0.0:
- All exported types and methods in `TonbankcardSDK`, `Invoice`, `PaymentStatus`, and utility functions are **stable**.
- No breaking changes will be introduced without a major version bump.
- Deprecated APIs will remain functional for at least one major version cycle.

#### What's Included in 1.0.0

**Core SDK (`TonbankcardSDK` class):**
- `createInvoice(params)` — Create payment invoices (informational; non-authoritative)
- `getInvoice(invoiceId)` — Retrieve invoice from configured API
- `getInvoiceStatus(invoiceId)` — Check payment status (queries blockchain)
- `generateWalletLink(params)` — Generate TON Connect wallet deep links
- `verifySettlement(txHash)` — Verify on-chain settlement (authoritative)
- `getAccountInfo(nftAddress)` — Query account state from Payment Hub

**Utility functions:**
- `generateInvoiceId(params)` — Deterministic invoice ID generation
- `createPayloadHash(payload)` — On-chain payload hash construction
- `formatTBC(nanocoins)` — Human-readable TBC formatting
- `parseTBC(tbc)` — TBC string to nanocoins
- `isValidTonAddress(address)` — TON address validation
- `shortAddress(address)` — Display-friendly address shortening
- `isExpired(expiresAt)` — Invoice expiry check
- `formatTimestamp(timestamp)` — ISO timestamp formatting
- `serializeBigInt(value)` — BigInt-safe JSON serialization

**Mock/Sandbox support:**
- `MockTonbankcardSDK` — Drop-in replacement for testing without network calls
- `createMockSDK(options)` — Factory function for mock SDK instances
- `MockSettlementStore` — In-memory settlement store for integration tests

**Types:**
- `TonbankcardConfig`, `Invoice`, `CreateInvoiceParams`
- `PaymentStatus`, `PaymentSettlement`, `TransactionVerification`
- `AccountInfo`, `AccountState`, `WalletLinkParams`
- `MerchantPaymentEvent`

#### Security Properties (Unchanged)

- SDK is **read-only** and **non-custodial** — no signing, no private key storage
- All fund-moving operations require explicit user wallet consent
- Blockchain is single source of truth; API/webhook data is informational only

#### Breaking Changes from 0.1.0

None — 1.0.0 is backward compatible with 0.1.0. The version bump signals API stability, not a breaking change.

---

## [0.1.0] — 2026-02-15

### Initial Development Release

Initial release of the SDK. Not yet stable — APIs subject to change.

**Features:**
- Core `TonbankcardSDK` class
- Invoice creation and management
- Wallet link generation
- On-chain settlement verification
- Account information queries
- Utility functions (format, parse, validate)

---

## Upgrade Guide

### From 0.1.0 to 1.0.0

No code changes required. Update your `package.json`:

```json
{
  "dependencies": {
    "@tonbankcard/merchant-sdk": "^1.0.0"
  }
}
```

Run `npm install` (or `npm ci` for locked installs).

All existing code will work without modification.

---

## Versioning Policy

### Stable APIs (no breaking changes without major version bump)

- `TonbankcardSDK` class constructor signature
- All public methods on `TonbankcardSDK`
- All exported types and interfaces
- Utility function signatures and return types

### Not Covered by Stability Guarantee

- `dist/` internal module structure (use only the package entry points)
- Mock SDK behavior beyond the defined interface
- Private/internal methods prefixed with `_`
- Development dependency versions

### Deprecation Policy

When an API is deprecated:
1. It is marked with a `@deprecated` JSDoc annotation
2. A replacement API is provided in the same release
3. The deprecated API continues to work for at least one major version cycle
4. It is removed in the next major version

---

## Reporting Issues

- Bug reports: [GitHub Issues](https://github.com/xlabtg/tonbankcard-protocol/issues)
- Security vulnerabilities: see [SECURITY.md](SECURITY.md) for private disclosure procedure
