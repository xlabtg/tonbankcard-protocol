"""Data models for the TONBANKCARD Merchant API.

The models mirror the schemas in ``docs/openapi.yaml`` and are encoded as
plain :func:`dataclasses.dataclass` instances so the SDK has zero non-stdlib
runtime dependencies beyond ``httpx``.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Union

InvoiceMetadataValue = Union[str, int, float, bool]
InvoiceMetadata = Mapping[str, InvoiceMetadataValue]

_TON_ADDRESS_RE = re.compile(r"^[EU][Qq][A-Za-z0-9_-]{46}$")
_AMOUNT_RE = re.compile(r"^[1-9][0-9]*$")
_METADATA_KEY_RE = re.compile(r"^[a-zA-Z0-9_]+$")

_MAX_METADATA_FIELDS = 10
_MAX_METADATA_VALUE_LENGTH = 256
_TBC_MAX_AMOUNT = (1 << 120) - 1


class InvoiceStatus(str, Enum):
    """Lifecycle status of an invoice."""

    PENDING = "pending"
    SETTLED = "settled"
    EXPIRED = "expired"


@dataclass(frozen=True)
class Settlement:
    """On-chain settlement proof for an invoice."""

    payer_nft: str
    merchant_nft: str
    amount_tbc: str
    block_number: int
    tx_hash: str
    timestamp: str
    payload_hash: str
    on_chain_verified: bool = False
    verification_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Settlement:
        return cls(
            payer_nft=str(data["payer_nft"]),
            merchant_nft=str(data["merchant_nft"]),
            amount_tbc=str(data["amount_tbc"]),
            block_number=int(data["block_number"]),
            tx_hash=str(data["tx_hash"]),
            timestamp=str(data["timestamp"]),
            payload_hash=str(data["payload_hash"]),
            on_chain_verified=bool(data.get("on_chain_verified", False)),
            verification_url=(
                str(data["verification_url"]) if data.get("verification_url") else None
            ),
        )


@dataclass(frozen=True)
class Invoice:
    """An invoice as returned by ``POST /invoice/create`` and ``GET /invoice/{id}``."""

    invoice_id: str
    merchant_nft: str
    amount_tbc: str
    currency: str
    status: InvoiceStatus
    created_at: str
    expires_at: str
    payment_url: str
    metadata: Optional[InvoiceMetadata] = None
    settlement: Optional[Settlement] = None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> Invoice:
        settlement = data.get("settlement")
        return cls(
            invoice_id=str(data["invoice_id"]),
            merchant_nft=str(data["merchant_nft"]),
            amount_tbc=str(data["amount_tbc"]),
            currency=str(data.get("currency", "TBC")),
            status=InvoiceStatus(str(data["status"])),
            created_at=str(data["created_at"]),
            expires_at=str(data["expires_at"]),
            payment_url=str(data["payment_url"]),
            metadata=dict(data["metadata"]) if data.get("metadata") else None,
            settlement=Settlement.from_dict(settlement) if settlement else None,
        )


@dataclass(frozen=True)
class InvoiceStatusResponse:
    """Response body for ``GET /invoice/{id}/status``."""

    invoice_id: str
    status: InvoiceStatus
    created_at: str
    expires_at: str
    settlement: Optional[Settlement] = None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> InvoiceStatusResponse:
        settlement = data.get("settlement")
        return cls(
            invoice_id=str(data["invoice_id"]),
            status=InvoiceStatus(str(data["status"])),
            created_at=str(data["created_at"]),
            expires_at=str(data["expires_at"]),
            settlement=Settlement.from_dict(settlement) if settlement else None,
        )


@dataclass
class CreateInvoiceRequest:
    """Payload for ``POST /invoice/create``.

    Use ``MerchantClient.create_invoice`` for the common path — this class is
    exposed primarily for type hints and advanced workflows that build the
    request payload manually.
    """

    merchant_nft: str
    amount_tbc: str
    currency: str = "TBC"
    metadata: Optional[InvoiceMetadata] = None
    expires_at: Optional[str] = None

    def __post_init__(self) -> None:
        validate_merchant_nft(self.merchant_nft)
        validate_amount(self.amount_tbc)
        if self.currency != "TBC":
            raise ValueError(f"Unsupported currency '{self.currency}': v1.0.0 supports only 'TBC'")
        if self.metadata is not None:
            validate_metadata(self.metadata)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "merchant_nft": self.merchant_nft,
            "amount_tbc": self.amount_tbc,
            "currency": self.currency,
        }
        if self.metadata is not None:
            payload["metadata"] = dict(self.metadata)
        if self.expires_at is not None:
            payload["expires_at"] = self.expires_at
        return payload


@dataclass(frozen=True)
class WebhookPayload:
    """Settlement webhook payload (signed with HMAC-SHA256).

    See :func:`tonbankcard_merchant.webhooks.verify_webhook` for verification.
    """

    event: str
    invoice_id: str
    status: InvoiceStatus
    timestamp: str
    settlement: Optional[Settlement] = None
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False, compare=False)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> WebhookPayload:
        settlement = data.get("settlement")
        return cls(
            event=str(data["event"]),
            invoice_id=str(data["invoice_id"]),
            status=InvoiceStatus(str(data["status"])),
            timestamp=str(data["timestamp"]),
            settlement=Settlement.from_dict(settlement) if settlement else None,
            raw=dict(data),
        )


def validate_merchant_nft(address: str) -> None:
    """Validate a TON address (Base64url, 48 chars).

    Raises:
        ValueError: when ``address`` does not match the TON address pattern.
    """
    if not isinstance(address, str) or not _TON_ADDRESS_RE.match(address):
        raise ValueError(f"Invalid merchant NFT address: {address!r}")


def validate_amount(amount_tbc: str) -> None:
    """Validate a TBC nanocoin amount encoded as a decimal string.

    Raises:
        ValueError: when ``amount_tbc`` is not a positive integer string, is
            zero, or exceeds the on-chain maximum of ``2**120 - 1``.
    """
    if not isinstance(amount_tbc, str) or not _AMOUNT_RE.match(amount_tbc):
        raise ValueError(
            f"Invalid amount_tbc: {amount_tbc!r} — expected a decimal string of nanocoins"
        )
    if int(amount_tbc) > _TBC_MAX_AMOUNT:
        raise ValueError(f"amount_tbc exceeds maximum of 2**120 - 1: {amount_tbc}")


def validate_metadata(metadata: InvoiceMetadata) -> None:
    """Validate invoice metadata (max 10 keys, alphanumeric keys, scalar values).

    Raises:
        ValueError: when keys, values or size exceed protocol limits.
    """
    if len(metadata) > _MAX_METADATA_FIELDS:
        raise ValueError(
            f"Metadata has {len(metadata)} fields, exceeds maximum of {_MAX_METADATA_FIELDS}"
        )
    for key, value in metadata.items():
        if not isinstance(key, str) or not _METADATA_KEY_RE.match(key):
            raise ValueError(f"Invalid metadata key: {key!r} (must match [a-zA-Z0-9_]+)")
        if not isinstance(value, (str, int, float, bool)):
            raise ValueError(f"Invalid metadata value type for {key!r}: {type(value).__name__}")
        if isinstance(value, str) and len(value) > _MAX_METADATA_VALUE_LENGTH:
            raise ValueError(
                f"Metadata value for {key!r} exceeds {_MAX_METADATA_VALUE_LENGTH} characters"
            )
