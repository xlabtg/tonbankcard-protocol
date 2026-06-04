package tonbankcard

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strconv"
	"strings"
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
	friendlyTonAddressRe = regexp.MustCompile(`^[A-Za-z0-9+/_-]{48}$`)
	rawTonAddressRe      = regexp.MustCompile(`^-?[0-9]+:[0-9a-fA-F]{64}$`)
	amountRe             = regexp.MustCompile(`^[1-9][0-9]*$`)
	metadataKeyRe        = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	maxAmount            = new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 120), big.NewInt(1))
)

const (
	maxMetadataFields      = 10
	maxMetadataValueLength = 256
)

// ValidateMerchantNFT verifies a TON address in friendly or raw form.
func ValidateMerchantNFT(addr string) error {
	if !isValidTonAddress(addr) {
		return fmt.Errorf("tonbankcard: invalid merchant NFT address: %q", addr)
	}
	return nil
}

func isValidTonAddress(addr string) bool {
	return isValidRawTonAddress(addr) || isValidFriendlyTonAddress(addr)
}

// CanonicalizeTonAddress converts a TON friendly or raw address to raw
// `workchain:account_hex` form for cross-SDK hashing.
func CanonicalizeTonAddress(addr string) (string, error) {
	if isValidRawTonAddress(addr) {
		parts := strings.SplitN(addr, ":", 2)
		workchain, err := strconv.Atoi(parts[0])
		if err != nil {
			return "", fmt.Errorf("tonbankcard: invalid TON address: %q", addr)
		}
		return fmt.Sprintf("%d:%s", workchain, strings.ToLower(parts[1])), nil
	}

	decoded, err := decodeFriendlyTonAddress(addr)
	if err != nil {
		return "", fmt.Errorf("tonbankcard: invalid TON address: %q", addr)
	}
	workchain := int(int8(decoded[1]))
	return fmt.Sprintf("%d:%s", workchain, hex.EncodeToString(decoded[2:34])), nil
}

func isValidRawTonAddress(addr string) bool {
	if !rawTonAddressRe.MatchString(addr) {
		return false
	}
	parts := strings.SplitN(addr, ":", 2)
	if _, err := strconv.Atoi(parts[0]); err != nil {
		return false
	}
	hash, err := hex.DecodeString(parts[1])
	return err == nil && len(hash) == 32
}

func isValidFriendlyTonAddress(addr string) bool {
	_, err := decodeFriendlyTonAddress(addr)
	return err == nil
}

func decodeFriendlyTonAddress(addr string) ([]byte, error) {
	if !friendlyTonAddressRe.MatchString(addr) {
		return nil, fmt.Errorf("invalid friendly address shape")
	}
	normalized := strings.NewReplacer("-", "+", "_", "/").Replace(addr)
	decoded, err := base64.StdEncoding.DecodeString(normalized)
	if err != nil || len(decoded) != 36 {
		return nil, fmt.Errorf("invalid friendly address base64")
	}
	tag := decoded[0] & 0x7f
	if tag != 0x11 && tag != 0x51 {
		return nil, fmt.Errorf("invalid friendly address tag")
	}
	expected := uint16(decoded[34])<<8 | uint16(decoded[35])
	if crc16Ton(decoded[:34]) != expected {
		return nil, fmt.Errorf("invalid friendly address checksum")
	}
	return decoded, nil
}

func crc16Ton(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
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
