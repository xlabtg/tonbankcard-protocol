# Python integration example — `tonbankcard-merchant`

Self-contained FastAPI service that exercises every entry point of the
[`tonbankcard-merchant`](../../sdk-python/) Python SDK:

1. `POST /pay` — create a fresh invoice via `MerchantClient.create_invoice()`
   and return its `payment_url` to the caller.
2. `GET /status/{invoice_id}` — poll the invoice with
   `MerchantClient.get_invoice_status()`.
3. `POST /webhooks/tonbankcard` — verify the HMAC-SHA256 signature with
   `verify_webhook()` (constant-time) and fulfil the order.

The example is **read-only with respect to funds** — there is no private
key, mnemonic, or signing logic. The TON blockchain is the only authority
for settlement; the merchant backend only verifies what the API tells it.

> Looking for a Node.js reference? See
> [`examples/merchant-demo/`](../merchant-demo/) — the JavaScript counterpart.

---

## What this example shows

- Loading the API key from `TONBANKCARD_API_KEY` (constructor arg only — **never**
  a query parameter, log line, or URL).
- Loading the webhook secret from `TONBANKCARD_WEBHOOK_SECRET`.
- Async-style usage via FastAPI dependency injection (a single
  `AsyncMerchantClient` is reused across requests through the app lifespan).
- Translating SDK exceptions (`InvoiceNotFoundError`, `RateLimitError`, …) into
  HTTP responses with appropriate status codes.
- Verifying webhook payloads with `verify_webhook(secret, raw_body, signature)`
  — note that the **raw request body** must be passed in unmodified, because
  the signature is computed over the exact bytes the API sent.

---

## Prerequisites

- Python **3.9** or newer (`python --version`)
- A TONBANKCARD sandbox API key (`tbck_test_…`)
- The shared webhook secret bound to that API key

---

## Setup

```bash
cd examples/python-integration
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with your sandbox API key + webhook secret
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TONBANKCARD_API_KEY` | yes | Bearer API key (`tbck_test_…` or `tbck_live_…`) |
| `TONBANKCARD_WEBHOOK_SECRET` | yes | Shared HMAC secret used by the API to sign webhook deliveries |
| `TONBANKCARD_BASE_URL` | no | Override the API base URL (defaults to `https://api.tonbankcard.io/v1`) |
| `TONBANKCARD_MERCHANT_NFT` | yes | Your merchant NFT address (TON Base64url, 48 chars) |

> **Never** commit `.env` to source control. The provided `.env.example` is
> the only file with placeholder values; `.gitignore` excludes `.env`.

---

## Run

```bash
uvicorn app:app --reload --port 8000
```

### Create an invoice

```bash
curl -X POST http://127.0.0.1:8000/pay \
  -H 'Content-Type: application/json' \
  -d '{"amount_tbc": "1000000000", "order_id": "ORDER-1"}'
```

Example response:

```json
{
  "invoice_id": "inv_abc123",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_abc123",
  "expires_at": "2026-05-18T00:00:00Z"
}
```

### Poll status

```bash
curl http://127.0.0.1:8000/status/inv_abc123
```

### Receive webhooks

Point the API webhook configuration at:

```
POST http://your-public-host/webhooks/tonbankcard
Header: X-Tonbankcard-Signature
```

To test locally, expose port 8000 via `cloudflared`, `ngrok`, or similar.

---

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

The tests mock the SDK with [`respx`](https://lundberg.github.io/respx/) so
they run offline.
