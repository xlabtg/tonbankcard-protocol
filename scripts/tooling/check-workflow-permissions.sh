#!/usr/bin/env bash
#
# check-workflow-permissions.sh
#
# Policy guard for audit finding DEVOPS-H3.
#
# Asserts that every GitHub Actions workflow under .github/workflows declares an
# explicit top-level `permissions:` block. Without it, GITHUB_TOKEN falls back to
# the repository-wide default scope (often the legacy read-write default), which
# violates least-privilege and lets a compromised step push commits or tamper
# with releases.
#
# A top-level block lives at column 0, so we match `^permissions:`; job-level
# blocks are indented and intentionally do not satisfy this check on their own.
#
# Exit status:
#   0 — every workflow declares a top-level permissions block
#   1 — one or more workflows are missing it (names printed to stderr)
#
# References:
#   * issue #263 (DEVOPS-H3)
#   * audit/findings/DEVOPS-H3-workflows-missing-permissions-hardening.md

set -euo pipefail

# Resolve the repository root from this script's location so the check works
# regardless of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/.github/workflows"

if [ ! -d "${WORKFLOW_DIR}" ]; then
  echo "::error::No .github/workflows directory found at ${WORKFLOW_DIR}" >&2
  exit 1
fi

missing=()
checked=0

while IFS= read -r -d '' workflow; do
  checked=$((checked + 1))
  # `^permissions:` matches only an unindented (top-level) key.
  if ! grep -Eq '^permissions:' "${workflow}"; then
    missing+=("${workflow#"${REPO_ROOT}/"}")
  fi
done < <(find "${WORKFLOW_DIR}" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 | sort -z)

if [ "${checked}" -eq 0 ]; then
  echo "::error::No workflow files (*.yml/*.yaml) found in ${WORKFLOW_DIR}" >&2
  exit 1
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error::The following workflow(s) lack an explicit top-level 'permissions:' block:" >&2
  for f in "${missing[@]}"; do
    echo "  - ${f}" >&2
  done
  echo "" >&2
  echo "Add a least-privilege default at the top level, e.g.:" >&2
  echo "" >&2
  echo "  permissions:" >&2
  echo "    contents: read" >&2
  echo "" >&2
  echo "Elevate scopes per-job only where required (see DEVOPS-H3)." >&2
  exit 1
fi

echo "OK: all ${checked} workflow(s) declare an explicit top-level 'permissions:' block."
