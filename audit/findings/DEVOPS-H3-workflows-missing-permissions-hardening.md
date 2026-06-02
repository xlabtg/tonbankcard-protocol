---
title: "[DEVOPS-H3] Five GitHub Actions workflows lack least-privilege permissions"
severity: high
area: devops
priority: high
stage: 2
labels: ["bug","audit","type:tooling","type:security","priority:high","stage:2-high"]
---

## Summary

Five workflows declare no top-level `permissions:` block, so the `GITHUB_TOKEN` for those runs defaults to the repository/organization-wide default scope (which can include `contents: write` and more). A compromised step or dependency in any of these workflows could use the broadly scoped token to push commits, alter releases, or tamper with the repository.

## Severity & Category

- Severity: High
- Category: CI/CD Token Scoping / Supply-Chain Hardening

## Affected Code

- `.github/workflows/ci.yml` (no `permissions:` block)
- `.github/workflows/sdk-python.yml` (no `permissions:` block)
- `.github/workflows/sdk-go.yml` (no `permissions:` block)
- `.github/workflows/quickstart.yml` (no `permissions:` block)
- `.github/workflows/openapi-lint.yml` (no `permissions:` block)

## Description

None of the five workflows above declare a `permissions:` key at the workflow or job level. When absent, the effective `GITHUB_TOKEN` permissions fall back to the repository default, which is frequently the legacy broad/`read-write` default.

For contrast, the publish and audit workflows are already hardened:

```yaml
# .github/workflows/docs-site.yml
permissions:
  contents: read
```

```yaml
# .github/workflows/dependency-audit.yml
permissions:
  contents: read
```

```yaml
# .github/workflows/npm-publish-sdk.yml
permissions:
  contents: read
  id-token: write
```

The five listed workflows should follow the same least-privilege pattern.

Positive note: no script-injection sinks were found in these workflows (no untrusted `${{ github.event.* }}` interpolated into `run:` blocks), and shell steps consistently use `set -euo pipefail`.

## Impact

- A malicious or compromised action/dependency in these workflows inherits a broadly scoped token.
- With `contents: write` it could push to branches, modify tags/releases, or poison build artifacts.

## Suggested Fix

- Add a top-level least-privilege block to each of the five workflows:

```yaml
permissions:
  contents: read
```

- Elevate scopes only on the specific jobs that need them (for example `id-token: write` for OIDC publish jobs, `packages: write` for registry pushes).

## Acceptance Criteria

- [ ] Each of `ci.yml`, `sdk-python.yml`, `sdk-go.yml`, `quickstart.yml`, `openapi-lint.yml` declares `permissions: contents: read` at the top level.
- [ ] Any elevated scope is granted per-job, not globally.
- [ ] CI/verification: a workflow-lint check (for example `actionlint` or a policy script) asserts every workflow declares an explicit `permissions:` block.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `.github/workflows/docs-site.yml` (reference hardened workflow)

---

**Tracking issue:** [#263](https://github.com/xlabtg/tonbankcard-protocol/issues/263)
