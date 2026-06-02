---
title: "[FRONTEND-LOW] Hardening backlog (Low findings)"
severity: low
area: frontend
priority: low
stage: 4
labels: ["bug","audit","type:frontend","type:security","priority:low","stage:4-low"]
---

## Summary

Consolidated backlog of Low-severity findings from the frontend security and logic audit (dashboard, wallet-ui, mobile, mobile-app). Each subsection is independently actionable. None are individually severe. The audit positively confirmed the frontends are non-custodial: no seed phrases or private keys are stored, observed, or handled anywhere in these packages, and signing always occurs inside the user's wallet. Every fix below preserves that property.

## Severity & Category

- Severity: Low
- Category: Hardening / Hygiene / Input validation

## Affected Code

See each subsection below for repo-relative `file:line` references.

## Description

### L1. parseTonLink double-decodes URL components

Affected: `mobile-app/src/lib/tonconnect/deepLink.ts:64-80`

`URLSearchParams` already percent-decodes its values, but `parseTonLink` then applies `decodeURIComponent` again to `text`:

```ts
// mobile-app/src/lib/tonconnect/deepLink.ts:70-79
const params = new URLSearchParams(query);
const amount = params.get('amount') ?? undefined;
const text = params.get('text') ?? undefined;
const returnUrl = params.get('return') ?? undefined;
return {
  recipient,
  amount,
  text: text ? decodeURIComponent(text) : undefined,
  returnUrl,
};
```

Any `text` containing `%` sequences (e.g. a comment with a literal `%20` or `%26`) is corrupted by the second decode, and malformed escapes can throw. Decoding should happen exactly once.

Suggested fix: rely on `URLSearchParams` decoding and remove the extra `decodeURIComponent`, or parse the raw query manually and decode once — but not both.

Acceptance criteria:
- [ ] Each component is decoded exactly once.
- [ ] Regression test: a `text` value containing a literal `%` sequence round-trips through `generatePaymentLink` → `parseTonLink` unchanged.

### L2. Unvalidated returnUrl used for navigation/redirect (open-redirect risk)

Affected: `mobile/src/services/PaymentService.ts:56-58`, `mobile-app/src/lib/tonconnect/deepLink.ts:73`

`returnUrl` is accepted from the caller, embedded into the deep link, and surfaced back via `parseTonLink` without scheme/host validation. If a consumer follows the parsed `returnUrl` for post-payment navigation, an attacker-supplied value (e.g. `javascript:` or an arbitrary external origin) becomes an open-redirect / unsafe-navigation vector.

Suggested fix: allowlist permitted schemes (`https:` and known wallet/app schemes) and, where applicable, hosts before embedding or following `returnUrl`; reject anything else.

Acceptance criteria:
- [ ] `returnUrl` is validated against a scheme (and host where applicable) allowlist before being embedded or followed.
- [ ] Regression test: a `javascript:`/disallowed-host `returnUrl` is rejected.

### L3. Weak HTTPS check uses a string prefix rather than URL protocol parsing

Affected: `mobile-app/src/lib/network/httpsClient.ts:29`, `mobile-app/src/lib/network/httpsClient.ts:57-60`

```ts
// mobile-app/src/lib/network/httpsClient.ts:29,58
const HTTPS_PREFIX = 'https://';
// ...
if (!url.startsWith(HTTPS_PREFIX)) {
  throw new HttpsOnlyError(url);
}
```

A `startsWith` prefix check is brittle: it does not normalize case, leading/trailing whitespace, or backslash variants that some URL parsers tolerate, and it diverges from the parsed-protocol semantics used elsewhere in the same function (`new URL(url).hostname`). The protocol should be determined by parsing.

Suggested fix: parse with `new URL(url)` and require `parsed.protocol === 'https:'`; reject on parse failure.

Acceptance criteria:
- [ ] HTTPS enforcement is based on the parsed URL `protocol`, not a string prefix.
- [ ] Regression test: case/whitespace/backslash-obfuscated non-HTTPS URLs are rejected; valid `https:` URLs pass.

### L4. nftAddress / recipient interpolated into links unencoded

Affected: `dashboard/src/utils.ts:104`, `mobile/src/services/PaymentService.ts:54`, `mobile-app/src/lib/tonconnect/deepLink.ts:50`

The recipient/NFT address is interpolated into `ton://` and universal links without encoding. This is the lower-impact counterpart to FRONTEND-H1/H2 (the address charset is narrower, but consistency matters and a malformed/attacker-influenced address should not be able to alter link structure). In `deepLink.ts:50` the address is also concatenated into the universal `walletLink`.

Suggested fix: encode the address consistently (`encodeURIComponent`) and validate it as a TON address (`isValidTonAddress`) before use, as part of the H1/H2 remediation.

Acceptance criteria:
- [ ] The address is validated as a TON address and encoded before interpolation in every link builder.
- [ ] Regression test: an address containing structure-breaking characters is rejected or safely encoded.

### L5. wallet-ui restores a saved address from storage without re-validating it

Affected: `wallet-ui/src/tonconnect/connector.ts:273-290`

`loadState` deserializes the persisted session and trusts `parsed.address` if the `status` field is recognized, without re-validating the address:

```ts
// wallet-ui/src/tonconnect/connector.ts:277-285
const parsed = JSON.parse(raw) as ConnectionState;
if (
  parsed &&
  (parsed.status === 'pending' ||
    parsed.status === 'connected' ||
    parsed.status === 'disconnected')
) {
  return parsed;
}
```

`localStorage` is attacker-writable in the browser (XSS, shared device, devtools). A tampered `address` is then exposed via `getState()` and used by the UI as the connected wallet address without a parse/checksum check.

Suggested fix: re-validate the restored `address` (parse + checksum via `@ton/core`) before trusting it; on failure, drop the session and return `disconnected`.

Acceptance criteria:
- [ ] A restored session with a malformed/invalid `address` is treated as `disconnected`.
- [ ] The restored `address` is parse/checksum-validated before exposure via `getState()`.
- [ ] Regression test: a tampered persisted address causes `loadState` to discard the session.

## Impact

Individually low; collectively these are input-validation and hygiene gaps that can corrupt displayed/parsed data (L1), enable unsafe navigation (L2), weaken transport assertions (L3), allow structurally malformed links (L4), or trust tampered storage (L5). None affect the non-custodial guarantee, but they should be resolved as production hardening.

## Suggested Fix

Address each subsection per its stated fix. L4 should be folded into the FRONTEND-H1/H2 remediation. Track the rest as a hardening backlog.

## Acceptance Criteria

- [ ] L1 resolved (single decode in `parseTonLink`).
- [ ] L2 resolved (`returnUrl` scheme/host allowlist).
- [ ] L3 resolved (protocol-parsed HTTPS enforcement).
- [ ] L4 resolved (address validated and encoded in all link builders).
- [ ] L5 resolved (restored address re-validated before trust).
- [ ] All fixes preserve the non-custodial property (no key handling/signing introduced).
- [ ] Regression tests added for each item as listed in its subsection.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-H1-dashboard-invoice-link-param-injection.md`, `audit/findings/FRONTEND-H2-mobile-payment-link-param-injection.md`, `audit/findings/FRONTEND-M4-certificate-pinning-compares-wrong-value.md`
- `audit/THREAT_MODEL.md`
- `audit/INVARIANTS.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#300](https://github.com/xlabtg/tonbankcard-protocol/issues/300)
