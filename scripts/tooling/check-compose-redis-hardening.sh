#!/usr/bin/env bash
#
# check-compose-redis-hardening.sh
#
# Policy guard for audit finding PC-07.
#
# Asserts that both the local development (docker-compose.yml) and sandbox
# (docker-compose.sandbox.yml) stacks run Redis with mandatory authentication
# and publish it only on the loopback interface:
#
#   * redis enables --requirepass sourced from a REQUIRED REDIS_PASSWORD
#     (the ${REDIS_PASSWORD:?...} compose operator — no committed :- fallback
#     and no embedded literal secret);
#   * the redis host port is bound to 127.0.0.1, matching the Postgres
#     hardening, so the store is not reachable from non-loopback interfaces;
#   * the api and indexer services forward REDIS_PASSWORD as the same required
#     secret so the stack cannot silently run half-authenticated;
#   * the .env templates declare an empty REDIS_PASSWORD and document
#     generating it with `openssl rand`.
#
# Redis backs idempotency keys and rate-limit counters, so an unauthenticated,
# network-reachable instance lets anyone tamper with those controls (or
# FLUSHALL the store).
#
# Exit status:
#   0 - both compose files and env templates pass the Redis hardening policy
#   1 - one or more policy violations were found
#
# References:
#   * issue #376 (PC-07)
#   * audit/precheck-368/findings/PC-07-redis-exposed-without-auth.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEV_COMPOSE="${REPO_ROOT}/docker-compose.yml"
SANDBOX_COMPOSE="${REPO_ROOT}/docker-compose.sandbox.yml"
DEV_ENV_TEMPLATE="${REPO_ROOT}/.env.example"
SANDBOX_ENV_TEMPLATE="${REPO_ROOT}/.env.sandbox.example"

# A throwaway value used only to render `docker compose config`; never a real
# secret. Long/random enough that it cannot match a weak-default heuristic.
TEST_REDIS_PASSWORD="compose-policy-test-redis-password"
TEST_SANDBOX_API_KEY_SECRET="compose-policy-test-secret-generated-for-ci"

violations=()

relative_path() {
  local path="$1"
  printf '%s\n' "${path#"${REPO_ROOT}/"}"
}

# Print the indented body of a top-level compose service (everything between
# "  <service>:" and the next "  <name>:" sibling).
service_block() {
  local compose_file="$1"
  local service="$2"
  awk -v service="${service}" '
    $0 ~ "^  " service ":[[:space:]]*$" { in_service = 1; next }
    in_service && $0 ~ "^  [A-Za-z0-9_-]+:[[:space:]]*$" { exit }
    in_service { print }
  ' "${compose_file}"
}

# Print each "- <spec>" entry under the redis service's ports: list.
redis_ports_specs() {
  local compose_file="$1"
  awk '
    /^  redis:[[:space:]]*$/ { in_service = 1; next }
    in_service && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_service && /^[[:space:]]{4}ports:[[:space:]]*$/ { in_ports = 1; next }
    in_ports && /^[[:space:]]{4}[A-Za-z0-9_-]+:[[:space:]]*$/ { in_ports = 0 }
    in_ports && /^[[:space:]]+-[[:space:]]*"?[^"]+"?[[:space:]]*$/ {
      sub(/^[[:space:]]+-[[:space:]]*"?/, "")
      sub(/"?[[:space:]]*$/, "")
      print
    }
  ' "${compose_file}"
}

# Print the redis service body from an already-rendered `docker compose config`
# document (services are indented two spaces under top-level `services:`).
rendered_redis_block() {
  local config_file="$1"
  awk '
    /^  redis:[[:space:]]*$/ { in_service = 1; next }
    in_service && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_service { print }
  ' "${config_file}"
}

assert_service_forwards_password() {
  local rel="$1"
  local service="$2"
  local block="$3"
  if [ -z "${block}" ]; then
    violations+=("${rel}: missing ${service} service")
    return
  fi
  if ! grep -Eq 'REDIS_PASSWORD:[[:space:]]*\$\{REDIS_PASSWORD:\?[^}]+\}' <<<"${block}"; then
    violations+=("${rel}: ${service} must forward REDIS_PASSWORD as a required \${REDIS_PASSWORD:?...}")
  fi
}

