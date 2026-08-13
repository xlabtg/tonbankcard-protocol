#!/usr/bin/env bash
# scripts/smoke-test.sh — Minimal post-setup verification.
#
# What this checks:
#   1. The SDK build artifact exists and the entry point loads
#   2. The SDK exports `TonbankcardSDK`
#   3. The merchant API entry-point compiles and a require of dist/index.js
#      does not throw before the express listener call. (We skip listener
#      execution by checking the build only.)
#
# This is intentionally tiny — it must complete in seconds and not need a
# network. CI runs a richer pipeline (the existing `npm test` jobs).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------- SDK ------------------------------------------------------------
SDK_DIST="$REPO_ROOT/sdk/dist/index.js"
if [[ ! -f "$SDK_DIST" ]]; then
  echo "✗ smoke: SDK build artifact missing ($SDK_DIST)" >&2
  exit 1
fi

node -e "
  const sdk = require('$SDK_DIST');
  if (!sdk.TonbankcardSDK) {
    console.error('✗ smoke: TonbankcardSDK export missing');
    process.exit(1);
  }
  if (typeof sdk.formatTBC !== 'function') {
    console.error('✗ smoke: formatTBC helper missing');
    process.exit(1);
  }
  // Quick functional check — round-trip a TBC amount through the helpers.
  const wei = sdk.parseTBC('1');
  const human = sdk.formatTBC(wei);
  if (human !== '1.00') {
    console.error('✗ smoke: TBC helpers returned unexpected result: ' + human);
    process.exit(1);
  }
"
echo "✓ smoke: SDK loads and helpers round-trip"

# ---------- API ------------------------------------------------------------
API_DIST="$REPO_ROOT/api/dist/index.js"
if [[ -f "$API_DIST" ]]; then
  # The API entry-point starts an HTTP listener at require time. We check
  # only that the compiled file exists and is syntactically valid JS.
  node --check "$API_DIST"
  echo "✓ smoke: API compiled artifact parses"
else
  echo "! smoke: API dist not found — skipping (run \`npm run build\` first)"
fi

echo
echo "✓ Smoke test passed."
