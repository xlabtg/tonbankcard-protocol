#!/usr/bin/env bash
#
# check-workflow-action-pins.sh
#
# Policy guard for audit finding DEVOPS-M1.
#
# Asserts that third-party GitHub Actions under .github/workflows are pinned to
# full commit SHAs and keep a trailing human-readable version comment. Mutable
# tags and branches can be moved upstream, which makes CI execution
# non-reproducible and exposes repository tokens to unexpected code.
#
# First-party GitHub-maintained actions under actions/* and github/* are
# intentionally exempted here; DEVOPS-M1 targets third-party action pinning.
#
# Exit status:
#   0 - every third-party action is SHA-pinned with a version comment
#   1 - one or more third-party actions use mutable refs or lack comments
#
# References:
#   * issue #283 (DEVOPS-M1)
#   * audit/findings/DEVOPS-M1-actions-pinned-to-mutable-tags.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/.github/workflows"
SHA_RE='^[0-9a-fA-F]{40}$'

if [ ! -d "${WORKFLOW_DIR}" ]; then
  echo "::error::No .github/workflows directory found at ${WORKFLOW_DIR}" >&2
  exit 1
fi

is_first_party_action() {
  case "$1" in
    actions/*|github/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

violations=()
checked=0

while IFS= read -r -d '' workflow; do
  line_no=0
  while IFS= read -r line || [ -n "${line}" ]; do
    line_no=$((line_no + 1))

    if [[ ! "${line}" =~ ^[[:space:]-]*uses:[[:space:]]*([^[:space:]#]+)([[:space:]]*#.*)?$ ]]; then
      continue
    fi

    action="${BASH_REMATCH[1]}"
    comment="${BASH_REMATCH[2]:-}"
    action="${action%\"}"
    action="${action#\"}"
    action="${action%\'}"
    action="${action#\'}"

    case "${action}" in
      ./*|docker://*)
        continue
        ;;
    esac

    if is_first_party_action "${action}"; then
      continue
    fi

    checked=$((checked + 1))
    location="${workflow#"${REPO_ROOT}/"}:${line_no}"

    if [[ "${action}" != *@* ]]; then
      violations+=("${location} uses '${action}' without an explicit ref")
      continue
    fi

    ref="${action##*@}"
    if [[ ! "${ref}" =~ ${SHA_RE} ]]; then
      violations+=("${location} uses '${action}' with a mutable ref; pin it to a 40-character commit SHA")
      continue
    fi

    comment_text="${comment#*#}"
    if [[ -z "${comment_text//[[:space:]]/}" ]]; then
      violations+=("${location} uses '${action}' without a trailing version comment")
    fi
  done < "${workflow}"
done < <(find "${WORKFLOW_DIR}" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 | sort -z)

if [ "${checked}" -eq 0 ]; then
  echo "OK: no third-party GitHub Actions found in .github/workflows."
  exit 0
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Third-party GitHub Actions must be pinned to full commit SHAs with version comments:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  echo "" >&2
  echo "Use the resolved upstream commit SHA and keep the readable ref as a comment, e.g.:" >&2
  echo "  uses: owner/action@0123456789abcdef0123456789abcdef01234567  # v1.2.3" >&2
  exit 1
fi

echo "OK: all ${checked} third-party GitHub Action reference(s) are SHA-pinned with version comments."
