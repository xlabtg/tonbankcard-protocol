---
title: "[DEVOPS-M2] CI uses npm install instead of npm ci"
severity: medium
area: devops
priority: medium
stage: 3
labels: ["bug","audit","type:tooling","type:security","priority:medium","stage:3-medium"]
---

## Summary

Most install steps in the CI workflow run `npm install`, which can mutate the committed lockfile and resolve dependency versions not pinned by `package-lock.json`. This undermines reproducible, audit-verifiable builds — the very property the repo's `.gitignore` documents it wants from tracked lockfiles.

## Severity & Category

- Severity: Medium
- Category: Build Reproducibility / Supply-Chain

## Affected Code

- `.github/workflows/ci.yml` — `run: npm install` at lines 23, 63, 82, 101, 109, 128, 156, 164, 172, 184, 192, 223, 231, 239, 251, 259, 290, 298, 306, 318, 326 (and variants `npm install --ignore-scripts` / `--no-audit --no-fund`)
- A few steps already use `npm ci` (e.g. lines 44, 148, 215, 282)

## Description

CI install steps predominantly use `npm install`:

```yaml
      - name: Install dependencies
        run: npm install
```

`npm install` may update `package-lock.json` and resolve semver ranges to newer versions than the locked ones, so the dependency tree built in CI can differ from the committed lockfile. The repository explicitly tracks lockfiles for reproducibility:

```gitignore
# package-lock.json is tracked in every npm workspace so that `npm ci`
# yields a reproducible, audit-verifiable install. See
# docs/security/DEPENDENCY_AUDIT.md and issue #131.
```

`npm ci` honors the lockfile exactly, fails if `package.json` and the lockfile are out of sync, and does not mutate the lockfile — making it the correct CI install command. The inconsistency (some steps use `npm ci`, most use `npm install`) confirms the gap.

## Impact

- CI can install dependency versions that differ from the audited lockfile, defeating reproducibility and dependency-audit guarantees.
- Lockfile drift can mask the introduction of unexpected/compromised transitive versions.

## Suggested Fix

- Replace `npm install` with `npm ci` in every CI step where a `package-lock.json` exists.
- Where script execution must be suppressed, use `npm ci --ignore-scripts`.

## Acceptance Criteria

- [ ] All CI install steps with a lockfile use `npm ci` (optionally `--ignore-scripts`).
- [ ] No `npm install` remains in `ci.yml` for workspaces that track a lockfile.
- [ ] CI/verification: the workflow passes with `npm ci` and fails fast on lockfile drift.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `docs/security/DEPENDENCY_AUDIT.md`

---

**Tracking issue:** [#284](https://github.com/xlabtg/tonbankcard-protocol/issues/284)
