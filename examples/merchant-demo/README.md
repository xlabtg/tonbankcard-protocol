# `@tonbankcard/merchant-demo`

> A reference **Express.js merchant** that turns a freshly cloned
> `tonbankcard-protocol` repository into a working checkout in three steps:
> create an invoice, embed the payment widget, receive a webhook. Designed
> to satisfy Issue [#125] — _Developer Quickstart Improvements_ — and to be
> the canonical entry point for new contributors and integrators.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/xlabtg/tonbankcard-protocol)

---

## Why this exists

A merchant who wants to integrate TONBANKCARD must understand three
moving parts:

| # | Concept | Where this demo shows it |
|---|---------|--------------------------|
| 1 | **Invoice creation** — issue an invoice payload server-side. | `POST /api/invoice` in [`src/server.js`](./src/server.js) |
| 2 | **Widget embedding** — mount the payment UI in the browser. | [`public/index.html`](./public/index.html), [`public/app.js`](./public/app.js) |
| 3 | **Webhook receipt** — react to on-chain settlement asynchronously. | `POST /webhook` in [`src/server.js`](./src/server.js) |

The demo is intentionally **stateless** and **non-custodial** — it never
signs blockchain transactions and never stores private keys. The
blockchain is the single source of truth.

---

## Run it in under 30 seconds

```bash
git clone https://github.com/xlabtg/tonbankcard-protocol.git
cd tonbankcard-protocol/examples/merchant-demo

npm install      # ~1 second, only `express` as a dependency
npm start        # http://localhost:8080
```

No environment variables are required for the public C3 sandbox path
(Issue #125 §6 — _Demo application must not require environment
variables for the sandbox use case_).

If you have already run the repository-wide setup (`npm run setup` at the
root), the demo can also be launched with:

```bash
npm run demo     # from the repository root
```

---

## What you'll see

1. A tiny three-item catalogue (espresso · bagel · t-shirt).
2. Clicking **Buy** issues a sandbox invoice via `POST /api/invoice`.
3. The browser mounts `Tonbankcard.PaymentWidget` against the invoice.
4. Pay with a TON wallet (Tonkeeper, MyTonWallet, …) on **testnet**.
5. The sandbox indexer detects settlement and posts a webhook to
   `POST /webhook`; the page shows it in the **Webhook log** panel.

To exercise the webhook plumbing without making an on-chain payment:

```bash
curl -sX POST http://localhost:8080/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"payment.completed","invoice_id":"demo"}'
```

---

## Architecture at a glance

```
┌───────────────┐  GET /api/config         ┌────────────────────────────┐
│  Browser      │ ───────────────────────▶ │  examples/merchant-demo    │
│  index.html   │                           │  (this Express app)        │
│  app.js       │ ◀───────────────── JSON ─ │                            │
│  Tonbankcard  │  POST /api/invoice        │  - parseTbcToNanocoins()   │
│  .PaymentWid- │ ───────────────────────▶ │  - fetchSandboxInvoice()   │
│   get         │ ◀───────────────── JSON ─ │  - buildLocalInvoice()     │
└───────┬───────┘                           └──────────┬─────────────────┘
        │                                              │
        │  ton://transfer/...                           │  POST /v1/invoice/create
        ▼                                              ▼
┌───────────────┐                           ┌────────────────────────────┐
│  TON wallet   │ ───── on-chain tx ─────▶ │  C3 sandbox Merchant API   │
│  (Tonkeeper)  │                           │  (sandbox.api.tonbankcard) │
└───────────────┘                           └──────────┬─────────────────┘
                                                       │
                                                       ▼
                                            ┌────────────────────────────┐
                                            │  Sandbox payment indexer   │
                                            │  detects settlement,       │
                                            │  POSTs /webhook ↩         │
                                            └────────────────────────────┘
```

---

## Configuration (all optional)

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `8080` | HTTP port for this demo server. |
| `HOST` | `0.0.0.0` | Bind address. |
| `SANDBOX_API_URL` | `https://sandbox.api.tonbankcard.com` | Upstream Merchant API base URL. Override to point at a local `docker-compose.sandbox.yml` stack. |
| `SANDBOX_MERCHANT_NFT` | `EQAA…AAAA` (sandbox default) | Recipient NFT card on testnet. |
| `SANDBOX_DEFAULT_AMOUNT_TBC` | `1.50` | Default checkout amount in decimal TBC. |
| `DEMO_DISABLE_REMOTE` | _(unset)_ | Set to `1` to skip the sandbox API call entirely and always use the local fallback invoice. Useful for offline CI runs. |

The demo **does not** require `TONBANKCARD_API_KEY` or any other secret —
the C3 sandbox accepts anonymous invoice creation (see `docs/sandbox.md` §2).

---

## Run against a local sandbox stack

If you prefer to run the full sandbox locally (see [`docs/sandbox.md`]):

```bash
# 1. In one terminal — start the sandbox stack (API + indexer + faucet + Redis)
cp .env.sandbox.example .env.sandbox
docker compose -f docker-compose.sandbox.yml --env-file .env.sandbox up --build

# 2. In another terminal — run the demo against the local API
cd examples/merchant-demo
SANDBOX_API_URL=http://localhost:3001 npm start
```

The page should now show invoices with `source: "c3-sandbox"` instead of
`source: "local-fallback"`.

[`docs/sandbox.md`]: ../../docs/sandbox.md

---

## Tests

```bash
npm test
```

Runs against the built-in `node:test` runner — no external test
dependencies. Covers:

* `parseTbcToNanocoinsString` boundary conditions
* `buildLocalInvoice` deterministic shape
* `GET /api/config`, `GET /health`
* `POST /api/invoice` with the remote sandbox disabled
* `POST /webhook` → `GET /api/webhooks` round-trip

---

## Trust model (read this before shipping)

The demo:

* **Never** signs TON transactions.
* **Never** stores user private keys or mnemonics.
* **Never** holds custody of funds (Tonbankcard non-custodial guarantee).
* **Trusts** the user's wallet to broadcast the payment.
* **Verifies** payment status via the sandbox indexer — for production
  you must additionally re-verify the on-chain transaction before
  delivering goods (see [`docs/merchant-api-spec.md`](../../docs/merchant-api-spec.md)).

When you take this demo to production:

1. Replace the public sandbox URL with your own Merchant API deployment.
2. Add HMAC signature verification on `/webhook` — see the spec.
3. Persist invoices and webhook events to a real database.
4. Issue and rotate API keys; never hard-code them in client-side JS.

---

## Related

* [Issue #125 — Developer Quickstart Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/125)
* [SDK README](../../sdk/README.md)
* [Sandbox docs](../../docs/sandbox.md)
* [Merchant API spec](../../docs/merchant-api-spec.md)
* Sibling examples: [`vanilla-html`](../vanilla-html), [`react-integration`](../react-integration), [`vue-integration`](../vue-integration)

[#125]: https://github.com/xlabtg/tonbankcard-protocol/issues/125
