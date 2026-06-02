package tonbankcard

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"
)

const webhookSecret = "shhh-very-secret"

// fixedNow returns a clock pinned to ts (unix seconds) so freshness checks are
// deterministic in tests.
func fixedNow(ts int64) func() time.Time {
	return func() time.Time { return time.Unix(ts, 0) }
}

func samplePayload(t *testing.T) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"event":      "invoice.settled",
		"invoice_id": "inv_abc",
		"status":     "settled",
		"timestamp":  "2026-05-17T10:05:00Z",
	})
	if err != nil {
		t.Fatalf("marshal sample: %v", err)
	}
	return body
}

func TestComputeSignatureMatchesServerScheme(t *testing.T) {
	t.Parallel()
	// Cross-language fixture: HMAC-SHA256(secret, "${ts}.${body}") locks the
	// preimage to `${timestamp}.${rawBody}` exactly as the server helper
	// (api/src/utils/webhookSignature.ts) and the TypeScript/Python SDKs do.
	got := ComputeSignature([]byte("secret"), "1700000000", []byte("{}"))
	const want = "b8569b78799ff9e3cbff0fc2d63a33a2b57f3282abd07c37ae5e8e7d79a5f163"
	if got != want {
		t.Fatalf("signature scheme drift: got %q, want %q", got, want)
	}
}

func TestVerifyWebhookSuccess(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	payload, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts)))
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if payload.Event != "invoice.settled" || payload.InvoiceID != "inv_abc" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Status != InvoiceStatusSettled {
		t.Fatalf("expected status settled, got %s", payload.Status)
	}
	if payload.Raw["timestamp"] != "2026-05-17T10:05:00Z" {
		t.Fatalf("raw payload not preserved: %+v", payload.Raw)
	}
}

func TestVerifyWebhookWithinTolerance(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	// 4 minutes later — inside the default 5-minute window.
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts+240))); err != nil {
		t.Fatalf("expected delivery within tolerance to verify, got %v", err)
	}
}

func TestVerifyWebhookRejectsStaleTimestamp(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	// 6 minutes later — outside the default 5-minute window (replay protection).
	_, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts+360)))
	if !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected stale timestamp to be rejected, got %v", err)
	}
}

func TestVerifyWebhookCustomTolerance(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig,
		WithNow(fixedNow(ts+600)), WithTolerance(15*time.Minute)); err != nil {
		t.Fatalf("expected delivery within custom tolerance to verify, got %v", err)
	}
}

func TestVerifyWebhookRejectsWrongSignature(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := fmt.Sprintf("t=%d,v1=%s", ts, "00")
	_, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts)))
	if err == nil {
		t.Fatal("expected signature mismatch error")
	}
	if !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected ErrSignatureVerification, got %v", err)
	}
}

func TestVerifyWebhookRejectsTampering(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	tampered := append([]byte{}, body...)
	tampered[len(tampered)-2] = byte('X')
	if _, err := VerifyWebhook([]byte(webhookSecret), tampered, sig, WithNow(fixedNow(ts))); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected tampered body to fail verification, got %v", err)
	}
}

func TestVerifyWebhookRejectsWrongSecret(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte("other-secret"), body, ts)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts))); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected wrong secret to fail verification, got %v", err)
	}
}

func TestVerifyWebhookRejectsMalformedHeader(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	for _, sig := range []string{
		"not-hex",               // no key=value structure
		"v1=" + "ab",            // missing timestamp
		fmt.Sprintf("t=%d", ts), // missing signature
		"t=abc,v1=ab",           // non-numeric timestamp
	} {
		if _, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts))); !errors.Is(err, ErrSignatureVerification) {
			t.Fatalf("expected malformed header %q to be rejected, got %v", sig, err)
		}
	}
}

func TestVerifyWebhookRejectsUnsupportedVersion(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	var ts int64 = 1_700_000_000
	digest := ComputeSignature([]byte(webhookSecret), fmt.Sprintf("%d", ts), body)
	sig := fmt.Sprintf("t=%d,v2=%s", ts, digest)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts))); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected unsupported version to be rejected, got %v", err)
	}
}

func TestVerifyWebhookRejectsEmptyInputs(t *testing.T) {
	t.Parallel()
	if _, err := VerifyWebhook(nil, samplePayload(t), "t=1,v1=abc"); !errors.Is(err, ErrSignatureVerification) {
		t.Fatal("expected empty secret to be rejected")
	}
	if _, err := VerifyWebhook([]byte(webhookSecret), samplePayload(t), ""); !errors.Is(err, ErrSignatureVerification) {
		t.Fatal("expected empty signature to be rejected")
	}
}

func TestVerifyWebhookRejectsNonObjectJSON(t *testing.T) {
	t.Parallel()
	body := []byte("\"just a string\"")
	var ts int64 = 1_700_000_000
	sig := SignWebhook([]byte(webhookSecret), body, ts)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig, WithNow(fixedNow(ts))); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected non-object payload to be rejected, got %v", err)
	}
}
