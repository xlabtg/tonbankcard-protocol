# Wallet Compatibility Matrix

This document describes which TON wallets are supported by the
TONBANKCARD `wallet-ui` package and what connection methods are
available for each.

The `wallet-ui` package implements **TON Connect v2** and a legacy
`ton://` deep link as a fallback. It is fully **non-custodial**: the
wallet UI never holds private keys, never signs transactions, and never
custodies user funds. All signing happens inside the user's wallet
application.

---

## Supported wallets

| Wallet        | iOS | Android | macOS | Windows | Linux | Web | Extension | Universal HTTPS link                                 | Native deep link            | Bridge type |
|---------------|:---:|:-------:|:-----:|:-------:|:-----:|:---:|:---------:|:------------------------------------------------------|:----------------------------|:------------|
| Tonkeeper     |  ✓  |    ✓    |   ✓   |    ✓    |   ✓   |     |     ✓     | `https://app.tonkeeper.com/ton-connect?{payload}`     | `tonkeeper-tc://?{payload}` | SSE + JS    |
| Tonhub        |  ✓  |    ✓    |       |         |       |     |           | `https://tonhub.com/ton-connect?{payload}`            | —                           | SSE         |
| OpenMask      |     |         |       |         |       |     |     ✓     | —                                                     | —                           | JS (injected) |
| MyTonWallet   |  ✓  |    ✓    |   ✓   |    ✓    |   ✓   |  ✓  |     ✓     | `https://connect.mytonwallet.org?{payload}`           | `mytonwallet-tc://?{payload}` | SSE + JS  |

`{payload}` is the TON Connect v2 query string of the form
`v=2&id=<hex>&r=<json>` produced by
`wallet-ui/src/tonconnect/deepLink.ts:encodeTonConnectRequest`.

The canonical source of these entries is the registry at
`wallet-ui/src/tonconnect/wallets.ts:KNOWN_WALLETS`. Tests in
`wallet-ui/tests/tonconnect/wallets.spec.ts` lock the registry shape so
this table cannot drift unnoticed.

---

## Connection methods

The selector in `WalletSelector` decides which connection method to
offer based on detected platform and the wallet's declared support:

1. **Native deep link** (`tonkeeper-tc://...`, `mytonwallet-tc://...`) —
   preferred on mobile when the wallet app is installed.
2. **Universal HTTPS link** (`https://app.tonkeeper.com/ton-connect?...`)
   — always usable; opens the wallet app via the OS or falls back to
   the wallet's web interface.
3. **QR code** — for universal-link wallets, the link is rendered as a
   self-contained SVG QR code by `wallet-ui/src/tonconnect/qrCode.ts`
   so a mobile wallet can scan it.
4. **Injected provider** — for browser-extension wallets (OpenMask,
   Tonkeeper extension, MyTonWallet extension) the bridge is the
   injected `window.<key>` object; no link is opened.

The legacy fallback `ton://transfer/<address>` continues to work for
back-compat with the previous wallet-ui surface
(`generateConnectLink()` in `wallet-ui/src/components/WalletApp.ts`).

---

## Platform detection

`detectPlatform(userAgent?)` (in
`wallet-ui/src/tonconnect/wallets.ts:163`) inspects the User-Agent and
returns one of:

- `ios`, `android` — mobile; native deep links + QR fallback.
- `macos`, `windows`, `linux` — desktop; QR code is the primary path.
- `web` — generic web browser.
- `browser-extension` — injected wallets only.
- `unknown` — when no UA is available; all wallets are shown.

`walletsForPlatform(platform)` returns the subset of wallets that
declare support for the given platform.

---

## Manifest requirements

The TON Connect manifest URL passed in
`TonbankcardWalletUI({ tonConnectManifestUrl })` must:

- Use **HTTPS** (validated in `wallet-ui/src/tonconnect/manifest.ts`).
- Resolve to a JSON document with the shape:
  ```json
  {
    "url": "https://your-merchant.example",
    "name": "Your Merchant",
    "iconUrl": "https://your-merchant.example/icon-256.png",
    "termsOfUseUrl": "https://your-merchant.example/terms",
    "privacyPolicyUrl": "https://your-merchant.example/privacy"
  }
  ```
- Be served from the **same origin** that the user sees in the address
  bar. This is the primary phishing protection in TON Connect: a wallet
  will warn the user if the manifest origin and the connecting site
  disagree.

A sample manifest is shipped in
`wallet-ui/public/tonconnect-manifest.json` and can be used as a
template.

---

## Security guarantees

The wallet-ui package preserves the protocol's non-custodial guarantees:

- **Read-only / presentational** — `wallet-ui` only renders links, QR
  codes, and connection state. It does not transmit any value.
- **No private keys** — Keys remain inside the user's wallet app at all
  times. The connector only stores `walletId` and the wallet-supplied
  public TON address in `localStorage`.
- **No transaction signing** — All signing is delegated to the user's
  wallet via TON Connect. The UI cannot sign on the user's behalf.
- **Manifest HTTPS-only** — `validateManifest()` rejects `http://`
  URLs in the manifest fields to prevent downgrade attacks.
- **Address rendering only** — Addresses received from the wallet are
  rendered as text or used to construct transfer links; they are never
  used to authorize value movement on chain.

---

## Adding a new wallet

To add a new TON Connect wallet:

1. Append a `TonConnectWallet` entry to `KNOWN_WALLETS` in
   `wallet-ui/src/tonconnect/wallets.ts`.
2. Add a row to the table above with the same data.
3. If the wallet has a universal link, add a test case in
   `wallet-ui/tests/tonconnect/deepLink.spec.ts`.
4. If it ships an injected provider, add the bridge key in the entry's
   `bridge` array.

`KNOWN_WALLETS` is `readonly` and frozen at module load — updates
require a release.
