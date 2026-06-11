#!/usr/bin/env bash
#
# check-dockerfile-npm-ci.sh
#
# Policy guard for audit finding PC-08 (pre-check #368 / issue #377).
#
# Asserts that every Dockerfile whose build context ships a committed
# package-lock.json installs Node dependencies reproducibly:
#
#   1. it never installs with `npm install` / `npm i` (which re-resolves the
#      dependency graph and ignores the locked, audit-verified tree),
#   2. it installs with `npm ci` (which honours the lockfile exactly and fails
#      fast when package.json and package-lock.json drift),
#   3. it COPYs package-lock.json into the image so `npm ci` actually has the
#      lockfile to honour, and
#   4. its .dockerignore (if any) does not exclude package-lock.json from the
#      build context — otherwise the COPY would silently drop the lockfile and
#      `npm ci` would fail.
#
# The build context for these images is the Dockerfile's own directory (that is
# how `api/Dockerfile` and `backend/indexer/Dockerfile` are built), so a sibling
# package-lock.json defines the scope. Dockerfiles without a committed lockfile
# in their context — e.g. `scripts/faucet/Dockerfile` — are out of scope and
# skipped, mirroring the finding. Dockerfiles that do not touch npm at all are
# likewise skipped (nothing to lock).
#
# Exit status:
#   0 - every locked Dockerfile copies the lockfile and installs with npm ci
#   1 - one or more locked Dockerfiles ignore the lockfile / use npm install
#
# References:
#   * issue #377 (PC-08)
#   * audit/precheck-368/findings/PC-08-dockerfile-npm-install-ignores-lockfile.md
#   * sibling guard for CI workflows: scripts/tooling/check-ci-npm-ci.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Emit a Dockerfile's logical lines: full-line comments dropped, CRLF tolerated,
# and backslash line-continuations joined so a multi-line RUN is matched whole.
logical_lines() {
  awk '
    { sub(/\r$/, "") }
    /^[[:space:]]*#/ { next }
    {
      line = $0
      while (line ~ /\\[[:space:]]*$/) {
        sub(/\\[[:space:]]*$/, "", line)
        if ((getline cont) <= 0) break
        sub(/\r$/, "", cont)
        sub(/^[[:space:]]*#.*$/, "", cont)
        line = line cont
      }
      print line
    }
  ' "$1"
}

# Bare (non-global) `npm install` / `npm i` invocations inside RUN instructions.
npm_install_invocations() {
  logical_lines "$1" \
    | grep -E '^[[:space:]]*RUN([[:space:]]|$)' \
    | grep -Eo 'npm[[:space:]]+(install|i)([[:space:]][^&|;]*|$)' \
    | grep -Ev -- '(^|[[:space:]])(-g|--global)([[:space:]]|$)' || true
}

# Does the Dockerfile run `npm ci` in any RUN instruction?
uses_npm_ci() {
  logical_lines "$1" \
    | grep -E '^[[:space:]]*RUN([[:space:]]|$)' \
    | grep -Eq '(^|[[:space:]])npm[[:space:]]+ci([[:space:]]|$)'
}

# Does the Dockerfile touch npm at all (install/ci/prune/...) in a RUN?
uses_npm() {
  logical_lines "$1" \
    | grep -E '^[[:space:]]*RUN([[:space:]]|$)' \
    | grep -Eq '(^|[[:space:]])npm([[:space:]]|$)'
}

# Does a COPY instruction list package-lock.json as a source token?
copies_lockfile() {
  logical_lines "$1" \
    | grep -E '^[[:space:]]*COPY([[:space:]]|$)' \
    | grep -Eq '[[:space:]]package-lock\.json([[:space:]]|$)'
}

# Does <dir>/.dockerignore exclude package-lock.json from the build context?
# Honours "last matching pattern wins" and `!` re-include negations.
dockerignore_excludes_lockfile() {
  local ignore="$1/.dockerignore"
  [ -f "$ignore" ] || return 1
  local target="package-lock.json"
  local verdict="included"
  local raw pat
  while IFS= read -r raw || [ -n "$raw" ]; do
    pat="${raw%%#*}"
    pat="${pat#"${pat%%[![:space:]]*}"}"
    pat="${pat%"${pat##*[![:space:]]}"}"
    [ -n "$pat" ] || continue
    if [[ "$pat" == '!'* ]]; then
      pat="${pat#!}"; pat="${pat#/}"; pat="${pat%/}"
      # shellcheck disable=SC2053
      [[ "$target" == $pat ]] && verdict="included"
    else
      pat="${pat#/}"; pat="${pat%/}"
      # shellcheck disable=SC2053
      [[ "$target" == $pat ]] && verdict="excluded"
    fi
  done < "$ignore"
  [ "$verdict" = "excluded" ]
}

violations=()
checked=0

while IFS= read -r dockerfile; do
  dir="$(dirname "$dockerfile")"

  # Scope: only Dockerfiles whose build context ships a committed lockfile and
  # that actually install Node dependencies.
  [ -f "${REPO_ROOT}/${dir}/package-lock.json" ] || continue
  uses_npm "${REPO_ROOT}/${dockerfile}" || continue

  checked=$((checked + 1))
  df="${REPO_ROOT}/${dockerfile}"

  while IFS= read -r bad; do
    [ -n "$bad" ] || continue
    normalized="$(printf '%s' "$bad" | tr -s '[:space:]' ' ')"
    normalized="${normalized%"${normalized##*[![:space:]]}"}"
    violations+=("${dockerfile}: uses '${normalized}' but ${dir}/package-lock.json is committed; install with 'npm ci'")
  done < <(npm_install_invocations "$df")

  if ! uses_npm_ci "$df"; then
    violations+=("${dockerfile}: installs npm dependencies without 'npm ci' despite ${dir}/package-lock.json")
  fi

  if ! copies_lockfile "$df"; then
    violations+=("${dockerfile}: does not COPY package-lock.json into the image; 'npm ci' needs the lockfile")
  fi

  if dockerignore_excludes_lockfile "${REPO_ROOT}/${dir}"; then
    violations+=("${dir}/.dockerignore: excludes package-lock.json from the build context, so the COPY would silently omit it")
  fi
done < <(git -C "${REPO_ROOT}" ls-files | grep -iE '(^|/)Dockerfile$')

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Locked Dockerfiles must COPY package-lock.json and install with npm ci:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: all ${checked} locked Dockerfile(s) COPY package-lock.json and install with npm ci."
