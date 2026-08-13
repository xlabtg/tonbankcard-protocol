#!/usr/bin/env bash
# CHECK423-M2/CHECK423-L2: ensure every shipped npm workspace with a committed
# lockfile is represented in both scheduled dependency controls. Test-only
# workspaces under tests/ are intentionally excluded.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW="${REPO_ROOT}/.github/workflows/dependency-audit.yml"
DEPENDABOT="${REPO_ROOT}/.github/dependabot.yml"

required_workspaces=(
  api
  backend/indexer
  dashboard
  docs-site
  mobile
  mobile-app
  scripts/faucet
  sdk
  wallet-ui
)

# Keep the explicit baseline above so deleting a lockfile cannot silently shrink
# the control. Also discover newly committed non-test lockfiles so adding a new
# shipped workspace requires adding it to the audit matrix in the same PR.
while IFS= read -r lockfile; do
  workspace="${lockfile%/package-lock.json}"
  case "${workspace}" in
    tests/*) continue ;;
  esac

  already_required=false
  for required in "${required_workspaces[@]}"; do
    if [ "${required}" = "${workspace}" ]; then
      already_required=true
      break
    fi
  done

  if [ "${already_required}" = false ]; then
    required_workspaces+=("${workspace}")
  fi
done < <(git -C "${REPO_ROOT}" ls-files '**/package-lock.json' | sort)

violations=()

for workspace in "${required_workspaces[@]}"; do
  if [ ! -f "${REPO_ROOT}/${workspace}/package-lock.json" ]; then
    violations+=("${workspace}: package-lock.json is missing")
    continue
  fi

  if ! grep -Eq "^[[:space:]]+path:[[:space:]]+${workspace}$" "${WORKFLOW}"; then
    violations+=("${workspace}: absent from dependency-audit.yml matrix")
  fi

  if [ -f "${DEPENDABOT}" ]; then
    if ! grep -Eq "^[[:space:]]+directory:[[:space:]]+\"?/${workspace}\"?[[:space:]]*$" "${DEPENDABOT}"; then
      violations+=("${workspace}: absent from dependabot.yml updates")
    fi
  fi
done

if [ ! -f "${DEPENDABOT}" ]; then
  violations+=(".github/dependabot.yml is missing")
else
  if ! ruby -ryaml -e '
    config = YAML.load_file(ARGV.fetch(0))
    required = ARGV.drop(1).map { |path| "/#{path}" }.sort
    production = %w[/api /backend/indexer /sdk]
    updates = config.fetch("updates")
    npm = updates.select { |entry| entry["package-ecosystem"] == "npm" }

    abort "expected #{required.length} npm entries, found #{npm.length}" unless npm.length == required.length
    abort "npm directories differ from the audit list" unless npm.map { |entry| entry["directory"] }.sort == required
    abort "GitHub Actions updates are missing" unless updates.any? { |entry| entry["package-ecosystem"] == "github-actions" && entry["directory"] == "/" }

    updates.each do |entry|
      abort "#{entry["directory"]}: schedule is not weekly" unless entry.dig("schedule", "interval") == "weekly"
    end

    npm.each do |entry|
      types = entry.dig("groups", "minor-and-patch", "update-types")
      abort "#{entry["directory"]}: minor/patch group is missing" unless Array(types).sort == %w[minor patch]
      major_ignored = Array(entry["ignore"]).any? do |rule|
        rule["dependency-name"] == "*" && Array(rule["update-types"]).include?("version-update:semver-major")
      end
      expected = production.include?(entry["directory"])
      abort "#{entry["directory"]}: major-update policy is incorrect" unless major_ignored == expected
    end
  ' "${DEPENDABOT}" "${required_workspaces[@]}" 2> >(sed 's/^/dependabot.yml: /' >&2); then
    violations+=("dependabot.yml policy validation failed")
  fi
fi

if [ "${#violations[@]}" -gt 0 ]; then
  echo "::error::Dependency-audit coverage is incomplete:" >&2
  for violation in "${violations[@]}"; do
    echo "  - ${violation}" >&2
  done
  exit 1
fi

echo "OK: all ${#required_workspaces[@]} shipped locked npm workspaces are audited and updated."
