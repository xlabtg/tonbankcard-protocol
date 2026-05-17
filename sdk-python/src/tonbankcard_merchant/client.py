"""Synchronous and asynchronous HTTP clients for the Merchant API."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Optional, Union
from urllib.parse import quote

import httpx

from .errors import (
    ApiError,
    AuthenticationError,
    InvalidRequestError,
    InvoiceExpiredError,
    InvoiceNotFoundError,
    RateLimitError,
    ServerError,
)
from .models import (
    CreateInvoiceRequest,
    Invoice,
    InvoiceMetadata,
    InvoiceStatusResponse,
)
from .webhooks import compute_signature, verify_webhook

DEFAULT_BASE_URL = "https://api.tonbankcard.io/v1"
DEFAULT_TIMEOUT = 30.0
USER_AGENT = "tonbankcard-merchant-python/1.0.0"


def _build_headers(api_key: str, extra: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    if not api_key or not isinstance(api_key, str):
        raise ValueError("api_key must be a non-empty string")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def _build_request_payload(
    merchant_nft: str,
    amount_tbc: Union[str, int],
    metadata: Optional[InvoiceMetadata],
    expires_at: Optional[str],
    callback_url: Optional[str],
) -> dict[str, Any]:
    amount_str = str(amount_tbc) if isinstance(amount_tbc, int) else amount_tbc
    merged_metadata: Optional[dict[str, Any]] = None
    if metadata is not None or callback_url is not None:
        merged_metadata = dict(metadata) if metadata else {}
        if callback_url is not None:
            merged_metadata.setdefault("callback_url", callback_url)
    request = CreateInvoiceRequest(
        merchant_nft=merchant_nft,
        amount_tbc=amount_str,
        currency="TBC",
        metadata=merged_metadata,
        expires_at=expires_at,
    )
    return request.to_dict()


_ERROR_MAP: dict[int, type[ApiError]] = {
    400: InvalidRequestError,
    401: AuthenticationError,
    403: AuthenticationError,
    404: InvoiceNotFoundError,
    410: InvoiceExpiredError,
    429: RateLimitError,
}


def _raise_for_response(response: httpx.Response) -> None:
    if response.is_success:
        return
    code = "INTERNAL_ERROR"
    message = response.reason_phrase or f"HTTP {response.status_code}"
    details: Mapping[str, Any] = {}
    try:
        body = response.json()
    except (ValueError, httpx.DecodingError):
        body = None
    if isinstance(body, Mapping):
        error_obj = body.get("error")
        if isinstance(error_obj, Mapping):
            code = str(error_obj.get("code", code))
            message = str(error_obj.get("message", message))
            details = error_obj.get("details") or {}
    exc_class = _ERROR_MAP.get(response.status_code)
    if exc_class is None:
        exc_class = ServerError if response.status_code >= 500 else ApiError
    if exc_class is RateLimitError:
        retry_after_header = response.headers.get("Retry-After")
        retry_after: Optional[float] = None
        if retry_after_header is not None:
            try:
                retry_after = float(retry_after_header)
            except ValueError:
                retry_after = None
        raise RateLimitError(
            status_code=response.status_code,
            code=code,
            message=message,
            details=details,
            retry_after=retry_after,
        )
    raise exc_class(
        status_code=response.status_code,
        code=code,
        message=message,
        details=details,
    )


def _encode_invoice_id(invoice_id: str) -> str:
    if not invoice_id or not isinstance(invoice_id, str):
        raise ValueError("invoice_id must be a non-empty string")
    return quote(invoice_id, safe="")


class _ClientBase:
    """Shared configuration for sync and async clients."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._headers = _build_headers(api_key)

    @property
    def base_url(self) -> str:
        return self._base_url


