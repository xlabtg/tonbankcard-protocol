package tonbankcard

import (
	"encoding/json"
	"errors"
	"testing"
)

const webhookSecret = "shhh-very-secret"

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

func TestVerifyWebhookSuccess(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	sig := ComputeSignature([]byte(webhookSecret), body)
	payload, err := VerifyWebhook([]byte(webhookSecret), body, sig)
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

func TestVerifyWebhookAcceptsSha256Prefix(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	sig := "sha256=" + ComputeSignature([]byte(webhookSecret), body)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig); err != nil {
		t.Fatalf("expected prefixed signature to be accepted: %v", err)
	}
}

func TestVerifyWebhookRejectsWrongSignature(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	_, err := VerifyWebhook([]byte(webhookSecret), body, "00")
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
	sig := ComputeSignature([]byte(webhookSecret), body)
	tampered := append([]byte{}, body...)
	tampered[len(tampered)-2] = byte('X')
	if _, err := VerifyWebhook([]byte(webhookSecret), tampered, sig); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected tampered body to fail verification, got %v", err)
	}
}

func TestVerifyWebhookRejectsNonHex(t *testing.T) {
	t.Parallel()
	body := samplePayload(t)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, "not-hex"); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected non-hex signature to be rejected, got %v", err)
	}
}

func TestVerifyWebhookRejectsEmptyInputs(t *testing.T) {
	t.Parallel()
	if _, err := VerifyWebhook(nil, samplePayload(t), "abc"); !errors.Is(err, ErrSignatureVerification) {
		t.Fatal("expected empty secret to be rejected")
	}
	if _, err := VerifyWebhook([]byte(webhookSecret), samplePayload(t), ""); !errors.Is(err, ErrSignatureVerification) {
		t.Fatal("expected empty signature to be rejected")
	}
}

func TestVerifyWebhookRejectsNonObjectJSON(t *testing.T) {
	t.Parallel()
	body := []byte("\"just a string\"")
	sig := ComputeSignature([]byte(webhookSecret), body)
	if _, err := VerifyWebhook([]byte(webhookSecret), body, sig); !errors.Is(err, ErrSignatureVerification) {
		t.Fatalf("expected non-object payload to be rejected, got %v", err)
	}
}
