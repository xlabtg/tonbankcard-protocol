---
title: Redis is published on all interfaces without authentication in docker-compose (prod & sandbox)
severity: Medium
area: devops
priority: medium
stage: 3-medium
labels:
  - bug
  - type:security
  - type:backend
  - priority:medium
  - audit
  - stage:3-medium
---

## Summary

In both `docker-compose.yml` and `docker-compose.sandbox.yml` the Redis service publishes its port to the host with no interface binding and no `requirepass`. In the same compose file the Postgres service is correctly bound to `127.0.0.1` and requires a password — Redis was not given the same treatment. On any host where the Docker port is reachable, Redis is open to the network without authentication.

## Severity & Category

- Severity: Medium
- Category: Infrastructure / Exposure of unauthenticated data store

## Affected Code

- `docker-compose.yml:97-98` (`"${REDIS_HOST_PORT:-6379}:6379"`, no `127.0.0.1:` bind, no auth)
- `docker-compose.yml:96` (`command: ["redis-server", "--appendonly", "yes"]` — no `--requirepass`)
- `docker-compose.sandbox.yml:140-141` (same pattern, `:-6380`)
- Contrast: `docker-compose.yml:124` Postgres is bound `127.0.0.1:${POSTGRES_HOST_PORT:-5432}:5432` with `POSTGRES_PASSWORD`

## Description

```yaml
redis:
  command: ["redis-server", "--appendonly", "yes"]
  ports:
    - "${REDIS_HOST_PORT:-6379}:6379"
```

Without a `127.0.0.1:` host-IP prefix, Docker binds the published port on `0.0.0.0`. Without `--requirepass`, any client that can reach the port has full read/write access. Redis here backs idempotency keys and rate-limit counters, so exposure allows tampering with those controls and denial-of-service.

## Impact

- Unauthenticated read/write to idempotency and rate-limit state (bypass/poisoning).
- On a misconfigured/public host, full Redis compromise (data exfiltration, `FLUSHALL`, potential RCE via known Redis abuse techniques).

## Suggested Fix

- Bind the published port to loopback: `"127.0.0.1:${REDIS_HOST_PORT:-6379}:6379"` (matching Postgres), or drop the host port entirely and rely on the internal Docker network.
- Require authentication: `command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]` and pass the password to the API/indexer via env.

## Resolution

**RESOLVED ✅ (Issue #376 / PC-07)** — PR
[#390](https://github.com/xlabtg/tonbankcard-protocol/pull/390), branch
`issue-376-640177380b56`.

Redis is now hardened identically in both `docker-compose.yml` and
`docker-compose.sandbox.yml`, matching the existing Postgres treatment:

1. **Loopback-only publication.** The host port is bound to `127.0.0.1`
   (`"127.0.0.1:${REDIS_HOST_PORT:-6379}:6379"` for dev,
   `"127.0.0.1:${SANDBOX_REDIS_HOST_PORT:-6380}:6379"` for sandbox), so the
   store is no longer reachable from non-loopback interfaces by default.
2. **Mandatory authentication.** Redis runs
   `redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:?...}` from a
   **required** `REDIS_PASSWORD` (the compose `:?` operator, with no committed
   `:-` fallback and no literal secret), so — like Postgres — the stack refuses
   to start without a generated password. The `api` and `indexer` services
   forward the same required `REDIS_PASSWORD` so no client runs
   half-authenticated, and the healthcheck uses `redis-cli ping | grep -q PONG`
   (with `REDISCLI_AUTH`) so it fails closed under `NOAUTH` instead of reporting
   a password-less misconfiguration as healthy. The `.env.example` and
   `.env.sandbox.example` templates declare an empty, required `REDIS_PASSWORD`
   with `openssl rand -hex 32` generation guidance.

**CI-enforced policy** — `scripts/tooling/check-compose-redis-hardening.sh` (job
*infra-verify*, `.github/workflows/ci.yml`) greps both compose files and both
env templates, then renders each with `docker compose config`: a negative render
must fail with `REDIS_PASSWORD` unset, and a positive render must show the redis
`host_ip` as `127.0.0.1` (never `0.0.0.0`) with `--requirepass` in the command.
The three sibling infra checks (`check-compose-postgres-hardening.sh`,
`check-devops-low-hardening.sh`, `check-sandbox-api-key-secret.sh`) were updated
to supply the now-required `REDIS_PASSWORD` when rendering. A standalone runtime
before/after reproduction lives in `experiments/issue-376-redis-exposed/`.

## Acceptance Criteria

- [x] Redis is not reachable from non-loopback interfaces by default.
- [x] Redis requires authentication.
- [x] Both `docker-compose.yml` and `docker-compose.sandbox.yml` are updated consistently with Postgres.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
