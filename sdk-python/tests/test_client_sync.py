from __future__ import annotations

import json

import httpx
import pytest
import respx

from tonbankcard_merchant import (
    AuthenticationError,
    Invoice,
    InvoiceExpiredError,
    InvoiceNotFoundError,
    InvoiceStatus,
    MerchantClient,
    RateLimitError,
    ServerError,
)


@pytest.fixture
def client(api_key: str, base_url: str) -> MerchantClient:
    c = MerchantClient(api_key=api_key, base_url=base_url, timeout=5.0)
    yield c
    c.close()


def _invoice_response(status: str = "pending", with_settlement: bool = False) -> dict[str, object]:
    body: dict[str, object] = {
        "invoice_id": "inv_abc123",
        "merchant_nft": "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
        "amount_tbc": "1000000000",
        "currency": "TBC",
        "status": status,
        "created_at": "2025-12-27T10:00:00Z",
        "expires_at": "2025-12-31T23:59:59Z",
        "payment_url": "https://wallet.tonbankcard.io/pay/inv_abc123",
        "metadata": {"order_id": "ORDER-1"},
    }
    if with_settlement:
        body["settlement"] = {
            "payer_nft": "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
            "merchant_nft": body["merchant_nft"],
            "amount_tbc": "1000000000",
            "block_number": 1234,
            "tx_hash": "0xabc",
            "timestamp": "2025-12-27T10:05:00Z",
            "payload_hash": "0xpayload",
            "on_chain_verified": True,
            "verification_url": "https://tonscan.org/tx/0xabc",
        }
    else:
        body["settlement"] = None
    return body


@respx.mock
def test_create_invoice_success(client: MerchantClient, base_url: str, valid_nft: str) -> None:
    route = respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    invoice = client.create_invoice(
        merchant_nft=valid_nft,
        amount_tbc="1000000000",
        metadata={"order_id": "ORDER-1"},
    )
    assert isinstance(invoice, Invoice)
    assert invoice.invoice_id == "inv_abc123"
    assert invoice.status is InvoiceStatus.PENDING
    assert route.called
    body = json.loads(route.calls.last.request.content)
    assert body["merchant_nft"] == valid_nft
    assert body["amount_tbc"] == "1000000000"
    assert body["currency"] == "TBC"
    assert body["metadata"] == {"order_id": "ORDER-1"}
    auth = route.calls.last.request.headers["Authorization"]
    assert auth.startswith("Bearer ")


@respx.mock
def test_create_invoice_with_int_amount(
    client: MerchantClient, base_url: str, valid_nft: str
) -> None:
    route = respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    client.create_invoice(merchant_nft=valid_nft, amount_tbc=1_000_000_000)
    body = json.loads(route.calls.last.request.content)
    assert body["amount_tbc"] == "1000000000"


@respx.mock
def test_create_invoice_validation_error(client: MerchantClient, valid_nft: str) -> None:
    with pytest.raises(ValueError):
        client.create_invoice(merchant_nft="bad-address", amount_tbc="100")
    with pytest.raises(ValueError):
        client.create_invoice(merchant_nft=valid_nft, amount_tbc="0")


@respx.mock
def test_create_invoice_propagates_callback_url(
    client: MerchantClient, base_url: str, valid_nft: str
) -> None:
    route = respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    client.create_invoice(
        merchant_nft=valid_nft,
        amount_tbc="1",
        callback_url="https://merchant.example.com/webhook",
    )
    body = json.loads(route.calls.last.request.content)
    assert body["metadata"]["callback_url"] == "https://merchant.example.com/webhook"


@respx.mock
def test_create_invoice_normalizes_trimmed_inputs(
    client: MerchantClient, base_url: str, valid_nft: str
) -> None:
    route = respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    client.create_invoice(
        merchant_nft=f" \n{valid_nft}\t",
        amount_tbc=" 1000000000 ",
        metadata={"order_id": "ORDER-1"},
    )
    body = json.loads(route.calls.last.request.content)
    assert body["merchant_nft"] == valid_nft
    assert body["amount_tbc"] == "1000000000"


