"""Canonical hash helpers shared by TONBANKCARD SDK implementations."""

from __future__ import annotations

import json
import math
from collections.abc import Mapping
from hashlib import sha256
from typing import Any, Optional

from .models import canonicalize_ton_address, validate_amount


def canonical_json(value: Any) -> str:
    """Encode JSON-compatible values with sorted keys and no extra whitespace."""
    return json.dumps(
        _normalize_canonical_json(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def canonical_invoice_id_payload(
    *,
    merchant_nft: str,
    amount_tbc: str,
    order_id: Optional[str] = None,
    timestamp: int,
) -> str:
    """Return the canonical JSON payload hashed by :func:`generate_invoice_id`."""
    validate_amount(amount_tbc)
    if isinstance(timestamp, bool) or not isinstance(timestamp, int):
        raise TypeError("timestamp must be an integer Unix timestamp")

    return canonical_json(
        {
            "amount_tbc": amount_tbc,
            "merchant_nft": canonicalize_ton_address(merchant_nft),
            "order_id": order_id or "",
            "timestamp": str(timestamp),
        }
    )


def generate_invoice_id(
    *,
    merchant_nft: str,
    amount_tbc: str,
    order_id: Optional[str] = None,
    timestamp: int,
) -> str:
    """Generate the SHA-256 hex invoice id from canonical invoice fields."""
    canonical = canonical_invoice_id_payload(
        merchant_nft=merchant_nft,
        amount_tbc=amount_tbc,
        order_id=order_id,
        timestamp=timestamp,
    )
    return sha256(canonical.encode("utf-8")).hexdigest()


def create_payload_hash(payload: Mapping[str, Any]) -> int:
    """Return the SHA-256 digest of a canonical JSON payload as an integer."""
    canonical = canonical_json(payload)
    return int.from_bytes(sha256(canonical.encode("utf-8")).digest(), "big")


def _normalize_canonical_json(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise TypeError("canonical JSON does not support non-finite numbers")
        return value
    if isinstance(value, (list, tuple)):
        return [_normalize_canonical_json(item) for item in value]
    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("canonical JSON object keys must be strings")
            normalized[key] = _normalize_canonical_json(item)
        return normalized
    raise TypeError(f"canonical JSON does not support {type(value).__name__} values")
