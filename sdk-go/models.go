package tonbankcard

import (
	"errors"
	"fmt"
	"math/big"
	"regexp"
)

// InvoiceStatus is the lifecycle state of an invoice.
type InvoiceStatus string

const (
	InvoiceStatusPending InvoiceStatus = "pending"
	InvoiceStatusSettled InvoiceStatus = "settled"
	InvoiceStatusExpired InvoiceStatus = "expired"
)

// Settlement captures the on-chain proof for a settled invoice.
type Settlement struct {
	PayerNFT        string `json:"payer_nft"`
	MerchantNFT     string `json:"merchant_nft"`
	AmountTBC       string `json:"amount_tbc"`
	BlockNumber     int64  `json:"block_number"`
	TxHash          string `json:"tx_hash"`
	Timestamp       string `json:"timestamp"`
	PayloadHash     string `json:"payload_hash"`
	OnChainVerified bool   `json:"on_chain_verified,omitempty"`
	VerificationURL string `json:"verification_url,omitempty"`
}

// Invoice is the response body for invoice create / fetch endpoints.
type Invoice struct {
	InvoiceID   string         `json:"invoice_id"`
	MerchantNFT string         `json:"merchant_nft"`
	AmountTBC   string         `json:"amount_tbc"`
	Currency    string         `json:"currency"`
	Status      InvoiceStatus  `json:"status"`
	CreatedAt   string         `json:"created_at"`
	ExpiresAt   string         `json:"expires_at"`
	PaymentURL  string         `json:"payment_url"`
	Metadata    map[string]any `json:"metadata,omitempty"`
	Settlement  *Settlement    `json:"settlement,omitempty"`
}

// InvoiceStatusResponse is returned by GET /invoice/{id}/status.
type InvoiceStatusResponse struct {
	InvoiceID  string        `json:"invoice_id"`
	Status     InvoiceStatus `json:"status"`
	CreatedAt  string        `json:"created_at"`
	ExpiresAt  string        `json:"expires_at"`
	Settlement *Settlement   `json:"settlement,omitempty"`
}

// CreateInvoiceParams are the inputs for Client.CreateInvoice.
//
// AmountTBC is a decimal string of TBC nanocoins (1 TBC = 10^9 nanocoins).
// The maximum amount accepted on chain is 2^120 - 1.
type CreateInvoiceParams struct {
	MerchantNFT string
	AmountTBC   string
	Metadata    map[string]any
	ExpiresAt   string
	CallbackURL string
}

// WebhookPayload is the parsed body of a settlement webhook.
type WebhookPayload struct {
	Event      string         `json:"event"`
	InvoiceID  string         `json:"invoice_id"`
	Status     InvoiceStatus  `json:"status"`
	Timestamp  string         `json:"timestamp"`
	Settlement *Settlement    `json:"settlement,omitempty"`
	Raw        map[string]any `json:"-"`
}

var (
	tonAddressRe  = regexp.MustCompile(`^[EU][Qq][A-Za-z0-9_-]{46}$`)
	amountRe      = regexp.MustCompile(`^[1-9][0-9]*$`)
	metadataKeyRe = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	maxAmount     = new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 120), big.NewInt(1))
)

const (
	maxMetadataFields      = 10
	maxMetadataValueLength = 256
)

// ValidateMerchantNFT verifies a TON address in Base64url form.
func ValidateMerchantNFT(addr string) error {
	if !tonAddressRe.MatchString(addr) {
		return fmt.Errorf("tonbankcard: invalid merchant NFT address: %q", addr)
	}
	return nil
}

// ValidateAmount verifies a decimal TBC nanocoin amount.
func ValidateAmount(amount string) error {
	if !amountRe.MatchString(amount) {
		return fmt.Errorf("tonbankcard: invalid amount_tbc %q (expected positive decimal string)", amount)
	}
	parsed, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return fmt.Errorf("tonbankcard: invalid amount_tbc %q", amount)
	}
	if parsed.Cmp(maxAmount) > 0 {
		return fmt.Errorf("tonbankcard: amount_tbc exceeds maximum of 2^120 - 1: %s", amount)
	}
	return nil
}

// ValidateMetadata enforces the protocol's metadata constraints.
func ValidateMetadata(metadata map[string]any) error {
	if len(metadata) > maxMetadataFields {
		return fmt.Errorf("tonbankcard: metadata has %d fields, exceeds maximum of %d", len(metadata), maxMetadataFields)
	}
	for k, v := range metadata {
		if !metadataKeyRe.MatchString(k) {
			return fmt.Errorf("tonbankcard: invalid metadata key %q (must match [a-zA-Z0-9_]+)", k)
		}
		switch val := v.(type) {
		case string:
			if len(val) > maxMetadataValueLength {
				return fmt.Errorf("tonbankcard: metadata value for %q exceeds %d characters", k, maxMetadataValueLength)
			}
		case bool, int, int32, int64, float32, float64:
			// scalar — accepted
		default:
			return fmt.Errorf("tonbankcard: invalid metadata value type for %q: %T", k, v)
		}
	}
	return nil
}

// ErrInvalidInput is the sentinel returned for client-side validation failures.
var ErrInvalidInput = errors.New("tonbankcard: invalid input")
