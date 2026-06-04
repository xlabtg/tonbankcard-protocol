package tonbankcard

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"reflect"
	"strconv"
	"strings"
)

// InvoiceIDParams are the canonical inputs hashed by GenerateInvoiceID.
type InvoiceIDParams struct {
	MerchantNFT string
	AmountTBC   string
	OrderID     string
	Timestamp   int64
}

// CanonicalInvoiceIDPayload returns the byte-identical JSON payload hashed by
// GenerateInvoiceID across SDK implementations.
func CanonicalInvoiceIDPayload(params InvoiceIDParams) (string, error) {
	merchantNFT, err := CanonicalizeTonAddress(params.MerchantNFT)
	if err != nil {
		return "", err
	}
	if err := ValidateAmount(params.AmountTBC); err != nil {
		return "", err
	}
	return CanonicalJSON(map[string]any{
		"amount_tbc":   params.AmountTBC,
		"merchant_nft": merchantNFT,
		"order_id":     params.OrderID,
		"timestamp":    strconv.FormatInt(params.Timestamp, 10),
	})
}

// GenerateInvoiceID returns the SHA-256 hex digest of the canonical invoice
// payload.
func GenerateInvoiceID(params InvoiceIDParams) (string, error) {
	payload, err := CanonicalInvoiceIDPayload(params)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:]), nil
}

// CreatePayloadHash returns the SHA-256 digest of a canonical JSON payload as
// a positive integer.
func CreatePayloadHash(payload map[string]any) (*big.Int, error) {
	canonical, err := CanonicalJSON(payload)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(canonical))
	return new(big.Int).SetBytes(sum[:]), nil
}

// CanonicalJSON encodes JSON-compatible values with sorted object keys and no
// insignificant whitespace. big.Int values are encoded as decimal strings.
func CanonicalJSON(value any) (string, error) {
	normalized, err := normalizeCanonicalJSON(value)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(normalized); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buf.String(), "\n"), nil
}

func normalizeCanonicalJSON(value any) (any, error) {
	switch typed := value.(type) {
	case nil, string, bool:
		return typed, nil
	case int, int8, int16, int32, int64:
		return typed, nil
	case uint, uint8, uint16, uint32, uint64:
		return typed, nil
	case float32:
		if math.IsInf(float64(typed), 0) || math.IsNaN(float64(typed)) {
			return nil, fmt.Errorf("tonbankcard: canonical JSON does not support non-finite numbers")
		}
		return typed, nil
	case float64:
		if math.IsInf(typed, 0) || math.IsNaN(typed) {
			return nil, fmt.Errorf("tonbankcard: canonical JSON does not support non-finite numbers")
		}
		return typed, nil
	case big.Int:
		return typed.String(), nil
	case *big.Int:
		if typed == nil {
			return nil, nil
		}
		return typed.String(), nil
	case []any:
		items := make([]any, len(typed))
		for i, item := range typed {
			normalized, err := normalizeCanonicalJSON(item)
			if err != nil {
				return nil, err
			}
			items[i] = normalized
		}
		return items, nil
	case map[string]any:
		object := make(map[string]any, len(typed))
		for key, item := range typed {
			normalized, err := normalizeCanonicalJSON(item)
			if err != nil {
				return nil, err
			}
			object[key] = normalized
		}
		return object, nil
	}

	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.Slice, reflect.Array:
		items := make([]any, reflected.Len())
		for i := 0; i < reflected.Len(); i++ {
			normalized, err := normalizeCanonicalJSON(reflected.Index(i).Interface())
			if err != nil {
				return nil, err
			}
			items[i] = normalized
		}
		return items, nil
	case reflect.Map:
		if reflected.Type().Key().Kind() != reflect.String {
			return nil, fmt.Errorf("tonbankcard: canonical JSON object keys must be strings")
		}
		object := make(map[string]any, reflected.Len())
		for _, key := range reflected.MapKeys() {
			normalized, err := normalizeCanonicalJSON(reflected.MapIndex(key).Interface())
			if err != nil {
				return nil, err
			}
			object[key.String()] = normalized
		}
		return object, nil
	default:
		return nil, fmt.Errorf("tonbankcard: canonical JSON does not support %T", value)
	}
}
