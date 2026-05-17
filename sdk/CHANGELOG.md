# @tonbankcard/merchant-sdk — Changelog

All notable changes to the Merchant SDK are documented here.

This project follows [Semantic Versioning](https://semver.org/):
- `MAJOR` — Breaking API changes
- `MINOR` — New backward-compatible features
- `PATCH` — Backward-compatible bug fixes

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
