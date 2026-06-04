package tonbankcard

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type sdkM5Fixture struct {
	Invoice struct {
		MerchantNFTFriendly string `json:"merchant_nft_friendly"`
		MerchantNFTRaw      string `json:"merchant_nft_raw"`
		AmountTBC           string `json:"amount_tbc"`
		OrderID             string `json:"order_id"`
		Timestamp           int64  `json:"timestamp"`
		Canonical           string `json:"canonical"`
		InvoiceID           string `json:"invoice_id"`
	} `json:"invoice"`
	Payload struct {
		Value          map[string]any `json:"value"`
		ValueReordered map[string]any `json:"value_reordered"`
		Canonical      string         `json:"canonical"`
		HashHex        string         `json:"hash_hex"`
	} `json:"payload"`
}

func loadSDKM5Fixture(t *testing.T) sdkM5Fixture {
	t.Helper()
	raw, err := os.ReadFile("../tests/fixtures/sdk-m5-canonical-hashes.json")
	if err != nil {
		t.Fatalf("read SDK-M5 fixture: %v", err)
	}
	var fixture sdkM5Fixture
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("parse SDK-M5 fixture: %v", err)
	}
	return fixture
}

func TestCanonicalizeTonAddress(t *testing.T) {
	t.Parallel()
	fixture := loadSDKM5Fixture(t)

	for _, address := range []string{
		fixture.Invoice.MerchantNFTFriendly,
		validNFTStandardBase64,
		fixture.Invoice.MerchantNFTRaw,
		strings.ToUpper(fixture.Invoice.MerchantNFTRaw),
	} {
		canonical, err := CanonicalizeTonAddress(address)
		if err != nil {
			t.Fatalf("canonicalize %q: %v", address, err)
		}
		if canonical != fixture.Invoice.MerchantNFTRaw {
			t.Fatalf("canonical address mismatch for %q: got %q want %q", address, canonical, fixture.Invoice.MerchantNFTRaw)
		}
	}
}

func TestSDKM5CanonicalInvoiceIDFixture(t *testing.T) {
	t.Parallel()
	fixture := loadSDKM5Fixture(t)
	params := InvoiceIDParams{
		MerchantNFT: fixture.Invoice.MerchantNFTFriendly,
		AmountTBC:   fixture.Invoice.AmountTBC,
		OrderID:     fixture.Invoice.OrderID,
		Timestamp:   fixture.Invoice.Timestamp,
	}

	canonical, err := CanonicalInvoiceIDPayload(params)
	if err != nil {
		t.Fatalf("canonical invoice payload: %v", err)
	}
	if canonical != fixture.Invoice.Canonical {
		t.Fatalf("canonical invoice payload mismatch: got %q want %q", canonical, fixture.Invoice.Canonical)
	}

	invoiceID, err := GenerateInvoiceID(params)
	if err != nil {
		t.Fatalf("generate invoice id: %v", err)
	}
	if invoiceID != fixture.Invoice.InvoiceID {
		t.Fatalf("invoice id mismatch: got %q want %q", invoiceID, fixture.Invoice.InvoiceID)
	}

	params.MerchantNFT = fixture.Invoice.MerchantNFTRaw
	rawInvoiceID, err := GenerateInvoiceID(params)
	if err != nil {
		t.Fatalf("generate raw invoice id: %v", err)
	}
	if rawInvoiceID != fixture.Invoice.InvoiceID {
		t.Fatalf("raw invoice id mismatch: got %q want %q", rawInvoiceID, fixture.Invoice.InvoiceID)
	}
}

func TestSDKM5CanonicalPayloadHashFixture(t *testing.T) {
	t.Parallel()
	fixture := loadSDKM5Fixture(t)

	for name, payload := range map[string]map[string]any{
		"value":           fixture.Payload.Value,
		"value_reordered": fixture.Payload.ValueReordered,
	} {
		canonical, err := CanonicalJSON(payload)
		if err != nil {
			t.Fatalf("%s canonical JSON: %v", name, err)
		}
		if canonical != fixture.Payload.Canonical {
			t.Fatalf("%s canonical JSON mismatch: got %q want %q", name, canonical, fixture.Payload.Canonical)
		}

		hash, err := CreatePayloadHash(payload)
		if err != nil {
			t.Fatalf("%s payload hash: %v", name, err)
		}
		hashHex := strings.Repeat("0", 64-len(hash.Text(16))) + hash.Text(16)
		if hashHex != fixture.Payload.HashHex {
			t.Fatalf("%s payload hash mismatch: got %q want %q", name, hashHex, fixture.Payload.HashHex)
		}
	}
}
