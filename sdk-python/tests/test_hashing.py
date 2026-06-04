from __future__ import annotations

import json
from pathlib import Path
from typing import Any

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


def test_create_payload_hash_matches_sdk_m5_fixture() -> None:
    fixture = load_sdk_m5_fixture()
    payload_fixture = fixture["payload"]

    for payload in [payload_fixture["value"], payload_fixture["value_reordered"]]:
        assert canonical_json(payload) == payload_fixture["canonical"]
        assert f"{create_payload_hash(payload):064x}" == payload_fixture["hash_hex"]
