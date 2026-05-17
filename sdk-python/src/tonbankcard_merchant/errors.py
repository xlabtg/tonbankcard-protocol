"""Exception hierarchy for the TONBANKCARD Merchant SDK."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Optional


class MerchantApiError(Exception):
    """Base exception for all SDK errors."""


class SignatureVerificationError(MerchantApiError):
    """Raised when webhook signature verification fails."""


class ApiError(MerchantApiError):
    """Raised when the Merchant API returns a non-2xx response.

    Attributes:
        status_code: HTTP status code from the API response.
        code: Machine-readable error code (e.g. ``INVALID_API_KEY``).
        message: Human-readable error message.
        details: Additional context returned by the API.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Mapping[str, Any]] = None,
    ) -> None:
        super().__init__(f"[{status_code} {code}] {message}")
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details: Mapping[str, Any] = dict(details) if details else {}


class AuthenticationError(ApiError):
    """HTTP 401/403 — invalid API key or unauthorised merchant."""


class InvalidRequestError(ApiError):
    """HTTP 400 — request parameters failed validation."""


class InvoiceNotFoundError(ApiError):
    """HTTP 404 — invoice id does not exist."""


class InvoiceExpiredError(ApiError):
    """HTTP 410 — invoice has expired."""


class RateLimitError(ApiError):
    """HTTP 429 — rate limit exceeded.

    The ``retry_after`` attribute (seconds) is populated from the
    ``Retry-After`` response header when present.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Mapping[str, Any]] = None,
        retry_after: Optional[float] = None,
    ) -> None:
        super().__init__(status_code, code, message, details)
        self.retry_after = retry_after


class ServerError(ApiError):
    """HTTP 5xx — server-side failure."""
