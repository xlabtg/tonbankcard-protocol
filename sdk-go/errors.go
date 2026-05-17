package tonbankcard

import (
	"errors"
	"fmt"
)

// APIError represents a non-2xx response from the Merchant API.
//
// Code is the machine-readable string returned by the API (e.g. INVALID_API_KEY).
// RetryAfter is populated for 429 responses from the Retry-After header.
type APIError struct {
	StatusCode int
	Code       string
	Message    string
	Details    map[string]any
	RetryAfter float64
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return fmt.Sprintf("tonbankcard: [%d %s] %s", e.StatusCode, e.Code, e.Message)
}

// Sentinel errors. Use errors.Is / errors.As against these to branch on
// specific failure modes:
//
//	if errors.Is(err, tonbankcard.ErrInvoiceNotFound) { ... }
//	var apiErr *tonbankcard.APIError
//	if errors.As(err, &apiErr) && apiErr.StatusCode == 401 { ... }
var (
	ErrAuthentication          = errors.New("tonbankcard: authentication failed")
	ErrInvalidRequest          = errors.New("tonbankcard: invalid request")
	ErrInvoiceNotFound         = errors.New("tonbankcard: invoice not found")
	ErrInvoiceExpired          = errors.New("tonbankcard: invoice expired")
	ErrRateLimited             = errors.New("tonbankcard: rate limited")
	ErrServer                  = errors.New("tonbankcard: server error")
	ErrSignatureVerification   = errors.New("tonbankcard: webhook signature verification failed")
)

// Unwrap maps the API status code to one of the sentinel errors above.
func (e *APIError) Unwrap() error {
	switch {
	case e.StatusCode == 401, e.StatusCode == 403:
		return ErrAuthentication
	case e.StatusCode == 400:
		return ErrInvalidRequest
	case e.StatusCode == 404:
		return ErrInvoiceNotFound
	case e.StatusCode == 410:
		return ErrInvoiceExpired
	case e.StatusCode == 429:
		return ErrRateLimited
	case e.StatusCode >= 500:
		return ErrServer
	}
	return nil
}
