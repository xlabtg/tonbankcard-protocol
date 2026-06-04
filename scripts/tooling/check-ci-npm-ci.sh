#!/usr/bin/env bash
#
# check-ci-npm-ci.sh
#
# Policy guard for audit finding DEVOPS-M2.
#
# Asserts that install steps in .github/workflows/ci.yml use `npm ci` whenever
# the step's working directory has a committed package-lock.json. `npm ci`
# preserves the audited lockfile exactly and fails fast when package.json and
# package-lock.json drift.
#
# Exit status:
#   0 - every locked npm workspace install step in ci.yml uses npm ci
#   1 - one or more locked npm workspace install steps use npm install
#
# References:
#   * issue #284 (DEVOPS-M2)
#   * audit/findings/DEVOPS-M2-ci-uses-npm-install-not-npm-ci.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CI_WORKFLOW="${REPO_ROOT}/.github/workflows/ci.yml"

if [ ! -f "${CI_WORKFLOW}" ]; then
  echo "::error::No CI workflow found at ${CI_WORKFLOW}" >&2
  exit 1
fi

trim_yaml_value() {
  local value="$1"
  value="${value%%#*}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "${value}"
}

violations=()
locked_npm_steps=0
line_no=0
working_directory="."

while IFS= read -r line || [ -n "${line}" ]; do
  line_no=$((line_no + 1))

  if [[ "${line}" =~ ^[[:space:]]*-[[:space:]]+(name|uses): ]]; then
    working_directory="."
  fi

  if [[ "${line}" =~ ^[[:space:]]*working-directory:[[:space:]]*(.+)$ ]]; then
    working_directory="$(trim_yaml_value "${BASH_REMATCH[1]}")"
    continue
  fi

  if [[ ! "${line}" =~ ^[[:space:]]*run:[[:space:]]*(npm[[:space:]]+(install|ci)([[:space:]].*)?)$ ]]; then
    continue
  fi

  command="$(trim_yaml_value "${BASH_REMATCH[1]}")"
  lockfile="${REPO_ROOT}/${working_directory}/package-lock.json"

  if [ ! -f "${lockfile}" ]; then
    continue
  fi

  locked_npm_steps=$((locked_npm_steps + 1))

  if [[ ! "${command}" =~ ^npm[[:space:]]+install([[:space:]].*)?$ ]]; then
    continue
  fi

  location="${CI_WORKFLOW#"${REPO_ROOT}/"}:${line_no}"
  install_args="${command#npm install}"
  violations+=("${location} uses '${command}' in '${working_directory}' despite ${working_directory}/package-lock.json; use 'npm ci${install_args}'")
done < "${CI_WORKFLOW}"

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Locked npm workspaces in .github/workflows/ci.yml must install with npm ci:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: all ${locked_npm_steps} locked npm workspace install step(s) in .github/workflows/ci.yml use npm ci."
