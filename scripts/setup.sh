#!/usr/bin/env bash
# =============================================================================
# scripts/setup.sh — One-command developer quickstart for Tonbankcard Protocol
# =============================================================================
#
# Goal (Issue #125):
#   * Bring a freshly cloned repo to a working state in < 5 minutes
#   * Install dependencies in all six runtime packages
#   * Build them in dependency order (sdk → api/indexer → wallet-ui/mobile/dashboard)
#   * Run a quick smoke test that verifies the SDK is loadable
#
# Design notes:
#   * 100% local — never downloads or executes arbitrary remote code beyond
#     `npm install`. No `curl | bash`, no `wget | sh`.
#   * Idempotent — safe to re-run; uses `npm ci` when a lockfile is present so
#     repeat runs are reproducible.
#   * Cross-platform — works on macOS, Linux, and Windows WSL2 (POSIX bash).
#   * Verbose by default; honours `SETUP_QUIET=1` for CI invocation.
#   * Flags:
#       --install-only    install deps only, skip build + smoke
#       --check           verify prerequisites only, no install
#       --no-smoke        install + build, skip smoke test
#       --skip <pkg>      comma-separated list of packages to skip
#
# Compliance with CONTRIBUTING.md:
#   * No admin/custody surface is introduced.
#   * No protocol economics are touched.
#   * Strict scope: implements only what Issue #125 specifies.
# =============================================================================

set -euo pipefail

# ---------- pretty output --------------------------------------------------
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" != "1" ]]; then
  C_RESET='\033[0m'
  C_BOLD='\033[1m'
  C_DIM='\033[2m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_RED='\033[31m'
  C_BLUE='\033[34m'
else
  C_RESET=''
  C_BOLD=''
  C_DIM=''
  C_GREEN=''
  C_YELLOW=''
  C_RED=''
  C_BLUE=''
fi

log()    { printf '%b%s%b\n' "${C_BLUE}" "==> $*" "${C_RESET}"; }
ok()     { printf '%b%s%b\n' "${C_GREEN}" "✓ $*" "${C_RESET}"; }
warn()   { printf '%b%s%b\n' "${C_YELLOW}" "! $*" "${C_RESET}" >&2; }
fail()   { printf '%b%s%b\n' "${C_RED}" "✗ $*" "${C_RESET}" >&2; }
section(){ printf '\n%b%s%b\n' "${C_BOLD}" "── $* ──" "${C_RESET}"; }

# ---------- repo root ------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------- arg parsing ----------------------------------------------------
DO_INSTALL=1
DO_BUILD=1
DO_SMOKE=1
SKIP_PACKAGES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-only) DO_BUILD=0; DO_SMOKE=0; shift ;;
    --check)        DO_INSTALL=0; DO_BUILD=0; DO_SMOKE=0; shift ;;
    --no-smoke)     DO_SMOKE=0; shift ;;
    --skip)         SKIP_PACKAGES="$2"; shift 2 ;;
    -h|--help)
      cat <<EOF
Usage: scripts/setup.sh [--install-only] [--check] [--no-smoke] [--skip pkg1,pkg2]

  --install-only   install dependencies, skip build + smoke
  --check          verify prerequisites only (no install/build/smoke)
  --no-smoke       install + build, but skip the smoke test
  --skip <list>    comma-separated package directories to skip
                   (valid: sdk, api, backend/indexer, wallet-ui, mobile,
                   dashboard, examples/merchant-demo)
EOF
      exit 0
      ;;
    *) fail "Unknown argument: $1"; exit 2 ;;
  esac
done

is_skipped() {
  local pkg="$1"
  [[ -z "$SKIP_PACKAGES" ]] && return 1
  case ",$SKIP_PACKAGES," in
    *,"$pkg",*) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------- prerequisites --------------------------------------------------
section "Checking prerequisites"

REQUIRED_NODE_MAJOR=18

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js is not installed. Install Node.js LTS (>= ${REQUIRED_NODE_MAJOR}) from https://nodejs.org"
  exit 1
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "$NODE_VERSION" | sed -E 's/^v([0-9]+)\..*/\1/')"
if [[ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]]; then
  fail "Node.js >= ${REQUIRED_NODE_MAJOR} required (found $NODE_VERSION)"
  exit 1
fi
ok "Node.js $NODE_VERSION"

