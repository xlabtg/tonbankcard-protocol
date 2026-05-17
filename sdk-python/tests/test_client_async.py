from __future__ import annotations

import httpx
import pytest
import respx

from tonbankcard_merchant import (
    AsyncMerchantClient,
    Invoice,
    InvoiceNotFoundError,
    InvoiceStatus,
)


@pytest.fixture
async def async_client(api_key: str, base_url: str):
    client = AsyncMerchantClient(api_key=api_key, base_url=base_url, timeout=5.0)
    try:
        yield client
    finally:
        await client.aclose()


def _invoice_response() -> dict[str, object]:
    return {
        "invoice_id": "inv_async",
        "merchant_nft": "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
        "amount_tbc": "1000000000",
        "currency": "TBC",
        "status": "pending",
        "created_at": "2025-12-27T10:00:00Z",
        "expires_at": "2025-12-31T23:59:59Z",
        "payment_url": "https://wallet.tonbankcard.io/pay/inv_async",
        "settlement": None,
    }


@respx.mock
async def test_async_create_invoice(
    async_client: AsyncMerchantClient, base_url: str, valid_nft: str
) -> None:
    respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    invoice = await async_client.create_invoice(merchant_nft=valid_nft, amount_tbc="1000000000")
    assert isinstance(invoice, Invoice)
    assert invoice.invoice_id == "inv_async"
    assert invoice.status is InvoiceStatus.PENDING


@respx.mock
async def test_async_get_invoice_404(async_client: AsyncMerchantClient, base_url: str) -> None:
    respx.get(f"{base_url}/invoice/missing").mock(
        return_value=httpx.Response(
            404,
            json={"error": {"code": "INVOICE_NOT_FOUND", "message": "nope"}},
        )
    )
    with pytest.raises(InvoiceNotFoundError):
        await async_client.get_invoice("missing")


@respx.mock
async def test_async_context_manager(api_key: str, base_url: str, valid_nft: str) -> None:
    respx.post(f"{base_url}/invoice/create").mock(
        return_value=httpx.Response(201, json=_invoice_response())
    )
    async with AsyncMerchantClient(api_key=api_key, base_url=base_url) as client:
        invoice = await client.create_invoice(merchant_nft=valid_nft, amount_tbc="1")
        assert invoice.invoice_id == "inv_async"
