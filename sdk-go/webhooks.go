package tonbankcard

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// DefaultSignatureHeader is the HTTP header used by the Merchant API to deliver
// webhook signatures. Mirror the constant from the Python/TypeScript SDKs and
// the OpenAPI spec.
const DefaultSignatureHeader = "X-Tonbankcard-Signature"

// SignatureVersion is the scheme identifier emitted by the server in the
// versioned signature component (e.g. "v1=<hex>").
const SignatureVersion = "v1"

// DefaultToleranceSeconds is the freshness window: deliveries whose timestamp
// is older (or further in the future) than this are rejected as potential
// replays. Mirrors DEFAULT_TOLERANCE_SECONDS in the server/TypeScript SDK.
const DefaultToleranceSeconds = 300

// versionKeyRe matches a versioned signature key such as "v1" or "v2".
var versionKeyRe = regexp.MustCompile(`^v\d+$`)

// ComputeSignature returns the HMAC-SHA256 hex digest of `${timestamp}.${payload}`
// using secret. This matches the server scheme in
// api/src/utils/webhookSignature.ts: the timestamp is part of the signed
// preimage so a captured signature cannot be replayed once it falls outside
// the freshness window.
func ComputeSignature(secret []byte, timestamp string, payload []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// SignWebhook builds the value of the X-Tonbankcard-Signature header in the
// form `t=<unix-timestamp>,v1=<hex>`. Exposed so application code can produce
// signatures for testing or for replaying a known body.
func SignWebhook(secret, payload []byte, timestamp int64) string {
	ts := strconv.FormatInt(timestamp, 10)
	return fmt.Sprintf("t=%s,%s=%s", ts, SignatureVersion, ComputeSignature(secret, ts, payload))
}

// verifyOptions holds the configurable knobs for VerifyWebhook.
type verifyOptions struct {
	tolerance time.Duration
	now       func() time.Time
}

// VerifyOption customises webhook verification.
type VerifyOption func(*verifyOptions)

// WithTolerance overrides the freshness window (default 5 minutes). Deliveries
// whose timestamp is outside ±tolerance of "now" are rejected.
func WithTolerance(d time.Duration) VerifyOption {
	return func(o *verifyOptions) { o.tolerance = d }
}

// WithNow overrides the clock used for the freshness check. Primarily useful
// for deterministic tests.
func WithNow(now func() time.Time) VerifyOption {
	return func(o *verifyOptions) {
		if now != nil {
			o.now = now
		}
	}
}

// VerifyWebhook authenticates a webhook delivery against the structured
// `t=<unix-timestamp>,v1=<hex>` signature header emitted by the Merchant API.
//
// It parses the header, enforces a freshness window (default 5 minutes) for
// replay protection, recomputes HMAC-SHA256 over `${timestamp}.${payload}` and
// compares the v1 digest using constant-time comparison (hmac.Equal).
//
// On success, it returns the parsed payload. On failure, it returns an error
// wrapping ErrSignatureVerification.
//
// The payload MUST be the exact raw bytes received in the HTTP request —
// re-marshalling the JSON would alter whitespace and break the signature.
func VerifyWebhook(secret, payload []byte, signature string, opts ...VerifyOption) (*WebhookPayload, error) {
	options := verifyOptions{
		tolerance: DefaultToleranceSeconds * time.Second,
		now:       time.Now,
	}
	for _, opt := range opts {
		opt(&options)
	}

	if len(secret) == 0 {
		return nil, fmt.Errorf("%w: empty secret", ErrSignatureVerification)
	}
	if signature == "" {
		return nil, fmt.Errorf("%w: empty signature", ErrSignatureVerification)
	}

	timestamp, versioned, err := parseSignatureHeader(signature)
	if err != nil {
		return nil, err
	}

	now := options.now()
	delta := now.Sub(time.Unix(timestamp, 0))
	if delta < 0 {
		delta = -delta
	}
	if delta > options.tolerance {
		return nil, fmt.Errorf("%w: timestamp outside tolerance window", ErrSignatureVerification)
	}

	provided, ok := versioned[SignatureVersion]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported signature version", ErrSignatureVerification)
	}
	providedBytes, err := hex.DecodeString(provided)
	if err != nil {
		return nil, fmt.Errorf("%w: signature is not valid hex: %v", ErrSignatureVerification, err)
	}
	expected, err := hex.DecodeString(ComputeSignature(secret, strconv.FormatInt(timestamp, 10), payload))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSignatureVerification, err)
	}
	if !hmac.Equal(providedBytes, expected) {
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

// parseSignatureHeader splits a `t=<ts>,vN=<hex>` header into its timestamp and
// versioned signature components. Unknown keys are ignored for forward
// compatibility. It tolerates surrounding whitespace.
func parseSignatureHeader(value string) (int64, map[string]string, error) {
	var timestamp int64
	tsSet := false
	versioned := make(map[string]string)

	for _, part := range strings.Split(value, ",") {
		key, val, ok := strings.Cut(part, "=")
		if !ok {
			return 0, nil, fmt.Errorf("%w: malformed signature header", ErrSignatureVerification)
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		switch {
		case key == "t":
			parsed, err := strconv.ParseInt(val, 10, 64)
			if err != nil || parsed <= 0 {
				return 0, nil, fmt.Errorf("%w: malformed signature timestamp", ErrSignatureVerification)
			}
			timestamp = parsed
			tsSet = true
		case versionKeyRe.MatchString(key):
			versioned[key] = val
		}
		// Ignore unknown keys.
	}

	if !tsSet || len(versioned) == 0 {
		return 0, nil, fmt.Errorf("%w: malformed signature header", ErrSignatureVerification)
	}
	return timestamp, versioned, nil
}

// IsSignatureError reports whether err wraps ErrSignatureVerification.
func IsSignatureError(err error) bool {
	return errors.Is(err, ErrSignatureVerification)
}
