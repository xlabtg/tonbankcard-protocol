"""Webhook signature verification.

Webhooks delivered to merchants are signed with a structured, timestamped
header that matches the server implementation in
``api/src/utils/webhookSignature.ts`` and the TypeScript/Go SDKs:

    X-Tonbankcard-Signature: t=<unix-timestamp>,v1=<hex-hmac-sha256>

    v1 = HMAC-SHA256(secret, f"{timestamp}.{raw_body}")

The timestamp is part of the signed preimage, so a captured signature cannot
be replayed once it falls outside the configurable freshness window.
Comparisons use :func:`hmac.compare_digest` to defeat timing attacks.

Example::

    from tonbankcard_merchant import verify_webhook

    payload = await request.body()  # raw bytes, NOT json.loads()
    signature = request.headers["X-Tonbankcard-Signature"]
    parsed = verify_webhook(secret=WEBHOOK_SECRET, payload=payload, signature=signature)
    fulfil_order(parsed.invoice_id, parsed.settlement)
"""

from __future__ import annotations

import hmac
import json
import re
import time
from hashlib import sha256
from typing import Optional, Union

from .errors import SignatureVerificationError
from .models import WebhookPayload

DEFAULT_SIGNATURE_HEADER = "X-Tonbankcard-Signature"

#: Signature scheme identifier emitted by the server (``v1=<hex>``).
SIGNATURE_VERSION = "v1"

#: Default freshness window: reject signatures older than 5 minutes.
DEFAULT_TOLERANCE_SECONDS = 300

_VERSION_KEY_RE = re.compile(r"^v\d+$")
_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")


def compute_signature(
    secret: Union[str, bytes],
    timestamp: Union[str, int],
    payload: Union[str, bytes],
) -> str:
    """Compute the HMAC-SHA256 signature for a payload.

    The digest is taken over ``f"{timestamp}.{payload}"`` — the same preimage
    the merchant API uses when signing outbound webhooks. Returns a lowercase
    hex digest.
    """
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
    payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload
    mac = hmac.new(secret_bytes, digestmod=sha256)
    mac.update(f"{timestamp}.".encode())
    mac.update(payload_bytes)
    return mac.hexdigest()


def _parse_signature_header(value: str) -> Optional[tuple[int, dict[str, str]]]:
    """Parse a ``t=<ts>,vN=<hex>`` header into its timestamp and signatures.

    Unknown keys are ignored for forward compatibility. Returns ``None`` if the
    header is malformed.
    """
    timestamp: Optional[int] = None
    versioned: dict[str, str] = {}

    for part in value.split(","):
        key, sep, val = part.partition("=")
        if not sep:
            return None
        key = key.strip()
        val = val.strip()
        if key == "t":
            if not val.isdigit():
                return None
            parsed = int(val)
            if parsed <= 0:
                return None
            timestamp = parsed
        elif _VERSION_KEY_RE.match(key):
            versioned[key] = val
        # Ignore unknown keys.

    if timestamp is None or not versioned:
        return None
    return timestamp, versioned


def verify_webhook(
    secret: Union[str, bytes],
    payload: Union[str, bytes],
    signature: str,
    *,
    tolerance: int = DEFAULT_TOLERANCE_SECONDS,
    now: Optional[float] = None,
) -> WebhookPayload:
    """Verify and parse a webhook delivery.

    Args:
        secret: HMAC shared secret (issued via the merchant dashboard).
        payload: Raw request body — pass the bytes received from the HTTP
            framework, **not** a re-serialised JSON object. Re-serialisation
            would re-order keys and break verification.
        signature: Value of the ``X-Tonbankcard-Signature`` header, in the
            form ``t=<unix-timestamp>,v1=<hex>``.
        tolerance: Freshness window in seconds (default 300). Deliveries whose
            timestamp is outside ``±tolerance`` of *now* are rejected — this is
            the replay-protection window.
        now: Override the current Unix timestamp (seconds). Injectable for
            tests; defaults to :func:`time.time`.

    Returns:
        Parsed :class:`tonbankcard_merchant.WebhookPayload`.

    Raises:
        SignatureVerificationError: If the signature header is missing or
            malformed, the timestamp is outside the tolerance window, the
            signature does not match (constant-time compare), or the payload is
            not a valid JSON object.
    """
    if not signature:
        raise SignatureVerificationError("Missing webhook signature")

    parsed = _parse_signature_header(signature.strip())
    if parsed is None:
        raise SignatureVerificationError("Malformed webhook signature header")
    timestamp, versioned = parsed

    current = time.time() if now is None else now
    if abs(current - timestamp) > tolerance:
        raise SignatureVerificationError("Webhook timestamp outside tolerance window")

    provided = versioned.get(SIGNATURE_VERSION)
    if provided is None:
        raise SignatureVerificationError("Unsupported webhook signature version")
    if not provided or not _HEX_RE.match(provided):
        raise SignatureVerificationError("Webhook signature is not a hex digest")

    expected = compute_signature(secret, timestamp, payload)
    if not hmac.compare_digest(expected.lower(), provided.lower()):
        raise SignatureVerificationError("Webhook signature mismatch")

    payload_str = payload.decode("utf-8") if isinstance(payload, bytes) else payload
    try:
        body = json.loads(payload_str)
    except json.JSONDecodeError as exc:
        raise SignatureVerificationError(f"Webhook body is not valid JSON: {exc}") from exc

    if not isinstance(body, dict):
        raise SignatureVerificationError("Webhook body must be a JSON object")

    try:
        return WebhookPayload.from_dict(body)
    except (KeyError, ValueError) as exc:
        raise SignatureVerificationError(f"Invalid webhook payload: {exc}") from exc
