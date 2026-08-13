#!/usr/bin/env bash
#
# check-ci-npm-ci.sh
#
# Policy guard for audit finding DEVOPS-M2.
#
# Asserts that install steps in EVERY .github/workflows/*.yml workflow use
# `npm ci` whenever the step's working directory has a committed
# package-lock.json. `npm ci` preserves the audited lockfile exactly and fails
# fast when package.json and package-lock.json drift.
#
# The guard originally watched only ci.yml, which let a sibling workflow
# (docs-site.yml, working-directory docs-site with a committed lockfile) drift
# back to `npm install` unnoticed. Scanning every workflow closes that gap so
# the class of finding cannot recur in any new or existing workflow. Steps
# whose working directory ships no package-lock.json — e.g. the contract and
# adversarial-test installs that intentionally re-resolve — are out of scope
# and skipped, mirroring the finding.
#
# Exit status:
#   0 - every locked npm workspace install step across all workflows uses npm ci
#   1 - one or more locked npm workspace install steps use npm install
#
# References:
#   * issue #284 (DEVOPS-M2)
#   * issue #399 (docs-site npm install drift)
#   * audit/findings/DEVOPS-M2-ci-uses-npm-install-not-npm-ci.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/.github/workflows"

if [ ! -d "${WORKFLOW_DIR}" ]; then
  echo "::error::No workflow directory found at ${WORKFLOW_DIR}" >&2
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

scan_workflow() {
  local workflow="$1"
  local rel="${workflow#"${REPO_ROOT}/"}"
  local line_no=0
  local working_directory="."
  local line command lockfile location install_args

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

    if [ ! -f "${lockfile}" ] ||
       ! git -C "${REPO_ROOT}" ls-files --error-unmatch -- "${lockfile#"${REPO_ROOT}/"}" >/dev/null 2>&1; then
      continue
    fi

    if [[ ! "${command}" =~ ^npm[[:space:]]+install([[:space:]].*)?$ ]]; then
      locked_npm_steps=$((locked_npm_steps + 1))
      continue
    fi

    # Global tool installations do not consume the workspace lockfile, so
    # replacing them with npm ci would be both misleading and invalid.
    if [[ " ${command} " =~ [[:space:]]-g[[:space:]] ]] ||
       [[ " ${command} " =~ [[:space:]]--global[[:space:]] ]]; then
      continue
    fi

    locked_npm_steps=$((locked_npm_steps + 1))

    location="${rel}:${line_no}"
    install_args="${command#npm install}"
    violations+=("${location} uses '${command}' in '${working_directory}' despite ${working_directory}/package-lock.json; use 'npm ci${install_args}'")
  done < "${workflow}"
}

shopt -s nullglob
workflows=("${WORKFLOW_DIR}"/*.yml "${WORKFLOW_DIR}"/*.yaml)
shopt -u nullglob

if [ "${#workflows[@]}" -eq 0 ]; then
  echo "::error::No workflow files found in ${WORKFLOW_DIR}" >&2
  exit 1
fi

for workflow in "${workflows[@]}"; do
  scan_workflow "${workflow}"
done

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Locked npm workspaces in .github/workflows/ must install with npm ci:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: all ${locked_npm_steps} locked npm workspace install step(s) across .github/workflows/ use npm ci."
