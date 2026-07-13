---
title: Faucet service ships no lockfile and is absent from all CI; dependency-audit matrix omits faucet, docs-site, and mobile-app
severity: Medium
area: tooling
priority: medium
stage: 3-medium
labels:
  - bug
  - audit
  - type:tooling
  - ci
  - priority:medium
  - stage:3-medium
  - track:C
---

## Summary

The `scripts/faucet` service is a full TypeScript app (`build`, `test`, `lint`,
`typecheck` scripts; a `tests/` suite; a Dockerfile) but it is **invisible to
CI**:

1. It has **no committed `package-lock.json`**, so its dependency tree is
   re-resolved on every build (non-reproducible, un-audited).
2. Its `Dockerfile` installs with `npm install` (twice), not `npm ci`. The
   existing PC-08 guard (`scripts/tooling/check-dockerfile-npm-ci.sh`)
   **explicitly skips** it precisely because it has no committed lockfile.
3. There is **no CI job** that builds, tests, lints, or typechecks the faucet —
   its `tests/` never run.
4. It is **absent from the `dependency-audit.yml` matrix**, so `npm audit`
   never runs against it.

Separately, `dependency-audit.yml` also omits **`docs-site`** and **`mobile-app`**
— both of which are shipped and both of which have committed `package-lock.json`
files — leaving two more packages unscanned for High/Critical advisories.

## Severity & Category

- Severity: Medium
- Category: CI/CD coverage gap / supply-chain reproducibility

## Affected Code

- `scripts/faucet/` — has `package.json` (with `build`/`test`/`lint`/`typecheck`
  scripts) and `tests/`, but **no** `package-lock.json`.
- `scripts/faucet/Dockerfile:16-17, 27-28` — two `npm install` steps, no
  `COPY package-lock.json`, no `npm ci`.
- `.github/workflows/ci.yml` — no faucet build/test job; the PC-08 guard
  (`ci.yml:47-48` → `scripts/tooling/check-dockerfile-npm-ci.sh:22-25`) skips the
  faucet by design because it lacks a lockfile.
- `.github/workflows/dependency-audit.yml:35-48` — matrix lists `sdk`, `api`,
  `indexer`, `wallet-ui`, `mobile`, `dashboard`; **missing** `faucet`,
  `docs-site`, `mobile-app`.

## Description

The faucet dispenses testnet TBC and handles signing-key material at runtime
(per its Dockerfile comments), yet none of its code is exercised or audited in
CI. Because it has no lockfile, even the guards that were introduced to enforce
reproducible, audited installs (`npm ci` in Dockerfiles, lockfile-vs-package.json
drift checks in `dependency-audit.yml`) cannot apply to it. A vulnerable
transitive dependency or a broken build in the faucet would ship undetected.

`docs-site` and `mobile-app` already carry committed lockfiles and are built in
`ci.yml`, but they are not in the `dependency-audit.yml` matrix, so `npm audit`
and the lockfile-tamper check never run for them.

## Impact

- Faucet dependency vulnerabilities and regressions are invisible to CI; its
  tests are dead weight that never execute.
- Non-reproducible faucet Docker images (fresh dependency resolution each build).
- Two shipped packages (`docs-site`, `mobile-app`) are excluded from the weekly
  `npm audit` advisory sweep.

## Suggested Fix

- Generate and **commit `scripts/faucet/package-lock.json`** (`npm install
  --package-lock-only`).
- Switch `scripts/faucet/Dockerfile` to `COPY package.json package-lock.json ./`
  + `npm ci` (both stages), bringing it under the PC-08 guard automatically.
- Add a faucet **build + test** job to `ci.yml` (`npm ci` → `npm run build` →
  `npm test`), mirroring the other package jobs.
- Add `faucet`, `docs-site`, and `mobile-app` to the `dependency-audit.yml`
  matrix.

## Acceptance Criteria

- [ ] `scripts/faucet/package-lock.json` is committed and `npm ci` succeeds in it.
- [ ] The faucet Dockerfile installs with `npm ci` and is no longer skipped by
      `check-dockerfile-npm-ci.sh`.
- [ ] A CI job builds and runs the faucet tests.
- [ ] `dependency-audit.yml` runs `npm audit` for faucet, docs-site, mobile-app.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- PC-08 guard: `scripts/tooling/check-dockerfile-npm-ci.sh`.
- Dependency-audit workflow: `.github/workflows/dependency-audit.yml` (issue #131).

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/411
