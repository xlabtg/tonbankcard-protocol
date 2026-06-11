from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from typing import Any

import pytest

from tonbankcard_merchant import (
    canonical_invoice_id_payload,
    canonical_json,
    canonicalize_ton_address,
    create_payload_hash,
    generate_invoice_id,
)

from .test_models import VALID_NFT_STANDARD_BASE64


def load_sdk_m5_fixture() -> dict[str, Any]:
    fixture_path = Path(__file__).parents[2] / "tests/fixtures/sdk-m5-canonical-hashes.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


def test_canonicalize_ton_address_matches_sdk_m5_fixture() -> None:
    fixture = load_sdk_m5_fixture()
    expected = fixture["invoice"]["merchant_nft_raw"]

    for address in [
        fixture["invoice"]["merchant_nft_friendly"],
        VALID_NFT_STANDARD_BASE64,
        fixture["invoice"]["merchant_nft_raw"],
        fixture["invoice"]["merchant_nft_raw"].upper(),
    ]:
        assert canonicalize_ton_address(address) == expected


def test_generate_invoice_id_matches_sdk_m5_fixture() -> None:
    fixture = load_sdk_m5_fixture()
    invoice = fixture["invoice"]

    assert (
        canonical_invoice_id_payload(
            merchant_nft=invoice["merchant_nft_friendly"],
            amount_tbc=invoice["amount_tbc"],
            order_id=invoice["order_id"],
            timestamp=invoice["timestamp"],
        )
        == invoice["canonical"]
    )
    assert (
        generate_invoice_id(
            merchant_nft=invoice["merchant_nft_friendly"],
            amount_tbc=invoice["amount_tbc"],
            order_id=invoice["order_id"],
            timestamp=invoice["timestamp"],
        )
        == invoice["invoice_id"]
    )
    assert (
        generate_invoice_id(
            merchant_nft=invoice["merchant_nft_raw"],
            amount_tbc=invoice["amount_tbc"],
            order_id=invoice["order_id"],
            timestamp=invoice["timestamp"],
        )
        == invoice["invoice_id"]
    )


def test_generate_invoice_id_handles_empty_order_id_and_max_int64_timestamp() -> None:
    fixture = load_sdk_m5_fixture()
    invoice = fixture["invoice"]

    canonical = canonical_invoice_id_payload(
        merchant_nft=invoice["merchant_nft_friendly"],
        amount_tbc=invoice["amount_tbc"],
        order_id="",
        timestamp=9223372036854775807,
    )

    assert (
        canonical
        == f'{{"amount_tbc":"{invoice["amount_tbc"]}","merchant_nft":"{invoice["merchant_nft_raw"]}","order_id":"","timestamp":"9223372036854775807"}}'
    )
    assert (
        len(
            generate_invoice_id(
                merchant_nft=invoice["merchant_nft_friendly"],
                amount_tbc=invoice["amount_tbc"],
                order_id="",
                timestamp=9223372036854775807,
            )
        )
        == 64
    )


def test_generate_invoice_id_rejects_invalid_merchant_nft_address() -> None:
    fixture = load_sdk_m5_fixture()
    invoice = fixture["invoice"]

    with pytest.raises(ValueError, match="Invalid TON address"):
        generate_invoice_id(
            merchant_nft="not-a-ton-address",
            amount_tbc=invoice["amount_tbc"],
            order_id="",
            timestamp=invoice["timestamp"],
        )


def test_create_payload_hash_matches_sdk_m5_fixture() -> None:
    fixture = load_sdk_m5_fixture()
    payload_fixture = fixture["payload"]

    for payload in [payload_fixture["value"], payload_fixture["value_reordered"]]:
        assert canonical_json(payload) == payload_fixture["canonical"]
        assert f"{create_payload_hash(payload):064x}" == payload_fixture["hash_hex"]


def test_create_payload_hash_supports_null_values() -> None:
    payload = {"memo": None, "nested": {"value": None}}

    assert canonical_json(payload) == '{"memo":null,"nested":{"value":null}}'
    assert create_payload_hash(payload) > 0


def load_pc06_fixture() -> dict[str, Any]:
    fixture_path = Path(__file__).parents[2] / "tests/fixtures/pc-06-canonical-conformance.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


# These vectors are shared byte-for-byte with the TypeScript and Go SDK test
# suites. Identical logical inputs must produce identical canonical bytes and
# SHA-256 digests in every SDK, including the U+2028/U+2029 separators and the
# numeric policy.
_PC06 = load_pc06_fixture()


def _sha256_hex(canonical: str) -> str:
    return sha256(canonical.encode("utf-8")).hexdigest()


@pytest.mark.parametrize("vector", _PC06["string_values"], ids=lambda v: v["name"])
def test_pc06_string_vectors(vector: dict[str, Any]) -> None:
    assert canonical_json(vector["input"]) == vector["canonical"]
    assert _sha256_hex(vector["canonical"]) == vector["sha256"]


@pytest.mark.parametrize("vector", _PC06["payloads"], ids=lambda v: v["name"])
def test_pc06_payload_vectors(vector: dict[str, Any]) -> None:
    assert canonical_json(vector["input"]) == vector["canonical"]
    assert _sha256_hex(vector["canonical"]) == vector["sha256"]
    assert f"{create_payload_hash(vector['input']):064x}" == vector["sha256"]
    if "input_reordered" in vector:
        assert canonical_json(vector["input_reordered"]) == vector["canonical"]
        assert f"{create_payload_hash(vector['input_reordered']):064x}" == vector["sha256"]


@pytest.mark.parametrize("vector", _PC06["safe_integers"], ids=lambda v: v["name"])
def test_pc06_safe_integer_vectors(vector: dict[str, Any]) -> None:
    assert canonical_json(int(vector["decimal"])) == vector["canonical"]
    assert _sha256_hex(vector["canonical"]) == vector["sha256"]


@pytest.mark.parametrize("vector", _PC06["rejected_floats"], ids=lambda v: v["name"])
def test_pc06_rejects_floats(vector: dict[str, Any]) -> None:
    with pytest.raises(TypeError):
        canonical_json(float(vector["decimal"]))


@pytest.mark.parametrize("vector", _PC06["rejected_unsafe_integers"], ids=lambda v: v["name"])
def test_pc06_rejects_unsafe_integers(vector: dict[str, Any]) -> None:
    with pytest.raises(TypeError):
        canonical_json(int(vector["decimal"]))
