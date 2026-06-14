# Issue #399 — Off-chain & tooling hardening backlog (round 3)

Two independent low-severity findings, each reproduced below.

## Finding 1 — mobile manifest HTTPS check used a literal prefix match

`mobile-app/src/lib/tonconnect/manifest.ts` validated the TON Connect manifest
URLs with `url.startsWith('https://')` instead of parsing the URL. A literal
prefix check diverges from what a real wallet (and the sibling wallet-ui
validator) does:

| input                     | `startsWith('https://')` | `new URL(...).protocol === 'https:'` |
| ------------------------- | :----------------------: | :----------------------------------: |
| `https://x.app`           | accept                   | accept                               |
| `HTTPS://x.app`           | **reject** (wrong)       | accept                               |
| `Https://x.app`           | **reject** (wrong)       | accept                               |
| `  https://x.app`         | **reject** (wrong)       | accept                               |
| `https://`                | **accept** (wrong)       | reject                               |
| `https://#frag`           | **accept** (wrong)       | reject                               |

The URL scheme is case-insensitive per the WHATWG/RFC 3986 spec, so the prefix
check wrongly rejects legitimate `HTTPS://` manifests; conversely it wrongly
accepts host-less `https://` strings that no wallet can resolve, so the gate
disagrees with the wallet that actually opens the session.

**Fix:** parse with the `URL` constructor and assert `protocol === 'https:'`,
mirroring `wallet-ui/src/tonconnect/manifest.ts`. Regression tests live in
`mobile-app/tests/tonconnect/manifest.spec.ts`.

```bash
node reproduce-manifest.mjs   # prints the divergence table above
```

## Finding 2 — docs-site CI install drifted back to `npm install`

`.github/workflows/docs-site.yml` installed the Docusaurus dependencies with
`npm install --no-audit --no-fund`, even though `docs-site/package-lock.json` is
committed. `npm install` re-resolves the dependency graph and can silently
update the lockfile, defeating reproducible, audit-verified builds — the exact
DEVOPS-M2 finding (#284) that `npm ci` was adopted to prevent everywhere else.

The DEVOPS-M2 policy guard `scripts/tooling/check-ci-npm-ci.sh` only scanned
`ci.yml`, so the sibling `docs-site.yml` drifted unguarded.

**Fix:**
- `docs-site.yml` now runs `npm ci --no-audit --no-fund`.
- `check-ci-npm-ci.sh` now scans **every** `.github/workflows/*.yml`, so the
  finding cannot recur in any workflow whose working directory ships a lockfile.

```bash
bash reproduce-docs-site.sh   # asserts the guard flags npm install, passes on npm ci
```
