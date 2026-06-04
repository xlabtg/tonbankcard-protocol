# @tonbankcard/merchant-sdk — Changelog

All notable changes to the Merchant SDK are documented here.

This project follows [Semantic Versioning](https://semver.org/):
- `MAJOR` — Breaking API changes
- `MINOR` — New backward-compatible features
- `PATCH` — Backward-compatible bug fixes

---

## [1.3.2] — 2026-06-04

### Fixed — TBC amount helpers keep bigint precision (Issue #292, SDK-M2)

- `formatTBC()` and `parseTBC()` now format and parse nanocoin amounts with
  BigInt and decimal string operations instead of routing values through
  JavaScript `number`/`parseFloat`, preserving amounts above `2^53`.
- The main SDK entry point and dependency-free browser entry point share the
  same amount helper implementation, so `@tonbankcard/merchant-sdk/browser`
  keeps identical numeric semantics.
- Added regression coverage that round-trips a value above the JavaScript safe
  integer limit with 9 decimal places.

---

## [1.3.1] — 2026-06-02

### Fixed — Confirmation depth is now a block-height difference (Issue #267, SDK-H2)

- `verifySettlement()` previously computed `confirmations` as
  `masterchain.latestSeqno - Number(tx.lt)`, subtracting a transaction logical
  time (`lt`, a counter on the order of 10^19) from a masterchain block height.
  The two quantities are dimensionally incompatible, so the result was a
  meaningless, typically hugely negative number, and `Number(tx.lt)` also lost
  precision for `lt` values above 2^53.
- Confirmations are now derived from a block-seqno difference:
  `confirmations = max(0, chainHead - inclusionSeqno)` — the standard
  blockchain meaning (blocks sealed on top of the including block), matching the
  canonical definition shared by the indexer and API (INDEXER-H1). The
  transaction's inclusion seqno is resolved from its gen time via the toncenter
  `lookupBlock` REST method; when it cannot be resolved the SDK reports `0`
  rather than a fabricated depth. The result is clamped at `0` and computed with
  BigInt, so it is never negative and never touches `lt`.

---

## [1.3.0] — 2026-06-02

### Security — `verifySettlement` now actually checks the payment (SDK-H1, Issue #266)

`TonbankcardSDK.verifySettlement` (and `MockTonbankcardSDK.verifySettlement`)
previously hardcoded `matchesInvoice: true`, so any successful transaction at
the Payment Hub was reported as matching the invoice — including payments to a
different merchant or for the wrong amount.

- `verifySettlement(txHash, expected?)` now accepts the target invoice (or its
  canonical fields via the new `SettlementMatchCriteria` type) and parses the
  on-chain `MerchantPayment` event to compare the merchant (recipient) NFT,
  amount, and — when supplied — the payload hash.
- `matchesInvoice` is `true` **only** when all compared fields match; a
  mismatch returns `false`.
- When no invoice is passed, the payment cannot be checked against any invoice,
  so `matchesInvoice` is now `false` (previously `true`) with an explanatory
  `error` note. **Callers relying on the old always-`true` behaviour must pass
  the invoice to obtain `matchesInvoice: true`.**
- New exported type `SettlementMatchCriteria`.

---

## [1.2.0] — 2026-05-17

### Added — Public Testnet Sandbox (Issue #124)

**SDK examples now default to the public Tonbankcard sandbox**
- `examples/react-integration/.env.example`, `examples/vue-integration/.env.example`
  default `VITE_MERCHANT_NFT` to the sandbox merchant NFT documented in
  `docs/sandbox.md`, plus `VITE_MERCHANT_API_BASE=https://sandbox.api.tonbankcard.com`
  and `VITE_FAUCET_URL=https://sandbox.api.tonbankcard.com/faucet`.
- `examples/vanilla-html/index.html` ships a sandbox banner with faucet link
  and pre-fills the merchant NFT input with the sandbox default — the demo
  works against the hosted sandbox without any user configuration.

**New infrastructure (outside the SDK package, but used by the examples)**
- `scripts/faucet/` — standalone TBC faucet service with sliding-window
  per-address rate limiting (1 dispense / hour by default), CORS allowlist,
  `DryRunDispenser` default and pluggable `IDispenser` interface.
- `api/src/middleware/sandbox.ts` — stamps `X-Tonbankcard-Environment: sandbox`
  on every response, exposes `GET /v1/sandbox/info`, and allows anonymous
  invoice creation in sandbox mode by injecting a public sandbox API key.
  Inert in production (no-op unless `TONBANKCARD_SANDBOX=true` or
  `NODE_ENV=sandbox`).
- `docker-compose.sandbox.yml` + `.env.sandbox.example` — full testnet sandbox
  stack (Merchant API, Payment Indexer, faucet, Redis) wired to TON testnet.
- `docs/sandbox.md` — end-to-end documentation: endpoints, quickstart,
  faucet usage, test data reset cadence, security posture, self-hosting.

### Security
- Sandbox stack is **testnet-only by construction** — the indexer refuses to
  start with `TON_NETWORK=mainnet`, and the faucet ships a `DryRunDispenser`
  by default so a misconfigured deployment cannot move real funds.
- Sandbox anonymous API key (`tbck_sandbox_public_anonymous_key`) is
  registered only when sandbox mode is explicitly enabled and is never
  surfaced in production responses.

---

## [1.1.0] — 2026-05-17

### Added — Developer Experience (Issue #123)

**Browser distribution**
- New `@tonbankcard/merchant-sdk/browser` subpath export — dependency-free entry
  that ships `PaymentWidget`, `parseTBC`, `formatTBC`, `serializeBigInt`
  without pulling in `@ton/ton`/`@ton/core`.
- New IIFE bundle at `dist/index.global.js` (≈6 KB minified) exposing the
  global `Tonbankcard`. Wired up via the `unpkg` and `jsdelivr` fields in
  `package.json` for direct `<script>` use on any static page.
- `tsup.config.ts` replaces the inline build command — produces CJS + ESM +
  IIFE artefacts and declaration files in one pass.

**Integration examples** (each runnable in isolation, configured for testnet)
- `examples/react-integration/` — React 18 + Vite + TypeScript, demonstrates
  `TonbankcardSDK` + `PaymentWidget`, exposes an `onPaymentComplete(txHash)`
  callback via wallet return-URL parsing.
- `examples/vue-integration/` — Vue 3 Composition API + Vite, mirrors the
  React example using `<script setup>` and emits `payment-complete`.
- `examples/vanilla-html/` — single static HTML + JS page, loads the IIFE
  bundle from a CDN, no build step, no framework.

**Publishing & supply-chain**
- `.github/workflows/npm-publish-sdk.yml` — npm publish workflow using
  Trusted Publishing (OIDC, `id-token: write`) and `--provenance`. No
  `NPM_TOKEN` secret required. Triggered by GitHub releases tagged
  `sdk-v<semver>` or `workflow_dispatch`.
- Workflow enforces a < 100 KB gzipped package budget via `npm pack --json`
  and `npm audit --omit=dev --audit-level=high` before publishing.

**Documentation**
- `docs/merchant-api.postman_collection.json` — Postman Collection v2.1
  covering `POST /invoice/create`, `GET /invoice/{id}`, `GET /invoice/{id}/status`
  with example pending/settled/expired/error responses and built-in tests.

### Changed
- `sdk/package.json` `exports` map updated: `types` condition listed first
  to satisfy modern bundler resolution; added `./browser` subpath and
  `./package.json` re-export.
- `sdk/.eslintrc.js` now ignores `dist/`, `node_modules/`, and `coverage/`
  to keep linting focused on source.

### Security
- All examples are explicitly **non-custodial** — never request a mnemonic
  or private key. Wallet return-URL `?tx=` hashes are treated as
  informational and must be re-verified on-chain.

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
