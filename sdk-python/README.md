# `tonbankcard-merchant` — Python SDK

[![PyPI](https://img.shields.io/pypi/v/tonbankcard-merchant.svg)](https://pypi.org/project/tonbankcard-merchant/)
[![Python](https://img.shields.io/pypi/pyversions/tonbankcard-merchant.svg)](https://pypi.org/project/tonbankcard-merchant/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Official Python SDK for the [TONBANKCARD](https://github.com/xlabtg/tonbankcard-protocol) Merchant API — a stateless, non-custodial payment orchestration layer on TON.

## Why this SDK

* 📦 One install, two clients — sync (`MerchantClient`) and async (`AsyncMerchantClient`).
* 🔒 **Read-only / non-custodial by design** — never stores private keys, never signs transactions, never moves funds. The blockchain is the only source of truth.
* 🧾 Built from the [`docs/openapi.yaml`](../docs/openapi.yaml) spec, with strict client-side validation for merchant NFT addresses, amounts (≤ 2¹²⁰ − 1) and metadata (≤ 10 scalar fields).
* 🛡 Constant-time HMAC-SHA256 webhook verification (`hmac.compare_digest`).
* 🐍 Python ≥ 3.9, fully type-annotated (PEP 561 `py.typed` shipped in the wheel).

## Installation

```bash
pip install tonbankcard-merchant
```

The only runtime dependency is [`httpx`](https://www.python-httpx.org/).

## Quickstart

### Sync

```python
from tonbankcard_merchant import MerchantClient

with MerchantClient(api_key="tbck_live_...") as client:
    invoice = client.create_invoice(
        merchant_nft="EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
        amount_tbc="1000000000",  # 1 TBC, in nanocoins
        metadata={"order_id": "ORDER-12345"},
    )
    print(invoice.payment_url)

    status = client.get_invoice_status(invoice.invoice_id)
    if status.status.value == "settled":
        assert status.settlement is not None
        print("Settled at block:", status.settlement.block_number)
```

### Async

```python
import asyncio
from tonbankcard_merchant import AsyncMerchantClient

async def main() -> None:
    async with AsyncMerchantClient(api_key="tbck_live_...") as client:
        invoice = await client.create_invoice(
            merchant_nft="EQA...",
            amount_tbc=1_000_000_000,
            callback_url="https://merchant.example.com/webhook",
        )
        print(invoice.payment_url)

asyncio.run(main())
```

### Verifying a webhook (constant-time HMAC-SHA256)

The shared secret is provisioned via the merchant dashboard. Pass the **raw**
request body bytes — never `json.dumps(json.loads(body))`, which re-orders keys
and breaks the signature.

```python
from tonbankcard_merchant import verify_webhook, SignatureVerificationError

def fastapi_handler(request, secret: str):
    raw = request.body  # bytes
    sig = request.headers["X-Tonbankcard-Signature"]
    try:
        payload = verify_webhook(secret=secret, payload=raw, signature=sig)
    except SignatureVerificationError as exc:
        return {"status": "rejected", "reason": str(exc)}, 400
    return fulfil_order(payload.invoice_id, payload.settlement)
```

The server signs deliveries with a structured, timestamped header
(`X-Tonbankcard-Signature: t=<unix-timestamp>,v1=<hex>`). `verify_webhook`
recomputes `HMAC-SHA256(secret, f"{t}.{raw_body}")`, compares the `v1` digest in
constant time, and rejects deliveries whose timestamp falls outside a
configurable freshness window (`tolerance`, default 300 seconds) — providing
replay protection. Pass `now=` to override the clock in tests.

```python
payload = verify_webhook(secret=secret, payload=raw, signature=sig, tolerance=120)
```

## Error handling

All API failures raise subclasses of `MerchantApiError`:

| HTTP   | Exception                  |
|--------|----------------------------|
| 400    | `InvalidRequestError`      |
| 401/403| `AuthenticationError`      |
| 404    | `InvoiceNotFoundError`     |
| 410    | `InvoiceExpiredError`      |
| 429    | `RateLimitError` (with `.retry_after`) |
| 5xx    | `ServerError`              |
| other  | `ApiError`                 |

Webhook signature failures raise `SignatureVerificationError`.

Client-side validation errors (bad address, non-positive amount, oversized
metadata) raise the stdlib `ValueError`.

## Security checklist

The SDK is designed so that misuse is hard to commit accidentally:

* 🔑 API keys travel only via the `Authorization` header — never via URL params.
* 🚫 Invoice ids are URL-encoded before being interpolated into request paths.
* ⏱ Webhook signatures are compared with `hmac.compare_digest` (constant time).
* 🧪 Tests exercise tampered bodies, wrong secrets, malformed signatures and
  non-JSON payloads to lock these behaviours in.
* 📁 No credentials are committed to examples — all examples use environment
  variables.

## Development

```bash
git clone https://github.com/xlabtg/tonbankcard-protocol
cd tonbankcard-protocol/sdk-python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

pytest           # run unit tests
ruff check .     # lint
mypy             # type check (strict)
python -m build  # build sdist + wheel
```

The same checks run in CI on every PR (see
[`.github/workflows/python-sdk.yml`](../.github/workflows/python-sdk.yml)).

## Versioning & publication

The package follows [Semantic Versioning](https://semver.org/) and tracks the
Merchant API version. Releases are published to PyPI via GitHub Actions using
[Trusted Publishing](https://docs.pypi.org/trusted-publishers/) (OIDC) —
no long-lived tokens are stored in the repo, and every published artefact is
accompanied by a [PEP 740](https://peps.python.org/pep-0740/) attestation /
sigstore signature.

## License

[MIT](./LICENSE) — © 2025 TONBANKCARD Protocol.
