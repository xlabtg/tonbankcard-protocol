"""Canonical hash helpers shared by TONBANKCARD SDK implementations."""

from __future__ import annotations

import json
from collections.abc import Mapping
from hashlib import sha256
from typing import Any, Optional

from .models import canonicalize_ton_address, validate_amount

# Largest integer magnitude that survives an IEEE-754 double round-trip
# (2**53 - 1). Integers outside [-_MAX_SAFE_INTEGER, _MAX_SAFE_INTEGER] cannot
# be represented identically by the JavaScript SDK, so canonical JSON rejects
# them and asks callers for a decimal string instead.
_MAX_SAFE_INTEGER = 2**53 - 1


def canonical_json(value: Any) -> str:
    """Encode JSON-compatible values with sorted keys and no extra whitespace."""
    encoded = json.dumps(
        _normalize_canonical_json(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    # json.dumps emits U+2028/U+2029 as raw UTF-8, but Go's encoding/json escapes
    # them. Escape them here so canonical bytes match across SDKs (PC-06). The
    # replacement is safe: these code points never appear inside an ASCII escape
    # sequence produced by json.dumps.
    return encoded.replace(chr(0x2028), "\\u2028").replace(chr(0x2029), "\\u2029")


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
        if not (-_MAX_SAFE_INTEGER <= value <= _MAX_SAFE_INTEGER):
            raise TypeError(
                "canonical JSON forbids integers outside the 53-bit safe range; "
                "use a decimal string"
            )
        return value
    if isinstance(value, float):
        raise TypeError(
            "canonical JSON forbids floating-point numbers; "
            "use integer minor units or a decimal string"
        )
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
