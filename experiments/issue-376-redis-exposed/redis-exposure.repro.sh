#!/usr/bin/env bash
#
# redis-exposure.repro.sh
#
# Self-contained before/after reproduction of audit finding PC-07 (issue #376):
# "Redis is published on all interfaces without authentication".
#
# It starts two real redis:7.2-alpine containers side by side:
#
#   * pc07-redis-old — the PRE-FIX configuration: `redis-server --appendonly yes`
#       published with a bare `-p` (Docker binds 0.0.0.0) and NO --requirepass.
#   * pc07-redis-new — the POST-FIX configuration from docker-compose.yml:
#       published on 127.0.0.1 only and started with --requirepass.
#
# and then proves, against live containers:
#
#   BEFORE  the host port is published on 0.0.0.0 (every interface), and an
#           unauthenticated client can SET / FLUSHALL the store.
#   AFTER   the host port is published on 127.0.0.1 only, an unauthenticated
#           client is rejected with NOAUTH, and an authenticated client works.
#           A bare `redis-cli ping` still exits 0 on NOAUTH — which is exactly
#           why the hardened healthcheck pipes it through `grep -q PONG`.
#
# The script exits non-zero unless the vulnerability reproduces on the old
# container AND is closed on the new one, so it doubles as an assertion.
#
# Usage:
#   experiments/issue-376-redis-exposed/redis-exposure.repro.sh
#
# This is an authorized internal audit reproduction. No secrets or real data
# are used; REDIS_PW below is a throwaway value generated for the demo.

set -euo pipefail

IMAGE="redis:7.2-alpine"
NET="pc07-net"
OLD="pc07-redis-old"
NEW="pc07-redis-new"
REDIS_PW="pc07-demo-$(printf '%s' "${RANDOM:-0}${RANDOM:-0}")-not-a-real-secret"

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP: docker is not available; cannot run the PC-07 runtime reproduction." >&2
  exit 0
fi

