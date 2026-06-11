#!/usr/bin/env bash
#
# check-devops-low-hardening.sh
#
# Policy guard for issue #299 (DEVOPS-LOW).
#
# Asserts that the low-severity DevOps hardening backlog remains closed:
#   L1: npm trusted-publish OIDC permission is scoped to the publish job.
#   L2: Helm pods and ServiceAccounts disable token automount by default.
#   L3: compose-vm cloud-init writes .env as 0600 owned by tonbankcard.
#   L4: faucet rate-limit env names/units are consistent and rendered by compose.
#
# Exit status:
#   0 - all policies pass
#   1 - one or more policy violations were found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

relative_path() {
  local path="$1"
  printf '%s\n' "${path#"${REPO_ROOT}/"}"
}

job_block() {
  local workflow="$1"
  local job="$2"
  awk -v job="${job}" '
    $0 ~ "^  " job ":[[:space:]]*$" { in_job = 1; next }
    in_job && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_job { print }
  ' "${workflow}"
}

top_permissions_block() {
  local workflow="$1"
  awk '
    /^permissions:[[:space:]]*$/ { in_block = 1; next }
    in_block && /^[A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_block { print }
  ' "${workflow}"
}

file_block_for_path() {
  local file="$1"
  local path="$2"
  awk -v path="${path}" '
    $0 ~ "^[[:space:]]+- path: " path "[[:space:]]*$" { in_file = 1; print; next }
    in_file && /^[[:space:]]+- path:/ { exit }
    in_file { print }
  ' "${file}"
}

service_block() {
  local compose_file="$1"
  local service="$2"
  awk -v service="${service}" '
    $0 ~ "^  " service ":[[:space:]]*$" { in_service = 1; next }
    in_service && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { exit }
    in_service { print }
  ' "${compose_file}"
}

violations=()

npm_workflow="${REPO_ROOT}/.github/workflows/npm-publish-sdk.yml"
npm_top_permissions="$(top_permissions_block "${npm_workflow}")"
npm_publish_job="$(job_block "${npm_workflow}" publish)"

if ! grep -Eq '^[[:space:]]+contents:[[:space:]]*read[[:space:]]*$' <<<"${npm_top_permissions}"; then
  violations+=("$(relative_path "${npm_workflow}"): top-level permissions must keep contents: read")
fi

if grep -Eq '^[[:space:]]+id-token:' <<<"${npm_top_permissions}"; then
  violations+=("$(relative_path "${npm_workflow}"): id-token must not be granted at workflow scope")
fi

if ! grep -Eq '^[[:space:]]{4}permissions:[[:space:]]*$' <<<"${npm_publish_job}"; then
  violations+=("$(relative_path "${npm_workflow}"): publish job must declare local permissions")
else
  if ! grep -Eq '^[[:space:]]+contents:[[:space:]]*read[[:space:]]*$' <<<"${npm_publish_job}"; then
    violations+=("$(relative_path "${npm_workflow}"): publish job permissions must include contents: read for checkout")
  fi
  if ! grep -Eq '^[[:space:]]+id-token:[[:space:]]*write[[:space:]]*$' <<<"${npm_publish_job}"; then
    violations+=("$(relative_path "${npm_workflow}"): publish job permissions must include id-token: write")
  fi
fi

for chart in indexer merchant-api; do
  chart_dir="${REPO_ROOT}/infra/helm/${chart}"
  values_file="${chart_dir}/values.yaml"
  serviceaccount_template="${chart_dir}/templates/serviceaccount.yaml"
  workload_template="${chart_dir}/templates/deployment.yaml"
  if [ "${chart}" = "indexer" ]; then
    workload_template="${chart_dir}/templates/statefulset.yaml"
  fi

  if ! grep -Eq '^[[:space:]]{2}automountServiceAccountToken:[[:space:]]*false[[:space:]]*$' "${values_file}"; then
    violations+=("$(relative_path "${values_file}"): serviceAccount.automountServiceAccountToken must default to false")
  fi

  if ! grep -Eq '^[[:space:]]*automountServiceAccountToken:[[:space:]]*\{\{[[:space:]]*\.Values\.serviceAccount\.automountServiceAccountToken[[:space:]]*\}\}[[:space:]]*$' "${serviceaccount_template}"; then
    violations+=("$(relative_path "${serviceaccount_template}"): ServiceAccount must render automountServiceAccountToken from values")
  fi

  if ! grep -Eq '^[[:space:]]*automountServiceAccountToken:[[:space:]]*\{\{[[:space:]]*\.Values\.serviceAccount\.automountServiceAccountToken[[:space:]]*\}\}[[:space:]]*$' "${workload_template}"; then
    violations+=("$(relative_path "${workload_template}"): pod spec must render automountServiceAccountToken from values")
  fi
done

cloud_init="${REPO_ROOT}/infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl"
env_block="$(file_block_for_path "${cloud_init}" '/etc/tonbankcard/\.env')"

if ! grep -Eq '^[[:space:]]+permissions:[[:space:]]*"0600"[[:space:]]*$' <<<"${env_block}"; then
  violations+=("$(relative_path "${cloud_init}"): /etc/tonbankcard/.env must be written with permissions 0600")
fi

if ! grep -Eq '^[[:space:]]+owner:[[:space:]]*"tonbankcard:tonbankcard"[[:space:]]*$' <<<"${env_block}"; then
  violations+=("$(relative_path "${cloud_init}"): /etc/tonbankcard/.env must be owned by tonbankcard:tonbankcard")
fi

compose_sandbox="${REPO_ROOT}/docker-compose.sandbox.yml"
env_sandbox_example="${REPO_ROOT}/.env.sandbox.example"
faucet_index="${REPO_ROOT}/scripts/faucet/src/index.ts"
faucet_server="${REPO_ROOT}/scripts/faucet/src/server.ts"
faucet_readme="${REPO_ROOT}/scripts/faucet/README.md"

for required in FAUCET_RATE_LIMIT_WINDOW_MS FAUCET_RATE_LIMIT_MAX; do
  for file in "${compose_sandbox}" "${env_sandbox_example}" "${faucet_index}" "${faucet_readme}"; do
    if ! grep -q "${required}" "${file}"; then
      violations+=("$(relative_path "${file}"): missing ${required}")
    fi
  done
done

if grep -Eq 'windowSeconds:[[:space:]]*3600|maxPerWindow:[[:space:]]*1' "${faucet_server}"; then
  violations+=("$(relative_path "${faucet_server}"): /faucet/status must report the configured rate limiter values, not hard-coded defaults")
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  tmp_env="$(mktemp)"
  tmp_config="$(mktemp)"

  cleanup() {
    rm -f "${tmp_env}" "${tmp_config}"
  }
  trap cleanup EXIT

  cat > "${tmp_env}" <<'ENV'
SANDBOX_API_KEY_SECRET=compose-policy-test-secret-please-change
FAUCET_RATE_LIMIT_WINDOW_MS=120000
FAUCET_RATE_LIMIT_MAX=3
REDIS_PASSWORD=compose-policy-test-redis-password
ENV

  if docker compose --env-file "${tmp_env}" -f "${compose_sandbox}" config > "${tmp_config}"; then
    faucet_block="$(service_block "${tmp_config}" faucet)"

    if ! grep -Eq 'FAUCET_RATE_LIMIT_WINDOW_MS:[[:space:]]*"?120000"?' <<<"${faucet_block}"; then
      violations+=("$(relative_path "${compose_sandbox}"): rendered faucet service must preserve FAUCET_RATE_LIMIT_WINDOW_MS")
    fi
    if ! grep -Eq 'FAUCET_RATE_LIMIT_MAX:[[:space:]]*"?3"?' <<<"${faucet_block}"; then
      violations+=("$(relative_path "${compose_sandbox}"): rendered faucet service must preserve FAUCET_RATE_LIMIT_MAX")
    fi
  else
    violations+=("$(relative_path "${compose_sandbox}"): docker compose config failed with faucet rate-limit test environment")
  fi
else
  echo "WARN: docker compose is not available; source policy checks were run without rendered sandbox compose config." >&2
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::DEVOPS-LOW hardening policy failed:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: DEVOPS-LOW hardening policy is satisfied."