@respx.mock
def test_get_invoice_success(client: MerchantClient, base_url: str) -> None:
    respx.get(f"{base_url}/invoice/inv_abc123").mock(
        return_value=httpx.Response(
            200, json=_invoice_response(status="settled", with_settlement=True)
        )
    )
    invoice = client.get_invoice("inv_abc123")
    assert invoice.status is InvoiceStatus.SETTLED
    assert invoice.settlement is not None
    assert invoice.settlement.block_number == 1234


@respx.mock
def test_get_invoice_status_success(client: MerchantClient, base_url: str) -> None:
    respx.get(f"{base_url}/invoice/inv_abc123/status").mock(
        return_value=httpx.Response(
            200,
            json={
                "invoice_id": "inv_abc123",
                "status": "pending",
                "created_at": "2025-12-27T10:00:00Z",
                "expires_at": "2025-12-31T23:59:59Z",
                "settlement": None,
            },
        )
    )
    status = client.get_invoice_status("inv_abc123")
    assert status.status is InvoiceStatus.PENDING
    assert status.settlement is None


@respx.mock
def test_get_invoice_404_raises(client: MerchantClient, base_url: str) -> None:
    respx.get(f"{base_url}/invoice/missing").mock(
        return_value=httpx.Response(
            404,
            json={"error": {"code": "INVOICE_NOT_FOUND", "message": "Invoice not found"}},
        )
    )
    with pytest.raises(InvoiceNotFoundError) as ei:
        client.get_invoice("missing")
    assert ei.value.code == "INVOICE_NOT_FOUND"
    assert ei.value.status_code == 404


@respx.mock
def test_get_invoice_410_raises(client: MerchantClient, base_url: str) -> None:
    respx.get(f"{base_url}/invoice/expired").mock(
        return_value=httpx.Response(
            410,
            json={"error": {"code": "INVOICE_EXPIRED", "message": "Invoice expired"}},
        )
    )
    with pytest.raises(InvoiceExpiredError):
        client.get_invoice("expired")


@respx.mock
def test_unauthorized_raises(client: MerchantClient, base_url: str, valid_nft: str) -> None:
    respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(
            401,
            json={"error": {"code": "INVALID_API_KEY", "message": "Invalid key"}},
        )
    )
    with pytest.raises(AuthenticationError):
        client.create_invoice(merchant_nft=valid_nft, amount_tbc="100")


@respx.mock
def test_rate_limited_extracts_retry_after(
    client: MerchantClient, base_url: str, valid_nft: str
) -> None:
    respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(
            429,
            headers={"Retry-After": "12"},
            json={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Slow down"}},
        )
    )
    with pytest.raises(RateLimitError) as ei:
        client.create_invoice(merchant_nft=valid_nft, amount_tbc="100")
    assert ei.value.retry_after == 12.0


@respx.mock
def test_server_error_raises(client: MerchantClient, base_url: str, valid_nft: str) -> None:
    respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(503, text="Service unavailable")
    )
    with pytest.raises(ServerError) as ei:
        client.create_invoice(merchant_nft=valid_nft, amount_tbc="100")
    assert ei.value.status_code == 503


@respx.mock
def test_invoice_id_is_url_encoded(client: MerchantClient, base_url: str) -> None:
    route = respx.get(f"{base_url}/invoice/inv_%2F..%2Fboom").mock(
        return_value=httpx.Response(
            404,
            json={"error": {"code": "INVOICE_NOT_FOUND", "message": "not found"}},
        )
    )
    with pytest.raises(InvoiceNotFoundError):
        client.get_invoice("inv_/../boom")
    assert route.called


def test_client_requires_api_key() -> None:
    with pytest.raises(ValueError):
        MerchantClient(api_key="")


def test_client_context_manager_closes(api_key: str, base_url: str) -> None:
    with MerchantClient(api_key=api_key, base_url=base_url) as c:
        assert c.base_url == base_url
    assert c._http.is_closed


def test_static_helpers_are_exposed_on_client() -> None:
    sig = MerchantClient.compute_signature("s", 1700000000, b"payload")
    assert isinstance(sig, str) and len(sig) == 64
