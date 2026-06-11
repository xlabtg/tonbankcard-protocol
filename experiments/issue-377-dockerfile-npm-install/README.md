# Issue #377 / PC-08 — Dockerfiles run `npm install` and ignore the committed lockfile

Minimal, self-contained reproduction of the **PC-08** finding: `api/Dockerfile`
and `backend/indexer/Dockerfile` copied only `package.json` and installed with
`npm install`, so the image was built from a freshly **re-resolved** dependency
tree instead of the exact, audit-verified tree pinned in the committed
`package-lock.json`:

```dockerfile
# pre-fix
COPY package.json ./
RUN npm install --no-audit --no-fund   # re-resolves every range; lockfile ignored
```

Because the lockfile is never copied into the build context, `npm install` is
free to pick the newest version satisfying each range in `package.json`. A
dependency that publishes a new release between the audit and the build silently
enters the image, so two builds of the same commit can ship **different** code —
the opposite of a reproducible build. The `api/Dockerfile` comment even claimed
the lockfile was *"intentionally excluded from version control per .gitignore"*,
which is false: `package-lock.json` is tracked in every workspace.

The fix copies the lockfile and installs with `npm ci`, which installs the
locked tree verbatim and fails fast when `package.json` and `package-lock.json`
drift:

```dockerfile
# post-fix
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund        # honours the lockfile exactly
```

## What `dockerfile-lockfile.repro.sh` proves

The script asserts both the underlying npm behaviour and the repository state,
exiting non-zero unless the drift reproduces **before** and is closed **after**.

- **Criterion 1 — runtime drift (needs npm + registry).** A synthetic workspace
  declares `left-pad: ^1.1.3` and commits a lockfile that pins the *older*
  in-range `1.1.3`. `left-pad` is dependency-free and frozen since 2016, so its
  `1.3.0` latest is a stable drift target. The script then mirrors the Dockerfile
  COPY semantics:
  - **BEFORE** build context = `package.json` only → `npm install` installs
    **1.3.0** (the newest in range), *not* what was locked.
  - **AFTER** build context = `package.json` + lockfile → `npm ci` installs
    exactly **1.1.3**, the audited version.
  - **CONTROL** `npm ci` with no lockfile **refuses to run** — which is exactly
    why the old Dockerfiles "worked around" the missing COPY with `npm install`.
- **Criterion 2 — repository state (always runs, no network).**
  `api/Dockerfile` and `backend/indexer/Dockerfile` COPY `package-lock.json`,
  install with `npm ci`, and no longer run `npm install` for dependencies.

| Build context | Install command | Resolved `left-pad` |
| --- | --- | --- |
| **Before the fix** — `package.json` only ❌ | `npm install` | **1.3.0** — re-resolved, unaudited ❌ |
| **After the fix** — `package.json` + lockfile ✅ | `npm ci` | **1.1.3** — exactly as locked ✅ |

Observed output:

```
  lockfile pins left-pad@1.1.3 (package.json range stays ^1.1.3)
  BEFORE 'COPY package.json' + npm install => left-pad@1.3.0
  AFTER  'COPY …+lockfile'   + npm ci      => left-pad@1.1.3
  CONTROL npm ci without a lockfile        => exit 1 (refuses)
  ✓ BEFORE: npm install pulled 1.3.0, NOT the locked 1.1.3 — drift reproduced
  ✓ AFTER: npm ci installed exactly the locked 1.1.3 — reproducible
  ✓ CONTROL: npm ci refuses without a lockfile (so the old COPY forced npm install)
  ✓ api/Dockerfile: COPYs package-lock.json into the build
  ✓ api/Dockerfile: installs with npm ci
  ✓ api/Dockerfile: no npm install for dependencies
  ✓ backend/indexer/Dockerfile: COPYs package-lock.json into the build
  ✓ backend/indexer/Dockerfile: installs with npm ci
  ✓ backend/indexer/Dockerfile: no npm install for dependencies
RESULT: PC-08 reproduced (npm install drifts) and confirmed fixed (npm ci + lockfile). ✅
```

## Run it

```bash
experiments/issue-377-dockerfile-npm-install/dockerfile-lockfile.repro.sh
```

Criterion 1 requires npm and access to the public registry (it builds a
throwaway lockfile fixture in a temp dir, cleaned up on exit). If npm or the
registry is unavailable that criterion prints `SKIP`; Criterion 2 still runs
against the committed Dockerfiles.

The CI-enforced regression lives in
`scripts/tooling/check-dockerfile-npm-ci.sh` (job *infra-verify*), which scans
every tracked Dockerfile whose build context ships a committed
`package-lock.json` and asserts it COPYs the lockfile, installs with `npm ci`,
runs no bare `npm install`, and is not undercut by a `.dockerignore` that drops
the lockfile. This directory is the self-contained before/after demonstration
that accompanies the finding.

## Notes

This is an authorized internal audit reproduction. No secrets or real data are
used; `left-pad` is a tiny, dependency-free public package used only as a stable
version-drift fixture.
