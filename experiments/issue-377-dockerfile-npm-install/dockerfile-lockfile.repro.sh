#!/usr/bin/env bash
#
# dockerfile-lockfile.repro.sh
#
# Self-contained before/after reproduction of audit finding PC-08 (issue #377):
# "API & indexer Dockerfiles run npm install and ignore the committed lockfile".
#
# The finding is a build-reproducibility gap: the Dockerfiles copied only
# package.json and ran `npm install`, which re-resolves every range to the
# newest satisfying version instead of the exact, audited tree pinned in the
# committed package-lock.json. This script proves that gap with the real npm
# resolver, mirroring the Dockerfile COPY semantics, and then asserts that the
# repository's own Dockerfiles are now on the reproducible path.
#
#   Criterion 1 — runtime drift (needs npm + registry access):
#     A synthetic workspace declares `left-pad: ^1.1.3` and commits a lockfile
#     that pins the OLDER in-range 1.1.3 (left-pad is dependency-free and frozen
#     since 2016, so its 1.3.0 latest never moves).
#       BEFORE  build context = package.json ONLY  -> `npm install` installs
#               1.3.0 (latest in range), NOT what was locked/tested.
#       AFTER   build context = package.json + lockfile -> `npm ci` installs
#               exactly 1.1.3, the audited version.
#     It also shows `npm ci` REFUSES to run without a lockfile — which is why
#     the old Dockerfiles "worked around" the missing COPY with `npm install`.
#
#   Criterion 2 — repository state (always runs, no network):
#     api/Dockerfile and backend/indexer/Dockerfile COPY package-lock.json and
#     install with `npm ci`, and no longer run `npm install` for dependencies.
#
# The script exits non-zero unless the drift reproduces with `npm install` AND
# is closed by `npm ci` AND the committed Dockerfiles are on the fixed path, so
# it doubles as an assertion. If npm or the registry is unavailable, Criterion 1
# is skipped (Criterion 2 still runs).
#
# Usage:
#   experiments/issue-377-dockerfile-npm-install/dockerfile-lockfile.repro.sh
#
# This is an authorized internal audit reproduction. No secrets or real data are
# used; left-pad is a tiny, dependency-free public package used only as a stable
# version-drift fixture.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PKG="left-pad"
RANGE="^1.1.3"   # caret range kept in package.json (latest satisfying is 1.3.0)
PIN="1.1.3"      # older in-range version we lock and expect npm ci to honour

failures=0
note_fail() { echo "  ✗ $1"; failures=$((failures + 1)); }
note_ok() { echo "  ✓ $1"; }

installed_version() {
  node -e "process.stdout.write(require('$1/node_modules/$PKG/package.json').version)" 2>/dev/null || true
}

echo "============================================================"
echo " Criterion 1 — npm install re-resolves; npm ci honours the lock"
echo "============================================================"

