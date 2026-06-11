# Issue #378 / PC-09 — Mobile client hardening

Minimal, self-contained reproduction of the **PC-09** finding — three
independent low-severity weaknesses in the mobile clients. Each is shown
**before** (a faithful copy of the pre-fix code) versus **after** (the **real,
fixed** module imported from the workspace, exactly like the PC-05 reproduction
drives the real widget).

## 1. Unencoded path interpolation (`mobile/` services)

`PaymentService` / `AccountService` interpolated the caller-supplied identifier
straight into the request URL:

```ts
// pre-fix
const response = await fetch(`${this.config.apiEndpoint}/transactions/${nftAddress}`);
```

A value containing URL-significant characters (`/`, `?`, `&`, `#`) escapes its
path segment. For example `nftAddress = "../admin?inject=1&x=2"` yields
`https://api.example.com/transactions/../admin?inject=1&x=2`, walking the path
and smuggling attacker-controlled query parameters into the API call. The fix
wraps each interpolated id in `encodeURIComponent(...)`, mirroring the sibling
`mobile-app/` convention.

## 2. Weak HTTPS check (`mobile-app/src/lib/config.ts`)

`assertHttpsEndpoint` enforced HTTPS with a case-sensitive prefix test:

```ts
// pre-fix
const HTTPS_PREFIX = 'https://';
if (!url.startsWith(HTTPS_PREFIX)) { throw ... }
```

This is a **false negative** for a valid mixed-case `HTTPS://…` URL and never
parses the URL, so it cannot reason about malformed input. The fix parses the
URL with the WHATWG `URL` constructor and checks the normalized
`protocol === 'https:'`, guarded by try/catch — mirroring the HTTPS-only guard
already enforced by `HttpsClient.fetch`.

## 3. No-op `autoVerify` (`mobile-app/android/.../AndroidManifest.xml`)

The manifest set `android:autoVerify="true"` on the custom `tonbankcard`-scheme
intent-filter. Android App Links verification only runs for **http/https** data
schemes, so on a custom scheme it is a no-op that implies a verification
guarantee that does not exist. The fix removes it (with a comment explaining how
to add a real http/https App Links filter if ever needed).

## What `mobile-client-hardening.repro.spec.ts` proves

| Weakness | Before the fix | After the fix (real module) |
| --- | --- | --- |
| URL encoding | `…/transactions/../admin?inject=1` ❌ | `…/transactions/..%2Fadmin%3Finject%3D1%26x%3D2` ✅ |
| HTTPS check | rejects valid `HTTPS://…` ❌ | accepts `HTTPS://…`, rejects `ftp:`/`javascript:`/malformed ✅ |
| `autoVerify` | `autoVerify="true"` on custom scheme ❌ | absent on the custom-scheme filter ✅ |

The "after" columns import the live `PaymentService`, `AccountService` and
`assertHttpsEndpoint`, and parse the real `AndroidManifest.xml`, so the contrast
is against current code.

## Run it

```bash
cd experiments/issue-378-mobile-client-hardening
npm install
npm test
```

The CI-enforced regressions live in the packages themselves:

- `mobile/tests/payment-service.spec.ts` &
  `mobile/tests/account-service.spec.ts` —
  `describe('… request URL hardening (PC-09)')`, job *Test mobile-core*.
- `mobile-app/tests/config/config.spec.ts` —
  `describe('assertHttpsEndpoint')` mixed-case / malformed cases, and
  `mobile-app/tests/android/manifest.spec.ts` —
  `describe('AndroidManifest deep-link intent-filters (PC-09)')`, job
  *Test mobile-app*.

This directory is the self-contained before/after demonstration that accompanies
the audit finding.

## Notes

This is an authorized internal audit reproduction. No secrets or real customer
data are used; all inputs are synthetic.
