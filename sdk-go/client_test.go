package tonbankcard

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *Client) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	client, err := NewClient(Config{APIKey: "tbck_test_x", BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return srv, client
}

func TestNewClientRejectsEmptyAPIKey(t *testing.T) {
	t.Parallel()
	if _, err := NewClient(Config{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestCreateInvoiceHappyPath(t *testing.T) {
	t.Parallel()
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/invoice/create" || r.Method != http.MethodPost {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer tbck_test_x" {
			t.Errorf("missing/incorrect auth header: %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		_ = json.Unmarshal(body, &req)
		if req["amount_tbc"] != "1000000000" {
			t.Errorf("unexpected amount_tbc: %v", req["amount_tbc"])
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"invoice_id":   "inv_abc",
			"merchant_nft": validNFT,
			"amount_tbc":   "1000000000",
			"currency":     "TBC",
			"status":       "pending",
			"created_at":   "2026-05-17T10:00:00Z",
			"expires_at":   "2026-05-18T10:00:00Z",
			"payment_url":  "https://wallet.tonbankcard.io/pay/inv_abc",
		})
	})
	invoice, err := client.CreateInvoice(context.Background(), CreateInvoiceParams{
		MerchantNFT: validNFT,
		AmountTBC:   "1000000000",
	})
	if err != nil {
		t.Fatalf("CreateInvoice: %v", err)
	}
	if invoice.InvoiceID != "inv_abc" || invoice.Status != InvoiceStatusPending {
		t.Fatalf("unexpected invoice: %+v", invoice)
	}
}

func TestCreateInvoiceValidatesInputBeforeHTTP(t *testing.T) {
	t.Parallel()
	client, err := NewClient(Config{APIKey: "tbck_test_x"})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if _, err := client.CreateInvoice(context.Background(), CreateInvoiceParams{
		MerchantNFT: "bogus",
		AmountTBC:   "1",
	}); err == nil || !strings.Contains(err.Error(), "merchant NFT") {
		t.Fatalf("expected merchant NFT validation error, got %v", err)
	}
	if _, err := client.CreateInvoice(context.Background(), CreateInvoiceParams{
		MerchantNFT: validNFT,
		AmountTBC:   "0",
	}); err == nil || !strings.Contains(err.Error(), "amount_tbc") {
		t.Fatalf("expected amount validation error, got %v", err)
	}
}

func TestCreateInvoicePropagatesCallbackURL(t *testing.T) {
	t.Parallel()
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req struct {
			Metadata map[string]any `json:"metadata"`
		}
		_ = json.Unmarshal(body, &req)
		if req.Metadata["callback_url"] != "https://merchant.example.com/wh" {
			t.Errorf("callback_url not propagated, metadata=%+v", req.Metadata)
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"invoice_id":   "inv_cb",
			"merchant_nft": validNFT,
			"amount_tbc":   "1",
			"currency":     "TBC",
			"status":       "pending",
			"created_at":   "2026-05-17T10:00:00Z",
			"expires_at":   "2026-05-18T10:00:00Z",
			"payment_url":  "https://wallet.tonbankcard.io/pay/inv_cb",
		})
	})
	if _, err := client.CreateInvoice(context.Background(), CreateInvoiceParams{
		MerchantNFT: validNFT,
		AmountTBC:   "1",
		CallbackURL: "https://merchant.example.com/wh",
	}); err != nil {
		t.Fatalf("CreateInvoice: %v", err)
	}
}

func TestCreateInvoiceNormalizesTrimmedInputsInPayload(t *testing.T) {
	t.Parallel()
	metadata := map[string]any{"order_id": "ORDER-1"}
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		_ = json.Unmarshal(body, &req)
		if req["merchant_nft"] != validNFT {
			t.Errorf("merchant_nft was not normalized: %q", req["merchant_nft"])
		}
		if req["amount_tbc"] != "1000000000" {
			t.Errorf("amount_tbc was not normalized: %q", req["amount_tbc"])
		}
		if _, exists := metadata["callback_url"]; exists {
			t.Errorf("CreateInvoice mutated caller metadata: %+v", metadata)
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"invoice_id":   "inv_trimmed",
			"merchant_nft": validNFT,
			"amount_tbc":   "1000000000",
			"currency":     "TBC",
			"status":       "pending",
			"created_at":   "2026-05-17T10:00:00Z",
			"expires_at":   "2026-05-18T10:00:00Z",
			"payment_url":  "https://wallet.tonbankcard.io/pay/inv_trimmed",
		})
	})
	_, err := client.CreateInvoice(context.Background(), CreateInvoiceParams{
		MerchantNFT: " \n" + validNFT + "\t",
		AmountTBC:   " 1000000000 ",
		Metadata:    metadata,
		CallbackURL: "https://merchant.example.com/wh",
	})
	if err != nil {
		t.Fatalf("CreateInvoice: %v", err)
	}
}

