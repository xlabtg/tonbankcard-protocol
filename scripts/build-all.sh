#!/usr/bin/env bash
# scripts/build-all.sh — Build every runtime package in dependency order.
# Used by `npm run build` from the repository root.

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

for pkg in "${PACKAGES[@]}"; do
  if [[ ! -d "$REPO_ROOT/$pkg" ]]; then continue; fi
  if ! node -e "const p=require('$REPO_ROOT/$pkg/package.json');process.exit(p.scripts&&p.scripts.build?0:1)" 2>/dev/null; then
    continue
  fi
  echo "==> Building $pkg"
  (cd "$REPO_ROOT/$pkg" && npm run build)
done
