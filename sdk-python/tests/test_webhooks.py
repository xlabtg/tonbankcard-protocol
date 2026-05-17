from __future__ import annotations

import hmac
import json
from hashlib import sha256

import pytest

from tonbankcard_merchant import (
    SignatureVerificationError,
    WebhookPayload,
    compute_signature,
    verify_webhook,
)

SECRET = "whsec_supersecret_value"


def _signed_body(body: dict[str, object], secret: str = SECRET) -> tuple[bytes, str]:
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), raw, sha256).hexdigest()
    return raw, sig


def _payload() -> dict[str, object]:
    return {
        "event": "invoice.settled",
        "invoice_id": "inv_xyz",
        "status": "settled",
        "timestamp": "2025-12-27T10:05:00Z",
    }


def test_compute_signature_is_deterministic() -> None:
    payload = b'{"hello":"world"}'
    assert compute_signature(SECRET, payload) == compute_signature(SECRET, payload)


def test_verify_webhook_happy_path() -> None:
    body, sig = _signed_body(_payload())
    parsed = verify_webhook(SECRET, body, sig)
    assert isinstance(parsed, WebhookPayload)
    assert parsed.invoice_id == "inv_xyz"


def test_verify_webhook_accepts_sha256_prefix() -> None:
    body, sig = _signed_body(_payload())
    parsed = verify_webhook(SECRET, body, f"sha256={sig}")
    assert parsed.event == "invoice.settled"


def test_verify_webhook_rejects_wrong_signature() -> None:
    body, _ = _signed_body(_payload())
    with pytest.raises(SignatureVerificationError, match="signature mismatch"):
        verify_webhook(SECRET, body, "0" * 64)


def test_verify_webhook_rejects_wrong_secret() -> None:
    body, sig = _signed_body(_payload(), secret="other-secret")
    with pytest.raises(SignatureVerificationError):
        verify_webhook(SECRET, body, sig)


def test_verify_webhook_rejects_tampered_body() -> None:
    body, sig = _signed_body(_payload())
    tampered = body.replace(b"settled", b"pending")
    with pytest.raises(SignatureVerificationError):
        verify_webhook(SECRET, tampered, sig)


def test_verify_webhook_rejects_empty_signature() -> None:
    body, _ = _signed_body(_payload())
    with pytest.raises(SignatureVerificationError, match="Missing"):
        verify_webhook(SECRET, body, "")


def test_verify_webhook_rejects_non_hex_signature() -> None:
    body, _ = _signed_body(_payload())
    with pytest.raises(SignatureVerificationError, match="hex"):
        verify_webhook(SECRET, body, "not-a-hex-digest!!!")


def test_verify_webhook_rejects_invalid_json() -> None:
    raw = b"not json at all"
    sig = hmac.new(SECRET.encode(), raw, sha256).hexdigest()
    with pytest.raises(SignatureVerificationError, match="JSON"):
        verify_webhook(SECRET, raw, sig)


def test_verify_webhook_rejects_non_object_json() -> None:
    raw = b"[1,2,3]"
    sig = hmac.new(SECRET.encode(), raw, sha256).hexdigest()
    with pytest.raises(SignatureVerificationError, match="JSON object"):
        verify_webhook(SECRET, raw, sig)


def test_verify_webhook_uses_constant_time_comparison(monkeypatch: pytest.MonkeyPatch) -> None:
    """``hmac.compare_digest`` must be the active comparator.

    We patch it to a sentinel and ensure that path is exercised, instead of
    e.g. ``==`` which would leak timing information.
    """
    body, sig = _signed_body(_payload())
    calls: list[tuple[str, str]] = []

    real_compare = hmac.compare_digest

    def spy(a: str, b: str) -> bool:
        calls.append((a, b))
        return real_compare(a, b)

    monkeypatch.setattr("tonbankcard_merchant.webhooks.hmac.compare_digest", spy)
    verify_webhook(SECRET, body, sig)
    assert calls, "hmac.compare_digest must be called by verify_webhook"


def test_verify_webhook_accepts_string_payload() -> None:
    body, sig = _signed_body(_payload())
    parsed = verify_webhook(SECRET, body.decode("utf-8"), sig)
    assert parsed.invoice_id == "inv_xyz"
