#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const eslintConfigNames = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
];

function findLintWorkspaces(directory) {
  const workspaces = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      workspaces.push(...findLintWorkspaces(entryPath));
      continue;
    }

    if (entry.name !== 'package.json') {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
    if (packageJson.scripts?.lint) {
      workspaces.push(path.dirname(entryPath));
    }
  }

  return workspaces;
}

const lintWorkspaces = findLintWorkspaces(repositoryRoot).sort();
const ciWorkflow = fs.readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
const lintJobStart = ciWorkflow.indexOf('\n  lint:\n');
const lintJobEnd = lintJobStart === -1 ? -1 : ciWorkflow.indexOf('\n  secrets-hygiene:\n', lintJobStart);
const errors = [];

if (lintJobStart === -1 || lintJobEnd === -1) {
  console.error('Lint workspace coverage check failed: CI lint job не найден');
  process.exit(1);
}

const lintJob = ciWorkflow.slice(lintJobStart, lintJobEnd);

for (const workspace of lintWorkspaces) {
  const relativeWorkspace = path.relative(repositoryRoot, workspace).replaceAll(path.sep, '/');
  const hasConfig = eslintConfigNames.some((name) => fs.existsSync(path.join(workspace, name)));

  if (!hasConfig) {
    errors.push(`${relativeWorkspace}: отсутствует ESLint-конфигурация`);
  }

  const lintStepPattern = new RegExp(
    `working-directory:\\s*['\"]?${relativeWorkspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]?[\\s\\S]{0,120}?run:\\s*npm run lint(?:\\s|$)`,
  );
  if (!lintStepPattern.test(lintJob)) {
    errors.push(`${relativeWorkspace}: отсутствует в CI lint job`);
  }
}

if (errors.length > 0) {
  console.error('Lint workspace coverage check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Lint workspace coverage check passed for ${lintWorkspaces.length} workspaces.`);
