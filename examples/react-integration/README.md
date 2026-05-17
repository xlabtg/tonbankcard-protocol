# React integration example — `@tonbankcard/merchant-sdk`

Standalone React + Vite project that demonstrates how to embed the
TONBANKCARD non-custodial payment widget into a React UI and verify
the resulting on-chain settlement.

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
- Mounting `TonbankcardPaymentWidget` inside a React component
- Subscribing to the `onPaymentComplete` callback (transaction hash returned by
  the wallet) and explicitly re-verifying it on-chain before fulfilment

---

## Prerequisites

- Node.js **20 LTS** or newer (`node --version`)
- A TON wallet that supports `ton://transfer/` deep links
  (Tonkeeper, MyTonWallet, OpenMask, …)
- Test TBC on a testnet NFT card (see the [testnet engagement
  guide](../../docs/integrations/) for how to get one)

---

## Setup

```bash
cd examples/react-integration
cp .env.example .env.local
npm install
npm run dev
```

The dev server starts on <http://127.0.0.1:5173>.

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
examples/react-integration/
├── index.html                 # Vite entry
├── package.json               # Standalone — no monorepo dependency
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── src/
    ├── main.tsx               # ReactDOM bootstrap
    ├── App.tsx                # Order form + invoice state
    └── TonbankcardCheckout.tsx # React wrapper around the SDK widget
```

`TonbankcardCheckout` is the piece you would copy into your own React app: it
owns the widget lifecycle and exposes the `onPaymentComplete` callback
required by the issue's functional requirements.

---

## Production checklist

1. **Verify on-chain.** The `txHash` returned by the wallet is informational.
   Call `sdk.verifySettlement(txHash)` from a trusted backend (or your own
   indexer) before granting access to the customer.
2. **Idempotent orders.** Use `sdk.createInvoice` with a deterministic
   `orderId`; the SDK derives a stable invoice ID via SHA-256.
3. **No secrets in the client.** This bundle is shipped to end users; only
   non-sensitive configuration belongs in `import.meta.env`.
4. **Audit your dependencies.** Run `npm audit --omit=dev` and resolve any
   high/critical findings before deploying.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `SDK not initialised. Check VITE_MERCHANT_NFT…` | `.env.local` missing or merchant NFT address invalid. |
| Wallet opens but does not return | Wallet does not support `ton://transfer/` deep links. Try Tonkeeper. |
| `verifySettlement` reports `Transaction not found` | The tx is still pending; retry with backoff. |

---

## References

- [SDK README](../../sdk/README.md)
- [Merchant API spec](../../docs/merchant-api-spec.md)
- [`TonbankcardPaymentWidget`](../../sdk/src/widget/PaymentWidget.ts)
