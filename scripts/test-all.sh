#!/usr/bin/env bash
# scripts/test-all.sh — Run `npm test` in every runtime package.
# Used by `npm test` from the repository root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PACKAGES=(
  "sdk"
  "api"
  "backend/indexer"
  "wallet-ui"
  "mobile"
  "dashboard"
)

failures=()

for pkg in "${PACKAGES[@]}"; do
  if [[ ! -d "$REPO_ROOT/$pkg" ]]; then continue; fi
  if ! node -e "const p=require('$REPO_ROOT/$pkg/package.json');process.exit(p.scripts&&p.scripts.test?0:1)" 2>/dev/null; then
    continue
  fi
  echo "==> Testing $pkg"
  if ! (cd "$REPO_ROOT/$pkg" && npm test); then
    failures+=("$pkg")
  fi
done

if [[ ${#failures[@]} -gt 0 ]]; then
  echo
  echo "✗ Tests failed in: ${failures[*]}" >&2
  exit 1
fi

echo
echo "✓ All package test suites passed."
