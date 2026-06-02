---
title: "[DEVOPS-M3] Postgres default credentials and host-exposed port in compose"
severity: medium
area: devops
priority: medium
stage: 3
labels: ["bug","audit","type:tooling","type:security","priority:medium","stage:3-medium"]
---

## Summary

The Postgres service in `docker-compose.yml` defaults to the well-known credential pair `tonbankcard`/`tonbankcard` and publishes port 5432 to the host. Combined, weak default credentials plus host exposure make the database trivially reachable with guessable credentials if the file is reused beyond local development.

## Severity & Category

- Severity: Medium
- Category: Default Credentials / Network Exposure

## Affected Code

- `docker-compose.yml:118-121` (default `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`)
- `docker-compose.yml:122-123` (port published to host)
- `docker-compose.yml:39` (`DATABASE_URL` default embeds the same credentials)

## Description

The compose file ships defaults for both credentials and the published port:

```yaml
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-tonbankcard}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-tonbankcard}
      POSTGRES_DB: ${POSTGRES_DB:-tonbankcard}
    ports:
      - "${POSTGRES_HOST_PORT:-5432}:5432"
```

and the API's connection string reuses them:

```yaml
      DATABASE_URL: ${DATABASE_URL:-postgres://tonbankcard:tonbankcard@postgres:5432/tonbankcard}
```

Because the values default, an operator who runs `docker compose --profile postgres up` without setting env vars exposes Postgres on `0.0.0.0:5432` with publicly known credentials.

Note: this is primarily a local-development compose file, and the API can also run against InMemoryStorage. The risk materializes if the file is adapted for a shared/hosted environment.

## Impact

- Unauthorized database access using guessable default credentials if the port is reachable.
- Credential and exposure defaults can silently propagate into non-local deployments.

## Suggested Fix

- Require strong credentials via environment with no fallback defaults (fail fast if `POSTGRES_PASSWORD` is unset), or generate them.
- Do not publish 5432 to the host by default; if needed for local tooling, bind to `127.0.0.1:5432:5432`.
- Remove embedded credentials from the default `DATABASE_URL`.

## Acceptance Criteria

- [ ] No default password is shipped for Postgres; the service refuses to start without a strong credential.
- [ ] The Postgres port is not published, or is bound to `127.0.0.1` only.
- [ ] `DATABASE_URL` no longer embeds default credentials.
- [ ] CI/verification: a compose-config lint (for example `docker compose config` plus a policy check) confirms no default DB password and no `0.0.0.0` DB port binding.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#285](https://github.com/xlabtg/tonbankcard-protocol/issues/285)
