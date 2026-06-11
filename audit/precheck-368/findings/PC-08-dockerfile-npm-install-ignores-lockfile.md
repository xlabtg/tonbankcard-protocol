---
title: API & indexer Dockerfiles run `npm install` and ignore the committed lockfile, breaking reproducible builds
severity: Medium
area: devops
priority: medium
stage: 3-medium
labels:
  - bug
  - type:tooling
  - type:dependencies
  - priority:medium
  - audit
  - stage:3-medium
---

## Summary

`api/Dockerfile` and `backend/indexer/Dockerfile` copy only `package.json` and run `npm install`, which resolves dependency versions fresh and ignores the committed `package-lock.json`. The `api/Dockerfile` comment even claims the lockfile is "intentionally excluded from version control per .gitignore" — but the lockfile **is** tracked, and the root `.gitignore` explicitly documents that `package-lock.json` is tracked in every workspace so that `npm ci` works. The image builds are therefore non-reproducible and the comment is factually wrong.

## Severity & Category

- Severity: Medium
- Category: Supply chain / Build reproducibility

## Affected Code

- `api/Dockerfile:24-27` (misleading comment + `COPY package.json ./` + `npm install`)
- `api/Dockerfile:36-37` (prod re-install also via `npm install`)
- `backend/indexer/Dockerfile:30-31` (`COPY package.json ./` + `npm install`)
- `.gitignore:12` (documents that `package-lock.json` is tracked for `npm ci`)
- Tracked: `api/package-lock.json`, `backend/indexer/package-lock.json`

## Description

```dockerfile
# Install dependencies (use package.json only; lockfile is intentionally
# excluded from version control per .gitignore — see CONTRIBUTING).
COPY package.json ./
RUN npm install --no-audit --no-fund
```

The lockfile is committed (`git ls-files` lists `api/package-lock.json` and `backend/indexer/package-lock.json`), and `.gitignore:12` states it is tracked precisely so `npm ci` can produce reproducible installs. By copying only `package.json` and running `npm install`, the Docker build re-resolves the dependency graph, potentially pulling newer transitive versions than were tested — an avoidable supply-chain and reproducibility risk.

Note: `scripts/faucet/Dockerfile` has no committed lockfile, so it is out of scope for this finding.

## Impact

- Docker images may contain dependency versions different from those locked/tested, surfacing as "works on CI, breaks in image" drift and widening the supply-chain attack surface.
- The misleading comment will cause future maintainers to perpetuate the mistake.

## Suggested Fix

- Copy the lockfile and use `npm ci`:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
```

- For the production stage, use `npm ci --omit=dev`.
- Correct the comment in `api/Dockerfile` to reflect that the lockfile is tracked.

## Resolution

**RESOLVED ✅ (Issue #377 / PC-08)** — PR
[#391](https://github.com/xlabtg/tonbankcard-protocol/pull/391), branch
`issue-377-e0c3fdf0eaa2`.

Both images are now built from the committed lockfile via `npm ci`, so the
dependency tree in the image matches the exact, audited `package-lock.json`
instead of a freshly re-resolved one:

1. **Lockfile copied, `npm ci` everywhere.** `api/Dockerfile` and
   `backend/indexer/Dockerfile` now `COPY package.json package-lock.json ./` and
   install with `npm ci --no-audit --no-fund` in the builder stage. In
   `api/Dockerfile` the production-only re-install switched from
   `rm -rf node_modules && npm install --omit=dev` to
   `npm ci --omit=dev --no-audit --no-fund` (npm ci already wipes
   `node_modules`), so the runtime layer is reproducible too. The indexer keeps
   its deterministic `npm prune --omit=dev` on top of the locked install. No bare
   `npm install` remains for dependency installation in either file.
2. **Misleading comment corrected.** The `api/Dockerfile` comment no longer
   claims the lockfile is "intentionally excluded from version control"; both
   Dockerfiles now state that `package-lock.json` is tracked in every workspace
   precisely so `npm ci` yields a reproducible install.

`scripts/faucet/Dockerfile` is unchanged — it ships no committed lockfile and is
explicitly out of scope per the finding.

**CI-enforced policy** — `scripts/tooling/check-dockerfile-npm-ci.sh` (job
*infra-verify*, `.github/workflows/ci.yml`) scans every tracked Dockerfile,
selects those whose build context ships a committed `package-lock.json` and that
touch npm, and asserts each one: COPYs `package-lock.json`, installs with
`npm ci`, runs no bare `npm install`/`npm i` (global installs excepted), and is
not undercut by a `.dockerignore` that drops the lockfile. It sits alongside the
sibling guard `scripts/tooling/check-ci-npm-ci.sh` (which enforces the same for
CI workflows). A standalone before/after reproduction — showing `npm install`
drifting to a newer in-range version while `npm ci` honours the locked one —
lives in `experiments/issue-377-dockerfile-npm-install/`.

## Acceptance Criteria

- [x] `api/Dockerfile` and `backend/indexer/Dockerfile` copy the lockfile and use `npm ci`.
- [x] The misleading comment is corrected.
- [x] Image builds are reproducible against the committed lockfile.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
