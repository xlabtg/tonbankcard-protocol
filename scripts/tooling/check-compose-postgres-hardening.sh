#!/usr/bin/env bash
#
# check-compose-postgres-hardening.sh
#
# Policy guard for audit finding DEVOPS-M3.
#
# Asserts that the local development compose file does not ship a default
# PostgreSQL password, does not embed default database credentials in
# DATABASE_URL, and does not publish PostgreSQL on all host interfaces.
#
# Exit status:
#   0 - compose and env templates pass the Postgres hardening policy
#   1 - one or more policy violations were found
#
# References:
#   * issue #285 (DEVOPS-M3)
#   * audit/findings/DEVOPS-M3-postgres-default-creds-and-exposed-port.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${1:-${REPO_ROOT}/docker-compose.yml}"

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

ports_block_specs() {
  awk '
    /^  postgres:[[:space:]]*$/ { in_service = 1; next }
    in_service && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_service && /^[[:space:]]{4}ports:[[:space:]]*$/ { in_ports = 1; next }
    in_ports && /^[[:space:]]{4}[A-Za-z0-9_-]+:[[:space:]]*$/ { in_ports = 0 }
    in_ports && /^[[:space:]]+-[[:space:]]*"?[^"]+"?[[:space:]]*$/ {
      sub(/^[[:space:]]+-[[:space:]]*"?/, "")
      sub(/"?[[:space:]]*$/, "")
      print
    }
  ' "${COMPOSE_FILE}"
}

violations=()

api_block="$(service_block api)"
postgres_block="$(service_block postgres)"

if [ -z "${postgres_block}" ]; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): missing postgres service")
fi

if grep -Eq 'POSTGRES_PASSWORD:[[:space:]]*.*\$\{POSTGRES_PASSWORD:-' <<<"${postgres_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): POSTGRES_PASSWORD must not use a fallback default")
fi

if grep -Eq 'POSTGRES_PASSWORD:[[:space:]]*.*(tonbankcard|change-me)' <<<"${postgres_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): POSTGRES_PASSWORD embeds a known placeholder/default value")
fi

if ! grep -Eq 'POSTGRES_PASSWORD:[[:space:]]*\$\{POSTGRES_PASSWORD(:\?[^}]*)?\}[[:space:]]*$' <<<"${postgres_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): POSTGRES_PASSWORD must be sourced directly from POSTGRES_PASSWORD without a default")
fi

if grep -Eq 'DATABASE_URL:[[:space:]]*.*postgres://[^:$@]+:[^@]+@' <<<"${api_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): DATABASE_URL embeds database credentials")
fi

if grep -Eq 'DATABASE_URL:[[:space:]]*.*\$\{DATABASE_URL:-postgres://' <<<"${api_block}"; then
  violations+=("$(relative_path "${COMPOSE_FILE}"): DATABASE_URL must not default to a credential-bearing Postgres URL")
fi

while IFS= read -r spec; do
  [ -n "${spec}" ] || continue
  case "${spec}" in
    127.0.0.1:*)
      ;;
    *)
      violations+=("$(relative_path "${COMPOSE_FILE}"): postgres port mapping \"${spec}\" is not bound to 127.0.0.1")
      ;;
  esac
done < <(ports_block_specs)

for template in "${REPO_ROOT}/.env.example" "${REPO_ROOT}/api/.env.example"; do
  [ -f "${template}" ] || continue

  while IFS=: read -r line_no line; do
    case "${line}" in
      POSTGRES_PASSWORD=*)
        value="${line#POSTGRES_PASSWORD=}"
        if [ -n "${value}" ]; then
          violations+=("$(relative_path "${template}"):${line_no}: POSTGRES_PASSWORD must be empty in the example template")
        fi
        ;;
      DATABASE_URL=postgres://*:*)
        violations+=("$(relative_path "${template}"):${line_no}: DATABASE_URL must not be enabled with embedded credentials in the example template")
        ;;
    esac
  done < <(grep -nE '^(POSTGRES_PASSWORD=|DATABASE_URL=postgres://)' "${template}" || true)
done

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  tmp_env="$(mktemp)"
  tmp_config="$(mktemp)"
  repo_env="${REPO_ROOT}/.env"
  created_repo_env=0

  cleanup() {
    rm -f "${tmp_env}" "${tmp_config}"
    if [ "${created_repo_env}" -eq 1 ]; then
      rm -f "${repo_env}"
    fi
  }
  trap cleanup EXIT

  cat > "${tmp_env}" <<'ENV'
POSTGRES_USER=tonbankcard
POSTGRES_PASSWORD=compose-policy-test-password-please-change
POSTGRES_DB=tonbankcard
DATABASE_URL=
ENV

  if [ ! -e "${repo_env}" ]; then
    cp "${tmp_env}" "${repo_env}"
    created_repo_env=1
  fi

  if docker compose --env-file "${tmp_env}" -f "${COMPOSE_FILE}" --profile postgres config > "${tmp_config}"; then
    postgres_config="$(
      awk '
        /^  postgres:[[:space:]]*$/ { in_service = 1; next }
        in_service && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
        in_service { print }
      ' "${tmp_config}"
    )"

    if grep -Eq 'host_ip:[[:space:]]*"?0\.0\.0\.0"?' <<<"${postgres_config}"; then
      violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config renders postgres host_ip as 0.0.0.0")
    fi

    if grep -Eq 'published:[[:space:]]*"?[0-9]+' <<<"${postgres_config}" &&
      ! grep -Eq 'host_ip:[[:space:]]*"?127\.0\.0\.1"?' <<<"${postgres_config}"; then
      violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config renders postgres published port without host_ip 127.0.0.1")
    fi
  else
    violations+=("$(relative_path "${COMPOSE_FILE}"): docker compose config failed with hardened test environment")
  fi
else
  echo "WARN: docker compose is not available; source policy checks were run without rendered compose config." >&2
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Postgres compose hardening policy failed:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: docker-compose.yml does not ship default Postgres credentials or all-interface Postgres port bindings."
