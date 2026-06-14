#!/usr/bin/env bash
#
# Issue #399 finding 2 — the DEVOPS-M2 npm-ci guard only scanned ci.yml, so the
# docs-site workflow drifted back to `npm install` unguarded. This script proves
# the generalized guard flags a `npm install` in docs-site.yml and passes once
# it is `npm ci`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GUARD="${REPO_ROOT}/scripts/tooling/check-ci-npm-ci.sh"
WORKFLOW="${REPO_ROOT}/.github/workflows/docs-site.yml"

echo "== current tree should pass =="
bash "${GUARD}"

echo
echo "== inject npm install drift into docs-site.yml; guard must fail =="
backup="$(mktemp)"
cp "${WORKFLOW}" "${backup}"
trap 'cp "${backup}" "${WORKFLOW}"; rm -f "${backup}"' EXIT

# Flip the docs-site install step back to npm install.
sed -i 's/run: npm ci --no-audit --no-fund/run: npm install --no-audit --no-fund/' "${WORKFLOW}"

if bash "${GUARD}"; then
  echo "FAIL: guard did not flag the injected npm install drift" >&2
  exit 1
fi
echo "OK: guard flagged the injected drift as expected."
