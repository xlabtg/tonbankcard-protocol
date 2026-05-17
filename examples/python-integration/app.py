"""FastAPI reference integration for tonbankcard-merchant.

Run::

    uvicorn app:app --reload --port 8000

Endpoints:
    POST /pay                       Create an invoice and return payment_url
    GET  /status/{invoice_id}       Poll invoice status
    POST /webhooks/tonbankcard      Receive signed settlement webhooks
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated, AsyncIterator, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from tonbankcard_merchant import (
    AsyncMerchantClient,
    DEFAULT_SIGNATURE_HEADER,
    ApiError,
    AuthenticationError,
    InvalidRequestError,
    InvoiceExpiredError,
    InvoiceNotFoundError,
    RateLimitError,
    SignatureVerificationError,
    verify_webhook,
)

logger = logging.getLogger("tonbankcard.example")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Environment variable {name!r} is required. "
            "Copy .env.example to .env and fill in the placeholders."
        )
    return value


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    api_key = _require_env("TONBANKCARD_API_KEY")
    base_url = os.environ.get("TONBANKCARD_BASE_URL", "https://api.tonbankcard.io/v1")
    client = AsyncMerchantClient(api_key=api_key, base_url=base_url)
    app.state.client = client
    app.state.merchant_nft = _require_env("TONBANKCARD_MERCHANT_NFT")
    app.state.webhook_secret = _require_env("TONBANKCARD_WEBHOOK_SECRET")
    try:
        yield
    finally:
        await client.aclose()


app = FastAPI(title="TONBANKCARD merchant example", lifespan=lifespan)


async def get_client(request: Request) -> AsyncMerchantClient:
    return request.app.state.client


ClientDep = Annotated[AsyncMerchantClient, Depends(get_client)]


class PayRequest(BaseModel):
    amount_tbc: str = Field(
        ..., description="Amount in TBC nanocoins, decimal string (1 TBC = 10**9 nanocoins)."
    )
    order_id: Optional[str] = Field(
        default=None, description="Merchant-side order identifier, surfaced via metadata."
    )


class PayResponse(BaseModel):
    invoice_id: str
    payment_url: str
    expires_at: str


@app.post("/pay", response_model=PayResponse)
async def create_invoice(req: PayRequest, request: Request, client: ClientDep) -> PayResponse:
    metadata = {"order_id": req.order_id} if req.order_id else None
    try:
        invoice = await client.create_invoice(
            merchant_nft=request.app.state.merchant_nft,
            amount_tbc=req.amount_tbc,
            metadata=metadata,
        )
    except InvalidRequestError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except AuthenticationError as exc:
        logger.error("auth failure talking to TONBANKCARD: %s", exc.message)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="payment provider unauthorized") from exc
    except RateLimitError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate limit exceeded",
            headers=headers,
        ) from exc
    except ApiError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc

    return PayResponse(
        invoice_id=invoice.invoice_id,
        payment_url=invoice.payment_url,
        expires_at=invoice.expires_at,
    )


@app.get("/status/{invoice_id}")
async def get_status(invoice_id: str, client: ClientDep) -> dict:
    try:
        status_obj = await client.get_invoice_status(invoice_id)
    except InvoiceNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invoice not found") from exc
    except InvoiceExpiredError as exc:
        raise HTTPException(status.HTTP_410_GONE, detail="invoice expired") from exc
    except ApiError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc

    payload: dict = {
        "invoice_id": status_obj.invoice_id,
        "status": status_obj.status.value,
        "created_at": status_obj.created_at,
        "expires_at": status_obj.expires_at,
    }
    if status_obj.settlement is not None:
        payload["settlement"] = {
            "tx_hash": status_obj.settlement.tx_hash,
            "block_number": status_obj.settlement.block_number,
            "timestamp": status_obj.settlement.timestamp,
            "on_chain_verified": status_obj.settlement.on_chain_verified,
        }
    return payload


@app.post("/webhooks/tonbankcard")
async def receive_webhook(
    request: Request,
    x_tonbankcard_signature: Annotated[Optional[str], Header(alias=DEFAULT_SIGNATURE_HEADER)] = None,
) -> dict:
    if not x_tonbankcard_signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="missing signature header")

    raw_body = await request.body()
    secret = request.app.state.webhook_secret

    try:
        payload = verify_webhook(
            secret=secret,
            payload=raw_body,
            signature=x_tonbankcard_signature,
        )
    except SignatureVerificationError as exc:
        logger.warning("rejected webhook with bad signature: %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid signature") from exc

    logger.info(
        "received webhook event=%s invoice=%s status=%s",
        payload.event,
        payload.invoice_id,
        payload.status.value,
    )
    return {"received": True, "invoice_id": payload.invoice_id}
