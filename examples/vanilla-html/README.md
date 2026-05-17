# Vanilla HTML integration example — `@tonbankcard/merchant-sdk`

Single-file static example that embeds the TONBANKCARD non-custodial payment
widget into a plain HTML page via a `<script>` tag — **no build step, no
bundler, no framework**.

> **Looking for a full backend + frontend reference?** See
> [`examples/merchant-demo/`](../merchant-demo/) — an Express.js storefront that
> creates sandbox invoices and receives webhooks. It is the canonical quickstart
> wired into `npm run setup` and Codespaces.

> The example is **read-only** with respect to funds. It never asks for a
> mnemonic or private key — payment is executed exclusively by the user's TON
> wallet after they confirm the transaction.

---

## What this example shows

- Loading the SDK as a global `Tonbankcard` from a CDN
- Building an invoice with `parseTBC` and Web Crypto SHA-256
- Mounting `TonbankcardPaymentWidget` inline
- Capturing the wallet's return-URL `?tx=` for on-chain verification

---

## Files

```
examples/vanilla-html/
├── index.html       # Markup, styles, CDN <script> include
├── app.js           # Glue: builds an invoice and mounts the widget
└── README.md
```

That's the whole example. No `npm install`, no `tsconfig`, no Vite.

---

## How to run

You only need a static file server because the SDK uses ES2020 features and
browsers refuse to load modules from `file://` for security reasons.

```bash
cd examples/vanilla-html
# Any static server works; pick whichever you already have installed.
python3 -m http.server 8080
# or
npx http-server -p 8080
```

Open <http://127.0.0.1:8080/>.

---

## How the CDN load works

```html
<script src="https://unpkg.com/@tonbankcard/merchant-sdk@1.0.0/dist/index.global.js"
        crossorigin="anonymous"></script>
```

- `dist/index.global.js` is the **IIFE bundle** of the SDK's browser entry
  (`@tonbankcard/merchant-sdk/browser`).
- It exposes a single global, `Tonbankcard`, containing:
  - `PaymentWidget` (alias for `TonbankcardPaymentWidget`)
  - `parseTBC`, `formatTBC`
  - `serializeBigInt`
- It does **not** include the on-chain verification surface (`TonbankcardSDK`,
  `verifySettlement`, …) because those require `@ton/ton` and `@ton/core`,
  which are designed for Node and module bundlers.

For on-chain verification, use a server-side call (recommended) or import the
full SDK from `import { TonbankcardSDK } from '@tonbankcard/merchant-sdk'`
with a bundler (see the React and Vue examples).

---

## Pinning and supply-chain hygiene

- Always pin a specific SDK version in the `<script>` URL — never use `@latest`
  in production.
- For higher integrity, switch the CDN to one that emits subresource integrity
  (SRI) hashes, e.g. <https://www.jsdelivr.com/> with `+sri`, and add
  `integrity="sha384-…" crossorigin="anonymous"` to the `<script>` tag.
- Verify the published bundle's provenance on
  <https://www.npmjs.com/package/@tonbankcard/merchant-sdk?activeTab=provenance>.

---

## Trust model

- The wallet returns a `txHash` informationally. Always re-verify it
  on-chain before granting access to the customer.
- The SDK is non-custodial: it never signs transactions and never stores
  private keys. All payments are user-initiated through the wallet.

---

## References

- [SDK README](../../sdk/README.md)
- [Merchant API spec](../../docs/merchant-api-spec.md)
- [React example](../react-integration/)
- [Vue example](../vue-integration/)
