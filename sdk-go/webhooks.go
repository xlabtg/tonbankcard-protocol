package tonbankcard

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// DefaultSignatureHeader is the HTTP header used by the Merchant API to deliver
// webhook signatures. Mirror the constant from the Python SDK and OpenAPI spec.
const DefaultSignatureHeader = "X-Tonbankcard-Signature"

// ComputeSignature returns the HMAC-SHA256 hex digest of payload using secret.
// Used both by the API (server-side, to sign deliveries) and by tests.
func ComputeSignature(secret, payload []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyWebhook authenticates a webhook delivery using constant-time
// comparison (hmac.Equal). It accepts signatures with or without the
// "sha256=" prefix.
//
// On success, it returns the parsed payload. On failure, it returns an
// error wrapping ErrSignatureVerification.
//
// The payload MUST be the exact raw bytes received in the HTTP request —
// re-marshalling the JSON would alter whitespace and break the signature.
func VerifyWebhook(secret, payload []byte, signature string) (*WebhookPayload, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("%w: empty secret", ErrSignatureVerification)
	}
	if signature == "" {
		return nil, fmt.Errorf("%w: empty signature", ErrSignatureVerification)
	}
	sig := strings.TrimPrefix(signature, "sha256=")
	provided, err := hex.DecodeString(sig)
	if err != nil {
		return nil, fmt.Errorf("%w: signature is not valid hex: %v", ErrSignatureVerification, err)
	}
	expected, err := hex.DecodeString(ComputeSignature(secret, payload))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSignatureVerification, err)
	}
	if !hmac.Equal(provided, expected) {
		return nil, fmt.Errorf("%w: signature mismatch", ErrSignatureVerification)
	}

	var raw map[string]any
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, fmt.Errorf("%w: payload is not a JSON object: %v", ErrSignatureVerification, err)
	}
	if raw == nil {
		return nil, fmt.Errorf("%w: payload is not a JSON object", ErrSignatureVerification)
	}

	var parsed WebhookPayload
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSignatureVerification, err)
	}
	if parsed.Event == "" || parsed.InvoiceID == "" || parsed.Status == "" {
		return nil, fmt.Errorf("%w: missing required webhook fields", ErrSignatureVerification)
	}
	parsed.Raw = raw
	return &parsed, nil
}

// IsSignatureError reports whether err wraps ErrSignatureVerification.
func IsSignatureError(err error) bool {
	return errors.Is(err, ErrSignatureVerification)
}
