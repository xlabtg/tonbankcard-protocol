# Issue #376 / PC-07 — Redis published on all interfaces without authentication

Minimal, self-contained reproduction of the **PC-07** finding: both
`docker-compose.yml` and `docker-compose.sandbox.yml` published the Redis
service to the host with no interface binding and no password:

```yaml
# pre-fix
  redis:
    image: redis:7.2-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "${REDIS_HOST_PORT:-6379}:6379"   # Docker binds 0.0.0.0 → every interface
```

A `host:container` port spec with no IP makes Docker bind **0.0.0.0**, so the
store is reachable from every interface — not just loopback. With no
`--requirepass`, anyone who can reach the port has full, unauthenticated access.
Redis backs the API/indexer **idempotency keys and rate-limit counters**, so an
attacker can replay or drop payments (overwrite idempotency records), defeat
rate limiting (delete counters), or `FLUSHALL` the entire store. Postgres in the
same file was already bound to `127.0.0.1` with a mandatory password; Redis was
the outlier.

## What `redis-exposure.repro.sh` proves

The script starts two **real** `redis:7.2-alpine` containers side by side — the
pre-fix config (`-p 6379`, no auth) and the post-fix config from
`docker-compose.yml` (`-p 127.0.0.1::6379 … --requirepass …`) — and asserts the
contrast against live containers, exiting non-zero unless the vulnerability
reproduces **before** and is closed **after**:

- **Criterion 1 — binding:** `docker port` shows the pre-fix container on
  `0.0.0.0:…` (reachable from non-loopback interfaces) and the post-fix
  container on `127.0.0.1:…` only.
- **Criterion 2 — authentication:** an unauthenticated `SET` **succeeds**
  against the pre-fix container and is **rejected with `NOAUTH`** against the
  post-fix one, while an authenticated client still works.
- **Criterion 3 — healthcheck:** a bare `redis-cli ping` exits `0` even on a
  `NOAUTH` error, so the hardened compose healthcheck pipes it through
  `grep -q PONG` (with `REDISCLI_AUTH`) to **fail closed** when auth is
  misconfigured.

| Reaching the host port | Unauthenticated `SET` |
| --- | --- |
| **Before the fix** — bound to `0.0.0.0`, every interface ❌ | **succeeds** — store fully writable ❌ |
| **After the fix** — bound to `127.0.0.1` only ✅ | rejected with `NOAUTH` ✅ |

Observed output:

```
  pre-fix  'docker port pc07-redis-old 6379' => 0.0.0.0:32768 , [::]:32768
  post-fix 'docker port pc07-redis-new 6379' => 127.0.0.1:32769
  pre-fix  unauth 'SET pc07 owned' => OK
  post-fix unauth 'SET pc07 owned' => NOAUTH Authentication required.
  post-fix authed 'SET pc07 owned' => OK
RESULT: PC-07 reproduced (vulnerable BEFORE) and confirmed fixed (AFTER). ✅
```

## Run it

```bash
experiments/issue-376-redis-exposed/redis-exposure.repro.sh
```

Requires Docker (it pulls `redis:7.2-alpine` and runs throwaway containers on a
private network, cleaned up on exit). If Docker is unavailable the script prints
`SKIP` and exits `0`.

The CI-enforced regression lives in
`scripts/tooling/check-compose-redis-hardening.sh` (job *infra-verify*), which
greps both compose files and renders them with `docker compose config` to assert
the loopback binding, the required `--requirepass ${REDIS_PASSWORD:?…}`, and the
forwarded `REDIS_PASSWORD` for the API and indexer. This directory is the
self-contained runtime before/after demonstration that accompanies the finding.

## Notes

This is an authorized internal audit reproduction. No secrets or real customer
data are used; all inputs are synthetic.