cleanup() {
  docker rm -f "${OLD}" "${NEW}" >/dev/null 2>&1 || true
  docker network rm "${NET}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup # in case a previous interrupted run left containers behind

client() { docker run --rm --network "${NET}" "${IMAGE}" "$@"; }

failures=0
note_fail() { echo "  ✗ $1"; failures=$((failures + 1)); }
note_ok() { echo "  ✓ $1"; }

echo "==> Pulling ${IMAGE} (if needed) and creating network ${NET}"
docker pull -q "${IMAGE}" >/dev/null
docker network create "${NET}" >/dev/null

echo "==> Starting PRE-FIX redis (bare -p, no --requirepass)"
docker run -d --name "${OLD}" --network "${NET}" -p 6379 \
  "${IMAGE}" redis-server --appendonly yes >/dev/null

echo "==> Starting POST-FIX redis (127.0.0.1 only, --requirepass)"
docker run -d --name "${NEW}" --network "${NET}" -p 127.0.0.1::6379 \
  "${IMAGE}" redis-server --appendonly yes --requirepass "${REDIS_PW}" >/dev/null

# Give redis a moment to accept connections.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if client redis-cli -h "${OLD}" ping >/dev/null 2>&1; then break; fi
  sleep 0.5
done

echo
echo "============================================================"
echo " Criterion 1 — host port binding (loopback vs 0.0.0.0)"
echo "============================================================"
old_port="$(docker port "${OLD}" 6379 || true)"
new_port="$(docker port "${NEW}" 6379 || true)"
echo "  pre-fix  'docker port ${OLD} 6379' => ${old_port//$'\n'/ , }"
echo "  post-fix 'docker port ${NEW} 6379' => ${new_port//$'\n'/ , }"

if grep -q '0\.0\.0\.0:' <<<"${old_port}"; then
  note_ok "BEFORE: published on 0.0.0.0 — reachable from non-loopback interfaces (vulnerable)"
else
  note_fail "BEFORE: expected a 0.0.0.0 binding to demonstrate exposure"
fi

if grep -q '127\.0\.0\.1:' <<<"${new_port}" && ! grep -q '0\.0\.0\.0:' <<<"${new_port}"; then
  note_ok "AFTER: published on 127.0.0.1 only — not reachable from non-loopback interfaces"
else
  note_fail "AFTER: expected a 127.0.0.1-only binding"
fi

echo
echo "============================================================"
echo " Criterion 2 — authentication (--requirepass)"
echo "============================================================"
old_set="$(client redis-cli -h "${OLD}" SET pc07 owned 2>&1 || true)"
new_set="$(client redis-cli -h "${NEW}" SET pc07 owned 2>&1 || true)"
new_auth="$(client redis-cli -h "${NEW}" -a "${REDIS_PW}" --no-auth-warning SET pc07 owned 2>&1 || true)"
echo "  pre-fix  unauth 'SET pc07 owned' => ${old_set}"
echo "  post-fix unauth 'SET pc07 owned' => ${new_set}"
echo "  post-fix authed 'SET pc07 owned' => ${new_auth}"

if grep -qi 'OK' <<<"${old_set}"; then
  note_ok "BEFORE: unauthenticated write SUCCEEDS — anyone can poison/flush the store (vulnerable)"
else
  note_fail "BEFORE: expected the unauthenticated write to succeed"
fi

if grep -qi 'NOAUTH' <<<"${new_set}"; then
  note_ok "AFTER: unauthenticated write REJECTED with NOAUTH"
else
  note_fail "AFTER: expected the unauthenticated write to be rejected with NOAUTH"
fi

if grep -qi 'OK' <<<"${new_auth}"; then
  note_ok "AFTER: authenticated client still works"
else
  note_fail "AFTER: expected the authenticated write to succeed"
fi

echo
echo "============================================================"
echo " Criterion 3 — why the healthcheck pipes ping through grep"
echo "============================================================"
# A bare `redis-cli ping` prints the NOAUTH error but still exits 0, so the old
# healthcheck (test: ["CMD","redis-cli","ping"]) would report the container as
# healthy even though no client can actually use it.
bare_ping_rc=0
client sh -c "redis-cli -h ${NEW} ping" >/dev/null 2>&1 || bare_ping_rc=$?
grep_ping_rc=0
client sh -c "redis-cli -h ${NEW} ping | grep -q PONG" >/dev/null 2>&1 || grep_ping_rc=$?
authed_grep_rc=0
docker run --rm --network "${NET}" -e "REDISCLI_AUTH=${REDIS_PW}" "${IMAGE}" \
  sh -c "redis-cli -h ${NEW} ping | grep -q PONG" >/dev/null 2>&1 || authed_grep_rc=$?
echo "  bare   'redis-cli ping'                exit=${bare_ping_rc} (0 even on NOAUTH — misleading)"
echo "  guard  'redis-cli ping | grep -q PONG' exit=${grep_ping_rc} (fails closed without auth)"
echo "  authed REDISCLI_AUTH + grep PONG       exit=${authed_grep_rc} (passes once authenticated)"

if [ "${bare_ping_rc}" -eq 0 ] && [ "${grep_ping_rc}" -ne 0 ] && [ "${authed_grep_rc}" -eq 0 ]; then
  note_ok "healthcheck: 'ping | grep -q PONG' fails closed on NOAUTH and passes only when authenticated"
else
  note_fail "healthcheck: expected bare ping to exit 0, grep-guard to fail without auth and pass with REDISCLI_AUTH"
fi

echo
if [ "${failures}" -eq 0 ]; then
  echo "RESULT: PC-07 reproduced (vulnerable BEFORE) and confirmed fixed (AFTER). ✅"
  exit 0
fi
echo "RESULT: ${failures} expectation(s) did not hold. ❌" >&2
exit 1
