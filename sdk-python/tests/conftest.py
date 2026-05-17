from __future__ import annotations

import pytest

VALID_NFT = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le"


@pytest.fixture
def valid_nft() -> str:
    return VALID_NFT


@pytest.fixture
def base_url() -> str:
    return "https://api-testnet.tonbankcard.io/v1"


@pytest.fixture
def api_key() -> str:
    return "tbck_test_0123456789abcdef0123456789abcdef"
