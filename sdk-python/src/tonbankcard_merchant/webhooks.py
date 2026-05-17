"""Webhook signature verification.

Webhooks delivered to merchants are signed with HMAC-SHA256 over the raw
request body using a shared secret. The signature is transmitted as a
hex-encoded digest, optionally with a ``sha256=`` prefix.

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
from hashlib import sha256
from typing import Union

from .errors import SignatureVerificationError
from .models import WebhookPayload

DEFAULT_SIGNATURE_HEADER = "X-Tonbankcard-Signature"
_SIGNATURE_PREFIX = "sha256="


def compute_signature(secret: Union[str, bytes], payload: Union[str, bytes]) -> str:
    """Compute the canonical HMAC-SHA256 signature for a payload.

    Returns a lowercase hex digest. The merchant API uses the same algorithm
    when signing outbound webhooks.
    """
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
    payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload
    return hmac.new(secret_bytes, payload_bytes, sha256).hexdigest()


def verify_webhook(
    secret: Union[str, bytes],
    payload: Union[str, bytes],
    signature: str,
) -> WebhookPayload:
    """Verify and parse a webhook delivery.

    Args:
        secret: HMAC shared secret (issued via the merchant dashboard).
        payload: Raw request body — pass the bytes received from the HTTP
            framework, **not** a re-serialised JSON object. Re-serialisation
            would re-order keys and break verification.
        signature: Value of the ``X-Tonbankcard-Signature`` header.
            ``sha256=<hex>`` prefix is accepted and stripped.

    Returns:
        Parsed :class:`tonbankcard_merchant.WebhookPayload`.

    Raises:
        SignatureVerificationError: If the signature is malformed, does not
            match the computed signature (constant-time compare), or if the
            payload is not valid JSON.
    """
    if not signature:
        raise SignatureVerificationError("Missing webhook signature")

    received = signature.strip()
    if received.startswith(_SIGNATURE_PREFIX):
        received = received[len(_SIGNATURE_PREFIX) :]

    if not received or any(c not in "0123456789abcdefABCDEF" for c in received):
        raise SignatureVerificationError("Webhook signature is not a hex digest")

    expected = compute_signature(secret, payload)
    if not hmac.compare_digest(expected.lower(), received.lower()):
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