if ! command -v npm >/dev/null 2>&1; then
  echo "  SKIP: npm is not available; cannot run the runtime drift reproduction."
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "${WORK}"' EXIT

  # Synthetic source workspace: package.json declares the caret RANGE, and a
  # committed lockfile pins the OLDER PIN version (generated with the resolver
  # so the lockfile and package.json stay in sync for `npm ci`).
  mkdir -p "${WORK}/src"
  cat > "${WORK}/src/package.json" <<EOF
{
  "name": "pc08-lockfile-demo",
  "version": "1.0.0",
  "private": true,
  "dependencies": { "${PKG}": "${RANGE}" }
}
EOF

  if ! npm install "${PKG}@${PIN}" --prefix "${WORK}/src" \
        --package-lock-only --no-audit --no-fund >/dev/null 2>&1; then
    echo "  SKIP: could not reach the npm registry to build the lockfile fixture."
  else
    locked="$(node -e "process.stdout.write(require('${WORK}/src/package-lock.json').packages['node_modules/${PKG}'].version)" 2>/dev/null || true)"
    echo "  lockfile pins ${PKG}@${locked} (package.json range stays ${RANGE})"

    # BEFORE — old Dockerfile: COPY package.json ./ (no lockfile) + npm install.
    before="${WORK}/ctx-before"; mkdir -p "${before}"
    cp "${WORK}/src/package.json" "${before}/"
    before_ok=1
    npm install --prefix "${before}" --no-audit --no-fund >/dev/null 2>&1 || before_ok=0
    before_ver="$(installed_version "${before}")"

    # AFTER — new Dockerfile: COPY package.json package-lock.json ./ + npm ci.
    after="${WORK}/ctx-after"; mkdir -p "${after}"
    cp "${WORK}/src/package.json" "${WORK}/src/package-lock.json" "${after}/"
    after_ok=1
    npm ci --prefix "${after}" --no-audit --no-fund >/dev/null 2>&1 || after_ok=0
    after_ver="$(installed_version "${after}")"

    # CONTROL — npm ci cannot run without the lockfile (old context lacked it).
    nolock="${WORK}/ctx-nolock"; mkdir -p "${nolock}"
    cp "${WORK}/src/package.json" "${nolock}/"
    nolock_rc=0
    npm ci --prefix "${nolock}" --no-audit --no-fund >/dev/null 2>&1 || nolock_rc=$?

    echo "  BEFORE 'COPY package.json' + npm install => ${PKG}@${before_ver:-<none>}"
    echo "  AFTER  'COPY …+lockfile'   + npm ci      => ${PKG}@${after_ver:-<none>}"
    echo "  CONTROL npm ci without a lockfile        => exit ${nolock_rc} (refuses)"

    if [ "${before_ok}" -eq 1 ] && [ -n "${before_ver}" ] && [ "${before_ver}" != "${locked}" ]; then
      note_ok "BEFORE: npm install pulled ${before_ver}, NOT the locked ${locked} — drift reproduced"
    else
      note_fail "BEFORE: expected npm install to resolve a version other than the locked ${locked}"
    fi

    if [ "${after_ok}" -eq 1 ] && [ "${after_ver}" = "${locked}" ]; then
      note_ok "AFTER: npm ci installed exactly the locked ${locked} — reproducible"
    else
      note_fail "AFTER: expected npm ci to install the locked ${locked}, got ${after_ver:-<none>}"
    fi

    if [ "${nolock_rc}" -ne 0 ]; then
      note_ok "CONTROL: npm ci refuses without a lockfile (so the old COPY forced npm install)"
    else
      note_fail "CONTROL: expected npm ci to fail when no lockfile is present"
    fi
  fi
fi

echo
echo "============================================================"
echo " Criterion 2 — the committed Dockerfiles are on the fixed path"
echo "============================================================"

assert_dockerfile_fixed() {
  local rel="$1"
  local file="${REPO_ROOT}/${rel}"
  if [ ! -f "${file}" ]; then
    note_fail "${rel}: file not found"
    return
  fi
  if grep -Eq '^[[:space:]]*COPY[[:space:]].*[[:space:]]package-lock\.json([[:space:]]|$)' "${file}"; then
    note_ok "${rel}: COPYs package-lock.json into the build"
  else
    note_fail "${rel}: does not COPY package-lock.json"
  fi
  if grep -Eq '^[[:space:]]*RUN[[:space:]].*npm[[:space:]]+ci([[:space:]]|$)' "${file}"; then
    note_ok "${rel}: installs with npm ci"
  else
    note_fail "${rel}: does not install with npm ci"
  fi
  if grep -Eq '^[[:space:]]*RUN[[:space:]].*npm[[:space:]]+install([[:space:]]|$)' "${file}"; then
    note_fail "${rel}: still runs npm install"
  else
    note_ok "${rel}: no npm install for dependencies"
  fi
}

assert_dockerfile_fixed "api/Dockerfile"
assert_dockerfile_fixed "backend/indexer/Dockerfile"

echo
if [ "${failures}" -eq 0 ]; then
  echo "RESULT: PC-08 reproduced (npm install drifts) and confirmed fixed (npm ci + lockfile). ✅"
  exit 0
fi
echo "RESULT: ${failures} expectation(s) did not hold. ❌" >&2
exit 1
