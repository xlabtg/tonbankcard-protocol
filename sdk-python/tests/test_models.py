from __future__ import annotations

import pytest

from tonbankcard_merchant.models import (
    CreateInvoiceRequest,
    Invoice,
    InvoiceStatus,
    Settlement,
    WebhookPayload,
    validate_amount,
    validate_merchant_nft,
    validate_metadata,
)

VALID_NFT = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le"


class TestValidators:
    def test_valid_merchant_nft(self) -> None:
        validate_merchant_nft(VALID_NFT)

    @pytest.mark.parametrize(
        "address",
        [
            "",
            "not-an-address",
            "EQ",
            "EQA" + "x" * 50,
            "AQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",  # wrong prefix
        ],
    )
    def test_invalid_merchant_nft(self, address: str) -> None:
        with pytest.raises(ValueError):
            validate_merchant_nft(address)

    def test_valid_amount(self) -> None:
        validate_amount("1")
        validate_amount("1000000000")
        validate_amount(str((1 << 120) - 1))

    @pytest.mark.parametrize(
        "amount",
        [
            "",
            "0",
            "-1",
            "1.5",
            "abc",
            "01000",  # leading zero
            str(1 << 120),
        ],
    )
    def test_invalid_amount(self, amount: str) -> None:
        with pytest.raises(ValueError):
            validate_amount(amount)

    def test_metadata_size_limit(self) -> None:
        too_many = {f"key{i}": "v" for i in range(11)}
        with pytest.raises(ValueError):
            validate_metadata(too_many)

    def test_metadata_invalid_key(self) -> None:
        with pytest.raises(ValueError):
            validate_metadata({"bad key!": "v"})

    def test_metadata_long_value_rejected(self) -> None:
        with pytest.raises(ValueError):
            validate_metadata({"k": "x" * 257})

    def test_metadata_supports_scalars(self) -> None:
        validate_metadata({"a": "str", "b": 1, "c": 1.2, "d": True})

    def test_metadata_rejects_complex_value(self) -> None:
        with pytest.raises(ValueError):
            validate_metadata({"a": [1, 2, 3]})  # type: ignore[dict-item]


class TestCreateInvoiceRequest:
    def test_to_dict_round_trip(self) -> None:
        req = CreateInvoiceRequest(
            merchant_nft=VALID_NFT,
            amount_tbc="1000000000",
            metadata={"order_id": "ORDER-1"},
            expires_at="2025-12-31T23:59:59Z",
        )
        assert req.to_dict() == {
            "merchant_nft": VALID_NFT,
            "amount_tbc": "1000000000",
            "currency": "TBC",
            "metadata": {"order_id": "ORDER-1"},
            "expires_at": "2025-12-31T23:59:59Z",
        }

    def test_rejects_wrong_currency(self) -> None:
        with pytest.raises(ValueError):
            CreateInvoiceRequest(merchant_nft=VALID_NFT, amount_tbc="1", currency="USD")


class TestModelParsing:
    def test_invoice_from_dict_settled(self) -> None:
        invoice = Invoice.from_dict(
            {
                "invoice_id": "inv_abc",
                "merchant_nft": VALID_NFT,
                "amount_tbc": "1000000000",
                "currency": "TBC",
                "status": "settled",
                "created_at": "2025-12-27T10:00:00Z",
                "expires_at": "2025-12-31T23:59:59Z",
                "payment_url": "https://wallet.tonbankcard.io/pay/inv_abc",
                "metadata": {"order_id": "ORDER-1"},
                "settlement": {
                    "payer_nft": VALID_NFT,
                    "merchant_nft": VALID_NFT,
                    "amount_tbc": "1000000000",
                    "block_number": 42,
                    "tx_hash": "0xabc",
                    "timestamp": "2025-12-27T10:05:00Z",
                    "payload_hash": "0x7f",
                    "on_chain_verified": True,
                    "verification_url": "https://tonscan.org/tx/0xabc",
                },
            }
        )
        assert invoice.status is InvoiceStatus.SETTLED
        assert invoice.settlement is not None
        assert invoice.settlement.block_number == 42
        assert invoice.settlement.on_chain_verified is True

    def test_invoice_from_dict_pending(self) -> None:
        invoice = Invoice.from_dict(
            {
                "invoice_id": "inv_pending",
                "merchant_nft": VALID_NFT,
                "amount_tbc": "1",
                "currency": "TBC",
                "status": "pending",
                "created_at": "2025-12-27T10:00:00Z",
                "expires_at": "2025-12-28T10:00:00Z",
                "payment_url": "https://wallet.tonbankcard.io/pay/inv_pending",
                "settlement": None,
            }
        )
        assert invoice.settlement is None
        assert invoice.status is InvoiceStatus.PENDING

    def test_webhook_payload_round_trip(self) -> None:
        data = {
            "event": "invoice.settled",
            "invoice_id": "inv_xyz",
            "status": "settled",
            "timestamp": "2025-12-27T10:05:00Z",
        }
        payload = WebhookPayload.from_dict(data)
        assert payload.event == "invoice.settled"
        assert payload.status is InvoiceStatus.SETTLED
        assert payload.settlement is None
        assert payload.raw == data

    def test_settlement_optional_fields(self) -> None:
        settlement = Settlement.from_dict(
            {
                "payer_nft": VALID_NFT,
                "merchant_nft": VALID_NFT,
                "amount_tbc": "1",
                "block_number": 1,
                "tx_hash": "0xa",
                "timestamp": "2025-12-27T10:05:00Z",
                "payload_hash": "0xb",
            }
        )
        assert settlement.on_chain_verified is False
        assert settlement.verification_url is None