# ---------------------------------------------------------------------------
# Source-level policy (grep the committed compose YAML).
# ---------------------------------------------------------------------------
check_compose_source() {
  local compose_file="$1"
  local rel
  rel="$(relative_path "${compose_file}")"

  if [ ! -f "${compose_file}" ]; then
    violations+=("${rel}: compose file not found")
    return
  fi

  local redis_block api_block indexer_block
  redis_block="$(service_block "${compose_file}" redis)"
  api_block="$(service_block "${compose_file}" api)"
  indexer_block="$(service_block "${compose_file}" indexer)"

  if [ -z "${redis_block}" ]; then
    violations+=("${rel}: missing redis service")
    return
  fi

  # 1. Authentication is mandatory and sourced from a required REDIS_PASSWORD.
  if ! grep -Eq 'requirepass' <<<"${redis_block}"; then
    violations+=("${rel}: redis command must enable --requirepass")
  fi

  if ! grep -Eq '\$\{REDIS_PASSWORD:\?[^}]+\}' <<<"${redis_block}"; then
    violations+=("${rel}: redis must source the password from a required \${REDIS_PASSWORD:?...}")
  fi

  if grep -Eq '\$\{REDIS_PASSWORD:-' <<<"${redis_block}"; then
    violations+=("${rel}: redis REDIS_PASSWORD must not use a committed :- fallback default")
  fi

  # A hardcoded password would appear as a literal argument right after
  # --requirepass instead of a ${REDIS_PASSWORD...} reference.
  if grep -Eq 'requirepass"?,?[[:space:]]*"?[A-Za-z0-9]' <<<"${redis_block}"; then
    violations+=("${rel}: redis --requirepass must reference \${REDIS_PASSWORD}, not a literal value")
  fi

  # 2. The host port must be bound to loopback.
  local spec
  while IFS= read -r spec; do
    [ -n "${spec}" ] || continue
    case "${spec}" in
      127.0.0.1:*) ;;
      *) violations+=("${rel}: redis port mapping \"${spec}\" is not bound to 127.0.0.1") ;;
    esac
  done < <(redis_ports_specs "${compose_file}")

  # 3. Clients must present the same required secret.
  assert_service_forwards_password "${rel}" api "${api_block}"
  assert_service_forwards_password "${rel}" indexer "${indexer_block}"
}

# ---------------------------------------------------------------------------
# Env-template policy: REDIS_PASSWORD declared, empty, and documented.
# ---------------------------------------------------------------------------
check_env_template() {
  local template="$1"
  local rel
  rel="$(relative_path "${template}")"

  if [ ! -f "${template}" ]; then
    violations+=("${rel}: missing env template")
    return
  fi

  if ! grep -Eq '^REDIS_PASSWORD=' "${template}"; then
    violations+=("${rel}: must declare REDIS_PASSWORD")
    return
  fi

  if grep -Eq '^REDIS_PASSWORD=.+$' "${template}"; then
    violations+=("${rel}: REDIS_PASSWORD must be empty in the example template")
  fi

  if grep -Eq '^REDIS_PASSWORD=(changeme|change-me|secret|password|redis)[[:space:]]*$' "${template}"; then
    violations+=("${rel}: REDIS_PASSWORD must not be prefilled with a known weak/default value")
  fi

  # The generation guidance must sit in the REDIS_PASSWORD comment block, not
  # merely elsewhere in the file (e.g. the Postgres section).
  if ! grep -B4 -E '^REDIS_PASSWORD=' "${template}" | grep -Eq 'openssl rand -(base64|hex) 32'; then
    violations+=("${rel}: template must document generating REDIS_PASSWORD with openssl rand")
  fi
}

# ---------------------------------------------------------------------------
# Rendered policy: `docker compose config` must fail closed without
# REDIS_PASSWORD and, once set, render redis on loopback with --requirepass.
# ---------------------------------------------------------------------------
TMP_FILES=()
CREATED_REPO_ENV=0
REPO_ENV="${REPO_ROOT}/.env"

