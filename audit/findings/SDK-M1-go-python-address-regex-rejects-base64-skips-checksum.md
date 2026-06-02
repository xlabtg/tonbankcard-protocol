---
title: "[SDK-M1] Go and Python address regex rejects standard base64 and skips the CRC16 checksum"
severity: medium
area: sdk
priority: medium
stage: 3
labels: ["bug","audit","type:sdk","type:security","priority:medium","stage:3-medium"]
---

## Summary

The Go and Python SDKs validate TON addresses with a regex that only matches a base64url-flavoured subset. It rejects valid standard-base64 friendly addresses and validates no CRC16 checksum, so legitimate addresses are refused while structurally-shaped but corrupt addresses pass.

## Severity & Category

- Severity: Medium
- Category: Input validation correctness

## Affected Code

- `sdk-go/models.go:78` (`tonAddressRe`), enforced in `ValidateMerchantNFT` at `sdk-go/models.go:89-95`
- `sdk-python/src/tonbankcard_merchant/models.py:19` (`_TON_ADDRESS_RE`)

## Description

Both SDKs use the same restrictive pattern:

```go
// sdk-go/models.go:78
tonAddressRe  = regexp.MustCompile(`^[EU][Qq][A-Za-z0-9_-]{46}$`)
```

```python
# sdk-python/src/tonbankcard_merchant/models.py:19
_TON_ADDRESS_RE = re.compile(r"^[EU][Qq][A-Za-z0-9_-]{46}$")
```

The character class `[A-Za-z0-9_-]` is the base64url alphabet; standard-base64 friendly addresses (which use `+` and `/`) are rejected. The regex also checks only shape and length — it never decodes the address or verifies the trailing CRC16 checksum, so a string with the right shape but a corrupted checksum is accepted.

## Impact

- Valid merchant NFT addresses supplied in standard base64 are rejected, breaking invoice creation for those merchants.
- Corrupt addresses with a valid shape but invalid checksum pass validation, defeating the purpose of the check.

## Suggested Fix

- Accept both base64 and base64url friendly forms as well as the raw (`workchain:hex`) form.
- Decode the friendly form and verify the CRC16 checksum rather than relying on a shape-only regex.
- Mirror the corrected validation across the Go and Python SDKs (and align with the TypeScript validator).

## Acceptance Criteria

- [ ] Validation accepts standard base64, base64url, and raw address forms.
- [ ] Validation verifies the CRC16 checksum and rejects checksum-corrupt addresses.
- [ ] Regression tests in both SDKs assert a standard-base64 address passes, a base64url address passes, and a checksum-corrupt address is rejected.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#291](https://github.com/xlabtg/tonbankcard-protocol/issues/291)
