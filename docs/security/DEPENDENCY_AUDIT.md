# Dependency Audit Report

> Source issue: [#131 — D5 Dependency Audit and Updates](https://github.com/xlabtg/tonbankcard-protocol/issues/131)
> Roadmap reference: [TEMP/DEVELOPMENT_ROADMAP.md — Track D, D5](../../TEMP/DEVELOPMENT_ROADMAP.md)
> Related security artefacts: [SECURITY.md](../../SECURITY.md), [docs/security/audits/](audits/)

## 0. Current control status (2026-08-13)

The CHECK423 audit re-ran `npm audit` against every shipped npm workspace with
a committed lockfile after fresh CI run
[31704315208](https://github.com/xlabtg/tonbankcard-protocol/actions/runs/31704315208)
failed. The historical seven-workspace matrix omitted `mobile-app` and
`docs-site`; both are now covered and a CI guard prevents future omissions.

| Workspace | Audit result after remediation | CI threshold |
|---|---:|---|
| `sdk` | 0 vulnerabilities | High |
| `api` | 0 vulnerabilities | High |
| `backend/indexer` | 0 vulnerabilities | High |
| `wallet-ui` | 0 vulnerabilities | High |
| `mobile` | 0 vulnerabilities | High |
| `mobile-app` | 0 vulnerabilities | High |
| `dashboard` | 0 vulnerabilities | High |
| `scripts/faucet` | 0 vulnerabilities | High |
| `docs-site` | 19 Moderate, 0 High, 0 Critical | High |

The docs-site High exception was removed in
[#429](https://github.com/xlabtg/tonbankcard-protocol/issues/429).
`image-size@2.0.2` had no patched release and its ICNS/JXL/HEIF parsers could
loop forever on crafted input. The site now uses a vendored, MIT-licensed
`@docusaurus/mdx-loader@3.10.2` with automatic image dimension parsing removed.
Webpack still resolves and emits local assets, but the build never reads image
bytes through `image-size`; that package is absent from the lockfile. The
`docs-site/tests/image-safety.test.mjs` regression test checks both properties.
The vendored loader should be removed when upstream Docusaurus no longer
depends on a vulnerable image parser.

The Dependabot control is active again after its accidental deletion. It checks
all nine shipped npm workspaces and GitHub Actions every Monday. Safe minor and
patch npm updates are grouped per workspace; major updates to the production
`sdk`, `api`, and `backend/indexer` packages are excluded from automation and
must be proposed and reviewed as separately scoped changes. The coverage guard
keeps the Dependabot and vulnerability-audit workspace lists synchronized.

## 1. Historical D5 scope (2026-05-17)

The sections below preserve the first end-to-end dependency audit of the six
runtime npm workspaces shipped by the TONBANKCARD protocol, the
remediation that was applied, and the controls that prevent the
problem from regressing.

| # | Workspace          | Path                | Role in protocol                                          |
|---|--------------------|---------------------|------------------------------------------------------------|
| 1 | `merchant-sdk`     | `sdk/`              | Non-custodial SDK distributed to merchants on npm.         |
| 2 | `merchant-api`     | `api/`              | Production merchant API (orchestration, webhooks).         |
| 3 | `payment-indexer`  | `backend/indexer/`  | Read-only payment-status indexer (production).             |
| 4 | `wallet-ui`        | `wallet-ui/`        | Presentational wallet components.                          |
| 5 | `mobile-core`      | `mobile/`           | Platform-agnostic mobile core logic.                       |
| 6 | `merchant-dashboard` | `dashboard/`      | Merchant monitoring dashboard.                             |

The smart-contract ecosystem (`contracts/payment-hub/`) and the
auxiliary Go / Python SDKs are explicitly **out of scope** for this
report — they use different package managers and are tracked by
parallel hardening tracks.

## 2. Method

For each workspace we performed the following sequence on
**2026-05-17** with `npm 11.13.0` and `Node 20.20.2`:

1. `npm install --package-lock-only --no-audit --no-fund` to materialise
   a deterministic dependency tree from the workspace's `package.json`.
2. `npm audit --audit-level=high --json` and `npm audit` to capture
   both machine- and human-readable findings. Raw reports were
   archived under
   [`docs/security/audit-reports/`](audit-reports/) for traceability.
3. Per-package remediation as described in §4 below.
4. Re-audit until `npm audit --audit-level=high` returned
   `found 0 vulnerabilities`.

The CI workflow [`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml)
now re-runs the audit and a lockfile-tamper check for all nine shipped locked
workspaces on every push, PR, and weekly cron. See the current exception and
results in §0; the figures below remain the original D5 snapshot.

## 3. Pre-remediation findings

The `npm audit` output (saved verbatim in `docs/security/audit-reports/<workspace>.txt`)
classified the following vulnerabilities at **High** or **Critical**
severity. Counts below come directly from `npm audit` summary lines.

| Workspace          | Critical | High | Moderate | Low | Total |
|--------------------|----------|------|----------|-----|-------|
| `sdk`              | 1        | 10   | 3        | 0   | 14    |
| `api`              | 0        | 6    | 0        | 0   | 6     |
| `backend/indexer`  | 0        | 6    | 0        | 0   | 6     |
| `wallet-ui`        | 0        | 8    | 0        | 0   | 8     |
| `mobile`           | 0        | 8    | 0        | 0   | 8     |
| `dashboard`        | 0        | 8    | 0        | 0   | 8     |

### 3.1 Critical (single advisory)

* **handlebars `4.0.0 – 4.7.8`** — JavaScript injection through several
  AST gadgets, partial template injection, and CLI precompiler issues.
  Pulled in transitively through `ts-jest → handlebars`.
  Advisories: GHSA-3mfm-83xf-c92r, GHSA-2w6w-674q-4c4q,
  GHSA-2qvq-rjwj-gvw9, GHSA-7rx3-28cr-v5wh, GHSA-442j-39wm-28r2,
  GHSA-xhpv-hc6g-r9c6, GHSA-9cx6-37pm-9jff, GHSA-xjpj-3mr7-gcpf.

### 3.2 High (recurring across multiple workspaces)

| Package                          | Range             | Impact                                                 | Pulled in via                              |
|----------------------------------|-------------------|--------------------------------------------------------|---------------------------------------------|
| `axios`                          | `1.0.0 – 1.15.1`  | SSRF, prototype-pollution, header injection (× 16 advs) | `@ton/ton`                                 |
| `path-to-regexp`                 | `< 0.1.13`        | ReDoS via repeated parameters                          | `express 4.21.2`                            |
| `qs`                             | `<= 6.14.1`       | DoS via array/comma parsing                            | `express 4.21.2`                            |
| `body-parser`                    | `1.19.0 – 1.20.3` | Transitively vulnerable through `qs`                    | `express 4.21.2`                            |
| `minimatch`                      | `9.0.0 – 9.0.6`   | ReDoS via nested wildcards                              | `@typescript-eslint/* @ 6.x`                |
| `flatted`                        | `<= 3.4.1`        | Unbounded recursion DoS, prototype pollution            | `eslint 8.56.x`                             |
| `rollup`                         | `4.0.0 – 4.58.0`  | Arbitrary file write via path traversal                 | `tsup 8.0.x`                                |
| `picomatch`                      | `<= 2.3.1`        | Method injection, ReDoS                                 | `tsup`, `jest`                              |

### 3.3 Moderate / Low

Moderate findings (`ajv`, `brace-expansion`, `follow-redirects`) and
the single low-severity body-parser advisory were folded into the same
remediation pass because the upstream fixes ship together.

## 4. Remediation

The protocol does not currently pull most vulnerable packages as
**direct** dependencies — the exposure comes from outdated transitive
versions. Three remediation techniques were used in combination:

1. **Direct dependency pinning** (`sdk/`, `api/`, `backend/indexer/`):
   every entry in `dependencies` and `devDependencies` was rewritten
   from a caret/tilde range to an **exact** version. This eliminates
   silent install drift for the three production-facing packages.
   See issue #131 §3 "Dependency Pinning".

2. **`overrides` block** (every workspace): a top-level
   [`overrides`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides)
   block forces npm to resolve known-vulnerable transitive packages to
   a patched version regardless of how deep in the tree they appear:

   ```json
   "overrides": {
     "axios": "^1.16.1",
     "handlebars": "^4.7.9",
     "minimatch": "^9.0.7",
     "brace-expansion": "^2.0.3",
     "flatted": "^3.4.2",
     "follow-redirects": "^1.16.0",
     "picomatch": "^2.3.2",
     "rollup": "^4.60.4",
     "ajv": "^6.15.0"
   }
   ```

3. **Tooling upgrades**: `@typescript-eslint/{eslint-plugin,parser}`
   were upgraded from the vulnerable `^6.x` line to `^8.59.3`, and
   `eslint` to `^8.57.1`, which is the minimum version compatible with
   the typescript-eslint v8 peer range. `tsup` was bumped to `^8.5.1`
   so it picks up the patched `rollup`/`picomatch` versions.

### 4.1 Express upgrade (api & indexer)

Even after the overrides, `express 4.21.2` still exposed
`path-to-regexp <0.1.13` and `qs <=6.14.1`. The upstream `express`
project shipped fixes in `4.22.0`+, so both production workspaces were
pinned to **`express 4.22.2`**.

### 4.2 Node-side @ton/* alignment

`@ton/ton@16.x` requires `@ton/core >=0.63.0`, which is incompatible
with the SDK's existing `@ton/core@0.56.x` integration. To avoid an
unrelated breaking change, the SDK and indexer pin to the latest of
the `13.x` line of `@ton/ton` (`13.11.2`) and `0.56.x` of `@ton/core`
(`0.56.3`). When the protocol migrates to `@ton/ton@16.x` a follow-up
PR will revisit these pins.

## 5. Post-remediation state

Re-running `npm audit --audit-level=high` after step 4 produced
`found 0 vulnerabilities` in **every** workspace:

```
=== sdk ===              found 0 vulnerabilities
=== api ===              found 0 vulnerabilities
=== backend/indexer ===  found 0 vulnerabilities
=== wallet-ui ===        found 0 vulnerabilities
=== mobile ===           found 0 vulnerabilities
=== dashboard ===        found 0 vulnerabilities
```

The lockfiles (`<workspace>/package-lock.json`) are now committed to
the repository so that `npm ci` is fully reproducible and so the
GitHub UI surfaces the resolved transitive graph alongside the source
code.

## 6. Continuous controls

| Control                                          | Where                                                              | Triggers on                                       |
|--------------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------|
| `npm audit` for all nine shipped locked workspaces | [`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml) | every push to `main`, every PR, weekly cron; High threshold in every workspace |
| Lockfile-tamper detection                        | same workflow, diff of regenerated `package-lock.json`              | every push / PR — fails CI on drift                |
| Audit-matrix completeness guard                  | [`scripts/tooling/check-dependency-audit-coverage.sh`](../../scripts/tooling/check-dependency-audit-coverage.sh) | every CI run; fails if a shipped locked workspace is omitted |
| Weekly dependency PRs                            | [`.github/dependabot.yml`](../../.github/dependabot.yml) | every Monday; grouped minor/patch updates for all nine npm workspaces, separate GitHub Actions updates; production major updates require explicit review |
| Node LTS pinning                                 | `engines.node: ">=20.0.0"` in every `package.json`                  | every `npm install`                                |

## 7. Pinned versions (rationale)

The following pins are deliberately conservative and should not be
relaxed without re-running the audit:

| Package                         | Pinned to | Reason                                                                                    |
|---------------------------------|-----------|--------------------------------------------------------------------------------------------|
| `@ton/core` (sdk, indexer)      | `0.56.3`  | Last `0.56.x`; required by current protocol integration. Bump together with `@ton/ton`.     |
| `@ton/crypto` (sdk, indexer)    | `3.3.0`   | Latest stable `3.x`; no advisories.                                                          |
| `@ton/ton` (sdk, indexer)       | `13.11.2` | Latest `13.x`; `16.x` requires `@ton/core>=0.63.0` (see §4.2).                              |
| `express` (api, indexer)        | `4.22.2`  | First `4.x` line that pulls patched `path-to-regexp`, `qs`, `body-parser`.                  |
| `axios` (override, all)         | `^1.16.1` | First minor that ships the full GHSA-pmwg-cvhr-8vh7 fix chain.                              |
| `handlebars` (override, all)    | `^4.7.9`  | First minor without the critical AST type-confusion family.                                  |
| `minimatch` (override, all)     | `^9.0.7`  | First `9.x` without the GLOBSTAR ReDoS triad.                                                |
| `rollup` (override, ui pkgs)    | `^4.60.4` | First minor that fixes GHSA-mw96-cpmx-2vgc path-traversal.                                   |
| `@typescript-eslint/*` (all)    | `^8.59.3` | Drops the vulnerable `minimatch@9.0.x`; first major that supports ESLint 8.57+.              |

## 8. Acceptance criteria

The acceptance criteria from issue #131 §8 map to artefacts in this
PR as follows:

* [x] `npm audit` run for all 6 packages and results documented — §3
  + [`audit-reports/`](audit-reports/).
* [x] All Critical and High vulnerabilities remediated — §5.
* [x] Direct dependencies in `sdk/`, `api/`, `backend/indexer/` pinned
  to exact versions — verifiable via
  `jq '.dependencies' sdk/package.json` etc.
* [x] All `package-lock.json` files committed and up to date — see
  `git ls-files '**/package-lock.json'`.
* [x] `.github/dependabot.yml` covers all nine shipped npm workspaces and GitHub
  Actions; the CI coverage guard prevents drift from the audit matrix.
* [x] CI step added to run `npm audit --audit-level=high` for all
  packages —
  [`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml).
* [x] `docs/security/DEPENDENCY_AUDIT.md` created with findings and
  resolutions — this document.
* [x] `engines.node` field updated in all `package.json` files —
  `>=20.0.0` (current LTS).
