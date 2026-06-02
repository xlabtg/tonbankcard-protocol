from __future__ import annotations

import hmac
import json

import pytest

from tonbankcard_merchant import (
    SignatureVerificationError,
    WebhookPayload,
    compute_signature,
    verify_webhook,
)

SECRET = "whsec_supersecret_value"
NOW = 1_700_000_000


def _sign(body: dict[str, object], secret: str = SECRET, ts: int = NOW) -> tuple[bytes, str]:
    """Build a raw body and its ``t=<ts>,v1=<hex>`` signature header."""
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    digest = compute_signature(secret, ts, raw)
    return raw, f"t={ts},v1={digest}"


def _payload() -> dict[str, object]:
    return {
        "event": "invoice.settled",
        "invoice_id": "inv_xyz",
        "status": "settled",
        "timestamp": "2025-12-27T10:05:00Z",
    }


def test_compute_signature_matches_server_scheme() -> None:
    # Cross-language fixture locking the preimage to ``f"{ts}.{body}"`` exactly
    # as the server helper and the TypeScript/Go SDKs.
    assert (
        compute_signature("secret", 1700000000, b"{}")
        == "b8569b78799ff9e3cbff0fc2d63a33a2b57f3282abd07c37ae5e8e7d79a5f163"
    )


def test_compute_signature_is_deterministic() -> None:
    assert compute_signature(SECRET, NOW, b'{"hello":"world"}') == compute_signature(
        SECRET, NOW, b'{"hello":"world"}'
    )


def test_verify_webhook_happy_path() -> None:
    body, sig = _sign(_payload())
    parsed = verify_webhook(SECRET, body, sig, now=NOW)
    assert isinstance(parsed, WebhookPayload)
    assert parsed.invoice_id == "inv_xyz"


def test_verify_webhook_within_tolerance() -> None:
    body, sig = _sign(_payload())
    # 4 minutes later — inside the default 5-minute window.
    parsed = verify_webhook(SECRET, body, sig, now=NOW + 240)
    assert parsed.event == "invoice.settled"


def test_verify_webhook_rejects_stale_timestamp() -> None:
    body, sig = _sign(_payload())
    # 6 minutes later — outside the default 5-minute window (replay protection).
    with pytest.raises(SignatureVerificationError, match="tolerance"):
        verify_webhook(SECRET, body, sig, now=NOW + 360)


def test_verify_webhook_custom_tolerance() -> None:
    body, sig = _sign(_payload())
    parsed = verify_webhook(SECRET, body, sig, now=NOW + 600, tolerance=900)
    assert parsed.invoice_id == "inv_xyz"


def test_verify_webhook_rejects_wrong_signature() -> None:
    body, _ = _sign(_payload())
    with pytest.raises(SignatureVerificationError, match="mismatch"):
        verify_webhook(SECRET, body, f"t={NOW},v1={'0' * 64}", now=NOW)


def test_verify_webhook_rejects_wrong_secret() -> None:
    body, sig = _sign(_payload(), secret="other-secret")
    with pytest.raises(SignatureVerificationError):
        verify_webhook(SECRET, body, sig, now=NOW)


def test_verify_webhook_rejects_tampered_body() -> None:
    body, sig = _sign(_payload())
    tampered = body.replace(b"settled", b"pending")
    with pytest.raises(SignatureVerificationError):
        verify_webhook(SECRET, tampered, sig, now=NOW)


def test_verify_webhook_rejects_empty_signature() -> None:
    body, _ = _sign(_payload())
    with pytest.raises(SignatureVerificationError, match="Missing"):
        verify_webhook(SECRET, body, "", now=NOW)


@pytest.mark.parametrize(
    "header",
    [
        "not-a-hex-digest",  # no key=value structure
        f"v1={'a' * 64}",  # missing timestamp
        f"t={NOW}",  # missing signature
        f"t=abc,v1={'a' * 64}",  # non-numeric timestamp
    ],
)
def test_verify_webhook_rejects_malformed_header(header: str) -> None:
    body, _ = _sign(_payload())
    with pytest.raises(SignatureVerificationError, match=r"[Mm]alformed"):
        verify_webhook(SECRET, body, header, now=NOW)


def test_verify_webhook_rejects_non_hex_signature() -> None:
    body, _ = _sign(_payload())
    with pytest.raises(SignatureVerificationError, match="hex"):
        verify_webhook(SECRET, body, f"t={NOW},v1=not-a-hex-digest!!!", now=NOW)


def test_verify_webhook_rejects_unsupported_version() -> None:
    body, _ = _sign(_payload())
    digest = compute_signature(SECRET, NOW, body)
    with pytest.raises(SignatureVerificationError, match="version"):
        verify_webhook(SECRET, body, f"t={NOW},v2={digest}", now=NOW)


def test_verify_webhook_rejects_invalid_json() -> None:
    raw = b"not json at all"
    digest = compute_signature(SECRET, NOW, raw)
    with pytest.raises(SignatureVerificationError, match="JSON"):
        verify_webhook(SECRET, raw, f"t={NOW},v1={digest}", now=NOW)


def test_verify_webhook_rejects_non_object_json() -> None:
    raw = b"[1,2,3]"
    digest = compute_signature(SECRET, NOW, raw)
    with pytest.raises(SignatureVerificationError, match="JSON object"):
        verify_webhook(SECRET, raw, f"t={NOW},v1={digest}", now=NOW)


def test_verify_webhook_uses_constant_time_comparison(monkeypatch: pytest.MonkeyPatch) -> None:
    """``hmac.compare_digest`` must be the active comparator.

    We patch it to a sentinel and ensure that path is exercised, instead of
    e.g. ``==`` which would leak timing information.
    """
    body, sig = _sign(_payload())
    calls: list[tuple[str, str]] = []

    real_compare = hmac.compare_digest

    def spy(a: str, b: str) -> bool:
        calls.append((a, b))
        return real_compare(a, b)

    monkeypatch.setattr("tonbankcard_merchant.webhooks.hmac.compare_digest", spy)
    verify_webhook(SECRET, body, sig, now=NOW)
    assert calls, "hmac.compare_digest must be called by verify_webhook"


def test_verify_webhook_accepts_string_payload() -> None:
    body, sig = _sign(_payload())
    parsed = verify_webhook(SECRET, body.decode("utf-8"), sig, now=NOW)
    assert parsed.invoice_id == "inv_xyz"
