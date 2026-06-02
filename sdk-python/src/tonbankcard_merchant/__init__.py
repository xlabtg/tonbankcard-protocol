"""TONBANKCARD Merchant SDK for Python.

This SDK wraps the Merchant API (see ``docs/openapi.yaml`` in the repository)
and exposes synchronous and asynchronous clients for creating invoices,
polling settlement status, and verifying webhook payloads.

The SDK is **read-only and non-custodial**. It never stores private keys,
signs transactions, or moves user funds — the TON blockchain is the single
source of truth for settlement.

Quickstart::

    from tonbankcard_merchant import MerchantClient

    client = MerchantClient(api_key="tbck_live_...")
    invoice = client.create_invoice(
        merchant_nft="EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
        amount_tbc="1000000000",
        metadata={"order_id": "ORDER-12345"},
    )
    print(invoice.payment_url)

For an async example see :class:`tonbankcard_merchant.AsyncMerchantClient`.
"""

from __future__ import annotations

from .client import AsyncMerchantClient, MerchantClient
from .errors import (
    ApiError,
    AuthenticationError,
    InvalidRequestError,
    InvoiceExpiredError,
    InvoiceNotFoundError,
    MerchantApiError,
    RateLimitError,
    ServerError,
    SignatureVerificationError,
)
from .models import (
    CreateInvoiceRequest,
    Invoice,
    InvoiceMetadata,
    InvoiceStatus,
    InvoiceStatusResponse,
    Settlement,
    WebhookPayload,
)
from .webhooks import (
    DEFAULT_SIGNATURE_HEADER,
    DEFAULT_TOLERANCE_SECONDS,
    SIGNATURE_VERSION,
    compute_signature,
    verify_webhook,
)

__all__ = [
    "DEFAULT_SIGNATURE_HEADER",
    "DEFAULT_TOLERANCE_SECONDS",
    "SIGNATURE_VERSION",
    "ApiError",
    "AsyncMerchantClient",
    "AuthenticationError",
    "CreateInvoiceRequest",
    "InvalidRequestError",
    "Invoice",
    "InvoiceExpiredError",
    "InvoiceMetadata",
    "InvoiceNotFoundError",
    "InvoiceStatus",
    "InvoiceStatusResponse",
    "MerchantApiError",
    "MerchantClient",
    "RateLimitError",
    "ServerError",
    "Settlement",
    "SignatureVerificationError",
    "WebhookPayload",
    "__version__",
    "compute_signature",
    "verify_webhook",
]

__version__ = "1.1.0"