if ! command -v npm >/dev/null 2>&1; then
  fail "npm is not installed. It ships with Node.js — reinstall Node.js LTS."
  exit 1
fi
ok "npm $(npm --version)"

if ! command -v git >/dev/null 2>&1; then
  warn "git is not installed. Some development workflows will not work."
else
  ok "git $(git --version | awk '{print $3}')"
fi

if [[ "$DO_INSTALL" -eq 0 ]] && [[ "$DO_BUILD" -eq 0 ]] && [[ "$DO_SMOKE" -eq 0 ]]; then
  ok "Prerequisites OK. --check finished."
  exit 0
fi

# ---------- package matrix -------------------------------------------------
# Order matters: SDK is built first because the demo + other consumers may
# import its types. The runtime packages (api, indexer) follow, then UIs.
# The merchant-demo is installed last so it can pick up the freshly-built
# SDK bundle via the local /vendor/tonbankcard.global.js route.
PACKAGES=(
  "sdk"
  "api"
  "backend/indexer"
  "wallet-ui"
  "mobile"
  "dashboard"
  "examples/merchant-demo"
)

# ---------- install --------------------------------------------------------
install_pkg() {
  local pkg="$1"
  local pkg_dir="$REPO_ROOT/$pkg"

  if is_skipped "$pkg"; then
    warn "Skipping $pkg (--skip)"
    return 0
  fi

  if [[ ! -d "$pkg_dir" ]]; then
    warn "Skipping $pkg — directory not found"
    return 0
  fi

  log "Installing dependencies in $pkg"
  # Use `|` as the sed delimiter because $pkg can contain `/`
  # (e.g. `backend/indexer`), which would otherwise break `s/.../.../`.
  if [[ -f "$pkg_dir/package-lock.json" ]]; then
    (cd "$pkg_dir" && npm ci --no-audit --no-fund --prefer-offline 2>&1 | sed "s|^|    [$pkg] |") || {
      warn "npm ci failed in $pkg — falling back to npm install"
      (cd "$pkg_dir" && npm install --no-audit --no-fund 2>&1 | sed "s|^|    [$pkg] |")
    }
  else
    (cd "$pkg_dir" && npm install --no-audit --no-fund 2>&1 | sed "s|^|    [$pkg] |")
  fi
  ok "Installed: $pkg"
}

if [[ "$DO_INSTALL" -eq 1 ]]; then
  section "Installing dependencies (${#PACKAGES[@]} packages)"
  for pkg in "${PACKAGES[@]}"; do
    install_pkg "$pkg"
  done
fi

# ---------- build ----------------------------------------------------------
build_pkg() {
  local pkg="$1"
  local pkg_dir="$REPO_ROOT/$pkg"

  if is_skipped "$pkg"; then return 0; fi
  if [[ ! -d "$pkg_dir" ]]; then return 0; fi

  # Only attempt to build packages that define a `build` script.
  if ! node -e "const p=require('$pkg_dir/package.json');process.exit(p.scripts&&p.scripts.build?0:1)" 2>/dev/null; then
    warn "Skipping build in $pkg — no \`build\` script"
    return 0
  fi

  log "Building $pkg"
  (cd "$pkg_dir" && npm run build 2>&1 | sed "s|^|    [$pkg] |") || {
    fail "Build failed in $pkg"
    return 1
  }
  ok "Built: $pkg"
}

if [[ "$DO_BUILD" -eq 1 ]]; then
  section "Building packages (dependency order)"
  for pkg in "${PACKAGES[@]}"; do
    build_pkg "$pkg"
  done
fi

# ---------- smoke test -----------------------------------------------------
if [[ "$DO_SMOKE" -eq 1 ]]; then
  section "Running smoke test"
  bash "$REPO_ROOT/scripts/smoke-test.sh"
fi

# ---------- done -----------------------------------------------------------
section "Setup complete"
ok "Tonbankcard Protocol developer environment is ready."
cat <<EOF

${C_BOLD}Next steps:${C_RESET}
  • Try the merchant demo:   ${C_BLUE}npm run demo${C_RESET}
  • Run all tests:           ${C_BLUE}npm test${C_RESET}
  • Read CONTRIBUTING.md:    ${C_BLUE}less CONTRIBUTING.md${C_RESET}
  • Sandbox endpoints:       ${C_BLUE}docs/sandbox.md${C_RESET}

EOF