func TestGetInvoiceStatusSettled(t *testing.T) {
	t.Parallel()
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/invoice/inv_abc/status" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"invoice_id": "inv_abc",
			"status":     "settled",
			"created_at": "2026-05-17T10:00:00Z",
			"expires_at": "2026-05-18T10:00:00Z",
			"settlement": map[string]any{
				"payer_nft":         validNFT,
				"merchant_nft":      validNFT,
				"amount_tbc":        "1",
				"block_number":      42,
				"tx_hash":           "0xabc",
				"timestamp":         "2026-05-17T10:05:00Z",
				"payload_hash":      "0x7f",
				"on_chain_verified": true,
			},
		})
	})
	status, err := client.GetInvoiceStatus(context.Background(), "inv_abc")
	if err != nil {
		t.Fatalf("GetInvoiceStatus: %v", err)
	}
	if status.Settlement == nil || status.Settlement.BlockNumber != 42 {
		t.Fatalf("unexpected settlement: %+v", status.Settlement)
	}
}

func TestErrorMapping(t *testing.T) {
	t.Parallel()
	tests := []struct {
		code        int
		body        string
		matchesErr  error
		wantCode    string
		wantMessage string
	}{
		{401, `{"error":{"code":"INVALID_API_KEY","message":"bad key"}}`, ErrAuthentication, "INVALID_API_KEY", "bad key"},
		{404, `{"error":{"code":"INVOICE_NOT_FOUND","message":"nope"}}`, ErrInvoiceNotFound, "INVOICE_NOT_FOUND", "nope"},
		{410, `{"error":{"code":"INVOICE_EXPIRED","message":"old"}}`, ErrInvoiceExpired, "INVOICE_EXPIRED", "old"},
		{503, `{"error":{"code":"INTERNAL_ERROR","message":"down"}}`, ErrServer, "INTERNAL_ERROR", "down"},
		{400, `{"error":{"code":"VALIDATION","message":"bad"}}`, ErrInvalidRequest, "VALIDATION", "bad"},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.wantCode, func(t *testing.T) {
			t.Parallel()
			_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.code)
				_, _ = w.Write([]byte(tc.body))
			})
			_, err := client.GetInvoice(context.Background(), "any")
			if err == nil {
				t.Fatalf("expected error")
			}
			if !errors.Is(err, tc.matchesErr) {
				t.Fatalf("expected to wrap %v, got %v", tc.matchesErr, err)
			}
			var apiErr *APIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("expected *APIError, got %T", err)
			}
			if apiErr.Code != tc.wantCode || apiErr.Message != tc.wantMessage {
				t.Fatalf("unexpected APIError fields: %+v", apiErr)
			}
		})
	}
}

func TestRateLimitParsesRetryAfter(t *testing.T) {
	t.Parallel()
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "12.5")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"code":"RATE_LIMITED","message":"slow down"}}`))
	})
	_, err := client.GetInvoice(context.Background(), "any")
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *APIError, got %v", err)
	}
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
	if apiErr.RetryAfter != 12.5 {
		t.Fatalf("expected RetryAfter=12.5, got %v", apiErr.RetryAfter)
	}
}

func TestInvoiceIDURLEncoded(t *testing.T) {
	t.Parallel()
	gotPath := ""
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"invoice_id":   "inv/weird",
			"merchant_nft": validNFT,
			"amount_tbc":   "1",
			"currency":     "TBC",
			"status":       "pending",
			"created_at":   "2026-05-17T10:00:00Z",
			"expires_at":   "2026-05-18T10:00:00Z",
			"payment_url":  "https://wallet.tonbankcard.io/pay/inv_weird",
		})
	})
	if _, err := client.GetInvoice(context.Background(), "inv/weird"); err != nil {
		t.Fatalf("GetInvoice: %v", err)
	}
	if !strings.Contains(gotPath, "%2F") {
		t.Fatalf("expected slash to be URL-encoded, got %s", gotPath)
	}
}
