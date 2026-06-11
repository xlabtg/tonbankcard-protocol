package tonbankcard

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"testing"
)

// pc06Fixture mirrors tests/fixtures/pc-06-canonical-conformance.json, the
// cross-SDK conformance vectors for audit finding PC-06 (issue #375). The same
// fixture drives the TypeScript and Python suites, so identical logical inputs
// must produce identical canonical bytes and SHA-256 digests in every SDK.
//
// Numbers travel as decimal strings (decimal field) so that encoding/json does
// not silently coerce every JSON number to float64 on the way in; each test
// parses the decimal into the native Go type before exercising CanonicalJSON.
type pc06Fixture struct {
	StringValues []struct {
		Name      string `json:"name"`
		Input     string `json:"input"`
		Canonical string `json:"canonical"`
		SHA256    string `json:"sha256"`
	} `json:"string_values"`
	Payloads []struct {
		Name           string         `json:"name"`
		Input          map[string]any `json:"input"`
		Canonical      string         `json:"canonical"`
		SHA256         string         `json:"sha256"`
		InputReordered map[string]any `json:"input_reordered"`
	} `json:"payloads"`
	SafeIntegers []struct {
		Name      string `json:"name"`
		Decimal   string `json:"decimal"`
		Canonical string `json:"canonical"`
		SHA256    string `json:"sha256"`
	} `json:"safe_integers"`
	RejectedFloats []struct {
		Name    string `json:"name"`
		Decimal string `json:"decimal"`
	} `json:"rejected_floats"`
	RejectedUnsafeIntegers []struct {
		Name    string `json:"name"`
		Decimal string `json:"decimal"`
	} `json:"rejected_unsafe_integers"`
}

func loadPC06Fixture(t *testing.T) pc06Fixture {
	t.Helper()
	raw, err := os.ReadFile("../tests/fixtures/pc-06-canonical-conformance.json")
	if err != nil {
		t.Fatalf("read PC-06 fixture: %v", err)
	}
	var fixture pc06Fixture
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("parse PC-06 fixture: %v", err)
	}
	return fixture
}

func sha256Hex(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}

func TestPC06StringVectors(t *testing.T) {
	t.Parallel()
	fixture := loadPC06Fixture(t)
	for _, vector := range fixture.StringValues {
		t.Run(vector.Name, func(t *testing.T) {
			canonical, err := CanonicalJSON(vector.Input)
			if err != nil {
				t.Fatalf("canonical JSON: %v", err)
			}
			if canonical != vector.Canonical {
				t.Fatalf("canonical mismatch: got %q want %q", canonical, vector.Canonical)
			}
			if got := sha256Hex(canonical); got != vector.SHA256 {
				t.Fatalf("sha256 mismatch: got %s want %s", got, vector.SHA256)
			}
		})
	}
}

func TestPC06PayloadVectors(t *testing.T) {
	t.Parallel()
	fixture := loadPC06Fixture(t)
	for _, vector := range fixture.Payloads {
		t.Run(vector.Name, func(t *testing.T) {
			canonical, err := CanonicalJSON(vector.Input)
			if err != nil {
				t.Fatalf("canonical JSON: %v", err)
			}
			if canonical != vector.Canonical {
				t.Fatalf("canonical mismatch: got %q want %q", canonical, vector.Canonical)
			}
			if got := sha256Hex(canonical); got != vector.SHA256 {
				t.Fatalf("sha256 mismatch: got %s want %s", got, vector.SHA256)
			}

			hash, err := CreatePayloadHash(vector.Input)
			if err != nil {
				t.Fatalf("payload hash: %v", err)
			}
			if got := fmt.Sprintf("%064x", hash); got != vector.SHA256 {
				t.Fatalf("payload hash mismatch: got %s want %s", got, vector.SHA256)
			}

			if vector.InputReordered != nil {
				reordered, err := CanonicalJSON(vector.InputReordered)
				if err != nil {
					t.Fatalf("reordered canonical JSON: %v", err)
				}
				if reordered != vector.Canonical {
					t.Fatalf("reordered canonical mismatch: got %q want %q", reordered, vector.Canonical)
				}
			}
		})
	}
}

func TestPC06SafeIntegerVectors(t *testing.T) {
	t.Parallel()
	fixture := loadPC06Fixture(t)
	for _, vector := range fixture.SafeIntegers {
		t.Run(vector.Name, func(t *testing.T) {
			n, err := strconv.ParseInt(vector.Decimal, 10, 64)
			if err != nil {
				t.Fatalf("parse int %q: %v", vector.Decimal, err)
			}
			canonical, err := CanonicalJSON(n)
			if err != nil {
				t.Fatalf("canonical JSON: %v", err)
			}
			if canonical != vector.Canonical {
				t.Fatalf("canonical mismatch: got %q want %q", canonical, vector.Canonical)
			}
			if got := sha256Hex(canonical); got != vector.SHA256 {
				t.Fatalf("sha256 mismatch: got %s want %s", got, vector.SHA256)
			}
		})
	}
}

func TestPC06RejectsFloats(t *testing.T) {
	t.Parallel()
	fixture := loadPC06Fixture(t)
	for _, vector := range fixture.RejectedFloats {
		t.Run(vector.Name, func(t *testing.T) {
			f, err := strconv.ParseFloat(vector.Decimal, 64)
			if err != nil {
				t.Fatalf("parse float %q: %v", vector.Decimal, err)
			}
			if _, err := CanonicalJSON(f); err == nil {
				t.Fatalf("canonical JSON accepted float %v", f)
			}
		})
	}
}

func TestPC06RejectsUnsafeIntegers(t *testing.T) {
	t.Parallel()
	fixture := loadPC06Fixture(t)
	for _, vector := range fixture.RejectedUnsafeIntegers {
		t.Run(vector.Name, func(t *testing.T) {
			n, err := strconv.ParseInt(vector.Decimal, 10, 64)
			if err != nil {
				t.Fatalf("parse int %q: %v", vector.Decimal, err)
			}
			if _, err := CanonicalJSON(n); err == nil {
				t.Fatalf("canonical JSON accepted unsafe integer %d", n)
			}
		})
	}
}
