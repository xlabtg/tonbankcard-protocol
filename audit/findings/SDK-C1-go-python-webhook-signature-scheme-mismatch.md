---
title: "[SDK-C1] Go and Python webhook verifiers use a different signature scheme than the server, rejecting every real webhook"
severity: critical
area: sdk
priority: critical
stage: 1
labels: ["bug","audit","type:sdk","type:security","priority:critical","stage:1-critical"]
---

## Summary

The Go and Python SDK webhook verifiers compute the HMAC over the raw body alone and compare it against the entire signature header. The server, however, emits a structured `t=<ts>,v1=<HMAC-SHA256(secret,"${ts}.${rawBody}")>` header. As a result, every genuine webhook delivery fails verification in the Go and Python SDKs (integration-breaking), and because the timestamp is never parsed or checked, neither SDK provides replay protection. The TypeScript SDK already matches the server scheme; Go and Python do not.

## Severity & Category

- Severity: Critical
- Category: Security (authentication / replay protection) and integration correctness

## Affected Code

- `sdk-go/webhooks.go:17-71` (`ComputeSignature`, `VerifyWebhook`)
- `sdk-python/src/tonbankcard_merchant/webhooks.py:33-93` (`compute_signature`, `verify_webhook`)
- Server reference (authoritative scheme): `api/src/utils/webhookSignature.ts:10-12`, `api/src/utils/webhookSignature.ts:67-93`
- Correct reference implementation: `sdk/src/webhook.ts` (TypeScript SDK)

## Description

The server signs deliveries with a structured, timestamped header:

```ts
// api/src/utils/webhookSignature.ts:10-12
//   X-Tonbankcard-Signature: t=<unix-timestamp>,v1=<hex-hmac-sha256>
//
//   v1 = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
```

```ts
// api/src/utils/webhookSignature.ts:72-93
const hmac = crypto.createHmac('sha256', secret);
hmac.update(`${timestamp}.`);
hmac.update(rawBody);
return hmac.digest('hex');
// ...
return `t=${ts},${SIGNATURE_VERSION}=${sig}`;
```

The Go SDK computes the HMAC over the body only, with no timestamp prefix, and compares against the header string (after merely stripping a `sha256=` prefix that the server never emits):

```go
// sdk-go/webhooks.go:19-23
func ComputeSignature(secret, payload []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
```

```go
// sdk-go/webhooks.go:41-52
sig := strings.TrimPrefix(signature, "sha256=")
provided, err := hex.DecodeString(sig)
// ...
expected, err := hex.DecodeString(ComputeSignature(secret, payload))
// ...
if !hmac.Equal(provided, expected) {
	return nil, fmt.Errorf("%w: signature mismatch", ErrSignatureVerification)
}
```

The Python SDK has the identical defect — it hashes the body alone and compares against the header value:

```python
# sdk-python/src/tonbankcard_merchant/webhooks.py:39-41
secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload
return hmac.new(secret_bytes, payload_bytes, sha256).hexdigest()
```

```python
# sdk-python/src/tonbankcard_merchant/webhooks.py:77-79
expected = compute_signature(secret, payload)
if not hmac.compare_digest(expected.lower(), received.lower()):
    raise SignatureVerificationError("Webhook signature mismatch")
```

Because the server header is `t=<ts>,v1=<hex>`, the Go/Python code attempts to hex-decode the whole header (which is not valid hex), and even after that the digest covers the wrong preimage (body without the `${ts}.` prefix). The timestamp `t=` is never extracted, so no freshness/replay window is enforced.

## Impact

- Every legitimately signed webhook is rejected by the Go and Python SDKs, so merchants using these SDKs cannot process settlement notifications at all.
- No replay protection: even if the signature comparison were corrected to the body-only scheme, the absence of timestamp validation would allow a captured delivery to be replayed indefinitely.
- Cross-SDK inconsistency: identical webhooks verify in TypeScript but fail in Go/Python, producing silent divergence between integrations.

## Suggested Fix

In both the Go and Python SDKs:

- Parse the structured header into its `t=` and `v1=` components.
- Recompute the HMAC-SHA256 over `${t}.${rawBody}` using the shared secret.
- Compare the recomputed `v1` digest to the header's `v1` value using a constant-time comparison.
- Enforce a configurable timestamp tolerance (e.g. default 5 minutes) and reject deliveries whose `t` falls outside the window, providing replay protection.
- Align all three SDKs (TypeScript, Go, Python) and the server on this single scheme; remove the obsolete `sha256=` prefix handling.

## Acceptance Criteria

- [ ] Go and Python verifiers parse the `t=<ts>,v1=<hex>` header structure.
- [ ] Both SDKs recompute HMAC-SHA256 over `${t}.${rawBody}` and constant-time compare the `v1` value.
- [ ] Both SDKs enforce a configurable timestamp tolerance and reject stale deliveries.
- [ ] A regression test in each SDK signs a body with the server helper (or a known fixture from `api/src/utils/webhookSignature.ts`) and asserts the SDK verifies it successfully.
- [ ] A regression test asserts that a delivery outside the timestamp tolerance is rejected (replay protection) and that tampered bodies/signatures are rejected.

## References

- https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `api/src/utils/webhookSignature.ts`
- `sdk/src/webhook.ts`

---

**Tracking issue:** [#249](https://github.com/xlabtg/tonbankcard-protocol/issues/249)
