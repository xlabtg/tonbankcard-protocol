---
title: "[FRONTEND-M4] HttpsClient certificate pinning validates the configured pin against itself"
severity: medium
area: frontend
priority: medium
stage: 3
labels: ["bug","audit","type:frontend","type:security","priority:medium","stage:3-medium"]
---

## Summary

The HTTPS client's certificate-pinning hook passes the configured pin itself to the validator as if it were the server's certificate fingerprint. No fingerprint is ever extracted from the live connection, so the validator compares a pin against itself (or against another configured pin) and pinning provides no real protection.

## Severity & Category

- Severity: Medium
- Category: Security / Ineffective transport pinning

## Affected Code

- `mobile-app/src/lib/network/httpsClient.ts:57-69` — `HttpsClient.fetch`, specifically the validator invocation at `mobile-app/src/lib/network/httpsClient.ts:61-67`.

## Description

In `fetch`, the configured pins for the host are iterated and each pin is passed straight into the validator as the `sha256Fingerprint` argument:

```ts
// mobile-app/src/lib/network/httpsClient.ts:57-69
async fetch(url: string, init: HttpsFetchOptions = {}): Promise<Response> {
  if (!url.startsWith(HTTPS_PREFIX)) {
    throw new HttpsOnlyError(url);
  }
  if (this.validator) {
    const host = init.host ?? new URL(url).hostname;
    const pins = this.pinsFor(host);
    for (const pin of pins) {
      await this.validator(host, pin);
    }
  }
  return this.fetchImpl(url, init);
}
```

The validator's contract (`mobile-app/src/lib/network/httpsClient.ts:21`) is `(host, sha256Fingerprint) => ...`, where the second argument is meant to be the fingerprint extracted from the server certificate at connection time. Here it is the configured pin. A validator that compares its argument to the pin set will trivially match (the value is a pin by construction), so a man-in-the-middle presenting a different certificate is never detected. The server certificate's actual public-key fingerprint is never computed or compared, and the request proceeds via `this.fetchImpl` regardless.

## Impact

- Certificate pinning, where configured, does not defend against a MITM with a rogue-but-trusted certificate, because the live certificate is never examined.
- Operators relying on the documented pinning hook have a false assurance of transport integrity.

## Suggested Fix

- Extract the server certificate's SPKI (subject public key info) SHA-256 fingerprint at connection time (e.g. via the platform TLS/pinning native module such as `react-native-ssl-pinning`) and compare that live fingerprint against the configured pin set.
- Fail closed on mismatch (throw to abort the request) and when pinning is required for a host but no live fingerprint is available.
- Preserve the documented permissive behavior only for hosts with no configured pins.
- This change is at the transport layer and does not touch keys or signing, preserving the non-custodial design.

## Acceptance Criteria

- [ ] The validator receives the SPKI/public-key SHA-256 fingerprint extracted from the live server certificate, not a configured pin.
- [ ] A connection whose live fingerprint is not in the configured pin set for a pinned host is rejected (fail closed).
- [ ] Hosts with no configured pins retain the documented permissive behavior.
- [ ] The fix introduces no key handling or signing in the app (non-custodial property preserved).
- [ ] Regression test: a pinned host presenting a non-matching fingerprint causes `fetch` to reject; a matching fingerprint succeeds; an unpinned host is unaffected.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-LOW-hardening-backlog.md` (L3, weak HTTPS prefix check)
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#290](https://github.com/xlabtg/tonbankcard-protocol/issues/290)
