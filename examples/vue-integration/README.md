# Vue 3 integration example — `@tonbankcard/merchant-sdk`

Standalone Vue 3 + Vite project that mirrors the React example: it shows how
to embed the TONBANKCARD non-custodial payment widget into a Vue UI and
verify the resulting on-chain settlement.

> **Looking for a full backend + frontend reference?** See
> [`examples/merchant-demo/`](../merchant-demo/) — an Express.js storefront that
> creates sandbox invoices and receives webhooks. It is the canonical quickstart
> wired into `npm run setup` and Codespaces.

> The example is **read-only** with respect to funds. It never asks for a
> mnemonic or private key — payment is executed exclusively by the user's TON
> wallet after they confirm the transaction.

---

## What this example shows

- Initialising `TonbankcardSDK` against the public TON **testnet**
- Creating an invoice with `sdk.createInvoice(...)`
- Mounting `TonbankcardPaymentWidget` inside a Vue component
- Emitting a `payment-complete` event with the transaction hash returned by
  the wallet, ready to be re-verified on-chain

---

## Prerequisites

- Node.js **20 LTS** or newer (`node --version`)
- A TON wallet that supports `ton://transfer/` deep links
  (Tonkeeper, MyTonWallet, OpenMask, …)
- Test TBC on a testnet NFT card

---

## Setup

```bash
cd examples/vue-integration
cp .env.example .env.local
npm install
npm run dev
```

The dev server starts on <http://127.0.0.1:5174>.

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_MERCHANT_NFT` | ✅ | Testnet NFT card address (recipient). |
| `VITE_PAYMENT_HUB` | optional | Override the Payment Hub address. |
| `VITE_RPC_ENDPOINT` | optional | Override the toncenter testnet RPC. |

**Never** put API keys or mnemonics into this file — the SDK is non-custodial
and the example does not require them.

---

## Project layout

```
examples/vue-integration/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── src/
    ├── main.ts                    # Vue bootstrap
    ├── env.d.ts                   # Vite env types
    ├── App.vue                    # Order form + invoice state
    └── TonbankcardCheckout.vue    # Vue wrapper around the SDK widget
```

`TonbankcardCheckout.vue` is the piece you would copy into your own Vue app:
it owns the widget lifecycle and emits the `payment-complete` event with the
transaction hash returned by the wallet.

---

## Production checklist

1. **Verify on-chain.** The `txHash` reported by the wallet is informational.
   Call `sdk.verifySettlement(txHash)` from a trusted backend before granting
   access to the customer.
2. **Idempotent orders.** Use a deterministic `orderId`; the SDK derives a
   stable invoice ID via SHA-256.
3. **No secrets in the client.** Only non-sensitive configuration belongs in
   `import.meta.env`.
4. **Audit your dependencies.** Run `npm audit --omit=dev` before deploying.

---

## References

- [SDK README](../../sdk/README.md)
- [Merchant API spec](../../docs/merchant-api-spec.md)
- [React example](../react-integration/)
- [Vanilla HTML example](../vanilla-html/)
