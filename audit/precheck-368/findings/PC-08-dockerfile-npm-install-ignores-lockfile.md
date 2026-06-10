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

## Acceptance Criteria

- [ ] `api/Dockerfile` and `backend/indexer/Dockerfile` copy the lockfile and use `npm ci`.
- [ ] The misleading comment is corrected.
- [ ] Image builds are reproducible against the committed lockfile.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
