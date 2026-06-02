---
title: "[DEVOPS-M1] Third-party actions pinned to mutable tags, not commit SHAs"
severity: medium
area: devops
priority: medium
stage: 3
labels: ["bug","audit","type:tooling","type:security","priority:medium","stage:3-medium"]
---

## Summary

Third-party GitHub Actions are referenced by mutable version tags rather than full commit SHAs. A tag can be silently re-pointed by the upstream maintainer (or an attacker who compromises the upstream repo), causing untrusted code to run in CI with repository and token access.

## Severity & Category

- Severity: Medium
- Category: Supply-Chain / Action Pinning

## Affected Code

- `.github/workflows/ci.yml:430` (`uses: amondnet/vercel-action@v42`)
- `.github/workflows/pypi-publish.yml:61` (`uses: pypa/gh-action-pypi-publish@release/v1`)

## Description

These third-party actions are pinned to mutable refs:

```yaml
# .github/workflows/ci.yml
        uses: amondnet/vercel-action@v42
```

```yaml
# .github/workflows/pypi-publish.yml
        uses: pypa/gh-action-pypi-publish@release/v1
```

A tag (`@v42`) or branch (`@release/v1`) can be moved to a new commit at any time. If the upstream is compromised or a maintainer publishes a malicious update under the same tag, CI will execute it on the next run.

Note: first-party `actions/*` references (`checkout`, `setup-node`, etc.) are lower risk as they are maintained by GitHub, but the same SHA-pinning discipline is recommended repo-wide. The `pypa/gh-action-pypi-publish` action runs in the OIDC-privileged publish job, making it the highest-value target to pin.

## Impact

- Untrusted upstream code can execute with the workflow's `GITHUB_TOKEN` and, for the PyPI job, the OIDC publishing identity.
- Builds become non-reproducible and non-auditable across time for the same tag.

## Suggested Fix

- Pin third-party actions to a full 40-character commit SHA, with a trailing comment naming the human-readable version, for example:

```yaml
        uses: amondnet/vercel-action@<full-sha>  # v42
        uses: pypa/gh-action-pypi-publish@<full-sha>  # release/v1
```

- Consider a tool such as Dependabot (actions ecosystem) or `pin-github-action` to keep SHAs updated with provenance.

## Acceptance Criteria

- [ ] All third-party actions are pinned to a full commit SHA with a version comment.
- [ ] The OIDC publish action in `pypi-publish.yml` is SHA-pinned.
- [ ] CI/verification: a lint/policy check (for example `actionlint` with a pinning ruleset) fails on any non-SHA third-party `uses:`.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#283](https://github.com/xlabtg/tonbankcard-protocol/issues/283)
