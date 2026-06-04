package tonbankcard

import (
	"math/big"
	"strings"
	"testing"
)

const (
	validNFT                  = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le"
	validNFTStandardBase64    = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ/qgn3il+Le"
	validNFTRaw               = "0:231e41edb75308a14e5cedd92cef7473f0d331000de84ad4ab710fea827de297"
	checksumCorruptedValidNFT = "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Lf"
)

func TestValidateMerchantNFT(t *testing.T) {
	t.Parallel()
	for _, addr := range []string{validNFT, validNFTStandardBase64, validNFTRaw} {
		if err := ValidateMerchantNFT(addr); err != nil {
			t.Fatalf("expected valid NFT address %q to pass, got %v", addr, err)
		}
	}
	for _, addr := range []string{
		"",
		"not-an-address",
		"AQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
		checksumCorruptedValidNFT,
		"EQA" + strings.Repeat("x", 50),
	} {
		if err := ValidateMerchantNFT(addr); err == nil {
			t.Fatalf("expected error for address %q", addr)
		}
	}
}

func TestValidateAmount(t *testing.T) {
	t.Parallel()
	ok := []string{"1", "1000000000", new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 120), big.NewInt(1)).String()}
	for _, a := range ok {
		if err := ValidateAmount(a); err != nil {
			t.Fatalf("expected %q to be valid: %v", a, err)
		}
	}
	bad := []string{"", "0", "-1", "1.5", "abc", "01000", new(big.Int).Lsh(big.NewInt(1), 120).String()}
	for _, a := range bad {
		if err := ValidateAmount(a); err == nil {
			t.Fatalf("expected error for amount %q", a)
		}
	}
}

func TestValidateMetadata(t *testing.T) {
	t.Parallel()
	if err := ValidateMetadata(map[string]any{"a": "x", "b": 1, "c": 1.5, "d": true}); err != nil {
		t.Fatalf("scalars should be accepted: %v", err)
	}
	tooMany := map[string]any{}
	for i := 0; i < 11; i++ {
		tooMany["k"+string(rune('0'+i))] = "v"
	}
	if err := ValidateMetadata(tooMany); err == nil {
		t.Fatal("expected error for >10 metadata fields")
	}
	if err := ValidateMetadata(map[string]any{"bad key!": "v"}); err == nil {
		t.Fatal("expected error for invalid metadata key")
	}
	if err := ValidateMetadata(map[string]any{"k": strings.Repeat("x", 257)}); err == nil {
		t.Fatal("expected error for oversized metadata value")
	}
	if err := ValidateMetadata(map[string]any{"k": []int{1, 2}}); err == nil {
		t.Fatal("expected error for complex metadata value")
	}
}
