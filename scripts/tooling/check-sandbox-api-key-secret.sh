#!/usr/bin/env bash
#
# check-sandbox-api-key-secret.sh
#
# Policy guard for audit finding DEVOPS-M4.
#
# Asserts that the sandbox compose file requires SANDBOX_API_KEY_SECRET
# without a committed fallback, and that the sandbox setup materials direct
# operators to generate a fresh random secret instead of copying a public
# placeholder.
#
# Exit status:
#   0 - sandbox API key secret configuration passes the hardening policy
#   1 - one or more policy violations were found
#
# References:
#   * issue #286 (DEVOPS-M4)
#   * audit/findings/DEVOPS-M4-sandbox-api-key-secret-hardcoded-default.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${1:-${REPO_ROOT}/docker-compose.sandbox.yml}"
ENV_TEMPLATE="${REPO_ROOT}/.env.sandbox.example"
SANDBOX_DOC="${REPO_ROOT}/docs/sandbox.md"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "::error::Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

relative_path() {
  local path="$1"
  printf '%s\n' "${path#"${REPO_ROOT}/"}"
}

service_block() {
  local service="$1"
  awk -v service="${service}" '
    $0 ~ "^  " service ":[[:space:]]*$" { in_service = 1; next }
    in_service && $0 ~ "^  [A-Za-z0-9_-]+:[[:space:]]*$" { exit }
    in_service { print }
  ' "${COMPOSE_FILE}"
}

violations=()
api_block="$(service_block api)"

if [ -z "${api_block}" ]; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): missing api service")
fi

if grep -Eq 'API_KEY_SECRET:[[:space:]]*.*\$\{SANDBOX_API_KEY_SECRET:-' <<<"${api_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): API_KEY_SECRET must not use a SANDBOX_API_KEY_SECRET fallback default")
fi

if grep -Eq 'API_KEY_SECRET:[[:space:]]*.*(sandbox-do-not-use-in-production-32-bytes|default-dev-secret|change-me-to-a-32-byte-random-value)' <<<"${api_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): API_KEY_SECRET embeds a known weak/default value")
fi

if ! grep -Eq 'API_KEY_SECRET:[[:space:]]*\$\{SANDBOX_API_KEY_SECRET:\?[^}]+\}[[:space:]]*$' <<<"${api_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): API_KEY_SECRET must require SANDBOX_API_KEY_SECRET with the :? compose operator")
fi

if [ ! -f "${ENV_TEMPLATE}" ]; then
  violations+=("$(relative_path "${ENV_TEMPLATE}"): missing sandbox env template")
else
  if grep -Eq '^SANDBOX_API_KEY_SECRET=(sandbox-do-not-use-in-production-32-bytes|default-dev-secret|change-me-to-a-32-byte-random-value|changeme|change-me|secret|password)[[:space:]]*$' "${ENV_TEMPLATE}"; then
    violations+=("$(relative_path "${ENV_TEMPLATE}"): SANDBOX_API_KEY_SECRET must not be prefilled with a known weak/default value")
  fi

  if grep -Eq '^SANDBOX_API_KEY_SECRET=.+$' "${ENV_TEMPLATE}"; then
    violations+=("$(relative_path "${ENV_TEMPLATE}"): SANDBOX_API_KEY_SECRET must be empty in the example template")
  fi

  if ! grep -Eq 'openssl rand -(base64|hex) 32' "${ENV_TEMPLATE}"; then
    violations+=("$(relative_path "${ENV_TEMPLATE}"): template must document generating SANDBOX_API_KEY_SECRET with openssl rand")
  fi
fi

if [ ! -f "${SANDBOX_DOC}" ]; then
  violations+=("$(relative_path "${SANDBOX_DOC}"): missing sandbox documentation")
else
  if ! grep -Eq 'SANDBOX_API_KEY_SECRET' "${SANDBOX_DOC}" ||
    ! grep -Eq 'openssl rand -(base64|hex) 32' "${SANDBOX_DOC}"; then
    violations+=("$(relative_path "${SANDBOX_DOC}"): docs must document generating SANDBOX_API_KEY_SECRET with openssl rand")
  fi
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  tmp_env="$(mktemp)"
  tmp_config="$(mktemp)"
  tmp_err="$(mktemp)"

  cleanup() {
    rm -f "${tmp_env}" "${tmp_config}" "${tmp_err}"
  }
  trap cleanup EXIT

  if env -u SANDBOX_API_KEY_SECRET docker compose --env-file /dev/null -f "${COMPOSE_FILE}" config >"${tmp_config}" 2>"${tmp_err}"; then
    violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config succeeds when SANDBOX_API_KEY_SECRET is unset")
  elif ! grep -q 'SANDBOX_API_KEY_SECRET' "${tmp_err}"; then
    violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config failed without clearly requiring SANDBOX_API_KEY_SECRET")
  fi

  cat >"${tmp_env}" <<'ENV'
SANDBOX_API_KEY_SECRET=compose-policy-test-secret-generated-for-ci
ENV

  if docker compose --env-file "${tmp_env}" -f "${COMPOSE_FILE}" config >"${tmp_config}" 2>"${tmp_err}"; then
    if grep -q 'sandbox-do-not-use-in-production-32-bytes' "${tmp_config}"; then
      violations+=("$(relative_path "${COMPOSE_FILE}"): rendered compose config contains the historical sandbox API key secret")
    fi
  else
    violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config failed with SANDBOX_API_KEY_SECRET set")
  fi
else
  echo "WARN: docker compose is not available; source policy checks were run without rendered compose config." >&2
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Sandbox API_KEY_SECRET compose hardening policy failed:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: docker-compose.sandbox.yml requires SANDBOX_API_KEY_SECRET without a committed default."
