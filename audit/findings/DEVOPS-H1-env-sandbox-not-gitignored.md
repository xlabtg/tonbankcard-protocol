---
title: "[DEVOPS-H1] .env.sandbox is not gitignored — risk of committing sandbox secrets"
severity: high
area: devops
priority: high
stage: 2
labels: ["bug","audit","type:tooling","type:security","priority:high","stage:2-high"]
---

## Summary

The repository's `.gitignore` ignores `.env`, `.env.local`, and `.env.*.local`, but it does not ignore `.env.sandbox`. The sandbox compose stack reads secrets (for example `SANDBOX_API_KEY_SECRET`, `TON_API_KEY`) from `.env.sandbox`, so an operator who populates that file with real values can commit it accidentally.

## Severity & Category

- Severity: High
- Category: Secrets Management / Source Control Hygiene

## Affected Code

- `.gitignore:24-27` (Environment ignore patterns)
- `docker-compose.sandbox.yml:35` (`env_file: .env.sandbox`)

## Description

The current ignore patterns do not match `.env.sandbox`:

```gitignore
# Environment
.env
.env.local
.env.*.local
```

`.env.*.local` matches `.env.production.local` but not `.env.sandbox`. The sandbox stack loads this file as its `env_file`, and the documented workflow instructs operators to create it:

```yaml
# docker-compose.sandbox.yml
    env_file:
      - path: .env.sandbox
        required: false
```

```
# cp .env.sandbox.example .env.sandbox
```

Once populated with a real `SANDBOX_API_KEY_SECRET`, `TON_API_KEY`, or signing keys, `.env.sandbox` is a tracked-eligible file and can be committed and pushed.

Positive note: no live secrets are currently committed; only `.env.example` and `.env.sandbox.example` placeholders are tracked.

## Impact

- Sandbox/testnet secrets (API-key HMAC secret, TON API key, faucet signing material) can leak into git history.
- Secrets in history persist after deletion and require history rewriting plus rotation to remediate.

## Suggested Fix

- Add `.env.sandbox` to `.gitignore`, and broaden the patterns to cover all secret-bearing `.env.*` variants (for example `.env.*` with an explicit `!.env.example` / `!.env.sandbox.example` allowlist).
- Keep only `*.example` templates tracked.

## Acceptance Criteria

- [ ] `.gitignore` ignores `.env.sandbox` and other secret-bearing `.env.*` variants.
- [ ] `.env.example` and `.env.sandbox.example` remain tracked.
- [ ] CI/verification: `git check-ignore .env.sandbox` exits 0, and `git ls-files` shows no `.env.sandbox` tracked.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `audit/findings/API-H1-api-key-secret-default-fallback.md`

---

**Tracking issue:** [#261](https://github.com/xlabtg/tonbankcard-protocol/issues/261)
