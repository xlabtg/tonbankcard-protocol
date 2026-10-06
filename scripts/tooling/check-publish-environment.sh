#!/usr/bin/env bash
# Fail closed if the server-side publication approval gate is missing/unreadable.
set -euo pipefail
: "${GITHUB_REPOSITORY:?}"
: "${PUBLISH_ENVIRONMENT:?}"
gh api "repos/$GITHUB_REPOSITORY/environments/$PUBLISH_ENVIRONMENT" > "$RUNNER_TEMP/publish-environment.json"
node - "$RUNNER_TEMP/publish-environment.json" <<'JS'
const fs = require('node:fs');
const environment = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rule = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
if (!rule?.reviewers?.length || rule.prevent_self_review !== true) {
  throw new Error('Publication requires environment reviewers and prevention of self-review');
}
JS