cleanup() {
  local f
  for f in "${TMP_FILES[@]:-}"; do
    [ -n "${f}" ] && rm -f "${f}"
  done
  if [ "${CREATED_REPO_ENV}" -eq 1 ]; then
    rm -f "${REPO_ENV}"
  fi
}
trap cleanup EXIT

new_tmp() {
  local t
  t="$(mktemp)"
  TMP_FILES+=("${t}")
  printf '%s\n' "${t}"
}

render_checks() {
  local compose_file="$1"
  local other_required="$2"   # KEY=VALUE lines for every OTHER required secret
  local ensure_repo_env="$3"  # "yes" if the compose has a required env_file: .env
  local rel
  rel="$(relative_path "${compose_file}")"

  local neg_env pos_env tmp_config tmp_err
  neg_env="$(new_tmp)"
  pos_env="$(new_tmp)"
  tmp_config="$(new_tmp)"
  tmp_err="$(new_tmp)"

  printf '%s\n' "${other_required}" > "${neg_env}"
  {
    printf '%s\n' "${other_required}"
    printf 'REDIS_PASSWORD=%s\n' "${TEST_REDIS_PASSWORD}"
  } > "${pos_env}"

  # A required `env_file: .env` must exist on disk or compose aborts before the
  # checks we care about. Create a throwaway one only if the developer has none.
  if [ "${ensure_repo_env}" = "yes" ] && [ ! -e "${REPO_ENV}" ]; then
    : > "${REPO_ENV}"
    CREATED_REPO_ENV=1
  fi

  # Negative: REDIS_PASSWORD unset must fail, and the error must name it. The
  # --env-file fully controls interpolation, so a developer's real .env (used
  # only for the env_file directive) cannot mask the missing variable.
  if env -u REDIS_PASSWORD docker compose --env-file "${neg_env}" -f "${compose_file}" config >"${tmp_config}" 2>"${tmp_err}"; then
    violations+=("${rel}: docker compose config succeeds when REDIS_PASSWORD is unset")
  elif ! grep -q 'REDIS_PASSWORD' "${tmp_err}"; then
    violations+=("${rel}: docker compose config failed without clearly requiring REDIS_PASSWORD")
  fi

  # Positive: with REDIS_PASSWORD set, config must succeed and render redis on
  # loopback with authentication enabled.
  if env -u REDIS_PASSWORD docker compose --env-file "${pos_env}" -f "${compose_file}" config >"${tmp_config}" 2>"${tmp_err}"; then
    local redis_config
    redis_config="$(rendered_redis_block "${tmp_config}")"

    if grep -Eq 'host_ip:[[:space:]]*"?0\.0\.0\.0"?' <<<"${redis_config}"; then
      violations+=("${rel}: docker compose config renders redis host_ip as 0.0.0.0")
    fi

    if grep -Eq 'published:[[:space:]]*"?[0-9]+' <<<"${redis_config}" &&
      ! grep -Eq 'host_ip:[[:space:]]*"?127\.0\.0\.1"?' <<<"${redis_config}"; then
      violations+=("${rel}: docker compose config renders redis published port without host_ip 127.0.0.1")
    fi

    if ! grep -Eq 'requirepass' <<<"${redis_config}"; then
      violations+=("${rel}: docker compose config renders redis without --requirepass")
    fi
  else
    violations+=("${rel}: docker compose config failed with REDIS_PASSWORD set")
  fi
}

check_compose_source "${DEV_COMPOSE}"
check_compose_source "${SANDBOX_COMPOSE}"
check_env_template "${DEV_ENV_TEMPLATE}"
check_env_template "${SANDBOX_ENV_TEMPLATE}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  render_checks "${DEV_COMPOSE}" "" yes
  render_checks "${SANDBOX_COMPOSE}" "SANDBOX_API_KEY_SECRET=${TEST_SANDBOX_API_KEY_SECRET}" no
else
  echo "WARN: docker compose is not available; source policy checks were run without rendered compose config." >&2
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Redis compose hardening policy failed:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: docker-compose.yml and docker-compose.sandbox.yml run Redis with required authentication on a loopback-only port."
