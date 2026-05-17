package tonbankcard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// DefaultBaseURL is the production endpoint of the Merchant API.
const DefaultBaseURL = "https://api.tonbankcard.io/v1"

// userAgent is sent on every request for observability.
const userAgent = "tonbankcard-go/1.0.0"

// Config configures a new Client. APIKey is required.
//
// API keys are accepted only via this struct — they are never passed as URL
// query parameters or fragments.
type Config struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
	Timeout    time.Duration
}

// Client is the synchronous Merchant API client. It is safe for concurrent
// use; the embedded *http.Client maintains a connection pool.
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

// NewClient builds a configured Client. It returns an error if APIKey is empty.
func NewClient(cfg Config) (*Client, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("%w: APIKey is required", ErrInvalidInput)
	}
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		timeout := cfg.Timeout
		if timeout == 0 {
			timeout = 30 * time.Second
		}
		httpClient = &http.Client{Timeout: timeout}
	}
	return &Client{
		apiKey:  cfg.APIKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    httpClient,
	}, nil
}

// CreateInvoice creates a new invoice. Returns an error wrapping ErrInvalidRequest
// for 4xx validation failures, ErrAuthentication for 401/403, and so on.
func (c *Client) CreateInvoice(ctx context.Context, params CreateInvoiceParams) (*Invoice, error) {
	if err := ValidateMerchantNFT(params.MerchantNFT); err != nil {
		return nil, err
	}
	if err := ValidateAmount(params.AmountTBC); err != nil {
		return nil, err
	}

	metadata := params.Metadata
	if params.CallbackURL != "" {
		if metadata == nil {
			metadata = map[string]any{}
		}
		if _, exists := metadata["callback_url"]; !exists {
			metadata["callback_url"] = params.CallbackURL
		}
	}
	if metadata != nil {
		if err := ValidateMetadata(metadata); err != nil {
			return nil, err
		}
	}

	payload := map[string]any{
		"merchant_nft": params.MerchantNFT,
		"amount_tbc":   params.AmountTBC,
		"currency":     "TBC",
	}
	if metadata != nil {
		payload["metadata"] = metadata
	}
	if params.ExpiresAt != "" {
		payload["expires_at"] = params.ExpiresAt
	}

	var invoice Invoice
	if err := c.do(ctx, http.MethodPost, "/invoice/create", payload, &invoice); err != nil {
		return nil, err
	}
	return &invoice, nil
}

// GetInvoice retrieves an invoice by id.
func (c *Client) GetInvoice(ctx context.Context, invoiceID string) (*Invoice, error) {
	if invoiceID == "" {
		return nil, fmt.Errorf("%w: invoice_id is required", ErrInvalidInput)
	}
	path := "/invoice/" + url.PathEscape(invoiceID)
	var invoice Invoice
	if err := c.do(ctx, http.MethodGet, path, nil, &invoice); err != nil {
		return nil, err
	}
	return &invoice, nil
}

// GetInvoiceStatus returns the lifecycle state of an invoice (and on-chain
// settlement, when present).
func (c *Client) GetInvoiceStatus(ctx context.Context, invoiceID string) (*InvoiceStatusResponse, error) {
	if invoiceID == "" {
		return nil, fmt.Errorf("%w: invoice_id is required", ErrInvalidInput)
	}
	path := "/invoice/" + url.PathEscape(invoiceID) + "/status"
	var status InvoiceStatusResponse
	if err := c.do(ctx, http.MethodGet, path, nil, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("tonbankcard: encoding request body: %w", err)
		}
		reqBody = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("tonbankcard: building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tonbankcard: sending request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("tonbankcard: reading response body: %w", err)
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if out == nil {
			return nil
		}
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("tonbankcard: decoding response: %w", err)
		}
		return nil
	}

	apiErr := &APIError{
		StatusCode: resp.StatusCode,
		Code:       "INTERNAL_ERROR",
		Message:    http.StatusText(resp.StatusCode),
	}
	var errorEnvelope struct {
		Error struct {
			Code    string         `json:"code"`
			Message string         `json:"message"`
			Details map[string]any `json:"details"`
		} `json:"error"`
	}
	if jsonErr := json.Unmarshal(respBody, &errorEnvelope); jsonErr == nil {
		if errorEnvelope.Error.Code != "" {
			apiErr.Code = errorEnvelope.Error.Code
		}
		if errorEnvelope.Error.Message != "" {
			apiErr.Message = errorEnvelope.Error.Message
		}
		apiErr.Details = errorEnvelope.Error.Details
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		if v := resp.Header.Get("Retry-After"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				apiErr.RetryAfter = f
			}
		}
	}

	return apiErr
}

// IsAPIError reports whether err is (or wraps) an *APIError.
func IsAPIError(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr)
}
