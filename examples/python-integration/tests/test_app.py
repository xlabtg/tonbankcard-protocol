"""End-to-end tests for the FastAPI example, mocking the Merchant API with respx."""
from __future__ import annotations

import json
import os
import time

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from tonbankcard_merchant import compute_signature

VALID_NFT = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le"
WEBHOOK_SECRET = "shhh-very-secret-bytes"


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("TONBANKCARD_API_KEY", "tbck_test_xxx")
    monkeypatch.setenv("TONBANKCARD_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("TONBANKCARD_MERCHANT_NFT", VALID_NFT)
    monkeypatch.setenv("TONBANKCARD_BASE_URL", "https://api.test.tonbankcard.io/v1")

    from app import app

    with TestClient(app) as test_client:
        yield test_client


@respx.mock
def test_create_invoice_returns_payment_url(client: TestClient) -> None:
    respx.post("https://api.test.tonbankcard.io/v1/invoice/create").mock(
        return_value=httpx.Response(
            201,
            json={
                "invoice_id": "inv_abc",
                "merchant_nft": VALID_NFT,
                "amount_tbc": "1000000000",
                "currency": "TBC",
                "status": "pending",
                "created_at": "2026-05-17T10:00:00Z",
                "expires_at": "2026-05-18T10:00:00Z",
                "payment_url": "https://wallet.tonbankcard.io/pay/inv_abc",
            },
        )
    )

    response = client.post("/pay", json={"amount_tbc": "1000000000", "order_id": "ORDER-1"})
    assert response.status_code == 200
    assert response.json() == {
        "invoice_id": "inv_abc",
        "payment_url": "https://wallet.tonbankcard.io/pay/inv_abc",
        "expires_at": "2026-05-18T10:00:00Z",
    }


@respx.mock
def test_status_settled(client: TestClient) -> None:
    respx.get("https://api.test.tonbankcard.io/v1/invoice/inv_abc/status").mock(
        return_value=httpx.Response(
            200,
            json={
                "invoice_id": "inv_abc",
                "status": "settled",
                "created_at": "2026-05-17T10:00:00Z",
                "expires_at": "2026-05-18T10:00:00Z",
                "settlement": {
                    "payer_nft": VALID_NFT,
                    "merchant_nft": VALID_NFT,
                    "amount_tbc": "1000000000",
                    "block_number": 42,
                    "tx_hash": "0xdeadbeef",
                    "timestamp": "2026-05-17T10:05:00Z",
                    "payload_hash": "0x7f",
                    "on_chain_verified": True,
                },
            },
        )
    )

    response = client.get("/status/inv_abc")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "settled"
    assert body["settlement"]["tx_hash"] == "0xdeadbeef"


@respx.mock
def test_status_not_found_maps_to_404(client: TestClient) -> None:
    respx.get("https://api.test.tonbankcard.io/v1/invoice/unknown/status").mock(
        return_value=httpx.Response(
            404, json={"error": {"code": "INVOICE_NOT_FOUND", "message": "no such invoice"}}
        )
    )
    response = client.get("/status/unknown")
    assert response.status_code == 404


def test_webhook_accepts_valid_signature(client: TestClient) -> None:
    body = json.dumps(
        {
            "event": "invoice.settled",
            "invoice_id": "inv_abc",
            "status": "settled",
            "timestamp": "2026-05-17T10:05:00Z",
        }
    ).encode()
    ts = int(time.time())
    sig = f"t={ts},v1={compute_signature(WEBHOOK_SECRET, ts, body)}"
    response = client.post(
        "/webhooks/tonbankcard",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Tonbankcard-Signature": sig,
        },
    )
    assert response.status_code == 200
    assert response.json() == {"received": True, "invoice_id": "inv_abc"}


def test_webhook_rejects_bad_signature(client: TestClient) -> None:
    body = b'{"event":"invoice.settled","invoice_id":"inv_abc","status":"settled","timestamp":"2026-05-17T10:05:00Z"}'
    response = client.post(
        "/webhooks/tonbankcard",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Tonbankcard-Signature": "0" * 64,
        },
    )
    assert response.status_code == 401


def test_webhook_rejects_missing_signature(client: TestClient) -> None:
    response = client.post(
        "/webhooks/tonbankcard",
        content=b"{}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400


def test_missing_api_key_raises_on_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in (
        "TONBANKCARD_API_KEY",
        "TONBANKCARD_WEBHOOK_SECRET",
        "TONBANKCARD_MERCHANT_NFT",
    ):
        monkeypatch.delenv(var, raising=False)

    from app import app

    with pytest.raises(RuntimeError, match="TONBANKCARD_API_KEY"):
        with TestClient(app):
            pass
