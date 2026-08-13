#!/usr/bin/env bash
# CHECK423-M2: ensure every shipped npm workspace with a committed lockfile is
# represented in the scheduled dependency-audit matrix. Test-only workspaces
# under tests/ are intentionally excluded.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW="${REPO_ROOT}/.github/workflows/dependency-audit.yml"

required_workspaces=(
  api
  backend/indexer
  dashboard
  docs-site
  mobile
  mobile-app
  scripts/faucet
  sdk
  wallet-ui
)

# Keep the explicit baseline above so deleting a lockfile cannot silently shrink
# the control. Also discover newly committed non-test lockfiles so adding a new
# shipped workspace requires adding it to the audit matrix in the same PR.
while IFS= read -r lockfile; do
  workspace="${lockfile%/package-lock.json}"
  case "${workspace}" in
    tests/*) continue ;;
  esac

  already_required=false
  for required in "${required_workspaces[@]}"; do
    if [ "${required}" = "${workspace}" ]; then
      already_required=true
      break
    fi
  done

  if [ "${already_required}" = false ]; then
    required_workspaces+=("${workspace}")
  fi
done < <(git -C "${REPO_ROOT}" ls-files '**/package-lock.json' | sort)

violations=()

for workspace in "${required_workspaces[@]}"; do
  if [ ! -f "${REPO_ROOT}/${workspace}/package-lock.json" ]; then
    violations+=("${workspace}: package-lock.json is missing")
    continue
  fi

  if ! grep -Eq "^[[:space:]]+path:[[:space:]]+${workspace}$" "${WORKFLOW}"; then
    violations+=("${workspace}: absent from dependency-audit.yml matrix")
  fi
done

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Dependency-audit coverage is incomplete:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: all ${#required_workspaces[@]} shipped locked npm workspaces are audited."
