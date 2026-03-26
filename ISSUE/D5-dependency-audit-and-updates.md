---
name: "[D5] Dependency Audit and Updates"
about: Run npm audit across all packages, pin critical dependencies, and set up Dependabot
labels: type:backend
track: D
priority: high
---

## 1. Goal

Run `npm audit` across all 6 packages to identify and remediate known vulnerabilities, pin critical dependency versions to prevent supply-chain attacks, and set up automated dependency update tooling (Dependabot or Renovate).

## 2. Context

The protocol has 6 npm packages with their own dependency trees. Without regular auditing and pinning, any of these packages could be silently compromised by a malicious dependency update (supply-chain attack) or by a known vulnerability in an unpinned transitive dependency.

This is especially important for `sdk/` which is distributed to merchants and runs in their production environments.

Related to: [DEVELOPMENT_ROADMAP.md — Track D, D5](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Dependency Audit
- Run `npm audit` in each of the 6 package directories:
  - `sdk/`
  - `api/`
  - `backend/indexer/`
  - `wallet-ui/`
  - `mobile/`
  - `dashboard/`
- Document findings in `docs/security/DEPENDENCY_AUDIT.md`
- Remediate all Critical and High severity findings

### Dependency Pinning
- Pin direct dependencies to exact versions (`x.y.z` not `^x.y.z`) for:
  - `sdk/` (distributed to external developers)
  - `api/` (production service)
  - `backend/indexer/` (production service)
- Use lock files (`package-lock.json`) committed to the repository for all packages

### Automated Updates
- Set up `.github/dependabot.yml` to:
  - Check for npm dependency updates weekly
  - Auto-create PRs for minor and patch updates
  - Require manual review for major version updates
  - Target all 6 package directories

### Node.js Version Constraints
- Review and update `engines.node` field in all `package.json` files
- Ensure compatibility with current Node.js LTS (v20.x)

## 4. Out of Scope

- Smart contract dependency management (different ecosystem)
- Third-party infrastructure (gateway APIs are external)
- Changing core functionality to avoid dependency updates

## 5. Functional Requirements

1. `npm audit` runs as part of CI for all 6 packages
2. CI fails if any Critical or High vulnerabilities are found
3. `dependabot.yml` configured for all 6 package directories
4. All `package-lock.json` files committed to the repository
5. `docs/security/DEPENDENCY_AUDIT.md` documents the audit results and actions taken

## 6. Non-Functional Requirements

- Dependabot PRs for minor/patch updates must auto-merge if CI passes (optional, configurable)
- `npm audit` in CI must not require internet access for the audit database (use `npm audit --audit-level=high`)
- Pinned versions must be documented with the reason for pinning in a comment or `docs/`

## 7. Security Requirements

- All Critical severity vulnerabilities must be remediated before any production deployment
- All High severity vulnerabilities must be remediated or formally accepted with written justification
- Lock files must be verified as part of CI (not regenerated during CI — detect tampering)
- `npm publish --provenance` for published packages (see C2)

## 8. Acceptance Criteria

- [ ] `npm audit` run for all 6 packages and results documented
- [ ] All Critical and High vulnerabilities remediated
- [ ] Direct dependencies in `sdk/`, `api/`, `backend/indexer/` pinned to exact versions
- [ ] All `package-lock.json` files committed and up to date
- [ ] `.github/dependabot.yml` created and targeting all 6 directories
- [ ] CI step added to run `npm audit --audit-level=high` for all packages
- [ ] `docs/security/DEPENDENCY_AUDIT.md` created with findings and resolutions
- [ ] `engines.node` field updated in all `package.json` files

## 9. References

- [SDK](../sdk/)
- [Merchant API](../api/)
- [Indexer](../backend/indexer/)
- [Security Policy](../SECURITY.md)
- Dependabot docs: https://docs.github.com/en/code-security/dependabot
- npm audit: https://docs.npmjs.com/cli/v9/commands/npm-audit
