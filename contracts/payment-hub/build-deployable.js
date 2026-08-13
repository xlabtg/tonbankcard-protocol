/* Compile every contract source permitted by the deployment manifest. */
'use strict';

require('ts-node/register/transpile-only');

const fs = require('fs');
const path = require('path');
const { build } = require('@tact-lang/compiler/dist/pipeline/build');
const { funcCompile } = require('@tact-lang/compiler/dist/func/funcCompile');
const { createNodeFileSystem } = require('@tact-lang/compiler/dist/vfs/createNodeFileSystem');
const { Logger } = require('@tact-lang/compiler/dist/logger');
const { DEPLOYABLE_CONTRACTS } = require('../../scripts/deploy/deployable-contracts');
const { DEPLOYABLE_BUILD_PROJECTS } = require('../../scripts/deploy/deployable-build-projects');

const repoRoot = path.resolve(__dirname, '../..');
const stdlibRoot = path.resolve(
  path.dirname(require.resolve('@tact-lang/compiler/package.json')),
  'stdlib',
);
const outputRoot = path.resolve(__dirname, 'dist/deployable');

const OUTPUT_NAMES = {
  AccountStateMachine: 'account-state',
  PaymentHub: 'PaymentHub',
};

function verifyCoverage() {
  const expected = Object.values(DEPLOYABLE_CONTRACTS).flat().sort();
  const actual = DEPLOYABLE_BUILD_PROJECTS.map((project) => project.source).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Deployable build coverage mismatch\nexpected: ${expected.join(', ')}\nactual: ${actual.join(', ')}`,
    );
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error('Deployable build manifest contains duplicate sources');
  }
}

async function compileTact(project, logger) {
  const buildName = OUTPUT_NAMES[project.name] || project.name;
  const config = {
    name: buildName,
    path: `./${project.source}`,
    output: ['AccountStateMachine', 'PaymentHub'].includes(project.name)
      ? './contracts/payment-hub/dist'
      : `./contracts/payment-hub/dist/deployable/${project.name}`,
    options: { debug: false, external: true, experimental: { inline: true } },
  };
  const result = await build({
    config,
    project: createNodeFileSystem(repoRoot, false),
    stdlib: createNodeFileSystem(stdlibRoot, false),
    logger,
  });
  if (!result.ok) throw new Error(`Tact compilation failed: ${project.name}`);
}

async function compileFunc(project, logger) {
  const sourcePath = path.resolve(repoRoot, project.source);
  const stdlibPath = path.resolve(stdlibRoot, 'stdlib.fc');
  const result = await funcCompile({
    entries: [sourcePath],
    sources: [
      { path: sourcePath, content: fs.readFileSync(sourcePath, 'utf8') },
      {
        path: path.resolve(path.dirname(sourcePath), 'stdlib.fc'),
        content: fs.readFileSync(stdlibPath, 'utf8'),
      },
    ],
    logger,
  });
  if (!result.ok) throw new Error(`FunC compilation failed: ${project.name}\n${result.log}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, `${project.name}.code.boc`), result.output);
}

async function main() {
  verifyCoverage();
  fs.rmSync(outputRoot, { recursive: true, force: true });
  const logger = new Logger();
  for (const project of DEPLOYABLE_BUILD_PROJECTS) {
    logger.info(`Compiling deployable ${project.name} (${project.source})`);
    if (project.language === 'tact') await compileTact(project, logger);
    else await compileFunc(project, logger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
