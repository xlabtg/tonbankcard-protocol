---
title: "[DEVOPS-LOW] DevOps hardening backlog"
severity: low
area: devops
priority: low
stage: 4
labels: ["bug","audit","type:tooling","type:security","priority:low","stage:4-low"]
---

## Summary

A consolidated backlog of low-severity DevOps/infrastructure hardening items found during the CI/infra security audit. None are individually high-impact, but addressing them improves least-privilege posture, file-permission hygiene, and configuration consistency.

Positive findings observed during the audit and worth preserving: no script-injection sinks were found in any workflow; shell steps consistently use `set -euo pipefail`; the Helm charts are well-hardened; and no live secrets are committed (only `*.example` templates are tracked).

## Severity & Category

- Severity: Low
- Category: CI/CD & Infrastructure Hardening

## Affected Code

- `.github/workflows/npm-publish-sdk.yml:43-46` (L1)
- Kubernetes manifests / Helm chart pod & ServiceAccount specs (L2)
- `infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl:27-28` (L3)
- `scripts/faucet` config vs. `docker-compose.sandbox.yml:121-122` (L4)

## Description, Impact & Suggested Fix

### L1 — id-token permission granted at workflow scope instead of the publishing job

`.github/workflows/npm-publish-sdk.yml` declares `id-token: write` at the top level:

```yaml
permissions:
  contents: read
  # Required for OIDC-based authentication to npm and for provenance attestation.
  id-token: write
```

This grants the OIDC token-minting capability to every job in the workflow, not just the publish job that needs it.

- Impact: Any non-publish job in the workflow can mint an OIDC token, widening the blast radius if a step is compromised.
- Suggested fix: Keep `contents: read` at the top level and move `id-token: write` down to the specific publish job that performs the OIDC-authenticated upload (as `pypi-publish.yml` already does at the job level).

### L2 — ServiceAccount token automount not disabled where unused

Kubernetes pods/ServiceAccounts that never call the API server still automount a ServiceAccount token by default.

- Impact: An exfiltrated pod token can be used against the API server even when the workload has no legitimate need for it.
- Suggested fix: Set `automountServiceAccountToken: false` on pods and ServiceAccounts that do not require API-server access (and only enable it where needed).

### L3 — cloud-init writes .env world-readable (0644)

`infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl` writes the environment file with permissive mode and root ownership:

```yaml
  - path: /etc/tonbankcard/.env
    permissions: "0644"
    owner: "root:root"
```

By contrast, the secrets file is correctly `0600`. The `.env` file may still carry sensitive configuration.

- Impact: Any local user on the host can read `/etc/tonbankcard/.env`.
- Suggested fix: Write env files mode `0600` owned by the service user (`tonbankcard`), matching the `secrets.env` treatment.

### L4 — Faucet rate-limit values not normalized consistently

The faucet rate-limit configuration uses window/max keys in milliseconds in compose:

```yaml
      FAUCET_RATE_LIMIT_WINDOW_MS: ${FAUCET_RATE_LIMIT_WINDOW_MS:-3600000}
      FAUCET_RATE_LIMIT_MAX: ${FAUCET_RATE_LIMIT_MAX:-1}
```

while the units/keys differ from how `scripts/faucet` code interprets them, risking a mismatch between configured and enforced limits.

- Impact: Operator-configured rate limits may not match enforced behavior, weakening abuse protection on the public faucet.
- Suggested fix: Normalize rate-limit units and key names between config and code, and document them in the faucet README.

## Acceptance Criteria

- [ ] L1: `id-token: write` is scoped to the publish job; top-level keeps only `contents: read`.
- [ ] L2: `automountServiceAccountToken: false` is set on pods/SAs that don't need API-server access.
- [ ] L3: cloud-init writes `.env` as `0600` owned by the service user.
- [ ] L4: Faucet rate-limit units/keys are consistent between config and code and documented.
- [ ] CI/verification: workflow/manifest lint (e.g. `actionlint`, kube-linter/`kubeconform` policy) and a compose-config check confirm the above.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `.github/workflows/pypi-publish.yml` (reference job-scoped id-token)

---

**Tracking issue:** [#299](https://github.com/xlabtg/tonbankcard-protocol/issues/299)
