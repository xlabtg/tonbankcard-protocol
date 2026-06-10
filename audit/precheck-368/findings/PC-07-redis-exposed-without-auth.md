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

## Acceptance Criteria

- [ ] Redis is not reachable from non-loopback interfaces by default.
- [ ] Redis requires authentication.
- [ ] Both `docker-compose.yml` and `docker-compose.sandbox.yml` are updated consistently with Postgres.

## References

- Pre-check umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/368