class MerchantClient(_ClientBase):
    """Synchronous client for the TONBANKCARD Merchant API.

    The client is thread-safe for use as a singleton — the underlying
    :class:`httpx.Client` re-uses connections via a pool. Call :meth:`close`
    (or use the client as a context manager) to release sockets.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        super().__init__(api_key=api_key, base_url=base_url, timeout=timeout)
        self._http = httpx.Client(
            base_url=self._base_url,
            headers=self._headers,
            timeout=timeout,
            transport=transport,
        )

    def __enter__(self) -> MerchantClient:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def close(self) -> None:
        """Close underlying HTTP connections."""
        self._http.close()

    def create_invoice(
        self,
        merchant_nft: str,
        amount_tbc: Union[str, int],
        *,
        currency: str = "TBC",
        metadata: Optional[InvoiceMetadata] = None,
        expires_at: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Invoice:
        """Create a new payment invoice.

        Args:
            merchant_nft: Merchant NFT address (TON Base64url, 48 chars).
            amount_tbc: Amount in TBC nanocoins (``1 TBC = 10**9``). Accepts
                ``int`` (converted via ``str``) or a decimal string.
            currency: Currency code; must be ``"TBC"`` in v1.0.0.
            metadata: Optional metadata (≤10 keys, scalar values).
            expires_at: ISO 8601 expiration timestamp (defaults to 24h server-side).
            callback_url: Optional webhook callback URL. Stored in
                ``metadata.callback_url`` so it round-trips through the API.

        Returns:
            The created :class:`Invoice`.

        Raises:
            ValueError: If parameters fail client-side validation.
            ApiError: For non-2xx API responses (specific subclasses indicate
                authentication, rate limiting, etc.).
        """
        if currency != "TBC":
            raise ValueError(f"Unsupported currency '{currency}': v1.0.0 supports only 'TBC'")
        payload = _build_request_payload(
            merchant_nft=merchant_nft,
            amount_tbc=amount_tbc,
            metadata=metadata,
            expires_at=expires_at,
            callback_url=callback_url,
        )
        response = self._http.post("/invoice/create", json=payload)
        _raise_for_response(response)
        return Invoice.from_dict(response.json())

    def get_invoice(self, invoice_id: str) -> Invoice:
        """Retrieve an existing invoice by id.

        Raises:
            InvoiceNotFoundError: If the invoice id is unknown.
        """
        path = f"/invoice/{_encode_invoice_id(invoice_id)}"
        response = self._http.get(path)
        _raise_for_response(response)
        return Invoice.from_dict(response.json())

    def get_invoice_status(self, invoice_id: str) -> InvoiceStatusResponse:
        """Get the settlement status of an invoice.

        Raises:
            InvoiceNotFoundError: If the invoice id is unknown.
        """
        path = f"/invoice/{_encode_invoice_id(invoice_id)}/status"
        response = self._http.get(path)
        _raise_for_response(response)
        return InvoiceStatusResponse.from_dict(response.json())

    @staticmethod
    def verify_webhook(
        secret: Union[str, bytes], payload: Union[str, bytes], signature: str
    ) -> Any:
        """Verify a webhook signature and return the parsed payload.

        Thin wrapper around :func:`tonbankcard_merchant.webhooks.verify_webhook`
        for ergonomic discoverability via the client object.
        """
        return verify_webhook(secret=secret, payload=payload, signature=signature)

    @staticmethod
    def compute_signature(secret: Union[str, bytes], payload: Union[str, bytes]) -> str:
        """Compute the canonical HMAC-SHA256 hex signature for a payload."""
        return compute_signature(secret=secret, payload=payload)


class AsyncMerchantClient(_ClientBase):
    """Asynchronous client for the TONBANKCARD Merchant API.

    Mirrors :class:`MerchantClient` but uses :class:`httpx.AsyncClient` under
    the hood. Suitable for use with FastAPI, aiohttp, asyncio loops, etc.

    Example::

        async with AsyncMerchantClient(api_key="tbck_live_...") as client:
            invoice = await client.create_invoice(
                merchant_nft="EQA...",
                amount_tbc="1000000000",
            )
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        super().__init__(api_key=api_key, base_url=base_url, timeout=timeout)
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=timeout,
            transport=transport,
        )

    async def __aenter__(self) -> AsyncMerchantClient:
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def create_invoice(
        self,
        merchant_nft: str,
        amount_tbc: Union[str, int],
        *,
        currency: str = "TBC",
        metadata: Optional[InvoiceMetadata] = None,
        expires_at: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Invoice:
        if currency != "TBC":
            raise ValueError(f"Unsupported currency '{currency}': v1.0.0 supports only 'TBC'")
        payload = _build_request_payload(
            merchant_nft=merchant_nft,
            amount_tbc=amount_tbc,
            metadata=metadata,
            expires_at=expires_at,
            callback_url=callback_url,
        )
        response = await self._http.post("/invoice/create", json=payload)
        _raise_for_response(response)
        return Invoice.from_dict(response.json())

    async def get_invoice(self, invoice_id: str) -> Invoice:
        path = f"/invoice/{_encode_invoice_id(invoice_id)}"
        response = await self._http.get(path)
        _raise_for_response(response)
        return Invoice.from_dict(response.json())

    async def get_invoice_status(self, invoice_id: str) -> InvoiceStatusResponse:
        path = f"/invoice/{_encode_invoice_id(invoice_id)}/status"
        response = await self._http.get(path)
        _raise_for_response(response)
        return InvoiceStatusResponse.from_dict(response.json())

    @staticmethod
    def verify_webhook(
        secret: Union[str, bytes], payload: Union[str, bytes], signature: str
    ) -> Any:
        return verify_webhook(secret=secret, payload=payload, signature=signature)

    @staticmethod
    def compute_signature(secret: Union[str, bytes], payload: Union[str, bytes]) -> str:
        return compute_signature(secret=secret, payload=payload)
